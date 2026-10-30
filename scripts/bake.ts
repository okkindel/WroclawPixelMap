// Zamienia surowe dane OSM (data/raw) na kompaktowy świat w metrach (public/data/world.json).
// Układ: x = wschód, y = północ, początek w ORIGIN. Współrzędne zaokrąglone do 0.1 m.
import { existsSync } from 'node:fs'
import jpeg from 'jpeg-js'
import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises'
import { BBOX, TILE } from './config.ts'
import { loadNid, type NidHit } from './nid.ts'
import { encodeTile } from '../src/world/tilecodec.ts'
import type { Aerialway, Building, BuildingKind, Dwarf, Flat, GreenKind, Named, Place, Poi, PoiKind, Poly, Structure, TileData, World, WorldMeta } from '../src/types/world.ts'

type Pt = [number, number]
interface LatLon { lat: number; lon: number }
interface OsmMember { type: string; ref: number; role: string; geometry?: (LatLon | null)[] }
interface OsmEl {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: LatLon
  tags?: Record<string, string>
  geometry?: (LatLon | null)[]
  members?: OsmMember[]
}
interface RawPoly { outer: Pt[]; holes: Pt[][] }

const [S, W, N, E] = BBOX
const ORIGIN: [number, number] = [(S + N) / 2, (W + E) / 2]
const KX = Math.cos((ORIGIN[0] * Math.PI) / 180) * 111320
const KY = 110540
const proj = (lat: number, lon: number): Pt => [r1((lon - ORIGIN[1]) * KX), r1((lat - ORIGIN[0]) * KY)]
const r1 = (v: number) => Math.round(v * 10) / 10
const [MINX, MINY] = proj(S, W)
const [MAXX, MAXY] = proj(N, E)

// Surowe dane są w kawałkach (world-R-C.json), które na brzegach się nakładają: usuwamy duplikaty.
const raw: OsmEl[] = []
const seen = new Set<string>()
for (const f of (await readdir('data/raw')).filter((f) => /^(world-[\w-]+|landcover)\.json$/.test(f)).sort()) {
  for (const el of JSON.parse(await readFile(`data/raw/${f}`, 'utf8')).elements as OsmEl[]) {
    const id = el.type + el.id
    if (!seen.has(id)) { seen.add(id); raw.push(el) }
  }
}
const rawDwarfs: OsmEl[] = JSON.parse(await readFile('data/raw/dwarfs.json', 'utf8')).elements
const rawPlaces: OsmEl[] = existsSync('data/raw/places.json') ? JSON.parse(await readFile('data/raw/places.json', 'utf8')).elements : []
const rawStructures: OsmEl[] = existsSync('data/raw/structures.json') ? JSON.parse(await readFile('data/raw/structures.json', 'utf8')).elements : []
// szkoły i uczelnie jako obszary/punkty (zwykle nie są budynkiem, więc nie ma ich w danych świata)
const rawSchools: OsmEl[] = existsSync('data/raw/schools.json') ? JSON.parse(await readFile('data/raw/schools.json', 'utf8')).elements : []
const rawParts: OsmEl[] = existsSync('data/raw/parts.json') ? JSON.parse(await readFile('data/raw/parts.json', 'utf8')).elements : []
const rawExtras: OsmEl[] = existsSync('data/raw/extras.json') ? JSON.parse(await readFile('data/raw/extras.json', 'utf8')).elements : []
// rejestr zabytków NID: rok budowy po adresie dla budynków bez start_date
// Adresy są głównie w osobnych punktach (import PRG), nie na obrysach: data/raw/addresses.json.
const nid = await loadNid()
const nidRows = new Set<number>()
let nidBuildings = 0, nidNear = 0
const rawAddresses: OsmEl[] = existsSync('data/raw/addresses.json') ? JSON.parse(await readFile('data/raw/addresses.json', 'utf8')).elements : []

// ---------- geometria ----------

const wayPts = (geom: (LatLon | null)[]): Pt[] => geom.filter((g): g is LatLon => !!g).map((g) => proj(g.lat, g.lon))
const same = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05

// Skleja odcinki (członków relacji) w zamknięte pierścienie.
function joinRings(lines: Pt[][]): Pt[][] {
  const rings: Pt[][] = []
  const pool = lines.filter((l) => l.length > 1).map((l) => l.slice())
  while (pool.length) {
    let ring = pool.shift()!
    let grew = true
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i]
        const end = ring[ring.length - 1]
        if (same(end, l[0])) ring = ring.concat(l.slice(1))
        else if (same(end, l[l.length - 1])) ring = ring.concat(l.slice(0, -1).reverse())
        else continue
        pool.splice(i, 1)
        grew = true
        break
      }
    }
    if (ring.length >= 4) rings.push(ring)
  }
  return rings
}

