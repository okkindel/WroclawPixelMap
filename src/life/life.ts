// Ruch w mieście: tramwaje, auta i ludzie jeżdżą po grafie z OSM; ptaki krążą; chmury rzucają cienie.
import * as THREE from 'three'
import { hash } from '../engine/geo.ts'
import type { Road, Track } from '../types/world.ts'
import { merge } from '../world/geometry.ts'
import { Graph } from './graph.ts'
import { Movers } from './movers.ts'

function box(l: number, w: number, h: number, lift = 0) {
  const g = new THREE.BoxGeometry(l, h, w)
  g.translate(0, h / 2 + lift, 0)
  return g
}

export function tramGeometry() {
  const parts: [THREE.BufferGeometry, string][] = [
    [box(9.8, 2.4, 1.3), '#2f6fa8'],
    [box(9.6, 2.42, 1.0, 1.3), '#1d2340'],
    [box(9.8, 2.4, 0.5, 2.3), '#2f6fa8'],
    [box(9.0, 2.0, 0.35, 2.8), '#cfd2dc'],
  ]
  return merge(parts)
}

const CAR_COLORS = ['#e05a47', '#f4f1e6', '#2b2d42', '#4b8bbf', '#cfd2dc', '#f2d16b', '#7a7f99', '#5f9e8c']
const PEOPLE_COLORS = ['#e05a47', '#2c5d8a', '#f2d16b', '#2b2d42', '#f4f1e6', '#5f9e8c', '#c9b6d9', '#d9734e']
const WALKABLE = ['footway', 'pedestrian', 'living_street', 'path', 'residential']
// losowe tramwaje po torach z OSM (bez rozkładu GTFS)
const RANDOM_TRAMS = 110

export class Life {
  group = new THREE.Group()
  trams: Movers
  cars: Movers
  people: Movers
  // głowy ludzi (osobna bryła o stałym kolorze)
  heads: THREE.InstancedMesh
  birds: THREE.InstancedMesh
  clouds: THREE.Group
  layers = { trams: true, trains: true, cars: true, people: true, birds: true, clouds: true }
  private t = 0

  trains: Movers[]

  constructor(roads: Road[], trams: Track[], rails: Track[], bounds: [number, number, number, number], withTimetable = false) {
    const tramGraph = new Graph(trams)
    // Wrocławskie tramwaje MPK są niebieskie: niebieskie pudło, ciemny pas okien, jasny dach.
    // z rozkładem GTFS tramwaje jeżdżą osobno (Timetable); bez niego — losowo po torach z OSM
    this.trams = new Movers(tramGraph, withTimetable ? 0 : RANDOM_TRAMS, tramGeometry(), ['#ffffff'], [7, 10], {
      segments: 3, gap: 10.4, seed: 101, vertexColors: true,
    })
    const carGraph = new Graph(roads.filter((r) => r.car))
    this.cars = new Movers(carGraph, 1600, box(4.4, 1.9, 1.5), CAR_COLORS, [6, 12], { offset: 2.2, seed: 202 })
    const walkGraph = new Graph(roads.filter((r) => WALKABLE.includes(r.k)))
    this.people = new Movers(walkGraph, 5000, box(0.8, 0.8, 1.5), PEOPLE_COLORS, [0.9, 1.6], {
      offset: 0.6, seed: 303, extra: [box(0.55, 0.55, 0.5, 1.5), '#e8a074'],
    })
    this.heads = this.people.extra as THREE.InstancedMesh
    // Pociągi po torach z OSM: dalekobieżne (białe z niebieskim), regionalne (żółte), towarowe (długie, brązowe).
    const railGraph = new Graph(rails)
    this.trains = [
      new Movers(railGraph, 6, box(24, 3, 4), ['#f4f1e6', '#cfd2dc'], [18, 26], { segments: 7, gap: 25, seed: 401 }),
      new Movers(railGraph, 8, box(22, 3, 4), ['#e3b341', '#f2d16b'], [14, 20], { segments: 3, gap: 23, seed: 402 }),
      new Movers(railGraph, 5, box(15, 2.8, 3.6), ['#7d6450', '#5a2e22', '#6b6560'], [9, 13], { segments: 14, gap: 16, seed: 403 }),
    ]
    this.group.add(this.heads)
    this.group.add(this.trams.mesh, this.cars.mesh, this.people.mesh, ...this.trains.map((t) => t.mesh))

    // Ptaki: płaskie „V” krążące stadami nad miastem.
    const wing = new THREE.BufferGeometry()
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -1.2, 0.5, -1.6, -0.6, 0, 0, 0, 0, 0, -0.6, 0, 0, -1.2, 0.5, 1.6], 3))
    wing.computeVertexNormals()
    this.birds = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ color: '#1c1c2e', side: THREE.DoubleSide }), 60)
    this.birds.frustumCulled = false
    this.group.add(this.birds)

    // Chmury: niewidoczne bryły, które rzucają tylko cień.
    this.clouds = new THREE.Group()
    const cloudMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
    const [x0, y0, x1, y1] = bounds
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Group()
      for (let k = 0; k < 6; k++) {
        const r = 40 + hash(i, k) * 70
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), cloudMat)
        s.position.set((hash(i, k + 10) - 0.5) * 180, 0, (hash(i, k + 20) - 0.5) * 90)
        s.scale.y = 0.4
        s.castShadow = true
        c.add(s)
      }
      c.position.set(x0 + hash(i, 1) * (x1 - x0), 380, -(y0 + hash(i, 2) * (y1 - y0)))
      this.clouds.add(c)
    }
    this.clouds.userData.bounds = bounds
    this.group.add(this.clouds)
  }

  update(dt: number) {
    this.t += dt
    if (this.layers.trams) this.trams.update(dt)
    for (const t of this.trains) {
      if (this.layers.trains) t.update(dt)
      t.mesh.visible = this.layers.trains
    }
    if (this.layers.cars) this.cars.update(dt)
    if (this.layers.people) this.people.update(dt)
    this.trams.mesh.visible = this.layers.trams
    this.cars.mesh.visible = this.layers.cars
    this.people.mesh.visible = this.layers.people
    this.heads.visible = this.layers.people
    this.birds.visible = this.layers.birds
    this.clouds.visible = this.layers.clouds

    if (this.layers.birds) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3()
      for (let i = 0; i < this.birds.count; i++) {
        const flock = i % 6
        const cx = (hash(flock, 1) - 0.5) * 3000, cy = (hash(flock, 2) - 0.5) * 2000
        const R = 150 + hash(flock, 3) * 250
        const ang = this.t * (0.05 + hash(flock, 4) * 0.05) + hash(flock, 5) * 6.28 - (i / 6) * 0.03
        const jitter = (hash(i, 9) - 0.5) * 30
        v.set(cx + Math.cos(ang) * (R + jitter), 70 + hash(flock, 6) * 40 + jitter * 0.3, -(cy + Math.sin(ang) * (R + jitter)))
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang)
        const flap = 1 + Math.sin(this.t * 12 + i) * 0.6
        s.set(2, flap * 2, 2)
        m.compose(v, q, s)
        this.birds.setMatrixAt(i, m)
      }
      this.birds.instanceMatrix.needsUpdate = true
    }

    if (this.layers.clouds) {
      const [x0, , x1] = this.clouds.userData.bounds as number[]
      for (const c of this.clouds.children) {
        c.position.x += dt * 6
        if (c.position.x > x1 + 400) c.position.x = x0 - 400
      }
    }
  }
}
