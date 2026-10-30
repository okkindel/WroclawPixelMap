// Rok budowy z rejestru zabytków NID dla budynków bez start_date: po adresach w obrysie
// i (osobny krok) po punktach adresowych tuż obok budynku.
import type { Building, Flat } from '../../../src/types/world.ts'
import type { OsmEl, Tags } from '../../lib/osm.ts'
import { NID_NEAR_RADIUS, nidNearSkip } from '../../lib/rules.ts'
import type { NidHit, NidIndex } from '../nid.ts'
import { type Pt, type RawPoly, pointInRing, proj } from './geometry.ts'
import { buildingGrid, ownerAt } from './grid.ts'

// Punkty adresowe w siatce 50 m: budynek dostaje adresy punktów leżących w jego obrysie.
const ADDR_CELL = 50

export class NidMatcher {
  private nid: NidIndex | null
  private addrGrid = new Map<string, { p: Pt; t: Tags }[]>()
  // statystyki do logu
  rows = new Set<number>()
  buildings = 0
  near = 0

  constructor(nid: NidIndex | null, addresses: OsmEl[]) {
    this.nid = nid
    for (const el of addresses) {
      if (el.type !== 'node' || !el.tags || el.lat == null || el.lon == null) continue
      const p = proj(el.lat, el.lon),
        k = `${Math.floor(p[0] / ADDR_CELL)},${Math.floor(p[1] / ADDR_CELL)}`
      const cell = this.addrGrid.get(k) ?? []
      cell.push({ p, t: el.tags })
      this.addrGrid.set(k, cell)
    }
  }

  private lookup(a: Tags) {
    return this.nid?.lookup(a['addr:street'] ?? a['addr:place'], a['addr:housenumber']) ?? null
  }

  // Rok dla budynku: jego własny adres i punkty adresowe w obrysie; najstarszy wpis.
  yearFor(t: Tags, poly: RawPoly): NidHit | null {
    if (!this.nid) return null
    const addrs = [t]
    const xs = poly.outer.map((q) => q[0]),
      ys = poly.outer.map((q) => q[1])
    for (let cx = Math.floor(Math.min(...xs) / ADDR_CELL); cx <= Math.floor(Math.max(...xs) / ADDR_CELL); cx++)
      for (let cy = Math.floor(Math.min(...ys) / ADDR_CELL); cy <= Math.floor(Math.max(...ys) / ADDR_CELL); cy++)
        for (const a of this.addrGrid.get(`${cx},${cy}`) ?? [])
          if (pointInRing(a.p, poly.outer) && !poly.holes.some((h) => pointInRing(a.p, h))) addrs.push(a.t)
    let best: NidHit | null = null
    for (const a of addrs) {
      const hit = this.lookup(a)
      if (hit) for (const r of hit.rows) this.rows.add(r)
      if (hit && (!best || hit.y < best.y)) best = hit
    }
    if (best) this.buildings++
    return best
  }

  // Punkt adresowy z wpisem NID poza obrysami (np. przy wejściu, na chodniku): rok dostaje najbliższy budynek
  // do NID_NEAR_RADIUS m — tylko taki, który nie ma jeszcze roku (nie nadpisujemy start_date z OSM).
  assignNear(buildings: Building[]) {
    if (!this.nid) return
    const CELL = 200
    const grid = buildingGrid(buildings, CELL)
    const owner = ownerAt(buildings, grid, CELL)
    const R = NID_NEAR_RADIUS
    for (const cell of this.addrGrid.values())
      for (const a of cell) {
        const hit = this.lookup(a.t)
        if (!hit || owner(...a.p) != null) continue
        let bi = -1,
          bd = R
        for (let x = Math.floor((a.p[0] - R) / CELL); x <= Math.floor((a.p[0] + R) / CELL); x++)
          for (let y = Math.floor((a.p[1] - R) / CELL); y <= Math.floor((a.p[1] + R) / CELL); y++)
            for (const i of grid.get(`${x},${y}`) ?? []) {
              const b = buildings[i]
              if (nidNearSkip(b.k)) continue
              const d = segDist(a.p, b.o)
              if (d < bd) {
                bd = d
                bi = i
              }
            }
        const b = buildings[bi]
        if (!b) continue
        for (const r of hit.rows) this.rows.add(r)
        if (b.y != null) continue
        this.buildings++
        this.near++
        b.y = hit.y
      }
  }

  log(buildings: Building[]) {
    if (!this.nid) return
    const withYear = buildings.filter((b) => b.y != null).length
    console.log(
      `NID: wierszy z Wrocławia ${this.nid.rows}, z rokiem ${this.nid.parsed}, dopasowanych do budynków ${this.rows.size}; budynków z rokiem z NID ${this.buildings} (w tym ${this.near} najbliższych punktowi adresowemu), z rokiem ogółem ${withYear}/${buildings.length}`,
    )
  }
}

// Odległość punktu od obwodu pierścienia.
function segDist([x, y]: Pt, o: Flat) {
  let best = Infinity
  for (let i = 0; i < o.length; i += 2) {
    const ax = o[i],
      ay = o[i + 1],
      bx = o[(i + 2) % o.length],
      by = o[(i + 3) % o.length]
    const dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy
    const u = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0
    best = Math.min(best, Math.hypot(x - ax - u * dx, y - ay - u * dy))
  }
  return best
}
