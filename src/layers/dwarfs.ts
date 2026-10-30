// Warstwa krasnali: pikselowe figurki z OSM (artwork_type=dwarf), klikalne, do kolekcjonowania.
import * as THREE from 'three'
import { hash } from '../engine/geo.ts'
import type { Dwarf } from '../types/world.ts'
import { merge } from '../world/geometry.ts'

const STORE = 'wpm.dwarfs.found'

function dwarfGeometry() {
  const parts: [THREE.BufferGeometry, string][] = []
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, color: string) => {
    g.translate(x, y, z)
    parts.push([g, color])
  }
  add(new THREE.BoxGeometry(0.5, 0.25, 0.35), 0, 0.12, 0, '#2b2d42') // buty
  add(new THREE.BoxGeometry(0.55, 0.55, 0.45), 0, 0.5, 0, '#2c5d8a') // kubraczek
  add(new THREE.BoxGeometry(0.45, 0.4, 0.45), 0, 0.97, 0, '#e8a074') // głowa
  add(new THREE.BoxGeometry(0.4, 0.3, 0.12), 0, 0.8, 0.25, '#f4f1e6') // broda
  add(new THREE.ConeGeometry(0.32, 0.65, 4), 0, 1.45, 0, '#e05a47') // czapka
  return merge(parts)
}

export class Dwarfs {
  list: Dwarf[]
  mesh: THREE.InstancedMesh
  found: Set<number>
  private scale = 1
  private hover = -1
  private t = 0
  private party = 0
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private s = new THREE.Vector3()

  constructor(all: Dwarf[]) {
    this.list = all.filter((d) => d.in)
    this.mesh = new THREE.InstancedMesh(dwarfGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), this.list.length)
    this.mesh.castShadow = true
    this.mesh.frustumCulled = false
    this.found = new Set(this.load())
    this.layout()
  }

  private load(): number[] {
    try { return JSON.parse(localStorage.getItem(STORE) || '[]') } catch { return [] }
  }

  private save() {
    try { localStorage.setItem(STORE, JSON.stringify([...this.found])) } catch { /* tryb prywatny */ }
  }

  // Krasnale są maleńkie (ok. 30 cm), więc przy oddaleniu powiększamy je, żeby było je widać.
  setZoom(metersPerPixel: number) {
    const s = THREE.MathUtils.clamp(metersPerPixel * 1.4, 1, 5)
    if (Math.abs(s - this.scale) > 0.05) { this.scale = s; this.layout() }
  }

  setHover(i: number) { if (i !== this.hover) { this.hover = i; this.layout() } }

  layout() {
    this.list.forEach((d, i) => {
      const jumping = i === this.hover || this.party > 0
      const hop = jumping ? Math.abs(Math.sin(this.t * 10 + i)) * 0.6 * this.scale : 0
      const found = this.found.has(d.id)
      this.v.set(d.x, 0.2 + hop, -d.y)
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(d.id, 1) * 6.28)
      this.s.setScalar(this.scale * (found ? 1 : 1.1) * (this.party > 0 ? 2.5 : 1))
      this.m.compose(this.v, this.q, this.s)
      this.mesh.setMatrixAt(i, this.m)
    })
    this.mesh.instanceMatrix.needsUpdate = true
  }

  update(dt: number) {
    this.t += dt
    const wasParty = this.party > 0
    this.party = Math.max(0, this.party - dt)
    if (this.hover >= 0 || this.party > 0 || wasParty) this.layout()
  }

  // Rewolucja Krasnoludków: wszystkie krasnale rosną i skaczą przez chwilę.
  startParty(seconds = 12) { this.party = seconds }

  collect(i: number): { dwarf: Dwarf; isNew: boolean } {
    const dwarf = this.list[i]
    const isNew = !this.found.has(dwarf.id)
    this.found.add(dwarf.id)
    this.save()
    return { dwarf, isNew }
  }
}
