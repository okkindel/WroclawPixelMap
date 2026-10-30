// Składa mapę: scena, kamera, warstwy, epoki i interfejs (części w src/app/).
import * as THREE from 'three'
import { setOrigin, toLocal } from './engine/geo.ts'
import { C } from './engine/palette.ts'
import { PixelPass } from './engine/pixel.ts'
import { Sun, clockFor, type Season, type TimePreset } from './engine/sun.ts'
import { buildBase } from './world/ground.ts'
import { Tiles } from './world/tiles.ts'
import { buildStands } from './world/stadiums.ts'
import { Structures } from './world/structures.ts'
import { HistoryLayer } from './world/history.ts'
import { FOG_COLOR, buildCloudEdge } from './world/edge.ts'
import { Scenes, type SceneName } from './scenes/index.ts'
import { waterShader } from './world/water.ts'
import { windowShader } from './world/windows.ts'
import { Life, tramGeometry } from './life/life.ts'
import { Timetable } from './life/timetable.ts'
import { Dwarfs } from './layers/dwarfs.ts'
import { Neons } from './layers/neons.ts'
import { Monuments } from './layers/monuments.ts'
import type { PinGroup } from './layers/labels.ts'
import { WALLS, type Epoch } from './content/index.ts'
import { epochScene, type EpochScene } from './history/epochs.ts'
import { SINCE } from './history/milestones.ts'
import { dwarfFacts, eggs, epochs, landmarkRank, landmarks, t, trivia } from './i18n/index.ts'
import { initPanel, initTimeline, setClock, setCompass, setDwarfCount, showEpoch, type Layer } from './ui/panel.ts'
import { toast } from './ui/popup.ts'
import { initSearch } from './ui/search.ts'
import { byId } from './ui/dom.ts'
import type { WorldMeta } from './types/world.ts'
import { View } from './app/view.ts'
import { buildLabels } from './app/labels.ts'
import { initPicking } from './app/picking.ts'
import { wikiForBuilding } from './app/wiki.ts'
import { initKeys } from './app/keys.ts'
import { PowerSaver } from './app/saver.ts'
import { searchItems } from './app/search.ts'
import { showDwarf, showEgg } from './app/popups.ts'

// treści w wybranym języku (PL/EN)
const EPOCHS = epochs()
const LANDMARKS = landmarks()
const LANDMARK_RANK = landmarkRank()
const EGGS = eggs()
const TRIVIA = trivia()
const DWARF_FACTS = dwarfFacts()

