// Wątek roboczy: pobiera kafel i buduje jego siatki (teren + budynki w wyglądzie „dziś”: pełne i uproszczone), żeby nie blokować interfejsu.
import { buildBuildings } from './buildings.ts'
import { buildGround } from './ground.ts'
import { pack, transfers } from './packed.ts'
import type { TileData } from '../types/world.ts'
import { loadTile } from './tilecodec.ts'

// Błąd (brak pliku, zły format) wraca jako { key, error }, żeby wczytywanie mapy nie czekało w nieskończoność.
self.onmessage = async (e: MessageEvent<{ url: string; key: string; seed: number }>) => {
  const { url, key, seed } = e.data
  try {
    build(key, await loadTile(url), seed)
  } catch (err) {
    self.postMessage({ key, error: String(err) })
  }
}

function build(key: string, data: TileData, seed: number) {
  const g = buildGround(data)
  const out = {
    key,
    data,
    ground: pack(g.ground),
    water: pack(g.water),
    waterLate: pack(g.waterLate),
    roads: pack(g.roads),
    bridges: pack(g.bridges),
    buildings: pack(buildBuildings(data.buildings, {}, seed)),
    simple: pack(buildBuildings(data.buildings, { simple: true }, seed)),
  }
  // przekazanie buforów bez kopiowania (wariant z opcjami pasuje i do typów okna, i wątku)
  self.postMessage(out, { transfer: transfers(out.ground, out.water, out.waterLate, out.roads, out.bridges, out.buildings, out.simple) })
}
