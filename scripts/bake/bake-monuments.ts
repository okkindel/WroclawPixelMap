// Pomniki Wrocławia: pomniki, obeliski, krzyże, stele, popiersia i rzeźby z OSM (bez tablic i krasnali).
// Pobiera z Overpass do data/raw/monuments.json (--force pobiera od nowa), dociąga z Wikidanych nazwy i zdjęcia,
// z Wikimedia Commons autora i licencję zdjęć; zapisuje public/data/monuments.json w metrach lokalnych.
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { BBOX } from './config.ts'
import type { Monument, MonumentKind } from '../src/layers/monuments.ts'

interface OsmEl { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const UA = 'wroclaw-pixel-map/0.1 (https://github.com/okkindel/WroclawPixelMap)'
const FORCE = process.argv.includes('--force')
const [S, W, N, E] = BBOX
const meta = JSON.parse(await readFile('public/data/meta.json', 'utf8'))
const ORIGIN: [number, number] = meta.origin
const KX = Math.cos((ORIGIN[0] * Math.PI) / 180) * 111320
const KY = 110540
const r1 = (v: number) => Math.round(v * 10) / 10
const proj = (lat: number, lon: number): [number, number] => [r1((lon - ORIGIN[1]) * KX), r1((lat - ORIGIN[0]) * KY)]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const bb = `${S},${W},${N},${E}`
const query = `[out:json][timeout:180];
(
  nwr["historic"~"^(monument|memorial)$"](${bb});
  nwr["tourism"="artwork"]["artwork_type"~"^(statue|sculpture|bust)$"](${bb});
  nwr["memorial"~"^(statue|bust|obelisk|stele|cross)$"](${bb});
);
out center tags;`

async function fetchRaw(): Promise<OsmEl[]> {
  const file = 'data/raw/monuments.json'
  if (existsSync(file) && !FORCE) return JSON.parse(await readFile(file, 'utf8')).elements
  for (let attempt = 0; attempt < 9; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]
    process.stdout.write(`pobieram pomniki (${new URL(endpoint).host})… `)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      })
      const text = await res.text()
      if (res.ok && text.trimStart().startsWith('{')) {
        await mkdir('data/raw', { recursive: true })
        await writeFile(file, text)
        console.log('ok')
        return JSON.parse(text).elements
      }
      console.log(`HTTP ${res.status}`)
    } catch (err) {
      console.log(`błąd sieci: ${(err as Error).message}`)
    }
    await sleep(3000 * (attempt + 1))
  }
  throw new Error('pomniki: nie udało się pobrać')
}

// JSON z ponawianiem (Wikidane, Commons)
async function getJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (res.ok) return await res.json()
      console.log(`  HTTP ${res.status} (${new URL(url).host})`)
    } catch (err) {
      console.log(`  błąd sieci: ${(err as Error).message}`)
    }
    await sleep(2000 * (attempt + 1))
  }
  throw new Error(`nie udało się pobrać ${url}`)
}

// Pamięć podręczna odpowiedzi (Wikidane, Commons) w data/raw, żeby ponowne uruchomienie nie pytało sieci.
async function cached<T>(file: string, load: () => Promise<T>): Promise<T> {
  if (existsSync(file) && !FORCE) return JSON.parse(await readFile(file, 'utf8'))
  const v = await load()
  await writeFile(file, JSON.stringify(v))
  return v
}

const chunks = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

// ---------- filtr i klasyfikacja ----------
const SKIP_MEMORIAL = /^(plaque|blue_plaque|pavement_plaque|stolperstein|war_grave|grave|cemetery|board|tablet|relief|flood_mark|lapidarium|ghost_bike|bench|tree|ossuary)$/
const KINDS: MonumentKind[] = ['statue', 'bust', 'obelisk', 'stele', 'cross', 'sculpture']

function kindOf(t: Record<string, string>): MonumentKind {
  for (const v of [t.memorial, t['memorial:type'], t.artwork_type, t.monument]) if (KINDS.includes(v as MonumentKind)) return v as MonumentKind
  if (t.memorial === 'pillar' || t.memorial === 'column') return 'obelisk'
  if (t.memorial === 'stone' || t.memorial === 'stone_slab') return 'stele' // głaz pamiątkowy jako niska stela
  return 'other'
}

// Materiał figury: b = brąz z patyną, s = kamień, m = stal/metal.
function materialOf(t: Record<string, string>, k: MonumentKind): Monument['m'] {
  const m = (t.material ?? '').toLowerCase()
  if (/bronze|brass|copper/.test(m)) return 'b'
  if (/steel|metal|iron|alumin/.test(m)) return 'm'
  if (/stone|granite|marble|sandstone|concrete|limestone|basalt|brick/.test(m)) return 's'
  return k === 'statue' || k === 'bust' || k === 'sculpture' ? 'b' : 's'
}

