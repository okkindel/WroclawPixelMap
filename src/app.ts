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
import { HistoryLayer } from './world/history.ts'
import { FOG_COLOR, buildCloudEdge } from './world/edge.ts'
import { Scenes, type SceneName } from './scenes/index.ts'
import { waterShader } from './world/water.ts'
import { windowShader } from './world/windows.ts'
import { Life, tramGeometry } from './life/life.ts'
import { Timetable } from './life/timetable.ts'
import { Dwarfs } from './layers/dwarfs.ts'
import { Labels } from './layers/labels.ts'
import { Speedway } from './layers/speedway.ts'
import { Neons } from './layers/neons.ts'
import { NEONS } from './layers/neons.data.ts'
import { lang } from './i18n/index.ts'
import { WALLS, type Egg, type Epoch } from './history/content.ts'
import { epochScene, type EpochScene } from './history/epochs.ts'
import type { Trivia } from './history/trivia.ts'
import { dwarfFacts, eggs, epochs, landmarkRank, landmarks, t, trivia } from './i18n/index.ts'
import { initPanel, initTimeline, setClock, setCompass, setDwarfCount, showEpoch, type Layer } from './ui/panel.ts'
import { openPopup, toast } from './ui/popup.ts'
import { initSearch, type SearchItem } from './ui/search.ts'
import type { WorldMeta } from './types/world.ts'

const DEFAULT_TILT = 0.75
// treści w wybranym języku (PL/EN)
const EPOCHS = epochs(), LANDMARKS = landmarks(), LANDMARK_RANK = landmarkRank(), EGGS = eggs(), TRIVIA = trivia(), DWARF_FACTS = dwarfFacts()
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

