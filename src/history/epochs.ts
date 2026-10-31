// Epoki: które budynki pokazać, jak je zmienić i co dobudować (mury, bastiony, pas startowy, powódź).
// Rekonstrukcje są przybliżone: OSM zna rok budowy tylko części budynków.
import * as THREE from 'three'
import { bbox, centroid, distToPolyline, hash, pointInRing, toLocal } from '../engine/geo.ts'
import type { BuildOpts } from '../world/buildings.ts'
import type { Building, Flat, World } from '../types/world.ts'
import type { Epoch, Walls } from '../content/index.ts'
import {
  CATHEDRAL_RADIUS,
  GROD_RAMPART_UNTIL,
  LOCATION_YEAR,
  OLD_TOWN_MAX_H,
  WALLED_MAX_H,
  looksLaterThan,
  looksPostwar,
  prewarRadius,
} from '../rules/epochs.ts'
import { SINCE } from '../rules/milestones.ts'
import { modernFortifications } from './fortifications.ts'
import { grodScene } from './grod.ts'

export interface EpochScene {
  opts: BuildOpts
  extras: THREE.Group
  update: (dt: number) => void
  life: { trams: boolean; cars: boolean }
  // przed lokacją miasta: łąka zamiast dzisiejszych ulic, torów, mostów, placów i parków (src/app/apply.ts)
  wild?: boolean
}

const lambert = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, ...extra })
const toFlat = (pts: [number, number][]) => pts.flatMap(([lat, lon]) => toLocal(lat, lon))
// Punkt budynku do testów „w murach”, „blisko centrum”, „przy pasie startowym”: środek obrysu
// (pierwszy wierzchołek leży w dowolnym narożniku). Liczony raz na budynek, bo filtr epoki przechodzi po wszystkich.
const mids = new WeakMap<Building, [number, number]>()
const anchor = (b: Building) => {
  let m = mids.get(b)
  if (!m) mids.set(b, (m = centroid(b.o)))
  return m
}
const RYNEK = { lat: 51.1099, lon: 17.0326 }

// Pas muru wzdłuż polilinii: prostopadłościany na każdym odcinku + baszty co `every` metrów.
function wallAlong(p: Flat, width: number, height: number, color: string, every = 0, towerColor = color) {
  const g = new THREE.Group()
  const mat = lambert(color)
  const tmat = lambert(towerColor)
  let acc = 0
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i],
      ay = p[i + 1],
      bx = p[i + 2],
      by = p[i + 3]
    const L = Math.hypot(bx - ax, by - ay)
    if (L < 0.5) continue
    const m = new THREE.Mesh(new THREE.BoxGeometry(L + width * 0.5, height, width), mat)
    m.position.set((ax + bx) / 2, height / 2, -(ay + by) / 2)
    m.rotation.y = Math.atan2(by - ay, bx - ax)
    m.castShadow = m.receiveShadow = true
    g.add(m)
    if (every > 0) {
      for (acc += L; acc >= every; acc -= every) {
        const t = 1 - (acc - every) / L
        const tw = new THREE.Mesh(new THREE.BoxGeometry(width * 2.2, height * 1.5, width * 2.2), tmat)
        tw.position.set(ax + (bx - ax) * t, height * 0.75, -(ay + (by - ay) * t))
        tw.rotation.y = m.rotation.y
        tw.castShadow = true
        const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 1.7, height * 0.8, 4), lambert('#b5523a'))
        roof.position.y = height * 1.15
        roof.rotation.y = Math.PI / 4
        tw.add(roof)
        g.add(tw)
      }
    }
  }
  return g
}

function closedRing(p: Flat): Flat {
  return p.length ? p.concat([p[0], p[1]]) : p
}

