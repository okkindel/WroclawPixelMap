// Przenoszenie geometrii między wątkami: BufferGeometry <-> zwykłe tablice (przekazywane bez kopiowania).
import * as THREE from 'three'

export interface Packed {
  pos: Float32Array
  nrm: Float32Array
  col: Float32Array
  win: Float32Array
  owners: Int32Array
}

// Tablica atrybutu geometrii jako Float32Array (wszystkie nasze atrybuty są float32; inny typ to błąd).
export function attrF32(g: THREE.BufferGeometry, name: string): Float32Array {
  const a = g.getAttribute(name).array
  if (!(a instanceof Float32Array)) throw new Error(`atrybut ${name} nie jest Float32Array`)
  return a
}

export function pack(g: THREE.BufferGeometry): Packed {
  const a = (n: string) => attrF32(g, n)
  return { pos: a('position'), nrm: a('normal'), col: a('color'), win: a('aWin'), owners: g.userData.owners ?? new Int32Array(0) }
}

export function unpack(p: Packed): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(p.nrm, 3))
  g.setAttribute('color', new THREE.BufferAttribute(p.col, 3))
  g.setAttribute('aWin', new THREE.BufferAttribute(p.win, 1))
  g.computeBoundingSphere()
  g.userData.owners = p.owners
  return g
}

export const transfers = (...ps: Packed[]) => ps.flatMap((p) => [p.pos.buffer, p.nrm.buffer, p.col.buffer, p.win.buffer, p.owners.buffer])
