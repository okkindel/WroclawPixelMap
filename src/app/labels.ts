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
import { CULT_FROM, POI_DEDUP_RADIUS, STADIUM_MIN_ZOOM, UNI_TRIVIA_MIN_ZOOM, poiFrom, poiLabelRule, sameName } from '../rules/labels.ts'
import { wikiInfo } from './wiki.ts'

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
  // zabytki z listy: pozycja i nazwa (do wykrywania duplikatów z OSM)
  const landmarkXY = landmarks.map((l) => [...toLocal(l.lat, l.lon), l.name] as const)
  const poiSub: Record<PoiKind, string> = {
    mall: t('poi.mall'),
    culture: t('poi.culture'),
    church: t('poi.church'),
    edu: t('poi.edu'),
    health: t('poi.health'),
    sport: t('poi.sport'),
    notable: t('poi.notable'),
  }
  for (const [name, x, y, kind, poiRank, wiki, from] of meta.pois) {
    // duplikat zabytku z listy (src/rules/labels.ts)
    if (landmarkXY.some(([lx, ly, n]) => Math.hypot(lx - x, ly - y) < POI_DEDUP_RADIUS && sameName(n, name))) continue
    const [lat, lon] = toLatLon(x, y)
    const church = kind === 'church'
    const { minZoom, university, school } = poiLabelRule(name, kind, poiRank)
    const sub = school ? t('poi.school') : poiSub[kind]
    // opis i zdjęcie z Wikipedii (public/data/wiki.json), jeśli są; wczytywane leniwie przy pierwszym kliknięciu
    const onClick = async () => openPopup({ title: name, sub, ...(await wikiInfo(wiki ?? undefined)) })
    // uczelnie i szkoły jak napisy uczelni z ciekawostek (niebieskie, z czapką)
    const cls = church ? 'poi church' : kind === 'edu' ? 'uni' : `poi poi-${kind}`
    labels.addLabel(name, lat, lon, minZoom, onClick, cls, from ?? poiFrom(kind), university ? 'unis' : 'pois')
  }

  for (const st of meta.stadiums) {
    const name = st.n
    if (!name) continue
    const [lat, lon] = toLatLon(...centroid(st.o))
    labels.addLabel(name, lat, lon, STADIUM_MIN_ZOOM, () => openPopup({ title: name, sub: t('sub.stadium') }))
  }
  return labels
}
