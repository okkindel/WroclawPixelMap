// Mecz piłkarski na boisku stadionu: dwie drużyny po 11 zawodników, sędzia i piłka podawana między graczami.
// Zawodnicy trzymają się swoich pozycji w ustawieniu i podbiegają do piłki; piłka leci po łuku do kolejnego gracza.
import * as THREE from 'three'
import { hash } from '../engine/geo.ts'
import type { Flat } from '../types/world.ts'
import { merge } from '../world/geometry.ts'
import { box, vertexLambert } from './util.ts'

// Śląsk Wrocław (zielone koszulki, białe spodenki) kontra goście (białe koszulki, granatowe spodenki)
const HOME = { shirt: '#2e8b3a', shorts: '#f4f1e6', keeper: '#f2d16b' }
const AWAY = { shirt: '#f4f1e6', shorts: '#1d2340', keeper: '#e05a47' }
// ustawienie 1-4-4-2: [wzdłuż boiska 0..1 od własnej bramki, w poprzek -1..1]
const FORMATION: [number, number][] = [
  [0.04, 0],
  [0.2, -0.7],
  [0.18, -0.25],
  [0.18, 0.25],
  [0.2, 0.7],
  [0.42, -0.75],
  [0.38, -0.25],
  [0.38, 0.25],
  [0.42, 0.75],
  [0.62, -0.25],
  [0.62, 0.25],
]
const SPEED = 6 // m/s
const PASS_TIME = 1.4 // s lotu piłki

function player(shirt: string, shorts: string) {
  return merge([
    [box(0.4, 0.8, 0.5, 0, 0), '#2b2d42'],
    [box(0.45, 0.5, 0.55, 0, 0.8), shorts],
    [box(0.5, 0.7, 0.6, 0, 1.3), shirt],
    [box(0.35, 0.35, 0.35, 0, 2.0), '#e8a074'],
  ])
}

interface Rect {
  cx: number
  cy: number
  ux: number
  uy: number
  vx: number
  vy: number
  L: number
  W: number
}

// Prostokąt boiska z obrysu: oś długa i krótka (z najdłuższej krawędzi).
function pitchRect(o: Flat): Rect {
  const n = o.length / 2
  let cx = 0,
    cy = 0
  for (let i = 0; i < n; i++) {
    cx += o[i * 2]
    cy += o[i * 2 + 1]
  }
  cx /= n
  cy /= n
  let best = 0,
    ux = 1,
    uy = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const dx = o[j * 2] - o[i * 2],
      dy = o[j * 2 + 1] - o[i * 2 + 1],
      L = Math.hypot(dx, dy)
    if (L > best) {
      best = L
      ux = dx / L
      uy = dy / L
    }
  }
  const vx = -uy,
    vy = ux
  let a0 = Infinity,
    a1 = -Infinity,
    b0 = Infinity,
    b1 = -Infinity
  for (let i = 0; i < n; i++) {
    const x = o[i * 2] - cx,
      y = o[i * 2 + 1] - cy
    const a = x * ux + y * uy,
      b = x * vx + y * vy
    a0 = Math.min(a0, a)
    a1 = Math.max(a1, a)
    b0 = Math.min(b0, b)
    b1 = Math.max(b1, b)
  }
  return { cx, cy, ux, uy, vx, vy, L: a1 - a0, W: b1 - b0 }
}

interface Man {
  x: number
  y: number
  home: [number, number]
  team: 0 | 1
}

export class Football {
  group = new THREE.Group()
  private r: Rect
  private men: Man[] = []
  private meshes: THREE.InstancedMesh[]
  private ball: THREE.Mesh
  private holder = 0
  private target = 1
  private flight = 0
  private t = 0
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private one = new THREE.Vector3(1, 1, 1)
  private up = new THREE.Vector3(0, 1, 0)

