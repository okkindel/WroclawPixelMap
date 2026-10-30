// Zapytania do Overpass API z ponawianiem i zapasowymi serwerami (główny bywa przeciążony).
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { UA_LONG, sleep } from './http.ts'
import { errMsg, parseJson, readJson } from './json.ts'
import type { OsmEl, OsmFile } from './osm.ts'

export const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

export const FORCE = process.argv.includes('--force')

// Tekst odpowiedzi albo null, gdy żaden serwer nie dał rady (timeout / przeciążenie).
// Kolejne próby idą na kolejne serwery (offset: od którego zacząć), z rosnącą przerwą.
export async function tryOverpass(label: string, query: string, attempts: number, offset = 0, delayMs = 4000): Promise<string | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const endpoint = ENDPOINTS[(attempt - 1 + offset) % ENDPOINTS.length]
    process.stdout.write(`pobieram ${label} (${new URL(endpoint).host})… `)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': UA_LONG, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      })
      const text = await res.text()
      if (res.ok && text.trimStart().startsWith('{') && !text.includes('"remark": "runtime error')) return text
      console.log(`HTTP ${res.status}`)
    } catch (err) {
      console.log(`błąd sieci: ${errMsg(err)}`)
    }
    await sleep(delayMs * attempt)
  }
  return null
}

// Elementy z pliku data/raw/<name>.json; brak pliku (albo --force) = pobranie z Overpass i zapis.
export async function cachedOverpass(name: string, label: string, query: string): Promise<OsmEl[]> {
  const file = `data/raw/${name}.json`
  if (existsSync(file) && !FORCE) return (await readJson<OsmFile>(file)).elements
  const text = await tryOverpass(label, query, 9, 0, 3000)
  if (!text) throw new Error(`${label}: nie udało się pobrać`)
  await mkdir('data/raw', { recursive: true })
  await writeFile(file, text)
  console.log('ok')
  return parseJson<OsmFile>(text).elements
}
