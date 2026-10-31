// Podkład z historycznego planu miasta (1732, 1895) kładziony na terenie w dawnych epokach, nad dzisiejszymi drogami
// i torami (w obszarze planu widać ówczesny układ ulic). Jasny papier jest przezroczysty: poza rysunkiem widać zwykły teren.
import * as THREE from 'three'
import { loadJson } from '../engine/data.ts'
import { type HISTORY_PLANS, historyPlanFor } from '../rules/milestones.ts'
import type { WorldMeta } from '../types/world.ts'

const PLAN_Y = 0.36

export class HistoryLayer {
  group = new THREE.Group()
  private meta: WorldMeta
  private index: Promise<Record<string, string[]>>
  private loaded = new Map<string, THREE.Group>()
  private current: string | null = null

  constructor(meta: WorldMeta) {
    this.meta = meta
    this.index = loadJson<Record<string, string[]>>('history/index.json').then((index) => index ?? {})
  }

  // Plan dla danego roku epoki (src/rules/milestones.ts).
  static planFor = historyPlanFor

  async show(spec: (typeof HISTORY_PLANS)[number] | null) {
    const plan = spec?.id ?? null
    this.current = plan
    for (const [k, g] of this.loaded) g.visible = k === plan
    const index = await this.index
    if (!spec || !plan || this.loaded.has(plan) || !index[plan]) return
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
          `#include <map_fragment>\nif (dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)) > ${spec.paper.toFixed(3)}) discard;`,
        )
      }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tile, tile), mat)
      m.rotation.x = -Math.PI / 2
      // nad drogami i torami (do 0.32 m, src/world/ground.ts), pod mostami
      m.position.set(bounds[0] + (i + 0.5) * tile, PLAN_Y, -(bounds[1] + (j + 0.5) * tile))
      m.receiveShadow = true
      g.add(m)
    }
    g.visible = this.current === plan
  }
}
