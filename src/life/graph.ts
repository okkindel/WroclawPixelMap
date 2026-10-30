// Graf ruchu: krawędzie = odcinki dróg/torów z OSM, węzły = wspólne końce (zaokrąglone do 0.5 m).
import type { Flat } from '../types/world.ts'

export interface Edge { p: Flat; cum: number[]; len: number; a: string; b: string; y: number }

const key = (x: number, y: number) => `${Math.round(x * 2)},${Math.round(y * 2)}`

export class Graph {
  edges: Edge[] = []
  at = new Map<string, number[]>()
  constructor(lines: { p: Flat; b?: 1 }[]) {
    for (const l of lines) {
      if (l.p.length < 4) continue
      const cum = [0]
      for (let i = 2; i < l.p.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(l.p[i] - l.p[i - 2], l.p[i + 1] - l.p[i - 1]))
      const len = cum[cum.length - 1]
      if (len < 1) continue
      const n = l.p.length
      const e: Edge = { p: l.p, cum, len, a: key(l.p[0], l.p[1]), b: key(l.p[n - 2], l.p[n - 1]), y: l.b ? 1.2 : 0.2 }
      const id = this.edges.push(e) - 1
      for (const k of [e.a, e.b]) {
        const list = this.at.get(k) ?? []
        list.push(id)
        this.at.set(k, list)
      }
    }
  }
  // Pozycja i kierunek na krawędzi w odległości s od początku.
  sample(e: Edge, s: number, out: { x: number; y: number; dx: number; dy: number }) {
    let i = 1
    while (i < e.cum.length - 1 && e.cum[i] < s) i++
    const s0 = e.cum[i - 1], s1 = e.cum[i]
    const t = s1 > s0 ? (s - s0) / (s1 - s0) : 0
    const ax = e.p[(i - 1) * 2], ay = e.p[(i - 1) * 2 + 1], bx = e.p[i * 2], by = e.p[i * 2 + 1]
    out.x = ax + (bx - ax) * t
    out.y = ay + (by - ay) * t
    const L = Math.hypot(bx - ax, by - ay) || 1
    out.dx = (bx - ax) / L
    out.dy = (by - ay) / L
  }
}

