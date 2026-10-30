// Pobiera numeryczny model terenu GUGiK (NMT, siatka 1 m, PL-KRON86-NH, licencja: dane PZGiK, bez opłat)
// przez WCS i zapisuje rzadką siatkę wysokości dla całego bounds mapy do public/data/terrain.json:
//   { x0, y0, step, nx, ny, min, max, h }  — h[j*nx + i] = wysokość n.p.m. − min (m, 0.1 m dokładności)
//   w węźle (x0 + i*step, y0 + j*step) w metrach lokalnych; j = 0 to południowy brzeg (y rośnie na północ).
// Rzutowanie lokalne jest liniowe w lon/lat, więc pobieramy wprost w EPSG:4326 — bez proj4.
// Użycie: node scripts/fetch-terrain.ts [krok_m=25]
import { readFile, writeFile } from 'node:fs/promises'
import { fromArrayBuffer } from 'geotiff'
import type { WorldMeta } from '../src/types/world.ts'

const WCS = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WCS/DigitalTerrainModelFormatTIFF'
const CRS = 'http://www.opengis.net/def/crs/EPSG/0/4326'
const CHUNK = 128 // węzłów na bok jednego zapytania (serwer nie lubi dużych odpowiedzi)

const step = Number(process.argv[2] ?? 25)
const meta: WorldMeta = JSON.parse(await readFile('public/data/meta.json', 'utf8'))
const [lat0, lon0] = meta.origin
const KX = Math.cos((lat0 * Math.PI) / 180) * 111320
const KY = 110540
const [minx, miny, maxx, maxy] = meta.bounds
const x0 = Math.floor(minx / step) * step, y0 = Math.floor(miny / step) * step
const nx = Math.ceil((maxx - x0) / step) + 1, ny = Math.ceil((maxy - y0) / step) + 1
const abs = new Float32Array(nx * ny)
console.log(`siatka ${nx}×${ny} co ${step} m`)

// Okno [i0, i0+w) × [j0, j0+hgt) węzłów; piksel WCS = komórka wokół węzła (pixel-is-area)
async function chunk(i0: number, j0: number, w: number, hgt: number) {
  const w0 = (x0 + (i0 - 0.5) * step) / KX + lon0, e = (x0 + (i0 + w - 0.5) * step) / KX + lon0
  const s = (y0 + (j0 - 0.5) * step) / KY + lat0, n = (y0 + (j0 + hgt - 0.5) * step) / KY + lat0
  const url = `${WCS}?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=DTM_PL-KRON86-NH_TIFF&FORMAT=image/tiff` +
    `&SUBSET=x(${w0},${e})&SUBSET=y(${s},${n})&SUBSETTINGCRS=${CRS}&OUTPUTCRS=${CRS}&SCALESIZE=x(${w}),y(${hgt})`
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'wroclaw-pixel-map/0.1' } })
      const buf = await res.arrayBuffer()
      if (res.ok && res.headers.get('content-type')?.includes('tiff')) {
        const img = await (await fromArrayBuffer(buf)).getImage()
        if (img.getWidth() !== w || img.getHeight() !== hgt) throw new Error(`rozmiar ${img.getWidth()}×${img.getHeight()}`)
        const [band] = (await img.readRasters()) as unknown as ArrayLike<number>[]
        for (let r = 0; r < hgt; r++) // wiersz 0 TIFF-a = północ
          for (let c = 0; c < w; c++) abs[(j0 + hgt - 1 - r) * nx + i0 + c] = band[r * w + c]
        return
      }
      console.log(`${i0},${j0}: HTTP ${res.status}`)
    } catch (err) {
      console.log(`${i0},${j0}: ${(err as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, 3000 * attempt))
  }
  throw new Error(`nie udało się pobrać okna ${i0},${j0}`)
}

const jobs: [number, number][] = []
for (let j = 0; j < ny; j += CHUNK) for (let i = 0; i < nx; i += CHUNK) jobs.push([i, j])
let done = 0
await Promise.all(
  [0, 1, 2].map(async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const [i, j] = job
      await chunk(i, j, Math.min(CHUNK, nx - i), Math.min(CHUNK, ny - j))
      console.log(`${++done} okno ${i},${j} ok`)
    }
  }),
)

// Brak danych: WCS zwraca 0 na szwach arkuszy (pojedyncze linie węzłów) → średnia z poprawnych sąsiadów,
// powtarzana aż dziury znikną. Wrocław leży ~105–160 m n.p.m., więc wszystko < 50 m to dziura.
const ok = (v: number) => v > 50 && v < 3000
let holes = 0
for (let k = 0; k < abs.length; k++) if (!ok(abs[k])) { abs[k] = NaN; holes++ }
for (let left = holes; left > 0;) {
  left = 0
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      if (!Number.isNaN(abs[j * nx + i])) continue
      let sum = 0, cnt = 0
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue
        const v = abs[jj * nx + ii]
        if (!Number.isNaN(v)) { sum += v; cnt++ }
      }
      if (cnt) abs[j * nx + i] = sum / cnt
      else left++
    }
}
let min = Infinity, max = -Infinity
for (const v of abs) { min = Math.min(min, v); max = Math.max(max, v) }
const h = Array.from(abs, (v) => Math.round((v - min) * 10) / 10)
await writeFile('public/data/terrain.json', JSON.stringify({ x0, y0, step, nx, ny, min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10, h }))
console.log(`teren: ${min.toFixed(1)}–${max.toFixed(1)} m n.p.m., dziur: ${holes}`)
