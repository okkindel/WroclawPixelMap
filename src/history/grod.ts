// Gród na Ostrowie Tumskim (ok. 1000 r.): wał z palisadą, brama, chaty, katedra, palatium i kaplica św. Marcina.
// Układ (GROD w rules/epochs.ts) w metrach względem punktu GROD.at; wszystko deterministyczne (hash).
import * as THREE from 'three'
import { distToPolyline, hash, pointInRing, toLocal } from '../engine/geo.ts'
import { GROD } from '../rules/epochs.ts'
import type { Flat } from '../types/world.ts'
import { box, place, vertexLambert } from '../scenes/util.ts'
import { Geo, flatPoly, merge, strip } from '../world/geometry.ts'
import { boxAlong, doubleLambert, offsetLine, rampart } from './fortifications.ts'

const EARTH = '#7d6450',
  EARTH_LIGHT = '#9c7a5c',
  WOOD = '#7d6450',
  WOOD_DARK = '#5a2e22',
  STONE = '#d6ccb8',
  STONE_DARK = '#b3a99a',
  GRASS = '#7cb35a'
const CROWN = 4.5 // wysokość korony wału [m]
const GATE_GAP = 6 // pół szerokości przejazdu w bramie [m]

// Dach dwuspadowy: graniastosłup o kalenicy wzdłuż X (dł. len, szer. w, wys. h), podstawa na wysokości y.
function prism(len: number, w: number, h: number, x = 0, y = 0, z = 0) {
  const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)])
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false })
  g.translate(0, 0, -len / 2)
  g.rotateY(Math.PI / 2)
  g.translate(x, y, z)
  return g
}
// Dach namiotowy (ostrosłup czworoboczny) o „promieniu” r.
function pyramid(r: number, h: number, x = 0, y = 0, z = 0) {
  const g = new THREE.ConeGeometry(r, h, 4)
  g.rotateY(Math.PI / 4)
  g.translate(x, y + h / 2, z)
  return g
}
// Półkolista absyda od wschodu (+X).
function apse(r: number, h: number, x: number) {
  const g = new THREE.CylinderGeometry(r, r, h, 8, 1, false, 0, Math.PI)
  g.translate(x, h / 2, 0)
  return g
}

function mesh(parts: [THREE.BufferGeometry, string][], x: number, y: number, angle = 0) {
  const m = new THREE.Mesh(merge(parts), vertexLambert())
  m.position.set(x, 0, -y)
  m.rotation.y = angle
  m.castShadow = m.receiveShadow = true
  return m
}

// Katedra Chrobrego: trójnawowa bazylika ok. 34 × 18 m z wieżami od wschodu, prezbiterium z absydą.
const cathedral = (): [THREE.BufferGeometry, string][] => [
  [box(34, 11, 8), STONE],
  [box(30, 6, 5, -2, 0, 6.5), STONE_DARK],
  [box(30, 6, 5, -2, 0, -6.5), STONE_DARK],
  [prism(34, 9, 4, 0, 11), WOOD_DARK],
  [box(30, 0.6, 5.6, -2, 6, 6.5), WOOD_DARK],
  [box(30, 0.6, 5.6, -2, 6, -6.5), WOOD_DARK],
  [apse(4, 8, 17), STONE],
  [box(5, 20, 5, 14, 0, 6.5), STONE],
  [box(5, 20, 5, 14, 0, -6.5), STONE],
  [pyramid(4, 6, 14, 20, 6.5), WOOD_DARK],
  [pyramid(4, 6, 14, 20, -6.5), WOOD_DARK],
]
// Palatium księcia: kamienna sala z wieżą, przy niej drewniana przybudówka.
const palatium = (): [THREE.BufferGeometry, string][] => [
  [box(22, 9, 10), STONE_DARK],
  [prism(22.6, 11, 4.5, 0, 9), WOOD_DARK],
  [box(7, 20, 7, -13), '#8f877d'],
  [pyramid(5.6, 6, -13, 20), WOOD_DARK],
  [box(10, 5, 8, 15, 0, -3), WOOD],
  [prism(10.4, 9, 3, 15, 5, -3), WOOD_DARK],
]
// Kaplica św. Marcina (XI w.): mała nawa z absydą.
const chapel = (): [THREE.BufferGeometry, string][] => [
  [box(9, 6, 6), STONE_DARK],
  [prism(9.4, 7, 3.2, 0, 6), WOOD_DARK],
  [apse(2.8, 5, 4.5), STONE_DARK],
  [box(3, 10, 3, -4.5), STONE_DARK],
  [pyramid(2.4, 3, -4.5, 10), WOOD_DARK],
]
// Chata z bali z dwuspadowym dachem (kalenica wzdłuż X).
const hut = (roof: string) =>
  merge([
    [box(6, 2.6, 4.4), WOOD],
    [prism(6.8, 5.8, 2.6, 0, 2.6), roof],
  ])

