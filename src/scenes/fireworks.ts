// Sylwester: fajerwerki nad Rynkiem od 23:30 do 0:30, najgęściej o północy.
// Rakiety lecą łukiem w górę z warkoczem iskier i wybuchają kulą cząstek opadających pod wpływem grawitacji.
import * as THREE from 'three'

const COLORS = ['#e05a47', '#f2d16b', '#ffe9a6', '#8fc1e3', '#e8b4b8', '#b4d77a', '#f4f1e6', '#4b8bbf', '#d9734e']
const MAX = 1400
const G = 9.8

// minuty od północy sylwestrowej (ujemne przed), null poza oknem 23:30–0:30
export function newYearMinutes(now: Date): number | null {
  const m = now.getMonth(),
    d = now.getDate(),
    min = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  if (m === 11 && d === 31 && min >= 23.5 * 60) return min - 24 * 60
  if (m === 0 && d === 1 && min < 30) return min
  return null
}

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  size: number
  color: number
  rocket: boolean
  trail: number
}

export class Fireworks {
  mesh: THREE.InstancedMesh
  onBang: (() => void) | null = null
  private ps: Particle[] = []
  private next = 0
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private s = new THREE.Vector3()
  private c = new THREE.Color()

  // area: prostokąt startowy [x0, y0, x1, y1] (płyta Rynku)
  private area: [number, number, number, number]

  constructor(area: [number, number, number, number]) {
    this.area = area
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), MAX)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    this.mesh.setColorAt(0, this.c.set('#ffffff'))
  }

  // minutes: minuty od północy (−30..30) — od nich zależy gęstość pokazu
  update(dt: number, minutes: number) {
    const rate = 0.4 + 4 * Math.max(0, 1 - Math.abs(minutes) / 8) + (minutes >= 0 && minutes < 3 ? 4 : 0)
    this.next -= dt
    while (this.next <= 0) {
      this.next += (0.5 + Math.random()) / rate
      this.launch()
    }
    const out: Particle[] = []
    for (const p of this.ps) {
      p.life += dt
      if (p.rocket) {
        p.vy -= G * dt
        if (p.vy < 4) {
          this.burst(p)
          continue
        }
        if ((p.trail -= dt) <= 0) {
          p.trail = 0.04
          this.add({ x: p.x, y: p.y, z: p.z, vx: 0, vy: -2, vz: 0, life: 0, max: 0.5, size: 1.2, color: 2, rocket: false, trail: 0 })
        }
      } else {
        // opór powietrza i grawitacja
        const drag = Math.exp(-1.6 * dt)
        p.vx *= drag
        p.vz *= drag
        p.vy = p.vy * drag - G * 0.35 * dt
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      if (p.life < p.max) out.push(p)
    }
    this.ps = out.slice(-MAX)
    this.ps.forEach((p, i) => {
      const k = p.rocket ? 1 : 1 - p.life / p.max
      this.v.set(p.x, p.y, p.z)
      this.s.setScalar(p.size * (0.4 + 0.6 * k))
      this.mesh.setMatrixAt(i, this.m.compose(this.v, this.q, this.s))
      // iskry migają pod koniec życia
      const flicker = k < 0.3 && Math.random() < 0.4
      this.mesh.setColorAt(i, this.c.set(flicker ? '#3a2a40' : COLORS[p.color]))
    })
    this.mesh.count = this.ps.length
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  clear() {
    this.ps = []
    this.mesh.count = 0
  }

  private add(p: Particle) {
    if (this.ps.length < MAX) this.ps.push(p)
  }

  private launch() {
    const [x0, y0, x1, y1] = this.area
    const x = x0 + Math.random() * (x1 - x0),
      y = y0 + Math.random() * (y1 - y0)
    const ang = Math.random() * Math.PI * 2,
      tilt = 2 + Math.random() * 5
    this.add({
      x,
      y: 2,
      z: -y,
      vx: Math.cos(ang) * tilt,
      vy: 48 + Math.random() * 14,
      vz: Math.sin(ang) * tilt,
      life: 0,
      max: 10,
      size: 1.8,
      color: 2,
      rocket: true,
      trail: 0,
    })
  }

  private burst(r: Particle) {
    const color = Math.floor(Math.random() * COLORS.length)
    const second = Math.random() < 0.35 ? Math.floor(Math.random() * COLORS.length) : color
    const n = 40 + Math.floor(Math.random() * 30)
    const speed = 18 + Math.random() * 14
    // „wierzba”: wolniejsze, dłużej opadające iskry
    const willow = Math.random() < 0.25
    for (let i = 0; i < n; i++) {
      // równomiernie na sferze (spirala Fibonacciego)
      const t = (i + 0.5) / n,
        phi = Math.acos(1 - 2 * t),
        th = i * 2.39996
      const sp = speed * (0.85 + Math.random() * 0.3) * (willow ? 0.6 : 1)
      this.add({
        x: r.x,
        y: r.y,
        z: r.z,
        vx: Math.sin(phi) * Math.cos(th) * sp,
        vy: Math.cos(phi) * sp,
        vz: Math.sin(phi) * Math.sin(th) * sp,
        life: 0,
        max: (willow ? 3 : 1.8) + Math.random() * 0.6,
        size: 2.2,
        color: i % 2 ? second : color,
        rocket: false,
        trail: 0,
      })
    }
    this.onBang?.()
  }
}
