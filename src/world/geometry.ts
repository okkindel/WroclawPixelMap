// Wspólne prymitywy geometrii: bufor z kolorami wierzchołków, płaskie wielokąty, ściany, pasy.
import * as THREE from 'three'
import { signedArea } from '../engine/geo.ts'
import type { Flat } from '../types/world.ts'
import { attrF32 } from './packed.ts'

export type V3 = [number, number, number]

const col = new THREE.Color()

// Bufor geometrii z kolorami wierzchołków i flagą „ściana z oknami”.
export class Geo {
  pos: number[] = []
  nrm: number[] = []
  col: number[] = []
  win: number[] = []
  // indeks obiektu (np. budynku) dla każdego trójkąta, do rozpoznawania kliknięć
  owner = -1
  owners: number[] = []
  tri(a: V3, b: V3, c: V3, n: V3, color: string, win = 0) {
    col.set(color)
    this.owners.push(this.owner)
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2])
      this.nrm.push(n[0], n[1], n[2])
      this.col.push(col.r, col.g, col.b)
      this.win.push(win)
    }
  }
  quad(a: V3, b: V3, c: V3, d: V3, n: V3, color: string, win = 0) {
    this.tri(a, b, c, n, color, win)
    this.tri(a, c, d, n, color, win)
  }
  build() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setAttribute('aWin', new THREE.Float32BufferAttribute(this.win, 1))
    g.computeBoundingSphere()
    g.userData.owners = Int32Array.from(this.owners)
    return g
  }
}

// Skleja części w jedną geometrię z kolorem w wierzchołkach (jedna instancja = cały obiekt).
export function merge(parts: [THREE.BufferGeometry, string][]) {
  const pos: number[] = [],
    nrm: number[] = [],
    col: number[] = []
  const c = new THREE.Color()
  for (const [g0, color] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0
    c.set(color)
    pos.push(...attrF32(g, 'position'))
    nrm.push(...attrF32(g, 'normal'))
    for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return g
}

const v2 = (flat: Flat) => {
  const out = []
  for (let i = 0; i < flat.length; i += 2) out.push(new THREE.Vector2(flat[i], flat[i + 1]))
  return out
}

// Płaski wielokąt (z dziurami) na wysokości y.
export function flatPoly(geo: Geo, outer: Flat, holes: Flat[] | undefined, y: number, color: string) {
  const contour = v2(outer)
  const hs = (holes || []).map(v2)
  let faces: number[][]
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, hs)
  } catch {
    return
  }
  const all = contour.concat(...hs)

  for (const [a, b, c] of faces) {
    const A = all[a],
      B = all[b],
      Cc = all[c]
    geo.tri([A.x, y, -A.y], [B.x, y, -B.y], [Cc.x, y, -Cc.y], [0, 1, 0], color)
  }
}

export function walls(geo: Geo, ring: Flat, base: number, top: number, color: string, win: number) {
  const ccw = signedArea(ring) > 0
  const n = ring.length / 2
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    let ax = ring[i * 2],
      ay = ring[i * 2 + 1],
      bx = ring[j * 2],
      by = ring[j * 2 + 1]
    if (!ccw) [ax, ay, bx, by] = [bx, by, ax, ay]
    const dx = bx - ax,
      dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    const nn: V3 = [dy / len, 0, dx / len] // (dy, -dx) w xy -> (nx, 0, -ny) w scenie
    geo.quad([ax, base, -ay], [bx, base, -by], [bx, top, -by], [ax, top, -ay], nn, color, win)
  }
}

// Ulica jako pasy prostokątów (segment po segmencie, przedłużone o pół szerokości).
export function strip(geo: Geo, p: Flat, w: number, y: number, color: string, extend = true) {
  const hw = w / 2
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i],
      ay = p[i + 1],
      bx = p[i + 2],
      by = p[i + 3]
    const dx = bx - ax,
      dy = by - ay
    const L = Math.hypot(dx, dy)
    if (L < 0.01) continue
    const ux = dx / L,
      uy = dy / L
    const e = extend ? hw : 0
    const sx = ax - ux * e,
      sy = ay - uy * e,
      ex = bx + ux * e,
      ey = by + uy * e
    const nx = -uy * hw,
      ny = ux * hw
    geo.quad([sx + nx, y, -(sy + ny)], [sx - nx, y, -(sy - ny)], [ex - nx, y, -(ey - ny)], [ex + nx, y, -(ey + ny)], [0, 1, 0], color)
  }
}

// Uproszczenie zamkniętego pierścienia (Douglas–Peucker, odchyłka tol [m]); za mało punktów → oryginał.
export function simplifyRing(ring: Flat, tol: number): Flat {
  const n = ring.length / 2
  if (n <= 4) return ring
  // dzielimy w najdalszym od punktu 0 wierzchołku, potem każdą połowę osobno
  let far = 0,
    fd = -1
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(ring[i * 2] - ring[0], ring[i * 2 + 1] - ring[1])
    if (d > fd) {
      fd = d
      far = i
    }
  }
  const keep = new Uint8Array(n + 1)
  keep[0] = keep[far] = keep[n] = 1
  const X = (i: number) => ring[(i % n) * 2],
    Y = (i: number) => ring[(i % n) * 2 + 1]
  const stack = [0, far, far, n]
  while (stack.length) {
    const b = stack.pop()!,
      a = stack.pop()!
    const ax = X(a),
      ay = Y(a),
      dx = X(b) - ax,
      dy = Y(b) - ay
    const L = Math.hypot(dx, dy) || 1
    let best = -1,
      bd = tol
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((X(i) - ax) * dy - (Y(i) - ay) * dx) / L
      if (d > bd) {
        bd = d
        best = i
      }
    }
    if (best >= 0) {
      keep[best] = 1
      stack.push(a, best, best, b)
    }
  }
  const out: Flat = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(ring[i * 2], ring[i * 2 + 1])
  return out.length >= 6 ? out : ring
}
