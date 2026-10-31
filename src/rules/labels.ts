// Reguły napisów i znaczników (jedno źródło): od jakiego przybliżenia widać napis, od którego roku istnieje obiekt,
// jak wygląda (klasa CSS, ikona), do której grupy przełączników należy i co jest duplikatem.
import type { PoiKind } from '../types/world.ts'
import { LOCATION_YEAR } from './epochs.ts'
import { SINCE } from './milestones.ts'

// Grupy znaczników (osobne przełączniki w panelu „Znaczniki”).
export type PinGroup = 'labels' | 'places' | 'pois' | 'unis' | 'eggs' | 'cult'

// Napis albo znacznik: próg przybliżenia, klasa CSS, grupa i rok, od którego obiekt istnieje (wcześniej schowany).
export interface PinRule {
  minZoom: number
  cls: string
  group: PinGroup
  from?: number
  icon?: string
}

// ---------- zabytki z listy (content/landmarks.json) ----------

// Ranga 1 widoczna z daleka, 2 przy średnim przybliżeniu, reszta po przybliżeniu.
export const landmarkMinZoom = (rank: 1 | 2 | undefined) => (rank === 1 ? 0 : rank === 2 ? 0.9 : 1.6)
// Świątynie dostają osobny kolor napisu (po nazwie, PL i EN).
export const SACRED = /Kości|Katedr|Kolegiat|Synagog|Cerkiew|Kaplic|Church|Cathedral|Collegiate|Synagogue|Chapel/

// Rok z opisu zabytku (od kiedy pokazywać napis): pierwszy czterocyfrowy rok albo wiek (XIII w. / 13th c. → 1250, środek wieku).
export function yearOf(text: string | undefined): number | undefined {
  if (!text) return undefined
  const y = text.match(/\d{4}/)
  if (y) return +y[0]
  // angielskie „14th c.”
  const o = text.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/)
  if (o) return (+o[1] - 1) * 100 + 50
  const c = text.match(/\b([IVX]+)\s*w/)
  if (!c) return undefined
  const R: Record<string, number> = { I: 1, V: 5, X: 10 }
  let n = 0
  for (let i = 0; i < c[1].length; i++) {
    const v = R[c[1][i]],
      w = R[c[1][i + 1]] ?? 0
    n += v < w ? -v : v
  }
  return (n - 1) * 100 + 50
}

// ---------- osiedla i znaczniki ----------

// Nazwa osiedla wg rangi (dzielnica 0, osiedle 1, okolica 2): od kiedy i do kiedy widać — z bliska znika.
export const PLACE_ZOOM = { min: [0, 0.6, 1.1], max: [1.4, 2.2, 3] } as const
// Znacznik ciekawostki: zwykle od średniego przybliżenia; „zoom” to ukryte smaczki widoczne dopiero z bliska.
export const markerMinZoom = (trigger: string) => (trigger === 'zoom' ? 3 : 0.75)

// ---------- ciekawostki i stadiony ----------

// Z daleka widać główny napis uczelni; ciekawostki o uczelniach i jej jednostki dopiero z bliska.
export const UNI_TRIVIA_MIN_ZOOM = 1.8
export const STADIUM_MIN_ZOOM = 0.8
// Kultowe miejsca (★) to głównie PRL i później.
export const CULT_FROM = 1950

// ---------- obiekty z OSM (POI) ----------

export const POI_MIN_ZOOM = { church: 1.5, famous: 0.3, other: 1.2, unit: 2.2, school: 1.5 }
// Obiekt z OSM bliżej zabytku z listy niż tyle metrów i o tej samej nazwie (sameName) to ten sam obiekt
// (np. „Hala Targowa”), a nie tylko sąsiad („Pasaż Grunwaldzki” obok „Plac Grunwaldzki”).
export const POI_DEDUP_RADIUS = 150
// słowa bez znaczenia przy porównaniu nazw; „NMP” = „Najświętszej Marii Panny”
const NAME_STOP = new Set([
  'pw',
  'sw',
  'swietego',
  'swietej',
  'swietych',
  'najswietszego',
  'najswietszej',
  'i',
  'na',
  'pod',
  'we',
  'w',
  'wroclaw',
  'wroclawiu',
])
const nameWords = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/\bnmp\b/g, 'marii panny')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !NAME_STOP.has(w))
// ta sama nazwa: znaczące słowa jednej zawierają się w drugiej („Kościół NMP na Piasku” i „Kościół Najświętszej Marii Panny
// na Piasku”, „Dworzec Główny” i „Dworzec Wrocław Główny”), ale nie „Kamienica Pod Gryfami” i „Kamienica Pod Złotym Słońcem”
export function sameName(a: string, b: string) {
  const wa = nameWords(a),
    wb = nameWords(b)
  const within = (x: string[], y: string[]) => x.length > 0 && x.every((w) => y.includes(w))
  return within(wa, wb) || within(wb, wa)
}

// Od kiedy pokazywać obiekt z OSM bez daty: galerie od 2000 r., świątynie od 1850 r. (stare kościoły mają datę w OSM
// albo są na liście zabytków, bez daty to zwykle parafie z XIX i XX w.), reszta (funkcje współczesne) od 1950 r.
export const poiFrom = (kind: PoiKind) => (kind === 'mall' ? 2000 : kind === 'church' ? 1850 : 1950)

