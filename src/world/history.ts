// Podkład z historycznego planu miasta (np. 1732) kładziony na terenie w dawnych epokach.
// Jasny papier planu jest przezroczysty, więc poza rysunkiem widać zwykły teren.
import * as THREE from 'three'
import type { WorldMeta } from '../types/world.ts'

export class HistoryLayer {
  group = new THREE.Group()
  private meta: WorldMeta
  private index: Promise<Record<string, string[]>>
  private loaded = new Map<string, THREE.Group>()
  private current: string | null = null

  constructor(meta: WorldMeta) {
    this.meta = meta
    this.index = fetch(`${import.meta.env.BASE_URL}data/history/index.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
  }

  // Plan dla danego roku epoki: tylko epoki, które ten plan przybliża (lokacja … Napoleon).
  static planFor(year: number) {
    return year >= 1242 && year <= 1807 ? '1732' : null
  }

  async show(plan: string | null) {
    this.current = plan
    for (const [k, g] of this.loaded) g.visible = k === plan
    const index = await this.index
    if (!plan || this.loaded.has(plan) || !index[plan]) return
    const g = new THREE.Group()
    this.loaded.set(plan, g)
    this.group.add(g)
    const loader = new THREE.TextureLoader()
    const { bounds, tile } = this.meta
    for (const k of index[plan]) {
      const [i, j] = k.split('_').map(Number)
      const tex = await loader.loadAsync(`${import.meta.env.BASE_URL}data/history/${plan}/${k}.jpg`)
      tex.colorSpace = THREE.SRGBColorSpace
      const mat = new THREE.MeshLambertMaterial({ map: tex })
      mat.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(
          '#include <map_fragment>',
          '#include <map_fragment>\nif (dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) > 0.86) discard;',
        )
      }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tile, tile), mat)
      m.rotation.x = -Math.PI / 2
      // nad drogami (0.12–0.18 m), pod mostami
      m.position.set(bounds[0] + (i + 0.5) * tile, 0.25, -(bounds[1] + (j + 0.5) * tile))
      m.receiveShadow = true
      g.add(m)
    }
    g.visible = this.current === plan
  }
}
