// Brzeg mapy: kreskówkowe obłoki (kremowe u góry, lawendowe od spodu, płaskie dno) —
// gęsty wał za krawędzią danych i luźniejsze chmurki nad brzegiem miasta.
import * as THREE from 'three'
import { hash } from '../engine/geo.ts'
import type { WorldMeta } from '../types/world.ts'

const BAND = 2600 // szerokość wału chmur na zewnątrz krawędzi [m]
const INNER = 450 // jak daleko w głąb mapy sięgają pojedyncze chmurki [m]
// THREE.Color.set() przelicza sRGB na liniowe (tak jak w reszcie geometrii)
const TOP = new THREE.Color().set('#f4ecd8')
const SHADE = new THREE.Color().set('#b9b4d6')

// Obłok: kilka kopuł o płaskim dnie; kolor zależny od wysokości wierzchołka (dwa pasy, bez cieniowania).
function cloudGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const puffs = [[0, 0, 0, 1], [-0.9, 0, 0.1, 0.7], [0.9, 0, -0.1, 0.75], [-0.35, 0, -0.5, 0.6], [0.4, 0, 0.5, 0.55]]
  for (const [x, y, z, r] of puffs) {
    const g = new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)
    g.translate(x, y, z)
    parts.push(g.toNonIndexed())
  }
  const pos: number[] = [], col: number[] = []
  for (const g of parts) {
    const p = g.attributes.position.array as Float32Array
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2])
      const c = p[i + 1] > 0.32 ? TOP : SHADE
      col.push(c.r, c.g, c.b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return g
}

export function buildCloudEdge(bounds: WorldMeta['bounds']) {
  const [x0, y0, x1, y1] = bounds
  const pts: [number, number, number][] = [] // x, y, odległość od krawędzi (ujemna = nad mapą)
  let n = 0
  const edge = (ax: number, ay: number, bx: number, by: number, ox: number, oy: number) => {
    const L = Math.hypot(bx - ax, by - ay)
    for (let s = -BAND; s <= L + BAND; s += 80) {
      for (let row = 0; row < 10; row++) {
        const r = hash(n, 3), keep = hash(n, 5)
        n++
        // gęsty pas na samej krawędzi (zasłania prostą linię końca danych), dalej coraz rzadsze obłoki
        const depth = row < 3 ? -160 + row * 150 + (r - 0.5) * 140 : 300 + (row - 3) * ((BAND - 300) / 7) + (r - 0.5) * 300
        const p = row < 3 ? 0.95 : 0.55 - (row - 3) * 0.07
        if (keep > p) continue
        const along = s + (hash(n, 7) - 0.5) * 70
        pts.push([ax + ((bx - ax) * along) / L + ox * depth, ay + ((by - ay) * along) / L + oy * depth, depth])
      }
    }
    // pojedyncze chmurki nad brzegiem miasta
    for (let s = 0; s <= L; s += 260) {
      if (hash(n++, 21) > 0.45) continue
      const depth = -INNER * hash(n, 23)
      pts.push([ax + ((bx - ax) * s) / L + ox * depth, ay + ((by - ay) * s) / L + oy * depth, -1])
    }
  }
  edge(x0, y0, x1, y0, 0, -1)
  edge(x1, y0, x1, y1, 1, 0)
  edge(x1, y1, x0, y1, 0, 1)
  edge(x0, y1, x0, y0, -1, 0)

  const mesh = new THREE.InstancedMesh(cloudGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false }), pts.length)
  // bez zapisu głębi: filtr nie rysuje konturów między nakładającymi się obłokami (szarobure plamy)
  mesh.renderOrder = 10
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3()
  pts.forEach(([x, y, depth], i) => {
    // nad mapą małe chmurki, dalej coraz większe i wyżej
    const far = Math.max(0, depth) / BAND
    const size = (depth === -1 ? 30 : depth < 300 ? 75 : 55 + far * 40) + hash(i, 11) * 35
    v.set(x, 60 + far * 60 + hash(i, 13) * 20, -y)
    sc.set(size * 1.3, size * (0.8 + hash(i, 17) * 0.4), size)
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, 19) * 6.28)
    m.compose(v, q, sc)
    mesh.setMatrixAt(i, m)
  })
  return mesh
}

// Kolor tła za chmurami: kremowe niebo jak w reszcie interfejsu.
export const FOG_COLOR = '#ece6d6'
