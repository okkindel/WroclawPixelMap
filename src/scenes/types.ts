// Format public/data/scenes.json (scripts/bake/bake-scenes.ts). Współrzędne w metrach lokalnych, płaskie [x, y, ...].
import type { Flat } from '../types/world.ts'

export interface ScenesData {
  rivers: Flat[] // linie środka Odry (i odnóg), najdłuższa pierwsza
  rynek: {
    square: Flat // obrys płyty Rynku
    stalls: [x: number, y: number, angle: number][] // budki jarmarku; angle: kierunek frontu (rad, 0 = wschód)
    tree: [number, number] // choinka
  }
  tumski: {
    route: Flat // trasa latarnika (ul. Katedralna, z zachodu na wschód)
    lamps: Flat // latarnie gazowe w kolejności zapalania
  }
}
