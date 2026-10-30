// Siatka indeksów budynków: komórka -> budynki, których prostokąt otaczający na nią zachodzi.
import { bbox } from '../../../src/engine/geo.ts'
import type { Building } from '../../../src/types/world.ts'
import { pointInRing, ringOf } from './geometry.ts'

export type Grid = Map<string, number[]>

export function buildingGrid(buildings: Building[], cell: number, include: (b: Building) => boolean = () => true): Grid {
  const grid: Grid = new Map()
  buildings.forEach((b, i) => {
    if (!include(b)) return
    const [x0, y0, x1, y1] = bbox(b.o)
    for (let x = Math.floor(x0 / cell); x <= Math.floor(x1 / cell); x++)
      for (let y = Math.floor(y0 / cell); y <= Math.floor(y1 / cell); y++) {
        const k = `${x},${y}`
        const l = grid.get(k) ?? []
        l.push(i)
        grid.set(k, l)
      }
  })
  return grid
}

// Indeks budynku, w którego obrysie leży punkt (pierwszy z komórki), albo undefined.
export const ownerAt = (buildings: Building[], grid: Grid, cell: number) => (x: number, y: number) =>
  (grid.get(`${Math.floor(x / cell)},${Math.floor(y / cell)}`) ?? []).find((i) => pointInRing([x, y], ringOf(buildings[i].o)))
