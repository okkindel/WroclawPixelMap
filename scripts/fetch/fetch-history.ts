// Pobiera zgeoreferowane historyczne plany Wrocławia (Virtuelles Kartenforum 2.0, SLUB Dresden / Deutsche Fotothek)
// per kafel mapy do data/history/<rok>/I_J.jpg (1000×1000, ten sam zasięg co data/ortho/I_J.jpg).
// Epoka = lista arkuszy (WMS per mapa); każdy piksel bierzemy z pierwszego arkusza, którego ramka go zawiera,
// więc z 4 Messtischblätter powstaje jedna mozaika. Rzutowanie lokalne jest liniowe w lon/lat → BBOX w EPSG:4326.
// Licencja (AccessConstraints WMS): mapy sprzed 1900 — CC BY-SA 4.0; młodsze — „rights reserved” wg SLUB
// (autor anonimowy/urzędowy, >70 lat od wydania — prawdopodobnie domena publiczna, ale do potwierdzenia).
// Użycie: node scripts/fetch-history.ts [promień_km=3 | all] [rok…]   (istniejące pliki pomija)
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import jpeg from 'jpeg-js'
import type { WorldMeta } from '../src/types/world.ts'

const PX = 1000
const RYNEK = [51.1099, 17.0326] // środek wyboru kafli

interface Sheet {
  id: number // id mapy w Kartenforum (https://wms.kartenforum.slub-dresden.de/map/<id>)
  layer: string // nazwa warstwy WMS
  title: string
  box?: [number, number, number, number] // ramka arkusza [w, s, e, n] w stopniach; brak = cały obraz
}

// Ramki Messtischblätter (siatka 10' × 6', po georeferencji SLUB)
const W = 16.8311, M = 16.9977, E = 17.1644, S = 50.9988, C = 51.0988, N = 51.1988
const box = { lissa: [W, C, M, N], nord: [M, C, E, N], schmolz: [W, S, M, C], sued: [M, S, E, C] } as const
const mtb = (id: number, layer: string, title: string, b: readonly number[]): Sheet => ({ id, layer, title, box: b as Sheet['box'] })

export const EPOCHS: Record<string, { label: string; license: string; sheets: Sheet[] }> = {
  // Twierdza: ręczny plan z ok. 1732 r. (tylko Stare Miasto z fortyfikacjami, georeferencja ±30–60 m)
  '1732': {
    label: 'Plan von Breslau, ok. 1732',
    license: 'CC BY-SA 4.0, SLUB Dresden / Deutsche Fotothek',
    sheets: [{ id: 10010118, layer: 'df_dz_0000644', title: 'Plan von Breslau (1732)', box: [17.0101, 51.0966, 17.0634, 51.1274] }],
  },
  // Przełom XIX/XX w.: brak arkusza Nord sprzed 1937 → północ z mapy 1:100 000 (1906, słaba rozdzielczość)
  '1910': {
    label: 'Meßtischblätter 1887–1914 + Karte des Deutschen Reiches 1906',
    license: '1887: CC BY-SA 4.0; pozostałe: SLUB „rights reserved”',
    sheets: [
      mtb(10001901, 'df_dk_0010001_4968_1913', 'MTB 2892 Breslau 1913', box.sued),
      mtb(10001904, 'df_dk_0010001_4967_1912', 'MTB 2891 Schmolz 1914', box.schmolz),
      mtb(10002083, 'df_dk_0010001_4867_1887', 'MTB 2827 Lissa 1887', box.lissa),
      { id: 10006694, layer: 'df_dk_0000532_0424', title: 'KDR 100 Bl. 424 Breslau 1906' },
    ],
  },
  // Międzywojnie: komplet 4 arkuszy 1:25 000 z lat 1934–1937
  '1937': {
    label: 'Meßtischblätter 1:25 000, 1934–1937',
    license: 'SLUB „rights reserved”',
    sheets: [
      mtb(10002081, 'df_dk_0010001_4868_1934', 'MTB 4868 Breslau (Nord) 1937', box.nord),
      mtb(10001899, 'df_dk_0010001_4968_1937', 'MTB 4968 Breslau 1937', box.sued),
      mtb(10002082, 'df_dk_0010001_4867_1934', 'MTB 4867 Deutsch Lissa 1934', box.lissa),
      mtb(10001902, 'df_dk_0010001_4967_1936', 'MTB 4967 Schmolz 1936', box.schmolz),
    ],
  },
  // Stan tuż przed 1945: Nord 1942 + Süd 1938 (zachód jak w 1937)
  '1942': {
    label: 'Meßtischblätter 1:25 000, 1934–1942',
    license: 'SLUB „rights reserved”',
    sheets: [
      mtb(10002080, 'df_dk_0010001_4868_1942', 'MTB 4868 Breslau (Nord) 1942', box.nord),
      mtb(10001900, 'df_dk_0010001_4968_1934', 'MTB 4968 Breslau 1938', box.sued),
      mtb(10002082, 'df_dk_0010001_4867_1934', 'MTB 4867 Deutsch Lissa 1934', box.lissa),
      mtb(10001902, 'df_dk_0010001_4967_1936', 'MTB 4967 Schmolz 1936', box.schmolz),
    ],
  },
}

const meta: WorldMeta = JSON.parse(await readFile('public/data/meta.json', 'utf8'))
const [lat0, lon0] = meta.origin
const KX = Math.cos((lat0 * Math.PI) / 180) * 111320
const KY = 110540