// Jednostki uczelni i podobne obiekty (wydziały, instytuty, kampusy…): tłok napisów na kampusach.
const UNIT = /Wydział|Instytut|Katedra|Zakład|Pracownia|Laboratorium|Biblioteka Główna|Centrum Kształcenia|Kampus/i
// Główny napis uczelni (kind 'edu', nie jednostka): zawsze widoczny z daleka.
const UNIVERSITY = /^(Uniwersytet|Politechnika|Akademia|Szkoła Wyższa|Wyższa Szkoła)/i
// Obiekt 'edu', który jest szkołą, a nie uczelnią: tylko z bliska, z podtytułem „Szkoła”.
const SCHOOL = /Liceum|Szkoła|Technikum|Gimnazjum|Zespół Szkół/i

export interface PoiLabelRule {
  minZoom: number
  university: boolean
  school: boolean
}

// Grupa i próg przybliżenia napisu POI. Świątynie nie są jednostkami („Katedra” to tu kościół, nie katedra uczelni).
export function poiLabelRule(name: string, kind: PoiKind, rank: 1 | 2): PoiLabelRule {
  const church = kind === 'church'
  const unit = !church && UNIT.test(name)
  const university = !unit && kind === 'edu' && UNIVERSITY.test(name)
  const school = kind === 'edu' && !university && SCHOOL.test(name)
  const minZoom = unit
    ? POI_MIN_ZOOM.unit
    : school
      ? POI_MIN_ZOOM.school
      : church
        ? POI_MIN_ZOOM.church
        : rank === 1 || university
          ? POI_MIN_ZOOM.famous
          : POI_MIN_ZOOM.other
  return { minZoom, university, school }
}

// ---------- reguły dla każdego rodzaju napisu ----------

export const landmarkLabel = (name: string, rank: 1 | 2 | undefined, year: string | undefined): PinRule => ({
  minZoom: landmarkMinZoom(rank),
  cls: SACRED.test(name) ? 'church' : '',
  group: 'labels',
  from: yearOf(year),
})

// Ciekawostka o uczelni: niebieski napis z czapką, z bliska; od najwcześniejszego roku w tekście.
export const uniTriviaLabel = (text: string): PinRule => ({
  minZoom: UNI_TRIVIA_MIN_ZOOM,
  cls: 'uni',
  group: 'unis',
  from: earliestYear(text) ?? MARKER_FROM,
})

// Stadion: Olimpijski od 1928 r., Tarczyński Arena od 2011 r.
export const stadiumLabel = (name: string): PinRule => ({
  minZoom: STADIUM_MIN_ZOOM,
  cls: '',
  group: 'labels',
  from: /Tarczyński/.test(name) ? SINCE.arena : SINCE.stadium,
})

// Obiekt z OSM: uczelnie i szkoły jak napisy uczelni z ciekawostek (niebieskie, z czapką), świątynie w kolorze świątyń;
// rok z OSM (start_date), inaczej poiFrom.
export function poiLabel(name: string, kind: PoiKind, rank: 1 | 2, from?: number): PinRule & { school: boolean } {
  const { minZoom, university, school } = poiLabelRule(name, kind, rank)
  const cls = kind === 'church' ? 'poi church' : kind === 'edu' ? 'uni' : `poi poi-${kind}`
  return { minZoom, cls, group: university ? 'unis' : 'pois', from: from ?? poiFrom(kind), school }
}

// Najwcześniejszy rok w tekście ciekawostki (czterocyfrowy albo wiek: „XIV w.”, „14th c.”), czyli od kiedy jest o czym
// opowiadać; bez żadnego roku: MARKER_FROM (to zwykle rzeczy współczesne: krasnale, PRL, kluby).
const MARKER_FROM = 1850
export function earliestYear(text: string | undefined): number | undefined {
  if (!text) return undefined
  // rok w kontekście daty: „w 1997 r.”, „od 1871”, „1913 roku”, „in 1997” (a nie „1200 miejsc”)
  const Y = '(1\\d{3}|20[0-2]\\d)'
  const dated = new RegExp(`(?:\\b(?:w|we|od|do|z|roku|in|since|from|by|until)\\s+${Y}\\b)|(?:\\b${Y}\\s*(?:r\\.|roku|rok))`, 'gi')
  const years = [...text.matchAll(dated)].map((m) => +(m[1] ?? m[2]))
  // wiek z kropką i co najmniej X: „XIV w.” (nie „I wojna”); angielskie „14th c.”
  for (const m of text.matchAll(/\b([XVI]+)\s*w\./g)) {
    const c = yearOf(`${m[1]} w`)
    if (c && c >= 950) years.push(c)
  }
  for (const m of text.matchAll(/\b(\d{2})(?:st|nd|rd|th)\s+c(?:entury|\.)/gi)) years.push((+m[1] - 1) * 100 + 50)
  return years.length ? Math.min(...years) : undefined
}

// Znaczniki: „?” ciekawostki i neony, gwiazdka (z CSS) kultowe miejsca.
export const markerRule = (trigger: string, kind: 'egg' | 'cult' | 'neon', from?: number, text?: string): PinRule => ({
  minZoom: markerMinZoom(trigger),
  icon: kind === 'cult' ? '' : '?',
  cls: kind === 'egg' ? '' : kind,
  group: kind === 'cult' ? 'cult' : 'eggs',
  from: kind === 'cult' ? CULT_FROM : (from ?? earliestYear(text) ?? MARKER_FROM),
})

// Nazwy dzielnic i osiedli: od lokacji miasta (w grodzie nie było jeszcze Starego Miasta ani przedmieść).
export const PLACE_FROM = LOCATION_YEAR
