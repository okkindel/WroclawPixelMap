// Wysokości z modeli 3D GUGiK (LoD1 2024, CC BY 4.0; npm run lod2).
// measuredHeight = mediana skaningu laserowego nad terenem. Zastępuje tylko wysokości szacowane z OSM
// (piętra / wartości domyślne); kościoły, części budynków i jawne `height` zostają.
import { existsSync } from 'node:fs'
import { r1 } from '../../lib/geo.ts'
import { readJson } from '../../lib/json.ts'
import { LOD1_MIN_H, lod1Height } from '../../lib/rules.ts'
import type { Lod2Building } from '../lod2.ts'
import { pointInRing, ringOf } from './geometry.ts'
import { buildingGrid } from './grid.ts'
import type { BakeState } from './state.ts'

const FILE = 'data/lod2/buildings.json'

export async function applyLod1(s: BakeState) {
  if (!existsSync(FILE)) return
  const { out } = s
  const lod = await readJson<Pick<Lod2Building, 'c' | 'mh' | 'H'>[]>(FILE)
  const CELL = 50
  const grid = buildingGrid(out.buildings, CELL, (b) => s.estimated.has(b))
  const best = new Map<number, number>()
  for (const l of lod) {
    const h = l.mh ?? l.H
    if (!(h > LOD1_MIN_H)) continue
    const [x, y] = l.c
    for (const i of grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) ?? []) {
      if (pointInRing([x, y], ringOf(out.buildings[i].o))) {
        best.set(i, Math.max(best.get(i) ?? 0, h))
        break
      }
    }
  }
  for (const [i, h] of best) {
    const b = out.buildings[i]
    b.H = r1(lod1Height(h, b.m ?? 0, !!b.rs))
  }
  console.log(`wysokości z LoD1 GUGiK: ${best.size} budynków`)
}
