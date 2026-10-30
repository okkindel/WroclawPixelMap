// Kafle mapy: wczytywane od środka widoku, każdy ma własne siatki (kamera pomija te poza kadrem).
import * as THREE from 'three'
import { C } from '../engine/palette.ts'
import type { Building, TileData, World, WorldMeta } from '../types/world.ts'
import { buildBuildings, type BuildOpts } from './buildings.ts'
import { buildGround } from './ground.ts'
import { buildTrees, recolorTrees } from './trees.ts'
import { unpack, type Packed } from './packed.ts'
import { decodeTile } from './tilecodec.ts'

// progi uproszczonych brył (z histerezą) i budżet przebudowy na klatkę
import { LOD_BUDGET, LOD_IN, LOD_OUT } from '../rules/render.ts'

export interface Materials {
  ground: THREE.Material
  roads: THREE.Material
  water: THREE.Material
  buildings: THREE.Material
}

export interface Tile {
  key: string
  seed: number
  data: TileData
  group: THREE.Group
  buildings: THREE.Mesh // pełne bryły
  simple: THREE.Mesh // uproszczone bryły (daleko)
  far: boolean // która wersja jest widoczna
  // wersja do przebudowania przy następnym pokazaniu (zmiana epoki, gdy była ukryta)
  stale: { full: boolean; simple: boolean }
  trees: THREE.InstancedMesh | null
}

interface WorkerResult {
  key: string
  data: TileData
  ground: Packed
  water: Packed
  roads: Packed
  bridges: Packed
  buildings: Packed
  simple: Packed
}

export class Tiles {
  meta: WorldMeta
  list: Tile[] = []
  group = new THREE.Group()
  // zbiorczy widok wszystkich wczytanych kafli (dla ruchu, epok, wyszukiwarki)
  world: World
  private mats: Materials
  private opts: BuildOpts = {}
  // w epoce „dziś” budynki można zbudować w wątku roboczym (bez funkcji filtrujących)
  private defaultOpts = true
  private treePalette: string[] = C.tree
  private treesOn = true
  // daleki widok (uproszczone bryły)
  private far = false

  constructor(meta: WorldMeta, mats: Materials) {
    this.meta = meta
    this.mats = mats
    this.world = { ...meta, buildings: [], water: [], green: [], plazas: [], roads: [], rails: [], trams: [], trees: [] }
  }

