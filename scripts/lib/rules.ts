// Heurystyki wypiekania danych: wszystko, co zgadujemy, gdy OSM (albo inne źródło) milczy.
// Każda reguła ma nazwę i komentarz „dlaczego”; zestawienie w docs/HEURISTICS.md.
import type { BuildingKind, PoiKind, Structure } from '../../src/types/world.ts'
import { num } from './osm.ts'
import type { Tags } from './osm.ts'

// ---------- budynki: rodzaj ----------

// Rodzaj bryły z tagu building (albo building:part); decyduje o kolorze ścian, oknach i domyślnej wysokości.
export const BUILDING_KIND: Record<string, BuildingKind> = {
  church: 'church',
  cathedral: 'church',
  chapel: 'church',
  basilica: 'church',
  apartments: 'res',
  residential: 'res',
  house: 'res',
  detached: 'res',
  terrace: 'res',
  dormitory: 'res',
  commercial: 'com',
  retail: 'com',
  office: 'com',
  hotel: 'com',
  supermarket: 'com',
  university: 'pub',
  school: 'pub',
  public: 'pub',
  civic: 'pub',
  government: 'pub',
  hospital: 'pub',
  college: 'pub',
  train_station: 'pub',
  museum: 'pub',
  kindergarten: 'pub',
  industrial: 'ind',
  warehouse: 'ind',
  garage: 'low',
  garages: 'low',
  shed: 'low',
  roof: 'roof',
  kiosk: 'low',
  service: 'low',
  ruins: 'ruin',
}

// Kominy, zbiorniki i silosy bywają oznaczone jako building — nie mają okien, więc dostają własny rodzaj.
export const TANKS = ['storage_tank', 'silo', 'gasometer', 'water_tower']
export function buildingKind(t: Tags, buildingTag: string): BuildingKind {
  if (t.man_made === 'chimney') return 'chimney'
  if (TANKS.includes(t.man_made)) return 'tank'
  // świątynia bez building=church (np. building=yes + amenity=place_of_worship)
  return BUILDING_KIND[buildingTag] || (t.amenity === 'place_of_worship' ? 'church' : 'gen')
}

// Wąska, okrągła i bardzo wysoka bryła bez tagu man_made to też komin. Tylko samodzielne budynki
// bez kształtu dachu — wieże kościołów to części z hełmami.
export function looksLikeChimney(t: Tags, ringPoints: number, area: number, height: number): boolean {
  return !t['building:part'] && !t['roof:shape'] && ringPoints >= 8 && area < 400 && height > 40 && height / Math.sqrt(area) > 3
}

// ---------- budynki: wysokość ----------

// Wysokość kondygnacji i dodatek na dach/attykę przy liczeniu z building:levels.
export const LEVEL_H = 3.2
export const LEVELS_EXTRA_H = 1.5
// Bez height i building:levels: typowa wysokość dla rodzaju (kościół = nawa z dachem, blok = ok. 5 pięter).
export const DEFAULT_H: Partial<Record<BuildingKind, number>> = {
  low: 3.5,
  roof: 4,
  ruin: 4,
  church: 22,
  res: 15,
  com: 14,
  pub: 16,
  ind: 9,
}
// Rodzaj bez wpisu w DEFAULT_H (gen, chimney, tank)
export const FALLBACK_H = 12
// Najwyższy budynek Wrocławia (Sky Tower) ma ~212 m — większe wartości to błędy w tagach.
export const MAX_H = 220
// Obrysy mniejsze niż tyle m² to śmieci (słupki, błędy rysowania).
export const MIN_BUILDING_AREA = 6

// Typy domów jednorodzinnych: bez wysokości w OSM są niskie i mają dach spadzisty.
export const HOUSES = new Set(['house', 'detached', 'semidetached_house', 'bungalow', 'farm', 'villa', 'cabin'])
// Mały budynek ogólny (building=yes) traktujemy jak dom — to głównie domki i przybudówki.
export const HOUSE_MAX_AREA = 180
// Średni budynek ogólny: ok. 3 kondygnacje.
export const MID_MAX_AREA = 400
export const HOUSE_H = 8
export const MID_H = 10

