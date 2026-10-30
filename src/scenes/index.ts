// Smaczki: scenki zależne od daty, pory dnia i epoki (żużel, mecz, jarmark, sylwester, Odra, latarnik).
// Każda scenka to jeden wpis w Scenes.list: kiedy ją widać, co robi w klatce, co pokazuje po kliknięciu.
// Dane z public/data/scenes.json (scripts/bake/bake-scenes.ts); bez nich zostają tylko scenki, które da się zbudować z World.
import * as THREE from 'three'
import { Football, matchOn } from './football.ts'
import { Speedway, raceOn } from './speedway.ts'
import { SINCE } from '../rules/milestones.ts'
import { bbox, toLocal } from '../engine/geo.ts'
import type { Flat, World } from '../types/world.ts'
import { Boats, type BoatKind } from './boats.ts'
import { Fireworks, newYearMinutes } from './fireworks.ts'
import { Lamplighter } from './lamplighter.ts'
import { Market, marketOpen } from './market.ts'
import type { ScenesData } from './types.ts'
import { t } from '../i18n/index.ts'
import { showScene } from '../app/popups.ts'
import type { Pick, Pickable } from '../types/pick.ts'

export type { ScenesData } from './types.ts'

// Rodzaje tekstu okienka scenki: klucze scene.<rodzaj>.title / .text w src/i18n/dict.ts
type TextKind = 'market' | 'fireworks' | 'barge' | 'cruise' | 'kayak' | 'lamplighter' | 'speedway'

export const SCENE_NAMES = ['market', 'fireworks', 'lamplighter', 'match', 'speedway'] as const
export type SceneName = (typeof SCENE_NAMES)[number]

// Stan świata w danej klatce, z którego scenki decydują, czy je widać.
interface Ctx {
  dt: number
  now: Date
  year: number
  night: number
  // włączona ręcznie z menu: widoczna niezależnie od daty, pory i epoki
  forced: (name: SceneName) => boolean
}

// Scenka: korzeń w scenie 3D, kiedy ją widać, co robi w klatce i co trafił promień (rodzaj tekstu okienka).
interface Scene {
  root: THREE.Object3D
  on: (c: Ctx) => boolean
  tick: (c: Ctx) => void
  off?: () => void
  hit?: (ray: THREE.Raycaster) => TextKind | null
}

export class Scenes implements Pickable {
  group = new THREE.Group()
  forced = new Set<SceneName>()
  // statki to warstwa życia miasta (przełącznik w „Na mapie”), nie scenka
  boatsOn = true
  private list: Scene[] = []
  private forcedT = 0

