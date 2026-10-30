// Geometria wypiekania: pierścienie OSM → wielokąty w metrach lokalnych, przycięte do BBOX mapy.
import type { Flat, Poly } from '../../../src/types/world.ts'
import { BBOX } from '../../lib/config.ts'
import { type Pt, projection, r1 } from '../../lib/geo.ts'
import type { LatLon, OsmEl } from '../../lib/osm.ts'

export type { Pt }
export interface RawPoly {
  outer: Pt[]
  holes: Pt[][]
}

const [S, W, N, E] = BBOX
export const { proj } = projection()
export const [MINX, MINY] = proj(S, W)
export const [MAXX, MAXY] = proj(N, E)

export const wayPts = (geom: (LatLon | null)[]): Pt[] => geom.filter((g): g is LatLon => !!g).map((g) => proj(g.lat, g.lon))
export const same = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05
export const inBox = ([x, y]: Pt) => x >= MINX && x <= MAXX && y >= MINY && y <= MAXY

// Skleja odcinki (członków relacji) w zamknięte pierścienie.
function joinRings(lines: Pt[][]): Pt[][] {
  const rings: Pt[][] = []
  const pool = lines.filter((l) => l.length > 1).map((l) => l.slice())
  while (pool.length) {
    let ring = pool.shift()!
    let grew = true
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i]
        const end = ring[ring.length - 1]
        if (same(end, l[0])) ring = ring.concat(l.slice(1))
        else if (same(end, l[l.length - 1])) ring = ring.concat(l.slice(0, -1).reverse())
        else continue
        pool.splice(i, 1)
        grew = true
        break
      }
    }
    if (ring.length >= 4) rings.push(ring)
  }
  return rings
}

function lerpAt(a: Pt, b: Pt, axis: 0 | 1, v: number): Pt {
  const t = (v - a[axis]) / (b[axis] - a[axis])
  return [r1(a[0] + (b[0] - a[0]) * t), r1(a[1] + (b[1] - a[1]) * t)]
}

// Sutherland–Hodgman względem prostokąta bboxa.
function clipRing(ring: Pt[]): Pt[] | null {
  const edges = [(p: Pt) => p[0] >= MINX, (p: Pt) => p[0] <= MAXX, (p: Pt) => p[1] >= MINY, (p: Pt) => p[1] <= MAXY]
  const cut = [
    (a: Pt, b: Pt) => lerpAt(a, b, 0, MINX),
    (a: Pt, b: Pt) => lerpAt(a, b, 0, MAXX),
    (a: Pt, b: Pt) => lerpAt(a, b, 1, MINY),
    (a: Pt, b: Pt) => lerpAt(a, b, 1, MAXY),
  ]
  let out = ring
  for (let e = 0; e < 4 && out.length; e++) {
    const inp = out
    out = []
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i]
      const prev = inp[(i + inp.length - 1) % inp.length]
      const ci = edges[e](cur),
        pi = edges[e](prev)
      if (ci) {
        if (!pi) out.push(cut[e](prev, cur))
        out.push(cur)
      } else if (pi) out.push(cut[e](prev, cur))
    }
  }
  return out.length >= 3 ? out : null
}

export function openRing(r: Pt[]): Pt[] {
  return same(r[0], r[r.length - 1]) ? r.slice(0, -1) : r
}
export const flat = (pts: Pt[]): Flat => pts.flat()
// odwrotnie: [x, y, x, y, ...] -> [[x, y], ...]
export function ringOf(o: Flat): Pt[] {
  const r: Pt[] = []
  for (let i = 0; i < o.length; i += 2) r.push([o[i], o[i + 1]])
  return r
}
// średnia wierzchołków listy punktów
export function meanPt(pts: Pt[]): Pt {
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
}

export function pointInRing([x, y]: Pt, ring: Pt[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// Zwraca listę wielokątów [{outer, holes}] dla way/relation.
export function polygons(el: OsmEl): RawPoly[] {
  if (el.type === 'way') {
    if (!el.geometry) return []
    const r = clipRing(openRing(wayPts(el.geometry)))
    return r ? [{ outer: r, holes: [] }] : []
  }
  const members = el.members || []
  const ring = (inner: boolean) =>
    joinRings(members.flatMap((m) => (m.type === 'way' && (m.role === 'inner') === inner && m.geometry ? [wayPts(m.geometry)] : [])))
  const outers = ring(false)
  const inners = ring(true)
  const polys: RawPoly[] = outers.map((o) => ({ outer: openRing(o), holes: [] }))
  for (const h of inners) {
    const ring = openRing(h)
    const owner = polys.find((p) => pointInRing(ring[0], p.outer))
    if (owner) owner.holes.push(ring)
  }
  return polys.flatMap((p) => {
    const outer = clipRing(p.outer)
    return outer ? [{ outer, holes: p.holes.map(clipRing).filter((h): h is Pt[] => !!h) }] : []
  })
}

// Suma ze wzoru Gaussa (podwojone pole ze znakiem zależnym od kierunku obiegu).
function shoelace(r: Pt[]) {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1])
  return a
}
export const ringArea = (r: Pt[]) => Math.abs(shoelace(r) / 2)

// Odsunięcie wierzchołków pierścienia o d do środka (wzdłuż dwusiecznej; wystarczające dla małych d).
export function shrink(o: Flat, d: number): Flat {
  const ring = ringOf(o)
  const n = ring.length
  const sign = shoelace(ring) < 0 ? 1 : -1
  const out: Flat = []
  for (let i = 0; i < n; i++) {
    const [px, py] = ring[(i + n - 1) % n],
      [x, y] = ring[i],
      [qx, qy] = ring[(i + 1) % n]
    const l1 = Math.hypot(x - px, y - py) || 1,
      l2 = Math.hypot(qx - x, qy - y) || 1
    const nx = (-(y - py) / l1 - (qy - y) / l2) * sign,
      ny = ((x - px) / l1 + (qx - x) / l2) * sign
    const L = Math.hypot(nx, ny) || 1
    out.push(r1(x + (nx / L) * d), r1(y + (ny / L) * d))
  }
  return out
}

export const encodePoly = (p: RawPoly): Poly => ({ o: flat(p.outer), h: p.holes.length ? p.holes.map(flat) : undefined })
