// Opisy i zdjęcia dla obiektów z OSM, które mają artykuł w Wikipedii (POI w public/data/meta.json):
// pierwsze zdania wstępu artykułu (CC BY-SA) i miniatura z Wikimedia Commons z autorem i licencją.
// Wynik: public/data/wiki.json { [adres artykułu]: { pl?: string, en?: string, img?: string, credit?: string } }.
// Odpowiedzi API są zapisywane w data/raw/wiki-cache.json (ponowne uruchomienie nie odpytuje drugi raz; --force od nowa).
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { UA_LONG, sleep } from '../lib/http.ts'
import { readJson, readMeta } from '../lib/json.ts'

const CACHE = 'data/raw/wiki-cache.json'
const MAX_CHARS = 320

interface Entry {
  pl?: string
  en?: string
  img?: string
  credit?: string
}
type Cache = Record<string, unknown>
interface CommonsInfo {
  query?: { pages?: Record<string, { imageinfo?: { extmetadata?: Record<string, { value: string }> }[] }> }
}

const meta = await readMeta()
const cache: Cache = existsSync(CACHE) && !process.argv.includes('--force') ? await readJson<Cache>(CACHE) : {}

// Odpowiedź API (z pamięci podręcznej albo z sieci); null = brak (HTTP ≠ 200 też trafia do pamięci).
// T to oczekiwany kształt odpowiedzi — pola są opcjonalne, więc brakujące dane dają undefined.
async function getJson<T>(url: string): Promise<T | null> {
  if (!(url in cache)) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA_LONG } })
        cache[url] = res.ok ? await res.json() : null
        break
      } catch {
        await sleep(1500 * attempt)
      }
    }
  }
  return (cache[url] as T | undefined) ?? null
}

// Pierwsze zdania wstępu, przycięte na granicy zdania.
function shorten(text: string) {
  if (text.length <= MAX_CHARS) return text
  const cut = text.slice(0, MAX_CHARS)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'))
  return end > 80 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`
}

const strip = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

// Autor i licencja pliku z Commons; bez wolnej licencji zdjęcia nie pokazujemy.
async function commonsCredit(file: string): Promise<string | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&titles=${encodeURIComponent(`File:${file}`)}`
  const data = await getJson<CommonsInfo>(url)
  const page = data?.query?.pages && Object.values(data.query.pages)[0]
  const md = page?.imageinfo?.[0]?.extmetadata
  const license = md?.LicenseShortName?.value
  if (!md || !license || /fair use|non-free/i.test(license)) return null
  const artist = strip(md.Artist?.value ?? '')
    .replace(/^No machine-readable author provided\.\s*/i, '')
    .replace(/\s*assumed.*$/i, '')
  return [artist, license].filter(Boolean).join(', ')
}

interface Summary {
  extract?: string
  thumbnail?: { source: string }
  originalimage?: { source: string }
}

const out: Record<string, Entry> = {}
const wikis = [...new Set(meta.pois.map((p) => p[5]).filter((w): w is string => !!w && w.includes('wikipedia.org')))]
let done = 0
for (const wiki of wikis) {
  const m = wiki.match(/^https:\/\/(\w+)\.wikipedia\.org\/wiki\/(.+)$/)
  if (!m) continue
  const [, lang, title] = m
  const summary = await getJson<Summary>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${title}`)
  const entry: Entry = {}
  if (summary?.extract) entry[lang === 'en' ? 'en' : 'pl'] = shorten(summary.extract)
  // obraz z Commons (ścieżka .../commons/...) — tylko z wolną licencją i podpisem
  const src = summary?.originalimage?.source ?? summary?.thumbnail?.source
  // adresy miniatur mają dopisane parametry (?utm_…) — odcinamy je przed wyciągnięciem nazwy pliku
  const file = src?.includes('/commons/')
    ? decodeURIComponent(
        src
          .split('?')[0]
          .split('/')
          .pop()!
          .replace(/^\d+px-/, ''),
      )
    : null
  if (file && /\.(jpe?g|png)$/i.test(file)) {
    const credit = await commonsCredit(file)
    if (credit) {
      entry.img = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=480`
      entry.credit = credit
    }
  }
  if (entry.pl || entry.en || entry.img) out[wiki] = entry
  if (++done % 25 === 0) console.log(`${done}/${wikis.length}`)
}

await writeFile(CACHE, JSON.stringify(cache))
await writeFile('public/data/wiki.json', JSON.stringify(out))
const withImg = Object.values(out).filter((e) => e.img).length
console.log(`wiki.json: ${Object.keys(out).length} z ${wikis.length} artykułów, ${withImg} ze zdjęciem`)
