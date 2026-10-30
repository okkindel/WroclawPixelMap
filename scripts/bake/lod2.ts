// Wyciąga wysokości (i, gdy są, kształty dachów) budynków z modeli 3D GUGiK w CityGML 2.0
// do data/lod2/buildings.json (+ trójkąty dachów w data/lod2/roofs.bin).
//
// Źródło: GUGiK, „Modele 3D budynków”, licencja CC BY 4.0. Dla Wrocławia (TERYT 0264) GUGiK NIE ma
// LoD2 (LoD2 z 2017 r. obejmuje 10 innych województw), jest tylko LoD1 2024 (bryła = obrys z BDOT10k
// wyciągnięty do mediany punktów ALS, atrybut measuredHeight). Skrypt czyta oba warianty: LoD2
// (bldg:RoofSurface/WallSurface/GroundSurface) i LoD1 (lod1Solid; ściany/podłoga/dach z normalnych).
//
// Wejście: wszystkie data/lod2/*.zip (czytane strumieniowo przez `unzip -p`, bez rozpakowywania)
// oraz data/lod2/**/*.gml. Jeśli nic nie ma, pobiera paczkę LoD1 2024 dla powiatu 0264.
// Współrzędne: EPSG:2180 (PUWG 1992), w posList kolejność x=wschód, y=północ; z = n.p.m. (PL-EVRF2007-NH).
import { spawn, execFileSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { ShapeUtils, Vector2 } from 'three'
import { BBOX, ORIGIN as ORIGIN0 } from './config.ts'

const DIR = 'data/lod2'
const SRC_URL = process.env.LOD_URL ?? 'https://opendata.geoportal.gov.pl/InneDane/Budynki3D/LOD1/2024/02/0264.zip'
const SRC_ZIP = `${DIR}/0264_lod1_2024.zip`

// ---------- PUWG 1992 (EPSG:2180) → WGS84: odwrotne odwzorowanie Gaussa-Krügera (szeregi Krügera) ----------
const A_AX = 6378137, F = 1 / 298.257222101 // GRS80
const K0 = 0.9993, LON0 = (19 * Math.PI) / 180, FE = 500000, FN = -5300000
const n = F / (2 - F), n2 = n * n, n3 = n2 * n
const AR = (A_AX / (1 + n)) * (1 + n2 / 4 + (n2 * n2) / 64) // promień prostujący
const BETA = [n / 2 - (2 * n2) / 3 + (37 * n3) / 96, n2 / 48 + n3 / 15, (17 * n3) / 480]
const DELTA = [2 * n - (2 * n2) / 3 - 2 * n3, (7 * n2) / 3 - (8 * n3) / 5, (56 * n3) / 15]

/** [lat, lon] w stopniach z (easting, northing) EPSG:2180. */
export function puwg92ToWgs(e: number, nn: number): [number, number] {
  const xi0 = (nn - FN) / (K0 * AR), eta0 = (e - FE) / (K0 * AR)
  let xi = xi0, eta = eta0
  for (let j = 1; j <= 3; j++) {
    const b = BETA[j - 1]
    xi -= b * Math.sin(2 * j * xi0) * Math.cosh(2 * j * eta0)
    eta -= b * Math.cos(2 * j * xi0) * Math.sinh(2 * j * eta0)
  }
  const chi = Math.asin(Math.sin(xi) / Math.cosh(eta))
  let phi = chi
  for (let j = 1; j <= 3; j++) phi += DELTA[j - 1] * Math.sin(2 * j * chi)
  const lam = LON0 + Math.atan2(Math.sinh(eta), Math.cos(xi))
  return [(phi * 180) / Math.PI, (lam * 180) / Math.PI]
}

// ---------- metry lokalne projektu (jak w scripts/bake.ts) ----------
const [S, W, N, E] = BBOX
const ORIGIN: [number, number] = [ORIGIN0[0], ORIGIN0[1]]
const KX = Math.cos((ORIGIN[0] * Math.PI) / 180) * 111320
const KY = 110540
const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

// ---------- typy ----------
type Sem = 'roof' | 'wall' | 'ground' | 'other' | null
interface Ring { p: number[] } // płasko x, y, z (x,y lokalne w metrach, z n.p.m.), bez powtórzonego ostatniego punktu
interface Poly { sem: Sem; ext: Ring; holes: Ring[] }

export interface Lod2Building {
  id: string
  c: [number, number] // środek obrysu (metry lokalne)
  H: number // max dachu − min gruntu
  eave: number // min wysokość krawędzi dachu − grunt
  roof: 'flat' | 'pitched'
  n: number // liczba połaci (wielokątów dachu)
  a: number // pole podstawy [m²]
  g: number // wysokość gruntu n.p.m. [m]
  mh?: number // bldg:measuredHeight, jeśli jest (LoD1 2024: mediana ALS − najniższy punkt NMT)
  lod: 1 | 2
  o: number[] // obrys podstawy (największy wielokąt), płasko [x, y, ...] w metrach lokalnych
}

// ---------- parsowanie jednego bldg:Building ----------
const SEM_OF: Record<string, Sem> = {
  RoofSurface: 'roof', WallSurface: 'wall', GroundSurface: 'ground',
  ClosureSurface: 'other', OuterCeilingSurface: 'other', OuterFloorSurface: 'other',
}
const TOKEN = /<(\/?)bldg:(RoofSurface|WallSurface|GroundSurface|ClosureSurface|OuterCeilingSurface|OuterFloorSurface)[\s>]|<gml:Polygon[\s>][\s\S]*?<\/gml:Polygon>/g
const RING = /<gml:(exterior|interior)>[\s\S]*?<\/gml:\1>/g

function parseRing(xml: string): Ring | null {
  let nums: number[]
  const pl = /<gml:posList[^>]*>([^<]*)</.exec(xml)
  if (pl) nums = pl[1].trim().split(/\s+/).map(Number)
  else nums = [...xml.matchAll(/<gml:pos[^>]*>([^<]*)</g)].flatMap((m) => m[1].trim().split(/\s+/).map(Number))
  if (nums.length < 9) return null
  const p: number[] = []
  for (let i = 0; i + 2 < nums.length; i += 3) {
    const [lat, lon] = puwg92ToWgs(nums[i], nums[i + 1])
    p.push((lon - ORIGIN[1]) * KX, (lat - ORIGIN[0]) * KY, nums[i + 2])
  }
  const k = p.length
  if (k >= 6 && p[0] === p[k - 3] && p[1] === p[k - 2] && p[2] === p[k - 1]) p.length = k - 3
  return p.length >= 9 ? { p } : null
}

/** Normalna Newella (nie znormalizowana). */
function normal(p: number[]): [number, number, number] {
  let nx = 0, ny = 0, nz = 0
  for (let i = 0, k = p.length; i < k; i += 3) {
    const j = (i + 3) % k
    nx += (p[i + 1] - p[j + 1]) * (p[i + 2] + p[j + 2])
    ny += (p[i + 2] - p[j + 2]) * (p[i] + p[j])
    nz += (p[i] - p[j]) * (p[i + 1] + p[j + 1])
  }
  return [nx, ny, nz]
}
/** Pole rzutu na XY ze znakiem. */
function area2d(p: number[]): number {
  let s = 0
  for (let i = 0, k = p.length; i < k; i += 3) {
    const j = (i + 3) % k
    s += p[i] * p[j + 1] - p[j] * p[i + 1]
  }
  return s / 2
}
const cosOf = (v: [number, number, number]) => Math.abs(v[2]) / (Math.hypot(...v) || 1)

const FLAT_DEG = 8 // połać o nachyleniu poniżej tego kąta uznajemy za płaską
const PITCHED_SHARE = 0.15 // dach spadzisty, jeśli >15% pola dachu ma nachylenie ≥ FLAT_DEG
const COS_FLAT = Math.cos((FLAT_DEG * Math.PI) / 180)
const COS_VERTICAL = Math.cos((80 * Math.PI) / 180)

interface Parsed { b: Lod2Building; tris: number[] }

function parseBuilding(xml: string): Parsed | null {
  // szybkie odrzucenie: pierwszy punkt poza BBOX (z zapasem ~300 m)
  const first = /<gml:pos(?:List)?[^>]*>\s*([-\d.]+)\s+([-\d.]+)/.exec(xml)
  if (!first) return null
  const [la, lo] = puwg92ToWgs(+first[1], +first[2])
  if (la < S - 0.003 || la > N + 0.003 || lo < W - 0.005 || lo > E + 0.005) return null

  const id = /name="buildingId">\s*<gen:value>([^<]*)/.exec(xml)?.[1] ?? /gml:id="([^"]*)"/.exec(xml)?.[1] ?? ''
  const mhM = /<bldg:measuredHeight[^>]*>([^<]*)</.exec(xml)
  const lod: 1 | 2 = /<bldg:lod2/.test(xml) || /<bldg:RoofSurface/.test(xml) ? 2 : 1

  const polys: Poly[] = []
  const stack: Sem[] = []
  for (const m of xml.matchAll(TOKEN)) {
    if (m[2]) { if (m[1]) stack.pop(); else stack.push(SEM_OF[m[2]]); continue }
    let ext: Ring | null = null
    const holes: Ring[] = []
    for (const r of m[0].matchAll(RING)) {
      const ring = parseRing(r[0])
      if (!ring) continue
      if (r[1] === 'exterior') ext = ring; else holes.push(ring)
    }
    if (ext) polys.push({ sem: stack.length ? stack[stack.length - 1] : null, ext, holes })
  }
  if (!polys.length) return null

  // Gdy są powierzchnie semantyczne, pomijamy geometrię bez semantyki (np. duplikat w lod2Solid).
  const hasSem = polys.some((p) => p.sem)
  let list = hasSem ? polys.filter((p) => p.sem) : polys
  let zmin = Infinity
  for (const p of list) for (let i = 2; i < p.ext.p.length; i += 3) zmin = Math.min(zmin, p.ext.p[i])
  if (!hasSem) {
    // LoD1 / bez semantyki: pionowe → ściana, poziome na dole → grunt, reszta → dach
    list = list.map((p) => {
      const c = cosOf(normal(p.ext.p))
      let zTop = -Infinity
      for (let i = 2; i < p.ext.p.length; i += 3) zTop = Math.max(zTop, p.ext.p[i])
      const sem: Sem = c < COS_VERTICAL ? 'wall' : zTop - zmin < 0.05 ? 'ground' : 'roof'
      return { ...p, sem }
    })
  }
  const roofs = list.filter((p) => p.sem === 'roof')
  let grounds = list.filter((p) => p.sem === 'ground')
  if (!roofs.length) return null

  let g = Infinity
  for (const p of grounds.length ? grounds : list) for (let i = 2; i < p.ext.p.length; i += 3) g = Math.min(g, p.ext.p[i])
  let top = -Infinity, eaveZ = Infinity
  let roofArea = 0, pitchedArea = 0
  for (const p of roofs) {
    for (let i = 2; i < p.ext.p.length; i += 3) { top = Math.max(top, p.ext.p[i]); eaveZ = Math.min(eaveZ, p.ext.p[i]) }
    const ar = Math.abs(area2d(p.ext.p)) - p.holes.reduce((s, h) => s + Math.abs(area2d(h.p)), 0)
    roofArea += ar
    if (cosOf(normal(p.ext.p)) < COS_FLAT) pitchedArea += ar
  }

  // obrys: GroundSurface, a gdy brak — rzut dachów
  if (!grounds.length) grounds = roofs.filter((p) => cosOf(normal(p.ext.p)) >= COS_VERTICAL)
  let a = 0, cx = 0, cy = 0, best: Poly | null = null, bestA = 0
  for (const p of grounds) {
    const ae = Math.abs(area2d(p.ext.p))
    const ah = p.holes.reduce((s, h) => s + Math.abs(area2d(h.p)), 0)
    const ar = ae - ah
    // środek: średnia wierzchołków ważona polem wielokąta (wystarcza do dopasowania)
    let sx = 0, sy = 0
    const k = p.ext.p.length / 3
    for (let i = 0; i < p.ext.p.length; i += 3) { sx += p.ext.p[i]; sy += p.ext.p[i + 1] }
    cx += (sx / k) * ar; cy += (sy / k) * ar; a += ar
    if (ae > bestA) { bestA = ae; best = p }
  }
  if (!best || a <= 0) return null
  cx /= a; cy /= a
  // dokładniejszy środek: centroid największego wielokąta, jeśli dominuje
  if (bestA > 0.9 * a) {
    const p = best.ext.p
    let s = 0, x = 0, y = 0
    for (let i = 0, k = p.length; i < k; i += 3) {
      const j = (i + 3) % k
      const cr = p[i] * p[j + 1] - p[j] * p[i + 1]
      s += cr; x += (p[i] + p[j]) * cr; y += (p[i + 1] + p[j + 1]) * cr
    }
    if (Math.abs(s) > 1e-6) { cx = x / (3 * s); cy = y / (3 * s) }
  }
  const cLat = cy / KY + ORIGIN[0], cLon = cx / KX + ORIGIN[1]
  if (cLat < S || cLat > N || cLon < W || cLon > E) return null

  const o: number[] = []
  for (let i = 0; i < best.ext.p.length; i += 3) o.push(r1(best.ext.p[i]), r1(best.ext.p[i + 1]))

  // trójkąty dachów (x, y lokalne, z względem gruntu)
  const tris: number[] = []
  for (const p of roofs) {
    if (cosOf(normal(p.ext.p)) < COS_VERTICAL) continue
    const pts = [p.ext, ...p.holes].map((r) => {
      const v: Vector2[] = [], z: number[] = []
      for (let i = 0; i < r.p.length; i += 3) { v.push(new Vector2(r.p[i], r.p[i + 1])); z.push(r.p[i + 2] - g) }
      return { v, z }
    })
    const zs = pts.flatMap((q) => q.z), vs = pts.flatMap((q) => q.v)
    for (const t of ShapeUtils.triangulateShape(pts[0].v, pts.slice(1).map((q) => q.v))) {
      for (const i of t) tris.push(vs[i].x, vs[i].y, zs[i])
    }
  }

  const b: Lod2Building = {
    id,
    c: [r1(cx), r1(cy)],
    H: r2(top - g),
    eave: r2(eaveZ - g),
    roof: pitchedArea > PITCHED_SHARE * roofArea ? 'pitched' : 'flat',
    n: roofs.length,
    a: Math.round(a),
    g: r2(g),
    lod,
    o,
  }
  if (mhM) b.mh = +mhM[1]
  return { b, tris }
}

