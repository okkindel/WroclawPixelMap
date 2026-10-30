// Podział świata na kafle TILE × TILE m i zapis public/data/tiles/I_J.bin (src/world/tilecodec.ts).
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import type { TileData, World } from '../../../src/types/world.ts'
import { encodeTile } from '../../../src/world/tilecodec.ts'
import { TILE } from '../../lib/config.ts'
import { MINX, MINY } from './geometry.ts'

export type TileMap = Map<string, TileData>

// Lewy dolny róg kafla „I_J” w metrach lokalnych.
export function tileCorner(k: string): [number, number] {
  const [i, j] = k.split('_').map(Number)
  return [MINX + i * TILE, MINY + j * TILE]
}

// Każdy obiekt trafia do kafla swojego pierwszego punktu (duże wielokąty, np. Odra, są w jednym kaflu).
export function splitTiles(out: World): TileMap {
  const tiles: TileMap = new Map()
  const tileOf = (x: number, y: number) => {
    const k = `${Math.floor((x - MINX) / TILE)}_${Math.floor((y - MINY) / TILE)}`
    let t = tiles.get(k)
    if (!t) tiles.set(k, (t = { buildings: [], water: [], green: [], plazas: [], roads: [], rails: [], trams: [], trees: [] }))
    return t
  }
  for (const b of out.buildings) tileOf(b.o[0], b.o[1]).buildings.push(b)
  for (const w of out.water) tileOf(w.o[0], w.o[1]).water.push(w)
  for (const g of out.green) tileOf(g.o[0], g.o[1]).green.push(g)
  for (const p of out.plazas) tileOf(p.o[0], p.o[1]).plazas.push(p)
  for (const r of out.roads) tileOf(r.p[0], r.p[1]).roads.push(r)
  for (const r of out.rails) tileOf(r.p[0], r.p[1]).rails.push(r)
  for (const r of out.trams) tileOf(r.p[0], r.p[1]).trams.push(r)
  for (let i = 0; i < out.trees.length; i += 2) tileOf(out.trees[i], out.trees[i + 1]).trees.push(out.trees[i], out.trees[i + 1])
  return tiles
}

// Zapisuje kafle binarne (współrzędne względem rogu kafla); zwraca łączny rozmiar w bajtach.
// Czyścimy tylko stare kafle i pliki w innym formacie (usunięcie całego katalogu myli serwer deweloperski Vite).
export async function writeTiles(tiles: TileMap): Promise<number> {
  await mkdir('public/data/tiles', { recursive: true })
  for (const f of await readdir('public/data/tiles'))
    if (!f.endsWith('.bin') || !tiles.has(f.replace('.bin', ''))) await rm(`public/data/tiles/${f}`)
  let bytes = 0
  for (const [k, t] of tiles) {
    const bin = encodeTile(t, ...tileCorner(k))
    bytes += bin.length
    await writeFile(`public/data/tiles/${k}.bin`, bin)
  }
  return bytes
}
