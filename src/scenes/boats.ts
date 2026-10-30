// Odra: barki przez cały rok, a od maja do września za dnia statki spacerowe i kajaki.
// Płyną wzdłuż linii środka rzeki z OSM, prawą stroną; na końcu odcinka zawracają.
import * as THREE from 'three'
import { hash } from '../engine/geo.ts'
import type { Flat } from '../types/world.ts'
import { Path, box, merge, place, vertexLambert } from './util.ts'

export type BoatKind = 'barge' | 'cruise' | 'kayak'

// Kadłuby niskie (mosty leżą ok. 1 m nad wodą); dziób w stronę +X.
const GEOMETRY: Record<BoatKind, () => THREE.BufferGeometry> = {
  // zestaw pchany: barka z ładunkiem (węgiel / kruszywo) i pchacz z wysoką sterówką
  barge: () => merge([
    [box(48, 0.8, 8.4), '#2b2d42'],
    [box(48.2, 0.2, 8.6, 0, 0.6), '#b5523a'],
    [box(38, 0.6, 7, 3, 0.8), '#4a4744'],
    [box(10, 1.0, 8, -29, 0), '#2b2d42'],
    [box(4, 2.6, 5, -31, 1.0), '#f4f1e6'],
    [box(4.1, 0.6, 5.1, -31, 2.6), '#1d3557'],
    [box(4.4, 0.2, 5.4, -31, 3.6), '#e05a47'],
  ]),
  // statek spacerowy: biały kadłub z niebieskim pasem, przeszklony salon i górny pokład
  cruise: () => merge([
    [box(24, 0.9, 5.6), '#f4f1e6'],
    [box(24.2, 0.3, 5.7, 0, 0.3), '#2c5d8a'],
    [box(16, 1.8, 4.6, -1.5, 0.9), '#cfd2dc'],
    [box(16.2, 0.7, 4.7, -1.5, 1.6), '#1d3557'],
    [box(17, 0.2, 5.2, -1.5, 2.7), '#2c5d8a'],
    [box(2, 0.9, 5.2, 9.5, 0.9), '#e05a47'],
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
  barge: { n: 3, speed: 2.4, lane: 6, scale: 1 },
  cruise: { n: 6, speed: 3.2, lane: 9, scale: 1 },
  kayak: { n: 16, speed: 1.6, lane: 14, scale: 1.8 },
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
        return { path, s: seed * path.len, dir: hash(i, ki + 3) < 0.5 ? 1 : -1, speed: spec.speed * (0.8 + seed * 0.4), lane: spec.lane * (0.5 + hash(i, ki + 5) * 0.5), seed }
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