  constructor(pitch: Flat) {
    this.r = pitchRect(pitch)
    for (const team of [0, 1] as const) {
      FORMATION.forEach(([a, b]) => {
        // drużyna gości gra w drugą stronę
        const along = team ? 1 - a : a
        const home: [number, number] = [(along - 0.5) * this.r.L * 0.92, b * this.r.W * 0.42]
        this.men.push({ x: home[0], y: home[1], home, team })
      })
    }
    // sędzia
    this.men.push({ x: 0, y: this.r.W * 0.2, home: [0, this.r.W * 0.2], team: 0 })
    const mats = vertexLambert()
    this.meshes = [
      new THREE.InstancedMesh(player(HOME.shirt, HOME.shorts), mats, 10),
      new THREE.InstancedMesh(player(HOME.keeper, '#2b2d42'), mats, 1),
      new THREE.InstancedMesh(player(AWAY.shirt, AWAY.shorts), mats, 10),
      new THREE.InstancedMesh(player(AWAY.keeper, '#2b2d42'), mats, 1),
      new THREE.InstancedMesh(player('#1c1c2e', '#1c1c2e'), mats, 1),
    ]
    for (const mesh of this.meshes) {
      mesh.frustumCulled = false
      mesh.castShadow = true
      this.group.add(mesh)
    }
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), new THREE.MeshLambertMaterial({ color: '#ffffff' }))
    this.group.add(this.ball)
    // bramki: białe ramy na krótkich bokach
    const post = new THREE.MeshLambertMaterial({ color: '#ffffff' })
    for (const side of [-1, 1]) {
      const [gx, gy] = this.toWorld(side * this.r.L * 0.5, 0)
      const goal = new THREE.Group()
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 0.25), post)
        p.position.set(0, 1.2, s * 3.66)
        goal.add(p)
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 7.6), post)
      bar.position.y = 2.4
      goal.add(bar)
      goal.position.set(gx, 0.2, -gy)
      goal.rotation.y = Math.atan2(this.r.uy, this.r.ux)
      this.group.add(goal)
    }
  }

  // współrzędne boiska (wzdłuż, w poprzek) -> metry lokalne mapy
  private toWorld(a: number, b: number): [number, number] {
    const r = this.r
    return [r.cx + r.ux * a + r.vx * b, r.cy + r.uy * a + r.vy * b]
  }

  update(dt: number) {
    this.t += dt
    this.flight += dt
    // nowe podanie: częściej do partnera, czasem przechwyt przez rywala
    if (this.flight > PASS_TIME + 0.6) {
      this.holder = this.target
      const team = this.men[this.holder].team
      let next = this.holder
      for (let k = 0; k < 10 && (next === this.holder || next === 22); k++) {
        const h = hash(Math.floor(this.t * 10), k + 3)
        const sameTeam = h < 0.75
        next = Math.floor(hash(Math.floor(this.t * 7), k + 9) * 11) + ((sameTeam ? team : 1 - team) ? 11 : 0)
      }
      this.target = next
      this.flight = 0
    }
    const from = this.men[this.holder],
      to = this.men[this.target]
    const k = Math.min(1, this.flight / PASS_TIME)
    const bx = from.x + (to.x - from.x) * k,
      by = from.y + (to.y - from.y) * k
    // zawodnicy: przesunięcie ustawienia w stronę piłki + najbliżsi biegną do niej
    this.men.forEach((man, i) => {
      const chase = i === this.target ? 1 : i === 22 ? 0.6 : 0.25
      const tx = man.home[0] * 0.7 + bx * 0.3 * (1 + chase),
        ty = man.home[1] * 0.75 + by * 0.25 * (1 + chase)
      const goalX = i === this.target ? to.x : tx,
        goalY = i === this.target ? to.y : ty
      const dx = goalX - man.x,
        dy = goalY - man.y,
        d = Math.hypot(dx, dy)
      const step = Math.min(d, SPEED * dt * (0.6 + hash(i, 5) * 0.6))
      if (d > 0.01) {
        man.x += (dx / d) * step
        man.y += (dy / d) * step
      }
    })
    const counts = [0, 0, 0, 0, 0]
    this.men.forEach((man, i) => {
      const slot = i === 22 ? 4 : man.team * 2 + (i % 11 === 0 ? 1 : 0)
      const [wx, wy] = this.toWorld(man.x, man.y)
      this.v.set(wx, 0.2 + Math.abs(Math.sin(this.t * 9 + i)) * 0.15, -wy)
      this.q.setFromAxisAngle(this.up, Math.atan2(by - man.y, bx - man.x) + Math.atan2(this.r.uy, this.r.ux))
      this.meshes[slot].setMatrixAt(counts[slot]++, this.m.compose(this.v, this.q, this.one))
    })
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true
    const [wx, wy] = this.toWorld(bx, by)
    this.ball.position.set(wx, 0.6 + Math.sin(k * Math.PI) * 4, -wy)
  }
}

// Mecz gra Śląsk Wrocław na Tarczyński Arena: w sezonie (bez lipca) w weekendowe popołudnia i wieczory.
export function matchOn(now: Date) {
  const day = now.getDay(),
    h = now.getHours() + now.getMinutes() / 60,
    month = now.getMonth()
  return month !== 6 && (day === 0 || day === 6) && h >= 17.5 && h < 19.5
}
