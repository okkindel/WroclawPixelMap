// Pobiera ortofotomapę GUGiK (CC BY 4.0) dla każdego kafla mapy do data/ortho/I_J.jpg.
// Z tych zdjęć bake bierze prawdziwy kolor dachu każdego budynku. Wymaga wcześniejszego `npm run bake`
// (lista kafli z public/data/meta.json). Istniejące pliki pomija.
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { projection } from '../lib/geo.ts'
import { fetchBuffer, isJpeg, withRetry } from '../lib/http.ts'
import { readMeta } from '../lib/json.ts'

const WMS = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/HighResolution'
export const ORTHO_PX = 1000 // pikseli na bok kafla (1 m / piksel przy kaflu 1 km)

const meta = await readMeta()
const { toLatLon } = projection(meta.origin)

await mkdir('data/ortho', { recursive: true })
const queue = meta.tiles.map((t) => t.k).filter((k) => !existsSync(`data/ortho/${k}.jpg`))
console.log(`do pobrania: ${queue.length} z ${meta.tiles.length} kafli`)

async function one(k: string) {
  const [i, j] = k.split('_').map(Number)
  const x0 = meta.bounds[0] + i * meta.tile,
    y0 = meta.bounds[1] + j * meta.tile
  const [s, w] = toLatLon(x0, y0)
  const [n, e] = toLatLon(x0 + meta.tile, y0 + meta.tile)
  // WMS 1.3.0 + EPSG:4326: kolejność osi lat, lon
  const url = `${WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=Raster&STYLES=&CRS=EPSG:4326&BBOX=${s},${w},${n},${e}&WIDTH=${ORTHO_PX}&HEIGHT=${ORTHO_PX}&FORMAT=image/jpeg`
  const buf = await withRetry(
    k,
    5,
    (attempt) => 3000 * attempt,
    () => fetchBuffer(url, (b, res) => res.ok && isJpeg(b)),
  )
  if (!buf) return false
  await writeFile(`data/ortho/${k}.jpg`, buf)
  return true
}

let done = 0
await Promise.all(
  [0, 1, 2].map(async () => {
    for (let k = queue.shift(); k; k = queue.shift()) {
      const ok = await one(k)
      console.log(`${++done} ${k} ${ok ? 'ok' : 'NIE UDAŁO SIĘ'}`)
    }
  }),
)
