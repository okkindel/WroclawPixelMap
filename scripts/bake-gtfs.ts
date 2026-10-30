// Rozkład tramwajów MPK Wrocław (GTFS) → public/data/trams.json: trasy (kształty w metrach) i kursy.
// GTFS: portal miasta blokuje automaty, więc bierzemy mirror MobilityData (źródło: Otwarte Dane Wrocław).
// Uruchom `npm run fetch-gtfs` (pobiera i rozpakowuje do data/gtfs), potem `npm run bake-gtfs`.
import { createReadStream, existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import type { TramSchedule } from '../src/types/world.ts'
import type { WorldMeta } from '../src/types/world.ts'

const DIR = 'data/gtfs'
if (!existsSync(`${DIR}/trips.txt`)) throw new Error('brak data/gtfs — uruchom najpierw npm run fetch-gtfs')

const meta: WorldMeta = JSON.parse(await readFile('public/data/meta.json', 'utf8'))
const [lat0, lon0] = meta.origin
const KX = Math.cos((lat0 * Math.PI) / 180) * 111320
const KY = 110540
const r1 = (v: number) => Math.round(v * 10) / 10

// CSV z polami w cudzysłowach (nazwy tras zawierają przecinki).
function parseLine(line: string) {
  const out: string[] = []
  let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

async function* rows(file: string) {
  let head: string[] | null = null
  for await (const raw of createInterface({ input: createReadStream(`${DIR}/${file}`) })) {
    const line = raw.replace(/^﻿/, '')
    if (!line) continue
    const f = parseLine(line)
    if (!head) { head = f; continue }
    yield Object.fromEntries(head.map((h, i) => [h, f[i]])) as Record<string, string>
  }
}

const sec = (t: string) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s }

// trasy tramwajowe (route_type 0)
const routes = new Map<string, number>()
const names: string[] = []
for await (const r of rows('routes.txt')) if (r.route_type === '0') routes.set(r.route_id, names.push(r.route_short_name) - 1)

// dni kursowania: maska bitowa pn=1 … nd=64
const days = new Map<string, number>()
for await (const c of rows('calendar.txt')) {
  days.set(c.service_id, ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].reduce((m, d, i) => m | (c[d] === '1' ? 1 << i : 0), 0))
}

interface Trip { route: number; shape: string; mask: number; head: string; dep: number; arr: number }
const trips = new Map<string, Trip>()
for await (const t of rows('trips.txt')) {
  const route = routes.get(t.route_id)
  if (route == null) continue
  trips.set(t.trip_id, { route, shape: t.shape_id, mask: days.get(t.service_id) ?? 0, head: t.trip_headsign, dep: Infinity, arr: -Infinity })
}

for await (const s of rows('stop_times.txt')) {
  const t = trips.get(s.trip_id)
  if (!t) continue
  t.dep = Math.min(t.dep, sec(s.departure_time))
  t.arr = Math.max(t.arr, sec(s.arrival_time))
}

