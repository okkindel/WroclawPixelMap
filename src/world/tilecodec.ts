// Binarny format kafla public/data/tiles/I_J.bin (wspólny dla scripts/bake.ts i klienta, bez DOM).
//
// Wszystkie liczby to varinty LEB128 (7 bitów na bajt); liczby ze znakiem w kodowaniu zigzag.
//   magia 'WPT1' | x0, y0: róg kafla [dm, zigzag] | słownik napisów: n, potem (długość UTF-8, bajty) × n
//   sekcje po kolei: budynki, woda, zieleń, place, drogi, tory, tramwaje — każda: liczba obiektów, obiekty
//   drzewa: liczba punktów, punkty
// Punkty [dm] zapisane jako różnica względem poprzedniego punktu w sekcji (na początku sekcji: róg kafla),
// więc sąsiednie obiekty i wierzchołki zajmują zwykle 1–2 bajty na współrzędną, a zasięg jest nieograniczony
// (obiekt przypisany po pierwszym punkcie może wystawać daleko poza kafel, np. Odra).
// Linia/pierścień: liczba punktów, punkty. Dziury: liczba pierścieni, pierścienie.
// Budynek: maska pól opcjonalnych (B_*), rodzaj (napis), H [dm, zigzag — bywa ujemne], potem pola z maski w kolejności bitów;
//   m [dm], y, rh [cm] (wszystkie zigzag), oc jako 3 bajty RGB (gdy '#rrggbb'), pozostałe napisy jako indeks słownika.
// Woda: maska (h, n); zieleń: rodzaj·2 + (ma dziury); plac: ma dziury; droga: maska (car, b, n), rodzaj, w [cm, zigzag];
// tor/tramwaj: b.
import type { Building, BuildingKind, Flat, GreenKind, Poly, Road, TileData, Track } from '../types/world.ts'

const MAGIC = 0x31545057 // 'WPT1'

const B_M = 1, B_Y = 2, B_RS = 4, B_RH = 8, B_RC = 16, B_OC = 32, B_OCS = 64, B_C = 128, B_BM = 256, B_RM = 512, B_N = 1024, B_H = 2048
const HEX = /^#[0-9a-f]{6}$/

class Writer {
  buf = new Uint8Array(1 << 16)
  len = 0
  private room(n: number) {
    if (this.len + n <= this.buf.length) return
    const b = new Uint8Array(Math.max(this.buf.length * 2, this.len + n))
    b.set(this.buf.subarray(0, this.len))
    this.buf = b
  }
  u(v: number) {
    if (!Number.isInteger(v) || v < 0) throw new Error(`varint: ${v}`)
    this.room(8)
    while (v >= 128) { this.buf[this.len++] = (v % 128) | 128; v = Math.floor(v / 128) }
    this.buf[this.len++] = v
  }
  s(v: number) { this.u(v < 0 ? -2 * v - 1 : 2 * v) }
  bytes(b: Uint8Array) { this.room(b.length); this.buf.set(b, this.len); this.len += b.length }
}

class Reader {
  p = 0
  b: Uint8Array
  constructor(b: Uint8Array) { this.b = b }
  u() {
    const b = this.b
    let x = b[this.p++]
    if (x < 128) return x
    let v = x & 127, m = 128
    do { x = b[this.p++]; v += (x & 127) * m; m *= 128 } while (x >= 128)
    return v
  }
  s() { const v = this.u(); return v % 2 ? -(v + 1) / 2 : v / 2 }
}

const dm = (v: number) => Math.round(v * 10)
const cm = (v: number) => Math.round(v * 100)

