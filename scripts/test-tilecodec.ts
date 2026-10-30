// Test formatu kafli: zapis + odczyt musi dać ten sam TileData (współrzędne ±0.05 m).
// node scripts/test-tilecodec.ts [katalog z I_J.json]  — bez argumentu: kafle .json z ostatniego commita (git); TOL=0 = dokładnie
// Gdy obok są public/data/tiles/I_J.bin, porównuje też je (sprawdza zapis w bake).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { decodeTile, encodeTile } from '../src/world/tilecodec.ts'
import type { TileData, WorldMeta } from '../src/types/world.ts'

// Porównanie z tolerancją dla liczb; zwraca opis pierwszej różnicy albo null.
export function diff(a: unknown, b: unknown, path = '', tol = +(process.env.TOL ?? 0.05)): string | null {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tol ? null : `${path}: ${a} != ${b}`
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: długość ${a.length} != ${b.length}`
    for (let i = 0; i < a.length; i++) { const d = diff(a[i], b[i], `${path}[${i}]`, tol); if (d) return d }
    return null
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).filter((k) => (a as never)[k] !== undefined).sort()
    const kb = Object.keys(b).filter((k) => (b as never)[k] !== undefined).sort()
    if (ka.join() !== kb.join()) return `${path}: pola ${ka} != ${kb}`
    for (const k of ka) { const d = diff((a as never)[k], (b as never)[k], `${path}.${k}`, tol); if (d) return d }
    return null
  }
  return a === b ? null : `${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`
}

const dir = process.argv[2]
const meta: WorldMeta = JSON.parse(readFileSync('public/data/meta.json', 'utf8'))
const [bx0, by0] = meta.bounds
let json = 0, jsonGz = 0, bin = 0, binGz = 0, bad = 0, baked = 0
for (const { k } of meta.tiles) {
  const src = dir ? readFileSync(`${dir}/${k}.json`, 'utf8') : execFileSync('git', ['show', `HEAD:public/data/tiles/${k}.json`], { encoding: 'utf8' })
  const orig: TileData = JSON.parse(src)
  const [i, j] = k.split('_').map(Number)
  const b = encodeTile(orig, bx0 + i * meta.tile, by0 + j * meta.tile)
  json += src.length; jsonGz += gzipSync(src, { level: 9 }).length
  bin += b.length; binGz += gzipSync(b, { level: 9 }).length
  const d = diff(decodeTile(b), orig)
  if (d) { bad++; console.log(`${k}: ${d}`) }
  const f = `public/data/tiles/${k}.bin`
  if (existsSync(f)) {
    baked++
    const d2 = diff(decodeTile(readFileSync(f)), orig)
    if (d2) { bad++; console.log(`${k}.bin z bake: ${d2}`) }
  }
}
const mb = (v: number) => (v / 1e6).toFixed(2) + ' MB'
console.log(`kafli ${meta.tiles.length} (z bake: ${baked}), różnic: ${bad}`)
console.log(`JSON ${mb(json)} (gzip ${mb(jsonGz)}) → bin ${mb(bin)} (gzip ${mb(binGz)})`)
const stray = readdirSync('public/data/tiles').filter((f) => !f.endsWith('.bin'))
if (stray.length) console.log(`inne pliki w public/data/tiles: ${stray.length}`)
if (bad) process.exit(1)
