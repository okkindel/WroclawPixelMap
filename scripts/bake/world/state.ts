// Wspólny stan wypiekania świata: wynik (World) i listy zbierane po drodze przez kolejne etapy.
import type { Building, Flat, Poi, World } from '../../../src/types/world.ts'
import { readRaw, readRawWorld, type OsmEl } from '../../lib/osm.ts'
import { MAXX, MAXY, MINX, MINY } from './geometry.ts'

export interface BakeState {
  out: World
  // boiska do piłki (obrysy), do dopasowania do stadionów w meta
  soccer: Flat[]
  pois: Poi[]
  // budynki z wysokością tylko szacowaną (do zastąpienia pomiarem LoD1)
  estimated: WeakSet<Building>
}

export function newState(origin: [number, number]): BakeState {
  return {
    out: {
      origin,
      bounds: [MINX, MINY, MAXX, MAXY],
      buildings: [],
      water: [],
      green: [],
      plazas: [],
      roads: [],
      rails: [],
      trams: [],
      trees: [],
      cityWalls: [],
      named: [],
      dwarfs: [],
      runway: null,
      stadiums: [],
    },
    soccer: [],
    pois: [],
    estimated: new WeakSet(),
  }
}

export interface Sources {
  world: OsmEl[]
  dwarfs: OsmEl[]
  places: OsmEl[]
  structures: OsmEl[]
  // szkoły i uczelnie jako obszary/punkty (zwykle nie są budynkiem, więc nie ma ich w danych świata)
  schools: OsmEl[]
  parts: OsmEl[]
  extras: OsmEl[]
  // punkty adresowe (import PRG): adresy są głównie tu, nie na obrysach
  addresses: OsmEl[]
}

export async function loadSources(): Promise<Sources> {
  return {
    world: await readRawWorld(),
    dwarfs: await readRaw('dwarfs', false),
    places: await readRaw('places'),
    structures: await readRaw('structures'),
    schools: await readRaw('schools'),
    parts: await readRaw('parts'),
    extras: await readRaw('extras'),
    addresses: await readRaw('addresses'),
  }
}
