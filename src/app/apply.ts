// Przenosi stan (src/app/state.ts) na scenę: epoka, widoczność warstw, pora roku i rozmiar obrazu.
import { WALLS, type Epoch } from '../content/index.ts'
import { C } from '../engine/palette.ts'
import type { Season } from '../engine/sun.ts'
import { epochScene } from '../history/epochs.ts'
import { SINCE } from '../rules/milestones.ts'
import { HistoryLayer } from '../world/history.ts'
import { type App, PIN_GROUPS } from './state.ts'

export function applyEpoch({ city, state }: App, e: Epoch) {
  state.epoch = e
  if (state.epochState) city.scene.remove(state.epochState.extras)
  state.epochState = epochScene(e, city.world, WALLS)
  // „dziś” = wygląd budowany w wątkach roboczych (bez filtrowania budynków)
  city.tiles.setBuildOpts(state.epochState.opts, e.mode === 'today' && e.year >= SINCE.today)
  city.scene.add(state.epochState.extras)
}

// Widoczność warstw: przełączniki w panelu i to, co istniało w roku epoki.
export function applyLayers({ city, state, labels }: App) {
  const { layers, life, scenes } = state
  const year = state.epoch.year
  if (life) {
    life.layers.trams = layers.trams && !!state.epochState?.life.trams
    life.layers.trains = layers.trains && year >= SINCE.railway
    life.layers.cars = layers.cars && !!state.epochState?.life.cars
    life.layers.people = layers.people
    life.layers.birds = layers.birds
    life.layers.clouds = layers.clouds
  }
  city.tiles.setTreesVisible(layers.trees)
  city.stands.visible = year >= SINCE.stadium
  if (scenes) scenes.boatsOn = layers.boats
  city.structures.setYear(year)
  city.history.show(HistoryLayer.planFor(year))
  labels.year = year
  city.dwarfs.mesh.visible = layers.dwarfs && year >= SINCE.dwarfs
  for (const g of PIN_GROUPS) labels.show[g] = layers.markers && layers[g]
}

export function applySeason({ city, state }: App, s: Season) {
  state.season = s
  city.tiles.setTreePalette(s === 'autumn' ? C.treeAutumn : s === 'winter' ? C.treeWinter : C.tree)
  city.uniforms.uSnow.value = s === 'winter' ? 1 : 0
  city.roadUniforms.uSnow.value = s === 'winter' ? 0.35 : 0
}

// Render w niskiej rozdzielczości (okno / piksel), skalowany przez CSS.
export function resize({ city, state }: App) {
  const W = innerWidth,
    H = innerHeight
  const w = Math.ceil(W / state.px),
    h = Math.ceil(H / state.px)
  city.renderer.setSize(w, h, false)
  city.pixel.setSize(w, h)
  city.view.resize(W, H)
}
