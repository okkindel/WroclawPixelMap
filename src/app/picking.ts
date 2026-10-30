// Kliknięcia i najechanie na mapie: krasnale, tramwaje z rozkładu, pomniki, neony, scenki i budynki (lista `providers`).
import * as THREE from 'three'
import { bbox } from '../engine/geo.ts'
import type { Dwarfs } from '../layers/dwarfs.ts'
import type { Monuments } from '../layers/monuments.ts'
import type { Neons } from '../layers/neons.ts'
import type { Timetable } from '../life/timetable.ts'
import type { Scenes } from '../scenes/index.ts'
import { showBuilding, showMonument, showNeon, showScene, showTram } from './popups.ts'
import type { Tiles } from '../world/tiles.ts'
import type { Building } from '../types/world.ts'
import { byId } from '../ui/dom.ts'

// przesunięcie wskaźnika między wciśnięciem a puszczeniem większe niż tyle pikseli = przeciąganie mapy
const CLICK_TOLERANCE_PX = 5
// podświetlenie krasnala pod kursorem najwyżej co tyle ms
const HOVER_INTERVAL_MS = 60
// wagonów w składzie tramwaju (jak w life/timetable.ts)
const TRAM_CARS = 3

export interface Pickables {
  dwarfs: Dwarfs
  timetable: Timetable | null
  monuments: Monuments | null
  neons: Neons
  tiles: Tiles
  // scenki powstają dopiero po wczytaniu miasta
  scenes: () => Scenes | null
  onDwarf: (i: number) => void
  // scena podświetlenia filtra pikselowego (PixelPass.highlight)
  highlight: THREE.Scene
  // akcja napisu (zabytek, obiekt z OSM) o tej nazwie w pobliżu: wspólne okienko dla napisu i bryły
  openerFor: (name: string, x: number, y: number) => (() => void) | undefined
}

