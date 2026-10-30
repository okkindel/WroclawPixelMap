// Wspólne narzędzia scenek: bryły z kolorami w wierzchołkach i chodzenie po polilinii.
// (sklejanie części w jedną bryłę: merge z world/geometry.ts)
import * as THREE from 'three'
import { cumLengths } from '../engine/geo.ts'
import type { Flat } from '../types/world.ts'

// Prostopadłościan (dł. wzdłuż X, szer. wzdłuż Z) ustawiony na wysokości y, przesunięty o (x, z).
export function box(l: number, h: number, w: number, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(l, h, w)
  g.translate(x, y + h / 2, z)
  return g
}

export const vertexLambert = () => new THREE.MeshLambertMaterial({ vertexColors: true })

// Polilinia z długościami narastającymi: punkt i kierunek po przebytej drodze s.
export class Path {
  pts: Flat
  cum: number[]
  len: number
  constructor(pts: Flat) {
    this.pts = pts
    this.cum = cumLengths(pts)
    this.len = this.cum[this.cum.length - 1]
  }
  // [x, y, kierunek (rad, 0 = wschód)]; offset > 0 przesuwa w prawo względem kierunku jazdy
  at(s: number, offset = 0): [number, number, number] {
    s = Math.max(0, Math.min(this.len, s))
    let lo = 1,
      hi = this.cum.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.cum[mid] < s) lo = mid + 1
      else hi = mid
    }
    const i = lo,
      p = this.pts
    const ax = p[(i - 1) * 2],
      ay = p[(i - 1) * 2 + 1],
      bx = p[i * 2],
      by = p[i * 2 + 1]
    const L = this.cum[i] - this.cum[i - 1] || 1
    const t = (s - this.cum[i - 1]) / L
    const dx = (bx - ax) / L,
      dy = (by - ay) / L
    return [ax + (bx - ax) * t + dy * offset, ay + (by - ay) * t - dx * offset, Math.atan2(dy, dx)]
  }
}

// Instancja w punkcie mapy (x, y) na wysokości h, obrócona o kąt (0 = wschód, przeciwnie do zegara).
const _q = new THREE.Quaternion(),
  _v = new THREE.Vector3(),
  _s = new THREE.Vector3(),
  _up = new THREE.Vector3(0, 1, 0)
export function place(m: THREE.Matrix4, x: number, y: number, h: number, angle: number, scale = 1) {
  _q.setFromAxisAngle(_up, angle)
  return m.compose(_v.set(x, h, -y), _q, _s.setScalar(scale))
}
