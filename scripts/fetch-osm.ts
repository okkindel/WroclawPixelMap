// Pobiera surowe dane OSM dla Wrocławia z Overpass API do data/raw/ (w kawałkach; istniejące pomija, --force pobiera od nowa).
import { existsSync } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { BBOX, FETCH_GRID } from './config.ts'

// Główny serwer i zapasowe (Overpass bywa przeciążony)
// FETCH_ROWS=2 pobiera tylko wybrane wiersze siatki, ENDPOINT_OFFSET=1 zaczyna od innego serwera
// (pozwala puścić równolegle drugi proces na inny fragment miasta)
const ROWS_ONLY = process.env.FETCH_ROWS?.split(',').map(Number)
const ENDPOINT_OFFSET = Number(process.env.ENDPOINT_OFFSET ?? 0)
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']

const worldQuery = (b: string) => `[out:json][timeout:240][bbox:${b}];
(
  way["building"]; relation["building"];
  way["natural"="water"]; relation["natural"="water"];
  way["waterway"="riverbank"]; relation["waterway"="riverbank"];
  way["leisure"~"^(park|garden|pitch|playground|stadium)$"]; relation["leisure"~"^(park|garden)$"];
  way["landuse"~"^(grass|forest|cemetery|meadow|recreation_ground|allotments|village_green)$"];
  relation["landuse"~"^(grass|forest|cemetery|meadow)$"];
  way["natural"~"^(wood|scrub|grassland)$"]; relation["natural"="wood"];
  way["highway"]; way["railway"~"^(rail|tram|light_rail)$"];
  way["place"="square"]; relation["place"="square"];
  way["barrier"="city_wall"]; way["historic"="citywalls"];
  way["man_made"="bridge"];
  node["natural"="tree"];
);
out geom;`

const dwarfsQuery = `[out:json][timeout:120];
area["name"="Wrocław"]["admin_level"="8"]->.a;
nwr(area.a)["artwork_type"="dwarf"];
out center tags;`

// Zwraca tekst odpowiedzi albo null, gdy serwer nie dał rady (timeout / przeciążenie).
async function tryOverpass(label: string, q: string, attempts: number): Promise<string | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const endpoint = ENDPOINTS[(attempt - 1 + ENDPOINT_OFFSET) % ENDPOINTS.length]
    process.stdout.write(`pobieram ${label} (${new URL(endpoint).host})… `)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': 'wroclaw-pixel-map/0.1', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
      })
      const text = await res.text()
      if (res.ok && text.trimStart().startsWith('{') && !text.includes('"remark": "runtime error')) return text
      console.log(`HTTP ${res.status}`)
    } catch (err) {
      console.log(`błąd sieci: ${(err as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, 4000 * attempt))
  }
  return null
}

async function save(name: string, text: string) {
  await writeFile(`data/raw/${name}.json`, text)
  console.log(`${(text.length / 1e6).toFixed(1)} MB, ${JSON.parse(text).elements.length} elementów`)
}

async function overpass(name: string, q: string) {
  const text = await tryOverpass(name, q, 8)
  if (!text) throw new Error(`${name}: nie udało się pobrać`)
  await save(name, text)
}

const done = (name: string) => !process.argv.includes('--force') && (existsSync(`data/raw/${name}.json`) || existsSync(`data/raw/${name}-3.json`))

// Obszar miasta; gdy serwer nie daje rady, dzielimy go na 4 ćwiartki (do 2 poziomów).
async function fetchArea(name: string, [s, w, n, e]: number[], depth = 0) {
  if (done(name)) { console.log(`${name}: jest, pomijam`); return }
  const text = await tryOverpass(name, worldQuery([s, w, n, e].map((v) => v.toFixed(5)).join(',')), depth < 2 ? 2 : 8)
  if (text) return save(name, text)
  if (depth >= 2) throw new Error(`${name}: nie udało się pobrać`)
  console.log(`${name}: dzielę na ćwiartki`)
  const ms = (s + n) / 2, mw = (w + e) / 2
  const parts = [[s, w, ms, mw], [s, mw, ms, e], [ms, w, n, mw], [ms, mw, n, e]]
  for (let i = 0; i < 4; i++) await fetchArea(`${name}-${i}`, parts[i], depth + 1)
}

await mkdir('data/raw', { recursive: true })
const [S, W, N, E] = BBOX
const [rows, cols] = FETCH_GRID
for (let r = 0; r < rows; r++) {
  if (ROWS_ONLY && !ROWS_ONLY.includes(r)) continue
  for (let c = 0; c < cols; c++) {
    const s = S + ((N - S) * r) / rows, n = S + ((N - S) * (r + 1)) / rows
    const w = W + ((E - W) * c) / cols, e = W + ((E - W) * (c + 1)) / cols
    await fetchArea(`world-${r}-${c}`, [s, w, n, e])
  }
}
if (ROWS_ONLY) process.exit(0)
if (!done('dwarfs')) await overpass('dwarfs', dwarfsQuery)
// Smaczki: tor żużlowy (żużlowiec na Stadionie Olimpijskim).
// Punkty adresowe: większość adresów we Wrocławiu to osobne punkty, nie tagi obrysów (dopasowanie rejestru NID).
if (!done('addresses')) await overpass('addresses', `[out:json][timeout:180][bbox:${BBOX.join(',')}];
node["addr:housenumber"];
out;`)
// Nazwy osiedli i dzielnic (napisy widoczne z daleka).
if (!done('places')) await overpass('places', `[out:json][timeout:60][bbox:${BBOX.join(',')}];
node["place"~"^(suburb|quarter|neighbourhood)$"]["name"];
out;`)
// Części budynków (Simple 3D Buildings): kopuły, wieże, uskoki — np. Hala Stulecia ma tylko obrys-zaślepkę.
if (!done('parts')) await overpass('parts', `[out:json][timeout:240][bbox:${BBOX.join(',')}];
(way["building:part"]; relation["building:part"];);
out geom;`)
if (!done('extras')) await overpass('extras', `[out:json][timeout:60][bbox:${BBOX.join(',')}];
(way["sport"="speedway"]; way["leisure"="track"]["sport"~"speedway|motor"];);
out geom;`)
