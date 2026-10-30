// Wspólny kontrakt klikalnych warstw (src/app/picking.ts): co otworzyć po kliknięciu i co obrysować przy najechaniu.
import type * as THREE from 'three'

export type Outline =
  // wybrane instancje (krasnal, wagony jednego kursu tramwaju)
  | { instances: THREE.InstancedMesh; ids: number[] }
  // bryła trafiona promieniem w tym korzeniu (pomnik, neon, scenka)
  | { within: THREE.Object3D }
  // gotowe bryły w układzie świata (budynek z częściami)
  | { meshes: THREE.Mesh[] }

export interface Pick {
  open: () => void
  outline: Outline
  // ruchomy obiekt: obrys liczony co klatkę
  live?: boolean
}

export interface Pickable {
  pick(ray: THREE.Raycaster): Pick | null
  // reakcja na kursor niezależna od obrysu (krasnal podskakuje)
  hover?(ray: THREE.Raycaster): void
}
