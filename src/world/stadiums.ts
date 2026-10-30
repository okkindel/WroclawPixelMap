// Trybuny stadionów: schodkowe sektory wzdłuż obrysu (OSM ma zwykle tylko obszar stadionu).
// Na Olimpijskim sektory i kibice w barwach Sparty Wrocław (żółty i czerwony).
import * as THREE from 'three'
import { centroid, hash } from '../engine/geo.ts'
import type { Poly } from '../types/world.ts'

// od zewnątrz: najwyższy rząd przy obrysie, niższe bliżej boiska
const TIERS = [
  { inset: 18, depth: 7, h: 10 },
  { inset: 11, depth: 7, h: 6.5 },
  { inset: 4, depth: 7, h: 3 },
]
const DEFAULT_COLORS = ['#2f6fa8', '#f4f1e6', '#c8312f']
const SPARTA_COLORS = ['#c8312f', '#e3b341', '#c8312f']
const SPARTA_FANS = ['#e3b341', '#c8312f', '#e3b341', '#c8312f', '#f4f1e6']

export function buildStands(stadiums: (Poly & { n?: string })[]) {
  const group = new THREE.Group()
  const fans: THREE.Matrix4[] = []
  const fanColors: string[] = []
  const m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    v = new THREE.Vector3(),
    s = new THREE.Vector3(1, 1, 1)
  for (const st of stadiums) {
    const sparta = /Olimpijski/.test(st.n ?? '')
    const mats = (sparta ? SPARTA_COLORS : DEFAULT_COLORS).map((color) => new THREE.MeshLambertMaterial({ color }))
    const ring = st.o
    const [cx, cy] = centroid(ring)
    const n = ring.length / 2
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const ax = ring[i * 2],
        ay = ring[i * 2 + 1],
        bx = ring[j * 2],
        by = ring[j * 2 + 1]
      const L = Math.hypot(bx - ax, by - ay)
      if (L < 4) continue
      // normalna do środka stadionu
      let nx = -(by - ay) / L,
        ny = (bx - ax) / L
      const mx = (ax + bx) / 2,
        my = (ay + by) / 2
      if ((cx - mx) * nx + (cy - my) * ny < 0) {
        nx = -nx
        ny = -ny
      }
      const ang = Math.atan2(by - ay, bx - ax)
      TIERS.forEach((t, k) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(L + 1, t.h, t.depth), mats[k])
        m.position.set(mx + nx * t.inset, t.h / 2, -(my + ny * t.inset))
        m.rotation.y = ang
        m.castShadow = m.receiveShadow = true
        group.add(m)
        if (!sparta) return
        // kibice: rząd postaci na każdym stopniu, z przerwami
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang)
        for (let d = 0.8; d < L; d += 1.4) {
          if (hash(i * 100 + k * 1000 + Math.round(d * 10), 5) < 0.25) continue
          const f = d / L
          v.set(ax + (bx - ax) * f + nx * t.inset, t.h + 0.8, -(ay + (by - ay) * f + ny * t.inset))
          fans.push(m4.compose(v, q, s).clone())
          fanColors.push(SPARTA_FANS[Math.floor(hash(fans.length, 9) * SPARTA_FANS.length)])
        }
      })
    }
  }
  if (fans.length) {
    const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1.6, 0.9), new THREE.MeshLambertMaterial(), fans.length)
    const c = new THREE.Color()
    fans.forEach((m, i) => {
      crowd.setMatrixAt(i, m)
      crowd.setColorAt(i, c.set(fanColors[i]))
    })
    group.add(crowd)
  }
  return group
}
