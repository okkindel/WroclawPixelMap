// Budynki: ściany z oknami, dachy płaskie albo spadziste (na prostokącie otaczającym).
import * as THREE from 'three'
import { C } from '../engine/palette.ts'
import { hash, signedArea } from '../engine/geo.ts'
import type { Building, Flat } from '../types/world.ts'
import { Geo, flatPoly, walls, type V3 } from './geometry.ts'

const col = new THREE.Color()
function parseColor(c: string | undefined, fallback: string) {
  if (!c) return fallback
  try {
    col.setStyle(c.replace(/^([0-9a-f]{6})$/i, '#$1'))
    return '#' + col.getHexString()
  } catch {
    return fallback
  }
}
const pick = <T>(arr: T[], r: number): T => arr[Math.floor(r * arr.length) % arr.length]

// Minimalny prostokąt otaczający (po krawędziach wielokąta).
interface Rect { area: number; ux: number; uy: number; a0: number; a1: number; b0: number; b1: number }
function minRect(ring: Flat): Rect | null {
  let best: Rect | null = null
  const n = ring.length / 2
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const ex = ring[j * 2] - ring[i * 2], ey = ring[j * 2 + 1] - ring[i * 2 + 1]
    const L = Math.hypot(ex, ey)
    if (L < 0.5) continue
    const ux = ex / L, uy = ey / L
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity
    for (let k = 0; k < n; k++) {
      const x = ring[k * 2], y = ring[k * 2 + 1]
      const a = x * ux + y * uy, b = -x * uy + y * ux
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b)
    }
    const area = (a1 - a0) * (b1 - b0)
    if (!best || area < best.area) best = { area, ux, uy, a0, a1, b0, b1 }
  }
  return best
}

function polyArea(ring: Flat) { return Math.abs(signedArea(ring)) }

// Dach dwuspadowy / czterospadowy na prostokącie. Zwraca false, gdy kształt się nie nadaje.
function pitchedRoof(geo: Geo, ring: Flat, top: number, shape: string, color: string) {
  const r = minRect(ring)
  if (!r || polyArea(ring) / r.area < 0.78) return false
  let { ux, uy, a0, a1, b0, b1 } = r
  // oś kalenicy wzdłuż dłuższego boku
  if (b1 - b0 > a1 - a0) { [ux, uy] = [-uy, ux];[a0, a1, b0, b1] = [b0, b1, -a1, -a0] }
  const w = b1 - b0
  if (w > 28) return false
  const rh = Math.min(w * 0.42, 9)
  const P = (a: number, b: number, h: number): V3 => [a * ux - b * uy, top + h, -(a * uy + b * ux)]
  const bm = (b0 + b1) / 2
  const inset = shape === 'hipped' || shape === 'half-hipped' || shape === 'pyramidal' ? Math.min(w / 2, (a1 - a0) / 2) : 0
  const r0 = P(a0 + inset, bm, rh), r1 = P(a1 - inset, bm, rh)
  const c00 = P(a0, b0, 0), c10 = P(a1, b0, 0), c11 = P(a1, b1, 0), c01 = P(a0, b1, 0)
  const slopeN = (side: number): V3 => {
    const ny = w / 2, nb = rh * side
    const L = Math.hypot(ny, nb)
    return [(-nb * uy) / L, ny / L, -(nb * ux) / L]
  }
  geo.quad(c00, c10, r1, r0, slopeN(-1), color)
  geo.quad(c11, c01, r0, r1, slopeN(1), color)
  const endN = (s: number): V3 => [s * ux, 0.6, -s * uy]
  if (inset > 0) {
    geo.tri(c01, c00, r0, endN(-1), color)
    geo.tri(c10, c11, r1, endN(1), color)
  } else {
    geo.tri(c01, c00, r0, endN(-1), color, 1)
    geo.tri(c10, c11, r1, endN(1), color, 1)
  }
  return true
}

