// Wątek roboczy: pobiera kafel i buduje jego siatki (teren + budynki w wyglądzie „dziś”), żeby nie blokować interfejsu.
import { buildBuildings } from './buildings.ts'
import { buildGround } from './ground.ts'
import { pack, transfers } from './packed.ts'

self.onmessage = async (e: MessageEvent<{ url: string; key: string; seed: number }>) => {
  const { url, key, seed } = e.data
  const data = await (await fetch(url)).json()
  const g = buildGround(data)
  const out = {
    key, data,
    ground: pack(g.ground), water: pack(g.water), roads: pack(g.roads), bridges: pack(g.bridges),
    buildings: pack(buildBuildings(data.buildings, {}, seed)),
  }
  ;(self as unknown as Worker).postMessage(out, transfers(out.ground, out.water, out.roads, out.bridges, out.buildings))
}
