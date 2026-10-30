// Dane do scenek (src/scenes): środek Odry, budki jarmarku na Rynku, latarnie gazowe na Ostrowie Tumskim.
// Pobiera z Overpass do data/raw/scenes.json (--force pobiera od nowa), zapisuje public/data/scenes.json w metrach lokalnych.
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { BBOX } from './config.ts'
import type { ScenesData } from '../src/scenes/types.ts'

type Pt = [number, number]
interface LatLon { lat: number; lon: number }
interface OsmEl { type: string; id: number; lat?: number; lon?: number; tags?: Record<string, string>; geometry?: LatLon[] }

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const [S, W, N, E] = BBOX
const meta = JSON.parse(await readFile('public/data/meta.json', 'utf8'))
const ORIGIN: [number, number] = meta.origin
const KX = Math.cos((ORIGIN[0] * Math.PI) / 180) * 111320
const KY = 110540
const r1 = (v: number) => Math.round(v * 10) / 10
const proj = (lat: number, lon: number): Pt => [r1((lon - ORIGIN[1]) * KX), r1((lat - ORIGIN[0]) * KY)]

// Rynek i jego płyta; Ostrów Tumski od Mostu Tumskiego po katedrę
const RYNEK = '51.1085,17.0290,51.1115,17.0350'
const TUMSKI = '51.1125,17.0400,51.1160,17.0480'
const query = `[out:json][timeout:120];
(
  way["waterway"="river"]["name"~"Odra"](${S},${W},${N},${E});
  way["place"="square"]["name"="Rynek"](${RYNEK});
  way["building"](${RYNEK});
  way["highway"]["name"~"^(Katedralna|Most Tumski|plac Katedralny)$"](${TUMSKI});
  node["highway"="street_lamp"](${TUMSKI});
);
out geom tags;`

