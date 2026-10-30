// Dźwięki miasta syntezowane w WebAudio (bez plików): dzwony o pełnej godzinie, dzwonek tramwaju,
// mewy nad Odrą, wystrzały fajerwerków i ciche tło miasta. AudioContext powstaje dopiero po kliknięciu.

// Proporcje częściowych tonów dzwonu (hum, prime, tercja, kwinta, nominał…): nieharmoniczne, stąd „metaliczność”.
const BELL = [[0.5, 0.5, 9], [1, 1, 5], [1.19, 0.6, 4], [1.5, 0.35, 3.5], [2, 0.5, 3], [2.5, 0.2, 2], [2.66, 0.25, 2], [3.01, 0.15, 1.5], [4.17, 0.1, 1]] as const

export class CityAudio {
  ctx: AudioContext | null = null
  private master!: GainNode
  private hum!: GainNode
  private on = false
  private lastHour = -1
  private tramIn = 15
  private gullIn = 6

  setOn(on: boolean) {
    this.on = on
    if (on && !this.ctx) this.init()
    if (!this.ctx) return
    if (on) void this.ctx.resume()
    this.master.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.1)
  }

  private init() {
    const ctx = (this.ctx = new AudioContext())
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)
    // tło miasta: brązowy szum (szum zintegrowany) przez dolnoprzepustowy filtr
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5 }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 380
    this.hum = ctx.createGain()
    this.hum.gain.value = 0.05
    src.connect(lp).connect(this.hum).connect(this.master)
    src.start()
  }

  // co klatkę: czas symulacji, rok epoki, noc 0..1
  update(dt: number, now: Date, epochYear: number, night: number) {
    if (!this.on || !this.ctx) return
    const t = this.ctx.currentTime
    this.hum.gain.setTargetAtTime(0.05 - night * 0.032, t, 1)
    // dzwony: tylko przy przejściu przez pełną godzinę (nie przy skoku zegara)
    const h = now.getHours()
    if (this.lastHour >= 0 && h !== this.lastHour && now.getMinutes() < 2) this.chime(h % 12 || 12)
    this.lastHour = h
    // dzwonek tramwaju (tramwaje we Wrocławiu od 1877 r.)
    if ((this.tramIn -= dt) <= 0) {
      this.tramIn = 20 + Math.random() * 40
      if (epochYear >= 1877 && night < 0.95) this.tram()
    }
    // mewy (śmieszki) nad Odrą za dnia
    if ((this.gullIn -= dt) <= 0) {
      this.gullIn = 7 + Math.random() * 16
      if (night < 0.4) this.gull()
    }
  }

  // dzwon kościelny: uderzenia co 2,4 s
  chime(strikes: number) {
    for (let i = 0; i < strikes; i++) this.bell(196, this.ctx!.currentTime + 0.1 + i * 2.4, 0.12)
  }

  private bell(f: number, at: number, vol: number, decay = 1) {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.value = vol
    out.connect(this.master)
    for (const [ratio, amp, dec] of BELL) {
      const o = ctx.createOscillator()
      o.frequency.value = f * ratio
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(amp, at + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dec * decay)
      o.connect(g).connect(out)
      o.start(at)
      o.stop(at + dec * decay + 0.05)
    }
  }

  // „dzyń-dzyń”: dwa szybkie uderzenia małego dzwonka
  tram() {
    const t = this.ctx!.currentTime
    this.bell(1250, t, 0.05, 0.12)
    this.bell(1250, t + 0.18, 0.05, 0.12)
  }

  // krzyk mewy: kilka opadających, chrapliwych „kiaa”
  gull() {
    const ctx = this.ctx!
    const t0 = ctx.currentTime
    const n = 2 + Math.floor(Math.random() * 3)
    const base = 1300 + Math.random() * 400
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.random() * 1.6 - 0.8
    pan.connect(this.master)
    for (let i = 0; i < n; i++) {
      const at = t0 + i * (0.32 + Math.random() * 0.1)
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(base * 1.25, at)
      o.frequency.exponentialRampToValueAtTime(base * 0.75, at + 0.28)
      // drżenie głosu
      const lfo = ctx.createOscillator(), depth = ctx.createGain()
      lfo.frequency.value = 38
      depth.gain.value = 60
      lfo.connect(depth).connect(o.frequency)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = base * 1.6
      bp.Q.value = 3
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(0.035, at + 0.04)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
      o.connect(bp).connect(g).connect(pan)
      o.start(at); lfo.start(at)
      o.stop(at + 0.32); lfo.stop(at + 0.32)
    }
  }

  // wystrzał fajerwerku: krótki szum z opadającym filtrem i echem odbitym od kamienic
  bang() {
    if (!this.on || !this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime + Math.random() * 0.3
    const len = Math.floor(ctx.sampleRate * 0.8)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2500, t)
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.6)
    const g = ctx.createGain()
    g.gain.value = 0.12
    const echo = ctx.createDelay(1)
    echo.delayTime.value = 0.23
    const eg = ctx.createGain()
    eg.gain.value = 0.35
    src.connect(lp).connect(g).connect(this.master)
    g.connect(echo).connect(eg).connect(this.master)
    src.start(t)
  }
}
