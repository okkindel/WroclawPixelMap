// Napisy nad zabytkami i znaczniki ciekawostek (HTML nakładany na rzut 3D).
import * as THREE from 'three'
import { toLocal } from '../engine/geo.ts'
import type { Egg, Landmark } from '../history/content.ts'

// fromYear: od którego roku obiekt istnieje (napis chowany we wcześniejszych epokach)
interface Pin { el: HTMLElement; pos: THREE.Vector3; minZoom: number; maxZoom?: number; size?: [number, number]; fromYear?: number }

// Rok z opisu zabytku: pierwszy czterocyfrowy rok albo wiek rzymski (XIII w. → 1250).
export function yearOf(text: string): number | undefined {
  const y = text.match(/\d{4}/)
  if (y) return +y[0]
  const c = text.match(/\b([IVX]+)\s*w/)
  if (!c) return undefined
  const R: Record<string, number> = { I: 1, V: 5, X: 10 }
  let n = 0
  for (let i = 0; i < c[1].length; i++) { const v = R[c[1][i]], w = R[c[1][i + 1]] ?? 0; n += v < w ? -v : v }
  return (n - 1) * 100 + 50
}

export class Labels {
  root: HTMLElement
  pins: Pin[] = []
  eggPins: Pin[] = []
  placePins: Pin[] = []
  showLabels = true
  showEggs = true
  year = 9999
  private v = new THREE.Vector3()

  constructor(root: HTMLElement, landmarks: Landmark[], rank: Record<string, 1 | 2>, onLandmark: (l: Landmark) => void) {
    this.root = root
    // ranga 1 widoczna z daleka, 2 przy średnim przybliżeniu, reszta po przybliżeniu;
    // kolejność = pierwszeństwo przy nachodzeniu napisów
    const zoomFor = (l: Landmark) => ({ 1: 0, 2: 0.9 })[rank[l.name] as 1 | 2] ?? 1.6
    // świątynie dostają osobny kolor napisu
    const sacred = /Kości|Katedr|Kolegiat|Synagog|Cerkiew|Kaplic/
    for (const l of [...landmarks].sort((a, b) => zoomFor(a) - zoomFor(b))) this.addLabel(l.name, l.lat, l.lon, zoomFor(l), () => onLandmark(l), sacred.test(l.name) ? 'church' : '', yearOf(l.year))
  }

  // Napis z nazwą (zabytki, uczelnie).
  addLabel(name: string, lat: number, lon: number, minZoom: number, onClick: () => void, cls = '', fromYear?: number) {
    const [x, y] = toLocal(lat, lon)
    const el = document.createElement('button')
    el.className = `label ${cls}`
    el.textContent = name
    el.onclick = onClick
    this.root.appendChild(el)
    this.pins.push({ el, pos: new THREE.Vector3(x, 30, -y), minZoom, fromYear })
  }

  // Nazwa osiedla: duży napis widoczny z daleka, znika po przybliżeniu.
  addPlace(name: string, x: number, y: number, rank: number) {
    const el = document.createElement('div')
    el.className = `place place-${rank}`
    el.textContent = name
    this.root.appendChild(el)
    this.placePins.push({ el, pos: new THREE.Vector3(x, 0, -y), minZoom: [0, 0.6, 1.1][rank], maxZoom: [1.4, 2.2, 3][rank] })
  }

  // Okrągły znacznik: „?” dla ciekawostek, „★” dla kultowych miejsc.
  addMarker(e: Egg, onClick: () => void, icon = '?', cls = '', fromYear?: number) {
    if (e.trigger === 'konami') return
    const [x, y] = toLocal(e.lat, e.lon)
    const el = document.createElement('button')
    el.className = `egg ${cls}`
    el.title = e.title
    el.textContent = icon
    el.onclick = onClick
    this.root.appendChild(el)
    this.eggPins.push({ el, pos: new THREE.Vector3(x, 12, -y), minZoom: e.trigger === 'zoom' ? 3 : 0.75, fromYear })
  }

  update(camera: THREE.OrthographicCamera, w: number, h: number) {
    // Kolejność = priorytet: najpierw zabytki z początku listy, potem ciekawostki.
    // Napis, który nachodziłby na już postawiony, chowamy.
    const placed: [number, number, number, number][] = []
    const place = (p: Pin, visible: boolean) => {
      if (!visible || (p.fromYear ?? 0) > this.year || camera.zoom < p.minZoom || camera.zoom > (p.maxZoom ?? Infinity)) { p.el.style.display = 'none'; return }
      this.v.copy(p.pos).project(camera)
      if (Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) { p.el.style.display = 'none'; return }
      const x = ((this.v.x + 1) / 2) * w, y = ((1 - this.v.y) / 2) * h
      p.el.style.display = ''
      // rozmiar mierzymy raz (offsetWidth wymusza przeliczenie układu strony)
      const [bw, bh] = (p.size ??= [p.el.offsetWidth + 6, p.el.offsetHeight + 4])
      const r: [number, number, number, number] = [x - bw / 2, y - bh, x + bw / 2, y]
      if (placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) { p.el.style.display = 'none'; return }
      placed.push(r)
      p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
    }
    // zabytki mają pierwszeństwo przed nazwami osiedli
    for (const p of this.pins) place(p, this.showLabels)
    for (const p of this.placePins) place(p, this.showLabels)
    for (const p of this.eggPins) place(p, this.showEggs)
  }
}