export const isHouse = (buildingTag: string, kind: BuildingKind, area: number) =>
  HOUSES.has(buildingTag) || (kind === 'gen' && area < HOUSE_MAX_AREA)

// Wysokość z tagów: height, inaczej piętra × LEVEL_H + dach; null = nieznana.
export const taggedHeight = (t: Tags, levels: number | null): number | null =>
  num(t.height) ?? (levels != null ? levels * LEVEL_H + LEVELS_EXTRA_H : null)

// Zgadywana wysokość, gdy OSM nie ma ani height, ani pięter.
export function guessHeight(kind: BuildingKind, area: number, house: boolean): number {
  if (house) return HOUSE_H
  if (kind === 'gen' && area < MID_MAX_AREA) return MID_H
  return DEFAULT_H[kind] ?? FALLBACK_H
}

// Dolna krawędź bryły (min_height / building:min_level); wiata (roof) to sam dach: ok. 0.6 m pod wierzchem.
export function minHeight(t: Tags, kind: BuildingKind, h: number | null): number {
  const minLevel = num(t['building:min_level'])
  const minH = num(t.min_height) ?? (minLevel != null ? minLevel * LEVEL_H : 0)
  return kind === 'roof' ? Math.max(minH, (h ?? 4) - 0.6) : minH
}

// Kształt dachu: z tagu (oprócz flat); bez wysokości i bez tagu dom dostaje dach dwuspadowy.
export function roofShape(t: Tags, known: boolean, house: boolean): string | undefined {
  if (t['roof:shape'] && t['roof:shape'] !== 'flat') return t['roof:shape']
  return !known && house && !t['roof:shape'] ? 'gabled' : undefined
}

// Budowa w toku (building=construction) istnieje dopiero „dziś”: rok = bieżący.
export const constructionYear = (buildingTag: string) => (buildingTag === 'construction' ? new Date().getFullYear() : undefined)

// Wysokość tylko szacowana (brak height, kształtu dachu, nie kościół, nie część budynku) — można ją zastąpić
// pomiarem LoD1 GUGiK. Kościoły (wieże), części (Simple 3D) i jawne height są dokładniejsze niż mediana ALS.
export const isEstimatedHeight = (t: Tags, kind: BuildingKind) =>
  t.height == null && !t['roof:shape'] && kind !== 'church' && !t['building:part']

// Ażurowa pergola: daszek na wysokości ok. 4 m.
export const PERGOLA = { H: 4.2, m: 3.6 }

// ---------- części budynków (Simple 3D Buildings) ----------

// Obrys znika tylko, gdy części pokrywają większość budynku — często zmapowane są pojedyncze elementy (arkady, wieża).
// Obrys bez wysokości (H < 1) to zaślepka i zawsze ustępuje częściom.
export const PARTS_REPLACE_SHARE = 0.7
export const partsReplaceOutline = (partsArea: number, outlineArea: number, outlineH: number) =>
  partsArea >= PARTS_REPLACE_SHARE * outlineArea || outlineH < 1

// Obrys, który zostaje obok części, obniżamy (dachy na tej samej wysokości migotałyby) i zwężamy do środka
// (wspólne ściany obrysu i części też migoczą — z-fighting).
export const Z_FIGHT_LOWER = 0.4
export const Z_FIGHT_MIN_ABOVE_BASE = 0.5
export const Z_FIGHT_SHRINK = 0.15

// Część kościoła jest kościołem (ceglane ściany, bez okien bloków); inne dziedziczą tylko rodzaj ogólny.
export const partKind = (part: BuildingKind, parent: BuildingKind): BuildingKind => (part === 'gen' || parent === 'church' ? parent : part)

// ---------- rok budowy z rejestru zabytków NID ----------

// Punkt adresowy z wpisem NID poza obrysami (np. przy wejściu, na chodniku): rok dostaje najbliższy budynek do tylu metrów.
export const NID_NEAR_RADIUS = 15
// Do punktów adresowych nie przypisujemy garaży i wiat (to nie one są zabytkiem).
export const nidNearSkip = (k: BuildingKind) => k === 'low' || k === 'roof'