export function encodeTile(t: TileData, x0: number, y0: number): Uint8Array {
  // słownik: najczęstsze napisy dostają najkrótsze indeksy
  const count = new Map<string, number>()
  const str = (v: string | undefined) => { if (v != null) count.set(v, (count.get(v) ?? 0) + 1) }
  for (const b of t.buildings) { str(b.k); str(b.rs); str(b.rc); if (b.oc && !HEX.test(b.oc)) str(b.oc); str(b.c); str(b.bm); str(b.rm); str(b.n) }
  for (const w of t.water) str(w.n)
  for (const g of t.green) str(g.k)
  for (const r of t.roads) { str(r.k); str(r.n) }
  const dict = [...count.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0])
  const idx = new Map(dict.map((v, i) => [v, i]))

  const w = new Writer()
  const enc = new TextEncoder()
  w.u(MAGIC)
  const ox = dm(x0), oy = dm(y0)
  w.s(ox); w.s(oy)
  w.u(dict.length)
  for (const v of dict) { const b = enc.encode(v); w.u(b.length); w.bytes(b) }

  let cx = 0, cy = 0
  const reset = () => { cx = ox; cy = oy }
  const pts = (f: Flat) => {
    w.u(f.length / 2)
    for (let i = 0; i < f.length; i += 2) {
      const x = dm(f[i]), y = dm(f[i + 1])
      w.s(x - cx); w.s(y - cy)
      cx = x; cy = y
    }
  }
  const holes = (h: Flat[]) => { w.u(h.length); for (const r of h) pts(r) }
  const S = (v: string) => w.u(idx.get(v)!)

  reset()
  w.u(t.buildings.length)
  for (const b of t.buildings) {
    const oc = b.oc != null && HEX.test(b.oc)
    const mask = (b.m != null ? B_M : 0) | (b.y != null ? B_Y : 0) | (b.rs != null ? B_RS : 0) | (b.rh != null ? B_RH : 0) |
      (b.rc != null ? B_RC : 0) | (b.oc != null ? (oc ? B_OC : B_OCS) : 0) | (b.c != null ? B_C : 0) | (b.bm != null ? B_BM : 0) |
      (b.rm != null ? B_RM : 0) | (b.n != null ? B_N : 0) | (b.h ? B_H : 0)
    w.u(mask); S(b.k); w.s(dm(b.H))
    if (b.m != null) w.s(dm(b.m))
    if (b.y != null) w.s(b.y)
    if (b.rs != null) S(b.rs)
    if (b.rh != null) w.s(cm(b.rh))
    if (b.rc != null) S(b.rc)
    if (oc) { const v = parseInt(b.oc!.slice(1), 16); w.bytes(new Uint8Array([v >> 16, (v >> 8) & 255, v & 255])) }
    else if (b.oc != null) S(b.oc)
    if (b.c != null) S(b.c)
    if (b.bm != null) S(b.bm)
    if (b.rm != null) S(b.rm)
    if (b.n != null) S(b.n)
    pts(b.o)
    if (b.h) holes(b.h)
  }
  reset()
  w.u(t.water.length)
  for (const p of t.water) {
    w.u((p.h ? 1 : 0) | (p.n != null ? 2 : 0))
    if (p.n != null) S(p.n)
    pts(p.o)
    if (p.h) holes(p.h)
  }
  reset()
  w.u(t.green.length)
  for (const p of t.green) { w.u(idx.get(p.k)! * 2 + (p.h ? 1 : 0)); pts(p.o); if (p.h) holes(p.h) }
  reset()
  w.u(t.plazas.length)
  for (const p of t.plazas) { w.u(p.h ? 1 : 0); pts(p.o); if (p.h) holes(p.h) }
  reset()
  w.u(t.roads.length)
  for (const r of t.roads) {
    w.u((r.car ? 1 : 0) | (r.b ? 2 : 0) | (r.n != null ? 4 : 0))
    S(r.k); w.s(cm(r.w))
    if (r.n != null) S(r.n)
    pts(r.p)
  }
  for (const list of [t.rails, t.trams]) {
    reset()
    w.u(list.length)
    for (const r of list) { w.u(r.b ? 1 : 0); pts(r.p) }
  }
  reset()
  pts(t.trees)
  return w.buf.slice(0, w.len)
}

