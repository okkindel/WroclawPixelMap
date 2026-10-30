// Napisy obiektów z OSM (POI): nazwane budynki/obszary o znanej funkcji albo z Wikipedią.
import { existsSync } from 'node:fs'
import type { Building, Poi } from '../../../src/types/world.ts'
import { readJson } from '../../lib/json.ts'
import { r1 } from '../../lib/geo.ts'
import { type OsmEl, type Tags, year } from '../../lib/osm.ts'
import { GENERIC, poiKind, poiRank } from '../../lib/rules.ts'
import type { Pt } from '../../lib/geo.ts'
import { inBox, meanPt, polygons, ringArea, wayPts } from './geometry.ts'

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
  const wiki = wikiUrl(t)
  const rank = poiRank(k, t)
  // rok powstania (start_date z OSM): napis chowany we wcześniejszych epokach
  const from = year(t.start_date) ?? undefined
  for (const [x, y] of anchors(el)) {
    if (!inBox([x, y])) continue
    pois.push(
      from ? [t.name, r1(x), r1(y), k, rank, wiki, from] : wiki ? [t.name, r1(x), r1(y), k, rank, wiki] : [t.name, r1(x), r1(y), k, rank],
    )
  }
}

// Obszar z kilku odległych części (ASP przy pl. Polskim i przy Traugutta, Park Szczytnicki): napis przy każdej
// części od PART_MIN_AREA m², oddalonej o PART_APART m od pozostałych. Średnia ze wszystkich punktów wypadała między nimi.
const PART_MIN_AREA = 1500
const PART_APART = 250
function anchors(el: OsmEl): Pt[] {
  if (el.type === 'way') return el.geometry ? [meanPt(wayPts(el.geometry))] : []
  const parts = polygons(el)
    .map((p) => ({ c: meanPt(p.outer), a: ringArea(p.outer) }))
    .sort((p, q) => q.a - p.a)
  const out: Pt[] = []
  for (const p of parts)
    if (!out.length || (p.a >= PART_MIN_AREA && out.every((c) => Math.hypot(c[0] - p.c[0], c[1] - p.c[1]) >= PART_APART))) out.push(p.c)
  return out
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

// Ręczne przypisania artykułów (content/wiki-links.json) dla obiektów z OSM bez tagu wikipedia:
// napis obiektu dostaje link, a nazwany budynek bez napisu dostaje nowy napis „ciekawe miejsce” (z bliska),
// z rokiem budowy tego budynku, żeby nie pojawiał się w epokach sprzed jego powstania.
const WIKI_LINKS = 'content/wiki-links.json'
// tak daleko od punktu z pliku może leżeć napis albo budynek o tej nazwie
const WIKI_LINK_RADIUS = 300

export async function addWikiLinks(pois: Poi[], buildings: Building[]) {
  if (!existsSync(WIKI_LINKS)) return
  const { links } = await readJson<{ links: Record<string, { wiki: string; x: number; y: number }> }>(WIKI_LINKS)
  const near = (x: number, y: number, l: { x: number; y: number }) => Math.hypot(x - l.x, y - l.y) < WIKI_LINK_RADIUS
  let linked = 0,
    added = 0
  for (const [name, l] of Object.entries(links)) {
    const poi = pois.find((p) => p[0] === name && near(p[1], p[2], l))
    if (poi) {
      poi[5] ??= l.wiki
      linked++
      continue
    }
    const b = buildings.find((b) => b.n === name && near(b.o[0], b.o[1], l))
    pois.push(b?.y ? [name, l.x, l.y, 'notable', 2, l.wiki, b.y] : [name, l.x, l.y, 'notable', 2, l.wiki])
    added++
  }
  console.log(`linki do Wikipedii z ${WIKI_LINKS}: ${linked} napisów, ${added} nowych`)
}

// Jedna nazwa w jednym miejscu = jeden napis (budynek bywa zmapowany kilka razy, np. obszar i bryła): zostaje ostatni
// wpis na miejscu pierwszego. Ta sama nazwa dalej niż PART_APART (części jednego obszaru) to osobny napis.
export function uniquePois(pois: Poi[]): Poi[] {
  const out: Poi[] = []
  for (const p of pois) {
    const i = out.findIndex((q) => q[0] === p[0] && Math.hypot(q[1] - p[1], q[2] - p[2]) < PART_APART)
    if (i < 0) out.push(p)
    else out[i] = p
  }
  return out
}
