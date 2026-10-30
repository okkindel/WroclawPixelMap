// Pobiera ortofotomapę GUGiK (CC BY 4.0) dla każdego kafla mapy do data/ortho/I_J.jpg.
// Z tych zdjęć bake bierze prawdziwy kolor dachu każdego budynku. Wymaga wcześniejszego `npm run bake`
// (lista kafli z public/data/meta.json). Istniejące pliki pomija.
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { WorldMeta } from '../src/types/world.ts'

const WMS = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/HighResolution'
export const ORTHO_PX = 1000 // pikseli na bok kafla (1 m / piksel przy kaflu 1 km)

const meta: WorldMeta = JSON.parse(await readFile('public/data/meta.json', 'utf8'))
const [lat0, lon0] = meta.origin
const KX = Math.cos((lat0 * Math.PI) / 180) * 111320
const KY = 110540

await mkdir('data/ortho', { recursive: true })
const queue = meta.tiles.map((t) => t.k).filter((k) => !existsSync(`data/ortho/${k}.jpg`))
console.log(`do pobrania: ${queue.length} z ${meta.tiles.length} kafli`)

async function one(k: string) {
  const [i, j] = k.split('_').map(Number)
  const x0 = meta.bounds[0] + i * meta.tile, y0 = meta.bounds[1] + j * meta.tile
  const s = y0 / KY + lat0, n = (y0 + meta.tile) / KY + lat0
  const w = x0 / KX + lon0, e = (x0 + meta.tile) / KX + lon0
  // WMS 1.3.0 + EPSG:4326: kolejność osi lat, lon
  const url = `${WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=Raster&STYLES=&CRS=EPSG:4326&BBOX=${s},${w},${n},${e}&WIDTH=${ORTHO_PX}&HEIGHT=${ORTHO_PX}&FORMAT=image/jpeg`
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'wroclaw-pixel-map/0.1' } })
      const buf = Buffer.from(await res.arrayBuffer())
      if (res.ok && buf[0] === 0xff && buf[1] === 0xd8) {
        await writeFile(`data/ortho/${k}.jpg`, buf)
        return true
      }
      console.log(`${k}: HTTP ${res.status}`)
    } catch (err) {
      console.log(`${k}: ${(err as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, 3000 * attempt))
  }
  return false
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
