// Napisy obiektów z OSM (POI): nazwane budynki/obszary o znanej funkcji albo z Wikipedią.
import type { Poi } from '../../../src/types/world.ts'
import { r1 } from '../../lib/geo.ts'
import { type OsmEl, type Tags, year } from '../../lib/osm.ts'
import { GENERIC, poiKind, poiRank } from '../../lib/rules.ts'
import { inBox, meanPt, wayPts } from './geometry.ts'

// Adres artykułu: Wikipedia (tag wikipedia=lang:Tytuł), inaczej Wikidane.
function wikiUrl(t: Tags): string | undefined {
  const wp = t.wikipedia?.match(/^(\w+):(.+)$/)
  if (wp) return `https://${wp[1]}.wikipedia.org/wiki/${encodeURIComponent(wp[2].replace(/ /g, '_'))}`
  return t.wikidata ? `https://www.wikidata.org/wiki/${t.wikidata}` : undefined
}

export function addPoi(pois: Poi[], el: OsmEl, t: Tags) {
  if (!t.name || GENERIC.test(t.name.trim()) || (!el.geometry && !el.members)) return
  const k = poiKind(t)
  if (!k) return
  const pts =
    el.type === 'way' && el.geometry
      ? wayPts(el.geometry)
      : (el.members ?? []).flatMap((m) => (m.role !== 'inner' && m.geometry ? wayPts(m.geometry) : []))
  if (!pts.length) return
  const [x, y] = meanPt(pts)
  if (!inBox([x, y])) return
  const wiki = wikiUrl(t)
  const rank = poiRank(k, t)
  // rok powstania (start_date z OSM): napis chowany we wcześniejszych epokach
  const from = year(t.start_date) ?? undefined
  pois.push(
    from ? [t.name, r1(x), r1(y), k, rank, wiki, from] : wiki ? [t.name, r1(x), r1(y), k, rank, wiki] : [t.name, r1(x), r1(y), k, rank],
  )
}

// Szkoły-punkty: addPoi potrzebuje geometrii, więc punkt zamieniamy na jednopunktową linię.
export function addSchools(pois: Poi[], schools: OsmEl[]) {
  for (const el of schools) {
    const t = el.tags || {}
    if (el.type === 'node' && el.lat != null && el.lon != null)
      addPoi(pois, { ...el, type: 'way', geometry: [{ lat: el.lat, lon: el.lon }] }, t)
    else addPoi(pois, el, t)
  }
}

// Jedna nazwa = jeden napis (budynek bywa zmapowany kilka razy, np. obszar i bryła): zostaje ostatni wpis na miejscu pierwszego.
export const uniquePois = (pois: Poi[]): Poi[] => [...new Map(pois.map((p) => [p[0], p])).values()]
