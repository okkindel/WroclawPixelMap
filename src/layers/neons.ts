// Neony i napisy miejskie: pikselowe litery z małego <canvas> powiększane bez wygładzania (NearestFilter).
// W nocy świecą z poświatą i migoczącymi literami, za dnia widać zgaszone rurki; złodzieje z PZU zapalają się po kolei.
import * as THREE from 'three'
import { hash, toLocal } from '../engine/geo.ts'
import { NEONS, type NeonSpec } from '../content/index.ts'
import { showNeon } from '../app/popups.ts'
import type { Pick, Pickable } from '../types/pick.ts'

const FONT = { block: 'bold 10px "Courier New", monospace', script: 'italic bold 11px Georgia, serif' }
const BIG = 'bold 13px "Courier New", monospace' // większe litery wyróżnienia (PZU)
const LH = 12 // wysokość wiersza w pikselach tekstury
const PAD = 2
const DIM = 0.38 // jasność zgaszonych rurek
const DEG = Math.PI / 180

// Obrazki pikselowe: znak -> kolor.
const SPRITES: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  // pan uchylający kapelusza, z kwiatkiem w drugiej ręce
  gent: {
    rows: [
      '.......HHH..',
      '......HHHHH.',
      '..WWW....W..',
      '..WWW....W..',
      '...W....W...',
      '.WWWWWWWW...',
      'W.WWWWW.....',
      'R..WWWW.....',
      'RR.WWWW.....',
      'G..WWWW.....',
      'G..W..W.....',
      '...W..W.....',
      '...W..W.....',
      '..WW..WW....',
    ],
    pal: { W: '#e8f4ff', H: '#e8f4ff', R: '#ff3b5c', G: '#5dff8a' },
  },
  lion: {
    rows: [
      '..OOO..........',
      '.OOOOO.........',
      'OOYYYOO........',
      'OOY.YOOYYYYYY..',
      'OOYYYOOYYYYYYYY',
      '.OOOOOYYYYYYY.Y',
      '..OOO.YYYYYYY..',
      '......Y.Y..Y.Y.',
      '......Y.Y..Y.Y.',
    ],
    pal: { Y: '#ffd23c', O: '#ff9a1f' },
  },
}
// Złodzieje PZU: cztery konturowe sylwetki — kuca, skrada się, wspina, ucieka.
const THIEVES = [
  [
    '.........',
    '.........',
    '.........',
    '.........',
    '.........',
    '....WWW..',
    '....W.W..',
    '....WWW..',
    '..WWWW...',
    '.W..W.W..',
    'W..W..W..',
    '...WW.W..',
    '..W..WW..',
    '.WW...WW.',
  ],
  [
    '.........',
    '.........',
    '.........',
    '.....WWW.',
    '.....W.W.',
    '.....WWW.',
    '...WWWW..',
    '..W.WW.W.',
    '.W..W...W',
    '...W.W...',
    '...W..W..',
    '..W....W.',
    '..W....W.',
    '.WW...WW.',
  ],
  [
    '.W.....W.',
    '.W.....W.',
    '..W.WWW..',
    '...WW.W..',
    '....WWW..',
    '....WW...',
    '....WW...',
    '....WW...',
    '....W.W..',
    '...W..W..',
    '...W...W.',
    '..W....W.',
    '..W.....W',
    '.WW.....W',
  ],
  [
    '.....WWW.',
    '.....W.W.',
    '.....WWW.',
    '....WW...',
    '..WW.WW..',
    '.W..WW.WW',
    '....WW...',
    '....W.W..',
    '...W...W.',
    '..W.....W',
    '.W.......',
    'W........',
    '.........',
    '.........',
  ],
]
const THIEF_W = 9

const canvas = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h })

function drawSprite(ctx: CanvasRenderingContext2D, rows: string[], pal: Record<string, string>, x: number, y: number) {
  for (const [j, row] of rows.entries())
    for (const [i, ch] of [...row].entries()) {
      if (!pal[ch]) continue
      ctx.fillStyle = pal[ch]
      ctx.fillRect(x + i, y + j, 1, 1)
    }
}

// Twarde krawędzie: kanał alfa 0 albo 255 (bez wygładzania czcionki).
function harden(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d')!
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0
  ctx.putImageData(img, 0, 0)
}