// ---------- strumieniowe skanowanie plików ----------
const OPEN = /<bldg:Building[\s>]/g
const CLOSE = '</bldg:Building>'

async function scan(stream: AsyncIterable<string | Buffer>, on: (xml: string) => void) {
  let buf = ''
  for await (const chunk of stream) {
    buf += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    let pos = 0
    for (;;) {
      OPEN.lastIndex = pos
      const m = OPEN.exec(buf)
      if (!m) { pos = Math.max(pos, buf.length - 20); break }
      const end = buf.indexOf(CLOSE, m.index)
      if (end < 0) { pos = m.index; break }
      on(buf.slice(m.index, end + CLOSE.length))
      pos = end + CLOSE.length
    }
    buf = buf.slice(pos)
  }
}

async function listGml(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) out.push(...(await listGml(p)))
    else if (/\.gml$/i.test(e.name)) out.push(p)
  }
  return out
}

await mkdir(DIR, { recursive: true })
let zips = (await readdir(DIR)).filter((f) => /\.zip$/i.test(f)).map((f) => `${DIR}/${f}`)
let gmls = await listGml(DIR)
if (!zips.length && !gmls.length) {
  console.log(`pobieram ${SRC_URL}`)
  const res = await fetch(SRC_URL, { headers: { 'User-Agent': 'wroclaw-pixel-map/0.1' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} dla ${SRC_URL}`)
  await writeFile(SRC_ZIP, Buffer.from(await res.arrayBuffer()))
  zips = [SRC_ZIP]
}

const out: Lod2Building[] = []
const roofChunks: Buffer[] = []
const seen = new Set<string>()
let total = 0
const onXml = (xml: string) => {
  total++
  const r = parseBuilding(xml)
  if (!r || (r.b.id && seen.has(r.b.id))) return
  if (r.b.id) seen.add(r.b.id)
  const idx = out.length
  out.push(r.b)
  if (r.tris.length) {
    const head = Buffer.alloc(8)
    head.writeUInt32LE(idx, 0)
    head.writeUInt32LE(r.tris.length / 9, 4)
    roofChunks.push(head, Buffer.from(new Float32Array(r.tris).buffer))
  }
}

for (const zip of zips) {
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter((f) => /\.gml$/i.test(f))
  for (const entry of entries) {
    const before = out.length
    const proc = spawn('unzip', ['-p', zip, entry], { stdio: ['ignore', 'pipe', 'inherit'] })
    proc.stdout.setEncoding('utf8')
    await scan(proc.stdout, onXml)
    console.log(`${entry}: +${out.length - before}`)
  }
}
for (const f of gmls) {
  const before = out.length
  await scan(createReadStream(f, { encoding: 'utf8' }), onXml)
  console.log(`${f}: +${out.length - before}`)
}

const header = Buffer.alloc(12)
header.write('RF01', 0, 'ascii')
header.writeUInt32LE(out.length, 4)
header.writeUInt32LE(roofChunks.length / 2, 8)
await writeFile(`${DIR}/buildings.json`, JSON.stringify(out))
await writeFile(`${DIR}/roofs.bin`, Buffer.concat([header, ...roofChunks]))
const pitched = out.filter((b) => b.roof === 'pitched').length
console.log(`budynków w plikach: ${total}, w BBOX: ${out.length} (LoD2: ${out.filter((b) => b.lod === 2).length}, spadzistych: ${pitched})`)
console.log(`zapisano ${DIR}/buildings.json i ${DIR}/roofs.bin`)