// Sutherland–Hodgman względem prostokąta bboxa.
function clipRing(ring: Pt[]): Pt[] | null {
  const edges = [
    (p: Pt) => p[0] >= MINX, (p: Pt) => p[0] <= MAXX, (p: Pt) => p[1] >= MINY, (p: Pt) => p[1] <= MAXY,
  ]
  const cut = [
    (a: Pt, b: Pt) => lerpAt(a, b, 0, MINX), (a: Pt, b: Pt) => lerpAt(a, b, 0, MAXX),
    (a: Pt, b: Pt) => lerpAt(a, b, 1, MINY), (a: Pt, b: Pt) => lerpAt(a, b, 1, MAXY),
  ]
  let out = ring
  for (let e = 0; e < 4 && out.length; e++) {
    const inp = out
    out = [] as Pt[]
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i]
      const prev = inp[(i + inp.length - 1) % inp.length]
      const ci = edges[e](cur), pi = edges[e](prev)
      if (ci) {
        if (!pi) out.push(cut[e](prev, cur))
        out.push(cur)
      } else if (pi) out.push(cut[e](prev, cur))
    }
  }
  return out.length >= 3 ? out : null
}
function lerpAt(a: Pt, b: Pt, axis: 0 | 1, v: number): Pt {
  const t = (v - a[axis]) / (b[axis] - a[axis])
  return [r1(a[0] + (b[0] - a[0]) * t), r1(a[1] + (b[1] - a[1]) * t)]
}

function openRing(r: Pt[]): Pt[] {
  return same(r[0], r[r.length - 1]) ? r.slice(0, -1) : r
}
const flat = (pts: Pt[]): Flat => pts.flat()

// Zwraca listę wielokątów [{outer, holes}] dla way/relation.
function polygons(el: OsmEl): RawPoly[] {
  if (el.type === 'way') {
    if (!el.geometry) return []
    const r = clipRing(openRing(wayPts(el.geometry)))
    return r ? [{ outer: r, holes: [] }] : []
  }
  const members = el.members || []
  const ring = (inner: boolean) => joinRings(members.filter((m) => m.type === 'way' && (m.role === 'inner') === inner && m.geometry).map((m) => wayPts(m.geometry!)))
  const outers = ring(false)
  const inners = ring(true)
  const polys: RawPoly[] = outers.map((o) => ({ outer: openRing(o), holes: [] }))
  for (const h of inners) {
    const ring = openRing(h)
    const owner = polys.find((p) => pointInRing(ring[0], p.outer))
    if (owner) owner.holes.push(ring)
  }
  return polys
    .map((p) => ({ outer: clipRing(p.outer), holes: p.holes.map(clipRing).filter((h): h is Pt[] => !!h) }))
    .filter((p): p is RawPoly => !!p.outer)
}

function pointInRing([x, y]: Pt, ring: Pt[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function ringArea(r: Pt[]) {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1])
  return Math.abs(a / 2)
}

const inBox = ([x, y]: Pt) => x >= MINX && x <= MAXX && y >= MINY && y <= MAXY

// ---------- tagi ----------

const num = (v: string | undefined): number | null => {
  if (v == null) return null
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const year = (v: string | undefined): number | null => {
  const m = v && String(v).match(/\d{4}/)
  return m ? +m[0] : null
}

// typy domów jednorodzinnych (bez wysokości w OSM: niskie, z dachem spadzistym)
const HOUSES = new Set(['house', 'detached', 'semidetached_house', 'bungalow', 'farm', 'villa', 'cabin'])

const BUILDING_KIND: Record<string, BuildingKind> = {
  church: 'church', cathedral: 'church', chapel: 'church', basilica: 'church',
  apartments: 'res', residential: 'res', house: 'res', detached: 'res', terrace: 'res', dormitory: 'res',
  commercial: 'com', retail: 'com', office: 'com', hotel: 'com', supermarket: 'com',
  university: 'pub', school: 'pub', public: 'pub', civic: 'pub', government: 'pub', hospital: 'pub',
  college: 'pub', train_station: 'pub', museum: 'pub', kindergarten: 'pub',
  industrial: 'ind', warehouse: 'ind', garage: 'low', garages: 'low', shed: 'low', roof: 'roof',
  kiosk: 'low', service: 'low', ruins: 'ruin',
}

const GREEN: Record<string, GreenKind> = {
  grass: 'grass', village_green: 'grass', meadow: 'grass', grassland: 'grass', recreation_ground: 'grass',
  park: 'park', garden: 'park', wood: 'wood', forest: 'wood', scrub: 'wood', cemetery: 'park',
  allotments: 'park', pitch: 'pitch', playground: 'play', stadium: 'pitch',
  farmland: 'farm', orchard: 'park', vineyard: 'park', plant_nursery: 'park', greenhouse_horticulture: 'farm',
  wetland: 'grass', heath: 'grass', brownfield: 'bare',
}

const ROAD_WIDTH: Record<string, number> = {
  motorway: 14, trunk: 14, primary: 12, secondary: 11, tertiary: 9, unclassified: 6, residential: 6,
  living_street: 5, service: 4, pedestrian: 6, footway: 2.2, path: 1.8, cycleway: 2.2, steps: 2,
  track: 3, primary_link: 7, secondary_link: 7, tertiary_link: 6, platform: 3, corridor: 0,
}
const CAR_ROADS = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'primary_link', 'secondary_link', 'tertiary_link'])

// ---------- przetwarzanie ----------

