// Pobiera surowe dane OSM dla Wrocławia z Overpass API do data/raw/ (w kawałkach; istniejące pomija, --force pobiera od nowa).
import { existsSync } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { BBOX, FETCH_GRID } from '../lib/config.ts'
import { parseJson } from '../lib/json.ts'
import type { OsmFile } from '../lib/osm.ts'
import { FORCE, tryOverpass as tryOverpassAt } from '../lib/overpass.ts'

// FETCH_ROWS=2 pobiera tylko wybrane wiersze siatki, ENDPOINT_OFFSET=1 zaczyna od innego serwera
// (pozwala puścić równolegle drugi proces na inny fragment miasta)
const ROWS_ONLY = process.env.FETCH_ROWS?.split(',').map(Number)
const ENDPOINT_OFFSET = Number(process.env.ENDPOINT_OFFSET ?? 0)

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

// Serwer startowy z ENDPOINT_OFFSET (scripts/lib/overpass.ts).
const tryOverpass = (label: string, q: string, attempts: number) => tryOverpassAt(label, q, attempts, ENDPOINT_OFFSET)

async function save(name: string, text: string) {
  await writeFile(`data/raw/${name}.json`, text)
  console.log(`${(text.length / 1e6).toFixed(1)} MB, ${parseJson<OsmFile>(text).elements.length} elementów`)
}

async function overpass(name: string, q: string) {
  const text = await tryOverpass(name, q, 8)
  if (!text) throw new Error(`${name}: nie udało się pobrać`)
  await save(name, text)
}

const done = (name: string) => !FORCE && (existsSync(`data/raw/${name}.json`) || existsSync(`data/raw/${name}-3.json`))

// Obszar miasta; gdy serwer nie daje rady, dzielimy go na 4 ćwiartki (do 2 poziomów).
async function fetchArea(name: string, [s, w, n, e]: number[], depth = 0) {
  if (done(name)) {
    console.log(`${name}: jest, pomijam`)
    return
  }
  const text = await tryOverpass(name, worldQuery([s, w, n, e].map((v) => v.toFixed(5)).join(',')), depth < 2 ? 2 : 8)
  if (text) return save(name, text)
  if (depth >= 2) throw new Error(`${name}: nie udało się pobrać`)
  console.log(`${name}: dzielę na ćwiartki`)
  const ms = (s + n) / 2,
    mw = (w + e) / 2
  const parts = [
    [s, w, ms, mw],
    [s, mw, ms, e],
    [ms, w, n, mw],
    [ms, mw, n, e],
  ]
  for (let i = 0; i < 4; i++) await fetchArea(`${name}-${i}`, parts[i], depth + 1)
}

await mkdir('data/raw', { recursive: true })
const [S, W, N, E] = BBOX
const [rows, cols] = FETCH_GRID
for (let r = 0; r < rows; r++) {
  if (ROWS_ONLY && !ROWS_ONLY.includes(r)) continue
  for (let c = 0; c < cols; c++) {
    const s = S + ((N - S) * r) / rows,
      n = S + ((N - S) * (r + 1)) / rows
    const w = W + ((E - W) * c) / cols,
      e = W + ((E - W) * (c + 1)) / cols
    await fetchArea(`world-${r}-${c}`, [s, w, n, e])
  }
}
if (ROWS_ONLY) process.exit(0)
if (!done('dwarfs')) await overpass('dwarfs', dwarfsQuery)
// Smaczki: tor żużlowy (żużlowiec na Stadionie Olimpijskim).
// Punkty adresowe: większość adresów we Wrocławiu to osobne punkty, nie tagi obrysów (dopasowanie rejestru NID).
if (!done('addresses'))
  await overpass(
    'addresses',
    `[out:json][timeout:180][bbox:${BBOX.join(',')}];
node["addr:housenumber"];
out;`,
  )
// Nazwy osiedli i dzielnic (napisy widoczne z daleka).
if (!done('places'))
  await overpass(
    'places',
    `[out:json][timeout:60][bbox:${BBOX.join(',')}];
node["place"~"^(suburb|quarter|neighbourhood)$"]["name"];
out;`,
  )
// Części budynków (Simple 3D Buildings): kopuły, wieże, uskoki — np. Hala Stulecia ma tylko obrys-zaślepkę.
if (!done('parts'))
  await overpass(
    'parts',
    `[out:json][timeout:240][bbox:${BBOX.join(',')}];
(way["building:part"]; relation["building:part"];);
out geom;`,
  )
// Szkoły i uczelnie: zwykle obszar albo punkt, nie budynek (napisy szkół i uczelni).
if (!done('schools'))
  await overpass(
    'schools',
    `[out:json][timeout:90][bbox:${BBOX.join(',')}];
nwr["amenity"~"^(school|college|university)$"]["name"];
out geom;`,
  )
// Konstrukcje spoza budynków: wieże, maszty, jupitery, wieże ciśnień, koleje linowe (Polinka).
if (!done('structures'))
  await overpass(
    'structures',
    `[out:json][timeout:120][bbox:${BBOX.join(',')}];
(way["aerialway"];node["aerialway"="pylon"];
nwr["man_made"~"^(tower|mast|obelisk|communications_tower|lighthouse|water_tower|flagpole)$"];);
out geom;`,
  )
// Pokrycie terenu poza światem: fontanny, pergole, pola, łąki, sady, mokradła, nieużytki.
if (!done('landcover'))
  await overpass(
    'landcover',
    `[out:json][timeout:180][bbox:${BBOX.join(',')}];
(nwr["amenity"="fountain"];way["man_made"="pergola"];
way["landuse"~"^(farmland|meadow|orchard|vineyard|plant_nursery|greenhouse_horticulture)$"];
relation["landuse"~"^(farmland|meadow)$"];way["natural"~"^(wetland|heath)$"];way["landuse"="brownfield"];);
out geom;`,
  )
if (!done('extras'))
  await overpass(
    'extras',
    `[out:json][timeout:60][bbox:${BBOX.join(',')}];
(way["sport"="speedway"]; way["leisure"="track"]["sport"~"speedway|motor"];);
out geom;`,
  )