export function decodeTile(buf: ArrayBuffer | Uint8Array): TileData {
  const r = new Reader(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
  if (r.u() !== MAGIC) throw new Error('kafel: zły format')
  const ox = r.s(), oy = r.s()
  const dec = new TextDecoder()
  const dict: string[] = []
  for (let n = r.u(); n > 0; n--) { const l = r.u(); dict.push(dec.decode(r.b.subarray(r.p, r.p + l))); r.p += l }

  let cx = 0, cy = 0
  const reset = () => { cx = ox; cy = oy }
  const pts = (): Flat => {
    const n = r.u()
    const f: Flat = new Array(n * 2)
    for (let i = 0; i < n * 2; i += 2) {
      cx += r.s(); cy += r.s()
      f[i] = cx / 10; f[i + 1] = cy / 10
    }
    return f
  }
  const holes = () => { const h: Flat[] = []; for (let n = r.u(); n > 0; n--) h.push(pts()); return h }
  const S = () => dict[r.u()]

  reset()
  const buildings: Building[] = new Array(r.u())
  for (let i = 0; i < buildings.length; i++) {
    const mask = r.u()
    const b = { k: S() as BuildingKind, H: r.s() / 10 } as Building
    if (mask & B_M) b.m = r.s() / 10
    if (mask & B_Y) b.y = r.s()
    if (mask & B_RS) b.rs = S()
    if (mask & B_RH) b.rh = r.s() / 100
    if (mask & B_RC) b.rc = S()
    if (mask & B_OC) { const p = r.p; r.p += 3; b.oc = '#' + ((r.b[p] << 16) | (r.b[p + 1] << 8) | r.b[p + 2]).toString(16).padStart(6, '0') }
    if (mask & B_OCS) b.oc = S()
    if (mask & B_C) b.c = S()
    if (mask & B_BM) b.bm = S()
    if (mask & B_RM) b.rm = S()
    if (mask & B_N) b.n = S()
    b.o = pts()
    if (mask & B_H) b.h = holes()
    buildings[i] = b
  }
  reset()
  const water: TileData['water'] = new Array(r.u())
  for (let i = 0; i < water.length; i++) {
    const f = r.u()
    const p: Poly & { n?: string } = { o: [] }
    if (f & 2) p.n = S()
    p.o = pts()
    if (f & 1) p.h = holes()
    water[i] = p
  }
  reset()
  const green: TileData['green'] = new Array(r.u())
  for (let i = 0; i < green.length; i++) {
    const f = r.u()
    const p: Poly & { k: GreenKind } = { k: dict[f >> 1] as GreenKind, o: pts() }
    if (f & 1) p.h = holes()
    green[i] = p
  }
  reset()
  const plazas: Poly[] = new Array(r.u())
  for (let i = 0; i < plazas.length; i++) {
    const f = r.u()
    const p: Poly = { o: pts() }
    if (f & 1) p.h = holes()
    plazas[i] = p
  }
  reset()
  const roads: Road[] = new Array(r.u())
  for (let i = 0; i < roads.length; i++) {
    const f = r.u()
    const road: Road = { k: S(), w: r.s() / 100, p: [] }
    if (f & 4) road.n = S()
    if (f & 1) road.car = 1
    if (f & 2) road.b = 1
    road.p = pts()
    roads[i] = road
  }
  const tracks = () => {
    reset()
    const list: Track[] = new Array(r.u())
    for (let i = 0; i < list.length; i++) {
      const f = r.u()
      const t: Track = { p: pts() }
      if (f & 1) t.b = 1
      list[i] = t
    }
    return list
  }
  const rails = tracks(), trams = tracks()
  reset()
  const trees = pts()
  return { buildings, water, green, plazas, roads, rails, trams, trees }
}
