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
const shapeIdx = new Map<string, number>()
const shapes: number[][] = []
for (const [id, list] of pts) {
  list.sort((a, b) => a[0] - b[0])
  shapeIdx.set(id, shapes.push(list.flatMap(([, x, y]) => [x, y])) - 1)
}

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
