// Format public/data/world.json (wspólny dla scripts/bake/bake.ts i aplikacji).
// Współrzędne w metrach, płaskie tablice [x, y, x, y, ...].

export type Flat = number[]

export interface Poly {
  o: Flat
  h?: Flat[]
}

export type BuildingKind = 'res' | 'gen' | 'com' | 'pub' | 'church' | 'ind' | 'low' | 'roof' | 'ruin' | 'chimney' | 'tank'

export interface Building extends Poly {
  H: number // wysokość całkowita
  m?: number // wysokość podstawy
  k: BuildingKind
  y?: number // rok budowy (start_date)
  rs?: string // roof:shape
  rh?: number // roof:height (wysokość samego dachu, np. hełmu wieży)
  rc?: string // roof:colour
  oc?: string // kolor dachu z ortofotomapy GUGiK
  c?: string // building:colour
  bm?: string // building:material
  rm?: string // roof:material
  n?: string
}

export type GreenKind = 'grass' | 'park' | 'wood' | 'pitch' | 'play' | 'farm' | 'bare'

export interface Road {
  p: Flat
  w: number
  k: string
  car?: 1
  b?: 1
  n?: string
}

export interface Track {
  p: Flat
  b?: 1
}

export interface Dwarf {
  id: number
  x: number
  y: number
  n: string
  a?: string
  d?: string
  img?: string
  i?: string
  in?: 1
}

export type Named = [name: string, x: number, y: number, kind: string]

export interface World {
  origin: [number, number]
  bounds: [number, number, number, number]
  buildings: Building[]
  water: (Poly & { n?: string })[]
  green: (Poly & { k: GreenKind })[]
  plazas: Poly[]
  roads: Road[]
  rails: Track[]
  trams: Track[]
  trees: Flat
  cityWalls: Flat[]
  named: Named[]
  dwarfs: Dwarf[]
  runway: Flat[] | null
  stadiums: (Poly & { n?: string })[]
  // boiska piłkarskie leżące na stadionach (do scenki meczu): obrys i nazwa stadionu
  pitches?: { o: Flat; stadium?: string }[]
}

// Zawartość jednego kafla public/data/tiles/I_J.bin (format binarny: src/world/tilecodec.ts)
export type TileData = Pick<World, 'buildings' | 'water' | 'green' | 'plazas' | 'roads' | 'rails' | 'trams' | 'trees'>

// public/data/meta.json: wszystko, co nie jest kaflowane
// Konstrukcje, które nie są budynkami: wieże, maszty, iglice, wieże ciśnień.
// k: 'light' = maszt oświetleniowy (jupiter), az = kierunek reflektorów [rad]
export interface Structure {
  x: number
  y: number
  H: number
  r: number
  k: 'needle' | 'tower' | 'mast' | 'water' | 'light'
  n?: string
  yr?: number
  az?: number
}
// Kolej linowa: trasa i słupy (x, y, wysokość)
export interface Aerialway {
  p: Flat
  pylons: [number, number, number][]
  n?: string
  yr?: number
}

// Rozpoznawalny obiekt z OSM do napisu: nazwa, położenie, kategoria, ranga (1 = z daleka, 2 = po przybliżeniu)
export type PoiKind = 'mall' | 'culture' | 'church' | 'edu' | 'health' | 'sport' | 'notable'
// wiki: adres hasła w Wikipedii albo Wikidacie (skąd wiadomo, że obiekt jest ciekawy)
export type Poi = [name: string, x: number, y: number, kind: PoiKind, rank: 1 | 2, wiki?: string]

// Osiedle/dzielnica: nazwa, położenie, ranga (0 = osiedle, 1 = część osiedla, 2 = okolica)
export type Place = [name: string, x: number, y: number, rank: 0 | 1 | 2]

export interface WorldMeta extends Pick<World, 'origin' | 'bounds' | 'cityWalls' | 'named' | 'dwarfs' | 'runway' | 'stadiums' | 'pitches'> {
  places: Place[]
  pois: Poi[]
  structures: Structure[]
  aerialways: Aerialway[]
  tile: number
  speedway: Flat | null // tor żużlowy Stadionu Olimpijskiego
  tiles: { k: string; n: number }[]
}

// public/data/trams.json — rozkład tramwajów z GTFS MPK
// kurs: [linia, trasa, kierunek, dni (bit 0 = pn … 6 = nd), odjazd (s od północy), czas przejazdu (s)]
export type TramTrip = [line: number, shape: number, head: number, days: number, dep: number, dur: number]
// trasy: [x, y, z, ...] przyciągnięte do torów z OSM
export interface TramSchedule {
  lines: string[]
  heads: string[]
  shapes: number[][]
  trips: TramTrip[]
}
