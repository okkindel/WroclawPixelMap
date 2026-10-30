// Wały: przekrój (profil) przeciągnięty wzdłuż polilinii, palisada na koronie, wały nowożytne z fosą i bastionami.
import * as THREE from 'three'
import type { Flat } from '../types/world.ts'
import { Geo, flatPoly, type V3 } from '../world/geometry.ts'
import { C } from '../engine/palette.ts'

// Punkt profilu: [przesunięcie od osi na zewnątrz (m), wysokość (m), kolor ściany od poprzedniego punktu].
export type Profile = [number, number, string][]

export const doubleLambert = () => new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
export const WATER = typeof C.water === 'string' ? C.water : '#2c5d8a'

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
function normal(a: V3, b: V3, c: V3, inner: V3): V3 {
  const u = sub(b, a),
    v = sub(c, a)
  let n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const L = Math.hypot(...n) || 1
  n = [n[0] / L, n[1] / L, n[2] / L]
  // normalna od wnętrza bryły (materiał dwustronny, więc kolejność wierzchołków nie gra roli)
  const d = sub(a, inner)
  return d[0] * n[0] + d[1] * n[1] + d[2] * n[2] < 0 ? [-n[0], -n[1], -n[2]] : n
}

// Wał wzdłuż polilinii p. `out(mx, my)` mówi, gdzie jest zewnątrz: punkt, od którego się oddalamy.
// Odcinki przedłużone o `extend`, żeby na załamaniach nie było szpar; końce zamknięte ścianą profilu.
export function rampart(geo: Geo, p: Flat, profile: Profile, from: [number, number], extend = 3) {
  const n = p.length / 2
  const cx = profile.reduce((s, q) => s + q[0], 0) / profile.length
  const ch = profile.reduce((s, q) => s + q[1], 0) / profile.length
  for (let i = 0; i + 1 < n; i++) {
    let ax = p[i * 2],
      ay = p[i * 2 + 1],
      bx = p[i * 2 + 2],
      by = p[i * 2 + 3]
    const L = Math.hypot(bx - ax, by - ay)
    if (L < 0.5) continue
    const dx = (bx - ax) / L,
      dy = (by - ay) / L
    const ea = i > 0 ? extend : 0,
      eb = i + 2 < n ? extend : 0
    ax -= dx * ea
    ay -= dy * ea
    bx += dx * eb
    by += dy * eb
    // normalna w lewo od kierunku; odwracamy, jeśli wskazuje do środka
    let nx = -dy,
      ny = dx
    if (nx * ((ax + bx) / 2 - from[0]) + ny * ((ay + by) / 2 - from[1]) < 0) {
      nx = -nx
      ny = -ny
    }
    const at = (x: number, y: number, q: [number, number, string]): V3 => [x + nx * q[0], q[1], -(y + ny * q[0])]
    const inner: V3 = [(ax + bx) / 2 + nx * cx, ch, -((ay + by) / 2 + ny * cx)]
    for (let k = 1; k < profile.length; k++) {
      const A0 = at(ax, ay, profile[k - 1]),
        B0 = at(bx, by, profile[k - 1]),
        B1 = at(bx, by, profile[k]),
        A1 = at(ax, ay, profile[k])
      geo.quad(A0, B0, B1, A1, normal(A0, B0, B1, inner), profile[k][2])
    }
    // czoła na końcach polilinii (wachlarz trójkątów; profil wypukły)
    for (const [x, y, end] of [
      [ax, ay, i === 0],
      [bx, by, i + 2 === n],
    ] as const) {
      if (!end) continue
      const nrm: V3 = x === ax ? [-dx, 0, dy] : [dx, 0, -dy]
      for (let k = 2; k < profile.length; k++)
        geo.tri(at(x, y, profile[0]), at(x, y, profile[k - 1]), at(x, y, profile[k]), nrm, profile[1][2])
    }
  }
}

// Prostopadłościan wzdłuż każdego odcinka polilinii (palisada, mur) od y0 do y1.
export function boxAlong(geo: Geo, p: Flat, width: number, y0: number, y1: number, color: string, keep = (_i: number) => true) {
  const hw = width / 2
  for (let i = 0; i + 3 < p.length; i += 2) {
    if (!keep(i / 2)) continue
    const ax = p[i],
      ay = p[i + 1],
      bx = p[i + 2],
      by = p[i + 3]
    const L = Math.hypot(bx - ax, by - ay)
    if (L < 0.3) continue
    const dx = (bx - ax) / L,
      dy = (by - ay) / L
    const sx = ax - dx * hw,
      sy = ay - dy * hw,
      ex = bx + dx * hw,
      ey = by + dy * hw
    const nx = -dy * hw,
      ny = dx * hw
    const c: [number, number][] = [
      [sx + nx, sy + ny],
      [ex + nx, ey + ny],
      [ex - nx, ey - ny],
      [sx - nx, sy - ny],
    ]
    const sides: V3[] = [
      [-dy, 0, -dx],
      [dx, 0, -dy],
      [dy, 0, dx],
      [-dx, 0, dy],
    ]
    for (let k = 0; k < 4; k++) {
      const [px, py] = c[k],
        [qx, qy] = c[(k + 1) % 4]
      geo.quad([px, y0, -py], [qx, y0, -qy], [qx, y1, -qy], [px, y1, -py], sides[k], color)
    }
    geo.quad([c[0][0], y1, -c[0][1]], [c[1][0], y1, -c[1][1]], [c[2][0], y1, -c[2][1]], [c[3][0], y1, -c[3][1]], [0, 1, 0], color)
  }
}

