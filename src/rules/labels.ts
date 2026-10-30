// Reguły napisów: od jakiego przybliżenia widać napis, od którego roku istnieje obiekt, co jest duplikatem.
import type { PoiKind } from '../types/world.ts'

// ---------- zabytki z listy (content/landmarks.json) ----------

// Ranga 1 widoczna z daleka, 2 przy średnim przybliżeniu, reszta po przybliżeniu.
export const landmarkMinZoom = (rank: 1 | 2 | undefined) => (rank === 1 ? 0 : rank === 2 ? 0.9 : 1.6)
// Świątynie dostają osobny kolor napisu (po nazwie, PL i EN).
export const SACRED = /Kości|Katedr|Kolegiat|Synagog|Cerkiew|Kaplic|Church|Cathedral|Collegiate|Synagogue|Chapel/

// Rok z opisu zabytku (od kiedy pokazywać napis): pierwszy czterocyfrowy rok albo wiek (XIII w. / 13th c. → 1250, środek wieku).
export function yearOf(text: string): number | undefined {
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
// Obiekt z OSM bliżej zabytku z listy niż tyle metrów i z tym samym pierwszym słowem nazwy to ten sam obiekt
// (np. „Hala Targowa”), a nie tylko sąsiad („Pasaż Grunwaldzki” obok „Plac Grunwaldzki”).
export const POI_DEDUP_RADIUS = 150
// pierwsze słowo nazwy bez polskich znaków, małymi literami
export const firstWord = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[\s(]/)[0]

// Od kiedy pokazywać obiekt z OSM bez daty: galerie od lat 90., świątynie zawsze, reszta (funkcje współczesne) od 1950 r.
export const poiFrom = (kind: PoiKind) => (kind === 'mall' ? 2000 : kind === 'church' ? undefined : 1950)

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