const out: World = {
  origin: ORIGIN, bounds: [MINX, MINY, MAXX, MAXY],
  buildings: [], water: [], green: [], plazas: [], roads: [], rails: [], trams: [], trees: [],
  cityWalls: [], named: [], dwarfs: [], runway: null, stadiums: [],
}
const seenBuildingWays = new Set<number>()

// Rozpoznawalne obiekty: nazwane budynki/obszary o znanej funkcji albo z wpisem w Wikidacie.
const pois: Poi[] = []
function poiKind(t: Record<string, string>): PoiKind | null {
  if (t.shop === 'mall') return 'mall'
  if (['theatre', 'cinema', 'arts_centre', 'library', 'concert_hall'].includes(t.amenity) || ['museum', 'gallery'].includes(t.tourism)) return 'culture'
  if (['university', 'college'].includes(t.amenity)) return 'edu'
  if (t.amenity === 'hospital') return 'health'
  if (['stadium', 'sports_centre', 'ice_rink', 'water_park'].includes(t.leisure)) return 'sport'
  if (t.amenity === 'place_of_worship') return 'church'
  if (['school', 'kindergarten'].includes(t.amenity)) return /Liceum/i.test(t.name ?? '') || t.wikipedia ? 'edu' : null
  if (t.wikipedia) return 'notable'
  return null
}
// ogólnikowe nazwy (sama funkcja budynku) nie są warte napisu
const GENERIC = /^(plebania|kaplica|kościół|cerkiew|dom|budynek|szkoła|przedszkole|garaże?|wieża|pawilon|hala|magazyn|portiernia|biuro|biblioteka|kino|teatr)$/i

function addPoi(el: OsmEl, t: Record<string, string>) {
  if (!t.name || GENERIC.test(t.name.trim()) || (!el.geometry && !el.members)) return
  const k = poiKind(t)
  if (!k) return
  const pts = el.type === 'way' ? wayPts(el.geometry!) : (el.members ?? []).filter((m) => m.role !== 'inner' && m.geometry).flatMap((m) => wayPts(m.geometry!))
  if (!pts.length) return
  const x = pts.reduce((s2, p) => s2 + p[0], 0) / pts.length, y = pts.reduce((s2, p) => s2 + p[1], 0) / pts.length
  if (!inBox([x, y])) return
  const famous = k === 'mall' || !!t.wikidata || !!t.wikipedia
  const wp = t.wikipedia?.match(/^(\w+):(.+)$/)
  const wiki = wp ? `https://${wp[1]}.wikipedia.org/wiki/${encodeURIComponent(wp[2].replace(/ /g, '_'))}` : t.wikidata ? `https://www.wikidata.org/wiki/${t.wikidata}` : undefined
  pois.push(wiki ? [t.name, r1(x), r1(y), k, famous ? 1 : 2, wiki] : [t.name, r1(x), r1(y), k, famous ? 1 : 2])
}
const encodePoly = (p: RawPoly): Poly => ({ o: flat(p.outer), h: p.holes.length ? p.holes.map(flat) : undefined })

for (const el of raw) {
  const t: Record<string, string> = el.tags || {}
  if (el.type === 'relation' && t.building) for (const m of el.members || []) if (m.type === 'way') seenBuildingWays.add(m.ref)
}

// Punkty adresowe w siatce 50 m: budynek dostaje adresy punktów leżących w jego obrysie.
const ADDR_CELL = 50
const addrGrid = new Map<string, { p: Pt; t: Record<string, string> }[]>()
for (const el of rawAddresses) {
  if (el.type !== 'node' || !el.tags) continue
  const p = proj(el.lat!, el.lon!), k = `${Math.floor(p[0] / ADDR_CELL)},${Math.floor(p[1] / ADDR_CELL)}`
  if (!addrGrid.has(k)) addrGrid.set(k, [])
  addrGrid.get(k)!.push({ p, t: el.tags })
}
// Rok z NID dla budynku: jego własny adres i punkty adresowe w obrysie; najstarszy wpis.
function nidYear(t: Record<string, string>, poly: RawPoly): NidHit | null {
  if (!nid) return null
  const addrs = [t]
  const xs = poly.outer.map((q) => q[0]), ys = poly.outer.map((q) => q[1])
  for (let cx = Math.floor(Math.min(...xs) / ADDR_CELL); cx <= Math.floor(Math.max(...xs) / ADDR_CELL); cx++)
    for (let cy = Math.floor(Math.min(...ys) / ADDR_CELL); cy <= Math.floor(Math.max(...ys) / ADDR_CELL); cy++)
      for (const a of addrGrid.get(`${cx},${cy}`) ?? [])
        if (pointInRing(a.p, poly.outer) && !poly.holes.some((h) => pointInRing(a.p, h))) addrs.push(a.t)
  let best: NidHit | null = null
  for (const a of addrs) {
    const hit = nid.lookup(a['addr:street'] ?? a['addr:place'], a['addr:housenumber'])
    if (hit) for (const r of hit.rows) nidRows.add(r)
    if (hit && (!best || hit.y < best.y)) best = hit
  }
  if (best) nidBuildings++
  return best
}

// Budynek albo część budynku (building:part) -> bryły. Dla części typ bierzemy z tagu building:part.
const estimated = new WeakSet<Building>()