// ---------- wysokości z LoD1 GUGiK ----------

// Mediana ALS niższa niż tyle to wiata, ogrodzenie albo błąd — nie zastępujemy.
export const LOD1_MIN_H = 1.5
// Przy dachu spadzistym mediana wypada w połowie dachu — kalenica jest wyżej.
export const LOD1_PITCHED_FACTOR = 1.15
// Bryła z LoD1 ma co najmniej tyle nad dolną krawędzią.
export const LOD1_MIN_ABOVE_BASE = 2
export const lod1Height = (h: number, base: number, pitched: boolean) =>
  Math.max(base + LOD1_MIN_ABOVE_BASE, pitched ? h * LOD1_PITCHED_FACTOR : h)

// ---------- kolor dachu z ortofotomapy ----------

// Próbkujemy ok. tylu pikseli na budynek (krok siatki rośnie z wielkością obrysu).
export const ORTHO_SAMPLES = 400
export const orthoStep = (w: number, h: number) => Math.max(1, Math.floor(Math.sqrt((w * h) / ORTHO_SAMPLES)))
// Piksel korony drzewa zasłaniającej dach: zieleń wyraźnie dominuje.
export const isTreePixel = (r: number, g: number, b: number) => g > r + 8 && g > b + 4
// Jasność (luma) do sortowania pikseli.
export const luma = (r: number, g: number, b: number) => r * 0.3 + g * 0.59 + b * 0.11
// Poniżej tylu użytecznych pikseli albo tego udziału w obrysie (reszta pod drzewami) zdjęcie nie pokazuje dachu.
export const ORTHO_MIN_PIXELS = 4
export const ORTHO_MIN_SHARE = 0.4
// Prawie szary wynik (rozpiętość kanałów poniżej progu) to papa, blacha, beton.
export const ORTHO_GREY_SPREAD = 28

