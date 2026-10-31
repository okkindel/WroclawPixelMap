// Przenosi stan (src/app/state.ts) na scenę: epoka, widoczność warstw, pora roku i rozmiar obrazu.
import { WALLS, type Epoch } from '../content/index.ts'
import { C } from '../engine/palette.ts'
import type { Season } from '../engine/sun.ts'
import { epochScene } from '../history/epochs.ts'
import { SINCE } from '../rules/milestones.ts'
import { centroid } from '../engine/geo.ts'
import { HistoryLayer, MASK } from '../world/history.ts'
import { type App, PIN_GROUPS } from './state.ts'

// Plan miasta pod epoką (gdy plany są włączone w menu).
const planOf = (state: App['state'], year: number) => (state.layers.plans ? HistoryLayer.planFor(year) : null)

export function applyEpoch({ city, state }: App, e: Epoch) {
  state.epoch = e
  if (state.epochState) city.scene.remove(state.epochState.extras)
  state.epochState = epochScene(e, city.world, WALLS)
  const plan = planOf(state, e.year)
  city.history.show(plan)
  // Budynki pod planem: w jego zasięgu budynek bez daty stoi tylko na zabudowie planu (nigdy w jego wodzie),
  // z datą tylko od roku budowy; poza zasięgiem planu reguły epoki (src/history/epochs.ts).
  const opts = state.epochState.opts
  if (plan) {
    const rule = opts.keep
    const Y = e.year
    opts.keep = (b, i) => {
      const v = city.history.maskAt(...centroid(b.o))
      if (v === undefined || v === MASK.outside) return rule ? rule(b, i) : true
      if (b.y) return b.y <= Y && v !== MASK.water
      return v === MASK.built
    }
  }
  // „dziś” = wygląd budowany w wątkach roboczych (bez filtrowania budynków)
  city.tiles.setBuildOpts(opts, e.mode === 'today' && e.year >= SINCE.today)
  city.scene.add(state.epochState.extras)
}

// Widoczność warstw: przełączniki w panelu i to, co istniało w roku epoki.
export function applyLayers({ city, state, labels }: App) {
  const { layers, life, scenes } = state
  const year = state.epoch.year
  // Dawny teren (przed lokacją i pod każdym planem): łąka zamiast dzisiejszych ulic, torów, mostów, placów i parków,
  // woda z planu zamiast dzisiejszej; zabudowę i ulice pokazuje plan. Wyłączone plany = dzisiejszy teren.
  const plan = planOf(state, year)
  const old = !!state.epochState?.wild || !!plan
  if (life) {
    life.layers.trams = layers.trams && !!state.epochState?.life.trams
    life.layers.trains = layers.trains && year >= SINCE.railway
    life.layers.cars = layers.cars && !!state.epochState?.life.cars
    // ludzie chodzą po dzisiejszych chodnikach: gdy zamiast nich jest łąka, chowamy ich
    life.layers.people = layers.people && !old
    life.layers.birds = layers.birds
    life.layers.clouds = layers.clouds
  }
  city.tiles.setTreesVisible(layers.trees)
  city.stands.visible = year >= SINCE.stadium
  if (scenes) scenes.boatsOn = layers.boats
  city.structures.setYear(year)
  city.tiles.setModernGround(!old)
  city.tiles.setWater(!plan)
  city.tiles.setLateWater(year >= SINCE.canals)
  // łąka zastępuje podkład terenu (dwie płaszczyzny 5 cm od siebie z daleka migotały w pola)
  city.meadow.visible = old
  city.base.visible = !old
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
