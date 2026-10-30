// Słońce nad Wrocławiem: pozycja z daty i godziny, kolor i natężenie zależne od wysokości.
import * as THREE from 'three'

const LAT = (51.11 * Math.PI) / 180
const LON = 17.03

export type TimePreset = 'now' | 'day' | 'dusk' | 'night'
export type Season = 'summer' | 'spring' | 'autumn' | 'winter'

export function clockFor(preset: TimePreset, now = new Date()): Date {
  const d = new Date(now)
  if (preset === 'day') d.setHours(12, 30, 0)
  if (preset === 'dusk') d.setHours(d.getMonth() >= 4 && d.getMonth() <= 7 ? 20 : 17, 0, 0)
  if (preset === 'night') d.setHours(23, 30, 0)
  return d
}

// Wysokość i azymut słońca (radiany), przybliżenie wystarczające do cieni.
export function sunPosition(date: Date) {
  const day = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5
  const decl = (-23.44 * Math.PI) / 180 * Math.cos(((2 * Math.PI) / 365) * (day + 10))
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60
  const solarH = utcH + LON / 15
  const ha = ((solarH - 12) * 15 * Math.PI) / 180
  const elev = Math.asin(Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(ha))
  const az = Math.atan2(-Math.sin(ha), Math.tan(decl) * Math.cos(LAT) - Math.sin(LAT) * Math.cos(ha))
  return { elev, az } // az: 0 = północ, zgodnie z ruchem wskazówek
}

export class Sun {
  light = new THREE.DirectionalLight('#fff4e0', 2.2)
  hemi = new THREE.HemisphereLight('#cfe3ff', '#8f877d', 1.1)
  night = 0

  constructor(scene: THREE.Scene) {
    this.light.castShadow = true
    this.light.shadow.mapSize.set(4096, 4096)
    this.light.shadow.bias = -0.0004
    this.light.shadow.normalBias = 0.4
    scene.add(this.light, this.light.target, this.hemi)
  }

  set(date: Date, target: THREE.Vector3, extent: number) {
    const { elev, az } = sunPosition(date)
    const e = Math.max(elev, -0.3)
    const dayK = THREE.MathUtils.smoothstep(e, -0.12, 0.25)
    this.night = 1 - THREE.MathUtils.smoothstep(e, -0.15, 0.05)
    // księżyc w nocy: słabe niebieskie światło z wysoka
    const h = dayK > 0.02 ? Math.max(e, 0.08) : 0.9
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(h), Math.sin(h), -Math.cos(az) * Math.cos(h))
    this.light.position.copy(target).addScaledVector(dir, 1500)
    this.light.target.position.copy(target)
    const golden = 1 - THREE.MathUtils.smoothstep(e, 0.05, 0.45)
    this.light.color.set('#fff4e0').lerp(new THREE.Color('#ff9a52'), golden * dayK).lerp(new THREE.Color('#8fa8ff'), 1 - dayK)
    this.light.intensity = 0.4 + dayK * 2.8
    this.hemi.intensity = 0.3 + dayK * 1.5
    this.hemi.color.set('#cfe3ff').lerp(new THREE.Color('#2a3a7a'), 1 - dayK)
    this.hemi.groundColor.set('#8f877d').lerp(new THREE.Color('#1c1c2e'), 1 - dayK)
    const cam = this.light.shadow.camera
    cam.left = cam.bottom = -extent
    cam.right = cam.top = extent
    cam.near = 1
    cam.far = 4000
    cam.updateProjectionMatrix()
  }
}
