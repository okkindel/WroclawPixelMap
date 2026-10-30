// Pojazdy i piesi jeżdżący po grafie; wieloczłonowe (tramwaje) podążają po śladzie czoła.
import * as THREE from 'three'
import { hash } from '../engine/geo.ts'
import type { Graph } from './graph.ts'

interface Agent {
  e: number
  s: number
  dir: 1 | -1
  speed: number
  trail: { x: number; y: number; d: number }[]
  odo: number
}

export class Movers {
  graph: Graph
  agents: Agent[] = []
  mesh: THREE.InstancedMesh
  // druga bryła o stałym kolorze, poruszana razem z pierwszą (np. głowy ludzi)
  extra: THREE.InstancedMesh | null = null
  segments: number
  gap: number
  offset: number
  private tmp = { x: 0, y: 0, dx: 0, dy: 0 }
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private sc = new THREE.Vector3(1, 1, 1)
  private up = new THREE.Vector3(0, 1, 0)

  constructor(
    graph: Graph,
    count: number,
    geo: THREE.BufferGeometry,
    colors: string[],
    speed: [number, number],
    opts: {
      segments?: number
      gap?: number
      offset?: number
      seed: number
      vertexColors?: boolean
      extra?: [THREE.BufferGeometry, string]
    },
  ) {
    this.graph = graph
    this.segments = opts.segments ?? 1
    this.gap = opts.gap ?? 0
    this.offset = opts.offset ?? 0
    const n = Math.min(count, graph.edges.length * 2)
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshLambertMaterial({ vertexColors: !!opts.vertexColors }),
      Math.max(1, n * this.segments),
    )
    this.mesh.castShadow = true
    this.mesh.frustumCulled = false
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const e = Math.floor(hash(i, opts.seed) * graph.edges.length)
      const a: Agent = {
        e,
        s: hash(i, opts.seed + 1) * graph.edges[e].len,
        dir: hash(i, opts.seed + 2) > 0.5 ? 1 : -1,
        speed: speed[0] + hash(i, opts.seed + 3) * (speed[1] - speed[0]),
        trail: [],
        odo: 0,
      }
      this.agents.push(a)
      c.set(colors[Math.floor(hash(i, opts.seed + 4) * colors.length)])
      for (let k = 0; k < this.segments; k++) this.mesh.setColorAt(i * this.segments + k, c)
      if (this.segments > 1) this.advance(a, (this.segments + 1) * this.gap, true)
    }
    this.mesh.count = n * this.segments
    if (opts.extra) {
      this.extra = new THREE.InstancedMesh(opts.extra[0], new THREE.MeshLambertMaterial({ color: opts.extra[1] }), this.mesh.count)
      this.extra.frustumCulled = false
      this.extra.castShadow = true
    }
  }

  private advance(a: Agent, dist: number, record: boolean) {
    const g = this.graph
    let left = dist
    while (left > 0) {
      const e = g.edges[a.e]
      const room = a.dir > 0 ? e.len - a.s : a.s
      const step = Math.min(left, room)
      a.s += step * a.dir
      left -= step
      if (left > 0 || room <= 0) {
        const end = a.dir > 0 ? e.b : e.a
        const opts = (g.at.get(end) ?? []).filter((id) => id !== a.e)
        const next = opts.length ? opts[Math.floor(Math.random() * opts.length)] : a.e
        if (next === a.e) a.dir = a.dir > 0 ? -1 : 1
        else {
          const ne = g.edges[next]
          a.e = next
          a.dir = ne.a === end ? 1 : -1
          a.s = a.dir > 0 ? 0 : ne.len
        }
        if (room <= 0 && left <= 0) break
      }
    }
    if (record) {
      a.odo += dist
      g.sample(g.edges[a.e], a.s, this.tmp)
      a.trail.push({ x: this.tmp.x, y: this.tmp.y, d: a.odo })
      const keep = (this.segments + 1) * this.gap + 5
      while (a.trail.length > 2 && a.odo - a.trail[1].d > keep) a.trail.shift()
    }
  }

  private trailAt(a: Agent, d: number) {
    const t = a.trail
    for (let i = t.length - 1; i > 0; i--) {
      if (t[i - 1].d <= d) {
        const p = t[i - 1],
          q = t[i]
        const f = q.d > p.d ? (d - p.d) / (q.d - p.d) : 0
        const L = Math.hypot(q.x - p.x, q.y - p.y) || 1
        return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, dx: (q.x - p.x) / L, dy: (q.y - p.y) / L }
      }
    }
    return null
  }

  update(dt: number) {
    const g = this.graph
    this.agents.forEach((a, i) => {
      this.advance(a, a.speed * dt, this.segments > 1)
      const y = g.edges[a.e].y
      for (let k = 0; k < this.segments; k++) {
        let p: { x: number; y: number; dx: number; dy: number } | null
        if (this.segments > 1) p = this.trailAt(a, a.odo - k * this.gap)
        else {
          g.sample(g.edges[a.e], a.s, this.tmp)
          p = { ...this.tmp, dx: this.tmp.dx * a.dir, dy: this.tmp.dy * a.dir }
        }
        if (!p) continue
        // przesunięcie na prawy pas
        const ox = p.dy * this.offset,
          oy = -p.dx * this.offset
        this.v.set(p.x + ox, y, -(p.y + oy))
        this.q.setFromAxisAngle(this.up, Math.atan2(p.dy, p.dx))
        this.m.compose(this.v, this.q, this.sc)
        this.mesh.setMatrixAt(i * this.segments + k, this.m)
        this.extra?.setMatrixAt(i * this.segments + k, this.m)
      }
    })
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.extra) this.extra.instanceMatrix.needsUpdate = true
  }
}