// Powódź 1997: komórki siatki w zasięgu od wody (BFS po siatce), z poszarpanym brzegiem.
const FLOOD_CELL = 15 // [m]
const FLOOD_MAX_STEPS = 13 // BFS dalej nie idzie (13 × 15 m ≈ 195 m)
function floodMesh(world: World) {
  const cell = FLOOD_CELL
  const [x0, y0, x1, y1] = world.bounds
  const nx = Math.ceil((x1 - x0) / cell),
    ny = Math.ceil((y1 - y0) / cell)
  const dist = new Int16Array(nx * ny).fill(-1)
  const queue: number[] = []
  const polys = world.water.map((w) => ({ ring: w.o, box: bbox(w.o) }))
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * cell,
        y = y0 + (j + 0.5) * cell
      if (polys.some((p) => x >= p.box[0] && x <= p.box[2] && y >= p.box[1] && y <= p.box[3] && pointInRing(x, y, p.ring))) {
        dist[j * nx + i] = 0
        queue.push(j * nx + i)
      }
    }
  for (let q = 0; q < queue.length; q++) {
    const id = queue[q],
      i = id % nx,
      j = (id / nx) | 0,
      d = dist[id]
    if (d >= FLOOD_MAX_STEPS) continue
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const a = i + di,
        b = j + dj
      if (a < 0 || b < 0 || a >= nx || b >= ny || dist[b * nx + a] >= 0) continue
      dist[b * nx + a] = d + 1
      queue.push(b * nx + a)
    }
  }
  const pos: number[] = []
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const d = dist[j * nx + i]
      if (d <= 0 || d > 6 + hash(i >> 2, j >> 2) * 7) continue
      const ax = x0 + i * cell,
        ay = y0 + j * cell,
        bx = ax + cell,
        by = ay + cell
      pos.push(ax, 0, -ay, bx, 0, -ay, bx, 0, -by, ax, 0, -ay, bx, 0, -by, ax, 0, -by)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  const m = new THREE.Mesh(g, lambert('#4b8bbf', { transparent: true, opacity: 0.82 }))
  m.position.y = 1.4
  m.receiveShadow = true
  return m
}

