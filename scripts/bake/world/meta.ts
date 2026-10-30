// Dane spoza kafli: wyszukiwarka, krasnale, tor żużlowy, boiska stadionów, osiedla → public/data/meta.json.
import { writeFile } from 'node:fs/promises'
import { centroid } from '../../../src/engine/geo.ts'
import type { Dwarf, Flat, Named, Place, World, WorldMeta } from '../../../src/types/world.ts'
import { TILE } from '../../lib/config.ts'
import { r1 } from '../../lib/geo.ts'
import type { OsmEl, Tags } from '../../lib/osm.ts'
import { PLACE_RANK } from '../../lib/rules.ts'
import { flat, inBox, meanPt, openRing, pointInRing, proj, ringArea, ringOf, same, wayPts } from './geometry.ts'
import { uniquePois } from './pois.ts'
import type { BakeState, Sources } from './state.ts'
import type { TileMap } from './tiles.ts'
import type { Built } from './structures.ts'

// Nazwane miejsca do wyszukiwarki: ulice (środek) i nazwane budynki; pierwsza nazwa wygrywa.
export function namedPlaces(out: World): Named[] {
  const named = new Map<string, Named>()
  for (const r of out.roads) {
    if (!r.n || named.has(r.n)) continue
    const i = Math.floor(r.p.length / 4) * 2
    named.set(r.n, [r.n, r.p[i], r.p[i + 1], 'ulica'])
  }
  for (const b of out.buildings) {
    if (!b.n || named.has(b.n)) continue
    const [x, y] = centroid(b.o)
    named.set(b.n, [b.n, r1(x), r1(y), 'budynek'])
  }
  return [...named.values()]
}

export function dwarfs(rawDwarfs: OsmEl[]): Dwarf[] {
  const list: Dwarf[] = []
  for (const el of rawDwarfs) {
    const t: Tags = el.tags || {}
    const lat = el.lat ?? el.center?.lat,
      lon = el.lon ?? el.center?.lon
    if (lat == null || lon == null) continue
    const [x, y] = proj(lat, lon)
    list.push({
      id: el.id,
      x,
      y,
      n: t.name || t.alt_name || 'Krasnal bez imienia',
      a: t.artist_name || undefined,
      d: t.start_date || undefined,
      img: t.image || undefined,
      i: t.inscription || undefined,
      in: inBox([x, y]) ? 1 : undefined,
    })
  }
  return list
}

// Najdłuższy zamknięty tor żużlowy (na Olimpijskim jest jeden).
function speedway(els: OsmEl[]): Flat | null {
  const rings = els
    .flatMap((e) => (e.type === 'way' && e.geometry && e.tags?.sport?.includes('speedway') ? [wayPts(e.geometry)] : []))
    .filter((p) => p.length > 8 && same(p[0], p[p.length - 1]))
    .sort((a, b) => ringArea(b) - ringArea(a))
  return rings.length ? flat(openRing(rings[0])) : null
}

export async function writeMeta(s: BakeState, src: Sources, tiles: TileMap, built: Built) {
  const { out } = s
  const meta: WorldMeta = {
    origin: out.origin,
    bounds: out.bounds,
    tile: TILE,
    tiles: [...tiles.entries()].map(([k, t]) => ({ k, n: t.buildings.length })),
    cityWalls: out.cityWalls,
    named: out.named,
    dwarfs: out.dwarfs,
    runway: out.runway,
    speedway: speedway([...src.extras, ...src.world]),
    stadiums: out.stadiums,
    // boisko, którego środek leży w obrysie stadionu
    pitches: s.soccer.flatMap((o) => {
      const c = meanPt(ringOf(o))
      const st = out.stadiums.find((st) => pointInRing(c, ringOf(st.o)))
      return st ? [{ o, stadium: st.n }] : []
    }),
    structures: built.list,
    aerialways: built.lines,
    pois: uniquePois(s.pois),
    places: src.places.flatMap((e): Place[] => {
      const name = e.tags?.name
      if (e.lat == null || e.lon == null || !name) return []
      return [[name, ...proj(e.lat, e.lon), PLACE_RANK[e.tags?.place ?? ''] ?? 2]]
    }),
  }
  const json = JSON.stringify(meta)
  await writeFile('public/data/meta.json', json)
  return json.length
}
