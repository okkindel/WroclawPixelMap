// Smaczki: scenki zależne od daty, pory dnia i epoki (jarmark, sylwester, Odra, latarnik) oraz dźwięki miasta.
// Dane z public/data/scenes.json (scripts/bake-scenes.ts); bez nich zostają tylko scenki, które da się zbudować z World.
import * as THREE from 'three'
import { toLocal } from '../engine/geo.ts'
import type { Flat, World } from '../types/world.ts'
import { CityAudio } from './audio.ts'
import { Boats, type BoatKind } from './boats.ts'
import { Fireworks, newYearMinutes } from './fireworks.ts'
import { Lamplighter } from './lamplighter.ts'
import { Market, marketOpen } from './market.ts'
import type { ScenesData } from './types.ts'

export type { ScenesData } from './types.ts'

const TEXT = {
  market: {
    title: 'Jarmark Bożonarodzeniowy',
    text: 'Od końca listopada do 7 stycznia Rynek i plac Solny wypełniają drewniane budki z grzańcem, piernikami, pierogami i rękodziełem. Do tego wielka choinka, karuzela i tysiące światełek — to jeden z największych jarmarków świątecznych w Polsce.',
  },
  fireworks: {
    title: 'Sylwester na Rynku',
    text: 'O północy niebo nad Rynkiem rozbłyska fajerwerkami, a na płycie bawią się tysiące wrocławian i turystów.',
  },
  barge: {
    title: 'Barka na Odrze',
    text: 'Przez Wrocław biegnie Odrzańska Droga Wodna. W mieście Odra rozgałęzia się, tworząc Wrocławski Węzeł Wodny — sieć kanałów, śluz i jazów; barki towarowe płyną głównie Głównym Szlakiem Żeglugowym na północy, a przez centrum prowadzi Miejski Szlak Żeglugowy.',
  },
  cruise: {
    title: 'Statek spacerowy',
    text: 'Od wiosny do jesieni po Odrze kursują statki wycieczkowe i gondole. Z wody najlepiej widać, że Wrocław leży na kilkunastu wyspach połączonych ponad setką mostów i kładek.',
  },
  kayak: {
    title: 'Kajakiem po Odrze',
    text: 'W ciepłe miesiące można wypożyczyć kajak i opłynąć Ostrów Tumski, Wyspę Piasek i Słodową — miejskie odnogi Odry to jeden z najciekawszych szlaków kajakowych w Polsce.',
  },
  lamplighter: {
    title: 'Latarnik z Ostrowa Tumskiego',
    text: 'Na Ostrowie Tumskim wciąż świeci blisko sto latarni gazowych (dziś 98). Codziennie o zmierzchu latarnik w czarnej pelerynie i cylindrze zapala je ręcznie długą tyczką, a o świcie gasi. To jedyny taki latarnik w Polsce.',
  },
}

export type SceneName = 'market' | 'fireworks' | 'boats' | 'lamplighter'

export class Scenes {
  group = new THREE.Group()
  // scenki włączone ręcznie z menu: widoczne niezależnie od daty, pory i epoki
  forced = new Set<SceneName>()
  private forcedT = 0
  private market: Market | null = null
  private fireworks: Fireworks
  private boats: Boats | null = null
  private lamplighter: Lamplighter | null = null
  private audio = new CityAudio()