// Dym nad ruinami: kilka słupów dymu, każdy z kłębów, które rosną, unoszą się z wiatrem i znikają.
function smoke(world: World, count: number) {
  const fires = world.buildings.filter((b, i) => hash(i, 41) < 0.004 && b.H > 8).slice(0, 14)
  const mesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    lambert('#8f877d', { transparent: true, opacity: 0.55, depthWrite: false }),
    count,
  )
  mesh.frustumCulled = false
  const LIFE = 14
  const seeds = Array.from({ length: count }, (_, i) => ({ b: fires[i % Math.max(1, fires.length)], t: hash(i, 3) * LIFE }))
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    v = new THREE.Vector3(),
    s = new THREE.Vector3()
  const update = (dt: number) => {
    seeds.forEach((sd, i) => {
      if (!sd.b) return
      sd.t = (sd.t + dt) % LIFE
      const [x, y] = anchor(sd.b)
      const k = sd.t / LIFE
      v.set(x + Math.sin(sd.t * 0.7 + i) * 4 + k * 70, sd.b.H + 4 + k * 120, -y - k * 25)
      // rośnie, a pod koniec maleje — kłąb „rozpływa się” zamiast znikać nagle
      s.setScalar((5 + k * 26) * Math.min(1, (1 - k) * 4))
      m.compose(v, q, s)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  update(0)
  return { mesh, update }
}

// części jednego budynku o tej samej nazwie leżą najwyżej tyle metrów od siebie
const LATER_PART_RADIUS = 300

export function epochScene(epoch: Epoch, world: World, walls: Walls): EpochScene {
  const Y = epoch.year
  const extras = new THREE.Group()
  let update = (_dt: number) => {}
  const notLater = (b: Building) => !b.y || b.y <= Y
  const life = { trams: Y >= SINCE.trams, cars: Y >= SINCE.cars }
  // Budynek z częściami: jeśli któraś bryła o tej nazwie w pobliżu wygląda na późniejszą (galeria, biurowiec),
  // chowamy wszystkie jego części (wieżyczki i niskie skrzydła Galerii Dominikańskiej osobno by zostały).
  const laterParts = new Map<string, [number, number][]>()
  for (const b of world.buildings)
    if (b.n && !b.y && looksLaterThan(b, Y)) {
      const list = laterParts.get(b.n) ?? []
      list.push(anchor(b))
      laterParts.set(b.n, list)
    }
  const later = (b: Building) =>
    looksLaterThan(b, Y) ||
    (!!b.n && (laterParts.get(b.n) ?? []).some(([x, y]) => Math.hypot(anchor(b)[0] - x, anchor(b)[1] - y) < LATER_PART_RADIUS))

  const outer = closedRing(toFlat(walls.outer))
  const inner = closedRing(toFlat(walls.inner))
  const cityCenter = toLocal(RYNEK.lat, RYNEK.lon)
  const inside = (ring: Flat, b: Building) => ring.length > 6 && pointInRing(...anchor(b), ring)

  if (epoch.mode === 'walls' || epoch.mode === 'medieval') {
    const medieval = epoch.mode === 'medieval'
    const early = Y < LOCATION_YEAR
    const cathedral = toLocal(51.1142, 17.0464)
    const opts: BuildOpts = {
      keep: (b) => {
        if (b.y && b.y > Y) return false
        // w grodzie nic z dzisiejszej zabudowy: gród (z pierwszą katedrą i kaplicą św. Marcina) rysuje grodScene
        if (early) return false
        const town = inside(medieval ? inner : outer, b)
        if (town) return b.k === 'church' || b.H < (medieval ? WALLED_MAX_H.medieval : WALLED_MAX_H.fortress)
        return !!b.y || (b.k === 'church' && Math.hypot(anchor(b)[0] - cathedral[0], anchor(b)[1] - cathedral[1]) < CATHEDRAL_RADIUS)
      },
      mod: (b) => (b.y ? undefined : { roof: b.k === 'church' ? undefined : '#b5523a' }),
    }
    if (early) extras.add(grodScene(true))
    else {
      if (Y < GROD_RAMPART_UNTIL) extras.add(grodScene(false))
      extras.add(wallAlong(inner.slice(0, -2), 2.5, 10, '#8a3b2a', 55, '#8a3b2a'))
      if (!medieval) {
        const bastions = walls.bastions.map((bs) => toLocal(bs.lat, bs.lon))
        extras.add(modernFortifications(outer.slice(0, -2), bastions, cityCenter))
      }
    }
    return { opts, extras, update, life, wild: early }
  }

  if (epoch.mode === 'festung') {
    const runway = world.runway ?? []
    const nearRunway = (b: Building) => runway.some((p) => distToPolyline(...anchor(b), p) < 70)
    for (const p of runway) {
      // pas startowy nad podkładem planu (PLAN_Y = 0.36 m, src/world/history.ts)
      const g = wallAlong(p, 70, 0.5, '#a4a9bd')
      extras.add(g)
    }
    const s = smoke(world, 140)
    extras.add(s.mesh)
    update = s.update
    const opts: BuildOpts = {
      keep: (b) => notLater(b) && !nearRunway(b) && (!!b.y || !looksPostwar(b)),
      mod: (b, i) => {
        if (hash(i, 17) > 0.62) return undefined
        return {
          H: Math.max(2, b.H * (0.12 + hash(i, 19) * 0.35)),
          wall: hash(i, 23) > 0.5 ? '#6b6560' : '#4a4744',
          roof: '#3d3f58',
          flat: true,
        }
      },
    }
    return { opts, extras, update, life: { trams: false, cars: false } }
  }

  if (epoch.mode === 'flood') extras.add(floodMesh(world))

  if (Y < 1945) {
    // Przed wojną: przybliżony zasięg zabudowy (odległość od Rynku) i bez brył wyglądających na powojenne.
    // Budynki z datą budowy w OSM rozstrzygają same za siebie.
    const radius = prewarRadius(Y)
    const keep = (b: Building) => {
      if (b.y) return b.y <= Y
      // galerie, biurowce i szkło także w Starym Mieście (Galeria Dominikańska stała w obrębie fosy)
      if (later(b)) return false
      if (inside(outer, b)) return b.H < OLD_TOWN_MAX_H || b.k === 'church' || b.k === 'pub'
      if (looksPostwar(b)) return false
      return near(b, cityCenter, radius)
    }
    return { opts: { keep }, extras, update, life }
  }

  // Po wojnie: bez daty w OSM chowamy bryły typowe dla późniejszych lat (biurowce, galerie, szkło).
  return { opts: { keep: (b) => (b.y ? b.y <= Y : !later(b)) }, extras, update, life }
}

const near = (b: Building, [x, y]: [number, number], r: number) => Math.hypot(anchor(b)[0] - x, anchor(b)[1] - y) < r
