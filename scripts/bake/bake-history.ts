// Historyczne plany (data/history, npm run fetch-history) → public/data/history: kafle 512 px + spis.
// Publikujemy tylko plany na otwartej licencji (CC BY-SA 4.0, SLUB Dresden / Deutsche Fotothek).
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import jpeg from 'jpeg-js'

const OPEN = ['1732']
const SIZE = 512
const index: Record<string, string[]> = {}
for (const year of OPEN) {
  const dir = `data/history/${year}`
  if (!existsSync(dir)) continue
  await mkdir(`public/data/history/${year}`, { recursive: true })
  index[year] = []
  for (const f of (await readdir(dir)).filter((f) => f.endsWith('.jpg'))) {
    const src = jpeg.decode(await readFile(`${dir}/${f}`), { useTArray: true })
    const out = Buffer.alloc(SIZE * SIZE * 4)
    // zmniejszanie przez uśrednianie bloków (plan ma drobny druk — bez tego migocze)
    const k = src.width / SIZE
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      let r = 0, g = 0, b = 0, n = 0
      for (let yy = Math.floor(y * k); yy < Math.floor((y + 1) * k); yy++) for (let xx = Math.floor(x * k); xx < Math.floor((x + 1) * k); xx++) {
        const o = (yy * src.width + xx) * 4
        r += src.data[o]; g += src.data[o + 1]; b += src.data[o + 2]; n++
      }
      const o = (y * SIZE + x) * 4
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255
    }
    await writeFile(`public/data/history/${year}/${f}`, jpeg.encode({ data: out, width: SIZE, height: SIZE }, 80).data)
    index[year].push(f.replace('.jpg', ''))
  }
}
await writeFile('public/data/history/index.json', JSON.stringify(index))
console.log('plany historyczne:', Object.entries(index).map(([y, k]) => `${y}: ${k.length} kafli`).join(', '))