  constructor(world: World, data?: ScenesData) {
    if (data?.rynek.stalls.length) {
      this.market = new Market(data.rynek.stalls, data.rynek.tree)
      this.group.add(this.market.group)
    }
    // fajerwerki startują z płyty Rynku (bez danych: kwadrat wokół środka Rynku)
    const [rx, ry] = toLocal(51.1099, 17.0326)
    const sq = data?.rynek.square
    const area: [number, number, number, number] = sq?.length
      ? bboxOf(sq, 30)
      : [rx - 60, ry - 50, rx + 60, ry + 50]
    this.fireworks = new Fireworks(area)
    this.fireworks.onBang = () => this.audio.bang()
    this.group.add(this.fireworks.mesh)

    if (data?.rivers.length) {
      this.boats = new Boats(data.rivers)
      this.group.add(this.boats.group)
    }

    // trasa latarnika: z danych albo z ul. Katedralnej w World (latarnie co 12 m na przemian)
    let route: Flat | undefined = data?.tumski.route
    let lamps: Flat | undefined = data?.tumski.lamps
    if (!route?.length) {
      route = world.roads.filter((r) => r.n === 'Katedralna').sort((a, b) => b.p.length - a.p.length)[0]?.p
      lamps = route ? alternate(route, 12, 4.5) : undefined
    }
    if (route && lamps?.length) {
      this.lamplighter = new Lamplighter(route, lamps)
      this.group.add(this.lamplighter.group)
    }
  }

  update(dt: number, now: Date, epochYear: number, night: number) {
    const m = this.market
    if (m) {
      m.group.visible = this.forced.has('market') || marketOpen(now, epochYear)
      if (m.group.visible) m.update(dt, night)
    }

    // wymuszony pokaz kręci się w pętli wokół „północy” (najgęstsze wybuchy)
    this.forcedT = (this.forcedT + dt / 60) % 10
    const ny = this.forced.has('fireworks') ? this.forcedT - 5 : newYearMinutes(now)
    this.fireworks.mesh.visible = ny !== null
    if (ny !== null) this.fireworks.update(dt, ny)
    else this.fireworks.clear()

    if (this.boats) {
      const month = now.getMonth()
      const season = month >= 4 && month <= 8 && night < 0.5
      const all = this.forced.has('boats')
      const show: Record<BoatKind, boolean> = { barge: true, cruise: all || (season && epochYear >= 1900), kayak: all || (season && epochYear >= 1960) }
      this.boats.update(dt, show)
    }

    // latarnie gazowe od połowy XIX w. (gazownia miejska od 1847 r.)
    if (this.lamplighter) {
      const lamp = this.forced.has('lamplighter')
      this.lamplighter.group.visible = lamp || epochYear >= 1850
      // wymuszony latarnik: zmierzch, żeby szedł zapalać latarnie
      if (this.lamplighter.group.visible) this.lamplighter.update(dt, lamp ? Math.max(night, 0.6) : night)
    }

    this.audio.update(dt, now, epochYear, night)
  }

  // Wywoływać z obsługi kliknięcia (przeglądarka pozwala uruchomić dźwięk tylko po geście użytkownika).
  setSound(on: boolean) {
    this.audio.setOn(on)
  }

  hit(ray: THREE.Raycaster): { title: string; text: string } | null {
    if (this.lamplighter?.group.visible && this.lamplighter.hit(ray)) return TEXT.lamplighter
    if (this.market?.group.visible && this.market.hit(ray)) return TEXT.market
    const boat = this.boats?.hit(ray)
    if (boat) return TEXT[boat]
    if (this.fireworks.mesh.visible) {
      this.fireworks.mesh.boundingSphere = null
      if (ray.intersectObject(this.fireworks.mesh).length) return TEXT.fireworks
    }
    return null
  }
}

function bboxOf(p: Flat, inset: number): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < p.length; i += 2) {
    x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i])
    y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1])
  }
  return [x0 + inset, y0 + inset, x1 - inset, y1 - inset]
}

// Punkty co `step` m wzdłuż linii, na przemian po lewej i prawej w odległości `side`.
function alternate(p: Flat, step: number, side: number): Flat {
  const out: Flat = []
  let k = 0
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], dx = p[i] - ax, dy = p[i + 1] - ay, L = Math.hypot(dx, dy) || 1
    for (let t = step / 2; t < L; t += step, k++) {
      const o = k % 2 ? side : -side
      out.push(ax + (dx * t) / L + (dy / L) * o, ay + (dy * t) / L - (dx / L) * o)
    }
  }
  return out
}