// widok startowy bez linku: Rynek
const START = { lat: 51.1099, lon: 17.0326 }
// wielkość piksela: domyślna i największa, do której schodzi tryb oszczędny
const PIXEL_DEFAULT = 1.5
const PIXEL_SAVER_MAX = 3
const PIXEL_SAVER_STEP = 0.5
// daleko (zoom poniżej): ludzie, auta i drzewa są mniejsze niż piksel — nie liczymy ich i nie rysujemy
const FAR_ZOOM = 0.55
const TREES_MIN_ZOOM = 0.35
// cienie i napisy przeliczamy po zmianie widoku albo co tyle sekund (ruchome obiekty)
const SHADOW_REFRESH_S = 0.15
const LABELS_REFRESH_S = 0.5
const CLOCK_REFRESH_MS = 1000
const MAX_FRAME_DT = 0.1
// zasięg mapy cieni rośnie z kadrem, ale nie ponad tyle metrów
const SHADOW_EXTENT_MAX = 2600
// neony liczą rozmiar dla piksela ok. 2 — przeliczamy powiększenie na bieżący piksel
const NEON_PIXEL = 2
// pomniki chowamy z daleka (są mniejsze niż piksel)
const MONUMENTS_MIN_ZOOM = 0.3
// grupy znaczników (każda z własnym przełącznikiem, wszystkie pod głównym „markers”)
const PIN_GROUPS: PinGroup[] = ['labels', 'places', 'pois', 'unis', 'eggs', 'cult']

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`

export async function startApp() {
  const res = await fetch(dataUrl('meta.json'))
  const meta: WorldMeta = await res.json()
  setOrigin(meta.origin)

  const canvas = byId<HTMLCanvasElement>('map')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  // mapa cieni liczona tylko po zmianie widoku albo kilka razy na sekundę (auta i tramwaje) — zamiast co klatkę
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.type = THREE.PCFShadowMap
  const pixel = new PixelPass(renderer)

  const scene = new THREE.Scene()
  // za brzegiem mapy: mgła i pas chmur zamiast szarego tła
  scene.background = new THREE.Color(FOG_COLOR)
  scene.add(buildCloudEdge(meta.bounds))
  const view = new View(canvas)
  const camera = view.camera

  // --- świat statyczny ---
  const uniforms = { uNight: { value: 0 }, uSnow: { value: 0 } }
  const roadUniforms = { uNight: uniforms.uNight, uSnow: { value: 0 } }
  const uTime = { value: 0 }
  const lambert = () => new THREE.MeshLambertMaterial({ vertexColors: true })
  const groundMat = windowShader(lambert(), uniforms)
  const base = new THREE.Mesh(buildBase(meta.bounds), groundMat)
  scene.add(outsidePlane(meta.bounds))
  base.receiveShadow = true
  scene.add(base)
  const tiles = new Tiles(meta, {
    ground: groundMat,
    roads: windowShader(lambert(), roadUniforms),
    water: waterShader(lambert(), uTime),
    buildings: windowShader(lambert(), uniforms),
  })
  scene.add(tiles.group)
  const world = tiles.world

  // ruch w mieście powstaje dopiero, gdy wczytają się wszystkie kafle (potrzebuje całej sieci ulic)
  let life: Life | null = null
  let scenes: Scenes | null = null
  const forcedScenes = new Set<SceneName>()
  // stan początkowy z HTML (mecz i żużel włączone domyślnie)
  document.querySelectorAll<HTMLInputElement>('input[data-scene]').forEach((i) => { if (i.checked) forcedScenes.add(i.dataset.scene as SceneName) })
  document.querySelectorAll<HTMLInputElement>('input[data-scene]').forEach((i) => i.addEventListener('change', () => {
    const n = i.dataset.scene as SceneName
    if (i.checked) forcedScenes.add(n)
    else forcedScenes.delete(n)
  }))
  // rozkład tramwajów (GTFS MPK); brak pliku = tramwaje losowo po torach
  // tramwaje z rozkładu startują od razu, bez czekania na kafle
  let timetable: Timetable | null = null
  try {
    const r = await fetch(dataUrl('trams.json'))
    if (r.ok) {
      timetable = new Timetable(await r.json(), tramGeometry())
      scene.add(timetable.mesh)
    }
  } catch { /* brak rozkładu */ }

  const stands = buildStands(meta.stadiums)
  scene.add(stands)
  const structures = new Structures(meta.structures, meta.aerialways)
  scene.add(structures.group)
  const historyLayer = new HistoryLayer(meta)
  scene.add(historyLayer.group)
  const neons = new Neons()
  scene.add(neons.group)
  // pomniki (scripts/bake-monuments.ts); brak pliku = brak warstwy
  let monuments: Monuments | null = null
  try {
    const r = await fetch(dataUrl('monuments.json'))
    if (r.ok) {
      monuments = new Monuments(await r.json())
      scene.add(monuments.group)
    }
  } catch { /* brak pomników */ }

  const dwarfs = new Dwarfs(meta.dwarfs)
  scene.add(dwarfs.mesh)
  const updateDwarfCount = () => setDwarfCount(dwarfs.found.size, dwarfs.list.length)
  updateDwarfCount()

  const sun = new Sun(scene)

  // --- epoki i warstwy ---
  let epoch: Epoch = EPOCHS[EPOCHS.length - 1]
  let epochState: EpochScene | null = null
  const layers: Record<Layer, boolean> = {
    dwarfs: true, neons: true, monuments: true, trams: true, trains: true, boats: true, cars: true,
    people: true, birds: true, clouds: true, trees: true,
    markers: true, labels: true, places: true, pois: true, unis: true, eggs: true, cult: true,
  }

  const markEpoch = initTimeline(EPOCHS, (e) => setEpoch(e))
  function setEpoch(e: Epoch) {
    epoch = e
    if (epochState) scene.remove(epochState.extras)
    epochState = epochScene(e, world, WALLS)
    // „dziś” = wygląd budowany w wątkach roboczych (bez filtrowania budynków)
    tiles.setBuildOpts(epochState.opts, e.mode === 'today' && e.year >= SINCE.today)
    scene.add(epochState.extras)
    showEpoch(e)
    markEpoch(e)
    applyLayers()
    saveHash()
  }

  // Widoczność warstw: przełączniki w panelu i to, co istniało w roku epoki.
  function applyLayers() {
    const year = epoch.year
    if (life) {
      life.layers.trams = layers.trams && !!epochState?.life.trams
      life.layers.trains = layers.trains && year >= SINCE.railway
      life.layers.cars = layers.cars && !!epochState?.life.cars
      life.layers.people = layers.people
      life.layers.birds = layers.birds
      life.layers.clouds = layers.clouds
    }
    tiles.setTreesVisible(layers.trees)
    stands.visible = year >= SINCE.stadium
    if (scenes) scenes.boatsOn = layers.boats
    structures.setYear(year)
    historyLayer.show(HistoryLayer.planFor(year))
    labels.year = year
    dwarfs.mesh.visible = layers.dwarfs && year >= SINCE.dwarfs
    for (const g of PIN_GROUPS) labels.show[g] = layers.markers && layers[g]
  }

  // --- napisy i ciekawostki ---
  const labels = buildLabels(meta, LANDMARKS, LANDMARK_RANK, EGGS, TRIVIA)

  // --- czas i pory roku ---
  let timePreset: TimePreset = 'now'
  let season: Season = 'summer'
  const setSeason = (s: Season) => {
    season = s
    tiles.setTreePalette(s === 'autumn' ? C.treeAutumn : s === 'winter' ? C.treeWinter : C.tree)
    uniforms.uSnow.value = s === 'winter' ? 1 : 0
    roadUniforms.uSnow.value = s === 'winter' ? 0.35 : 0
  }

  // --- piksel i rozmiar ---
  let px = PIXEL_DEFAULT
  function resize() {
    const W = innerWidth, H = innerHeight
    const w = Math.ceil(W / px), h = Math.ceil(H / px)
    renderer.setSize(w, h, false)
    pixel.setSize(w, h)
    view.resize(W, H)
  }
  addEventListener('resize', resize)

  initPanel({
    time: (v) => (timePreset = v as TimePreset),
    season: (v) => setSeason(v as Season),
    pixel: (v) => { px = v; resize() },
    look: (opt, on) => {
      const u = pixel.material.uniforms
      const uniform = { palette: u.uPalette, outline: u.uOutline, dither: u.uDither }[opt]
      uniform.value = on ? 1 : 0
    },
    layer: (l, on) => { layers[l] = on; applyLayers() },
  })

  // --- kamera: obrót, kompas, link ---
  byId('btn-rot-l').onclick = () => view.rotate(-1)
  byId('btn-rot-r').onclick = () => view.rotate(1)
  // kompas przywraca domyślny widok: północ u góry i standardowe nachylenie
  byId('compass').onclick = () => view.resetNorth()

  function saveHash() {
    const p = new URLSearchParams({ e: epoch.id, ...view.hashParams() })
    history.replaceState(null, '', '#' + p)
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

  // --- kliknięcia: krasnale i budynki ---
  function clickDwarf(i: number) {
    const { dwarf, isNew } = dwarfs.collect(i)
    updateDwarfCount()
    showDwarf(dwarf, DWARF_FACTS)
    if (isNew) toast(t('toast.newDwarf', { n: dwarfs.found.size, total: dwarfs.list.length }))
    if (dwarfs.found.size === dwarfs.list.length) toast(t('toast.allDwarfs'), 6000)
  }
  initPicking(canvas, camera, { dwarfs, timetable, monuments, neons, tiles, scenes: () => scenes, onDwarf: clickDwarf, highlight: pixel.highlight, wikiFor: (n, x, y) => wikiForBuilding(meta, n, x, y) })

  // --- skróty i easter eggi z klawiatury ---
  initKeys({
    rotate: (dir) => view.rotate(dir),
    konami: () => {
      const egg = EGGS.find((e) => e.trigger === 'konami')
      if (egg) showEgg(egg)
      dwarfs.startParty()
    },
  })

  // --- zrzut ekranu ---
  byId('btn-photo').onclick = () => {
    pixel.render(scene, camera)
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `wroclaw-${epoch.year}.png`
    a.click()
  }

  // --- wyszukiwarka ---
  initSearch(searchItems(LANDMARKS, TRIVIA, dwarfs.list, world, clickDwarf), (x, y) => view.fly(x, y))

  // --- start ---
  const h = new URLSearchParams(location.hash.slice(1))
  setEpoch(EPOCHS.find((e) => e.id === h.get('e')) ?? epoch)
  setSeason(season)
  resize()
  const [sx, sy] = view.restore(h, toLocal(START.lat, START.lon))
  const progress = byId('progress')
  tiles
    .load(sx, sy, (done, total) => {
      byId('loading').classList.add('done')
      progress.hidden = done === total
      progress.textContent = t('progress', { done, total })
    })
    .then(() => {
      life = new Life(world.roads, world.trams, world.rails, world.bounds, !!timetable)
      scene.add(life.group)
      // smaczki (jarmark, fajerwerki, statki, latarnik) potrzebują wczytanego miasta
      fetch(dataUrl('scenes.json'))
        .then((r) => (r.ok ? r.json() : undefined))
        .catch(() => undefined)
        .then((data) => {
          scenes = new Scenes(world, data, meta.speedway)
          scenes.forced = forcedScenes
          scenes.boatsOn = layers.boats
          scene.add(scenes.group)
        })
      // przebuduj epokę na pełnych danych (powódź, dym, pas startowy potrzebują całego miasta)
      setEpoch(epoch)
      setSeason(season)
    })

  // Tryb oszczędny: najpierw większy piksel, potem bez cieni.
  const saver = new PowerSaver([
    () => {
      if (px >= PIXEL_SAVER_MAX) return false
      px = Math.min(PIXEL_SAVER_MAX, px + PIXEL_SAVER_STEP)
      resize()
      toast(t('saver.pixel'))
      return true
    },
    () => {
      renderer.shadowMap.enabled = false
      // materiały trzeba przekompilować bez cieni
      scene.traverse((o) => {
        const material = (o as Partial<THREE.Mesh>).material as THREE.Material | undefined
        if (material) material.needsUpdate = true
      })
      toast(t('saver.shadows'))
      return true
    },
  ])

  const clock = new THREE.Clock()
  let lastSig = '', sinceShadow = 1, sinceLabels = 1
  let lastClock = 0
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), MAX_FRAME_DT)
    view.controls.update()
    view.keepInside(world.bounds)

    const now = clockFor(timePreset)
    const extent = Math.max(innerWidth, innerHeight) / camera.zoom
    sun.set(now, view.target, Math.min(extent * 0.9, SHADOW_EXTENT_MAX))
    uniforms.uNight.value = sun.night
    pixel.material.uniforms.uNight.value = sun.night
    uTime.value += dt
    // metry na piksel renderu (do progu konturów)
    pixel.material.uniforms.uMpp.value = px / camera.zoom
    if (performance.now() - lastClock > CLOCK_REFRESH_MS) { setClock(now); lastClock = performance.now() }

    const far = camera.zoom < FAR_ZOOM
    if (life) {
      life.group.visible = !far
      if (life.group.visible) life.update(dt)
    }
    tiles.setTreesVisible(layers.trees && camera.zoom > TREES_MIN_ZOOM)
    tiles.setZoom(camera.zoom)
    saver.tick(dt)
    if (timetable) {
      timetable.mesh.visible = layers.trams && epoch.year >= SINCE.trams
      if (timetable.mesh.visible) timetable.update(now)
    }
    dwarfs.setZoom(px / camera.zoom)
    dwarfs.update(dt)
    epochState?.update(dt)
    structures.update(dt)
    if (monuments) {
      monuments.group.visible = layers.monuments && camera.zoom > MONUMENTS_MIN_ZOOM
      if (monuments.group.visible) monuments.update(dt, epoch.year)
    }
    neons.group.visible = layers.neons
    if (neons.group.visible) neons.update(dt, sun.night, epoch.year, (camera.zoom * NEON_PIXEL) / px)
    scenes?.update(dt, now, epoch.year, sun.night)
    pixel.render(scene, camera)

    // napisy i cienie przeliczamy, gdy widok się zmienił (albo co jakiś czas dla ruchomych obiektów)
    const p = camera.position
    const sig = [
      p.x.toFixed(1), p.y.toFixed(1), p.z.toFixed(1), camera.zoom.toFixed(3),
      innerWidth, innerHeight, epoch.year, ...PIN_GROUPS.map((g) => labels.show[g]),
    ].join()
    const moved = sig !== lastSig
    lastSig = sig
    sinceShadow += dt
    sinceLabels += dt
    if (moved || sinceShadow > SHADOW_REFRESH_S) { renderer.shadowMap.needsUpdate = true; sinceShadow = 0 }
    if (moved || sinceLabels > LABELS_REFRESH_S) { labels.update(camera, innerWidth, innerHeight); sinceLabels = 0 }
    setCompass(view.azimuth)
  })
}

// Poza obszarem danych: płaska, nieoświetlona płaszczyzna w kolorze tła (pod wałem chmur).
function outsidePlane([bx0, by0, bx1, by1]: WorldMeta['bounds']) {
  const margin = 30000
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(bx1 - bx0 + margin, by1 - by0 + margin),
    new THREE.MeshBasicMaterial({ color: FOG_COLOR }),
  )
  plane.rotation.x = -Math.PI / 2
  plane.position.set((bx0 + bx1) / 2, -0.3, -(by0 + by1) / 2)
  return plane
}