async function fetchRaw(): Promise<OsmEl[]> {
  const file = 'data/raw/scenes.json'
  if (existsSync(file) && !process.argv.includes('--force')) return JSON.parse(await readFile(file, 'utf8')).elements
  for (let attempt = 0; attempt < 9; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]
    process.stdout.write(`pobieram scenki (${new URL(endpoint).host})… `)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': 'wroclaw-pixel-map/0.1', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      })
      const text = await res.text()
      if (res.ok && text.trimStart().startsWith('{')) {
        await mkdir('data/raw', { recursive: true })
        await writeFile(file, text)
        console.log('ok')
        return JSON.parse(text).elements
      }
      console.log(`HTTP ${res.status}`)
    } catch (err) {
      console.log(`błąd sieci: ${(err as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)))
  }
  throw new Error('scenki: nie udało się pobrać')
}

const els = await fetchRaw()
const pts = (el: OsmEl): Pt[] => (el.geometry ?? []).filter(Boolean).map((g) => proj(g.lat, g.lon))
const same = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5
const flat = (p: Pt[]) => p.flat()
const len = (p: Pt[]) => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0)

// Skleja odcinki w możliwie długie łańcuchy (końce stykające się w węzłach).
function chains(parts: Pt[][]): Pt[][] {
  const left = parts.map((p) => [...p])
  const out: Pt[][] = []
  while (left.length) {
    let c = left.pop()!
    for (let grew = true; grew;) {
      grew = false
      for (let i = 0; i < left.length; i++) {
        const p = left[i]
        if (same(c[c.length - 1], p[0])) c = [...c, ...p.slice(1)]
        else if (same(c[c.length - 1], p[p.length - 1])) c = [...c, ...[...p].reverse().slice(1)]
        else if (same(c[0], p[p.length - 1])) c = [...p, ...c.slice(1)]
        else if (same(c[0], p[0])) c = [...[...p].reverse(), ...c.slice(1)]
        else continue
        left.splice(i, 1)
        grew = true
        break
      }
    }
    out.push(c)
  }
  return out
}

// Upraszcza linię: zostawia punkty co najmniej `step` metrów od poprzedniego.
function thin(p: Pt[], step: number): Pt[] {
  const out = [p[0]]
  for (const q of p.slice(1, -1)) if (Math.hypot(q[0] - out[out.length - 1][0], q[1] - out[out.length - 1][1]) >= step) out.push(q)
  out.push(p[p.length - 1])
  return out
}

const [MINX, MINY] = proj(S, W), [MAXX, MAXY] = proj(N, E)
const inBounds = ([x, y]: Pt) => x > MINX && x < MAXX && y > MINY && y < MAXY

// ---------- Odra ----------
const rivers = chains(els.filter((e) => e.type === 'way' && e.tags?.waterway === 'river').map(pts))
  .map((c) => thin(c.filter(inBounds), 15))
  .filter((c) => c.length > 1 && len(c) > 600)
  .sort((a, b) => len(b) - len(a))

// ---------- Rynek ----------
const pointIn = (x: number, y: number, ring: Pt[]) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const distSeg = (x: number, y: number, ring: Pt[]) => {
  let best = Infinity
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1], [bx, by] = ring[i]
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y))
  }
  return best
}
const square = pts(els.find((e) => e.tags?.place === 'square')!)
const buildings = els.filter((e) => e.tags?.building).map(pts).filter((r) => r.length > 3)
// blok śródrynkowy (Ratusz, Sukiennice, Nowy Ratusz): budynki, których środek leży wewnątrz płyty
const block = buildings.filter((r) => {
  const cx = r.reduce((s, p) => s + p[0], 0) / r.length, cy = r.reduce((s, p) => s + p[1], 0) / r.length
  return pointIn(cx, cy, square)
})
const free = (x: number, y: number, margin: number) =>
  pointIn(x, y, square) && distSeg(x, y, square) > margin && buildings.every((b) => !pointIn(x, y, b) && distSeg(x, y, b) > margin)

// Budki stoją w dwóch obwodach: przy pierzejach (twarzą do środka) i wokół bloku Ratusza (twarzą na zewnątrz).
// Rynek jest obrócony względem osi: liczymy w układzie wyrównanym do jego dominującego kierunku pierzei.
const axis = (rings: Pt[][]) => {
  let c4 = 0, s4 = 0
  for (const r of rings) for (let i = 1; i < r.length; i++) {
    const dx = r[i][0] - r[i - 1][0], dy = r[i][1] - r[i - 1][1], a = Math.atan2(dy, dx) * 4, L = Math.hypot(dx, dy)
    c4 += Math.cos(a) * L
    s4 += Math.sin(a) * L
  }
  return Math.atan2(s4, c4) / 4
}
let rot = axis([square])
const toR = ([x, y]: Pt): Pt => [x * Math.cos(-rot) - y * Math.sin(-rot), x * Math.sin(-rot) + y * Math.cos(-rot)]
const fromR = (x: number, y: number): Pt => [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)]
const box = (ps: Pt[]) => {
  const r = ps.map(toR)
  return [Math.min(...r.map((p) => p[0])), Math.min(...r.map((p) => p[1])), Math.max(...r.map((p) => p[0])), Math.max(...r.map((p) => p[1]))]
}
const [qx0, qy0, qx1, qy1] = box(square)
// choinka: na wschód od Ratusza (przy pręgierzu), w połowie drogi do pierzei
let tree: Pt = [0, 0]
{
  const [bx0, by0, bx1, by1] = box(block.flat())
  for (let k = 0; k < 40; k++) {
    tree = fromR((bx1 + qx1) / 2, (by0 + by1) / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 3)
    if (free(tree[0], tree[1], 6)) break
  }
  tree = [r1(tree[0]), r1(tree[1])]
}
const stalls: [number, number, number][] = []
const place = ([x, y]: Pt, ang: number) => {
  if (!free(x, y, 3) || Math.hypot(tree[0] - x, tree[1] - y) < 10 || stalls.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 6)) return
  stalls.push([r1(x), r1(y), Math.round(ang * 100) / 100])
}
// prostokąt w układzie obróconym; budki co `step` m, frontem na zewnątrz (out) albo do środka
const ringAround = (x0: number, y0: number, x1: number, y1: number, step: number, out: boolean) => {
  const sides: [Pt, Pt, number][] = [
    [[x0, y0], [x1, y0], -Math.PI / 2], [[x1, y0], [x1, y1], 0], [[x1, y1], [x0, y1], Math.PI / 2], [[x0, y1], [x0, y0], Math.PI],
  ]
  for (const [a, b, ang] of sides) {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step))
    for (let i = 0; i <= n; i++) place(fromR(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n), (out ? ang : ang + Math.PI) + rot)
  }
}
// obwód przy pierzejach: 14 m od linii płyty
ringAround(qx0 + 14, qy0 + 14, qx1 - 14, qy1 - 14, 6.5, false)
// obwód wokół bloku (blok jest obrócony inaczej niż płyta): 7 m od budynków
if (block.length) {
  rot = axis(block)
  const [bx0, by0, bx1, by1] = box(block.flat())
  ringAround(bx0 - 7, by0 - 7, bx1 + 7, by1 + 7, 6.5, true)
}

// ---------- Ostrów Tumski ----------
// trasa latarnika: ul. Katedralna od Mostu Tumskiego do katedry
const streets = chains(els.filter((e) => e.type === 'way' && e.tags?.highway && /Katedralna|Most Tumski/.test(e.tags.name ?? '')).map(pts))
let route = streets.sort((a, b) => len(b) - len(a))[0] ?? []
if (route.length && route[0][0] > route[route.length - 1][0]) route = route.reverse() // z zachodu na wschód
const routeFlat = flat(thin(route, 4))
// latarnie z OSM wzdłuż trasy, posortowane w kolejności zapalania (wzdłuż ulicy)
const along = (x: number, y: number) => {
  let best = Infinity, s = 0, at = 0
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = route[i - 1], [bx, by] = route[i]
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (L * L)))
    const d = Math.hypot(ax + dx * t - x, ay + dy * t - y)
    if (d < best) { best = d; at = s + t * L }
    s += L
  }
  return { d: best, at }
}
let lamps = els
  .filter((e) => e.type === 'node' && e.tags?.highway === 'street_lamp')
  .map((e) => proj(e.lat!, e.lon!))
  .map((p) => ({ p, ...along(...p) }))
  .filter((l) => l.d < 14)
  .sort((a, b) => a.at - b.at)
  .map((l) => l.p)
// latarnie gazowe nie są oznaczone w OSM: gdy przy trasie brak latarni, stawiamy je co 12 m na przemian po obu stronach
if (lamps.length < 5 && route.length > 1) {
  lamps = []
  let k = 0
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = route[i - 1], [bx, by] = route[i]
    const L = Math.hypot(bx - ax, by - ay)
    for (let t = 6; t < L; t += 12, k++) {
      const side = k % 2 ? 4.5 : -4.5
      lamps.push([r1(ax + ((bx - ax) * t) / L - ((by - ay) / L) * side), r1(ay + ((by - ay) * t) / L + ((bx - ax) / L) * side)])
    }
  }
}

const out: ScenesData = {
  rivers: rivers.map(flat),
  rynek: { square: flat(square), stalls, tree },
  tumski: { route: routeFlat, lamps: lamps.flat() },
}
await writeFile('public/data/scenes.json', JSON.stringify(out))
console.log(`Odra: ${rivers.length} linii (${rivers.map((r) => Math.round(len(r))).join(', ')} m), budki: ${stalls.length}, latarnie: ${lamps.length}, trasa: ${Math.round(len(route))} m`)