// village: pełny gród z zabudową; bez niego sam wał z resztkami palisady (po lokacji)
export function grodScene(village: boolean) {
  const g = new THREE.Group()
  const [ox, oy] = toLocal(GROD.at[0], GROD.at[1])
  const L = ([x, y]: [number, number]): [number, number] => [ox + x, oy + y]
  const pts = GROD.ring.map(L)
  const ring: Flat = pts.flat()
  const roads = GROD.roads.map((r) => r.flatMap(L))
  const sq = L(GROD.square)
  const mid: [number, number] = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]

  // wał otwarty w bramie (pierwszy punkt pierścienia): zaczyna się i kończy GATE_GAP od niej
  const [gx, gy] = pts[0]
  const toward = ([x, y]: [number, number]): [number, number] => {
    const d = Math.hypot(x - gx, y - gy)
    return [gx + ((x - gx) / d) * GATE_GAP, gy + ((y - gy) / d) * GATE_GAP]
  }
  const open: Flat = [...toward(pts[1]), ...pts.slice(1).flat(), ...toward(pts[pts.length - 1])]

  const geo = new Geo()
  rampart(
    geo,
    open,
    [
      [7, 0, EARTH],
      [2.5, CROWN, EARTH],
      [-2.5, CROWN, EARTH_LIGHT],
      [-7, 0, EARTH_LIGHT],
    ],
    mid,
  )
  // palisada z bali na zewnętrznej krawędzi korony
  const pal = offsetLine(open, 1.6, mid)
  boxAlong(geo, pal, 0.8, CROWN - 0.5, CROWN + (village ? 3 : 1.6), WOOD_DARK, (i) => village || hash(i, 7) < 0.4)

  if (village) {
    // trawa w obrębie wału (nad drogami i podkładem planu), ubite drogi i placyk
    flatPoly(geo, ring, undefined, 0.3, GRASS)
    for (const r of roads) strip(geo, r, 6, 0.34, EARTH_LIGHT)
    const plaza: Flat = []
    for (let k = 0; k < 10; k++) plaza.push(sq[0] + Math.cos(k * 0.628) * 24, sq[1] + Math.sin(k * 0.628) * 20)
    flatPoly(geo, plaza, undefined, 0.34, EARTH_LIGHT)
  }
  const m = new THREE.Mesh(geo.build(), doubleLambert())
  m.castShadow = m.receiveShadow = true
  g.add(m)

  // po lokacji zostaje sam wał z resztkami palisady
  if (!village) return g

  // brama: drewniana wieża nad przejazdem, w poprzek wału
  const [ax, ay] = pts[pts.length - 1],
    [bx, by] = pts[1]
  const gate: [THREE.BufferGeometry, string][] = [
    [box(3, CROWN + 3, 12, -GATE_GAP - 1.5), WOOD],
    [box(3, CROWN + 3, 12, GATE_GAP + 1.5), WOOD],
    [box(2 * GATE_GAP + 6, 4.5, 12, 0, CROWN + 3), WOOD],
    [pyramid(10, 5, 0, CROWN + 7.5), WOOD_DARK],
  ]
  g.add(mesh(gate, gx, gy, Math.atan2(by - ay, bx - ax)))

  const [cx, cy] = L(GROD.cathedral),
    [px, py] = L(GROD.palatium),
    [mx, my] = L(GROD.martin)
  g.add(mesh(cathedral(), cx, cy))
  g.add(mesh(palatium(), px, py, 0.08))
  g.add(mesh(chapel(), mx, my))

  // chaty: siatka obrócona wzdłuż osi brama–katedra, z odrzuceniem miejsc zajętych i za blisko wału
  const closed = ring.concat(ring[0], ring[1])
  const busy: [number, number, number][] = [
    [cx, cy, 30],
    [px, py, 22],
    [mx, my, 14],
    [sq[0], sq[1], 28],
    [gx, gy, 22],
  ]
  const axis = Math.atan2(cy - gy, cx - gx)
  const ux = Math.cos(axis),
    uy = Math.sin(axis)
  const STEP = 13
  const spots: { x: number; y: number; r: number; k: number }[] = []
  for (let i = -30; i <= 30; i++)
    for (let j = -30; j <= 30; j++) {
      const x = mid[0] + (i * ux - j * uy) * STEP + (hash(i, j) - 0.5) * 5,
        y = mid[1] + (i * uy + j * ux) * STEP + (hash(j, i + 99) - 0.5) * 5
      if (!pointInRing(x, y, ring) || distToPolyline(x, y, closed) < 14) continue
      if (busy.some(([bx, by, r]) => Math.hypot(x - bx, y - by) < r)) continue
      if (roads.some((r) => distToPolyline(x, y, r) < 8)) continue
      spots.push({ x, y, r: hash(i + 7, j + 13), k: i * 1000 + j })
    }
  spots.sort((a, b) => a.r - b.r)
  const chosen = spots.slice(0, GROD.huts)
  const roofs = ['#c2a67e', '#b3a99a', WOOD_DARK]
  const mtx = new THREE.Matrix4()
  roofs.forEach((roof, v) => {
    const mine = chosen.filter((s) => Math.floor(hash(s.k, 5) * roofs.length) === v)
    const im = new THREE.InstancedMesh(hut(roof), vertexLambert(), Math.max(1, mine.length))
    im.count = mine.length
    mine.forEach((s, n) => {
      const turn = hash(s.k, 3) < 0.5 ? 0 : Math.PI / 2
      place(mtx, s.x, s.y, 0, axis + turn + (hash(s.k, 4) - 0.5) * 0.3, 0.85 + hash(s.k, 6) * 0.4)
      im.setMatrixAt(n, mtx)
    })
    im.castShadow = im.receiveShadow = true
    g.add(im)
  })
  return g
}
