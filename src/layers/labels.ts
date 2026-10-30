// Napisy nad zabytkami i znaczniki ciekawostek (HTML nakładany na rzut 3D).
import * as THREE from 'three'
import { toLocal } from '../engine/geo.ts'
import type { Egg, Landmark } from '../content/index.ts'
import { PLACE_ZOOM, SACRED, landmarkMinZoom, markerMinZoom, yearOf } from '../rules/labels.ts'

// Grupy znaczników (osobne przełączniki w panelu „Znaczniki”).
export type PinGroup = 'labels' | 'places' | 'pois' | 'unis' | 'eggs' | 'cult'

// fromYear: od którego roku obiekt istnieje (napis chowany we wcześniejszych epokach)
interface Pin {
  el: HTMLElement
  pos: THREE.Vector3
  group: PinGroup
  minZoom: number
  maxZoom?: number
  size?: [number, number]
  fromYear?: number
}

export class Labels {
  root: HTMLElement
  pins: Pin[] = []
  eggPins: Pin[] = []
  placePins: Pin[] = []
  // widoczność grup znaczników
  show: Record<PinGroup, boolean> = { labels: true, places: true, pois: true, unis: true, eggs: true, cult: true }
  year = 9999
  private v = new THREE.Vector3()

  constructor(root: HTMLElement, landmarks: Landmark[], rank: Record<string, 1 | 2>, onLandmark: (l: Landmark) => void) {
    this.root = root
    // próg przybliżenia wg rangi (src/rules/labels.ts); kolejność = pierwszeństwo przy nachodzeniu napisów
    const zoomFor = (l: Landmark) => landmarkMinZoom(rank[l.name])
    for (const l of [...landmarks].sort((a, b) => zoomFor(a) - zoomFor(b))) {
      this.addLabel(l.name, l.lat, l.lon, zoomFor(l), () => onLandmark(l), SACRED.test(l.name) ? 'church' : '', yearOf(l.year))
    }
  }

  // Napis z nazwą (zabytki, uczelnie, obiekty z OSM).
  // Akcja napisu o danej nazwie w pobliżu punktu (x, y) — żeby kliknięcie w bryłę budynku otwierało to samo okienko.
  private openers: { name: string; x: number; y: number; open: () => void }[] = []
  openerFor(name: string, x: number, y: number, radius = 250) {
    return this.openers.find((o) => o.name === name && Math.hypot(o.x - x, o.y - y) < radius)?.open
  }

  addLabel(
    name: string,
    lat: number,
    lon: number,
    minZoom: number,
    onClick: () => void,
    cls = '',
    fromYear?: number,
    group: PinGroup = 'labels',
  ) {
    const [x, y] = toLocal(lat, lon)
    this.openers.push({ name, x, y, open: onClick })
    const el = document.createElement('button')
    el.className = `label ${cls}`
    el.textContent = name
    el.onclick = onClick
    this.root.appendChild(el)
    this.pins.push({ el, pos: new THREE.Vector3(x, 30, -y), group, minZoom, fromYear })
  }

  // Nazwa osiedla: duży napis widoczny z daleka, znika po przybliżeniu.
  addPlace(name: string, x: number, y: number, rank: number) {
    const el = document.createElement('div')
    el.className = `place place-${rank}`
    el.textContent = name
    this.root.appendChild(el)
    this.placePins.push({
      el,
      pos: new THREE.Vector3(x, 0, -y),
      group: 'places',
      minZoom: PLACE_ZOOM.min[rank],
      maxZoom: PLACE_ZOOM.max[rank],
    })
  }

  // Okrągły znacznik: „?” dla ciekawostek, „★” dla kultowych miejsc.
  addMarker(e: Egg, onClick: () => void, icon = '?', cls = '', fromYear?: number, group: PinGroup = 'eggs') {
    if (e.trigger === 'konami') return
    const [x, y] = toLocal(e.lat, e.lon)
    const el = document.createElement('button')
    el.className = `egg ${cls}`
    el.title = e.title
    el.textContent = icon
    el.onclick = onClick
    this.root.appendChild(el)
    this.eggPins.push({ el, pos: new THREE.Vector3(x, 12, -y), group, minZoom: markerMinZoom(e.trigger), fromYear })
  }

  update(camera: THREE.OrthographicCamera, w: number, h: number) {
    // Kolejność = priorytet: najpierw zabytki z początku listy, potem ciekawostki.
    // Napis, który nachodziłby na już postawiony, chowamy.
    const placed: [number, number, number, number][] = []
    const place = (p: Pin) => {
      const hidden =
        !this.show[p.group] || (p.fromYear ?? 0) > this.year || camera.zoom < p.minZoom || camera.zoom > (p.maxZoom ?? Infinity)
      if (hidden) {
        p.el.style.display = 'none'
        return
      }
      this.v.copy(p.pos).project(camera)
      if (Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) {
        p.el.style.display = 'none'
        return
      }
      const x = ((this.v.x + 1) / 2) * w,
        y = ((1 - this.v.y) / 2) * h
      p.el.style.display = ''
      // rozmiar mierzymy raz (offsetWidth wymusza przeliczenie układu strony)
      const [bw, bh] = (p.size ??= [p.el.offsetWidth + 6, p.el.offsetHeight + 4])
      const r: [number, number, number, number] = [x - bw / 2, y - bh, x + bw / 2, y]
      if (placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) {
        p.el.style.display = 'none'
        return
      }
      placed.push(r)
      p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
    }
    // zabytki mają pierwszeństwo przed nazwami osiedli
    for (const p of this.pins) place(p)
    for (const p of this.placePins) place(p)
    for (const p of this.eggPins) place(p)
  }
}