  constructor(world: World, data?: ScenesData, speedwayTrack?: Flat | null) {
    // żużel na Olimpijskim: w terminach zawodów
    if (speedwayTrack) {
      const s = new Speedway(speedwayTrack)
      this.add({
        root: s.group,
        on: (c) => c.year >= SINCE.speedway && (c.forced('speedway') || raceOn(c.now)),
        tick: (c) => s.update(c.dt),
        hit: (ray) => (s.hit(ray) ? 'speedway' : null),
      })
    }
    // mecz Śląska na Tarczyński Arena: w weekendowe popołudnia sezonu
    const arena = world.pitches?.find((p) => /Tarczyński/.test(p.stadium ?? ''))
    if (arena) {
      const m = new Football(arena.o)
      this.add({ root: m.group, on: (c) => c.year >= SINCE.arena && (c.forced('match') || matchOn(c.now)), tick: (c) => m.update(c.dt) })
    }
    // jarmark bożonarodzeniowy na Rynku
    if (data?.rynek.stalls.length) {
      const m = new Market(data.rynek.stalls, data.rynek.tree)
      this.add({
        root: m.group,
        on: (c) => c.forced('market') || marketOpen(c.now, c.year),
        tick: (c) => m.update(c.dt, c.night),
        hit: (ray) => (m.hit(ray) ? 'market' : null),
      })
    }
    // sylwester: fajerwerki startują z płyty Rynku (bez danych: kwadrat wokół środka Rynku);
    // wymuszony pokaz kręci się w pętli wokół „północy” (najgęstsze wybuchy)
    const [rx, ry] = toLocal(51.1099, 17.0326)
    const sq = data?.rynek.square
    const fw = new Fireworks(sq?.length ? bboxOf(sq, 30) : [rx - 60, ry - 50, rx + 60, ry + 50])
    const minutes = (c: Ctx) => (c.forced('fireworks') ? this.forcedT - 5 : c.year >= SINCE.fireworks ? newYearMinutes(c.now) : null)
    this.add({
      root: fw.mesh,
      on: (c) => minutes(c) !== null,
      tick: (c) => fw.update(c.dt, minutes(c)!),
      off: () => fw.clear(),
      hit: (ray) => {
        fw.mesh.boundingSphere = null
        return ray.intersectObject(fw.mesh).length ? 'fireworks' : null
      },
    })
    // statki na Odrze: barki zawsze, spacerowe i kajaki w sezonie, za dnia
    if (data?.rivers.length) {
      const b = new Boats(data.rivers)
      this.add({
        root: b.group,
        on: () => this.boatsOn,
        tick: (c) => {
          const month = c.now.getMonth()
          const season = month >= 4 && month <= 8 && c.night < 0.5
          const show: Record<BoatKind, boolean> = { barge: true, cruise: season && c.year >= 1900, kayak: season && c.year >= 1960 }
          b.update(c.dt, show)
        },
        hit: (ray) => b.hit(ray),
      })
    }
    // latarnik z Ostrowa Tumskiego: trasa z danych albo z ul. Katedralnej w World (latarnie co 12 m na przemian);
    // wymuszony z menu: zmierzch, żeby szedł zapalać latarnie
    let route: Flat | undefined = data?.tumski.route
    let lamps: Flat | undefined = data?.tumski.lamps
    if (!route?.length) {
      route = world.roads.filter((r) => r.n === 'Katedralna').sort((a, b) => b.p.length - a.p.length)[0]?.p
      lamps = route ? alternate(route, 12, 4.5) : undefined
    }
    if (route && lamps?.length) {
      const l = new Lamplighter(route, lamps)
      this.add({
        root: l.group,
        on: (c) => c.forced('lamplighter') || c.year >= SINCE.gasLamps,
        tick: (c) => l.update(c.dt, c.forced('lamplighter') ? Math.max(c.night, 0.6) : c.night),
        hit: (ray) => (l.hit(ray) ? 'lamplighter' : null),
      })
    }
  }

  private add(s: Scene) {
    this.list.push(s)
    this.group.add(s.root)
  }

  update(dt: number, now: Date, year: number, night: number) {
    this.forcedT = (this.forcedT + dt / 60) % 10
    const c: Ctx = { dt, now, year, night, forced: (n) => this.forced.has(n) }
    for (const s of this.list) {
      s.root.visible = s.on(c)
      if (s.root.visible) s.tick(c)
      else s.off?.()
    }
  }

  // Trafiona scenka: okienko z jej tekstem i obrys trafionej bryły (ruchome, więc co klatkę).
  pick(ray: THREE.Raycaster): Pick | null {
    for (const s of this.list) {
      const kind = s.root.visible ? s.hit?.(ray) : null
      if (kind) {
        const text = { title: t(`scene.${kind}.title`), text: t(`scene.${kind}.text`) }
        return { open: () => showScene(text), outline: { within: s.root }, live: true }
      }
    }
    return null
  }
}

function bboxOf(p: Flat, inset: number): [number, number, number, number] {
  const [x0, y0, x1, y1] = bbox(p)
  return [x0 + inset, y0 + inset, x1 - inset, y1 - inset]
}

// Punkty co `step` m wzdłuż linii, na przemian po lewej i prawej w odległości `side`.
function alternate(p: Flat, step: number, side: number): Flat {
  const out: Flat = []
  let k = 0
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2],
      ay = p[i - 1],
      dx = p[i] - ax,
      dy = p[i + 1] - ay,
      L = Math.hypot(dx, dy) || 1
    for (let t = step / 2; t < L; t += step, k++) {
      const o = k % 2 ? side : -side
      out.push(ax + (dx * t) / L + (dy / L) * o, ay + (dy * t) / L - (dx / L) * o)
    }
  }
  return out
}
