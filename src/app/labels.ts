// Napisy i znaczniki na mapie: zabytki, ciekawostki, neony, osiedla, obiekty z OSM i stadiony.
// Kolejność dodawania = pierwszeństwo przy nachodzeniu napisów (patrz Labels.update).
import { centroid, toLatLon, toLocal } from '../engine/geo.ts'
import { Labels } from '../layers/labels.ts'
import { NEONS, type Egg, type Landmark, type Trivia } from '../content/index.ts'
import { lang, t } from '../i18n/index.ts'
import type { PoiKind, WorldMeta } from '../types/world.ts'
import { openPopup } from '../ui/popup.ts'
import { byId } from '../ui/dom.ts'
import { showEgg, showLandmark, showNeon, showTrivia } from './popups.ts'
import { wikiInfo } from './wiki.ts'

// minimalne przybliżenie, od którego widać napis
// (z daleka widać główny napis uczelni; ciekawostki o uczelniach i jej jednostki dopiero z bliska)
const UNI_TRIVIA_MIN_ZOOM = 1.8
const STADIUM_MIN_ZOOM = 0.8
const POI_MIN_ZOOM = { church: 1.5, famous: 0.3, other: 1.2, unit: 2.2, school: 1.5 }
// kultowe miejsca (★) to głównie PRL i później
const CULT_FROM = 1950
// obiekt z OSM bliżej zabytku z listy niż tyle metrów to ten sam obiekt (bez dublowania napisu)
const POI_DEDUP_RADIUS = 150
// pierwsze słowo nazwy bez polskich znaków, małymi literami
const firstWord = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[\s(]/)[0]

// Od kiedy pokazywać obiekt z OSM bez daty: galerie od lat 90., świątynie zawsze,
// reszta (funkcje współczesne) od 1950 r.
const poiFrom = (kind: PoiKind) => (kind === 'mall' ? 1995 : kind === 'church' ? undefined : 1950)

// Jednostki uczelni i podobne obiekty (wydziały, instytuty, kampusy…): tłok napisów na kampusach.
const UNIT = /Wydział|Instytut|Katedra|Zakład|Pracownia|Laboratorium|Biblioteka Główna|Centrum Kształcenia|Kampus/i
// Główny napis uczelni (kind 'edu', nie jednostka): zawsze widoczny z daleka.
const UNIVERSITY = /^(Uniwersytet|Politechnika|Akademia|Szkoła Wyższa|Wyższa Szkoła)/i

// obiekt 'edu', który jest szkołą, a nie uczelnią: tylko z bliska, z podtytułem „Szkoła”
const SCHOOL = /Liceum|Szkoła|Technikum|Gimnazjum|Zespół Szkół/i


export function buildLabels(meta: WorldMeta, landmarks: Landmark[], rank: Record<string, 1 | 2>, eggs: Egg[], trivia: Trivia[]) {
  const labels = new Labels(byId('pins'), landmarks, rank, showLandmark)
  for (const e of eggs) labels.addMarker(e, () => showEgg(e))

  for (const tr of trivia) {
    const onClick = () => showTrivia(tr)
    if (tr.category === 'uczelnia') labels.addLabel(tr.title, tr.lat, tr.lon, UNI_TRIVIA_MIN_ZOOM, onClick, 'uni', undefined, 'unis')
    else if (tr.category === 'kultowe') labels.addMarker(tr, onClick, '', 'cult', CULT_FROM, 'cult')
    else labels.addMarker(tr, onClick)
  }

  // ciekawostki przy neonach (galeria przy Ruskiej, ns-*, jako jeden znacznik)
  for (const n of NEONS) {
    if (n.id.startsWith('ns-')) continue
    const L = lang()
    const egg: Egg = { id: `neon-${n.id}`, lat: n.lat, lon: n.lon, title: n.title[L], text: n.text[L], trigger: 'click' }
    labels.addMarker(egg, () => showNeon(n), '?', 'neon', n.from)
  }

  for (const [name, x, y, placeRank] of meta.places) labels.addPlace(name, x, y, placeRank)

  // rozpoznawalne obiekty z OSM (galerie, teatry, kościoły, obiekty z Wikidaty), bez dublowania zabytków z listy
  // zabytki z listy: pozycja i pierwsze znaczące słowo nazwy (do wykrywania duplikatów z OSM)
  const landmarkXY = landmarks.map((l) => [...toLocal(l.lat, l.lon), firstWord(l.name)] as const)
  const poiSub: Record<PoiKind, string> = {
    mall: t('poi.mall'),
    culture: t('poi.culture'),
    church: t('poi.church'),
    edu: t('poi.edu'),
    health: t('poi.health'),
    sport: t('poi.sport'),
    notable: t('poi.notable'),
  }
  for (const [name, x, y, kind, poiRank, wiki] of meta.pois) {
    // duplikat = blisko zabytku z listy i ta sama nazwa (np. „Hala Targowa”), a nie tylko sąsiad („Pasaż Grunwaldzki” obok „Plac Grunwaldzki”)
    if (landmarkXY.some(([lx, ly, w]) => Math.hypot(lx - x, ly - y) < POI_DEDUP_RADIUS && w === firstWord(name))) continue
    const [lat, lon] = toLatLon(x, y)
    const church = kind === 'church'
    // (świątynie pomijamy: „Katedra” to tu kościół, nie katedra uczelni)
    const unit = !church && UNIT.test(name)
    const university = !unit && kind === 'edu' && UNIVERSITY.test(name)
    const school = kind === 'edu' && !university && SCHOOL.test(name)
    const minZoom = unit ? POI_MIN_ZOOM.unit
      : school ? POI_MIN_ZOOM.school
      : church ? POI_MIN_ZOOM.church
      : poiRank === 1 || university ? POI_MIN_ZOOM.famous
      : POI_MIN_ZOOM.other
    const sub = school ? t('poi.school') : poiSub[kind]
    // opis i zdjęcie z Wikipedii (public/data/wiki.json), jeśli są; wczytywane leniwie przy pierwszym kliknięciu
    const onClick = async () => openPopup({ title: name, sub, ...(await wikiInfo(wiki)) })
    // uczelnie i szkoły jak napisy uczelni z ciekawostek (niebieskie, z czapką)
    const cls = church ? 'poi church' : kind === 'edu' ? 'uni' : `poi poi-${kind}`
    labels.addLabel(name, lat, lon, minZoom, onClick, cls, poiFrom(kind), university ? 'unis' : 'pois')
  }

  for (const st of meta.stadiums) {
    const name = st.n
    if (!name) continue
    const [lat, lon] = toLatLon(...centroid(st.o))
    labels.addLabel(name, lat, lon, STADIUM_MIN_ZOOM, () => openPopup({ title: name, sub: t('sub.stadium') }))
  }
  return labels
}
