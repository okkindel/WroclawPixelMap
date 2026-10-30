// Kolory dachów z ortofotomapy (data/ortho/I_J.jpg, npm run fetch-ortho): piksele wewnątrz obrysu
// → reguła roofColour (scripts/lib/rules.ts). Dach z tagiem roof:colour zostaje.
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import jpeg from 'jpeg-js'
import { TILE } from '../../lib/config.ts'
import { isTreePixel, luma, orthoStep, roofColour } from '../../lib/rules.ts'
import { MINX, MINY, type Pt, pointInRing } from './geometry.ts'
import type { TileMap } from './tiles.ts'

export async function roofColours(tiles: TileMap) {
  let sampled = 0
  for (const [k, t] of tiles) {
    const file = `data/ortho/${k}.jpg`
    if (!existsSync(file)) continue
    const img = jpeg.decode(await readFile(file), { useTArray: true })
    const [i, j] = k.split('_').map(Number)
    // górna krawędź liczona wprost (nie róg + TILE), żeby zaokrąglenia były jak przy zapisie
    const tx0 = MINX + i * TILE,
      ty1 = MINY + (j + 1) * TILE
    const sx = img.width / TILE,
      sy = img.height / TILE
    for (const b of t.buildings) {
      if (b.rc) continue
      // obrys w pikselach zdjęcia (wiersz 0 = północ)
      const ring: Pt[] = []
      let a = Infinity,
        c = -Infinity,
        d = Infinity,
        e = -Infinity
      for (let q = 0; q < b.o.length; q += 2) {
        const px = (b.o[q] - tx0) * sx,
          py = (ty1 - b.o[q + 1]) * sy
        ring.push([px, py])
        a = Math.min(a, px)
        c = Math.max(c, px)
        d = Math.min(d, py)
        e = Math.max(e, py)
      }
      const step = orthoStep(c - a, e - d)
      const px: [number, number, number, number][] = []
      let total = 0
      for (let y = Math.max(0, Math.floor(d)); y < Math.min(img.height, e); y += step)
        for (let x = Math.max(0, Math.floor(a)); x < Math.min(img.width, c); x += step) {
          if (!pointInRing([x + 0.5, y + 0.5], ring)) continue
          const o = (y * img.width + x) * 4
          total++
          const r = img.data[o],
            g = img.data[o + 1],
            bl = img.data[o + 2]
          if (isTreePixel(r, g, bl)) continue
          px.push([r, g, bl, luma(r, g, bl)])
        }
      const colour = roofColour(px, total, b.k === 'church')
      if (!colour) continue
      b.oc = colour
      sampled++
    }
  }
  console.log(`dachy z ortofotomapy: ${sampled}`)
}
