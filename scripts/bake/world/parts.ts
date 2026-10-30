// Części budynków (Simple 3D Buildings): rysujemy je zamiast obrysu budynku, w którym leżą
// (np. Hala Stulecia, wieże kościołów). Część dziedziczy po budynku nazwę, rok i rodzaj
// (żeby kościół miał ceglane ściany, a klik pokazywał nazwę).
import { centroid } from '../../../src/engine/geo.ts'
import type { Building } from '../../../src/types/world.ts'
import { r1 } from '../../lib/geo.ts'
import type { OsmEl, Tags } from '../../lib/osm.ts'
import { Z_FIGHT_LOWER, Z_FIGHT_MIN_ABOVE_BASE, Z_FIGHT_SHRINK, partKind, partsReplaceOutline } from '../../lib/rules.ts'
import { ringArea, ringOf, shrink } from './geometry.ts'
import { buildingGrid, ownerAt } from './grid.ts'
import { toBuildings } from './buildings.ts'
import type { NidMatcher } from './nid-match.ts'
import type { BakeState } from './state.ts'

export function applyParts(s: BakeState, rawParts: OsmEl[], nid: NidMatcher) {
  const { out } = s
  const CELL = 200
  const owner = ownerAt(out.buildings, buildingGrid(out.buildings, CELL), CELL)
  // powierzchnia części w każdym budynku
  const covered = new Map<number, number>()
  const added: Building[] = []
  for (const el of rawParts) {
    const t: Tags = el.tags || {}
    if (t['building:part'] === 'no' || t.building) continue
    for (const part of toBuildings(el, t, t['building:part'], nid, s.estimated)) {
      const i = owner(...centroid(part.o))
      if (i != null) {
        const parent = out.buildings[i]
        covered.set(i, (covered.get(i) ?? 0) + ringArea(ringOf(part.o)))
        part.n ??= parent.n
        part.y ??= parent.y
        part.k = partKind(part.k, parent.k)
      }
      added.push(part)
    }
  }
  const replaced = new Set(
    [...covered].filter(([i, a]) => partsReplaceOutline(a, ringArea(ringOf(out.buildings[i].o)), out.buildings[i].H)).map(([i]) => i),
  )
  // obrys, który zostaje obok części: niżej i zwężony (z-fighting)
  for (const i of covered.keys()) {
    if (replaced.has(i)) continue
    const b = out.buildings[i]
    b.H = r1(Math.max(b.H - Z_FIGHT_LOWER, (b.m ?? 0) + Z_FIGHT_MIN_ABOVE_BASE))
    b.o = shrink(b.o, Z_FIGHT_SHRINK)
  }
  out.buildings = out.buildings.filter((_, i) => !replaced.has(i)).concat(added)
  console.log(`części budynków: ${added.length}, zastąpione obrysy: ${replaced.size}`)
}