// Poświata: litery poszerzone o 1 piksel w każdą stronę.
function glowOf(srcs: HTMLCanvasElement[], w: number, h: number) {
  const out = canvas(w, h)
  const ctx = out.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (const src of srcs) {
    const d = src.getContext('2d')!.getImageData(0, 0, w, h).data
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (!d[i + 3]) continue
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const X = x + dx,
              Y = y + dy
            if (X < 0 || Y < 0 || X >= w || Y >= h) continue
            const o = (Y * w + X) * 4
            img.data[o] = d[i]
            img.data[o + 1] = d[i + 1]
            img.data[o + 2] = d[i + 2]
            img.data[o + 3] = 255
          }
      }
  }
  ctx.putImageData(img, 0, 0)
  return out
}

interface Layers {
  base: HTMLCanvasElement
  flick: HTMLCanvasElement
  accent: HTMLCanvasElement
  thieves: HTMLCanvasElement[]
  glow: HTMLCanvasElement
  day: HTMLCanvasElement | null // wygląd za dnia, gdy rurki mają własny kolor (s.day)
  w: number
  h: number
}

// Rysuje warstwy napisu (kolory nocne) i, jeśli podano s.day, osobny wygląd dzienny.
function paint(s: NeonSpec, seed: number): Layers {
  const font = FONT[s.font ?? 'block']
  const m = canvas(1, 1).getContext('2d')!
  const big = !!s.thief
  const fontOf = (acc: boolean) => (acc && big ? BIG : font)
  // szerokości liter z uwzględnieniem większego wyróżnienia
  const charsOf = (line: string) => {
    const a = s.accent ? line.indexOf(s.accent[0]) : -1
    let x = 0
    return [...line].map((ch, i) => {
      const acc = a >= 0 && i >= a && i < a + s.accent![0].length
      m.font = fontOf(acc)
      const c = { ch, x, acc }
      x += m.measureText(ch).width
      return c
    })
  }
  const rows = s.lines.map(charsOf)
  const widths = rows.map((r, i) => {
    const last = r[r.length - 1]
    m.font = fontOf(last.acc)
    return Math.ceil(last.x + m.measureText(s.lines[i].slice(-1)).width)
  })
  const textW = Math.max(...widths)
  const sp = s.sprite ? SPRITES[s.sprite] : null
  const spW = sp ? Math.max(...sp.rows.map((r) => r.length)) + 3 : 0
  const thW = s.thief ? 3 + THIEVES.length * (THIEF_W + 2) : 0
  const w = PAD * 2 + spW + textW + thW
  const h = PAD * 2 + Math.max(s.lines.length * LH + (big ? 2 : 0), sp ? sp.rows.length : 0, s.thief ? THIEVES[0].length : 0)
  const textX = PAD + spW
  const mk = () => {
    const c = canvas(w, h)
    const ctx = c.getContext('2d')!
    ctx.textBaseline = 'middle'
    return c
  }
  const [base, flick, accent] = [mk(), mk(), mk()]
  const day = s.day ? mk() : null
  const ty = (h - s.lines.length * LH) / 2

  // migoczące litery: kilka losowych (stałych dla danego neonu), poza wyróżnieniem
  const all = rows.flatMap((r, li) => r.map((c) => ({ ...c, li })))
  const pool = all.map((c, i) => (c.ch !== ' ' && !c.acc ? i : -1)).filter((i) => i >= 0)
  const flickSet = new Set<number>()
  for (let k = 0; k < (s.flicker ?? 0) && pool.length; k++) flickSet.add(pool[Math.floor(hash(seed, k + 7) * pool.length)])

  let n = 0
  all.forEach((c, i) => {
    const color = c.acc ? s.accent![1] : s.colors ? s.colors[n % s.colors.length] : s.color
    if (c.ch !== ' ') n++
    const x = textX + (textW - widths[c.li]) / 2 + c.x,
      y = ty + c.li * LH + LH / 2
    // wyróżnienie na osobnej warstwie tylko przy animacji (błyska na końcu pętli)
    const target = flickSet.has(i) ? flick : c.acc && s.thief ? accent : base
    for (const [cv, col] of [
      [target, color],
      [day, s.day],
    ] as const) {
      if (!cv || !col) continue
      const ctx = cv.getContext('2d')!
      ctx.font = fontOf(c.acc)
      ctx.fillStyle = col
      ctx.fillText(c.ch, x, y)
    }
  })
  if (sp) drawSprite(base.getContext('2d')!, sp.rows, sp.pal, PAD, Math.round((h - sp.rows.length) / 2))
  // złodzieje po prawej stronie napisu, każdy na własnej warstwie
  const thieves = s.thief
    ? THIEVES.map((rows, j) => {
        const c = mk()
        const x = textX + textW + 3 + j * (THIEF_W + 2),
          y = Math.round((h - rows.length) / 2)
        drawSprite(c.getContext('2d')!, rows, { W: '#f4f8ff' }, x, y)
        if (day) drawSprite(day.getContext('2d')!, rows, { W: '#dfe7f2' }, x, y)
        return c
      })
    : []
  for (const c of [base, flick, accent, ...thieves, ...(day ? [day] : [])]) harden(c)
  const glow = glowOf([base, flick, accent, ...thieves], w, h)
  // tablica pod napisem (np. zielone pole lwa ZOO) — po utwardzeniu i poza poświatą
  if (s.bg) {
    const ctx = base.getContext('2d')!
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = s.bg
    ctx.fillRect(1, 1, w - 2, h - 2)
    ctx.globalCompositeOperation = 'source-over'
  }
  return { base, flick, accent, thieves, glow, day, w, h }
}

