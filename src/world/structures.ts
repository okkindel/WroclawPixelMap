// Konstrukcje spoza budynków (iglice, maszty, wieże ciśnień) i koleje linowe z jeżdżącymi wagonikami.
import * as THREE from 'three'
import { SINCE } from '../rules/milestones.ts'
import type { Aerialway, Flat, Structure } from '../types/world.ts'

const lambert = (color: string) => new THREE.MeshLambertMaterial({ color })

function structureMesh(s: Structure) {
  let m: THREE.Object3D
  if (s.k === 'light') {
    // jupiter: kratowy maszt i bateria reflektorów zwrócona do boiska
    const g = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.6, s.H, 4), lambert('#a4a9bd'))
    pole.position.y = s.H / 2
    const head = new THREE.Group()
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 10), lambert('#565a75'))
    const lamps = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 9), new THREE.MeshBasicMaterial({ color: '#fff4c2' }))
    lamps.position.x = 0.7
    lamps.userData.lamp = true
    head.add(frame, lamps)
    head.position.y = s.H
    // pochylenie w dół, w stronę środka stadionu
    head.rotation.set(0, -(s.az ?? 0), -0.35)
    g.add(pole, head)
    m = g
  } else if (s.k === 'needle') {
    // iglica: smukły stożek (np. Iglica przy Hali Stulecia)
    m = new THREE.Mesh(new THREE.ConeGeometry(Math.max(s.r, 1.2), s.H, 6), lambert('#cfd2dc'))
    m.position.y = s.H / 2
  } else if (s.k === 'mast') {
    m = new THREE.Mesh(new THREE.BoxGeometry(1.2, s.H, 1.2), lambert('#c8312f'))
    m.position.y = s.H / 2
  } else if (s.k === 'water') {
    // wieża ciśnień: trzon i szerszy zbiornik u góry
    const g = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(s.r * 0.6, s.r * 0.7, s.H * 0.75, 8), lambert('#b5523a'))
    shaft.position.y = s.H * 0.375
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r * 0.8, s.H * 0.25, 8), lambert('#8a3b2a'))
    tank.position.y = s.H * 0.875
    g.add(shaft, tank)
    m = g
  } else {
    m = new THREE.Mesh(new THREE.CylinderGeometry(s.r * 0.8, s.r, s.H, 8), lambert('#a4a9bd'))
    m.position.y = s.H / 2
  }
  m.traverse((o) => {
    o.castShadow = o.receiveShadow = true
  })
  const holder = new THREE.Group()
  holder.add(m)
  holder.position.set(s.x, 0, -s.y)
  holder.userData = { yr: s.yr }
  return holder
}

// Kolej linowa: profil wysokości liny wzdłuż trasy (stacje nisko, przy słupach wysoko).
class Ropeway {
  group = new THREE.Group()
  yr?: number
  private pts: THREE.Vector3[] = []
  private cum: number[] = [0]
  private cars: THREE.Group[] = []
  private t = 0

  constructor(a: Aerialway) {
    this.yr = a.yr
    const p: Flat = a.p
    const heightAt = (x: number, y: number) => {
      // wysokość liny: najbliższy słup w promieniu 40 m, inaczej stacja (8 m)
      let h = 8
      for (const [px, py, ph] of a.pylons) if (Math.hypot(px - x, py - y) < 40) h = Math.max(h, ph)
      return h
    }
    for (let i = 0; i < p.length; i += 2) this.pts.push(new THREE.Vector3(p[i], heightAt(p[i], p[i + 1]), -p[i + 1]))
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]))

    const steel = lambert('#565a75')
    for (const [x, y, h] of a.pylons) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), steel)
      pylon.position.set(x, h / 2, -y)
      pylon.castShadow = true
      this.group.add(pylon)
    }
    // stacje na końcach
    for (const v of [this.pts[0], this.pts[this.pts.length - 1]]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 10), lambert('#cfd2dc'))
      st.position.set(v.x, 4.5, v.z)
      st.castShadow = true
      this.group.add(st)
    }
    // lina
    for (let i = 1; i < this.pts.length; i++) {
      const a0 = this.pts[i - 1],
        b0 = this.pts[i]
      const L = a0.distanceTo(b0)
      const rope = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, L), lambert('#1d2340'))
      rope.position.copy(a0).add(b0).multiplyScalar(0.5)
      rope.lookAt(b0)
      this.group.add(rope)
    }
    // dwa wagoniki wahadłowe jadące naprzeciw siebie (Polinka ma czerwone)
    for (let k = 0; k < 2; k++) {
      const car = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 2.4), lambert('#c8312f'))
      body.position.y = -3.5
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 0.3), steel)
      arm.position.y = -1.1
      car.add(body, arm)
      car.traverse((o) => {
        o.castShadow = true
      })
      this.cars.push(car)
      this.group.add(car)
    }
  }

  private at(s: number) {
    let i = 1
    while (i < this.cum.length - 1 && this.cum[i] < s) i++
    const f = (s - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1] || 1)
    return this.pts[i - 1].clone().lerp(this.pts[i], f)
  }

  update(dt: number) {
    const len = this.cum[this.cum.length - 1]
    if (len < 10) return
    this.t += dt
    // kurs w jedną stronę ok. 3 min w realu; tu przyspieszone, z postojem na stacjach
    const cycle = 60
    const ph = (this.t % cycle) / cycle
    const k = THREE.MathUtils.smoothstep(ph < 0.5 ? ph * 2 : 2 - ph * 2, 0.1, 0.9)
    this.cars[0].position.copy(this.at(k * len))
    this.cars[1].position.copy(this.at((1 - k) * len))
  }
}

export class Structures {
  group = new THREE.Group()
  private items: THREE.Object3D[] = []
  private ropeways: Ropeway[] = []

  constructor(structures: Structure[], aerialways: Aerialway[]) {
    for (const s of structures) {
      const m = structureMesh(s)
      this.items.push(m)
      this.group.add(m)
    }
    for (const a of aerialways) {
      const r = new Ropeway(a)
      r.group.userData = { yr: a.yr }
      this.ropeways.push(r)
      this.items.push(r.group)
      this.group.add(r.group)
    }
  }

  // Konstrukcje z datą w OSM pokazujemy dopiero od roku budowy.
  setYear(year: number) {
    for (const o of this.items) o.visible = (o.userData.yr ?? SINCE.undatedStructures) <= year
  }

  update(dt: number) {
    for (const r of this.ropeways) if (r.group.visible) r.update(dt)
  }
}
