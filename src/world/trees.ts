import * as THREE from 'three'
import { hash } from '../engine/geo.ts'
import type { Flat } from '../types/world.ts'

const col = new THREE.Color()
const pick = <T>(arr: T[], r: number): T => arr[Math.floor(r * arr.length) % arr.length]

// Drzewa: instancje ośmiościanów (korony) na pniach.
export function buildTrees(trees: Flat, palette: string[], seed = 0) {
  const geo = new THREE.IcosahedronGeometry(1, 0)
  geo.translate(0, 1.6, 0)
  const n = trees.length / 2
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), n)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    const r = 2.6 + hash(i + seed, 3) * 2.2
    s.set(r, r * 1.05, r)
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, 5) * 6.28)
    p.set(trees[i * 2], r * 0.55, -trees[i * 2 + 1])
    m.compose(p, q, s)
    mesh.setMatrixAt(i, m)
  }
  recolorTrees(mesh, palette)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function recolorTrees(mesh: THREE.InstancedMesh, palette: string[]) {
  for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, col.set(pick(palette, hash(i, 11))))
  mesh.instanceColor!.needsUpdate = true
}
