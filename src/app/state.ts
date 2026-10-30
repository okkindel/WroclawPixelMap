// Stan mapy zmieniany przez użytkownika: epoka, przełączniki warstw, pora dnia i roku, wielkość piksela.
import type { Epoch } from '../content/index.ts'
import type { Season } from '../engine/sun.ts'
import type { EpochScene } from '../history/epochs.ts'
import type { Life } from '../life/life.ts'
import { PIXEL_DEFAULT, PIXEL_MAX, PIXEL_MIN } from '../rules/render.ts'
import type { PinGroup } from '../rules/labels.ts'
import { SCENE_NAMES, type SceneName, type Scenes } from '../scenes/index.ts'
import { oneOf } from '../ui/dom.ts'
import { LAYERS, type Layer } from '../ui/panel.ts'
import type { Labels } from '../layers/labels.ts'
import type { City } from './city.ts'

// grupy znaczników (każda z własnym przełącznikiem, wszystkie pod głównym „markers”)
export const PIN_GROUPS: PinGroup[] = ['labels', 'places', 'pois', 'unis', 'eggs', 'cult']
// pora dnia na starcie: 14:00 (słońce wysoko, ale już z cieniami)
const DEFAULT_HOUR = 14 * 60

export interface State {
  epoch: Epoch
  epochState: EpochScene | null
  layers: Record<Layer, boolean>
  // godzina z suwaka (minuty od północy) albo „teraz”: zegar na żywo
  hour: number | 'now'
  season: Season
  px: number
  // ruch w mieście i scenki powstają dopiero, gdy wczytają się wszystkie kafle (potrzebują całej sieci ulic)
  life: Life | null
  scenes: Scenes | null
  // scenki włączone ręcznie z menu
  forcedScenes: Set<SceneName>
}

export function initialState(epoch: Epoch): State {
  // wszystkie warstwy włączone
  const layers = Object.fromEntries(LAYERS.map((l) => [l, true])) as Record<Layer, boolean>
  return {
    epoch,
    epochState: null,
    layers,
    hour: DEFAULT_HOUR,
    season: 'summer',
    px: storedPixel(),
    life: null,
    scenes: null,
    forcedScenes: forcedScenesFromMenu(),
  }
}

// Wielkość piksela wybrana suwakiem zapamiętana w przeglądarce (tryb oszczędny jej nie zmienia).
const PIXEL_STORE = 'wpm.pixel'
function storedPixel() {
  try {
    const v = Number(localStorage.getItem(PIXEL_STORE))
    if (v >= PIXEL_MIN && v <= PIXEL_MAX) return v
  } catch {
    /* tryb prywatny */
  }
  return PIXEL_DEFAULT
}
export function savePixel(v: number) {
  try {
    localStorage.setItem(PIXEL_STORE, String(v))
  } catch {
    /* tryb prywatny */
  }
}

// Scenki zaznaczone w menu (mecz i żużel domyślnie); zbiór śledzi późniejsze zmiany przełączników.
function forcedScenesFromMenu() {
  const forced = new Set<SceneName>()
  for (const i of document.querySelectorAll<HTMLInputElement>('input[data-scene]')) {
    const n = oneOf(SCENE_NAMES, i.dataset.scene)
    if (!n) continue
    if (i.checked) forced.add(n)
    i.addEventListener('change', () => {
      if (i.checked) forced.add(n)
      else forced.delete(n)
    })
  }
  return forced
}

// Całość dostępna dla modułów aplikacji: miasto 3D, stan i napisy.
export interface App {
  city: City
  state: State
  labels: Labels
}
