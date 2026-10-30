// Kamera i sterowanie: ustawienie widoku, obrót, przelot do miejsca, link z widokiem i granice mapy.
import * as THREE from 'three'
import { MapControls } from 'three/addons/controls/MapControls.js'
import type { World } from '../types/world.ts'

export const DEFAULT_TILT = 0.75
const MAX_TILT = 1.0
// odległość kamery od celu (rzut prostokątny: wpływa tylko na zasięg widzenia, nie na skalę)
const CAMERA_DISTANCE = 3000
const ROTATE_STEP = Math.PI / 4
// przelot do wyniku wyszukiwania przybliża co najmniej do tylu
const FLY_MIN_ZOOM = 2.5
// brzeg widoku może wyjść najwyżej tyle metrów za koniec danych (pas chmur), dalej kamera nie jedzie
const EDGE_SLACK = 350

export class View {
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000)
  controls: MapControls

  constructor(canvas: HTMLCanvasElement) {
    const c = new MapControls(this.camera, canvas)
    c.enableDamping = true
    c.dampingFactor = 0.12
    c.minZoom = 0.25
    c.maxZoom = 12
    c.maxPolarAngle = MAX_TILT
    c.zoomToCursor = true
    c.listenToKeyEvents(window)
    this.controls = c
  }

  get target() { return this.controls.target }
  get zoom() { return this.camera.zoom }
  get azimuth() { return this.controls.getAzimuthalAngle() }
  get tilt() { return this.controls.getPolarAngle() }

  // Kamera patrzy na punkt mapy (x, y) z kierunku azimuth, nachylona o polar od pionu.
  set(x: number, y: number, zoom: number, azimuth: number, polar = DEFAULT_TILT) {
    const d = CAMERA_DISTANCE
    this.target.set(x, 0, -y)
    this.camera.position.set(
      x + Math.sin(azimuth) * Math.sin(polar) * d,
      Math.cos(polar) * d,
      -y + Math.cos(azimuth) * Math.sin(polar) * d,
    )
    this.camera.zoom = zoom
    this.camera.updateProjectionMatrix()
    this.controls.update()
  }

  fly(x: number, y: number) {
    this.set(x, y, Math.max(this.zoom, FLY_MIN_ZOOM), this.azimuth, this.tilt)
  }

  // Obrót o 45° w lewo (-1) albo w prawo (+1).
  rotate(dir: -1 | 1) {
    this.set(this.target.x, -this.target.z, this.zoom, this.azimuth + dir * ROTATE_STEP, this.tilt)
  }

  // Domyślny widok: północ u góry i standardowe nachylenie.
  resetNorth() {
    this.set(this.target.x, -this.target.z, this.zoom, 0, DEFAULT_TILT)
  }

  // Widok z linku (#x=…&y=…&z=…&r=…&t=…) albo domyślny; zwraca punkt startowy.
  restore(h: URLSearchParams, fallback: [number, number]): [number, number] {
    const x = +(h.get('x') ?? fallback[0]), y = +(h.get('y') ?? fallback[1])
    const tilt = Math.min(+(h.get('t') ?? DEFAULT_TILT), MAX_TILT)
    this.set(x, y, +(h.get('z') ?? 1.6), +(h.get('r') ?? 0), tilt)
    return [x, y]
  }

  // Parametry widoku do linku (kolejność kluczy jak w adresie).
  hashParams() {
    return {
      x: this.target.x.toFixed(0),
      y: (-this.target.z).toFixed(0),
      z: this.zoom.toFixed(2),
      r: this.azimuth.toFixed(2),
      t: this.tilt.toFixed(2),
    }
  }

  // Kadr w pikselach ekranu (rzut prostokątny: 1 jednostka = 1 m przy zoom 1).
  resize(W: number, H: number) {
    const cam = this.camera
    cam.left = -W / 2
    cam.right = W / 2
    cam.top = H / 2
    cam.bottom = -H / 2
    cam.updateProjectionMatrix()
  }

  // Nie pozwala odjechać poza mapę: przesuwamy cel i kamerę razem
  // (sam cel zmieniałby odległość kamery i dalsza część miasta wypadałaby poza zasięg widzenia).
  keepInside([bx0, by0, bx1, by1]: World['bounds']) {
    const target = this.target, cam = this.camera
    const hw = innerWidth / 2 / cam.zoom
    const hh = innerHeight / 2 / cam.zoom / Math.max(0.5, Math.cos(this.tilt))
    const lim = (lo: number, hi: number, half: number, v: number) => {
      const a = lo + half - EDGE_SLACK, b = hi - half + EDGE_SLACK
      return a > b ? (lo + hi) / 2 : THREE.MathUtils.clamp(v, a, b)
    }
    const cx = lim(bx0, bx1, Math.min(hw, hh * 4), target.x) - target.x
    const cz = -lim(by0, by1, Math.min(hh, hw * 4), -target.z) - target.z
    if (cx || cz) {
      target.x += cx
      target.z += cz
      cam.position.x += cx
      cam.position.z += cz
    }
  }
}