function texture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

interface Sign {
  spec: NeonSpec
  root: THREE.Group
  night: THREE.Group // warstwy świecące
  dayMesh: THREE.Mesh | null
  base: THREE.MeshBasicMaterial
  flick: THREE.MeshBasicMaterial
  accent: THREE.MeshBasicMaterial
  thieves: THREE.MeshBasicMaterial[]
  glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  hit: THREE.Mesh
  thr: number // próg zmroku, przy którym się zapala
  lit: number
  flickOn: boolean
  flickT: number
}

export class Neons implements Pickable {
  group = new THREE.Group()
  private signs: Sign[] = []
  private t = 0

  constructor() {
    for (const [i, s] of NEONS.entries()) this.signs.push(this.build(s, i))
  }

  private build(s: NeonSpec, i: number): Sign {
    const L = paint(s, i)
    // metry na piksel tekstury; napis nie może być dłuższy niż krawędź, na której stoi
    const k = Math.min(s.letter / LH, s.span / L.w)
    const W = L.w * k,
      H = L.h * k
    const plane = (tex: THREE.Texture, z: number, extra: Partial<THREE.MeshBasicMaterialParameters> = {}) => {
      const g = new THREE.PlaneGeometry(W, H)
      g.translate(0, H / 2, z)
      return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, ...extra }))
    }
    const root = new THREE.Group()
    const [x, y] = toLocal(s.lat, s.lon)
    root.position.set(x, 0, -y)
    // lico płaszczyzny (+Z) obrócone w kierunek az
    root.rotation.y = Math.PI - s.az * DEG
    const body = new THREE.Group()
    // neon na tablicy stoi na stelażu ~0.8 m nad dachem, wolnostojące litery wyrastają wprost z dachu
    body.position.y = s.h + (s.kind === 'roof' && !s.free ? 0.8 : 0)
    root.add(body)

    const night = new THREE.Group()
    const glow = plane(texture(L.glow), 0.03, { alphaTest: 0, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    glow.visible = false
    const base = plane(texture(L.base), 0.06)
    const flick = plane(texture(L.flick), 0.07)
    const accent = plane(texture(L.accent), 0.07)
    const thieves = L.thieves.map((c) => plane(texture(c), 0.07))
    night.add(base, flick, accent, ...thieves)
    body.add(glow, night)
    const dayMesh = L.day ? plane(texture(L.day), 0.06) : null
    if (dayMesh) body.add(dayMesh)

    const steel = new THREE.MeshLambertMaterial({ color: '#2a2d3a' })
    if (s.free) {
      // wolnostojące litery: tylko cienkie pręty mocujące schowane w dachu
      const rods = Math.max(2, Math.round(W / 4))
      for (let j = 0; j < rods; j++) {
        const rod = new THREE.Mesh(new THREE.BoxGeometry(0.1, H * 0.6 + 1.5, 0.1), steel)
        rod.position.set(-W / 2 + (W * (j + 0.5)) / rods, (H * 0.6 - 1.5) / 2, -0.15)
        body.add(rod)
      }
    } else if (s.kind !== 'wall') {
      // tablica/stelaż od tyłu, żeby z drugiej strony nie było widać lustrzanego napisu
      const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, H + 0.3, 0.2), steel)
      back.position.set(0, H / 2, -0.12)
      back.castShadow = true
      body.add(back)
      const legH = s.kind === 'roof' ? 2.3 : s.h
      const legs = Math.max(2, Math.round(W / 6))
      for (let j = 0; j < legs; j++) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(s.kind === 'gate' ? 0.5 : 0.25, legH, 0.25), steel)
        leg.position.set(-W / 2 + (W * (j + 0.5)) / legs, -legH / 2, -0.12)
        body.add(leg)
      }
    }
    if (s.free) {
      // z tyłu wolnostojących liter widać ich ciemny rewers zamiast lustrzanego napisu
      const back = plane(texture(L.day ?? L.base), -0.02, { color: '#2a2d3a', side: THREE.BackSide })
      body.add(back)
    }

    this.group.add(root)
    const mat = (o: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>) => o.material
    return {
      spec: s,
      root,
      night,
      dayMesh,
      base: mat(base),
      flick: mat(flick),
      accent: mat(accent),
      thieves: thieves.map(mat),
      glow,
      hit: base,
      thr: 0.25 + hash(i, 3) * 0.2,
      lit: 0,
      flickOn: true,
      flickT: hash(i, 5) * 3,
    }
  }

  // night: 0..1 (sun.night), year: rok epoki, zoom: camera.zoom (tylko do ukrywania z daleka)
  update(dt: number, night: number, year: number, zoom: number) {
    this.t += dt
    for (const s of this.signs) {
      const sp = s.spec
      s.root.visible = year >= sp.from && (sp.to == null || year <= sp.to) && zoom > 0.3
      if (!s.root.visible) continue

      // każdy neon zapala się przy nieco innym zmroku
      const target = night > s.thr ? 1 : 0
      s.lit += (target - s.lit) * Math.min(1, dt * 3)
      const on = s.lit > 0.5
      // własny kolor dzienny: za dnia osobna warstwa, nocą świecące rurki
      if (s.dayMesh) {
        s.dayMesh.visible = !on
        s.night.visible = on
      }
      const b = s.dayMesh ? 1 : DIM + (1 - DIM) * s.lit
      s.base.color.setScalar(b)
      s.accent.color.setScalar(b)
      s.glow.material.opacity = 0.5 * s.lit
      s.glow.visible = s.lit > 0.05

      // zużyta rura: litera gaśnie na ułamek sekundy, czasem dwa razy z rzędu
      s.flickT -= dt
      if (s.flickT <= 0) {
        s.flickOn = !s.flickOn
        s.flickT = s.flickOn ? 0.4 + Math.random() * 5 : 0.04 + Math.random() * 0.25
      }
      s.flick.color.setScalar(on && !s.flickOn ? DIM : b)

      // złodzieje zapalają się kolejno (1→4), potem dwa razy błyska „PZU”, pętla
      if (s.thieves.length) {
        const ph = (this.t % 6) / 0.7
        for (const [j, m] of s.thieves.entries()) m.color.setScalar(!on || ph >= j ? b : 0.15)
        const blink = on && ph >= 4 && ph < 7 && Math.floor((ph - 4) * 2) % 2 === 1
        s.accent.color.setScalar(blink ? 0.25 : b)
      }
    }
  }

  // Kliknięty napis (najbliższy z widocznych) albo null.
  pick(ray: THREE.Raycaster): Pick | null {
    const spec = this.group.visible ? this.hit(ray) : null
    return spec ? { open: () => showNeon(spec), outline: { within: this.group }, live: true } : null
  }

  private hit(ray: THREE.Raycaster): NeonSpec | null {
    const meshes = this.signs.filter((s) => s.root.visible).map((s) => s.hit)
    const h = ray.intersectObjects(meshes, false)[0]
    return h ? (this.signs.find((sign) => sign.hit === h.object)?.spec ?? null) : null
  }
}
