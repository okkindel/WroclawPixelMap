// Zamienia surowe dane OSM (data/raw) na kompaktowy świat w metrach: kafle public/data/tiles/*.bin i public/data/meta.json.
// Układ: x = wschód, y = północ, początek w ORIGIN. Współrzędne zaokrąglone do 0.1 m.
// Etapy w scripts/bake/world/, reguły zgadywania w scripts/lib/rules.ts (opis: docs/HEURISTICS.md).
import { ORIGIN } from '../lib/config.ts'
import { loadNid } from './nid.ts'
import { collectFeatures } from './world/features.ts'
import { applyLod1 } from './world/lod1.ts'
import { dwarfs, namedPlaces, writeMeta } from './world/meta.ts'
import { NidMatcher } from './world/nid-match.ts'
import { roofColours } from './world/ortho.ts'
import { applyParts } from './world/parts.ts'
import { addSchools, addWikiLinks } from './world/pois.ts'
import { loadSources, newState } from './world/state.ts'
import { structures } from './world/structures.ts'
import { splitTiles, writeTiles } from './world/tiles.ts'

const src = await loadSources()
const s = newState([ORIGIN[0], ORIGIN[1]])
const { out } = s
// rejestr zabytków NID: rok budowy po adresie dla budynków bez start_date
const nid = new NidMatcher(await loadNid(), src.addresses)

// 1. budynki, woda, zieleń, drogi, tory (+ POI)
collectFeatures(src.world, s, nid)
// 2. rok z NID z punktów adresowych tuż obok budynków
nid.assignNear(out.buildings)
// 3. części budynków zamiast obrysów
applyParts(s, src.parts, nid)
// 4. wysokości z LoD1 GUGiK
await applyLod1(s)
// 5. wyszukiwarka, krasnale, konstrukcje
out.named = namedPlaces(out)
out.dwarfs = dwarfs(src.dwarfs, out.buildings)
const built = structures(src.structures, out)
// 6. kafle i kolory dachów z ortofotomapy
const tiles = splitTiles(out)
await roofColours(tiles)
nid.log(out.buildings)
const bytes = await writeTiles(tiles)
// 7. szkoły (POI spoza budynków), ręczne linki do Wikipedii i meta.json
addSchools(s.pois, src.schools)
await addWikiLinks(s.pois, out.buildings)
const metaLen = await writeMeta(s, src, tiles, built)
console.log(
  `${tiles.size} kafli, ${(bytes / 1e6).toFixed(1)} MB + meta ${(metaLen / 1e6).toFixed(1)} MB:`,
  Object.entries(out)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => `${k}=${v.length}`)
    .join(' '),
)
