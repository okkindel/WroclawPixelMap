// Teren: tło, zieleń, place, woda, ulice, tory i mosty.
import { C } from '../engine/palette.ts'
import type { TileData, World } from '../types/world.ts'
import { Geo, flatPoly, strip } from './geometry.ts'

// kolor z palety C (wpis będący pojedynczym kolorem; brak = pusty napis)
const S = (k: string) => {
  const v = C[k]
  return typeof v === 'string' ? v : ''
}

function roadColor(k: string, car?: 1) {
  if (k === 'service' || k === 'living_street') return S('asphaltLight')
  if (car) return S('asphalt')
  if (k === 'path' || k === 'track') return S('path')
  return S('paving')
}

// Podkład pod obszarem danych (tło dookoła to płaszczyzna w app.ts).
export function buildBase(bounds: World['bounds']) {
  const ground = new Geo()
  const [x0, y0, x1, y1] = bounds
  ground.quad([x0, 0, -y0], [x1, 0, -y0], [x1, 0, -y1], [x0, 0, -y1], [0, 1, 0], S('ground'))
  return ground.build()
}

// odstęp poziomów dróg różnych rodzajów i wysokość torów (nad najwyższym poziomem dróg)
const ROAD_STEP = 0.006
const RAILS_Y = 0.3

export function buildGround(data: TileData) {
  const ground = new Geo()

  const order: Record<string, number> = { wood: 0.06, park: 0.04, grass: 0.05, pitch: 0.07, play: 0.08 }
  for (const g of data.green) flatPoly(ground, g.o, g.h, order[g.k] ?? 0.05, S(g.k) || S('grass'))
  // place pod zielenią: skwery bywają jednocześnie placem (place=square) i parkiem
  for (const p of data.plazas) flatPoly(ground, p.o, p.h, 0.03, S('plaza'))

  const water = new Geo(),
    waterLate = new Geo()
  // woda nad zielenią i placami (fontanny i stawy bywają w środku łąki albo parku), pod drogami;
  // późniejsza (kanały, porty, zbiorniki) w osobnej siatce, chowanej w dawnych epokach
  for (const w of data.water) flatPoly(w.late ? waterLate : water, w.o, w.h, 0.1, S('water'))

  const roads = new Geo()
  // Każdy kolor drogi (rodzaj) na własnym poziomie, co ROAD_STEP m, węższe niżej: drogi różnych rodzajów
  // nachodzące na siebie na tej samej wysokości migotały (z-fighting). Ta sama barwa może leżeć równo.
  const sorted = data.roads.slice().sort((a, b) => a.w - b.w)
  const level = new Map<string, number>()
  for (const r of sorted) {
    if (r.b) continue
    const color = roadColor(r.k, r.car)
    if (!level.has(color)) level.set(color, level.size)
    strip(roads, r.p, r.w, (r.car ? 0.14 : 0.12) + level.get(color)! * ROAD_STEP, color)
  }
  // tory nad wszystkimi jezdniami (tramwaj jedzie środkiem ulicy)
  for (const r of data.rails) if (!r.b) strip(roads, r.p, 3.2, RAILS_Y, S('rail'))
  for (const t of data.trams) if (!t.b) strip(roads, t.p, 1.6, RAILS_Y + 0.02, S('tramTrack'))

  // Mosty: pomost nad wodą + jezdnia na nim.
  const bridges = new Geo()
  for (const r of data.roads) {
    if (!r.b) continue
    strip(bridges, r.p, r.w + 2, 1.0, '#6b6560')
    strip(bridges, r.p, r.w, 1.12, roadColor(r.k, r.car))
  }
  for (const t of data.trams) if (t.b) strip(bridges, t.p, 1.6, 1.2, S('tramTrack'))
  for (const r of data.rails)
    if (r.b) {
      strip(bridges, r.p, 6, 1.0, '#565a75')
      strip(bridges, r.p, 3.2, 1.1, S('rail'))
    }

  return { ground: ground.build(), water: water.build(), waterLate: waterLate.build(), roads: roads.build(), bridges: bridges.build() }
}