const TILE_ROOFS = new Set(['gabled', 'hipped', 'half-hipped', 'mansard', 'gambrel', 'pyramidal', 'skillion', 'round', 'dome', 'onion'])

export interface BuildingMod { H?: number; wall?: string; roof?: string; flat?: boolean }
export interface BuildOpts {
  keep?: (b: Building, idx: number) => boolean
  mod?: (b: Building, idx: number) => BuildingMod | undefined
}

// seed: przesunięcie dla wariantów kolorów, żeby sąsiednie kafle nie wyglądały tak samo
export function buildBuildings(buildings: Building[], opts: BuildOpts = {}, seed = 0) {
  const geo = new Geo()
  buildings.forEach((b, idx) => {
    if (opts.keep && !opts.keep(b, idx)) return
    geo.owner = idx
    const r = hash(idx + seed, 7), r2 = hash(idx + seed, 13)
    const kind = b.k
    const old = (b.y && b.y < 1939) || (!!b.rs && TILE_ROOFS.has(b.rs))
    // pastele tylko dla starej zabudowy; nowsze mieszkalne/ogólne dostają biele i szarości
    const set = (kind === 'res' || kind === 'gen') && !old ? C.walls.modern : C.walls[kind] || C.walls.gen
    // kolejność: kolor z OSM > materiał z OSM > wariant typowy dla rodzaju budynku
    let wall = parseColor(b.c, (b.bm && C.wallMaterial[b.bm]) || pick(set, r))
    // dach: kolor z OSM > zdjęcie lotnicze GUGiK > materiał z OSM > wariant typowy
    const typical = kind === 'church' ? pick(C.roofChurch, r2) : old ? pick(C.roofTile, r2) : pick(C.roofFlat, r2)
    let roof = parseColor(b.rc, b.oc || (b.rm && C.roofMaterial[b.rm]) || typical)
    let H = b.H, base = b.m || 0, shape = b.rs
    const m = opts.mod && opts.mod(b, idx)
    if (m) {
      if (m.H != null) H = m.H
      if (m.wall) wall = m.wall
      if (m.roof) roof = m.roof
      if (m.flat) shape = undefined
    }
    if (H <= base + 0.3) return
    const win = kind === 'low' || kind === 'roof' || kind === 'ruin' || kind === 'chimney' || kind === 'tank' || (m && m.flat) ? 0 : 1
    let wallTop = H
    let pitched = false
    if (shape && TILE_ROOFS.has(shape) && !b.h && H - base > 5) {
      const w = minRect(b.o)
      const rh = w ? Math.min(Math.min(w.a1 - w.a0, w.b1 - w.b0) * 0.42, 9) : 0
      wallTop = Math.max(base + 2.5, H - rh)
      pitched = pitchedRoof(geo, b.o, wallTop, shape, roof)
      if (!pitched) wallTop = H
    }
    // Dachówka (spadzisty dach w OSM albo ceglasty kolor na zdjęciu), a kształt nie jest prostokątem
    // albo ma dziedziniec: dach kopertowy wzdłuż wszystkich krawędzi (kamienice w kwartałach, gmachy z dziedzińcami).
    if (!pitched && !m?.flat && H - base > 6 && kind !== 'chimney' && kind !== 'tank' && (TILE_ROOFS.has(shape ?? '') || tileColour(roof))) {
      const d = 5.5, rh = 4
      wallTop = Math.max(base + 2.5, H - rh)
      pitched = ringRoof(geo, b.o, b.h, wallTop, d, H - wallTop, roof)
      if (!pitched) wallTop = H
    }
    if (kind === 'chimney' && !m?.flat) {
      // komin: betonowy trzon, u góry biało-czerwone pasy ostrzegawcze
      const bands = wallTop - base > 60 ? 5 : 3
      const bandH = Math.min(6, (wallTop - base) / 12)
      const stripes = wallTop - bands * bandH
      walls(geo, b.o, base, stripes, wall, 0)
      for (let i = 0; i < bands; i++) walls(geo, b.o, stripes + i * bandH, stripes + (i + 1) * bandH, i % 2 ? '#f4f1e6' : '#c8312f', 0)
      roof = '#2b2d42'
    } else walls(geo, b.o, base, wallTop, wall, win)
    if (b.h) for (const h of b.h) walls(geo, h, base, wallTop, wall, win)
    if (!pitched) flatPoly(geo, b.o, b.h, wallTop, roof)
  })
  return geo.build()
}