const yearOf = (s?: string) => {
  const m = s?.match(/\d{4}/)
  return m ? +m[0] : undefined
}
const num = (s?: string) => {
  const v = parseFloat((s ?? '').replace(',', '.'))
  return Number.isFinite(v) && v > 0 && v < 120 ? v : undefined
}

// Nazwa pliku z Commons z tagów image / wikimedia_commons (tylko Wikimedia).
function commonsFile(t: Record<string, string>): string | undefined {
  const wc = t.wikimedia_commons
  if (wc?.startsWith('File:')) return wc.slice(5).replace(/ /g, '_')
  const img = t.image
  if (!img) return undefined
  let m = img.match(/commons\.wikimedia\.org\/wiki\/(?:File|Plik):([^?#]+)/i)
  if (m) return decodeURIComponent(m[1]).replace(/ /g, '_')
  m = img.match(/upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i)
  if (m) return decodeURIComponent(m[1]).replace(/ /g, '_')
  m = img.match(/^(?:File|Plik):(.+)$/i)
  if (m) return m[1].replace(/ /g, '_')
  return undefined
}
const fileUrl = (f: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=480`

function wikiUrl(v?: string) {
  const m = v?.match(/^([a-z-]{2,12}):(.+)$/)
  return m ? `https://${m[1]}.wikipedia.org/wiki/${encodeURIComponent(m[2].replace(/ /g, '_'))}` : undefined
}

// ---------- dane ----------
const els = (await fetchRaw()).filter((e) => {
  const t = e.tags ?? {}
  if (t.artwork_type === 'dwarf' || /krasnal/i.test(t.name ?? '')) return false
  if (SKIP_MEMORIAL.test(t.memorial ?? '') || SKIP_MEMORIAL.test(t['memorial:type'] ?? '')) return false
  if (/plaque|tablica/i.test(t.memorial ?? '')) return false
  // historic=memorial bez rodzaju bywa tablicą — zostawiamy tylko te z nazwą/wikidanymi (filtr niżej)
  return (e.lat ?? e.center?.lat) != null
})

// Wikidane: etykiety (dla bezimiennych), zdjęcie P18 i artykuł w Wikipedii, gdy brak w OSM.
const qids = [...new Set(els.map((e) => e.tags?.wikidata).filter((q): q is string => !!q && /^Q\d+$/.test(q)))]
await mkdir('data/raw', { recursive: true })
const wd: Record<string, { pl?: string; en?: string; img?: string; wp?: string }> = await cached('data/raw/monuments-wikidata.json', async () => {
  const out: Record<string, { pl?: string; en?: string; img?: string; wp?: string }> = {}
  for (const part of chunks(qids, 50)) {
    process.stdout.write(`wikidane ${Object.keys(out).length}/${qids.length}… `)
    const j = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|claims|sitelinks&languages=pl|en&sitefilter=plwiki|enwiki&ids=${part.join('|')}`)
    for (const [q, ent] of Object.entries<any>(j.entities ?? {})) {
      const p18 = ent.claims?.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined
      const sl = ent.sitelinks?.plwiki ?? ent.sitelinks?.enwiki
      out[q] = {
        pl: ent.labels?.pl?.value, en: ent.labels?.en?.value,
        img: p18?.replace(/ /g, '_'),
        wp: sl ? `${sl.site === 'plwiki' ? 'pl' : 'en'}:${sl.title}` : undefined,
      }
    }
    await sleep(300)
  }
  console.log('ok')
  return out
})

interface Draft extends Monument { file?: string; score: number }
const drafts: Draft[] = []
for (const e of els) {
  const t = e.tags!
  const w = t.wikidata ? wd[t.wikidata] : undefined
  const n = t.name ?? t['name:pl'] ?? t.inscription_name ?? w?.pl ?? w?.en
  if (!n) continue // bezimienne bez Wikidanych pomijamy
  const k = kindOf(t)
  // historic=memorial bez rodzaju, bez Wikidanych i Wikipedii — najpewniej tablica albo kamień, pomijamy
  if (t.historic === 'memorial' && k === 'other' && !t.memorial && !t.wikidata && !t.wikipedia && !t.tourism) continue
  const [x, y] = proj(e.lat ?? e.center!.lat, e.lon ?? e.center!.lon)
  const file = commonsFile(t) ?? w?.img
  const ne = t['name:en'] ?? (t.name ? undefined : w?.en)
  const a = t.artist_name ?? t['artist:name'] ?? t.sculptor ?? t.architect
  const ins = t.inscription ?? t['inscription:pl']
  const wp = wikiUrl(t.wikipedia) ?? wikiUrl(w?.wp)
  const d: Draft = {
    id: `${e.type[0]}${e.id}`, x, y, n, k, m: materialOf(t, k), file,
    score: Object.keys(t).length + (e.type === 'node' ? 5 : 0) + (file ? 10 : 0),
  }
  if (ne && ne !== n) d.ne = ne
  const h = num(t.height)
  if (h) d.h = h
  if (a) d.a = a
  const yr = yearOf(t.start_date) ?? yearOf(t['memorial:date'])
  if (yr) d.yr = yr
  if (ins) d.ins = ins.length > 400 ? ins.slice(0, 397) + '…' : ins
  if (wp) d.wp = wp
  if (t.wikidata) d.wd = `https://www.wikidata.org/wiki/${t.wikidata}`
  drafts.push(d)
}

// duplikaty: ten sam pomnik jako punkt i obszar (ta sama nazwa albo Wikidane, < 40 m) — zostaje bogatszy opis
drafts.sort((a, b) => b.score - a.score)
const kept: Draft[] = []
for (const d of drafts) {
  const dup = kept.find((o) => Math.hypot(o.x - d.x, o.y - d.y) < 40 && (o.n === d.n || (!!o.wd && o.wd === d.wd)))
  if (!dup) { kept.push(d); continue }
  // uzupełnij braki z duplikatu
  for (const key of ['h', 'a', 'yr', 'ins', 'wp', 'wd', 'file', 'ne'] as const) if (dup[key] == null && d[key] != null) (dup as any)[key] = d[key]
  if (dup.k === 'other' && d.k !== 'other') dup.k = d.k
}

// Commons: autor i licencja zdjęć (extmetadata Artist, LicenseShortName)
const files = [...new Set(kept.map((d) => d.file).filter((f): f is string => !!f))]
const strip = (s?: string) => (s ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const credits: Record<string, string | null> = await cached('data/raw/monuments-commons.json', async () => {
  const out: Record<string, string | null> = {}
  for (const part of chunks(files, 50)) {
    process.stdout.write(`commons ${Object.keys(out).length}/${files.length}… `)
    const titles = part.map((f) => `File:${f.replace(/_/g, ' ')}`).join('|')
    const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&iiextmetadatafilter=Artist|LicenseShortName&redirects=1&titles=${encodeURIComponent(titles)}`)
    // tytuły znormalizowane / przekierowane → nazwa pliku z OSM
    const back = new Map<string, string>(part.map((f) => [`File:${f.replace(/_/g, ' ')}`, f]))
    for (const r of [...(j.query?.normalized ?? []), ...(j.query?.redirects ?? [])]) if (back.has(r.from)) back.set(r.to, back.get(r.from)!)
    for (const p of Object.values<any>(j.query?.pages ?? {})) {
      const f = back.get(p.title)
      if (!f) continue
      const em = p.imageinfo?.[0]?.extmetadata
      if (p.missing != null || !em) { out[f] = null; continue }
      const artist = strip(em.Artist?.value).slice(0, 80), lic = strip(em.LicenseShortName?.value)
      out[f] = [artist, lic].filter(Boolean).join(', ') + ' / Wikimedia Commons'
    }
    await sleep(300)
  }
  console.log('ok')
  return out
})

// „No machine-readable author provided. Julo assumed (based on copyright claims).” → „Julo”
const tidy = (c: string) => c.replace(/No machine-readable author provided\.\s*(.+?) assumed \(based on copyright claims\)\.?/, '$1').replace(/^fot\.\s*/i, '') // okienko samo dopisuje „fot.”

const out: Monument[] = kept
  .sort((a, b) => a.y - b.y || a.x - b.x)
  .map(({ file, score: _s, ...d }) => {
    const m: Monument = { ...d }
    // tylko istniejące pliki z Commons i formaty, które pokaże okienko
    if (file && credits[file] !== null && /\.(jpe?g|png|webp|gif)$/i.test(file)) {
      m.img = fileUrl(file)
      if (credits[file]) m.cr = tidy(credits[file]!)
    }
    return m
  })

await writeFile('public/data/monuments.json', JSON.stringify(out))
const by = out.reduce<Record<string, number>>((acc, m) => ((acc[m.k] = (acc[m.k] ?? 0) + 1), acc), {})
console.log(`zapisano public/data/monuments.json: ${out.length} pomników, ${out.filter((m) => m.img).length} ze zdjęciem`, by)