function toBuildings(el: OsmEl, t: Record<string, string>, buildingTag: string): Building[] {
  const out: Building[] = []
  const levels = num(t['building:levels'])
  // kominy, zbiorniki i silosy bywają oznaczone jako building — nie mają okien
  const kind: BuildingKind =
    t.man_made === 'chimney' ? 'chimney'
    : ['storage_tank', 'silo', 'gasometer', 'water_tower'].includes(t.man_made) ? 'tank'
    : BUILDING_KIND[buildingTag] || (t.amenity === 'place_of_worship' ? 'church' : 'gen')
  let h = num(t.height)
  const DEFAULT_H: Partial<Record<BuildingKind, number>> = { low: 3.5, roof: 4, ruin: 4, church: 22, res: 15, com: 14, pub: 16, ind: 9 }
  const known = h != null || levels != null
  if (h == null && levels != null) h = levels * 3.2 + 1.5
  const minLevel = num(t['building:min_level'])
  let minH = num(t.min_height) ?? (minLevel != null ? minLevel * 3.2 : 0)
  if (kind === 'roof') minH = Math.max(minH, (h ?? 4) - 0.6)
  for (const p of polygons(el)) {
    const area = ringArea(p.outer)
    if (area < 6) continue
    // Bez wysokości i pięter w OSM: domy jednorodzinne i małe budynki są niskie i mają dach spadzisty,
    // średnie to ok. 3 kondygnacje; resztę bierzemy z typowej wysokości dla rodzaju budynku.
    const house = HOUSES.has(buildingTag) || (kind === 'gen' && area < 180)
    const hh = known ? h! : house ? 8 : kind === 'gen' && area < 400 ? 10 : DEFAULT_H[kind] ?? 12
    const roofShape = t['roof:shape'] && t['roof:shape'] !== 'flat' ? t['roof:shape'] : !known && house && !t['roof:shape'] ? 'gabled' : undefined
    // wąska, okrągła i bardzo wysoka bryła bez tagu man_made to też komin
    // (tylko samodzielne budynki bez kształtu dachu — wieże kościołów to części z hełmami)
    const round = !t['building:part'] && !t['roof:shape'] && p.outer.length >= 8 && area < 400 && hh > 40 && hh / Math.sqrt(area) > 3
    const k: BuildingKind = round && (kind === 'gen' || kind === 'ind') ? 'chimney' : kind
    const nidHit = t.start_date ? null : nidYear(t, p)
    const b: Building = {
      ...encodePoly(p),
      H: r1(Math.min(hh, 220)),
      m: minH ? r1(minH) : undefined,
      k,
      // budowa w toku (building=construction) istnieje dopiero „dziś”
      y: year(t.start_date) ?? nidHit?.y ?? (buildingTag === 'construction' ? new Date().getFullYear() : undefined),
      rs: roofShape,
      rh: num(t['roof:height']) ?? undefined,
      rc: t['roof:colour'] || undefined,
      c: t['building:colour'] || undefined,
      bm: t['building:material'] || undefined,
      rm: t['roof:material'] || undefined,
      n: t.name || undefined,
    }
    // wysokość tylko szacowana (brak height, kształtu dachu, nie kościół, nie część budynku): do zastąpienia pomiarem GUGiK
    if (t.height == null && !t['roof:shape'] && k !== 'church' && !t['building:part']) estimated.add(b)
    out.push(b)
  }
  return out
}

for (const el of raw) {
  const t: Record<string, string> = el.tags || {}
  if (el.type !== 'node' && (t.building || t.shop === 'mall' || t.leisure === 'stadium' || t.amenity)) addPoi(el, t)

  if (el.type === 'node' && t.natural === 'tree') {
    const p = proj(el.lat!, el.lon!)
    if (inBox(p)) out.trees.push(p[0], p[1])
    continue
  }

  if (t.building && t.building !== 'no' && !(el.type === 'way' && seenBuildingWays.has(el.id) && !t.height && !t['building:levels'])) {
    out.buildings.push(...toBuildings(el, t, t.building))
    continue
  }

  // fontanny (obszary) rysujemy jak wodę; pergola to ażurowy daszek na wysokości ok. 4 m
  if (t.man_made === 'pergola' && el.type === 'way') {
    for (const p of polygons(el)) out.buildings.push({ ...encodePoly(p), H: 4.2, m: 3.6, k: 'roof', n: t.name || undefined })
    continue
  }
  if (t.natural === 'water' || t.waterway === 'riverbank' || (t.amenity === 'fountain' && el.type !== 'node')) {
    for (const p of polygons(el)) out.water.push({ ...encodePoly(p), n: t.name || undefined })
    continue
  }

  // stadiony: obrys do proceduralnych trybun (OSM rzadko ma trybuny jako budynki)
  if (t.leisure === 'stadium') for (const p of polygons(el)) if (ringArea(p.outer) > 3000) out.stadiums.push({ ...encodePoly(p), n: t.name || undefined })

  const g = GREEN[t.leisure!] || GREEN[t.landuse!] || GREEN[t.natural!]
  if (g) {
    for (const p of polygons(el)) if (ringArea(p.outer) > 20) out.green.push({ ...encodePoly(p), k: g })
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
    out.roads.push({
      p: flat(pts),
      w: num(t.width) && t.highway !== 'footway' ? Math.min(num(t.width)!, 30) : w,
      k: t.highway,
      car: CAR_ROADS.has(t.highway) && t.access !== 'no' ? 1 as const : undefined,
      b: t.bridge && t.bridge !== 'no' ? 1 as const : undefined,
      n: t.name || undefined,
    })
    if (t.name === 'plac Grunwaldzki' && CAR_ROADS.has(t.highway)) (out.runway ??= []).push(flat(pts))
    continue
  }

  if (el.type === 'way' && el.geometry && t.railway) {
    if (t.tunnel === 'yes') continue
    const pts = flat(wayPts(el.geometry))
    const b = t.bridge && t.bridge !== 'no' ? (1 as const) : undefined
    if (t.railway === 'tram') out.trams.push({ p: pts, b })
    else if (!t.service || t.service === 'main') out.rails.push({ p: pts, b })
  }
}

