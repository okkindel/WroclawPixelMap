// Latarnik z Ostrowa Tumskiego: o zmierzchu idzie ul. Katedralną od Mostu Tumskiego w stronę katedry
// i długą tyczką zapala latarnie gazowe jedna po drugiej; o świcie robi ten sam obchód i je gasi.
import * as THREE from 'three'
import type { Flat } from '../types/world.ts'
import { Path, box, merge, place, vertexLambert } from './util.ts'

const WALK = 1.4 // m/s
const PAUSE = 1.6 // s przy każdej latarni
const POST_H = 4.6
const SCALE = 1.6 // postać i latarnie powiększone, żeby było je widać w pikselach
const LIT = '#ffe9a6', UNLIT = '#3d3f58'

function lampGeometry() {
  return merge([
    [box(0.6, 0.4, 0.6), '#1c1c2e'],
    [box(0.22, POST_H, 0.22), '#2b2d42'],
    [box(0.8, 0.12, 0.8, 0, POST_H + 0.75), '#1c1c2e'], // daszek latarni
  ])
}

function figure() {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(merge([
    [box(0.4, 0.8, 0.45), '#1c1c2e'], // nogi
    [box(0.75, 1.1, 0.85, 0, 0.7), '#0f0f1b'], // peleryna
    [box(0.38, 0.38, 0.38, 0, 1.8), '#e8a074'],
    [box(0.62, 0.06, 0.62, 0, 2.15), '#0f0f1b'], // rondo cylindra
    [box(0.4, 0.5, 0.4, 0, 2.2), '#0f0f1b'],
  ]), vertexLambert()))
  // tyczka z płomykiem na końcu; obraca się w barku
  const pole = new THREE.Group()
  pole.position.set(0.1, 1.4, 0.45)
  pole.add(new THREE.Mesh(box(0.07, 3.2, 0.07), new THREE.MeshLambertMaterial({ color: '#7d6450' })))
  const flame = new THREE.Mesh(box(0.2, 0.25, 0.2, 0, 3.2), new THREE.MeshBasicMaterial({ color: '#f2d16b' }))
  pole.add(flame)
  g.add(pole)
  g.userData.pole = pole
  g.scale.setScalar(SCALE)
  g.traverse((o) => (o.castShadow = true))
  return g
}

export class Lamplighter {
  group = new THREE.Group()
  walker: THREE.Group
  posts: THREE.InstancedMesh
  heads: THREE.InstancedMesh
  private glow: THREE.InstancedMesh
  private path: Path
  private lampS: number[] = []
  private lit: boolean[]
  private s = 0
  private pause = 0
  private first = true
  private c = new THREE.Color()
  private m = new THREE.Matrix4()

  constructor(route: Flat, lamps: Flat) {
    this.path = new Path(route)
    const n = lamps.length / 2
    this.lit = new Array(n).fill(false)
    this.posts = new THREE.InstancedMesh(lampGeometry(), vertexLambert(), n)
    this.heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), new THREE.MeshBasicMaterial(), n)
    // plama ciepłego światła na bruku pod zapaloną latarnią
    const glowGeo = new THREE.CircleGeometry(4, 8).rotateX(-Math.PI / 2)
    this.glow = new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ color: '#c98f2c', transparent: true, opacity: 0.35, depthWrite: false }), n)
    for (let i = 0; i < n; i++) {
      const x = lamps[i * 2], y = lamps[i * 2 + 1]
      this.posts.setMatrixAt(i, place(this.m, x, y, 0, 0, SCALE))
      this.heads.setMatrixAt(i, place(this.m, x, y, (POST_H + 0.4) * SCALE, Math.PI / 4, SCALE))
      this.heads.setColorAt(i, this.c.set(UNLIT))
      this.lampS.push(this.project(x, y))
    }
    this.posts.castShadow = true
    this.glow.count = 0
    this.walker = figure()
    this.walker.visible = false
    this.group.add(this.posts, this.heads, this.glow, this.walker)
  }

  // droga wzdłuż trasy do punktu najbliższego latarni
  private project(x: number, y: number) {
    let best = Infinity, at = 0
    for (let s = 0; s <= this.path.len; s += 1) {
      const [px, py] = this.path.at(s)
      const d = Math.hypot(px - x, py - y)
      if (d < best) { best = d; at = s }
    }
    return at
  }

  update(dt: number, night: number) {
    const want = night > 0.35
    // przy starcie w pełnej nocy albo w dzień — od razu stan docelowy, bez obchodu
    if (this.first) {
      this.first = false
      if (night > 0.9 || night < 0.1) this.lit.fill(want)
      this.refresh()
    }
    const next = this.lit.findIndex((l) => l !== want)
    const w = this.walker
    const pole = w.userData.pole as THREE.Group
    if (next < 0) {
      // obchód skończony: dochodzi do końca ulicy i znika
      if (!w.visible) return
      this.s += WALK * dt
      if (this.s >= this.path.len) { w.visible = false; return }
      pole.rotation.z = -0.5
    } else {
      if (!w.visible) { w.visible = true; this.s = 0 }
      const target = this.lampS[next]
      if (this.s < target - 0.2) {
        this.s = Math.min(target, this.s + WALK * dt)
        pole.rotation.z = -0.5 // tyczka niesiona skośnie do przodu
      } else {
        // podnosi tyczkę do latarni, chwila i światło
        this.pause += dt
        pole.rotation.z = -0.12
        if (this.pause > PAUSE) {
          this.pause = 0
          this.lit[next] = want
          this.refresh()
        }
      }
    }
    const [x, y, h] = this.path.at(this.s)
    w.position.set(x, 0, -y)
    w.rotation.y = h
    // krok: lekkie podskakiwanie w marszu
    w.position.y = this.pause ? 0 : Math.abs(Math.sin(this.s * 3)) * 0.15
  }

  private refresh() {
    let k = 0
    const v = new THREE.Matrix4()
    this.lit.forEach((l, i) => {
      this.heads.setColorAt(i, this.c.set(l ? LIT : UNLIT))
      if (!l) return
      this.posts.getMatrixAt(i, v)
      this.glow.setMatrixAt(k++, this.m.makeTranslation(v.elements[12], 0.15, v.elements[14]))
    })
    this.glow.count = k
    this.glow.instanceMatrix.needsUpdate = true
    this.heads.instanceColor!.needsUpdate = true
  }

  hit(ray: THREE.Raycaster) {
    return ray.intersectObjects([this.walker, this.posts, this.heads], true).length > 0
  }
}
