// Kliknięcia w mapę: krasnale, tramwaje z rozkładu, pomniki, neony, scenki, żużel i budynki (w tej kolejności).
import * as THREE from 'three'
import { t } from '../i18n/index.ts'
import type { Dwarfs } from '../layers/dwarfs.ts'
import type { Monuments } from '../layers/monuments.ts'
import type { Neons } from '../layers/neons.ts'
import type { Speedway } from '../layers/speedway.ts'
import type { Timetable } from '../life/timetable.ts'
import type { Scenes } from '../scenes/index.ts'
import { openPopup } from '../ui/popup.ts'
import type { Tiles } from '../world/tiles.ts'

// przesunięcie wskaźnika między wciśnięciem a puszczeniem większe niż tyle pikseli = przeciąganie mapy
const CLICK_TOLERANCE_PX = 5
// podświetlenie krasnala pod kursorem najwyżej co tyle ms
const HOVER_INTERVAL_MS = 60

export interface Pickables {
  dwarfs: Dwarfs
  timetable: Timetable | null
  monuments: Monuments | null
  neons: Neons
  speedway: Speedway | null
  tiles: Tiles
  // scenki powstają dopiero po wczytaniu miasta
  scenes: () => Scenes | null
  onDwarf: (i: number) => void
}

export function initPicking(canvas: HTMLCanvasElement, camera: THREE.Camera, p: Pickables) {
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const aim = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
  }

  const pick = () => {
    if (p.dwarfs.mesh.visible) {
      const hit = ray.intersectObject(p.dwarfs.mesh)[0]
      if (hit?.instanceId != null) return p.onDwarf(hit.instanceId)
    }
    const timetable = p.timetable
    if (timetable?.mesh.visible) {
      const tram = ray.intersectObject(timetable.mesh)[0]
      const info = tram?.instanceId != null ? timetable.describe(tram.instanceId) : null
      if (info) {
        return openPopup({
          title: t('tram.title', { line: info.line }),
          sub: t('tram.sub', { head: info.head }),
          text: t('tram.text', { dep: info.dep, arr: info.arr }),
        })
      }
    }
    const monument = p.monuments?.hit(ray)
    if (monument) return openPopup(monument)
    const neon = p.neons.group.visible ? p.neons.hit(ray) : null
    if (neon) {
      const link = neon.source ? { href: neon.source, label: t('source') } : undefined
      return openPopup({ title: neon.title, sub: t('sub.trivia'), text: neon.text, link })
    }
    const scene = p.scenes()?.hit(ray)
    if (scene) return openPopup({ title: scene.title, sub: t('sub.trivia'), text: scene.text })
    if (p.speedway?.hit(ray)) return openPopup({ title: t('speedway.title'), sub: t('sub.trivia'), text: t('speedway.text') })
    const b = p.tiles.pick(ray)
    if (b?.n) {
      const sub = [b.y && t('building.built', { y: b.y }), `${Math.round(b.H)} m`].filter(Boolean).join(' · ')
      openPopup({ title: b.n, sub })
    }
  }

  let downAt = [0, 0]
  canvas.addEventListener('pointerdown', (ev) => (downAt = [ev.clientX, ev.clientY]))
  canvas.addEventListener('pointerup', (ev) => {
    if (Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > CLICK_TOLERANCE_PX) return
    aim(ev)
    pick()
  })

  let hoverAt = 0
  canvas.addEventListener('pointermove', (ev) => {
    const dwarfs = p.dwarfs
    if (!dwarfs.mesh.visible || performance.now() - hoverAt < HOVER_INTERVAL_MS) return
    hoverAt = performance.now()
    aim(ev)
    const hit = ray.intersectObject(dwarfs.mesh)[0]
    dwarfs.setHover(hit?.instanceId ?? -1)
    canvas.style.cursor = hit ? 'pointer' : ''
  })
}