export function initPicking(canvas: HTMLCanvasElement, camera: THREE.Camera, p: Pickables) {
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const aim = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
  }

  // Co jest pod kursorem: akcja po kliknięciu i bryły do podświetlenia (albo null, gdy nic klikalnego).
  // shape() zwraca kopie brył w położeniu obiektu; dla ruchomych (live) liczone co klatkę.
  interface Target {
    open: () => void
    shape: () => THREE.Object3D[]
    live?: boolean
  }
  const MASK = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const instanceCopy = (mesh: THREE.InstancedMesh, id: number) => {
    const m = new THREE.Matrix4()
    mesh.getMatrixAt(id, m)
    const copy = new THREE.Mesh(mesh.geometry, MASK)
    copy.matrixAutoUpdate = false
    copy.matrix.multiplyMatrices(mesh.matrixWorld, m)
    return copy
  }
  const objectCopy = (obj: THREE.Object3D) => {
    const out: THREE.Object3D[] = []
    obj.updateWorldMatrix(true, true)
    obj.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !o.visible) return
      const copy = new THREE.Mesh(o.geometry, MASK)
      copy.matrixAutoUpdate = false
      copy.matrix.copy(o.matrixWorld)
      out.push(copy)
    })
    return out
  }
  // trafiona bryła w danym korzeniu: instancja albo cały obiekt (Mesh/Group najbliżej korzenia)
  const hitShape = (root: THREE.Object3D): (() => THREE.Object3D[]) => {
    const hit = ray.intersectObject(root, true)[0]
    if (!hit) return () => []
    const id = hit.instanceId
    const mesh = hit.object
    if (id != null && mesh instanceof THREE.InstancedMesh) {
      return () => [instanceCopy(mesh, id)]
    }
    let top = hit.object
    while (top.parent && top.parent !== root) top = top.parent
    return () => objectCopy(top)
  }
  // Kształt liczony raz na budynek (najechanie odświeża się co HOVER_INTERVAL_MS); przy zmianie budynku
  // własne bufory poprzedniego zwalniamy (kopie instancji i obiektów dzielą geometrię z oryginałem, ich nie).
  let shapeOf: { b: Building; shape: THREE.Mesh[] } | null = null
  const cachedBuildingShape = (b: Building) => {
    if (shapeOf?.b !== b) {
      for (const m of shapeOf?.shape ?? []) m.geometry.dispose()
      shapeOf = { b, shape: buildingShape(b) }
    }
    return shapeOf.shape
  }
  // Bryły jednego budynku: o tej samej nazwie i stykające się ze sobą (część dotyka części), zaczynając od trafionej.
  // Sama nazwa nie wystarcza: dwie różne kamienice przy Rynku potrafią nazywać się tak samo.
  const TOUCH_M = 1
  const sameBuilding = (b: Building) => {
    const named = p.tiles.list.flatMap((t) =>
      t.data.buildings.filter((o) => o.n === b.n && Math.hypot(o.o[0] - b.o[0], o.o[1] - b.o[1]) < 250),
    )
    const boxes = new Map(named.map((o) => [o, bbox(o.o)]))
    const touch = (a: Building, c: Building) => {
      const [ax0, ay0, ax1, ay1] = boxes.get(a)!,
        [cx0, cy0, cx1, cy1] = boxes.get(c)!
      return ax0 <= cx1 + TOUCH_M && cx0 <= ax1 + TOUCH_M && ay0 <= cy1 + TOUCH_M && cy0 <= ay1 + TOUCH_M
    }
    const group = new Set<Building>([b])
    if (!boxes.has(b)) boxes.set(b, bbox(b.o))
    for (const a of group) for (const c of named) if (!group.has(c) && touch(a, c)) group.add(c)
    return group
  }
  // Dokładnie te trójkąty, z których budynek jest narysowany (te same dachy i hełmy). Każdy trójkąt siatki kafla zna swój budynek (owners).
  const buildingShape = (b: Building): THREE.Mesh[] => {
    const group = sameBuilding(b)
    const out: THREE.Mesh[] = []
    for (const tile of p.tiles.list) {
      const mesh = tile.far ? tile.simple : tile.buildings
      const owners: Int32Array | undefined = mesh.geometry.userData.owners
      const pos = mesh.geometry.getAttribute('position')
      if (!owners || !pos) continue
      const tris: number[] = []
      for (let f = 0; f < owners.length; f++) {
        if (!group.has(tile.data.buildings[owners[f]])) continue
        for (let k = 0; k < 9; k++) tris.push(pos.array[f * 9 + k])
      }
      if (!tris.length) continue
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3))
      out.push(new THREE.Mesh(g, MASK))
    }
    return out
  }

  // Dostawcy klikalnych obiektów w kolejności pierwszeństwa: pierwszy, który coś trafi, wygrywa.
  const providers: (() => Target | null)[] = [
    // krasnal (podskakuje pod kursorem)
    () => {
      if (!p.dwarfs.mesh.visible) return null
      const id = ray.intersectObject(p.dwarfs.mesh)[0]?.instanceId
      return id == null ? null : { open: () => p.onDwarf(id), shape: () => [instanceCopy(p.dwarfs.mesh, id)], live: true }
    },
    // tramwaj z rozkładu: obrys całego składu (wagony jednego kursu to kolejne instancje)
    () => {
      const tt = p.timetable
      if (!tt?.mesh.visible) return null
      const id = ray.intersectObject(tt.mesh)[0]?.instanceId
      const info = id == null ? null : tt.describe(id)
      if (id == null || !info) return null
      const first = id - (id % TRAM_CARS)
      const shape = () => Array.from({ length: Math.min(TRAM_CARS, tt.mesh.count - first) }, (_, k) => instanceCopy(tt.mesh, first + k))
      return { open: () => showTram(info), shape, live: true }
    },
    () => {
      const m = p.monuments
      const hit = m?.hit(ray)
      return m && hit ? { open: () => showMonument(hit), shape: hitShape(m.group) } : null
    },
    () => {
      const neon = p.neons.group.visible ? p.neons.hit(ray) : null
      return neon ? { open: () => showNeon(neon), shape: hitShape(p.neons.group), live: true } : null
    },
    // scenki: żużel, jarmark, sylwester, statki, latarnik
    () => {
      const hit = p.scenes()?.hit(ray)
      return hit ? { open: () => showScene(hit), shape: hitShape(hit.root), live: true } : null
    },
    // budynek z napisem otwiera to samo okienko co napis; bez napisu tylko wtedy, gdy znamy rok budowy
    () => {
      const b = p.tiles.pick(ray)
      const name = b?.n
      if (!b || !name) return null
      const opener = p.openerFor(name, b.o[0], b.o[1])
      const year = b.y
      if (!opener && !year) return null
      const shape = cachedBuildingShape(b)
      return { open: opener ?? (() => showBuilding(name, year!)), shape: () => shape }
    },
  ]
  const find = (): Target | null => {
    for (const provider of providers) {
      const target = provider()
      if (target) return target
    }
    return null
  }

  const showOutline = (target: Target | null) => {
    p.highlight.clear()
    if (target && byId<HTMLInputElement>('opt-hover').checked) p.highlight.add(...target.shape())
  }

  let hovered: Target | null = null
  // po kliknięciu chowamy obrys — okienko zasłania mapę, a kursor nie wraca nad obiekt
  const pick = () => {
    hovered = null
    showOutline(null)
    find()?.open()
  }

  let downAt = [0, 0]
  canvas.addEventListener('pointerdown', (ev) => (downAt = [ev.clientX, ev.clientY]))
  canvas.addEventListener('pointerup', (ev) => {
    if (Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > CLICK_TOLERANCE_PX) return
    aim(ev)
    pick()
  })

  // Najechanie: kursor-łapka i obrys nad wszystkim, co da się kliknąć (krasnale dodatkowo podskakują).
  let hoverAt = 0
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.buttons || performance.now() - hoverAt < HOVER_INTERVAL_MS) return
    hoverAt = performance.now()
    aim(ev)
    const target = find()
    hovered = target
    if (p.dwarfs.mesh.visible) {
      const hit = ray.intersectObject(p.dwarfs.mesh)[0]
      p.dwarfs.setHover(hit?.instanceId ?? -1)
    }
    canvas.style.cursor = target ? 'pointer' : ''
    showOutline(target)
  })
  canvas.addEventListener('pointerleave', () => {
    hovered = null
    showOutline(null)
  })
  // obrys ruchomych obiektów (tramwaj, łodzie, żużlowcy) jedzie razem z nimi
  const follow = () => {
    if (hovered?.live) showOutline(hovered)
    requestAnimationFrame(follow)
  }
  requestAnimationFrame(follow)
}
