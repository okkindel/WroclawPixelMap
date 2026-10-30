// Odra: barki przez cały rok, a od maja do września za dnia statki spacerowe i kajaki.
// Płyną wzdłuż linii środka rzeki z OSM, prawą stroną; na końcu odcinka zawracają.
import * as THREE from 'three'
import { hash } from '../engine/geo.ts'
import type { Flat } from '../types/world.ts'
import { Path, box, merge, place, vertexLambert } from './util.ts'

export type BoatKind = 'barge' | 'cruise' | 'kayak'

// Dziób: klin z dwóch obróconych prostopadłościanów (zwęża kadłub do szpica).
function bow(len: number, h: number, w: number, x: number, y = 0) {
  const parts: THREE.BufferGeometry[] = []
  for (const side of [1, -1]) {
    const L = Math.hypot(len, w / 2)
    const g = new THREE.BoxGeometry(L, h, 0.6)
    g.rotateY(-side * Math.atan2(w / 2, len))
    g.translate(x + len / 2, y + h / 2, side * w / 4)
    parts.push(g)
  }
  return parts
}

// Kadłuby niskie (mosty leżą ok. 1 m nad wodą); dziób w stronę +X.
const GEOMETRY: Record<BoatKind, () => THREE.BufferGeometry> = {
  // zestaw pchany: barka z burtami i hałdami ładunku, z tyłu pchacz z wysoką białą sterówką
  barge: () => merge([
    [box(44, 1.2, 9), '#1d2340'],
    ...bow(4, 1.2, 9, 22).map((g): [THREE.BufferGeometry, string] => [g, '#1d2340']),
    [box(44, 0.5, 0.5, 0, 1.2, 4.3), '#c8312f'],
    [box(44, 0.5, 0.5, 0, 1.2, -4.3), '#c8312f'],
    [box(10, 1.4, 6, 12, 0.9), '#3d3f58'],
    [box(10, 1.4, 6, -2, 0.9), '#5a4a44'],
    [box(10, 1.4, 6, -16, 0.9), '#3d3f58'],
    [box(11, 1.4, 8.4, -28, 0), '#c8312f'],
    [box(5, 3.2, 6, -30, 1.4), '#f4f1e6'],
    [box(5.1, 0.8, 6.1, -30, 3.4), '#1d2340'],
    [box(0.6, 1.6, 0.6, -32, 4.6), '#2b2d42'],
  ]),
  // statek spacerowy: biały kadłub z dziobem, niebieski pas, dwa pokłady z oknami, flaga
  cruise: () => merge([
    [box(22, 1.2, 6), '#f4f1e6'],
    ...bow(5, 1.2, 6, 11).map((g): [THREE.BufferGeometry, string] => [g, '#f4f1e6']),
    [box(22.1, 0.35, 6.1, 0, 0.4), '#2f6fa8'],
    [box(16, 2.2, 5, -1, 1.2), '#f4f1e6'],
    [box(16.1, 0.8, 5.1, -1, 2.0), '#1d2340'],
    [box(10, 1.6, 4.4, -3, 3.4), '#f4f1e6'],
    [box(10.1, 0.6, 4.5, -3, 4.0), '#1d2340'],
    [box(0.3, 2.4, 0.3, -9, 3.4), '#2b2d42'],
    [box(0.1, 1.0, 1.6, -9, 5.0, 0.8), '#c8312f'],
  ]),
  // kajak z kajakarzem (powiększony, inaczej to pojedynczy piksel)
  kayak: () => merge([
    [box(4.6, 0.35, 0.8), '#f2d16b'],
    [box(0.5, 0.7, 0.55, -0.2, 0.3), '#e05a47'],
    [box(0.35, 0.35, 0.35, -0.2, 1.0), '#e8a074'],
    [box(0.12, 0.08, 2.8, -0.1, 0.8), '#2b2d42'],
  ]),
}
// liczba, prędkość [m/s], przesunięcie od osi rzeki [m], skala
const SPEC: Record<BoatKind, { n: number; speed: number; lane: number; scale: number }> = {
  // osobne pasy dla rodzajów (barki środkiem, statki dalej, kajaki przy brzegu), żeby się nie przenikały
  barge: { n: 3, speed: 2.4, lane: 7, scale: 1 },
  cruise: { n: 6, speed: 3.2, lane: 18, scale: 1 },
  kayak: { n: 16, speed: 1.6, lane: 27, scale: 1.8 },
}

interface Boat { path: Path; s: number; dir: 1 | -1; speed: number; lane: number; seed: number }

export class Boats {
  group = new THREE.Group()
  meshes = {} as Record<BoatKind, THREE.InstancedMesh>
  private boats = {} as Record<BoatKind, Boat[]>
  private t = 0
  private m = new THREE.Matrix4()

  constructor(rivers: Flat[]) {
    const paths = rivers.map((r) => new Path(r)).filter((p) => p.len > 500)
    const kinds: BoatKind[] = ['barge', 'cruise', 'kayak']
    kinds.forEach((kind, ki) => {
      const spec = SPEC[kind]
      const mesh = new THREE.InstancedMesh(GEOMETRY[kind](), vertexLambert(), paths.length ? spec.n : 0)
      mesh.castShadow = true
      mesh.frustumCulled = false
      this.meshes[kind] = mesh
      this.group.add(mesh)
      this.boats[kind] = Array.from({ length: mesh.count }, (_, i) => {
        // barki na najdłuższych odcinkach (główny nurt), reszta po wszystkich
        const path = kind === 'barge' ? paths[i % Math.min(2, paths.length)] : paths[Math.floor(hash(i, ki + 7) * paths.length)]
        const seed = hash(i, ki)
        // start rozłożony równo wzdłuż odcinka, ta sama prędkość w obrębie rodzaju — łodzie się nie doganiają
        return { path, s: ((i + 0.5) / spec.n) * path.len, dir: i % 2 ? 1 : -1, speed: spec.speed, lane: spec.lane * (0.85 + hash(i, ki + 5) * 0.3), seed }
      })
    })
  }

  // które rodzaje pływają: barki zawsze, spacerowe i kajaki w sezonie, za dnia
  update(dt: number, show: Record<BoatKind, boolean>) {
    this.t += dt
    for (const kind of Object.keys(this.meshes) as BoatKind[]) {
      const mesh = this.meshes[kind]
      mesh.visible = show[kind] && mesh.count > 0
      if (!mesh.visible) continue
      const scale = SPEC[kind].scale
      this.boats[kind].forEach((b, i) => {
        b.s += b.dir * b.speed * dt
        if (b.s > b.path.len - 20 || b.s < 20) { b.dir = b.s < 20 ? 1 : -1; b.s = Math.min(Math.max(b.s, 20), b.path.len - 20) }
        const [x, y, h] = b.path.at(b.s, b.dir * b.lane)
        // kajaki lekko kołyszą się na boki przy wiosłowaniu
        const sway = kind === 'kayak' ? Math.sin(this.t * 3 + b.seed * 9) * 0.15 : 0
        mesh.setMatrixAt(i, place(this.m, x, y, 0, h + (b.dir < 0 ? Math.PI : 0) + sway, scale))
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  hit(ray: THREE.Raycaster): BoatKind | null {
    for (const kind of Object.keys(this.meshes) as BoatKind[]) {
      const mesh = this.meshes[kind]
      // instancje się ruszają: sfera otaczająca liczona od nowa przy każdym kliknięciu
      mesh.boundingSphere = null
      if (mesh.visible && ray.intersectObject(mesh).length) return kind
    }
    return null
  }
}
