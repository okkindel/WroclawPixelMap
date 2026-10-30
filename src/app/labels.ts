// Napisy i znaczniki na mapie: zabytki, ciekawostki, neony, osiedla, obiekty z OSM i stadiony.
// Kolejność dodawania = pierwszeństwo przy nachodzeniu napisów (patrz Labels.update).
import { centroid, toLatLon, toLocal } from '../engine/geo.ts'
import { Labels } from '../layers/labels.ts'
import { NEONS, landmarkNames, type Egg, type Landmark, type Trivia } from '../content/index.ts'
import { lang, t } from '../i18n/index.ts'
import type { PoiKind, WorldMeta } from '../types/world.ts'
import { byId } from '../ui/dom.ts'
import { showEgg, showLandmark, showNeon, showPoi, showStadium, showTrivia } from './popups.ts'
import { POI_DEDUP_RADIUS, markerRule, poiLabel, sameName, stadiumLabel, uniTriviaLabel } from '../rules/labels.ts'

export function buildLabels(meta: WorldMeta, landmarks: Landmark[], rank: Record<string, 1 | 2>, eggs: Egg[], trivia: Trivia[]) {
  const labels = new Labels(byId('pins'), landmarks, rank, showLandmark)
  for (const e of eggs) labels.addMarker(e, markerRule(e.trigger, 'egg'), () => showEgg(e))

  for (const tr of trivia) {
    const onClick = () => showTrivia(tr)
    if (tr.category === 'uczelnia') labels.addLabel(tr.title, tr.lat, tr.lon, uniTriviaLabel, onClick)
    else labels.addMarker(tr, markerRule(tr.trigger, tr.category === 'kultowe' ? 'cult' : 'egg'), onClick)
  }

  // ciekawostki przy neonach (galeria przy Ruskiej, ns-*, jako jeden znacznik)
  for (const n of NEONS) {
    if (n.id.startsWith('ns-')) continue
    const L = lang()
    const egg: Egg = { id: `neon-${n.id}`, lat: n.lat, lon: n.lon, title: n.title[L], text: n.text[L], trigger: 'click' }
    labels.addMarker(egg, markerRule('click', 'neon', n.from), () => showNeon(n))
  }

  for (const [name, x, y, placeRank] of meta.places) labels.addPlace(name, x, y, placeRank)

  // rozpoznawalne obiekty z OSM (galerie, teatry, kościoły, obiekty z Wikidaty), bez dublowania zabytków z listy
  // zabytki z listy: pozycja i nazwa (do wykrywania duplikatów z OSM)
  const landmarkXY = landmarks.map((l) => [...toLocal(l.lat, l.lon), l.name] as const)
  // nazwy zabytków z listy (w obu językach): obiekt z OSM o takiej nazwie to ten sam zabytek
  const taken = landmarkNames()
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
    // ta sama nazwa co zabytek z listy, gdziekolwiek w mieście (np. inny fragment kampusu PWr), albo bliska nazwa w pobliżu
    if (taken.has(name) || landmarkXY.some(([lx, ly, n]) => Math.hypot(lx - x, ly - y) < POI_DEDUP_RADIUS && sameName(n, name))) continue
    const [lat, lon] = toLatLon(x, y)
    const rule = poiLabel(name, kind, poiRank, from)
    const sub = rule.school ? t('poi.school') : poiSub[kind]
    labels.addLabel(name, lat, lon, rule, () => showPoi(name, sub, wiki))
  }

  // stadion bez własnego napisu z OSM (napis z OSM jest widoczny z daleka i ma opis z Wikipedii)
  const poiNames = new Set(meta.pois.map((p) => p[0]))
  for (const st of meta.stadiums) {
    const name = st.n
    if (!name || poiNames.has(name)) continue
    const [lat, lon] = toLatLon(...centroid(st.o))
    labels.addLabel(name, lat, lon, stadiumLabel(name), () => showStadium(name))
  }
  return labels
}