// Części budynków: rysujemy je zamiast obrysu budynku, w którym leżą (np. Hala Stulecia, wieże kościołów).
// Część dziedziczy po budynku nazwę, rok i typ (żeby kościół miał ceglane ściany, a klik pokazywał nazwę).
{
  const CELL = 200
  const grid = new Map<string, number[]>()
  const bbox = (o: Flat) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
    for (let i = 0; i < o.length; i += 2) { a = Math.min(a, o[i]); c = Math.max(c, o[i]); b = Math.min(b, o[i + 1]); d = Math.max(d, o[i + 1]) }
    return [a, b, c, d]
  }
  out.buildings.forEach((b, i) => {
    const [a, bb, c, d] = bbox(b.o)
    for (let x = Math.floor(a / CELL); x <= Math.floor(c / CELL); x++)
      for (let y = Math.floor(bb / CELL); y <= Math.floor(d / CELL); y++) {
        const k = `${x},${y}`
        const l = grid.get(k) ?? []
        l.push(i)
        grid.set(k, l)
      }
  })
  const flatRing = (o: Flat): Pt[] => { const r: Pt[] = []; for (let i = 0; i < o.length; i += 2) r.push([o[i], o[i + 1]]); return r }
  const owner = (x: number, y: number) =>
    (grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) ?? []).find((i) => pointInRing([x, y], flatRing(out.buildings[i].o)))
  // Punkt adresowy z wpisem NID poza obrysami (np. przy wejściu, na chodniku): rok dostaje najbliższy budynek do 15 m.
  if (nid) {
    const R = 15
    const segDist = ([x, y]: Pt, o: Flat) => {
      let best = Infinity
      for (let i = 0; i < o.length; i += 2) {
        const ax = o[i], ay = o[i + 1], bx = o[(i + 2) % o.length], by = o[(i + 3) % o.length]
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
        const u = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0
        best = Math.min(best, Math.hypot(x - ax - u * dx, y - ay - u * dy))
      }
      return best
    }
    for (const cell of addrGrid.values()) for (const a of cell) {
      const hit = nid.lookup(a.t['addr:street'] ?? a.t['addr:place'], a.t['addr:housenumber'])
      if (!hit || owner(...a.p) != null) continue
      let bi = -1, bd = R
      for (let x = Math.floor((a.p[0] - R) / CELL); x <= Math.floor((a.p[0] + R) / CELL); x++)
        for (let y = Math.floor((a.p[1] - R) / CELL); y <= Math.floor((a.p[1] + R) / CELL); y++)
          for (const i of grid.get(`${x},${y}`) ?? []) {
            const b = out.buildings[i]
            if (b.k === 'low' || b.k === 'roof') continue
            const d = segDist(a.p, b.o)
            if (d < bd) { bd = d; bi = i }
          }
      const b = out.buildings[bi]
      if (!b) continue
      for (const r of hit.rows) nidRows.add(r)
      // tylko budynki bez roku (nie nadpisujemy start_date z OSM)
      if (b.y != null) continue
      nidBuildings++
      nidNear++
      b.y = hit.y
    }
  }
  // powierzchnia części w każdym budynku: obrys znika tylko, gdy części pokrywają większość budynku
  // (często zmapowane są tylko pojedyncze elementy, np. arkady albo wieża)
  const covered = new Map<number, number>()
  const added: Building[] = []
  for (const el of rawParts) {
    const t: Record<string, string> = el.tags || {}
    if (t['building:part'] === 'no' || t.building) continue
    for (const part of toBuildings(el, t, t['building:part'])) {
      let sx = 0, sy = 0
      for (let i = 0; i < part.o.length; i += 2) { sx += part.o[i]; sy += part.o[i + 1] }
      const n = part.o.length / 2
      const i = owner(sx / n, sy / n)
      if (i != null) {
        const parent = out.buildings[i]
        covered.set(i, (covered.get(i) ?? 0) + ringArea(flatRing(part.o)))
        part.n ??= parent.n
        part.y ??= parent.y
        // część kościoła jest kościołem (ceglane ściany, bez okien bloków); inne dziedziczą tylko rodzaj ogólny
        if (part.k === 'gen' || parent.k === 'church') part.k = parent.k
      }
      added.push(part)
    }
  }
  const replaced = new Set([...covered].filter(([i, a]) => a >= 0.7 * ringArea(flatRing(out.buildings[i].o)) || out.buildings[i].H < 1).map(([i]) => i))
  // obrys, który zostaje obok części: lekko niżej, żeby dachy na tej samej wysokości nie migotały (z-fighting)
  for (const i of covered.keys()) {
    if (replaced.has(i)) continue
    const b = out.buildings[i]
    b.H = r1(Math.max(b.H - 0.4, (b.m ?? 0) + 0.5))
    // wspólne ściany obrysu i części migotałyby (z-fighting): obrys zwężamy o 15 cm do środka
    b.o = shrink(b.o, 0.15)
  }
  out.buildings = out.buildings.filter((_, i) => !replaced.has(i)).concat(added)
  console.log(`części budynków: ${added.length}, zastąpione obrysy: ${replaced.size}`)
}

