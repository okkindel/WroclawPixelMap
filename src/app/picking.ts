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
import { pointInRing } from '../engine/geo.ts'

// przesunięcie wskaźnika między wciśnięciem a puszczeniem większe niż tyle pikseli = przeciąganie mapy
const CLICK_TOLERANCE_PX = 5
// podświetlenie krasnala pod kursorem najwyżej co tyle ms
const HOVER_INTERVAL_MS = 60

export interface Pickables {
  dwarfs: Dwarfs
  timetable: Timetable | null
  monuments: Monuments | null
  neons: Neons
  tiles: Tiles
  // scenki powstają dopiero po wczytaniu miasta
  scenes: () => Scenes | null
  onDwarf: (i: number) => void
  scene: THREE.Scene
}

export function initPicking(canvas: HTMLCanvasElement, camera: THREE.Camera, p: Pickables) {
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const aim = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
  }

  // Co jest pod kursorem: akcja po kliknięciu i obiekt do obrysowania (albo null, gdy nic klikalnego).
  interface Target { open: () => void; outline: THREE.Box3 | Building[] }
  const boxOf = (root: THREE.Object3D): THREE.Box3 | null => {
    const hit = ray.intersectObject(root, true)[0]
    if (!hit) return null
    if (hit.instanceId != null && (hit.object as THREE.InstancedMesh).isInstancedMesh) {
      const mesh = hit.object as THREE.InstancedMesh
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      const m = new THREE.Matrix4()
      mesh.getMatrixAt(hit.instanceId, m)
      return mesh.geometry.boundingBox!.clone().applyMatrix4(m).applyMatrix4(mesh.matrixWorld)
    }
    return new THREE.Box3().setFromObject(hit.object)
  }

  const find = (): Target | null => {
    if (p.dwarfs.mesh.visible) {
      const hit = ray.intersectObject(p.dwarfs.mesh)[0]
      const id = hit?.instanceId
      if (id != null) return { open: () => p.onDwarf(id), outline: boxOf(p.dwarfs.mesh)! }
    }
    const timetable = p.timetable
    if (timetable?.mesh.visible) {
      const tram = ray.intersectObject(timetable.mesh)[0]
      const info = tram?.instanceId != null ? timetable.describe(tram.instanceId) : null
      if (info) {
        const open = () =>
          openPopup({
            title: t('tram.title', { line: info.line }),
            sub: t('tram.sub', { head: info.head }),
            text: t('tram.text', { dep: info.dep, arr: info.arr }),
          })
        return { open, outline: boxOf(timetable.mesh)! }
      }
    }
    const monument = p.monuments?.hit(ray)
    if (monument && p.monuments) return { open: () => openPopup(monument), outline: boxOf(p.monuments.group)! }
    const neon = p.neons.group.visible ? p.neons.hit(ray) : null
    if (neon) {
      const link = neon.source ? { href: neon.source, label: t('source') } : undefined
      return { open: () => openPopup({ title: neon.title, sub: t('sub.trivia'), text: neon.text, link }), outline: boxOf(p.neons.group)! }
    }
    const scenes = p.scenes()
    const scene = scenes?.hit(ray)
    if (scene && scenes) return { open: () => openPopup({ title: scene.title, sub: t('sub.trivia'), text: scene.text }), outline: boxOf(scenes.group)! }
    const speedway = scenes?.speedway
    if (speedway?.group.visible && speedway.hit(ray)) {
      return { open: () => openPopup({ title: t('speedway.title'), sub: t('sub.trivia'), text: t('speedway.text') }), outline: boxOf(speedway.group)! }
    }
    const b = p.tiles.pick(ray)
    if (b?.n) {
      const sub = [b.y && t('building.built', { y: b.y }), `${Math.round(b.H)} m`].filter(Boolean).join(' · ')
      const name = b.n
      return { open: () => openPopup({ title: name, sub }), outline: partsOf(b) }
    }
    return null
  }

  // Obrys: złote krawędzie prostopadłościanu albo zarysu budynku (podstawa, góra i pionowe narożniki).
  const outline = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    // z testem głębi: krawędzie zasłonięte przez bryły (tył budynku) nie są widoczne
    new THREE.LineBasicMaterial({ color: '#e3b341' }),
  )
  outline.renderOrder = 20
  outline.visible = false
  p.scene.add(outline)
  // zarys budynku odsunięty o d na zewnątrz (wzdłuż dwusiecznych narożników)
  const grow = (o: number[], d: number) => {
    const n = o.length / 2
    let area = 0
    for (let i = 0, j = n - 1; i < n; j = i++) area += (o[j * 2] + o[i * 2]) * (o[j * 2 + 1] - o[i * 2 + 1])
    const s = area > 0 ? 1 : -1
    const out: number[] = []
    for (let i = 0; i < n; i++) {
      const p = (i + n - 1) % n, q = (i + 1) % n
      const x = o[i * 2], y = o[i * 2 + 1]
      const l1 = Math.hypot(x - o[p * 2], y - o[p * 2 + 1]) || 1, l2 = Math.hypot(o[q * 2] - x, o[q * 2 + 1] - y) || 1
      const nx = (-(y - o[p * 2 + 1]) / l1 - (o[q * 2 + 1] - y) / l2) * s, ny = ((x - o[p * 2]) / l1 + (o[q * 2] - x) / l2) * s
      const L = Math.hypot(nx, ny) || 1
      out.push(x + (nx / L) * d, y + (ny / L) * d)
    }
    return out
  }
  // wszystkie bryły tego samego budynku: ta sama nazwa i blisko (części z OSM dziedziczą nazwę po budynku)
  const partsOf = (b: Building): Building[] => {
    const [x, y] = [b.o[0], b.o[1]]
    return p.tiles.list.flatMap((tile) => tile.data.buildings).filter((o) => o.n === b.n && Math.hypot(o.o[0] - x, o.o[1] - y) < 250)
  }
  const showOutline = (o: THREE.Box3 | Building[] | null) => {
    outline.visible = !!o && byId<HTMLInputElement>('opt-hover').checked
    if (!o || !outline.visible) return
    const pts: number[] = []
    if (o instanceof THREE.Box3) {
      // małe obiekty (pomniki, krasnale, pojazdy): ramka na ziemi wokół podstawy, jak zaznaczenie w grach
      const { min: a, max: b } = o.clone().expandByScalar(0.6)
      const y = Math.max(0.3, a.y + 0.3)
      const c = [[a.x, a.z], [b.x, a.z], [b.x, b.z], [a.x, b.z]]
      for (let i = 0; i < 4; i++) {
        const [x0, z0] = c[i], [x1, z1] = c[(i + 1) % 4]
        pts.push(x0, y, z0, x1, y, z1)
      }
    } else {
      for (const part of o) {
        const ring = grow(part.o, 0.15), n = ring.length / 2, y0 = part.m ?? 0, y1 = part.H + 0.15
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n
          const ax = ring[i * 2], az = -ring[i * 2 + 1], bx = ring[j * 2], bz = -ring[j * 2 + 1]
          // krawędź wspólna z inną bryłą tego budynku (środek tuż za nią leży w tamtej bryle) to ściana wewnętrzna — pomijamy
          const mx = (ax + bx) / 2 + (ring[i * 2] + ring[j * 2]) / 2 - (part.o[i * 2] + part.o[j * 2]) / 2
          const my = (ring[i * 2 + 1] + ring[j * 2 + 1]) - (part.o[i * 2 + 1] + part.o[j * 2 + 1]) / 2
          if (o.some((other) => other !== part && other.H >= part.H - 0.5 && pointInRing(mx, my, other.o))) continue
          pts.push(ax, y0, az, bx, y0, bz, ax, y1, az, bx, y1, bz, ax, y0, az, ax, y1, az)
        }
      }
    }
    outline.geometry.dispose()
    outline.geometry = new THREE.BufferGeometry()
    outline.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  }

  const pick = () => find()?.open()

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
    if (p.dwarfs.mesh.visible) {
      const hit = ray.intersectObject(p.dwarfs.mesh)[0]
      p.dwarfs.setHover(hit?.instanceId ?? -1)
    }
    canvas.style.cursor = target ? 'pointer' : ''
    showOutline(target?.outline ?? null)
  })
  canvas.addEventListener('pointerleave', () => showOutline(null))
}