export async function startApp() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/meta.json`)
  const meta: WorldMeta = await res.json()
  setOrigin(meta.origin)

  const canvas = document.getElementById('map') as HTMLCanvasElement
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
  // poza obszarem danych: płaska, nieoświetlona płaszczyzna w kolorze tła (pod wałem chmur)
  {
    const [bx0, by0, bx1, by1] = meta.bounds
    const out = new THREE.Mesh(new THREE.PlaneGeometry(bx1 - bx0 + 30000, by1 - by0 + 30000), new THREE.MeshBasicMaterial({ color: FOG_COLOR }))
    out.rotation.x = -Math.PI / 2
    out.position.set((bx0 + bx1) / 2, -0.3, -(by0 + by1) / 2)
    scene.add(out)
  }
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
  document.querySelectorAll<HTMLInputElement>('input[data-scene]').forEach((i) => i.addEventListener('change', () => {
    const n = i.dataset.scene as SceneName
    if (i.checked) forcedScenes.add(n)
    else forcedScenes.delete(n)
  }))
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
  const historyLayer = new HistoryLayer(meta)
  scene.add(historyLayer.group)
  const neons = new Neons()
  scene.add(neons.group)
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
  const layers: Record<Layer, boolean> = { dwarfs: true, neons: true, trams: true, trains: true, boats: true, cars: true, people: true, birds: true, clouds: true, trees: true, labels: true, eggs: true }

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
    if (scenes) scenes.boatsOn = layers.boats
    structures.setYear(epoch.year)
    historyLayer.show(HistoryLayer.planFor(epoch.year))
    labels.year = epoch.year
    // pierwszy krasnal stanął w 2001 r.
    dwarfs.mesh.visible = layers.dwarfs && modern
    labels.showLabels = layers.labels
    labels.showEggs = layers.eggs
  }

  // --- napisy i ciekawostki ---
  const showEgg = (e: Egg) => openPopup({ title: e.title, text: e.text, sub: t('sub.trivia') })
  const labels = new Labels(document.getElementById('pins')!, LANDMARKS, LANDMARK_RANK, (l) => openPopup({ title: l.name, sub: l.year, text: l.text }))
  for (const e of EGGS) labels.addMarker(e, () => showEgg(e))
  const showTrivia = (tr: Trivia) =>
    openPopup({ title: tr.title, sub: { miejsce: t('sub.trivia'), uczelnia: t('sub.uni'), kultowe: t('sub.cult') }[tr.category], text: tr.text, link: { href: tr.source, label: t('source') } })
  for (const t of TRIVIA) {
    if (t.category === 'uczelnia') labels.addLabel(t.title, t.lat, t.lon, 0.9, () => showTrivia(t), 'uni')
    else if (t.category === 'kultowe') labels.addMarker(t, () => showTrivia(t), '', 'cult', 1945)
    else labels.addMarker(t, () => showTrivia(t))
  }
  // ciekawostki przy neonach (galeria przy Ruskiej jako jeden znacznik)
  for (const n of NEONS) {
    if (n.id.startsWith('ns-')) continue
    const L = lang()
    labels.addMarker(
      { id: `neon-${n.id}`, lat: n.lat, lon: n.lon, title: n.title[L], text: n.text[L], trigger: 'click' },
      () => openPopup({ title: n.title[L], sub: t('layer.neons'), text: n.text[L], link: { href: n.source, label: t('source') } }),
      '?', 'neon', n.from,
    )
  }
  for (const [name, x, y, rank] of meta.places) labels.addPlace(name, x, y, rank)
  // rozpoznawalne obiekty z OSM (galerie, teatry, kościoły, obiekty z Wikidaty), bez dublowania zabytków z listy
  const landmarkXY = LANDMARKS.map((l) => toLocal(l.lat, l.lon))
  const POI_SUB = { mall: t('poi.mall'), culture: t('poi.culture'), church: t('poi.church'), edu: t('poi.edu'), health: t('poi.health'), sport: t('poi.sport'), notable: t('poi.notable') }
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
    labels.addLabel(st.n, lat, lon, 0.8, () => openPopup({ title: st.n!, sub: t('sub.stadium') }))
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
  let px = 1.5
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
    try { await navigator.clipboard.writeText(location.href); toast(t('toast.linkCopied')) } catch { toast(location.href, 5000) }
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
      if (info) return openPopup({ title: t('tram.title', { line: info.line }), sub: t('tram.sub', { head: info.head }), text: t('tram.text', { dep: info.dep, arr: info.arr }) })
    }
    const neon = neons.group.visible ? neons.hit(ray) : null
    if (neon) return openPopup({ title: neon.title, sub: t('sub.trivia'), text: neon.text, link: neon.source ? { href: neon.source, label: t('source') } : undefined })
    const sc = scenes?.hit(ray)
    if (sc) return openPopup({ title: sc.title, sub: t('sub.trivia'), text: sc.text })
    if (speedway?.hit(ray)) {
      return openPopup({
        title: t('speedway.title'),
        sub: t('sub.trivia'),
        text: t('speedway.text'),
      })
    }
    const b = tiles.pick(ray)
    {
      if (b?.n) openPopup({ title: b.n, sub: [b.y && t('building.built', { y: b.y }), `${Math.round(b.H)} m`].filter(Boolean).join(' · ') })
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
    const sub = [dwarf.a && t('dwarf.author', { a: dwarf.a }), dwarf.d && t('dwarf.since', { d: dwarf.d })].filter(Boolean).join(' · ')
    const fact = DWARF_FACTS[Math.floor(Math.random() * DWARF_FACTS.length)]
    openPopup({
      title: dwarf.n,
      sub,
      img: dwarf.img,
      text: dwarf.i ? t('dwarf.quote', { s: dwarf.i }) : fact,
      link: { href: `https://www.openstreetmap.org/node/${dwarf.id}`, label: t('dwarf.osm') },
    })
    if (isNew) toast(t('toast.newDwarf', { n: dwarfs.found.size, total: dwarfs.list.length }))
    if (dwarfs.found.size === dwarfs.list.length) toast(t('toast.allDwarfs'), 6000)
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
      return { name: l.name, kind: t('kind.zabytek'), x, y, onPick: () => openPopup({ title: l.name, sub: l.year, text: l.text }) }
    }),
    ...TRIVIA.map((tr) => {
      const [x, y] = toLocal(tr.lat, tr.lon)
      return { name: tr.title, kind: t(`kind.${tr.category === 'miejsce' ? 'ciekawostka' : tr.category}`), x, y, onPick: () => showTrivia(tr) }
    }),
    ...dwarfs.list.map((d, i) => ({ name: d.n, kind: t('kind.krasnal'), x: d.x, y: d.y, onPick: () => clickDwarf(i) })),
    ...world.named.map(([name, x, y, kind]) => ({ name, kind: t(`kind.${kind}`), x, y })),
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
      progress.textContent = t('progress', { done, total })
    })
    .then(() => {
      life = new Life(world.roads, world.trams, world.rails, world.bounds, !!timetable)
      scene.add(life.group)
      // smaczki (jarmark, fajerwerki, statki, latarnik) potrzebują wczytanego miasta
      fetch(`${import.meta.env.BASE_URL}data/scenes.json`)
        .then((r) => (r.ok ? r.json() : undefined))
        .catch(() => undefined)
        .then((data) => {
          scenes = new Scenes(world, data)
          scenes.forced = forcedScenes
          scenes.boatsOn = layers.boats
          scene.add(scenes.group)
        })
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
    if (saverStep === 0 && px < 3) { px = Math.min(3, px + 0.5); resize(); toast(t('saver.pixel')) }
    else if (saverStep === 1) { renderer.shadowMap.enabled = false; scene.traverse((o) => { if ((o as THREE.Mesh).material) ((o as THREE.Mesh).material as THREE.Material).needsUpdate = true }); toast(t('saver.shadows')) }
    else return
    saverStep++
  }

  const clock = new THREE.Clock()
  let lastSig = '', sinceShadow = 1, sinceLabels = 1
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
    pixel.material.uniforms.uOutlineK.value = THREE.MathUtils.clamp((camera.zoom - 0.25) / 0.9, 0, 1)
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
    // neony liczą rozmiar dla piksela ok. 2 — przeliczamy powiększenie na bieżący piksel
    neons.group.visible = layers.neons
    if (neons.group.visible) neons.update(dt, sun.night, epoch.year, (camera.zoom * 2) / px)
    if (speedway) speedway.group.visible = epoch.year >= 1988 && layers.eggs
    if (speedway?.group.visible) speedway.update(dt)
    scenes?.update(dt, now, epoch.year, sun.night)
    pixel.render(scene, camera)
    // napisy i cienie przeliczamy, gdy widok się zmienił (albo co jakiś czas dla ruchomych obiektów)
    const sig = `${camera.position.x.toFixed(1)},${camera.position.y.toFixed(1)},${camera.position.z.toFixed(1)},${camera.zoom.toFixed(3)},${innerWidth},${innerHeight},${epoch.year},${layers.labels},${layers.eggs}`
    const moved = sig !== lastSig
    lastSig = sig
    sinceShadow += dt
    sinceLabels += dt
    if (moved || sinceShadow > 0.15) { renderer.shadowMap.needsUpdate = true; sinceShadow = 0 }
    if (moved || sinceLabels > 0.5) { labels.update(camera, innerWidth, innerHeight); sinceLabels = 0 }
    setCompass(controls.getAzimuthalAngle())
  })
}
