// Pętla rysowania: słońce i pora dnia, ruch, warstwy zależne od przybliżenia, cienie i napisy po zmianie widoku,
// tryb oszczędny na słabszych urządzeniach.
import * as THREE from 'three'
import { clockAt, minutesOf } from '../engine/sun.ts'
import { t } from '../i18n/index.ts'
import { FAR_ZOOM, MONUMENTS_MIN_ZOOM, PIXEL_SAVER_MAX, PIXEL_SAVER_STEP, TREES_MIN_ZOOM } from '../rules/render.ts'
import { setClock, setCompass, showHour } from '../ui/panel.ts'
import { toast } from '../ui/popup.ts'
import { resize } from './apply.ts'
import { PowerSaver } from './saver.ts'
import { type App, PIN_GROUPS } from './state.ts'

// cienie i napisy przeliczamy po zmianie widoku albo co tyle sekund (ruchome obiekty)
const SHADOW_REFRESH_S = 0.15
const LABELS_REFRESH_S = 0.5
const CLOCK_REFRESH_MS = 1000
const MAX_FRAME_DT = 0.1
// zasięg mapy cieni rośnie z kadrem, ale nie ponad tyle metrów
const SHADOW_EXTENT_MAX = 2600
// neony liczą rozmiar dla piksela ok. 2: przeliczamy powiększenie na bieżący piksel
const NEON_PIXEL = 2

export function startLoop(app: App) {
  const { city, state, labels } = app
  const { renderer, pixel, scene, camera, view, tiles, sun, dwarfs, timetable, monuments, neons } = city

  // Tryb oszczędny: najpierw większy piksel, potem bez cieni.
  const saver = new PowerSaver([
    () => {
      if (state.px >= PIXEL_SAVER_MAX) return false
      state.px = Math.min(PIXEL_SAVER_MAX, state.px + PIXEL_SAVER_STEP)
      resize(app)
      toast(t('saver.pixel'))
      return true
    },
    () => {
      renderer.shadowMap.enabled = false
      // materiały trzeba przekompilować bez cieni
      scene.traverse((o) => {
        if ('material' in o && o.material instanceof THREE.Material) o.material.needsUpdate = true
      })
      toast(t('saver.shadows'))
      return true
    },
  ])

  const clock = new THREE.Clock()
  let lastSig = '',
    sinceShadow = 1,
    sinceLabels = 1,
    lastClock = 0
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), MAX_FRAME_DT)
    const { layers, epoch, life, scenes } = state
    view.controls.update()
    view.keepInside(city.world.bounds)

    // słońce, noc i śnieg w materiałach
    const now = state.hour === 'now' ? new Date() : clockAt(state.hour)
    const extent = Math.max(innerWidth, innerHeight) / camera.zoom
    sun.set(now, view.target, Math.min(extent * 0.9, SHADOW_EXTENT_MAX))
    city.uniforms.uNight.value = sun.night
    pixel.material.uniforms.uNight.value = sun.night
    city.uTime.value += dt
    // metry na piksel renderu (do progu konturów)
    pixel.material.uniforms.uMpp.value = state.px / camera.zoom
    if (performance.now() - lastClock > CLOCK_REFRESH_MS) {
      setClock(now)
      if (state.hour === 'now') showHour(minutesOf(now))
      lastClock = performance.now()
    }

    // ruch i warstwy zależne od przybliżenia
    if (life) {
      life.group.visible = camera.zoom >= FAR_ZOOM
      if (life.group.visible) life.update(dt)
    }
    tiles.setTreesVisible(layers.trees && camera.zoom > TREES_MIN_ZOOM)
    tiles.setZoom(camera.zoom)
    saver.tick(dt)
    if (timetable) {
      timetable.mesh.visible = layers.trams && !!state.epochState?.life.trams
      if (timetable.mesh.visible) timetable.update(now)
    }
    dwarfs.setZoom(state.px / camera.zoom)
    dwarfs.update(dt)
    state.epochState?.update(dt)
    city.structures.update(dt)
    if (monuments) {
      monuments.group.visible = layers.monuments && camera.zoom > MONUMENTS_MIN_ZOOM
      if (monuments.group.visible) monuments.update(dt, epoch.year)
    }
    neons.group.visible = layers.neons
    if (neons.group.visible) neons.update(dt, sun.night, epoch.year, (camera.zoom * NEON_PIXEL) / state.px)
    scenes?.update(dt, now, epoch.year, sun.night)
    pixel.render(scene, camera)

    // napisy i cienie przeliczamy, gdy widok się zmienił (albo co jakiś czas dla ruchomych obiektów)
    const p = camera.position
    const sig = [
      p.x.toFixed(1),
      p.y.toFixed(1),
      p.z.toFixed(1),
      camera.zoom.toFixed(3),
      innerWidth,
      innerHeight,
      epoch.year,
      ...PIN_GROUPS.map((g) => labels.show[g]),
    ].join()
    const moved = sig !== lastSig
    lastSig = sig
    sinceShadow += dt
    sinceLabels += dt
    if (moved || sinceShadow > SHADOW_REFRESH_S) {
      renderer.shadowMap.needsUpdate = true
      sinceShadow = 0
    }
    if (moved || sinceLabels > LABELS_REFRESH_S) {
      labels.update(camera, innerWidth, innerHeight)
      sinceLabels = 0
    }
    setCompass(view.azimuth)
  })
}
