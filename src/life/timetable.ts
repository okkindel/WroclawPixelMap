// Tramwaje według rozkładu GTFS MPK: na podstawie godziny i dnia tygodnia wyliczamy, które kursy są w drodze
// i gdzie na trasie jest każdy wagon (równomiernie między pętlami, bez postojów na przystankach).
import * as THREE from 'three'
import type { TramSchedule, TramTrip } from '../types/world.ts'

const CARS = 3
const CAR_GAP = 10.4
const MAX = 400

interface Shape {
  p: number[]
  cum: number[]
  len: number
}

export class Timetable {
  mesh: THREE.InstancedMesh
  active: TramTrip[] = []
  private data: TramSchedule
  private shapes: Shape[]
  private lastScan = -1
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private one = new THREE.Vector3(1, 1, 1)
  private up = new THREE.Vector3(0, 1, 0)

  constructor(data: TramSchedule, geo: THREE.BufferGeometry) {
    this.data = data
    this.shapes = data.shapes.map((p) => {
      const cum = [0]
      // punkty trasy: [x, y, z] (z = wysokość toru, np. na moście)
      for (let i = 3; i < p.length; i += 3) cum.push(cum[cum.length - 1] + Math.hypot(p[i] - p[i - 3], p[i + 1] - p[i - 2]))
      return { p, cum, len: cum[cum.length - 1] }
    })
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), MAX * CARS)
    this.mesh.frustumCulled = false
    this.mesh.castShadow = true
    this.mesh.count = 0
  }

  // Kursy w drodze: dzisiejsze oraz wczorajsze, które trwają po północy (GTFS liczy godziny > 24:00).
  private scan(date: Date, t: number) {
    const today = 1 << ((date.getDay() + 6) % 7)
    const yesterday = 1 << ((date.getDay() + 5) % 7)
    this.active = []
    for (const trip of this.data.trips) {
      const [, , , days, dep, dur] = trip
      if ((days & today && dep <= t && t < dep + dur) || (days & yesterday && dep <= t + 86400 && t + 86400 < dep + dur)) {
        this.active.push(trip)
        if (this.active.length >= MAX) break
      }
    }
  }

  private at(sh: Shape, s: number) {
    s = Math.max(0, Math.min(sh.len, s))
    let lo = 1,
      hi = sh.cum.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (sh.cum[mid] < s) lo = mid + 1
      else hi = mid
    }
    const i = lo
    const f = (s - sh.cum[i - 1]) / (sh.cum[i] - sh.cum[i - 1] || 1)
    const p = sh.p
    const a = (i - 1) * 3,
      b = i * 3
    const ax = p[a],
      ay = p[a + 1],
      bx = p[b],
      by = p[b + 1]
    return [ax + (bx - ax) * f, ay + (by - ay) * f, Math.atan2(by - ay, bx - ax), p[a + 2] + (p[b + 2] - p[a + 2]) * f]
  }

  update(date: Date) {
    const t = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000
    if (Math.abs(t - this.lastScan) > 1) {
      this.scan(date, t)
      this.lastScan = t
    }
    let n = 0
    for (const [, shape, , , dep, dur] of this.active) {
      const sh = this.shapes[shape]
      const k = ((t - dep + 86400) % 86400) / dur
      const s = k * sh.len
      for (let c = 0; c < CARS; c++) {
        const [x, y, ang, z] = this.at(sh, s - c * CAR_GAP)
        this.v.set(x, z, -y)
        this.q.setFromAxisAngle(this.up, ang)
        this.m.compose(this.v, this.q, this.one)
        this.mesh.setMatrixAt(n++, this.m)
      }
    }
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
  }

  // Opis kursu dla klikniętej instancji (wagonu).
  describe(instance: number) {
    const trip = this.active[Math.floor(instance / CARS)]
    if (!trip) return null
    const hhmm = (s: number) => `${String(Math.floor(s / 3600) % 24).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`
    return { line: this.data.lines[trip[0]], head: this.data.heads[trip[2]], dep: hhmm(trip[4]), arr: hhmm(trip[4] + trip[5]) }
  }
}