// Polilinia przesunięta o d na zewnątrz (od punktu `from`), z uśrednioną normalną w wierzchołkach.
export function offsetLine(p: Flat, d: number, from: [number, number]): Flat {
  const n = p.length / 2
  const out: Flat = []
  for (let i = 0; i < n; i++) {
    let nx = 0,
      ny = 0
    for (const [a, b] of [
      [i - 1, i],
      [i, i + 1],
    ]) {
      if (a < 0 || b >= n) continue
      const dx = p[b * 2] - p[a * 2],
        dy = p[b * 2 + 1] - p[a * 2 + 1]
      const L = Math.hypot(dx, dy) || 1
      nx += -dy / L
      ny += dx / L
    }
    const L = Math.hypot(nx, ny) || 1
    nx /= L
    ny /= L
    const x = p[i * 2],
      y = p[i * 2 + 1]
    if (nx * (x - from[0]) + ny * (y - from[1]) < 0) {
      nx = -nx
      ny = -ny
    }
    out.push(x + nx * d, y + ny * d)
  }
  return out
}

// Najbliższy (x, y) punkt polilinii przesunięty o d na zewnątrz (od `from`) i kierunek „na zewnątrz” [rad].
function alongWall(p: Flat, x: number, y: number, from: [number, number], d: number): [number, number, number] {
  let best = Infinity,
    out: [number, number, number] = [x, y, Math.atan2(y - from[1], x - from[0])]
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i],
      ay = p[i + 1],
      dx = p[i + 2] - ax,
      dy = p[i + 3] - ay
    const L2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2))
    const qx = ax + dx * t,
      qy = ay + dy * t
    const dist = Math.hypot(x - qx, y - qy)
    if (dist >= best) continue
    best = dist
    const L = Math.sqrt(L2)
    let nx = -dy / L,
      ny = dx / L
    if (nx * (qx - from[0]) + ny * (qy - from[1]) < 0) {
      nx = -nx
      ny = -ny
    }
    out = [qx + nx * d, qy + ny * d, Math.atan2(ny, nx)]
  }
  return out
}

// Wały nowożytne (XVI–XVIII w.): ceglana skarpa od strony fosy, trawiasta korona i stok od miasta.
// Oś `p` to dzisiejszy brzeg Fosy Miejskiej, więc wał leży tuż za nią, a fosa przed nim.
const BRICK = '#8a3b2a',
  BRICK_LIGHT = '#b5523a',
  GRASS = '#4a8a45',
  GRASS_SLOPE = '#7cb35a'
// nad podkładem z dawnego planu (0.25), pod mostami; przykrywa też dzisiejszą Fosę Miejską
const MOAT_Y = 0.3
const BASTION_OUT = 8 // środek bastionu przed osią wału [m]; tył (−30 m) chowa się w wale
const BASTION: [number, number][] = [
  [-30, -35],
  [15, -40],
  [55, 0],
  [15, 40],
  [-30, 35],
]

export function modernFortifications(p: Flat, bastions: [number, number][], center: [number, number]) {
  const geo = new Geo()
  // przekrój od zewnątrz do miasta
  rampart(
    geo,
    p,
    [
      [3, 0, BRICK],
      [-0.5, 8, BRICK], // skarpa z cegły, lekko pochylona
      [-1.5, 9, BRICK_LIGHT], // przedpiersie
      [-3, 9, GRASS],
      [-11, 8, GRASS],
      [-20, 0, GRASS_SLOPE],
    ],
    center,
  )
  // fosa: pas wody przed wałem (pod wodą z danych, więc dzisiejsza Fosa Miejska przykrywa go tam, gdzie jest)
  const a = offsetLine(p, 3, center),
    b = offsetLine(p, 26, center)
  const moat: Flat = a.concat(...Array.from({ length: b.length / 2 }, (_, i) => [b[b.length - 2 - i * 2], b[b.length - 1 - i * 2]]))
  flatPoly(geo, moat, undefined, MOAT_Y, WATER)

  for (const [bx0, by0] of bastions) {
    // bastion wysunięty przed wał, prostopadle do niego, w miejscu najbliższym podanemu punktowi
    const [x, y, ang] = alongWall(p, bx0, by0, center, BASTION_OUT)
    const rot = (s: number, dx = 0): Flat =>
      BASTION.flatMap(([u, v]) => {
        const U = u * s + dx,
          V = v * s
        return [x + U * Math.cos(ang) - V * Math.sin(ang), y + U * Math.sin(ang) + V * Math.cos(ang)]
      })
    // fosa wokół bastionu, potem ceglane ściany i trawiasta korona
    flatPoly(geo, rot(1.45, 14), undefined, MOAT_Y, WATER)
    const ring = rot(1)
    const closed = ring.concat(ring[0], ring[1])
    for (let i = 0; i + 3 < closed.length; i += 2) {
      const ax = closed[i],
        ay = closed[i + 1],
        bx = closed[i + 2],
        by = closed[i + 3]
      const L = Math.hypot(bx - ax, by - ay) || 1
      let nx = (by - ay) / L,
        ny = -(bx - ax) / L
      if (nx * ((ax + bx) / 2 - x) + ny * ((ay + by) / 2 - y) < 0) {
        nx = -nx
        ny = -ny
      }
      geo.quad([ax, 0, -ay], [bx, 0, -by], [bx, 9, -by], [ax, 9, -ay], [nx, 0, -ny], BRICK)
    }
    flatPoly(geo, ring, undefined, 9, GRASS)
    // przedpiersie na czołach bastionu
    boxAlong(geo, rot(0.97).slice(0, 8), 1.5, 9, 10, BRICK_LIGHT)
  }
  const mesh = new THREE.Mesh(geo.build(), doubleLambert())
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}
