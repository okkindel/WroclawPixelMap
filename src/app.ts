// Składa mapę: scena, kamera, warstwy, epoki i interfejs.
import * as THREE from 'three'
import { MapControls } from 'three/addons/controls/MapControls.js'
import { centroid, setOrigin, toLatLon, toLocal } from './engine/geo.ts'
import { C } from './engine/palette.ts'
import { PixelPass } from './engine/pixel.ts'
import { Sun, clockFor, type Season, type TimePreset } from './engine/sun.ts'
import { buildBase } from './world/ground.ts'
import { Tiles } from './world/tiles.ts'
import { buildStands } from './world/stadiums.ts'
import { Structures } from './world/structures.ts'
import { waterShader } from './world/water.ts'
import { windowShader } from './world/windows.ts'
import { Life, tramGeometry } from './life/life.ts'
import { Timetable } from './life/timetable.ts'
import { Dwarfs } from './layers/dwarfs.ts'
import { Labels } from './layers/labels.ts'
import { Speedway } from './layers/speedway.ts'
import { DWARF_FACTS, EGGS, EPOCHS, LANDMARK_RANK, LANDMARKS, WALLS, type Egg, type Epoch } from './history/content.ts'
import { epochScene, type EpochScene } from './history/epochs.ts'
import { TRIVIA, type Trivia } from './history/trivia.ts'
import { initPanel, initTimeline, setClock, setCompass, setDwarfCount, showEpoch, type Layer } from './ui/panel.ts'
import { openPopup, toast } from './ui/popup.ts'
import { initSearch, type SearchItem } from './ui/search.ts'
import type { WorldMeta } from './types/world.ts'

const DEFAULT_TILT = 0.75
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

