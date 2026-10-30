// Główny przebieg po danych świata: budynki, woda, zieleń, place, mury, drogi i tory (+ zbieranie POI).
import type { GreenKind } from '../../../src/types/world.ts'
import { num, type OsmEl, type Tags } from '../../lib/osm.ts'
import { GREEN_MIN_AREA, PERGOLA, ROAD_MAX_WIDTH, SOCCER_MIN_AREA, STADIUM_MIN_AREA, isFestungRunway } from '../../lib/rules.ts'
import { toBuildings } from './buildings.ts'
import { encodePoly, flat, inBox, polygons, proj, ringArea, wayPts } from './geometry.ts'
import type { NidMatcher } from './nid-match.ts'
import { addPoi } from './pois.ts'
import type { BakeState } from './state.ts'

const GREEN: Record<string, GreenKind> = {
  grass: 'grass',
  village_green: 'grass',
  meadow: 'grass',
  grassland: 'grass',
  recreation_ground: 'grass',
  park: 'park',
  garden: 'park',
  wood: 'wood',
  forest: 'wood',
  scrub: 'wood',
  cemetery: 'park',
  allotments: 'park',
  pitch: 'pitch',
  playground: 'play',
  stadium: 'pitch',
  farmland: 'farm',
  orchard: 'park',
  vineyard: 'park',
  plant_nursery: 'park',
  greenhouse_horticulture: 'farm',
  wetland: 'grass',
  heath: 'grass',
  brownfield: 'bare',
}

// Typowa szerokość drogi [m] wg klasy (gdy brak tagu width); 0 = nie rysujemy.
const ROAD_WIDTH: Record<string, number> = {
  motorway: 14,
  trunk: 14,
  primary: 12,
  secondary: 11,
  tertiary: 9,
  unclassified: 6,
  residential: 6,
  living_street: 5,
  service: 4,
  pedestrian: 6,
  footway: 2.2,
  path: 1.8,
  cycleway: 2.2,
  steps: 2,
  track: 3,
  primary_link: 7,
  secondary_link: 7,
  tertiary_link: 6,
  platform: 3,
  corridor: 0,
}
// Drogi, po których jeżdżą auta (ruch uliczny).
const CAR_ROADS = new Set([
  'primary',
  'secondary',
  'tertiary',
  'residential',
  'unclassified',
  'primary_link',
  'secondary_link',
  'tertiary_link',
])

const isBridge = (t: Tags) => (t.bridge && t.bridge !== 'no' ? (1 as const) : undefined)

export function collectFeatures(raw: OsmEl[], s: BakeState, nid: NidMatcher) {
  const { out } = s
  // drogi relacji-budynków: obrys rysuje relacja; samą drogę tylko wtedy, gdy ma własną wysokość
  const seenBuildingWays = new Set<number>()
  for (const el of raw) {
    const t: Tags = el.tags || {}
    if (el.type === 'relation' && t.building) for (const m of el.members || []) if (m.type === 'way') seenBuildingWays.add(m.ref)
  }

  for (const el of raw) {
    const t: Tags = el.tags || {}
    if (el.type !== 'node' && (t.building || t.shop === 'mall' || t.leisure === 'stadium' || t.amenity)) addPoi(s.pois, el, t)

    if (el.type === 'node' && t.natural === 'tree') {
      if (el.lat == null || el.lon == null) continue
      const p = proj(el.lat, el.lon)
      if (inBox(p)) out.trees.push(p[0], p[1])
      continue
    }

    if (t.building && t.building !== 'no' && !(el.type === 'way' && seenBuildingWays.has(el.id) && !t.height && !t['building:levels'])) {
      out.buildings.push(...toBuildings(el, t, t.building, nid, s.estimated))
      continue
    }

    // fontanny (obszary) rysujemy jak wodę; pergola to ażurowy daszek
    if (t.man_made === 'pergola' && el.type === 'way') {
      for (const p of polygons(el)) out.buildings.push({ ...encodePoly(p), H: PERGOLA.H, m: PERGOLA.m, k: 'roof', n: t.name || undefined })
      continue
    }
    if (t.natural === 'water' || t.waterway === 'riverbank' || (t.amenity === 'fountain' && el.type !== 'node')) {
      for (const p of polygons(el)) out.water.push({ ...encodePoly(p), n: t.name || undefined })
      continue
    }

    // stadiony: obrys do proceduralnych trybun (OSM rzadko ma trybuny jako budynki)
    if (t.leisure === 'stadium')
      for (const p of polygons(el))
        if (ringArea(p.outer) > STADIUM_MIN_AREA) out.stadiums.push({ ...encodePoly(p), n: t.name || undefined })
    if (t.leisure === 'pitch' && t.sport === 'soccer')
      for (const p of polygons(el)) if (ringArea(p.outer) > SOCCER_MIN_AREA) s.soccer.push(flat(p.outer))

    const g = GREEN[t.leisure] || GREEN[t.landuse] || GREEN[t.natural]
    if (g) {
      for (const p of polygons(el)) if (ringArea(p.outer) > GREEN_MIN_AREA) out.green.push({ ...encodePoly(p), k: g })
      continue
    }

    if (t.place === 'square' || (t.highway === 'pedestrian' && t.area === 'yes')) {
      for (const p of polygons(el)) out.plazas.push(encodePoly(p))
      if (t.place === 'square') continue
    }

    if (el.type === 'way' && el.geometry && (t.barrier === 'city_wall' || t.historic === 'citywalls')) {
      out.cityWalls.push(flat(wayPts(el.geometry)))
      continue
    }

    if (el.type === 'way' && el.geometry && t.highway && !(t.area === 'yes')) {
      const w = ROAD_WIDTH[t.highway]
      if (!w || t.tunnel === 'yes' || t.tunnel === 'building_passage' || t.indoor === 'yes') continue
      const pts = wayPts(el.geometry)
      if (!pts.some(inBox)) continue
      const width = num(t.width)
      const car = CAR_ROADS.has(t.highway)
      out.roads.push({
        p: flat(pts),
        w: width && t.highway !== 'footway' ? Math.min(width, ROAD_MAX_WIDTH) : w,
        k: t.highway,
        car: car && t.access !== 'no' ? (1 as const) : undefined,
        b: isBridge(t),
        n: t.name || undefined,
      })
      if (isFestungRunway(t, car)) (out.runway ??= []).push(flat(pts))
      continue
    }

    if (el.type === 'way' && el.geometry && t.railway) {
      if (t.tunnel === 'yes') continue
      const pts = flat(wayPts(el.geometry))
      const b = isBridge(t)
      if (t.railway === 'tram') out.trams.push({ p: pts, b })
      else if (!t.service || t.service === 'main') out.rails.push({ p: pts, b })
    }
  }
}
