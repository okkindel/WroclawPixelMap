// Konstrukcje (wieże, maszty, jupitery) i koleje linowe ze słupami.
import { centroid } from '../../../src/engine/geo.ts'
import type { Aerialway, Structure, World } from '../../../src/types/world.ts'
import { r1 } from '../../lib/geo.ts'
import { num, type OsmEl, type Tags, year } from '../../lib/osm.ts'
import {
  FLOODLIGHT_MAX_DIST,
  PYLON_H,
  PYLON_MAX_DIST,
  STRUCTURE_FALLBACK_H,
  STRUCTURE_H,
  isTrivialMast,
  structureKind,
  structureRadius,
} from '../../lib/rules.ts'
import { flat, inBox, meanPt, openRing, proj, ringArea, wayPts } from './geometry.ts'

export interface Built {
  list: Structure[]
  lines: Aerialway[]
}

export function structures(rawStructures: OsmEl[], out: World): Built {
  const list: Structure[] = []
  const pylons: [number, number, number][] = []
  const lines: Aerialway[] = []
  for (const el of rawStructures) {
    const t: Tags = el.tags || {}
    if (t.building || t['building:part']) continue // takie są już budynkami (albo częścią budynku, np. wieża kościoła)
    const pts = el.type === 'way' && el.geometry ? wayPts(el.geometry) : el.lat != null && el.lon != null ? [proj(el.lat, el.lon)] : []
    if (!pts.length) continue
    const [cx, cy] = meanPt(pts)
    const H = num(t.height)
    if (t.aerialway === 'pylon') {
      pylons.push([r1(cx), r1(cy), H ?? PYLON_H])
      continue
    }
    if (t.aerialway && el.type === 'way') {
      lines.push({ p: flat(pts), pylons: [], n: t.name, yr: year(t.start_date) ?? undefined })
      continue
    }
    const m = t.man_made
    if (!m || m === 'flagpole') continue
    if (isTrivialMast(m, H, t)) continue
    const r = structureRadius(m, el.type === 'way' ? ringArea(openRing(pts)) : null)
    const h = H ?? STRUCTURE_H[m] ?? STRUCTURE_FALLBACK_H
    const k = structureKind(t, m, h, r)
    if (inBox([cx, cy])) list.push({ x: r1(cx), y: r1(cy), H: r1(h), r: r1(r), k, n: t.name, yr: year(t.start_date) ?? undefined })
  }
  // słupy przypisujemy do najbliższej kolei linowej
  for (const p of pylons) {
    let best: Aerialway | undefined,
      bd = PYLON_MAX_DIST
    for (const l of lines) {
      for (let i = 0; i < l.p.length; i += 2) {
        const d = Math.hypot(l.p[i] - p[0], l.p[i + 1] - p[1])
        if (d < bd) {
          bd = d
          best = l
        }
      }
    }
    best?.pylons.push(p)
  }
  // jupitery świecą w stronę najbliższego stadionu albo boiska (środek obrysu)
  for (const s of list) {
    if (s.k !== 'light') continue
    let best: [number, number] | null = null,
      bd = FLOODLIGHT_MAX_DIST
    for (const st of out.stadiums) {
      const [cx, cy] = centroid(st.o)
      const d = Math.hypot(cx - s.x, cy - s.y)
      if (d < bd) {
        bd = d
        best = [cx, cy]
      }
    }
    if (best) s.az = Math.atan2(best[1] - s.y, best[0] - s.x)
  }
  return { list, lines }
}