// ---------- wysokości z modeli 3D GUGiK (LoD1 2024, CC BY 4.0; npm run lod2) ----------
// measuredHeight = mediana skaningu laserowego nad terenem. Zastępuje tylko wysokości szacowane z OSM
// (piętra / wartości domyślne); kościoły, części budynków i jawne `height` zostają.
if (existsSync('data/lod2/buildings.json')) {
  const lod: { c: [number, number]; mh?: number; H: number }[] = JSON.parse(await readFile('data/lod2/buildings.json', 'utf8'))
  const CELL = 50
  const grid = new Map<string, number[]>()
  out.buildings.forEach((b, i) => {
    if (!estimated.has(b)) return
    let a = Infinity, c = -Infinity, d = Infinity, e = -Infinity
    for (let q = 0; q < b.o.length; q += 2) { a = Math.min(a, b.o[q]); c = Math.max(c, b.o[q]); d = Math.min(d, b.o[q + 1]); e = Math.max(e, b.o[q + 1]) }
    for (let x = Math.floor(a / CELL); x <= Math.floor(c / CELL); x++)
      for (let y = Math.floor(d / CELL); y <= Math.floor(e / CELL); y++) {
        const k = `${x},${y}`
        const l = grid.get(k) ?? []
        l.push(i)
        grid.set(k, l)
      }
  })
  const best = new Map<number, number>()
  for (const l of lod) {
    const h = l.mh ?? l.H
    if (!(h > 1.5)) continue
    const [x, y] = l.c
    for (const i of grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) ?? []) {
      const o = out.buildings[i].o
      const ring: Pt[] = []
      for (let q = 0; q < o.length; q += 2) ring.push([o[q], o[q + 1]])
      if (pointInRing([x, y], ring)) { best.set(i, Math.max(best.get(i) ?? 0, h)); break }
    }
  }
  for (const [i, h] of best) {
    const b = out.buildings[i]
    // przy dachu spadzistym mediana wypada w połowie dachu — kalenica jest wyżej
    b.H = r1(Math.max((b.m ?? 0) + 2, b.rs ? h * 1.15 : h))
  }
  console.log(`wysokości z LoD1 GUGiK: ${best.size} budynków`)
}

// Nazwane miejsca do wyszukiwarki: ulice (środek) i nazwane budynki.
const named = new Map<string, Named>()
for (const r of out.roads) {
  if (!r.n || named.has(r.n)) continue
  const i = Math.floor(r.p.length / 4) * 2
  named.set(r.n, [r.n, r.p[i], r.p[i + 1], 'ulica'])
}
for (const b of out.buildings) {
  if (!b.n || named.has(b.n)) continue
  let sx = 0, sy = 0
  for (let i = 0; i < b.o.length; i += 2) { sx += b.o[i]; sy += b.o[i + 1] }
  const n = b.o.length / 2
  named.set(b.n, [b.n, r1(sx / n), r1(sy / n), 'budynek'])
}
out.named = [...named.values()]

for (const el of rawDwarfs) {
  const t: Record<string, string> = el.tags || {}
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon
  if (lat == null || lon == null) continue
  const [x, y] = proj(lat, lon)
  const d: Dwarf = {
    id: el.id, x, y, n: t.name || t.alt_name || 'Krasnal bez imienia',
    a: t.artist_name || undefined, d: t.start_date || undefined,
    img: t.image || undefined, i: t.inscription || undefined, in: inBox([x, y]) ? 1 : undefined,
  }
  out.dwarfs.push(d)
}

// Najdłuższy zamknięty tor żużlowy (na Olimpijskim jest jeden).
function speedway(): Flat | null {
  const rings = [...rawExtras, ...raw]
    .filter((e) => e.type === 'way' && e.geometry && e.tags?.sport?.includes('speedway'))
    .map((e) => wayPts(e.geometry!))
    .filter((p) => p.length > 8 && same(p[0], p[p.length - 1]))
    .sort((a, b) => ringArea(b) - ringArea(a))
  return rings.length ? flat(openRing(rings[0])) : null
}

