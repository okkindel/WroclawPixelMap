// Neony i napisy miejskie: pikselowe litery z małego <canvas> powiększane bez wygładzania (NearestFilter).
// W nocy świecą z poświatą i migoczącymi literami, za dnia widać zgaszone rurki; złodziej z PZU skrada się po dachu.
import * as THREE from 'three'
import { hash, toLocal } from '../engine/geo.ts'
import { lang } from '../i18n/index.ts'
import { NEONS, type NeonSpec } from './neons.data.ts'

const FONT = { block: 'bold 10px "Courier New", monospace', script: 'italic bold 11px Georgia, serif' }
const LH = 12 // wysokość wiersza w pikselach tekstury
const PAD = 2
const DIM = 0.38 // jasność zgaszonych rurek
const DEG = Math.PI / 180

// Obrazki pikselowe: znak -> kolor.
const SPRITES: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  // pan uchylający kapelusza, z kwiatkiem w drugiej ręce
  gent: {
    rows: [
      '.......HHH..', '......HHHHH.', '..WWW....W..', '..WWW....W..', '...W....W...', '.WWWWWWWW...', 'W.WWWWW.....', 'R..WWWW.....',
      'RR.WWWW.....', 'G..WWWW.....', 'G..W..W.....', '...W..W.....', '...W..W.....', '..WW..WW....',
    ],
    pal: { W: '#e8f4ff', H: '#e8f4ff', R: '#ff3b5c', G: '#5dff8a' },
  },
  lion: {
    rows: [
      '..OOO..........', '.OOOOO.........', 'OOYYYOO........', 'OOY.YOOYYYYYY..', 'OOYYYOOYYYYYYYY', '.OOOOOYYYYYYY.Y',
      '..OOO.YYYYYYY..', '......Y.Y..Y.Y.', '......Y.Y..Y.Y.',
    ],
    pal: { Y: '#ffd23c', O: '#ff9a1f' },
  },
}
// złodziej w dwóch klatkach (kroki)
const THIEF = [
  ['..KKK...', '.RRRRR..', '..KKK...', '.KKKKK..', 'K.KKK.K.', '..KKK...', '..K.K...', '.K...K..', 'K.....K.'],
  ['..KKK...', '.RRRRR..', '..KKK...', '.KKKKK..', '.KKKKK..', '..KKK...', '..KK....', '..K.K...', '..K..K..'],
]
const THIEF_PAL = { K: '#ffe066', R: '#ff3b3b' }
const WALK = 26 // pas na lewo od napisu, po którym skrada się złodziej [px]

interface Layers { base: HTMLCanvasElement; flick: HTMLCanvasElement; accent: HTMLCanvasElement; glow: HTMLCanvasElement; w: number; h: number; textX: number }

const canvas = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h })

function drawSprite(ctx: CanvasRenderingContext2D, rows: string[], pal: Record<string, string>, x: number, y: number, cell = 1) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (!pal[ch]) return
    ctx.fillStyle = pal[ch]
    ctx.fillRect(x + i * cell, y + j * cell, cell, cell)
  }))
}

// Twarde krawędzie: kanał alfa 0 albo 255 (bez wygładzania czcionki).
function harden(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0
  ctx.putImageData(img, 0, 0)
}

