// Easter egg: bieg żużlowy na Stadionie Olimpijskim. Czterech zawodników (kaski: czerwony, niebieski,
// biały, żółty), lewe zakręty, przechył w łukach i pył spod tylnego koła.
import * as THREE from 'three'
import { centroid, cumLengths, signedArea } from '../engine/geo.ts'
import type { Flat } from '../types/world.ts'

// Sparta Wrocław jeździ w żółto-czerwonych barwach; rywale w innych kevlarach.
const RIDERS = [
  { helmet: '#c8312f', kevlar: '#e3b341', speed: 24.5, lane: 1.5 },
  { helmet: '#2f6fa8', kevlar: '#1d2340', speed: 24.0, lane: 4.5 },
  { helmet: '#f4f1e6', kevlar: '#e3b341', speed: 23.6, lane: 3.0 },
  { helmet: '#f2d16b', kevlar: '#5f9e8c', speed: 23.2, lane: 6.0 },
]

function rider(helmet: string, kevlar: string) {
  const g = new THREE.Group()
  const part = (w: number, h: number, d: number, x: number, y: number, z: number, color: string) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }))
    m.position.set(x, y, z)
    m.castShadow = true
    g.add(m)
  }
  part(2.1, 0.5, 0.35, 0, 0.55, 0, '#1d2340') // motocykl
  part(0.7, 0.7, 0.12, 0.85, 0.45, 0, '#cfd2dc') // przednie koło
  part(0.7, 0.7, 0.16, -0.85, 0.45, 0, '#cfd2dc') // tylne koło
  part(0.6, 0.85, 0.5, -0.2, 1.25, 0, kevlar)
  part(0.45, 0.45, 0.45, 0.05, 1.85, 0, helmet)
  // przy oddaleniu trzeba ich powiększyć, inaczej to pojedyncze piksele
  g.scale.setScalar(2.2)
  return g
}

interface Racer { bike: THREE.Group; s: number; speed: number; lane: number; dustNext: number }

export class Speedway {
  group = new THREE.Group()
  racers: Racer[]
  private track: Flat
  private cx = 0
  private cy = 0
  private cum: number[] = []
  private len = 0
  private dust: THREE.InstancedMesh
  private dustLife: { x: number; z: number; t: number }[] = []
  private m = new THREE.Matrix4()

  constructor(ring: Flat) {
    // żużel jeździ w lewo: tor przeciwnie do ruchu wskazówek zegara (w układzie x=wschód, y=północ)
    this.track = signedArea(ring) > 0 ? ring : reversePts(ring)
    ;[this.cx, this.cy] = centroid(ring)
    this.cum = cumLengths(this.track)
    this.len = this.cum[this.cum.length - 1]
    this.racers = RIDERS.map((r, i) => {
      const bike = rider(r.helmet, r.kevlar)
      this.group.add(bike)
      return { bike, s: -i * 4, speed: r.speed, lane: r.lane, dustNext: 0 }
    })
    this.dust = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#c2a67e', transparent: true, opacity: 0.7 }), 160)
    this.dust.frustumCulled = false
    this.group.add(this.dust)
  }

  // Punkt na torze przesunięty o `lane` metrów na zewnątrz (od środka stadionu).
  private at(s: number, lane: number) {
    s = ((s % this.len) + this.len) % this.len
    let i = 1
    while (i < this.cum.length - 1 && this.cum[i] < s) i++
    const t = (s - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1] || 1)
    const p = this.track
    const x = p[(i - 1) * 2] + (p[i * 2] - p[(i - 1) * 2]) * t
    const y = p[(i - 1) * 2 + 1] + (p[i * 2 + 1] - p[(i - 1) * 2 + 1]) * t
    const d = Math.hypot(x - this.cx, y - this.cy) || 1
    return [x + ((x - this.cx) / d) * lane, y + ((y - this.cy) / d) * lane]
  }

  update(dt: number) {
    if (this.len < 50) return
    for (const r of this.racers) {
      // lekkie wahania tempa, żeby kolejność na torze się zmieniała
      r.s += dt * (r.speed + Math.sin(r.s / 37 + r.lane) * 1.5)
      const [x, y] = this.at(r.s, r.lane)
      const [ax, ay] = this.at(r.s + 6, r.lane)
      const [bx, by] = this.at(r.s - 6, r.lane)
      const heading = Math.atan2(ay - y, ax - x)
      const turn = heading - Math.atan2(y - by, x - bx)
      const lean = THREE.MathUtils.clamp(Math.atan2(Math.sin(turn), Math.cos(turn)) * 4, -0.9, 0.9)
      r.bike.position.set(x, 0.2, -y)
      r.bike.rotation.set(0, heading, 0)
      r.bike.rotateX(-lean)
      r.dustNext -= dt
      if (r.dustNext <= 0) {
        r.dustNext = 0.06
        this.dustLife.push({ x: x - Math.cos(heading) * 3, z: -(y - Math.sin(heading) * 3), t: 0 })
        if (this.dustLife.length > 160) this.dustLife.shift()
      }
    }
    // pył: rośnie, unosi się i znika
    const q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3()
    this.dustLife.forEach((d, i) => {
      d.t += dt
      const k = Math.min(d.t / 2, 1)
      v.set(d.x, 0.5 + k * 3, d.z)
      sc.setScalar((1 - k) * (1 + k * 4))
      this.m.compose(v, q, sc)
      this.dust.setMatrixAt(i, this.m)
    })
    this.dust.count = this.dustLife.length
    this.dust.instanceMatrix.needsUpdate = true
  }

  // Czy promień trafił któregoś z zawodników.
  hit(ray: THREE.Raycaster) {
    return this.racers.some((r) => ray.intersectObject(r.bike).length > 0)
  }
}

function reversePts(p: Flat): Flat {
  const out: Flat = []
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1])
  return out
}

// Zawody żużlowe na Olimpijskim: sezon kwiecień–wrzesień, niedzielne popołudnia i piątkowe wieczory.
export function raceOn(now: Date) {
  const day = now.getDay(), h = now.getHours() + now.getMinutes() / 60, month = now.getMonth()
  return month >= 3 && month <= 8 && ((day === 0 && h >= 16 && h < 19) || (day === 5 && h >= 18 && h < 21))
}
