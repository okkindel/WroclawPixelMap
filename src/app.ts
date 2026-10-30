// Składa mapę: miasto 3D (src/app/city.ts), stan, napisy, interfejs i pętlę rysowania; potem wczytuje kafle.
import { loadJson } from './engine/data.ts'
import { setOrigin, toLocal } from './engine/geo.ts'
import { epochs, landmarkRank, landmarks, eggs, t, trivia } from './i18n/index.ts'
import { Life } from './life/life.ts'
import { Scenes, type ScenesData } from './scenes/index.ts'
import type { WorldMeta } from './types/world.ts'
import { byId } from './ui/dom.ts'
import { applyLayers, applySeason, resize } from './app/apply.ts'
import { buildCity } from './app/city.ts'
import { initControls } from './app/controls.ts'
import { buildLabels } from './app/labels.ts'
import { startLoop } from './app/loop.ts'
import { type App, initialState } from './app/state.ts'

// widok startowy bez linku: Rynek
const START = { lat: 51.1099, lon: 17.0326 }

export async function startApp() {
  const meta = await loadJson<WorldMeta>('meta.json')
  if (!meta) throw new Error('brak public/data/meta.json (npm run bake)')
  setOrigin(meta.origin)

  const EPOCHS = epochs()
  const city = await buildCity(meta)
  const state = initialState(EPOCHS[EPOCHS.length - 1])
  const labels = buildLabels(meta, landmarks(), landmarkRank(), eggs(), trivia())
  const app: App = { city, state, labels }
  const { setEpoch } = initControls(app)

  // start: epoka z linku, pora roku, rozmiar i widok z linku (albo Rynek)
  const h = new URLSearchParams(location.hash.slice(1))
  setEpoch(EPOCHS.find((e) => e.id === h.get('e')) ?? state.epoch)
  applySeason(app, state.season)
  resize(app)
  const [sx, sy] = city.view.restore(h, toLocal(START.lat, START.lon))
  startLoop(app)

  // kafle od środka widoku; ruch w mieście i scenki dopiero na pełnych danych
  const progress = byId('progress')
  await city.tiles.load(sx, sy, (done, total) => {
    byId('loading').classList.add('done')
    progress.hidden = done === total
    progress.textContent = t('progress', { done, total })
  })
  const { world } = city
  state.life = new Life(world.roads, world.trams, world.rails, world.bounds, !!city.timetable)
  city.scene.add(state.life.group)
  // smaczki (jarmark, fajerwerki, statki, latarnik) potrzebują wczytanego miasta
  loadJson<ScenesData>('scenes.json').then((data) => {
    const scenes = new Scenes(world, data ?? undefined, meta.speedway)
    scenes.forced = state.forcedScenes
    state.scenes = scenes
    city.scene.add(scenes.group)
    applyLayers(app)
  })
  // przebuduj epokę na pełnych danych (powódź, dym, pas startowy potrzebują całego miasta)
  setEpoch(state.epoch)
  applySeason(app, state.season)
}
