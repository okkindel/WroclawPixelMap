// Rzutowanie lat/lon -> lokalne metry (x = wschód, y = północ), to samo co w scripts/bake.ts.
// W scenie three.js: X = x, Y = wysokość, Z = -y.
let ORIGIN: [number, number] = [51.11, 17.0425]
let KX = Math.cos((ORIGIN[0] * Math.PI) / 180) * 111320
const KY = 110540

export function setOrigin(origin: [number, number]) {
  ORIGIN = origin
  KX = Math.cos((ORIGIN[0] * Math.PI) / 180) * 111320
}

export const toLocal = (lat: number, lon: number): [number, number] => [(lon - ORIGIN[1]) * KX, (lat - ORIGIN[0]) * KY]
export const toLatLon = (x: number, y: number): [number, number] => [y / KY + ORIGIN[0], x / KX + ORIGIN[1]]

// Prosty deterministyczny hash 0..1 do „losowych”, ale stałych wariantów.
export function hash(a: number, b = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// Element tablicy wybrany wartością r z przedziału 0..1 (np. z hash).
export const pick = <T>(arr: T[], r: number): T => arr[Math.floor(r * arr.length) % arr.length]

export function pointInRing(x: number, y: number, ring: number[]) {
  let inside = false
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function centroid(flat: number[]): [number, number] {
  let sx = 0, sy = 0
  const n = flat.length / 2
  for (let i = 0; i < flat.length; i += 2) { sx += flat[i]; sy += flat[i + 1] }
  return [sx / n, sy / n]
}

// Prostokąt otaczający [x0, y0, x1, y1].
export function bbox(flat: number[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < flat.length; i += 2) {
    x0 = Math.min(x0, flat[i]); x1 = Math.max(x1, flat[i])
    y0 = Math.min(y0, flat[i + 1]); y1 = Math.max(y1, flat[i + 1])
  }
  return [x0, y0, x1, y1]
}

// Długości narastające wzdłuż polilinii: [0, |p0p1|, |p0p1|+|p1p2|, ...].
export function cumLengths(p: number[]): number[] {
  const cum = [0]
  for (let i = 2; i < p.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]))
  return cum
}

export function signedArea(flat: number[]) {
  let a = 0
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) a += (flat[j] + flat[i]) * (flat[j + 1] - flat[i + 1])
  return -a / 2
}

// Odległość punktu od polilinii (płaskie [x,y,x,y...]).
export function distToPolyline(x: number, y: number, p: number[]) {
  let best = Infinity
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3]
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y))
  }
  return best
}
