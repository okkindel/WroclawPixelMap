// Brzeg mapy: pas niskich, pikselowych chmur zakrywający urwane dane i tło za granicą obszaru.
import * as THREE from 'three'
import { hash } from '../engine/geo.ts'
import type { WorldMeta } from '../types/world.ts'

const BAND = 700 // szerokość pasa chmur [m] — od krawędzi danych na zewnątrz

export function buildCloudEdge(bounds: WorldMeta['bounds']) {
  const [x0, y0, x1, y1] = bounds
  const pts: [number, number, number][] = []
  let n = 0
  // obwód przechodzony co ~45 m; w każdym miejscu kilka chmur w głąb pasa
  const edge = (ax: number, ay: number, bx: number, by: number, ox: number, oy: number) => {
    const L = Math.hypot(bx - ax, by - ay)
    for (let s = -BAND; s <= L + BAND; s += 45) {
      for (let row = 0; row < 4; row++) {
        const r = hash(n++, 31)
        const depth = row * (BAND / 4) + r * (BAND / 4) - 60
        const x = ax + ((bx - ax) * s) / L + ox * depth
        const y = ay + ((by - ay) * s) / L + oy * depth
        pts.push([x, y, row])
      }
    }
  }
  edge(x0, y0, x1, y0, 0, -1)
  edge(x1, y0, x1, y1, 1, 0)
  edge(x1, y1, x0, y1, 0, 1)
  edge(x0, y1, x0, y0, -1, 0)

  // gładkie kule z mocnym światłem własnym: miękkie, jasne obłoki zamiast kanciastych brył
  const geo = new THREE.IcosahedronGeometry(1, 2)
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ emissive: '#8c8fa3' }), pts.length)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3()
  const c = new THREE.Color()
  const shades = ['#f4f1e6', '#eef0f5', '#e6e8ef', '#f4f1e6']
  pts.forEach(([x, y, row], i) => {
    // dalej od mapy: chmury większe i wyżej (ściana mgły), przy krawędzi niższe i mniejsze
    const size = 70 + row * 45 + hash(i, 7) * 80
    v.set(x, 10 + row * 22 + hash(i, 9) * 25, -y)
    sc.set(size, size * (0.35 + hash(i, 11) * 0.2), size * (0.8 + hash(i, 13) * 0.4))
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, 17) * 6.28)
    m.compose(v, q, sc)
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, c.set(shades[Math.floor(hash(i, 19) * shades.length)]))
  })
  return mesh
}

// Kolor tła za chmurami (mgła), zamiast szarego „nic”.
export const FOG_COLOR = '#d6d8e2'
