// Rejestr zabytków nieruchomych NID (data/nid/zrn-utf8.csv): rok budowy po adresie (ulica + numer).
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 }
const roman = (s: string) =>
  [...s].reduce((acc, ch, i) => {
    const v = ROMAN[ch],
      next = ROMAN[s[i + 1]] ?? 0
    return acc + (v < next ? -v : v)
  }, 0)

// CHRONOLOGIA -> rok: zakres lat -> początek; wiek -> środek (z doprecyzowaniem: poł., ćw., pocz., koniec, przełom).
export function parseChronology(raw: string): number | null {
  const s = raw.trim()
  const y = s.match(/\b(\d{4})\b/)
  if (y) return +y[1]
  const c = s.match(/\b([IVXL]+)\b(?:\s*\/\s*([IVXL]+)\b)?/)
  if (!c) return null
  const base = (roman(c[1]) - 1) * 100
  let year: number
  const decade = s.match(/lata\s+(\d)0\./)
  const quarter = s.match(/(\d)\.?\s*ćw\./)
  const half = s.match(/(\d)\.?\s*poł\./)
  if (c[2])
    year = (roman(c[2]) - 1) * 100 // przełom XIII/XIV w. -> 1300
  else if (decade) year = base + +decade[1] * 10 + 5
  else if (quarter) year = base + (+quarter[1] - 1) * 25 + 12
  else if (half) year = base + (half[1] === '1' ? 25 : 75)
  else if (/poł\./.test(s)) year = base + 50
  else if (/pocz\./.test(s)) year = base + 10
  else if (/kon(\.|iec)/.test(s)) year = base + 90
  else year = base + 50
  return year > 1000 && year <= new Date().getFullYear() ? year : null
}

// Ulica bez diakrytyków, prefiksów (ul., al., pl.) i tytułów (św., gen., ks.).
const SKIP = new Set([
  'ul',
  'ulica',
  'al',
  'aleja',
  'aleje',
  'pl',
  'plac',
  'sw',
  'swietego',
  'swietej',
  'swietych',
  'gen',
  'generala',
  'ks',
  'ksiedza',
  'bp',
  'biskupa',
  'kard',
  'kardynala',
  'marsz',
  'marszalka',
  'prof',
  'profesora',
  'dr',
  'doktora',
  'im',
])
export function streetKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !SKIP.has(w))
    .join(' ')
}
const lastWord = (key: string) => key.slice(key.lastIndexOf(' ') + 1)
// czy słowa a występują w b w tej samej kolejności
const subseq = (a: string, b: string) => {
  const bw = b.split(' ')
  let j = 0
  for (const w of a.split(' ')) {
    while (j < bw.length && bw[j] !== w) j++
    if (j++ >= bw.length) return false
  }
  return true
}

// Numer -> pojedyncze numery: "7-9" -> 7, 9; "7-10" -> 7, 8, 9, 10; "7/9", "5, 7" -> 7, 9 / 5, 7; "96A" -> 96a.
export function houseNumbers(s: string): string[] {
  const out: string[] = []
  for (const [i, part] of s
    .toLowerCase()
    .replace(/\s+/g, '')
    .split(/[,;]|(?=\/)/)
    .entries()) {
    if (!part) continue
    // "8/1a" (OSM, numer lokalu/PRG) to budynek 8; "7/9" (NID) to dwa budynki: po ukośniku tylko numer większy
    if (part[0] === '/') {
      if (i === 0 || !(parseInt(part.slice(1), 10) > parseInt(out[out.length - 1], 10))) continue
      out.push(part.slice(1))
      continue
    }
    const r = part.match(/^(\d+)([a-z]?)-(\d+)([a-z]?)$/)
    if (r) {
      const a = +r[1],
        b = +r[3]
      // "7-9": przy tej samej parzystości 7, 9 (druga strona ulicy bywa numerowana osobno), inaczej "7-8" -> 7, 8
      if (!r[2] && !r[4] && b > a && b - a <= 10) for (let n = a; n <= b; n += (b - a) % 2 ? 1 : 2) out.push(String(n))
      else out.push(r[1] + r[2], r[3] + r[4])
    } else out.push(part)
  }
  return out
}