  // Wczytuje kafle zaczynając od najbliższych punktu (x, y); onProgress po każdym kaflu.
  async load(x: number, y: number, onProgress: (done: number, total: number) => void) {
    const { tile, bounds } = this.meta
    const center = (k: string) => {
      const [i, j] = k.split('_').map(Number)
      return [bounds[0] + (i + 0.5) * tile, bounds[1] + (j + 0.5) * tile]
    }
    const queue = this.meta.tiles.map((t) => ({ ...t, d: Math.hypot(center(t.k)[0] - x, center(t.k)[1] - y) })).sort((a, b) => a.d - b.d)
    let done = 0
    const url = (k: string) => new URL(`${import.meta.env.BASE_URL}data/tiles/${k}.bin`, location.href).href
    // kilka wątków roboczych buduje siatki równolegle; bez obsługi Workerów — budowa w głównym wątku
    const threads = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 1))
    const run = async (w: Worker | null) => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        const seed = this.seeds++ * 100003
        if (w && this.defaultOpts) {
          const key = t.k
          const msg = await new Promise<WorkerResult>((resolve) => {
            w.onmessage = (e) => resolve(e.data)
            w.postMessage({ url: url(key), key, seed })
          })
          this.add(key, msg.data, seed, msg)
        } else {
          this.add(t.k, decodeTile(await (await fetch(url(t.k))).arrayBuffer()), seed)
          // oddaj klatkę przeglądarce, żeby mapa rysowała się w trakcie wczytywania
          await new Promise((r) => requestAnimationFrame(r))
        }
        onProgress(++done, this.meta.tiles.length)
      }
      w?.terminate()
    }
    const make = () => {
      try {
        return new Worker(new URL('./tile-worker.ts', import.meta.url), { type: 'module' })
      } catch {
        return null
      }
    }
    await Promise.all(Array.from({ length: threads }, () => run(make())))
    if (import.meta.env.DEV) {
      const tris = (m: THREE.Mesh) => m.geometry.getAttribute('position').count / 3
      let full = 0,
        simple = 0
      for (const t of this.list)
        if (!t.stale.full && !t.stale.simple) {
          full += tris(t.buildings)
          simple += tris(t.simple)
        }
      console.info(`budynki: ${full} trójkątów pełnych, ${simple} uproszczonych (${((simple / full) * 100).toFixed(0)}%)`)
    }
  }

  private seeds = 0

  private add(key: string, data: TileData, seed: number, pre?: WorkerResult) {
    const ground = pre
      ? { ground: unpack(pre.ground), water: unpack(pre.water), roads: unpack(pre.roads), bridges: unpack(pre.bridges) }
      : buildGround(data)
    const group = new THREE.Group()
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => {
      const x = new THREE.Mesh(g, m)
      x.receiveShadow = true
      group.add(x)
      return x
    }
    mesh(ground.ground, this.mats.ground)
    mesh(ground.water, this.mats.water)
    mesh(ground.roads, this.mats.roads)
    mesh(ground.bridges, this.mats.roads).castShadow = true
    // z wątku przychodzą obie wersje w wyglądzie „dziś”; inaczej budujemy tylko widoczną, drugą przy pierwszym pokazaniu
    const ready = !!pre && this.defaultOpts,
      far = this.far
    const empty = () => new THREE.BufferGeometry()
    const buildings = mesh(
      ready ? unpack(pre.buildings) : far ? empty() : buildBuildings(data.buildings, this.opts, seed),
      this.mats.buildings,
    )
    const simple = mesh(
      ready ? unpack(pre.simple) : far ? buildBuildings(data.buildings, { ...this.opts, simple: true }, seed) : empty(),
      this.mats.buildings,
    )
    buildings.castShadow = simple.castShadow = true
    buildings.visible = !far
    simple.visible = far
    let trees: THREE.InstancedMesh | null = null
    if (data.trees.length) {
      trees = buildTrees(data.trees, this.treePalette, seed)
      trees.visible = this.treesOn && !far
      group.add(trees)
    }
    const t: Tile = { key, seed, data, group, buildings, simple, far, stale: { full: !ready && far, simple: !ready && !far }, trees }
    this.list.push(t)
    this.group.add(group)
    const w = this.world
    w.buildings.push(...data.buildings)
    w.water.push(...data.water)
    w.green.push(...data.green)
    w.plazas.push(...data.plazas)
    w.roads.push(...data.roads)
    w.rails.push(...data.rails)
    w.trams.push(...data.trams)
    w.trees.push(...data.trees)
  }

  setBuildOpts(opts: BuildOpts, isDefault = false) {
    // przy pierwszym ustawieniu „dziś” (np. start) nie trzeba przebudowywać
    if (isDefault && this.defaultOpts && this.opts === opts) return
    this.opts = opts
    this.defaultOpts = isDefault
    for (const t of this.list) {
      t.stale = { full: true, simple: true }
      this.rebuild(t, t.far)
    }
  }

  private rebuild(t: Tile, far: boolean) {
    const m = far ? t.simple : t.buildings
    m.geometry.dispose()
    m.geometry = buildBuildings(t.data.buildings, far ? { ...this.opts, simple: true } : this.opts, t.seed)
    if (far) t.stale.simple = false
    else t.stale.full = false
  }

  // Przełącza kafle między pełnymi a uproszczonymi bryłami według powiększenia kamery.
  // Brakującą wersję dobudowuje po kilka kafli na klatkę (do tego czasu widać poprzednią).
  setZoom(zoom: number) {
    if (zoom < LOD_IN) this.far = true
    else if (zoom > LOD_OUT) this.far = false
    let budget = LOD_BUDGET
    for (const t of this.list) {
      if (t.far === this.far) continue
      if (this.far ? t.stale.simple : t.stale.full) {
        if (budget-- <= 0) continue
        this.rebuild(t, this.far)
      }
      t.far = this.far
      t.buildings.visible = !t.far
      t.simple.visible = t.far
      if (t.trees) t.trees.visible = this.treesOn && !t.far
    }
  }

  setTreePalette(p: string[]) {
    this.treePalette = p
    for (const t of this.list) if (t.trees) recolorTrees(t.trees, p)
  }

  // drzewa tylko przy pełnych bryłach
  setTreesVisible(v: boolean) {
    this.treesOn = v
    for (const t of this.list) if (t.trees) t.trees.visible = v && !t.far
  }

  // Który budynek trafił promień (lub undefined).
  pick(ray: THREE.Raycaster): Building | undefined {
    const hit = ray.intersectObjects(this.list.map((t) => (t.far ? t.simple : t.buildings)))[0]
    if (hit?.faceIndex == null) return undefined
    const tile = this.list.find((t) => t.buildings === hit.object || t.simple === hit.object)
    if (!tile) return undefined
    const mesh = tile.buildings === hit.object ? tile.buildings : tile.simple
    // indeks budynku dla każdego trójkąta (Geo.build / unpack)
    const owners: Int32Array = mesh.geometry.userData.owners
    return tile.data.buildings[owners[hit.faceIndex]]
  }
}