// kształty tylko tych tras, po których jeżdżą tramwaje
const needed = new Set([...trips.values()].map((t) => t.shape))
const pts = new Map<string, [number, number, number][]>()
for await (const s of rows('shapes.txt')) {
  if (!needed.has(s.shape_id)) continue
  const list = pts.get(s.shape_id) ?? []
  list.push([+s.shape_pt_sequence, r1((+s.shape_pt_lon - lon0) * KX), r1((+s.shape_pt_lat - lat0) * KY)])
  pts.set(s.shape_id, list)
}
// Tory tramwajowe z OSM (kafle) w siatce 50 m: trasy z GTFS są uproszczone, więc przyciągamy je do torów.
interface Seg { ax: number; ay: number; bx: number; by: number; z: number }
const CELL = 50
const grid = new Map<string, Seg[]>()
for (const t of meta.tiles) {
  const tile = JSON.parse(await readFile(`public/data/tiles/${t.k}.json`, 'utf8'))
  for (const tr of tile.trams as { p: number[]; b?: 1 }[]) {
    for (let i = 0; i + 3 < tr.p.length; i += 2) {
      const sg: Seg = { ax: tr.p[i], ay: tr.p[i + 1], bx: tr.p[i + 2], by: tr.p[i + 3], z: tr.b ? 1.2 : 0.2 }
      const x0 = Math.floor(Math.min(sg.ax, sg.bx) / CELL), x1 = Math.floor(Math.max(sg.ax, sg.bx) / CELL)
      const y0 = Math.floor(Math.min(sg.ay, sg.by) / CELL), y1 = Math.floor(Math.max(sg.ay, sg.by) / CELL)
      for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
        const k = `${gx},${gy}`
        const l = grid.get(k) ?? []
        l.push(sg)
        grid.set(k, l)
      }
    }
  }
}
// najbliższy punkt na torze w promieniu 30 m: [x, y, wysokość] albo null
function snap(x: number, y: number): [number, number, number] | null {
  let best: [number, number, number] | null = null, bd = 30
  const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL)
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    for (const sg of grid.get(`${gx + i},${gy + j}`) ?? []) {
      const dx = sg.bx - sg.ax, dy = sg.by - sg.ay
      const f = Math.max(0, Math.min(1, ((x - sg.ax) * dx + (y - sg.ay) * dy) / (dx * dx + dy * dy || 1)))
      const px = sg.ax + dx * f, py = sg.ay + dy * f
      const d = Math.hypot(px - x, py - y)
      if (d < bd) { bd = d; best = [px, py, sg.z] }
    }
  }
  return best
}

// trasa: zagęszczona co 4 m i przyciągnięta do torów; zapis [x, y, z, x, y, z, ...]
const shapeIdx = new Map<string, number>()
const shapes: number[][] = []
let snapped = 0, total = 0
for (const [id, list] of pts) {
  list.sort((a, b) => a[0] - b[0])
  const out: number[] = []
  for (let i = 0; i < list.length; i++) {
    const [, x1, y1] = list[i]
    const [, x0, y0] = list[Math.max(0, i - 1)]
    const n = i === 0 ? 1 : Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4))
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n
      const s2 = snap(x, y)
      total++
      if (s2) snapped++
      const [sx, sy, sz] = s2 ?? [x, y, 0.2]
      out.push(r1(sx), r1(sy), sz)
    }
  }
  shapeIdx.set(id, shapes.push(simplify(out, 0.5)) - 1)
}

// Douglas–Peucker na punktach [x, y, z]: zostawia tylko miejsca, gdzie tor skręca albo zmienia wysokość.
function simplify(p: number[], tol: number): number[] {
  const n = p.length / 3
  if (n < 3) return p
  const keep = new Uint8Array(n)
  keep[0] = keep[n - 1] = 1
  const stack: [number, number][] = [[0, n - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const ax = p[a * 3], ay = p[a * 3 + 1], bx = p[b * 3], by = p[b * 3 + 1]
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1
    let far = -1, fd = tol
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((p[i * 3] - ax) * dy - (p[i * 3 + 1] - ay) * dx) / L
      const dz = p[i * 3 + 2] !== p[a * 3 + 2] || p[i * 3 + 2] !== p[b * 3 + 2] ? tol * 2 : 0
      if (Math.max(d, dz) > fd) { fd = Math.max(d, dz); far = i }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]) }
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2])
  return out
}
console.log(`przyciągnięte do torów: ${((snapped / total) * 100).toFixed(1)}% punktów`)

const heads: string[] = []
const headIdx = new Map<string, number>()
const out: TramSchedule = { lines: names, heads, shapes, trips: [] }
for (const t of trips.values()) {
  const sh = shapeIdx.get(t.shape)
  if (sh == null || !Number.isFinite(t.dep) || t.arr <= t.dep) continue
  let h = headIdx.get(t.head)
  if (h == null) headIdx.set(t.head, (h = heads.push(t.head) - 1))
  out.trips.push([t.route, sh, h, t.mask, t.dep, t.arr - t.dep])
}
out.trips.sort((a, b) => a[4] - b[4])

const json = JSON.stringify(out)
await writeFile('public/data/trams.json', json)
console.log(`tramwaje: ${names.length} linii, ${shapes.length} tras, ${out.trips.length} kursów, ${(json.length / 1e6).toFixed(1)} MB`)