const arg = process.argv[2] ?? '3'
const years = process.argv.length > 3 ? process.argv.slice(3) : Object.keys(EPOCHS)
const rx = (RYNEK[1] - lon0) * KX, ry = (RYNEK[0] - lat0) * KY
const tileBox = (k: string) => {
  const [i, j] = k.split('_').map(Number)
  const x0 = meta.bounds[0] + i * meta.tile, y0 = meta.bounds[1] + j * meta.tile
  return { w: x0 / KX + lon0, e: (x0 + meta.tile) / KX + lon0, s: y0 / KY + lat0, n: (y0 + meta.tile) / KY + lat0, cx: x0 + meta.tile / 2, cy: y0 + meta.tile / 2 }
}
const tiles = meta.tiles.map((t) => t.k).filter((k) => {
  if (arg === 'all') return true
  const b = tileBox(k)
  return Math.hypot(b.cx - rx, b.cy - ry) <= Number(arg) * 1000
})

const overlaps = (sh: Sheet, b: ReturnType<typeof tileBox>) =>
  !sh.box || (sh.box[0] < b.e && sh.box[2] > b.w && sh.box[1] < b.n && sh.box[3] > b.s)
const isJpeg = (buf: Buffer) => buf[0] === 0xff && buf[1] === 0xd8

async function getMap(sh: Sheet, b: ReturnType<typeof tileBox>): Promise<Buffer | null> {
  // WMS 1.3.0 + EPSG:4326: kolejność osi lat, lon
  const url = `https://wms.kartenforum.slub-dresden.de/map/${sh.id}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${sh.layer}` +
    `&STYLES=&CRS=EPSG:4326&BBOX=${b.s},${b.w},${b.n},${b.e}&WIDTH=${PX}&HEIGHT=${PX}&FORMAT=image/jpeg`
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'wroclaw-pixel-map/0.1' } })
      const buf = Buffer.from(await res.arrayBuffer())
      if (res.ok && isJpeg(buf)) return buf
      console.log(`${sh.layer}: HTTP ${res.status}`)
    } catch (err) {
      console.log(`${sh.layer}: ${(err as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, 3000 * attempt))
  }
  return null
}

// Mozaika: piksel (c, r) → lon/lat → pierwszy arkusz z ramką zawierającą punkt
async function one(year: string, k: string): Promise<string> {
  const b = tileBox(k)
  const sheets = EPOCHS[year].sheets.filter((sh) => overlaps(sh, b))
  if (!sheets.length) return 'poza zasięgiem'
  const imgs: Uint8Array[] = []
  for (const sh of sheets) {
    const buf = await getMap(sh, b)
    if (!buf) return 'BŁĄD'
    imgs.push(jpeg.decode(buf, { useTArray: true, formatAsRGBA: true }).data)
  }
  // Na krawędziach arkuszy zostaje biały margines ramki → wolimy arkusz, który ma tu treść (nie biel)
  const white = (img: Uint8Array, p: number) => img[p] > 245 && img[p + 1] > 245 && img[p + 2] > 245
  const out = new Uint8Array(PX * PX * 4)
  let blank = 0
  for (let r = 0; r < PX; r++) {
    const lat = b.n - ((r + 0.5) / PX) * (b.n - b.s)
    for (let c = 0; c < PX; c++) {
      const lon = b.w + ((c + 0.5) / PX) * (b.e - b.w)
      const p = (r * PX + c) * 4
      let pick = -1
      for (let s = 0; s < sheets.length; s++) {
        const bx = sheets[s].box
        if (bx && !(lon >= bx[0] && lon < bx[2] && lat >= bx[1] && lat < bx[3])) continue
        if (pick < 0) pick = s
        if (!white(imgs[s], p)) { pick = s; break }
      }
      if (pick < 0) pick = sheets.length - 1
      out.set(imgs[pick].subarray(p, p + 4), p)
      if (white(out, p)) blank++
    }
  }
  if (blank > PX * PX * 0.98) return 'pusty (pominięty)' // np. kafle na skraju planu 1732
  await writeFile(`data/history/${year}/${k}.jpg`, jpeg.encode({ data: out, width: PX, height: PX }, 88).data)
  return sheets.length > 1 ? `ok (mozaika ${sheets.length})` : 'ok'
}

for (const year of years) {
  if (!EPOCHS[year]) throw new Error(`nieznana epoka ${year}; dostępne: ${Object.keys(EPOCHS).join(', ')}`)
  await mkdir(`data/history/${year}`, { recursive: true })
}
const queue = years.flatMap((y) => tiles.filter((k) => !existsSync(`data/history/${y}/${k}.jpg`)).map((k) => [y, k] as const))
console.log(`epoki ${years.join(', ')}; kafli: ${tiles.length}; do pobrania: ${queue.length}`)
let done = 0
await Promise.all(
  [0, 1, 2].map(async () => {
    for (let job = queue.shift(); job; job = queue.shift()) console.log(`${++done} ${job[0]}/${job[1]} ${await one(...job)}`)
  }),
)
await writeFile(
  'data/history/index.json',
  JSON.stringify(Object.fromEntries(Object.entries(EPOCHS).map(([y, e]) => [y, { label: e.label, license: e.license, sheets: e.sheets.map((s) => s.title) }])), null, 1),
)
