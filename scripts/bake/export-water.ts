// Dzisiejsza woda z kafli (public/data/tiles) do data/plans/water-today.json: obrysy w metrach lokalnych
// i flaga late (kanały, porty, zbiorniki), dla scripts/bake/bake-plans.py.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { decodeTile } from '../../src/world/tilecodec.ts'

const water: { o: number[]; h?: number[][]; late?: 1 }[] = []
for (const f of readdirSync('public/data/tiles'))
  for (const w of decodeTile(readFileSync(`public/data/tiles/${f}`)).water) water.push({ o: w.o, h: w.h, late: w.late })
const meta = JSON.parse(readFileSync('public/data/meta.json', 'utf8'))
writeFileSync('data/plans/water-today.json', JSON.stringify({ bounds: meta.bounds, tile: meta.tile, water }))
console.log(`woda: ${water.length} obrysów`)
