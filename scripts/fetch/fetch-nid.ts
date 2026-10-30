// Rejestr zabytków nieruchomych NID (dane.gov.pl, zbiór 1130) → data/nid/zrn-utf8.csv.
// Adres pliku CSV bierzemy z API portalu (zmienia się przy aktualizacjach); plik jest w Windows-1250.
// Istniejący plik pomija; --force pobiera od nowa.
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fetchBuffer, UA, withRetry } from '../lib/http.ts'

const DATASET = 'https://api.dane.gov.pl/1.4/datasets/1130/resources'
const OUT = 'data/nid/zrn-utf8.csv'

interface Resources {
  data: { attributes: { format?: string; file_url?: string; link?: string } }[]
}

if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.log(`${OUT}: jest, pomijam`)
  process.exit(0)
}

const list = await withRetry(
  'dane.gov.pl',
  4,
  (a) => 3000 * a,
  async () => {
    const res = await fetch(DATASET, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as Resources
  },
)
const csv = list?.data.map((r) => r.attributes).find((a) => a.format === 'csv')
const url = csv?.file_url ?? csv?.link
if (!url) throw new Error('brak pliku CSV w zbiorze rejestru zabytków')

const raw = await withRetry(
  'rejestr NID',
  4,
  (a) => 5000 * a,
  () => fetchBuffer(url),
)
if (!raw) throw new Error(`nie udało się pobrać ${url}`)
// pierwotne kodowanie: Windows-1250 (polskie znaki); zapisujemy w UTF-8
const text = new TextDecoder('windows-1250').decode(raw)
await mkdir('data/nid', { recursive: true })
await writeFile(OUT, text)
console.log(
  `${OUT}: ${(text.length / 1e6).toFixed(1)} MB, wierszy z Wrocławia: ${text.split('\n').filter((l) => l.includes('"Wrocław";')).length}`,
)
