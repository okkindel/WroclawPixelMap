// Pomniki: pikselowe bryły (cokół + figura) z OSM, po jednym InstancedMesh na rodzaj i część.
// Skala realna (wysokość z OSM albo typowa dla rodzaju), ale nie niższe niż MIN_H, żeby było je widać z góry.
import * as THREE from 'three'
import type { PopupContent } from '../ui/popup.ts'
import { showMonument } from '../app/popups.ts'
import type { Pick, Pickable } from '../types/pick.ts'
import { hash } from '../engine/geo.ts'
import { SINCE } from '../rules/milestones.ts'
import { lang } from '../i18n/index.ts'
import { vertexLambert } from '../scenes/util.ts'
import { attrF32 } from '../world/packed.ts'
import { SPECIAL } from './monuments.models.ts'

export type MonumentKind = 'statue' | 'bust' | 'obelisk' | 'stele' | 'cross' | 'sculpture' | 'other'

// Rekord z public/data/monuments.json (scripts/bake/bake-monuments.ts).
export interface Monument {
  id: string // n123 / w123 / r123 (OSM)
  x: number
  y: number
  n: string // nazwa
  ne?: string // nazwa angielska
  k: MonumentKind
  m: 'b' | 's' | 'm' // materiał figury: brąz z patyną, kamień, metal
  h?: number // wysokość z OSM [m]
  a?: string // autor
  yr?: number // rok odsłonięcia
  ins?: string // inskrypcja
  wp?: string // Wikipedia
  wd?: string // Wikidane
  img?: string // miniatura z Commons
  cr?: string // autor i licencja zdjęcia
}

// Treść okienka pomnika (src/app/popups.ts)
export type MonumentHit = PopupContent

const MIN_H = 3.5
const MAX_H = 30
const STONE = '#9a978f'
const MAT = { b: '#5f9e8c', s: '#c9c2b0', m: '#8d929c' }

type Box = [w: number, h: number, d: number, x: number, y0: number, z?: number]

// Kształty w metrach dla typowej wysokości H (skalowane jednolicie do wysokości pomnika).
// base: cokół (szary kamień), fig: figura (kolor materiału przez instanceColor).
// kolejność budowania siatek (= kolejność kluczy SHAPES)
const MONUMENT_KINDS: MonumentKind[] = ['statue', 'bust', 'obelisk', 'stele', 'cross', 'sculpture', 'other']
const SHAPES: Record<MonumentKind, { H: number; base: Box[]; fig: Box[]; extra?: () => THREE.BufferGeometry[] }> = {
  statue: {
    H: 5,
    base: [
      [1.8, 0.3, 1.8, 0, 0],
      [1.3, 2.0, 1.3, 0, 0.3],
      [1.5, 0.2, 1.5, 0, 2.3],
    ],
    fig: [
      [0.8, 0.1, 0.6, 0, 2.5], // płyta
      [0.22, 1.0, 0.26, -0.13, 2.6],
      [0.22, 1.0, 0.26, 0.13, 2.6], // nogi
      [0.6, 0.9, 0.36, 0, 3.6], // tułów
      [0.16, 0.8, 0.2, -0.38, 3.65],
      [0.16, 0.8, 0.2, 0.38, 3.65], // ręce
      [0.3, 0.34, 0.3, 0, 4.5], // głowa
    ],
  },
  bust: {
    H: 3.5,
    base: [
      [1.0, 0.2, 1.0, 0, 0],
      [0.6, 1.8, 0.6, 0, 0.2],
      [0.75, 0.15, 0.75, 0, 2.0],
    ],
    fig: [
      [0.8, 0.45, 0.45, 0, 2.15],
      [0.2, 0.15, 0.2, 0, 2.6],
      [0.4, 0.5, 0.42, 0, 2.75],
    ],
  },
  obelisk: {
    H: 8,
    base: [
      [2.0, 0.3, 2.0, 0, 0],
      [1.5, 0.5, 1.5, 0, 0.3],
    ],
    fig: [],
    // smukły ostrosłup ścięty + piramidka na szczycie (4 ściany, obrócone do osi)
    extra: () => {
      const shaft = new THREE.CylinderGeometry(0.42, 0.75, 6.4, 4, 1)
      shaft.rotateY(Math.PI / 4)
      shaft.translate(0, 0.8 + 3.2, 0)
      const top = new THREE.ConeGeometry(0.42, 0.8, 4)
      top.rotateY(Math.PI / 4)
      top.translate(0, 7.2 + 0.4, 0)
      return [shaft, top]
    },
  },
  stele: {
    H: 3,
    base: [[1.6, 0.3, 0.8, 0, 0]],
    fig: [
      [1.2, 2.5, 0.35, 0, 0.3],
      [1.3, 0.2, 0.45, 0, 2.8],
    ],
  },
  cross: {
    H: 5,
    base: [
      [1.6, 0.4, 1.6, 0, 0],
      [1.1, 0.4, 1.1, 0, 0.4],
    ],
    fig: [
      [0.3, 4.2, 0.3, 0, 0.8],
      [1.8, 0.3, 0.3, 0, 3.75],
    ],
  },
  sculpture: {
    H: 4,
    base: [[1.6, 0.4, 1.6, 0, 0]],
    fig: [
      [1.0, 1.2, 0.8, 0, 0.4],
      [0.7, 1.0, 0.7, 0.2, 1.6, 0.1],
      [0.9, 0.6, 0.4, -0.15, 2.6],
      [0.4, 0.8, 0.4, 0.1, 3.2],
    ],
  },
  other: {
    H: 5,
    base: [
      [2.4, 0.4, 2.4, 0, 0],
      [1.8, 2.6, 1.8, 0, 0.4],
    ],
    fig: [
      [1.2, 1.6, 1.2, 0, 3.0],
      [0.6, 0.4, 0.6, 0, 4.6],
    ],
  },
}