// Poświata: litery poszerzone o 1 piksel w każdą stronę.
function glowOf(srcs: HTMLCanvasElement[], w: number, h: number) {
  const out = canvas(w, h)
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  const img = ctx.createImageData(w, h)
  for (const src of srcs) {
    const d = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (!d[i + 3]) continue
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue
        const o = (Y * w + X) * 4
        img.data[o] = d[i]; img.data[o + 1] = d[i + 1]; img.data[o + 2] = d[i + 2]; img.data[o + 3] = 255
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  return out
}

function paint(s: NeonSpec, seed: number): Layers {
  const font = FONT[s.font ?? 'block']
  const m = canvas(1, 1).getContext('2d', { willReadFrequently: true })!
  m.font = font
  const widths = s.lines.map((l) => Math.ceil(m.measureText(l).width))
  const textW = Math.max(...widths)
  const sp = s.sprite ? SPRITES[s.sprite] : null
  const spW = sp ? Math.max(...sp.rows.map((r) => r.length)) + 3 : s.thief ? WALK : 0
  const w = PAD * 2 + spW + textW
  const h = PAD * 2 + Math.max(s.lines.length * LH, sp ? sp.rows.length : 0)
  const textX = PAD + spW
  const [base, flick, accent] = [canvas(w, h), canvas(w, h), canvas(w, h)]
  const ctxs = [base, flick, accent].map((c) => {
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.font = font
    ctx.textBaseline = 'middle'
    return ctx
  })
  const letters: { ch: string; x: number; y: number; color: string; acc: boolean }[] = []
  const ty = (h - s.lines.length * LH) / 2
  let n = 0
  s.lines.forEach((line, li) => {
    const x0 = textX + (textW - widths[li]) / 2
    const a = s.accent ? line.indexOf(s.accent[0]) : -1
    ;[...line].forEach((ch, i) => {
      const acc = a >= 0 && i >= a && i < a + s.accent![0].length
      const color = acc ? s.accent![1] : s.colors ? s.colors[n % s.colors.length] : s.color
      if (ch !== ' ') n++
      letters.push({ ch, x: x0 + m.measureText(line.slice(0, i)).width, y: ty + li * LH + LH / 2, color, acc })
    })
  })
  // migoczące litery: kilka losowych (stałych dla danego neonu), poza wyróżnieniem
  const pool = letters.map((l, i) => (l.ch !== ' ' && !l.acc ? i : -1)).filter((i) => i >= 0)
  const flickSet = new Set<number>()
  for (let k = 0; k < (s.flicker ?? 0) && pool.length; k++) flickSet.add(pool[Math.floor(hash(seed, k + 7) * pool.length)])
  letters.forEach((l, i) => {
    // wyróżnienie osobno tylko przy animacji złodzieja (zapala się na końcu)
    const ctx = flickSet.has(i) ? ctxs[1] : l.acc && s.thief ? ctxs[2] : ctxs[0]
    ctx.fillStyle = l.color
    ctx.fillText(l.ch, l.x, l.y)
  })
  if (sp) drawSprite(ctxs[0], sp.rows, sp.pal, PAD, Math.round((h - sp.rows.length) / 2))
  for (const c of [base, flick, accent]) harden(c)
  const glow = glowOf([base, flick, accent], w, h)
  // tablica pod napisem (np. zielone pole lwa ZOO) — po utwardzeniu i poza poświatą
  if (s.bg) {
    const ctx = ctxs[0]
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = s.bg
    ctx.fillRect(1, 1, w - 2, h - 2)
    ctx.globalCompositeOperation = 'source-over'
  }
  return { base, flick, accent, glow, w, h, textX }
}

function texture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function thiefTextures() {
  return THIEF.map((rows) => {
    const c = canvas(8, rows.length)
    drawSprite(c.getContext('2d', { willReadFrequently: true })!, rows, THIEF_PAL, 0, 0)
    return texture(c)
  })
}

interface Sign {
  spec: NeonSpec
  root: THREE.Group
  body: THREE.Group
  mats: THREE.MeshBasicMaterial[] // litery i obrazki (jasność dzień/noc)
  flick: THREE.MeshBasicMaterial
  accent: THREE.Mesh
  glow: THREE.Mesh
  thief: THREE.Mesh | null
  thiefX: number[] // pozycje złodzieja w kolejnych krokach [m]
  hit: THREE.Mesh
  thr: number // próg zmroku, przy którym się zapala
  lit: number
  flickOn: boolean
  flickT: number
  maxScale: number
}

export class Neons {
  group = new THREE.Group()
  private signs: Sign[] = []
  private t = 0
  private thiefTex: THREE.CanvasTexture[] | null = null

  constructor() {
    NEONS.forEach((s, i) => this.signs.push(this.build(s, i)))
  }

  private build(s: NeonSpec, i: number): Sign {
    const L = paint(s, i)
    const k = s.letter / LH // metry na piksel tekstury
    const W = L.w * k, H = L.h * k
    const plane = (tex: THREE.Texture, z: number, extra: Partial<THREE.MeshBasicMaterialParameters> = {}) => {
      const g = new THREE.PlaneGeometry(W, H)
      g.translate(0, H / 2, z)
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, ...extra })
      return new THREE.Mesh(g, mat)
    }
    const root = new THREE.Group()
    const [x, y] = toLocal(s.lat, s.lon)
    root.position.set(x, 0, -y)
    // lico płaszczyzny (+Z) obrócone w kierunek az
    root.rotation.y = Math.PI - s.az * DEG
    const body = new THREE.Group()
    // neon dachowy stoi na stelażu ~0.8 m nad dachem
    body.position.y = s.h + (s.kind === 'roof' ? 0.8 : 0)
    root.add(body)

    const glow = plane(texture(L.glow), 0.03, { alphaTest: 0, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    glow.visible = false
    const base = plane(texture(L.base), 0.06)
    const flick = plane(texture(L.flick), 0.07)
    const accent = plane(texture(L.accent), 0.07)
    body.add(glow, base, flick, accent)
    const steel = new THREE.MeshLambertMaterial({ color: '#2a2d3a' })
    if (s.kind !== 'wall') {
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

    let thief: THREE.Mesh | null = null
    const thiefX: number[] = []
    if (s.thief) {
      this.thiefTex ??= thiefTextures()
      const th = (H - 2 * PAD * k) * 0.8, tw = (th * 8) / THIEF[0].length
      const g = new THREE.PlaneGeometry(tw, th)
      g.translate(0, th / 2 + PAD * k, 0.08)
      thief = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.thiefTex[0], transparent: true, alphaTest: 0.5 }))
      body.add(thief)
      // cztery kroki w stronę napisu
      const x0 = -W / 2 + PAD * k + tw / 2, x1 = -W / 2 + (L.textX - 1) * k - tw / 2
      for (let j = 0; j < 4; j++) thiefX.push(x0 + ((x1 - x0) * j) / 3)
      thief.position.x = thiefX[3]
    }

    base.userData.i = i
    this.group.add(root)
    const mats = [base.material, accent.material, ...(thief ? [thief.material] : [])] as THREE.MeshBasicMaterial[]
    return {
      spec: s, root, body, mats, flick: flick.material as THREE.MeshBasicMaterial, accent, glow, thief, thiefX, hit: base,
      thr: 0.25 + hash(i, 3) * 0.2, lit: 0, flickOn: true, flickT: hash(i, 5) * 3,
      maxScale: s.maxScale ?? (s.kind === 'roof' ? 3 : s.kind === 'gate' ? 2.5 : 1.6),
    }
  }

  // night: 0..1 (sun.night), year: rok epoki, zoom: camera.zoom
  update(dt: number, night: number, year: number, zoom: number) {
    this.t += dt
    for (const s of this.signs) {
      const sp = s.spec
      s.root.visible = year >= sp.from && (sp.to == null || year <= sp.to) && zoom > 0.3
      if (!s.root.visible) continue
      // przy oddaleniu powiększamy, żeby piksel tekstury nie był mniejszy od piksela ekranu (zakładamy piksel 2)
      s.body.scale.setScalar(THREE.MathUtils.clamp((2 * LH) / (sp.letter * zoom), 1, s.maxScale))

      // każdy neon zapala się przy nieco innym zmroku
      const target = night > s.thr ? 1 : 0
      s.lit += (target - s.lit) * Math.min(1, dt * 3)
      const b = DIM + (1 - DIM) * s.lit
      for (const m of s.mats) m.color.setScalar(b)
      ;(s.glow.material as THREE.MeshBasicMaterial).opacity = 0.5 * s.lit
      s.glow.visible = s.lit > 0.05

      // zużyta rura: litera gaśnie na ułamek sekundy, czasem dwa razy z rzędu
      s.flickT -= dt
      if (s.flickT <= 0) {
        s.flickOn = !s.flickOn
        s.flickT = s.flickOn ? 0.4 + Math.random() * 5 : 0.04 + Math.random() * 0.25
      }
      s.flick.color.setScalar(s.lit > 0.5 && !s.flickOn ? DIM : b)

      // złodziej: cztery kroki, zapala się czerwone „PZU”, ucieka, cały napis świeci
      if (s.thief) {
        const ph = s.lit > 0.5 ? (this.t % 6.5) / 0.8 : 3.5
        const step = Math.floor(ph)
        s.thief.visible = step < 5
        s.thief.position.x = s.thiefX[Math.min(step, 3)] - (step === 4 ? (ph - 4) * 4 : 0)
        ;(s.thief.material as THREE.MeshBasicMaterial).map = this.thiefTex![step % 2]
        s.accent.visible = s.lit <= 0.5 || step >= 3
      }
    }
  }

  // Kliknięty napis (najbliższy z widocznych) albo null.
  hit(ray: THREE.Raycaster): { title: string; text: string; source?: string } | null {
    const meshes = this.signs.filter((s) => s.root.visible).map((s) => s.hit)
    const h = ray.intersectObjects(meshes, false)[0]
    if (!h) return null
    const s = NEONS[h.object.userData.i as number]
    const l = lang()
    return { title: s.title[l], text: s.text[l], source: s.source }
  }
}