// Kolor dachu z pikseli [r, g, b, jasność] (bez drzew) albo null. Uśredniamy środkową połowę według jasności
// (odrzuca cienie, kominy, świetliki i blaski).
export function roofColour(px: [number, number, number, number][], total: number, church: boolean): string | null {
  if (px.length < ORTHO_MIN_PIXELS || px.length < total * ORTHO_MIN_SHARE) return null
  px.sort((u, v) => u[3] - v[3])
  const mid = px.slice(Math.floor(px.length / 4), Math.ceil((px.length * 3) / 4))
  let avg = [0, 1, 2].map((ch) => Math.round(mid.reduce((s, p) => s + p[ch], 0) / mid.length))
  // zielonkawy wynik to resztki drzew albo cień; miedzianą patynę dopuszczamy tylko na kościołach
  if (avg[1] > avg[0] && avg[1] >= avg[2] && !church) return null
  // prawie szary = neutralna szarość: lekki odcień zdjęcia (mech, korekta barwna) paleta zamieniałaby
  // na zieleń/morski; nasycone kolory (dachówka, miedź) zostają
  if (Math.max(...avg) - Math.min(...avg) < ORTHO_GREY_SPREAD) {
    const l = Math.round(avg[0] * 0.3 + avg[1] * 0.59 + avg[2] * 0.11)
    // z ograniczeniem do 0–255 (jasny dach + 3 dawało 256, czyli siedem cyfr szesnastkowych)
    avg = [l + 3, l, l - 3].map((v) => Math.max(0, Math.min(255, v)))
  }
  return `#${avg.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// ---------- konstrukcje (wieże, maszty) ----------

// Typowa wysokość konstrukcji bez tagu height [m].
export const STRUCTURE_H: Record<string, number> = {
  water_tower: 30,
  mast: 40,
  communications_tower: 60,
  tower: 25,
  obelisk: 12,
  lighthouse: 20,
}
export const STRUCTURE_FALLBACK_H = 20
// Słup kolei linowej bez height.
export const PYLON_H = 35
// Maszt bez wysokości i rodzaju to zwykle słupek (hotspot, lampa) — nie zgadujemy mu 40 m.
export const isTrivialMast = (manMade: string, h: number | null, t: Tags) => manMade === 'mast' && h == null && !t['tower:type']
// Promień: z obrysu (dla linii) albo typowy (wieża ciśnień szersza).
export const structureRadius = (manMade: string, outlineArea: number | null) =>
  outlineArea != null ? Math.max(1.5, Math.sqrt(outlineArea / Math.PI)) : manMade === 'water_tower' ? 7 : 2
// Rodzaj bryły: jupitery, wieża ciśnień, maszt; smukła (wysokość/promień > 12) to iglica, reszta to wieża.
export function structureKind(t: Tags, manMade: string, h: number, r: number): Structure['k'] {
  if (t['tower:type'] === 'lighting' || t['tower:type'] === 'floodlight') return 'light'
  if (manMade === 'water_tower') return 'water'
  if (manMade === 'mast' || manMade === 'communications_tower') return 'mast'
  return h / r > 12 ? 'needle' : 'tower'
}
// Słup należy do najbliższej kolei linowej, o ile jest bliżej niż tyle metrów.
export const PYLON_MAX_DIST = 60
// Jupitery świecą w stronę najbliższego stadionu w tym promieniu.
export const FLOODLIGHT_MAX_DIST = 400

// ---------- tereny ----------

// Stadion (obrys do proceduralnych trybun) i boisko do piłki (mecz) — tylko pełnowymiarowe.
export const STADIUM_MIN_AREA = 3000
export const SOCCER_MIN_AREA = 4000
// Drobne skrawki zieleni pomijamy.
export const GREEN_MIN_AREA = 20
// Szerokość drogi z tagu width nie większa niż tyle (błędy w tagach); chodnik zawsze typowy (width to często cały pas).
export const ROAD_MAX_WIDTH = 30
// Pas startowy Festung Breslau (1945) biegł osią placu Grunwaldzkiego.
export const isFestungRunway = (t: Tags, carRoad: boolean) => t.name === 'plac Grunwaldzki' && carRoad

// ---------- POI (napisy obiektów z OSM) ----------

// Rozpoznawalne obiekty: nazwane budynki/obszary o znanej funkcji albo z artykułem w Wikipedii.
// Szkoły tylko licea (rozpoznawalne marki) albo z Wikipedią — inaczej setki napisów „Szkoła Podstawowa nr …”.
// „notable” (bez znanej funkcji) tylko z Wikipedią: sam wpis w Wikidanych mają też zwykłe kamienice.
export function poiKind(t: Tags): PoiKind | null {
  if (t.shop === 'mall') return 'mall'
  if (['theatre', 'cinema', 'arts_centre', 'library', 'concert_hall'].includes(t.amenity) || ['museum', 'gallery'].includes(t.tourism))
    return 'culture'
  if (['university', 'college'].includes(t.amenity)) return 'edu'
  if (t.amenity === 'hospital') return 'health'
  if (['stadium', 'sports_centre', 'ice_rink', 'water_park'].includes(t.leisure)) return 'sport'
  if (t.amenity === 'place_of_worship') return 'church'
  if (['school', 'kindergarten'].includes(t.amenity)) return /Liceum/i.test(t.name ?? '') || t.wikipedia ? 'edu' : null
  if (t.wikipedia) return 'notable'
  return null
}

// Ogólnikowe nazwy (sama funkcja budynku) nie są warte napisu.
export const GENERIC =
  /^(plebania|kaplica|kościół|cerkiew|dom|budynek|szkoła|przedszkole|garaże?|wieża|pawilon|hala|magazyn|portiernia|biuro|biblioteka|kino|teatr)$/i

// Ranga 1 (widoczny z daleka): galerie handlowe i obiekty z Wikidanymi/Wikipedią; reszta 2.
export const poiRank = (k: PoiKind, t: Tags): 1 | 2 => (k === 'mall' || t.wikidata || t.wikipedia ? 1 : 2)

// Rodzaj nazwanego miejsca (napisy osiedli): suburb 0, quarter 1, reszta (neighbourhood) 2.
export const PLACE_RANK: Record<string, 0 | 1> = { suburb: 0, quarter: 1 }
