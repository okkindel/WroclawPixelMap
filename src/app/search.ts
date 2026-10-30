// Pozycje wyszukiwarki: zabytki, ciekawostki, krasnale oraz ulice i budynki z OSM.
import { toLocal } from '../engine/geo.ts'
import type { Landmark, Trivia } from '../content/index.ts'
import { t } from '../i18n/index.ts'
import type { Dwarf, World } from '../types/world.ts'
import type { SearchItem } from '../ui/search.ts'
import { showLandmark, showTrivia } from './popups.ts'

export function searchItems(
  landmarks: Landmark[],
  trivia: Trivia[],
  dwarfs: Dwarf[],
  world: World,
  onDwarf: (i: number) => void,
): SearchItem[] {
  return [
    ...landmarks.map((l) => {
      const [x, y] = toLocal(l.lat, l.lon)
      return { name: l.name, kind: t('kind.zabytek'), x, y, onPick: () => showLandmark(l) }
    }),
    ...trivia.map((tr) => {
      const [x, y] = toLocal(tr.lat, tr.lon)
      const kind = t(`kind.${tr.category === 'miejsce' ? 'ciekawostka' : tr.category}`)
      return { name: tr.title, kind, x, y, onPick: () => showTrivia(tr) }
    }),
    ...dwarfs.map((d, i) => ({ name: d.n, kind: t('kind.krasnal'), x: d.x, y: d.y, onPick: () => onDwarf(i) })),
    ...world.named.map(([name, x, y, kind]) => ({ name, kind: t(`kind.${kind}`), x, y })),
  ]
}
