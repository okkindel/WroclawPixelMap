// Budynek albo część budynku (building:part) -> bryły. Dla części typ bierzemy z tagu building:part.
import type { Building } from '../../../src/types/world.ts'
import { r1 } from '../../lib/geo.ts'
import { num, type OsmEl, type Tags, year } from '../../lib/osm.ts'
import {
  MAX_H,
  MIN_BUILDING_AREA,
  buildingKind,
  constructionYear,
  guessHeight,
  isEstimatedHeight,
  isHouse,
  looksLikeChimney,
  minHeight,
  roofShape,
  taggedHeight,
} from '../../lib/rules.ts'
import { encodePoly, polygons, ringArea } from './geometry.ts'
import type { NidMatcher } from './nid-match.ts'

export function toBuildings(el: OsmEl, t: Tags, buildingTag: string, nid: NidMatcher, estimated: WeakSet<Building>): Building[] {
  const out: Building[] = []
  const kind = buildingKind(t, buildingTag)
  const h = taggedHeight(t, num(t['building:levels']))
  // h jest znane dokładnie wtedy, gdy OSM ma height albo piętra
  const known = h != null
  const minH = minHeight(t, kind, h)
  for (const p of polygons(el)) {
    const area = ringArea(p.outer)
    if (area < MIN_BUILDING_AREA) continue
    const house = isHouse(buildingTag, kind, area)
    const hh = h ?? guessHeight(kind, area, house)
    const k = looksLikeChimney(t, p.outer.length, area, hh) && (kind === 'gen' || kind === 'ind') ? 'chimney' : kind
    const nidHit = t.start_date ? null : nid.yearFor(t, p)
    const b: Building = {
      ...encodePoly(p),
      H: r1(Math.min(hh, MAX_H)),
      m: minH ? r1(minH) : undefined,
      k,
      y: year(t.start_date) ?? nidHit?.y ?? constructionYear(buildingTag),
      rs: roofShape(t, known, house),
      rh: num(t['roof:height']) ?? undefined,
      rc: t['roof:colour'] || undefined,
      c: t['building:colour'] || undefined,
      bm: t['building:material'] || undefined,
      rm: t['roof:material'] || undefined,
      n: t.name || undefined,
    }
    if (isEstimatedHeight(t, k)) estimated.add(b)
    out.push(b)
  }
  return out
}
