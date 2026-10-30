// Jarmark Bożonarodzeniowy na Rynku: drewniane budki wokół bloku Ratusza i wzdłuż pierzei, choinka
// przy pręgierzu, nocą migające światełka. Czynny od ok. 21 listopada do 7 stycznia (od 2000 r.).
import * as THREE from 'three'
import { hash } from '../engine/geo.ts'
import { box, place, vertexLambert } from './util.ts'
import { merge } from '../world/geometry.ts'

type Stall = [x: number, y: number, angle: number]

const BULBS = ['#f2d16b', '#ffe9a6', '#e05a47', '#8fc1e3', '#b4d77a', '#e8b4b8']
const PER_STALL = 3
const TREE_BULBS = 60

// Budka: front w stronę +X (lada), dach dwuspadowy schodkowo.
function stallGeometry() {
  return merge([
    [box(2.6, 2.4, 4.2), '#7d6450'],
    [box(0.1, 1.0, 3.4, 1.3, 1.0), '#f2d16b'], // oświetlone wnętrze za ladą
    [box(0.5, 0.9, 4.0, 1.3, 0), '#9c7a5c'], // lada
    [box(0.9, 0.15, 4.4, 1.6, 2.2), '#e05a47'], // daszek nad ladą
    [box(3.2, 0.35, 4.6, 0, 2.4), '#8a3b2a'],
    [box(2.0, 0.35, 4.6, 0, 2.75), '#b5523a'],
    [box(0.9, 0.3, 4.6, 0, 3.1), '#f4f1e6'], // śnieg na kalenicy
  ])
}

// Choinka: piętra coraz mniejszych brył obróconych na przemian o 45°.
function treeGeometry() {
  const parts: [THREE.BufferGeometry, string][] = [[box(1.2, 2.5, 1.2), '#5a2e22']]
  const tiers = [9, 7.5, 6, 4.5, 3, 1.6]
  tiers.forEach((s, i) => {
    const g = box(s, 2.8, s, 0, 2.2 + i * 2.6)
    if (i % 2) g.rotateY(Math.PI / 4)
    parts.push([g, i % 2 ? '#2e5e3a' : '#1f3d2b'])
  })
  return merge(parts)
}

export function marketOpen(now: Date, epochYear: number) {
  const m = now.getMonth(),
    d = now.getDate()
  return epochYear >= 2000 && ((m === 10 && d >= 21) || m === 11 || (m === 0 && d <= 7))
}

export class Market {
  group = new THREE.Group()
  stalls: THREE.InstancedMesh
  tree: THREE.Mesh
  private bulbs: THREE.InstancedMesh
  private star: THREE.Mesh
  private t = 0
  private tick = 0
  private c = new THREE.Color()

  constructor(stalls: Stall[], tree: [number, number]) {
    const m = new THREE.Matrix4()
    this.stalls = new THREE.InstancedMesh(stallGeometry(), vertexLambert(), stalls.length)
    for (const [i, [x, y, a]] of stalls.entries()) this.stalls.setMatrixAt(i, place(m, x, y, 0, a))
    this.stalls.castShadow = this.stalls.receiveShadow = true

    this.tree = new THREE.Mesh(treeGeometry(), vertexLambert())
    this.tree.position.set(tree[0], 0, -tree[1])
    this.tree.castShadow = true
    this.star = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshBasicMaterial({ color: '#f2d16b' }))
    this.star.position.set(tree[0], 20.6, -tree[1])
    this.star.rotation.set(0, 0, Math.PI / 4)

    // światełka: po trzy na okapie każdej budki i spirala na choince
    this.bulbs = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshBasicMaterial(),
      stalls.length * PER_STALL + TREE_BULBS,
    )
    const v = new THREE.Vector3(),
      q = new THREE.Quaternion(),
      one = new THREE.Vector3(1, 1, 1)
    let k = 0
    for (const [x, y, a] of stalls) {
      for (let j = 0; j < PER_STALL; j++) {
        // okap od frontu (1.7 m przed środkiem), rozłożone wzdłuż budki
        const along = (j - 1) * 1.8
        v.set(x + Math.cos(a) * 1.75 - Math.sin(a) * along, 2.35, -(y + Math.sin(a) * 1.75 + Math.cos(a) * along))
        this.bulbs.setMatrixAt(k++, m.compose(v, q, one))
      }
    }
    for (let j = 0; j < TREE_BULBS; j++) {
      const f = j / TREE_BULBS,
        h = 2.5 + f * 15.5,
        r = (1 - f) * 4.6 + 0.5,
        ang = j * 2.4
      v.set(tree[0] + Math.cos(ang) * r, h, -(tree[1] + Math.sin(ang) * r))
      this.bulbs.setMatrixAt(k++, m.compose(v, q, one))
    }
    for (let i = 0; i < this.bulbs.count; i++) this.bulbs.setColorAt(i, this.c.set(BULBS[i % BULBS.length]))
    this.group.add(this.stalls, this.tree, this.star, this.bulbs)
  }

  update(dt: number, night: number) {
    this.t += dt
    this.bulbs.visible = night > 0.25
    if (!this.bulbs.visible) return
    // miganie co 0,4 s: część żarówek gaśnie, reszta zmienia kolor falą
    if (this.t - this.tick < 0.4) return
    this.tick = this.t
    const step = Math.floor(this.t / 0.4)
    for (let i = 0; i < this.bulbs.count; i++) {
      const on = hash(i, step) > 0.25
      this.bulbs.setColorAt(i, this.c.set(on ? BULBS[(i + (step >> 2)) % BULBS.length] : '#3a2a40'))
    }
    this.bulbs.instanceColor!.needsUpdate = true
    this.star.rotation.y = step * 0.2
  }

  hit(ray: THREE.Raycaster) {
    return ray.intersectObjects([this.stalls, this.tree, this.star], false).length > 0
  }
}
