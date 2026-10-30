// Kafle mapy: wczytywane od środka widoku, każdy ma własne siatki (kamera pomija te poza kadrem).
import * as THREE from 'three'
import { C } from '../engine/palette.ts'
import type { Building, TileData, World, WorldMeta } from '../types/world.ts'
import { buildBuildings, type BuildOpts } from './buildings.ts'
import { buildGround } from './ground.ts'
import { buildTrees, recolorTrees } from './trees.ts'

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

export class Tiles {
  meta: WorldMeta
  list: Tile[] = []
  group = new THREE.Group()
  // zbiorczy widok wszystkich wczytanych kafli (dla ruchu, epok, wyszukiwarki)
  world: World
  private mats: Materials
  private opts: BuildOpts = {}
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
    const worker = async () => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        const res = await fetch(`${import.meta.env.BASE_URL}data/tiles/${t.k}.json`)
        this.add(t.k, await res.json())
        onProgress(++done, this.meta.tiles.length)
        // oddaj klatkę przeglądarce, żeby mapa rysowała się w trakcie wczytywania
        await new Promise((r) => requestAnimationFrame(r))
      }
    }
    await Promise.all([worker(), worker(), worker()])
  }

  private add(key: string, data: TileData) {
    const seed = this.list.length * 100003
    const ground = buildGround(data)
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
    const buildings = mesh(buildBuildings(data.buildings, this.opts, seed), this.mats.buildings)
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

  setBuildOpts(opts: BuildOpts) {
    this.opts = opts
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
