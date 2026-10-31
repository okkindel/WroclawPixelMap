// Interfejs wokół mapy: panel (pora, wygląd, warstwy), oś czasu, przyciski, link do widoku, klikanie,
// klawiatura, wyszukiwarka i kolekcja krasnali.
import type { Epoch } from '../content/index.ts'
import { clockFor, minutesOf } from '../engine/sun.ts'
import { dwarfFacts, eggs, epochs, landmarks, t, trivia } from '../i18n/index.ts'
import { byId } from '../ui/dom.ts'
import { initPanel, initTimeline, setDwarfCount, showEpoch, showHour } from '../ui/panel.ts'
import { toast } from '../ui/popup.ts'
import { initSearch } from '../ui/search.ts'
import { applyEpoch, applyLayers, applySeason, resize } from './apply.ts'
import { initKeys } from './keys.ts'
import { initPicking } from './picking.ts'
import { showDwarf, showEgg } from './popups.ts'
import { searchItems } from './search.ts'
import { type App, savePixel } from './state.ts'

export function initControls(app: App) {
  const { city, state, labels } = app
  const { view, dwarfs } = city

  // --- epoki ---
  const markEpoch = initTimeline(epochs(), (e) => setEpoch(e))
  function setEpoch(e: Epoch) {
    applyEpoch(app, e)
    showEpoch(e)
    markEpoch(e)
    applyLayers(app)
    saveHash()
  }

  // --- panel ---
  initPanel({
    time: (v) => {
      state.hour = v === 'now' ? 'now' : minutesOf(clockFor(v))
      state.hourSetAt = performance.now()
      showHour(state.hour === 'now' ? minutesOf(new Date()) : state.hour)
    },
    hour: (m) => {
      state.hour = m
      state.hourSetAt = performance.now()
    },
    season: (v) => applySeason(app, v),
    pixel: (v) => {
      state.px = v
      savePixel(v)
      resize(app)
    },
    look: (opt, on) => {
      const u = city.pixel.material.uniforms
      const uniform = { palette: u.uPalette, outline: u.uOutline, dither: u.uDither }[opt]
      uniform.value = on ? 1 : 0
    },
    layer: (l, on) => {
      state.layers[l] = on
      applyLayers(app)
    },
  })
  addEventListener('resize', () => resize(app))
  // suwak piksela pokazuje zapamiętaną wartość
  byId<HTMLInputElement>('pixel').value = String(state.px)
  byId('pixel-v').textContent = String(state.px)

  // --- wersja w oknie „O mapie” (vite.config.ts) ---
  const v = __APP_VERSION__
  byId('app-version').textContent = t('about.version', { v: [v.version, v.commit, v.date].filter(Boolean).join(' · ') })

  // --- kamera: obrót, kompas, link do widoku ---
  byId('btn-rot-l').onclick = () => view.rotate(-1)
  byId('btn-rot-r').onclick = () => view.rotate(1)
  // kompas przywraca domyślny widok: północ u góry i standardowe nachylenie
  byId('compass').onclick = () => view.resetNorth()
  function saveHash() {
    const p = new URLSearchParams({ e: state.epoch.id, ...view.hashParams() })
    history.replaceState(null, '', `#${p}`)
  }
  view.controls.addEventListener('end', saveHash)
  byId('btn-link').onclick = async () => {
    saveHash()
    try {
      await navigator.clipboard.writeText(location.href)
      toast(t('toast.linkCopied'))
    } catch {
      toast(location.href, 5000)
    }
  }

  // --- zrzut ekranu ---
  byId('btn-photo').onclick = () => {
    city.pixel.render(city.scene, city.camera)
    const a = document.createElement('a')
    a.href = city.canvas.toDataURL('image/png')
    a.download = `wroclaw-${state.epoch.year}.png`
    a.click()
  }

  // --- krasnale: kolekcja i okienko ---
  const facts = dwarfFacts()
  const updateDwarfCount = () => setDwarfCount(dwarfs.found.size, dwarfs.list.length)
  updateDwarfCount()
  function clickDwarf(i: number) {
    const { dwarf, isNew } = dwarfs.collect(i)
    updateDwarfCount()
    showDwarf(dwarf, facts)
    if (isNew) toast(t('toast.newDwarf', { n: dwarfs.found.size, total: dwarfs.list.length }))
    if (dwarfs.found.size === dwarfs.list.length) toast(t('toast.allDwarfs'), 6000)
  }

  // --- klikanie w mapę ---
  dwarfs.onOpen = clickDwarf
  city.tiles.openerFor = (n, x, y) => labels.openerFor(n, x, y)
  initPicking(city.canvas, city.camera, {
    // kolejność = pierwszeństwo (krasnal stoi przed budynkiem, tramwaj na ulicy pod napisem itd.)
    layers: () => [dwarfs, city.timetable, city.monuments, city.neons, state.scenes, city.tiles],
    highlight: city.pixel.highlight,
  })

  // --- skróty i easter eggi z klawiatury ---
  initKeys({
    rotate: (dir) => view.rotate(dir),
    konami: () => {
      const egg = eggs().find((e) => e.trigger === 'konami')
      if (egg) showEgg(egg)
      dwarfs.startParty()
    },
  })

  // --- wyszukiwarka ---
  initSearch(searchItems(landmarks(), trivia(), dwarfs.list, city.world, clickDwarf), (x, y) => view.fly(x, y))

  return { setEpoch }
}