export async function startApp() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/meta.json`)
  const meta: WorldMeta = await res.json()
  setOrigin(meta.origin)

  const canvas = document.getElementById('map') as HTMLCanvasElement
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const pixel = new PixelPass(renderer)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(C.groundOut as string)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000)
  const controls = new MapControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.12
  controls.minZoom = 0.25
  controls.maxZoom = 12
  controls.maxPolarAngle = 1.0
  controls.zoomToCursor = true
  controls.listenToKeyEvents(window)

  // --- świat statyczny ---
  const uniforms = { uNight: { value: 0 }, uSnow: { value: 0 } }
  const roadUniforms = { uNight: uniforms.uNight, uSnow: { value: 0 } }
  const uTime = { value: 0 }
  const lambert = () => new THREE.MeshLambertMaterial({ vertexColors: true })
  const groundMat = windowShader(lambert(), uniforms)
  const base = new THREE.Mesh(buildBase(meta.bounds), groundMat)
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
  // rozkład tramwajów (GTFS MPK); brak pliku = tramwaje losowo po torach
  // tramwaje z rozkładu startują od razu, bez czekania na kafle
  let timetable: Timetable | null = null
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/trams.json`)
    if (r.ok) {
      timetable = new Timetable(await r.json(), tramGeometry())
      scene.add(timetable.mesh)
    }
  } catch { /* brak rozkładu */ }

  // trybuny (i żużel) dopiero od otwarcia Stadionu Olimpijskiego w 1928 r.
  const stands = buildStands(meta.stadiums)
  scene.add(stands)
  const structures = new Structures(meta.structures, meta.aerialways)
  scene.add(structures.group)
  const speedway = meta.speedway ? new Speedway(meta.speedway) : null
  if (speedway) scene.add(speedway.group)

  const dwarfs = new Dwarfs(meta.dwarfs)
  scene.add(dwarfs.mesh)
  const updateDwarfCount = () => setDwarfCount(dwarfs.found.size, dwarfs.list.length)
  updateDwarfCount()

  const sun = new Sun(scene)

  // --- epoki ---
  let epoch: Epoch = EPOCHS[EPOCHS.length - 1]
  let epochState: EpochScene | null = null
  const layers: Record<Layer, boolean> = { dwarfs: true, trams: true, trains: true, cars: true, people: true, birds: true, clouds: true, trees: true, labels: true, eggs: true }

  const markEpoch = initTimeline(EPOCHS, (e) => setEpoch(e))
  function setEpoch(e: Epoch) {
    epoch = e
    if (epochState) scene.remove(epochState.extras)
    epochState = epochScene(e, world, WALLS)
    // „dziś” = wygląd budowany w wątkach roboczych (bez filtrowania budynków)
    tiles.setBuildOpts(epochState.opts, e.mode === 'today' && e.year >= 2020)
    scene.add(epochState.extras)
    showEpoch(e)
    markEpoch(e)
    applyLayers()
    saveHash()
  }

  function applyLayers() {
    const modern = epoch.year >= 2001
    if (life) {
      life.layers.trams = layers.trams && !!epochState?.life.trams
      // kolej dotarła do Wrocławia w 1842 r.
      life.layers.trains = layers.trains && epoch.year >= 1842
      life.layers.cars = layers.cars && !!epochState?.life.cars
      life.layers.people = layers.people
      life.layers.birds = layers.birds
      life.layers.clouds = layers.clouds
    }
    tiles.setTreesVisible(layers.trees)
    stands.visible = epoch.year >= 1928
    structures.setYear(epoch.year)
    labels.year = epoch.year
    // pierwszy krasnal stanął w 2001 r.
    dwarfs.mesh.visible = layers.dwarfs && modern
    labels.showLabels = layers.labels
    labels.showEggs = layers.eggs
  }

  // --- napisy i ciekawostki ---
  const showEgg = (e: Egg) => openPopup({ title: e.title, text: e.text, sub: 'Ciekawostka' })
  const labels = new Labels(document.getElementById('pins')!, LANDMARKS, LANDMARK_RANK, (l) => openPopup({ title: l.name, sub: l.year, text: l.text }))
  for (const e of EGGS) labels.addMarker(e, () => showEgg(e))
  const showTrivia = (t: Trivia) =>
    openPopup({ title: t.title, sub: { miejsce: 'Ciekawostka', uczelnia: 'Uczelnia', kultowe: 'Kultowe miejsce' }[t.category], text: t.text, link: { href: t.source, label: 'Źródło' } })
  for (const t of TRIVIA) {
    if (t.category === 'uczelnia') labels.addLabel(t.title, t.lat, t.lon, 0.9, () => showTrivia(t), 'uni')
    else if (t.category === 'kultowe') labels.addMarker(t, () => showTrivia(t), '', 'cult', 1945)
    else labels.addMarker(t, () => showTrivia(t))
  }
  for (const [name, x, y, rank] of meta.places) labels.addPlace(name, x, y, rank)
  // rozpoznawalne obiekty z OSM (galerie, teatry, kościoły, obiekty z Wikidaty), bez dublowania zabytków z listy
  const landmarkXY = LANDMARKS.map((l) => toLocal(l.lat, l.lon))
  const POI_SUB = { mall: 'Galeria handlowa', culture: 'Kultura', church: 'Świątynia', edu: 'Uczelnia', health: 'Szpital', sport: 'Sport', notable: 'Ciekawe miejsce' }
  for (const [name, x, y, kind, rank] of meta.pois) {
    if (landmarkXY.some(([lx, ly]) => Math.hypot(lx - x, ly - y) < 150)) continue
    const [lat, lon] = toLatLon(x, y)
    // bez daty w OSM: galerie od lat 90., świątynie zawsze, reszta (funkcje współczesne) od 1945 r.
    const from = kind === 'mall' ? 1995 : kind === 'church' ? undefined : 1945
    labels.addLabel(name, lat, lon, kind === 'church' ? 1.5 : rank === 1 ? 0.3 : 1.2, () => openPopup({ title: name, sub: POI_SUB[kind] }), kind === 'church' ? 'poi church' : `poi poi-${kind}`, from)
  }
  for (const st of meta.stadiums) {
    if (!st.n) continue
    const [lat, lon] = toLatLon(...centroid(st.o))
    labels.addLabel(st.n, lat, lon, 0.8, () => openPopup({ title: st.n!, sub: 'Stadion' }))
  }

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
  let px = 2
  function resize() {
    const W = innerWidth, H = innerHeight
    const w = Math.ceil(W / px), h = Math.ceil(H / px)
    renderer.setSize(w, h, false)
    pixel.setSize(w, h)
    camera.left = -W / 2
    camera.right = W / 2
    camera.top = H / 2
    camera.bottom = -H / 2
    camera.updateProjectionMatrix()
  }
  addEventListener('resize', resize)

  initPanel({
    time: (v) => (timePreset = v as TimePreset),
    season: (v) => setSeason(v as Season),
    pixel: (v) => { px = v; resize() },
    look: (opt, on) => {
      const u = pixel.material.uniforms
      ;({ palette: u.uPalette, outline: u.uOutline, dither: u.uDither })[opt].value = on ? 1 : 0
    },
    layer: (l, on) => { layers[l] = on; applyLayers() },
  })

  // --- kamera: start, obrót, link ---
  const target = controls.target
  function setView(x: number, y: number, zoom: number, azimuth: number, polar = 0.75) {
    target.set(x, 0, -y)
    const d = 3000
    camera.position.set(x + Math.sin(azimuth) * Math.sin(polar) * d, Math.cos(polar) * d, -y + Math.cos(azimuth) * Math.sin(polar) * d)
    camera.zoom = zoom
    camera.updateProjectionMatrix()
    controls.update()
  }
  function fly(x: number, y: number) {
    setView(x, y, Math.max(camera.zoom, 2.5), controls.getAzimuthalAngle(), controls.getPolarAngle())
  }
  function rotate(by: number) {
    setView(target.x, -target.z, camera.zoom, controls.getAzimuthalAngle() + by, controls.getPolarAngle())
  }
  document.getElementById('btn-rot-l')!.onclick = () => rotate(-Math.PI / 4)
  document.getElementById('btn-rot-r')!.onclick = () => rotate(Math.PI / 4)
  // kompas przywraca domyślny widok: północ u góry i standardowe nachylenie
  document.getElementById('compass')!.onclick = () => setView(target.x, -target.z, camera.zoom, 0, DEFAULT_TILT)

  function saveHash() {
    const p = new URLSearchParams({
      e: epoch.id,
      x: target.x.toFixed(0),
      y: (-target.z).toFixed(0),
      z: camera.zoom.toFixed(2),
      r: controls.getAzimuthalAngle().toFixed(2),
      t: controls.getPolarAngle().toFixed(2),
    })
    history.replaceState(null, '', '#' + p)
  }
  controls.addEventListener('end', saveHash)
  document.getElementById('btn-link')!.onclick = async () => {
    saveHash()
    try { await navigator.clipboard.writeText(location.href); toast('Link skopiowany') } catch { toast(location.href, 5000) }
  }

  // --- kliknięcia: krasnale i budynki ---
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const pointer = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
  }
  let downAt = [0, 0]
  canvas.addEventListener('pointerdown', (ev) => (downAt = [ev.clientX, ev.clientY]))
  canvas.addEventListener('pointerup', (ev) => {
    if (Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 5) return
    pointer(ev)
    if (dwarfs.mesh.visible) {
      const hit = ray.intersectObject(dwarfs.mesh)[0]
      if (hit?.instanceId != null) return clickDwarf(hit.instanceId)
    }
    if (timetable?.mesh.visible) {
      const tram = ray.intersectObject(timetable.mesh)[0]
      const info = tram?.instanceId != null ? timetable.describe(tram.instanceId) : null
      if (info) return openPopup({ title: `Tramwaj linii ${info.line}`, sub: `kierunek: ${info.head}`, text: `Kurs ${info.dep}–${info.arr} według rozkładu MPK Wrocław.` })
    }
    if (speedway?.hit(ray)) {
      return openPopup({
        title: 'Żużel na Olimpijskim',
        sub: 'Ciekawostka',
        text: 'Na Stadionie Olimpijskim ścigają się żużlowcy Sparty Wrocław. Cztery okrążenia, same lewe zakręty i motocykle bez hamulców: zwalnia się, kładąc maszynę w łuk.',
      })
    }
    const b = tiles.pick(ray)
    {
      if (b?.n) openPopup({ title: b.n, sub: [b.y && `zbudowany ${b.y}`, `${Math.round(b.H)} m`].filter(Boolean).join(' · ') })
    }
  })
  let hoverTick = 0
  canvas.addEventListener('pointermove', (ev) => {
    if (!dwarfs.mesh.visible || performance.now() - hoverTick < 60) return
    hoverTick = performance.now()
    pointer(ev)
    const hit = ray.intersectObject(dwarfs.mesh)[0]
    dwarfs.setHover(hit?.instanceId ?? -1)
    canvas.style.cursor = hit ? 'pointer' : ''
  })

  function clickDwarf(i: number) {
    const { dwarf, isNew } = dwarfs.collect(i)
    updateDwarfCount()
    const sub = [dwarf.a && `autor: ${dwarf.a}`, dwarf.d && `od ${dwarf.d}`].filter(Boolean).join(' · ')
    const fact = DWARF_FACTS[Math.floor(Math.random() * DWARF_FACTS.length)]
    openPopup({
      title: dwarf.n,
      sub,
      img: dwarf.img,
      text: dwarf.i ? `„${dwarf.i}”` : fact,
      link: { href: `https://www.openstreetmap.org/node/${dwarf.id}`, label: 'Zobacz w OpenStreetMap' },
    })
    if (isNew) toast(`Nowy krasnal! ${dwarfs.found.size}/${dwarfs.list.length}`)
    if (dwarfs.found.size === dwarfs.list.length) toast('Wszystkie krasnale znalezione. Jesteś Papą Krasnalem!', 6000)
  }

  // --- easter eggi z klawiatury ---
  let keys: string[] = []
  addEventListener('keydown', (ev) => {
    if ((ev.target as HTMLElement).tagName === 'INPUT') return
    keys = [...keys, ev.key].slice(-KONAMI.length)
    if (keys.join() === KONAMI.join()) {
      const egg = EGGS.find((e) => e.trigger === 'konami')
      if (egg) showEgg(egg)
      dwarfs.startParty()
      keys = []
    }
    if (ev.key === 'h' || ev.key === 'H') document.body.classList.toggle('hide-ui')
    if (ev.key === 'q') rotate(-Math.PI / 4)
    if (ev.key === 'e') rotate(Math.PI / 4)
  })

  // --- zrzut ekranu ---
  document.getElementById('btn-photo')!.onclick = () => {
    pixel.render(scene, camera)
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `wroclaw-${epoch.year}.png`
    a.click()
  }

  // --- wyszukiwarka ---
  const items: SearchItem[] = [
    ...LANDMARKS.map((l) => {
      const [x, y] = toLocal(l.lat, l.lon)
      return { name: l.name, kind: 'zabytek', x, y, onPick: () => openPopup({ title: l.name, sub: l.year, text: l.text }) }
    }),
    ...TRIVIA.map((t) => {
      const [x, y] = toLocal(t.lat, t.lon)
      return { name: t.title, kind: t.category === 'miejsce' ? 'ciekawostka' : t.category, x, y, onPick: () => showTrivia(t) }
    }),
    ...dwarfs.list.map((d, i) => ({ name: d.n, kind: 'krasnal', x: d.x, y: d.y, onPick: () => clickDwarf(i) })),
    ...world.named.map(([name, x, y, kind]) => ({ name, kind, x, y })),
  ]
  initSearch(items, fly)

  // --- start ---
  const h = new URLSearchParams(location.hash.slice(1))
  const start = toLocal(51.1099, 17.0326)
  setEpoch(EPOCHS.find((e) => e.id === h.get('e')) ?? epoch)
  setSeason(season)
  resize()
  const sx = +(h.get('x') ?? start[0]), sy = +(h.get('y') ?? start[1])
  setView(sx, sy, +(h.get('z') ?? 1.6), +(h.get('r') ?? 0), Math.min(+(h.get('t') ?? DEFAULT_TILT), 1.0))
  const progress = document.getElementById('progress')!
  tiles
    .load(sx, sy, (done, total) => {
      document.getElementById('loading')!.classList.add('done')
      progress.hidden = done === total
      progress.textContent = `Wczytuję dzielnice… ${done}/${total}`
    })
    .then(() => {
      life = new Life(world.roads, world.trams, world.rails, world.bounds, !!timetable)
      scene.add(life.group)
      // przebuduj epokę na pełnych danych (powódź, dym, pas startowy potrzebują całego miasta)
      setEpoch(epoch)
      setSeason(season)
    })

  // Tryb oszczędny: gdy przez kilka sekund jest < 24 kl./s, zwiększ piksel, potem wyłącz cienie.
  const lowDetailHidesLife = true
  let fpsAcc = 0, fpsFrames = 0, saverStep = 0
  const governor = (dt: number) => {
    fpsAcc += dt
    fpsFrames++
    if (fpsAcc < 4) return
    const fps = fpsFrames / fpsAcc
    fpsAcc = fpsFrames = 0
    if (fps >= 24 || document.hidden) return
    if (saverStep === 0 && px < 4) { px++; resize(); toast('Tryb oszczędny: większy piksel') }
    else if (saverStep === 1) { renderer.shadowMap.enabled = false; scene.traverse((o) => { if ((o as THREE.Mesh).material) ((o as THREE.Mesh).material as THREE.Material).needsUpdate = true }); toast('Tryb oszczędny: bez cieni') }
    else return
    saverStep++
  }

  const clock = new THREE.Clock()
  let lastClock = 0
  const [bx0, by0, bx1, by1] = world.bounds
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1)
    controls.update()
    // nie pozwól odjechać poza mapę: przesuwamy cel i kamerę razem
    // (sam cel zmieniałby odległość kamery i dalsza część miasta wypadała poza zasięg widzenia)
    const cx = THREE.MathUtils.clamp(target.x, bx0, bx1) - target.x
    const cz = THREE.MathUtils.clamp(target.z, -by1, -by0) - target.z
    if (cx || cz) {
      target.x += cx
      target.z += cz
      camera.position.x += cx
      camera.position.z += cz
    }

    const now = clockFor(timePreset)
    const extent = Math.max(innerWidth, innerHeight) / camera.zoom
    sun.set(now, target, Math.min(extent * 0.9, 2600))
    uniforms.uNight.value = sun.night
    pixel.material.uniforms.uNight.value = sun.night
    uTime.value += dt
    if (performance.now() - lastClock > 1000) { setClock(now); lastClock = performance.now() }

    // daleko: ludzie, auta i drzewa są mniejsze niż piksel — nie liczymy ich i nie rysujemy
    const far = camera.zoom < 0.55
    if (life) { life.group.visible = !far || !lowDetailHidesLife; if (life.group.visible) life.update(dt) }
    tiles.setTreesVisible(layers.trees && camera.zoom > 0.35)
    governor(dt)
    if (timetable) {
      timetable.mesh.visible = layers.trams && epoch.year >= 1877
      if (timetable.mesh.visible) timetable.update(now)
    }
    dwarfs.setZoom(px / camera.zoom)
    dwarfs.update(dt)
    epochState?.update(dt)
    structures.update(dt)
    if (speedway) speedway.group.visible = epoch.year >= 1988 && layers.eggs
    if (speedway?.group.visible) speedway.update(dt)
    pixel.render(scene, camera)
    labels.update(camera, innerWidth, innerHeight)
    setCompass(controls.getAzimuthalAngle())
  })
}