// funkcje, które nie są budynkami (ogrodzenia, zieleń): nie przenosimy ich daty na budynek pod adresem
const NOT_BUILDING = /mur|ogrodzenie|ogród|zieleń|park|cmentarz|wybieg|budowla parkowa|aleja|pomnik|rzeźba/

export interface NidHit {
  y: number
  rows: number[]
}

export interface NidIndex {
  rows: number
  parsed: number
  // rok dla adresu (lub null) + numery pasujących wierszy NID, do statystyk
  lookup(street: string | undefined, num: string | undefined): NidHit | null
}

export async function loadNid(path = 'data/nid/zrn-utf8.csv', city = 'Wrocław'): Promise<NidIndex | null> {
  if (!existsSync(path)) return null
  const lines = parseCsv(await readFile(path, 'utf8'))
  const head = lines.shift()!
  const col = (name: string) => head.indexOf(name)
  const [cCity, cChron, cStreet, cNum, cFun] = ['MIEJSCOWOSC', 'CHRONOLOGIA', 'ULICA', 'NR_ADRESOWY', 'FUNKCJA'].map(col)
  const byAddr = new Map<string, NidHit>()
  const fullByLast = new Map<string, Set<string>>()
  let rows = 0,
    parsed = 0
  for (const [i, l] of lines.entries()) {
    if (l[cCity] !== city) continue
    rows++
    const y = parseChronology(l[cChron] ?? '')
    if (y == null) continue
    parsed++
    if (!l[cStreet] || !l[cNum] || NOT_BUILDING.test(l[cFun] ?? '')) continue
    const key = streetKey(l[cStreet])
    if (!key) continue
    if (!fullByLast.has(lastWord(key))) fullByLast.set(lastWord(key), new Set())
    fullByLast.get(lastWord(key))!.add(key)
    // kilka wpisów pod jednym adresem (zespół + obiekty): bierzemy najstarszy
    for (const n of houseNumbers(l[cNum])) {
      const k = `${key}|${n}`,
        prev = byAddr.get(k)
      if (prev) {
        prev.y = Math.min(prev.y, y)
        prev.rows.push(i)
      } else byAddr.set(k, { y, rows: [i] })
    }
  }
  return {
    rows,
    parsed,
    lookup(street, num) {
      if (!street || !num) return null
      const key = streetKey(street)
      if (!key) return null
      // pełna nazwa; inaczej skrócona z imieniem („Bujwida” = „Odona Bujwida”), o ile w NID jednoznaczna
      // (ale nie „Stanisława Wyspiańskiego” = „Wybrzeże Wyspiańskiego”: słowa krótszej muszą być w dłuższej,
      // np. „Wybrzeże Conrada-Korzeniowskiego” = „Wybrzeże Józefa Conrada-Korzeniowskiego”)
      const full = [...(fullByLast.get(lastWord(key)) ?? [])]
      const like = full.filter((f) => subseq(f, key) || subseq(key, f))
      const nidKey = like.includes(key) ? key : like.length === 1 ? like[0] : null
      if (!nidKey) return null
      const hits = houseNumbers(num)
        .map((n) => byAddr.get(`${nidKey}|${n}`))
        .filter((h) => h != null)
      return hits.length ? { y: Math.min(...hits.map((h) => h.y)), rows: hits.flatMap((h) => h.rows) } : null
    },
  }
}

// CSV z polami w cudzysłowach ("" = cudzysłów w polu), separator ';'.
function parseCsv(text: string, sep = ';'): string[][] {
  const rows: string[][] = []
  let row: string[] = [],
    field = '',
    quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}