// czerwień/brąz dachówki: czerwony wyraźnie przeważa nad niebieskim
function tileColour(hex: string) {
  col.set(hex)
  return col.r > col.b * 1.35 && col.r > col.g * 1.1 && col.r > 0.12
}

// Odsunięcie pierścienia o d w stronę dachu (do środka obrysu, na zewnątrz dziedzińca), z fazowaniem narożników.
function insetRing(ring: Flat, d: number, towardInside: boolean): Flat {
  const n = ring.length / 2
  const sign = (signedArea(ring) > 0 ? 1 : -1) * (towardInside ? 1 : -1)
  const out: Flat = []
  for (let i = 0; i < n; i++) {
    const p = (i + n - 1) % n, q = (i + 1) % n
    const x = ring[i * 2], y = ring[i * 2 + 1]
    const e1x = x - ring[p * 2], e1y = y - ring[p * 2 + 1], e2x = ring[q * 2] - x, e2y = ring[q * 2 + 1] - y
    const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1
    const n1x = (-e1y / l1) * sign, n1y = (e1x / l1) * sign, n2x = (-e2y / l2) * sign, n2y = (e2x / l2) * sign
    const k = Math.min(3, 1 / Math.max(0.33, (1 + n1x * n2x + n1y * n2y) / 2))
    out.push(x + ((n1x + n2x) / 2) * d * k, y + ((n1y + n2y) / 2) * d * k)
  }
  return out
}

// Dach kopertowy dla dowolnego obrysu: połacie od krawędzi do linii odsuniętej o d, na górze płaski kalenicowy pas.
function ringRoof(geo: Geo, outer: Flat, holes: Flat[] | undefined, top: number, d: number, rh: number, color: string) {
  const area = Math.abs(signedArea(outer)) - (holes ?? []).reduce((s, h) => s + Math.abs(signedArea(h)), 0)
  if (area < 120 || outer.length / 2 > 160) return false
  const rings: [Flat, Flat][] = [[outer, insetRing(outer, d, true)], ...(holes ?? []).map((h): [Flat, Flat] => [h, insetRing(h, d, false)])]
  for (const [r, ins] of rings) {
    const n = r.length / 2
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const a: V3 = [r[i * 2], top, -r[i * 2 + 1]], b2: V3 = [r[j * 2], top, -r[j * 2 + 1]]
      const c: V3 = [ins[j * 2], top + rh, -ins[j * 2 + 1]], e: V3 = [ins[i * 2], top + rh, -ins[i * 2 + 1]]
      // normalna połaci z iloczynu wektorowego, skierowana w górę
      const ux = b2[0] - a[0], uz = b2[2] - a[2], vx = e[0] - a[0], vy = rh, vz = e[2] - a[2]
      let nx = vy * uz, ny = uz * vx - ux * vz, nz = -ux * vy
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz }
      const L = Math.hypot(nx, ny, nz) || 1
      // kolejność wierzchołków zgodna z normalną w górę (inaczej połać byłaby odrzucona jako tylna ściana)
      const cy = (b2[2] - a[2]) * (c[0] - a[0]) - (b2[0] - a[0]) * (c[2] - a[2])
      if (cy >= 0) geo.quad(a, b2, c, e, [nx / L, ny / L, nz / L], color)
      else geo.quad(a, e, c, b2, [nx / L, ny / L, nz / L], color)
    }
  }
  // środek dachu: płaski, na wysokości okapu (odsunięty wielokąt bywa samoprzecinający się przy wielu wierzchołkach)
  flatPoly(geo, outer, holes, top + 0.05, color)
  return true
}
