// Kliknięcia i najechanie na mapie. Każda klikalna warstwa (src/types/pick.ts) sama mówi, co trafił promień,
// co otworzyć i co obrysować; tu tylko kolejność warstw, kursor i złoty obrys filtra pikselowego.
import * as THREE from 'three'
import type { Outline, Pick, Pickable } from '../types/pick.ts'
import { byId } from '../ui/dom.ts'

// przesunięcie wskaźnika między wciśnięciem a puszczeniem większe niż tyle pikseli = przeciąganie mapy
const CLICK_TOLERANCE_PX = 5
// najechanie sprawdzamy najwyżej co tyle ms
const HOVER_INTERVAL_MS = 60

export interface Pickables {
  // klikalne warstwy w kolejności pierwszeństwa (null: warstwa jeszcze się nie wczytała)
  layers: () => (Pickable | null)[]
  // scena podświetlenia filtra pikselowego (PixelPass.highlight)
  highlight: THREE.Scene
}

export function initPicking(canvas: HTMLCanvasElement, camera: THREE.Camera, p: Pickables) {
  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const aim = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
  }

  // Obrys: kopie brył w położeniu obiektu, rysowane białym kolorem do maski podświetlenia.
  // Kopie dzielą geometrię z oryginałem (instancje, obiekty), więc niczego tu nie zwalniamy.
  const MASK = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const copy = (g: THREE.BufferGeometry, matrix: THREE.Matrix4) => {
    const m = new THREE.Mesh(g, MASK)
    m.matrixAutoUpdate = false
    m.matrix.copy(matrix)
    return m
  }
  const instanceCopy = (mesh: THREE.InstancedMesh, id: number) => {
    const m = new THREE.Matrix4()
    mesh.getMatrixAt(id, m)
    return copy(mesh.geometry, m.premultiply(mesh.matrixWorld))
  }
  const objectCopy = (obj: THREE.Object3D) => {
    const out: THREE.Object3D[] = []
    obj.updateWorldMatrix(true, true)
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh && o.visible) out.push(copy(o.geometry, o.matrixWorld))
    })
    return out
  }
  // Co obrysować; dla ruchomych liczone ponownie co klatkę. Trafiona bryła w korzeniu: instancja albo cały obiekt
  // najbliżej korzenia (ustalona raz, przy trafieniu).
  const shapeOf = (o: Outline): (() => THREE.Object3D[]) => {
    if ('instances' in o) return () => o.ids.map((id) => instanceCopy(o.instances, id))
    if ('meshes' in o) {
      for (const m of o.meshes) m.material = MASK
      return () => o.meshes
    }
    const hit = ray.intersectObject(o.within, true)[0]
    if (!hit) return () => []
    const mesh = hit.object
    if (hit.instanceId != null && mesh instanceof THREE.InstancedMesh) {
      const id = hit.instanceId
      return () => [instanceCopy(mesh, id)]
    }
    let top = hit.object
    while (top.parent && top.parent !== o.within) top = top.parent
    return () => objectCopy(top)
  }

  interface Target extends Pick {
    shape: () => THREE.Object3D[]
  }
  const find = (): Target | null => {
    for (const layer of p.layers()) {
      const hit = layer?.pick(ray)
      if (hit) return { ...hit, shape: shapeOf(hit.outline) }
    }
    return null
  }

  const showOutline = (target: Target | null) => {
    p.highlight.clear()
    if (target && byId<HTMLInputElement>('opt-hover').checked) p.highlight.add(...target.shape())
  }

  let hovered: Target | null = null
  // po kliknięciu chowamy obrys: okienko zasłania mapę, a kursor nie wraca nad obiekt
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

  // Najechanie: kursor-łapka i obrys nad wszystkim, co da się kliknąć (plus reakcje warstw, np. podskok krasnala).
  let hoverAt = 0
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.buttons || performance.now() - hoverAt < HOVER_INTERVAL_MS) return
    hoverAt = performance.now()
    aim(ev)
    for (const layer of p.layers()) layer?.hover?.(ray)
    hovered = find()
    canvas.style.cursor = hovered ? 'pointer' : ''
    showOutline(hovered)
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
