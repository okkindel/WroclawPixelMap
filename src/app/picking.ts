// Kliknięcia w mapę: krasnale, tramwaje z rozkładu, pomniki, neony, scenki, żużel i budynki (w tej kolejności).
import * as THREE from 'three'
import { t } from '../i18n/index.ts'
import type { Dwarfs } from '../layers/dwarfs.ts'
import type { Monuments } from '../layers/monuments.ts'
import type { Neons } from '../layers/neons.ts'
import type { Timetable } from '../life/timetable.ts'
import type { Scenes } from '../scenes/index.ts'
import { openPopup } from '../ui/popup.ts'
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
  // akcja napisu (zabytek, obiekt z OSM) o tej nazwie w pobliżu — wspólne okienko dla napisu i bryły
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
  interface Target { open: () => void; shape: () => THREE.Object3D[]; live?: boolean }
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
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || !o.visible) return
      const copy = new THREE.Mesh(mesh.geometry, MASK)
      copy.matrixAutoUpdate = false
      copy.matrix.copy(mesh.matrixWorld)
      out.push(copy)
    })
    return out
  }
  // trafiona bryła w danym korzeniu: instancja albo cały obiekt (Mesh/Group najbliżej korzenia)
  const hitShape = (root: THREE.Object3D): (() => THREE.Object3D[]) => {
    const hit = ray.intersectObject(root, true)[0]
    if (!hit) return () => []
    const id = hit.instanceId
    if (id != null && (hit.object as THREE.InstancedMesh).isInstancedMesh) {
      const mesh = hit.object as THREE.InstancedMesh
      return () => [instanceCopy(mesh, id)]
    }
    let top = hit.object
    while (top.parent && top.parent !== root) top = top.parent
    return () => objectCopy(top)
  }
  // Budynek z częściami: dokładnie te trójkąty, z których jest narysowany (te same dachy i hełmy),
  // ze wszystkich brył o tej samej nazwie w pobliżu. Każdy trójkąt siatki kafla zna swój budynek (owners).
  const buildingShape = (b: Building): THREE.Object3D[] => {
    const [x, y] = [b.o[0], b.o[1]]
    const out: THREE.Object3D[] = []
    for (const tile of p.tiles.list) {
      const mesh = tile.far ? tile.simple : tile.buildings
      const owners: Int32Array | undefined = mesh.geometry.userData.owners
      const pos = mesh.geometry.getAttribute('position')
      if (!owners || !pos) continue
      const mine = (i: number) => {
        const o = tile.data.buildings[owners[i]]
        return !!o && o.n === b.n && Math.hypot(o.o[0] - x, o.o[1] - y) < 250
      }
      const tris: number[] = []
      for (let f = 0; f < owners.length; f++) {
        if (!mine(f)) continue
        for (let k = 0; k < 9; k++) tris.push(pos.array[f * 9 + k])
      }
      if (!tris.length) continue
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3))
      out.push(new THREE.Mesh(g, MASK))
    }
    return out
  }

  const find = (): Target | null => {
    if (p.dwarfs.mesh.visible) {
      const hit = ray.intersectObject(p.dwarfs.mesh)[0]
      const id = hit?.instanceId
      if (id != null) return { open: () => p.onDwarf(id), shape: () => [instanceCopy(p.dwarfs.mesh, id)], live: true }
    }
    const timetable = p.timetable
    if (timetable?.mesh.visible) {
      const tram = ray.intersectObject(timetable.mesh)[0]
      const info = tram?.instanceId != null ? timetable.describe(tram.instanceId) : null
      if (info && tram?.instanceId != null) {
        const open = () =>
          openPopup({
            title: t('tram.title', { line: info.line }),
            sub: t('tram.sub', { head: info.head }),
            text: t('tram.text', { dep: info.dep, arr: info.arr }),
          })
        // cały skład: wagony jednego kursu to kolejne instancje
        const first = tram.instanceId - (tram.instanceId % TRAM_CARS)
        const shape = () => Array.from({ length: Math.min(TRAM_CARS, timetable.mesh.count - first) }, (_, k) => instanceCopy(timetable.mesh, first + k))
        return { open, shape, live: true }
      }
    }
    const monument = p.monuments?.hit(ray)
    if (monument && p.monuments) return { open: () => openPopup(monument), shape: hitShape(p.monuments.group) }
    const neon = p.neons.group.visible ? p.neons.hit(ray) : null
    if (neon) {
      const link = neon.source ? { href: neon.source, label: t('source') } : undefined
      return { open: () => openPopup({ title: neon.title, sub: t('sub.trivia'), text: neon.text, link }), shape: hitShape(p.neons.group), live: true }
    }
    const scenes = p.scenes()
    const scene = scenes?.hit(ray)
    if (scene && scenes) return { open: () => openPopup({ title: scene.title, sub: t('sub.trivia'), text: scene.text }), shape: hitShape(scenes.group), live: true }
    const speedway = scenes?.speedway
    if (speedway?.group.visible && speedway.hit(ray)) {
      return { open: () => openPopup({ title: t('speedway.title'), sub: t('sub.trivia'), text: t('speedway.text') }), shape: hitShape(speedway.group), live: true }
    }
    const b = p.tiles.pick(ray)
    // budynek z napisem otwiera to samo okienko co napis; bez napisu — tylko gdy znamy rok budowy
    const opener = b?.n ? p.openerFor(b.n, b.o[0], b.o[1]) : undefined
    if (b?.n && (opener || b.y)) {
      const name = b.n, year = b.y
      const shape = buildingShape(b)
      const open = opener ?? (() => openPopup({ title: name, sub: t('building.built', { y: year! }) }))
      return { open, shape: () => shape }
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
  canvas.addEventListener('pointerleave', () => { hovered = null; showOutline(null) })
  // obrys ruchomych obiektów (tramwaj, łodzie, żużlowcy) jedzie razem z nimi
  const follow = () => {
    if (hovered?.live) showOutline(hovered)
    requestAnimationFrame(follow)
  }
  requestAnimationFrame(follow)
}