// Odsunięcie wierzchołków pierścienia o d do środka (wzdłuż dwusiecznej; wystarczające dla małych d).
function shrink(o: Flat, d: number): Flat {
  const n = o.length / 2
  const ring: Pt[] = []
  for (let i = 0; i < n; i++) ring.push([o[i * 2], o[i * 2 + 1]])
  const sign = (() => { let a = 0; for (let i = 0, j = n - 1; i < n; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]); return a < 0 ? 1 : -1 })()
  const out: Flat = []
  for (let i = 0; i < n; i++) {
    const [px, py] = ring[(i + n - 1) % n], [x, y] = ring[i], [qx, qy] = ring[(i + 1) % n]
    const l1 = Math.hypot(x - px, y - py) || 1, l2 = Math.hypot(qx - x, qy - y) || 1
    const nx = (-(y - py) / l1 - (qy - y) / l2) * sign, ny = ((x - px) / l1 + (qx - x) / l2) * sign
    const L = Math.hypot(nx, ny) || 1
    out.push(r1(x + (nx / L) * d * 1.0) , r1(y + (ny / L) * d))
  }
  return out
}

// ---------- konstrukcje i koleje linowe ----------
function structures() {
  const list: Structure[] = []
  const pylons: [number, number, number][] = []
  const lines: Aerialway[] = []
  for (const el of rawStructures) {
    const t = el.tags || {}
    if (t.building) continue // takie są już budynkami
    const pts = el.type === 'way' && el.geometry ? wayPts(el.geometry) : el.lat != null ? [proj(el.lat, el.lon!)] : []
    if (!pts.length) continue
    const cx = pts.reduce((s2, p) => s2 + p[0], 0) / pts.length, cy = pts.reduce((s2, p) => s2 + p[1], 0) / pts.length
    const H = num(t.height)
    if (t.aerialway === 'pylon') { pylons.push([r1(cx), r1(cy), H ?? 35]); continue }
    if (t.aerialway && el.type === 'way') { lines.push({ p: flat(pts), pylons: [], n: t.name, yr: year(t.start_date) ?? undefined }); continue }
    const m = t.man_made
    if (!m || m === 'flagpole') continue
    // promień z obrysu (dla linii) albo typowy
    const r = el.type === 'way' ? Math.max(1.5, Math.sqrt(ringArea(openRing(pts)) / Math.PI)) : m === 'water_tower' ? 7 : 2
    const h = H ?? ({ water_tower: 30, mast: 40, communications_tower: 60, tower: 25, obelisk: 12, lighthouse: 20 } as Record<string, number>)[m] ?? 20
    const k: Structure['k'] = t['tower:type'] === 'lighting' || t['tower:type'] === 'floodlight' ? 'light' : m === 'water_tower' ? 'water' : m === 'mast' || m === 'communications_tower' ? 'mast' : h / r > 12 ? 'needle' : 'tower'
    if (inBox([cx, cy])) list.push({ x: r1(cx), y: r1(cy), H: r1(h), r: r1(r), k, n: t.name, yr: year(t.start_date) ?? undefined })
  }
  // słupy przypisujemy do najbliższej kolei linowej
  for (const p of pylons) {
    let best: Aerialway | undefined, bd = 60
    for (const l of lines) {
      for (let i = 0; i < l.p.length; i += 2) {
        const d = Math.hypot(l.p[i] - p[0], l.p[i + 1] - p[1])
        if (d < bd) { bd = d; best = l }
      }
    }
    best?.pylons.push(p)
  }
  // jupitery świecą w stronę najbliższego stadionu albo boiska (środek obrysu)
  for (const s of list) {
    if (s.k !== 'light') continue
    let best: [number, number] | null = null, bd = 400
    for (const st of out.stadiums.length ? out.stadiums : []) {
      let cx = 0, cy = 0
      for (let i = 0; i < st.o.length; i += 2) { cx += st.o[i]; cy += st.o[i + 1] }
      cx /= st.o.length / 2; cy /= st.o.length / 2
      const d = Math.hypot(cx - s.x, cy - s.y)
      if (d < bd) { bd = d; best = [cx, cy] }
    }
    if (best) s.az = Math.atan2(best[1] - s.y, best[0] - s.x)
  }
  return { list, lines }
}
const built = structures()

// ---------- podział na kafle ----------
// Każdy obiekt trafia do kafla swojego pierwszego punktu (duże wielokąty, np. Odra, są w jednym kaflu).
const tiles = new Map<string, TileData>()
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

