// Kafle mapy: wczytywane od środka widoku, każdy ma własne siatki (kamera pomija te poza kadrem).
import * as THREE from 'three'
import { C } from '../engine/palette.ts'
import type { Building, TileData, World, WorldMeta } from '../types/world.ts'
import { buildBuildings, type BuildOpts } from './buildings.ts'
import { buildGround } from './ground.ts'
import { buildTrees, recolorTrees } from './trees.ts'
import { unpack, type Packed } from './packed.ts'

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
  buildings: THREE.Mesh
  trees: THREE.InstancedMesh | null
}

interface WorkerResult { key: string; data: TileData; ground: Packed; water: Packed; roads: Packed; bridges: Packed; buildings: Packed }

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
    const queue = this.meta.tiles
      .map((t) => ({ ...t, d: Math.hypot(center(t.k)[0] - x, center(t.k)[1] - y) }))
      .sort((a, b) => a.d - b.d)
    let done = 0
    const url = (k: string) => new URL(`${import.meta.env.BASE_URL}data/tiles/${k}.json`, location.href).href
    // kilka wątków roboczych buduje siatki równolegle; bez obsługi Workerów — budowa w głównym wątku
    const threads = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 1))
    const run = async (w: Worker | null) => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        const seed = this.seeds++ * 100003
        if (w && this.defaultOpts) {
          const msg = await new Promise<WorkerResult>((resolve) => { w.onmessage = (e) => resolve(e.data); w.postMessage({ url: url(t!.k), key: t!.k, seed }) })
          this.add(t.k, msg.data, seed, msg)
        } else {
          this.add(t.k, await (await fetch(url(t.k))).json(), seed)
          // oddaj klatkę przeglądarce, żeby mapa rysowała się w trakcie wczytywania
          await new Promise((r) => requestAnimationFrame(r))
        }
        onProgress(++done, this.meta.tiles.length)
      }
      w?.terminate()
    }
    const make = () => { try { return new Worker(new URL('./tile-worker.ts', import.meta.url), { type: 'module' }) } catch { return null } }
    await Promise.all(Array.from({ length: threads }, () => run(make())))
  }

  private seeds = 0

  private add(key: string, data: TileData, seed: number, pre?: WorkerResult) {
    const ground = pre ? { ground: unpack(pre.ground), water: unpack(pre.water), roads: unpack(pre.roads), bridges: unpack(pre.bridges) } : buildGround(data)
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
    const buildings = mesh(pre && this.defaultOpts ? unpack(pre.buildings) : buildBuildings(data.buildings, this.opts, seed), this.mats.buildings)
    buildings.castShadow = true
    let trees: THREE.InstancedMesh | null = null
    if (data.trees.length) {
      trees = buildTrees(data.trees, this.treePalette, seed)
      group.add(trees)
    }
    const t: Tile = { key, seed, data, group, buildings, trees }
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
      t.buildings.geometry.dispose()
      t.buildings.geometry = buildBuildings(t.data.buildings, opts, t.seed)
    }
  }

  setTreePalette(p: string[]) {
    this.treePalette = p
    for (const t of this.list) if (t.trees) recolorTrees(t.trees, p)
  }

  setTreesVisible(v: boolean) {
    for (const t of this.list) if (t.trees) t.trees.visible = v
  }

  // Który budynek trafił promień (lub undefined).
  pick(ray: THREE.Raycaster): Building | undefined {
    const hit = ray.intersectObjects(this.list.map((t) => t.buildings))[0]
    if (hit?.faceIndex == null) return undefined
    const tile = this.list.find((t) => t.buildings === hit.object)!
    return tile.data.buildings[(tile.buildings.geometry.userData.owners as Int32Array)[hit.faceIndex]]
  }
}