function merge(parts: THREE.BufferGeometry[]) {
  const pos: number[] = [],
    nrm: number[] = []
  for (const p of parts) {
    const g = p.index ? p.toNonIndexed() : p
    pos.push(...attrF32(g, 'position'))
    nrm.push(...attrF32(g, 'normal'))
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.computeVertexNormals() // płaskie ściany (geometria bez indeksów)
  return g
}

const boxes = (bs: Box[]) => bs.map(([w, h, d, x, y0, z = 0]) => new THREE.BoxGeometry(w, h, d).translate(x, y0 + h / 2, z))

interface Part {
  mesh: THREE.InstancedMesh
  idx: number[]
  kind: MonumentKind
} // idx: instancja → indeks pomnika
interface Special {
  mesh: THREE.Mesh
  i: number
} // ręczny model (monuments.models.ts) → indeks pomnika

const LABEL = {
  pl: {
    statue: 'Pomnik',
    bust: 'Popiersie',
    obelisk: 'Obelisk',
    stele: 'Stela',
    cross: 'Krzyż pamiątkowy',
    sculpture: 'Rzeźba',
    other: 'Pomnik',
    author: 'Autor',
    year: 'Odsłonięty',
    ins: 'Napis',
    wp: 'Wikipedia',
    wd: 'Wikidane',
    osm: 'OpenStreetMap',
  },
  en: {
    statue: 'Monument',
    bust: 'Bust',
    obelisk: 'Obelisk',
    stele: 'Stele',
    cross: 'Memorial cross',
    sculpture: 'Sculpture',
    other: 'Monument',
    author: 'Sculptor',
    year: 'Unveiled',
    ins: 'Inscription',
    wp: 'Wikipedia',
    wd: 'Wikidata',
    osm: 'OpenStreetMap',
  },
}

// Rodzaj obiektu OSM z pierwszej litery id (n123, w45, r6).
const OSM_TYPE: Record<string, string> = { n: 'node', w: 'way', r: 'relation' }

export class Monuments implements Pickable {
  group = new THREE.Group()
  private list: Monument[]
  private parts: Part[] = []
  private specials: Special[] = []
  private year = NaN
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private s = new THREE.Vector3()
  private up = new THREE.Vector3(0, 1, 0)

  constructor(data: Monument[]) {
    this.list = data
    const stone = new THREE.MeshLambertMaterial({ color: STONE })
    const fig = new THREE.MeshLambertMaterial({ color: '#ffffff' })
    const col = new THREE.Color()
    for (const k of MONUMENT_KINDS) {
      const idx = data.flatMap((d, i) => (d.k === k && !SPECIAL[d.id] ? [i] : []))
      if (!idx.length) continue
      const sh = SHAPES[k]
      const geoms: [THREE.BufferGeometry, boolean][] = [
        [merge(boxes(sh.base)), false],
        [merge([...boxes(sh.fig), ...(sh.extra?.() ?? [])]), true],
      ]
      for (const [g, isFig] of geoms) {
        const mesh = new THREE.InstancedMesh(g, isFig ? fig : stone, idx.length)
        mesh.castShadow = true
        mesh.receiveShadow = true
        if (isFig) for (const [j, i] of idx.entries()) mesh.setColorAt(j, col.set(MAT[data[i].m]))
        this.parts.push({ mesh, idx, kind: k })
        this.group.add(mesh)
      }
    }
    // najbardziej znane pomniki: osobne bryły z kolorami w wierzchołkach, ustawione raz na stałe
    const vmat = vertexLambert()
    data.forEach((d, i) => {
      const sp = SPECIAL[d.id]
      if (!sp) return
      const mesh = new THREE.Mesh(sp.build(), vmat)
      mesh.position.set(d.x, 0, -d.y)
      mesh.rotation.y = (sp.angle * Math.PI) / 180
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.visible = false
      this.specials.push({ mesh, i })
      this.group.add(mesh)
    })
  }

  // year: rok epoki; pomnik stoi od roku odsłonięcia, bez daty od SINCE.undatedStructures (jak maszty i wieże bez daty)
  update(_dt: number, year: number) {
    if (year === this.year) return
    this.year = year
    for (const { mesh, i } of this.specials) {
      const yr = this.list[i].yr
      mesh.visible = year >= (yr ?? SINCE.undatedStructures)
    }
    for (const { mesh, idx, kind } of this.parts) {
      const H = SHAPES[kind].H
      idx.forEach((i, j) => {
        const d = this.list[i]
        const on = year >= (d.yr ?? SINCE.undatedStructures)
        const k = on ? Math.min(MAX_H, Math.max(MIN_H, d.h ?? H)) / H : 0
        this.q.setFromAxisAngle(this.up, hash(i, 11) * Math.PI * 2)
        this.m.compose(this.v.set(d.x, 0, -d.y), this.q, this.s.setScalar(k))
        mesh.setMatrixAt(j, this.m)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }

  // Kliknięty pomnik (najbliższy) albo null.
  pick(ray: THREE.Raycaster): Pick | null {
    const hit = this.hit(ray)
    return hit ? { open: () => showMonument(hit), outline: { within: this.group } } : null
  }

  private hit(ray: THREE.Raycaster): MonumentHit | null {
    if (!this.group.visible) return null
    let best: { d: number; i: number } | null = null
    for (const { mesh, idx } of this.parts) {
      const h = ray.intersectObject(mesh, false)[0]
      if (h?.instanceId == null || (best && best.d <= h.distance)) continue
      const i = idx[h.instanceId]
      const yr = this.list[i].yr
      if (this.year < (yr ?? SINCE.undatedStructures)) continue
      best = { d: h.distance, i }
    }
    for (const { mesh, i } of this.specials) {
      if (!mesh.visible) continue
      const h = ray.intersectObject(mesh, false)[0]
      if (h && (!best || h.distance < best.d)) best = { d: h.distance, i }
    }
    return best ? this.describe(best.i) : null
  }

  private describe(i: number): MonumentHit {
    const d = this.list[i]
    const l = lang()
    const L = LABEL[l]
    const text = [d.a && `${L.author}: ${d.a}.`, d.yr && `${L.year}: ${d.yr}.`, d.ins && `${L.ins}: „${d.ins}”`].filter(Boolean).join(' ')
    const link = d.wp
      ? { href: d.wp, label: L.wp }
      : d.wd
        ? { href: d.wd, label: L.wd }
        : { href: `https://www.openstreetmap.org/${OSM_TYPE[d.id[0]]}/${d.id.slice(1)}`, label: L.osm }
    return { title: (l === 'en' && d.ne) || d.n, sub: L[d.k], text, img: d.img, credit: d.cr, link }
  }
}