// ---------- kolory dachów z ortofotomapy (data/ortho, npm run fetch-ortho) ----------
// Bierzemy piksele wewnątrz obrysu i uśredniamy środkową połowę według jasności
// (odrzuca cienie, kominy, świetliki i blaski).
let sampled = 0
for (const [k, t] of tiles) {
  const file = `data/ortho/${k}.jpg`
  if (!existsSync(file)) continue
  const img = jpeg.decode(await readFile(file), { useTArray: true })
  const [i, j] = k.split('_').map(Number)
  const tx0 = MINX + i * TILE, ty1 = MINY + (j + 1) * TILE
  const sx = img.width / TILE, sy = img.height / TILE
  for (const b of t.buildings) {
    if (b.rc) continue
    const ring: Pt[] = []
    let a = Infinity, c = -Infinity, d = Infinity, e = -Infinity
    for (let q = 0; q < b.o.length; q += 2) {
      const px = (b.o[q] - tx0) * sx, py = (ty1 - b.o[q + 1]) * sy
      ring.push([px, py])
      a = Math.min(a, px); c = Math.max(c, px); d = Math.min(d, py); e = Math.max(e, py)
    }
    const step = Math.max(1, Math.floor(Math.sqrt(((c - a) * (e - d)) / 400)))
    const px: [number, number, number, number][] = []
    let total = 0
    for (let y = Math.max(0, Math.floor(d)); y < Math.min(img.height, e); y += step)
      for (let x = Math.max(0, Math.floor(a)); x < Math.min(img.width, c); x += step) {
        if (!pointInRing([x + 0.5, y + 0.5], ring)) continue
        const o = (y * img.width + x) * 4
        total++
        const r = img.data[o], g = img.data[o + 1], bl = img.data[o + 2]
        // pomijamy korony drzew zasłaniające dach (zieleń wyraźnie dominuje)
        if (g > r + 8 && g > bl + 4) continue
        px.push([r, g, bl, r * 0.3 + g * 0.59 + bl * 0.11])
      }
    // większość obrysu pod koronami drzew: zdjęcie nie pokazuje dachu
    if (px.length < 4 || px.length < total * 0.4) continue
    px.sort((u, v) => u[3] - v[3])
    const mid = px.slice(Math.floor(px.length / 4), Math.ceil((px.length * 3) / 4))
    let avg = [0, 1, 2].map((ch) => Math.round(mid.reduce((s2, p) => s2 + p[ch], 0) / mid.length))
    // prawie szary (papa, blacha, beton) = neutralna szarość: lekki odcień zdjęcia (mech, korekta barwna)
    // paleta zamieniałaby na zieleń/morski; nasycone kolory (dachówka, miedź) zostają
    // zielonkawy wynik to resztki drzew albo cień; miedzianą patynę dopuszczamy tylko na kościołach
    if (avg[1] > avg[0] && avg[1] >= avg[2] && b.k !== 'church') continue
    if (Math.max(...avg) - Math.min(...avg) < 28) {
      const l = Math.round(avg[0] * 0.3 + avg[1] * 0.59 + avg[2] * 0.11)
      avg = [l + 3, l, l - 3]
    }
    b.oc = '#' + avg.map((v) => v.toString(16).padStart(2, '0')).join('')
    sampled++
  }
}
console.log(`dachy z ortofotomapy: ${sampled}`)
if (nid) console.log(`NID: wierszy z Wrocławia ${nid.rows}, z rokiem ${nid.parsed}, dopasowanych do budynków ${nidRows.size}; budynków z rokiem z NID ${nidBuildings} (w tym ${nidNear} najbliższych punktowi adresowemu), z rokiem ogółem ${out.buildings.filter((b) => b.y != null).length}/${out.buildings.length}`)

// Czyścimy tylko stare kafle i pliki w innym formacie (usunięcie całego katalogu myli serwer deweloperski Vite).
await mkdir('public/data/tiles', { recursive: true })
for (const f of await readdir('public/data/tiles')) if (!f.endsWith('.bin') || !tiles.has(f.replace('.bin', ''))) await rm(`public/data/tiles/${f}`)
// kafle binarne (src/world/tilecodec.ts), współrzędne względem rogu kafla
let bytes = 0
for (const [k, t] of tiles) {
  const [i, j] = k.split('_').map(Number)
  const bin = encodeTile(t, MINX + i * TILE, MINY + j * TILE)
  bytes += bin.length
  await writeFile(`public/data/tiles/${k}.bin`, bin)
}
// szkoły-punkty: addPoi potrzebuje geometrii, więc punkt zamieniamy na jednopunktową linię
for (const el of rawSchools) {
  const t = el.tags || {}
  if (el.type === 'node' && el.lat != null) addPoi({ ...el, type: 'way', geometry: [{ lat: el.lat, lon: el.lon! }] }, t)
  else addPoi(el, t)
}

const meta: WorldMeta = {
  origin: out.origin, bounds: out.bounds, tile: TILE,
  tiles: [...tiles.entries()].map(([k, t]) => ({ k, n: t.buildings.length })),
  cityWalls: out.cityWalls, named: out.named, dwarfs: out.dwarfs, runway: out.runway,
  speedway: speedway(), stadiums: out.stadiums,
  structures: built.list, aerialways: built.lines,
  // jedna nazwa = jeden napis (budynek bywa zmapowany kilka razy, np. obszar i bryła)
  pois: [...new Map(pois.map((p) => [p[0], p])).values()],
  places: rawPlaces
    .filter((e) => e.lat != null && e.tags?.name)
    .map((e): Place => [e.tags!.name, ...proj(e.lat!, e.lon!), ({ suburb: 0, quarter: 1 } as Record<string, 0 | 1>)[e.tags!.place] ?? 2]),
}
const metaJson = JSON.stringify(meta)
await writeFile('public/data/meta.json', metaJson)
console.log(
  `${tiles.size} kafli, ${(bytes / 1e6).toFixed(1)} MB + meta ${(metaJson.length / 1e6).toFixed(1)} MB:`,
  Object.entries(out).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k}=${v.length}`).join(' '),
)
