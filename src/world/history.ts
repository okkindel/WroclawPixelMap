// Historyczne plany miasta w dawnych epokach (public/data/history, scripts/bake/bake-plans.py):
//  - podkład planu nad dzisiejszymi drogami i torami; przezroczysty poza planem, na wodzie i w ditherowanym brzegu,
//  - woda epoki odtworzona z planów (najbliższe w czasie, dzisiejsza tylko poza nimi) jako woda 3D w miejsce dzisiejszej,
//  - maska zabudowy: gdzie plan ma kwartały, gdzie wodę, a gdzie nic (src/app/apply.ts zostawia budynki bez daty tylko
//    na zabudowie planu; plan z buildings: false wyklucza tylko budynki w wodzie planu).
import * as THREE from 'three'
import { loadJson } from '../engine/data.ts'
import { C } from '../engine/palette.ts'
import type { HistoryPlan } from '../rules/milestones.ts'
import type { Poly, WorldMeta } from '../types/world.ts'
import { Geo, flatPoly } from './geometry.ts'

// nad drogami i torami (do 0.32 m, src/world/ground.ts), pod mostami
const PLAN_Y = 0.36
const WATER_COLOR = typeof C.water === 'string' ? C.water : '#2c5d8a'

interface PlanIndex {
  tiles: string[]
  mask: number // metry na piksel maski zabudowy
}

// Wartości maski zabudowy (bake-plans.py): zabudowa, woda planu, poza planem; reszta zasięgu planu = 0.
export const MASK = { built: 255, water: 128, outside: 1 } as const

interface Loaded {
  group: THREE.Group
  mask: { data: Uint8ClampedArray; w: number; h: number; m: number }
}

export class HistoryLayer {
  group = new THREE.Group()
  // wywoływane, gdy bieżący plan jest gotowy (woda i maska): epoka przebudowuje wtedy teren i budynki
  onReady: () => void = () => {}
  private meta: WorldMeta
  private water: THREE.Material
  private index: Promise<Record<string, PlanIndex>> | null = null
  private loaded = new Map<string, Loaded>()
  private loading = new Set<string>()
  private current: string | null = null

  constructor(meta: WorldMeta, water: THREE.Material) {
    this.meta = meta
    this.water = water
  }

  // Bieżący plan jest gotowy: ma wodę i maskę zabudowy. Dopóki nie jest, epoka pokazuje dzisiejszy teren i wodę.
  get ready() {
    return !!this.current && this.loaded.has(this.current)
  }

  // Wartość maski zabudowy bieżącego planu w punkcie (metry lokalne); undefined, gdy plan nie jest gotowy.
  maskAt(x: number, y: number): number | undefined {
    const mask = this.current ? this.loaded.get(this.current)?.mask : undefined
    if (!mask) return undefined
    const [bx0, by0] = this.meta.bounds
    const col = Math.floor((x - bx0) / mask.m),
      row = mask.h - 1 - Math.floor((y - by0) / mask.m)
    if (col < 0 || row < 0 || col >= mask.w || row >= mask.h) return MASK.outside
    return mask.data[(row * mask.w + col) * 4]
  }

  async show(spec: HistoryPlan | null) {
    const plan = spec?.id ?? null
    this.current = plan
    for (const [k, l] of this.loaded) l.group.visible = k === plan
    if (!plan || this.loaded.has(plan) || this.loading.has(plan)) return
    this.loading.add(plan)
    try {
      // spis planów; po błędzie (null) następna próba pobiera go od nowa
      this.index ??= loadJson<Record<string, PlanIndex>>('history/index.json').then((index) => {
        if (!index) this.index = null
        return index ?? {}
      })
      const entry = (await this.index)[plan]
      if (!entry) return
      const base = `${import.meta.env.BASE_URL}data/history/${plan}`
      const polys = await loadJson<Poly[]>(`history/${plan}/water.json`)
      if (!polys) return
      const loaded: Loaded = { group: new THREE.Group(), mask: await loadMask(`${base}/built.png`, entry.mask) }
      loaded.group.add(this.waterMesh(polys))
      loaded.group.visible = this.current === plan
      this.loaded.set(plan, loaded)
      this.group.add(loaded.group)
      if (this.current === plan) this.onReady()
      // kafle podkładu po kolei; brakujący kafel zostawia dziurę (teren pod nim i tak jest łąką z wodą planu)
      await this.addTiles(loaded.group, base, entry.tiles)
    } catch (err) {
      // brak pliku albo błąd sieci: plan nie jest gotowy, następne pokazanie spróbuje ponownie
      console.warn(`plan ${plan}:`, err)
    } finally {
      this.loading.delete(plan)
    }
  }

  private async addTiles(group: THREE.Group, base: string, tiles: string[]) {
    const loader = new THREE.TextureLoader()
    const { bounds, tile } = this.meta
    for (const k of tiles) {
      const [i, j] = k.split('_').map(Number)
      const tex = await loader.loadAsync(`${base}/${k}.png`).catch((err) => {
        console.warn(`kafel planu ${k}:`, err)
        return null
      })
      if (!tex) continue
      tex.colorSpace = THREE.SRGBColorSpace
      // krycie kafla jest zero-jedynkowe (bake-plans.py): bez mieszania, piksel jest albo planem, albo dziurą
      tex.magFilter = tex.minFilter = THREE.NearestFilter
      tex.generateMipmaps = false
      const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 })
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tile, tile), mat)
      m.rotation.x = -Math.PI / 2
      m.position.set(bounds[0] + (i + 0.5) * tile, PLAN_Y, -(bounds[1] + (j + 0.5) * tile))
      m.receiveShadow = true
      group.add(m)
    }
  }

  // Woda epoki na wysokości dzisiejszej wody (0.1 m), tym samym materiałem (odblaski).
  private waterMesh(polys: Poly[] | null) {
    const geo = new Geo()
    for (const p of polys ?? []) flatPoly(geo, p.o, p.h, 0.1, WATER_COLOR)
    const m = new THREE.Mesh(geo.build(), this.water)
    m.receiveShadow = true
    return m
  }
}

async function loadMask(url: string, m: number) {
  const img = new Image()
  img.src = url
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  return { data: ctx.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height, m }
}
