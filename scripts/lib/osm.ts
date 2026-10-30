// Surowe dane OSM (format Overpass `out geom` / `out center`) w data/raw i odczyt tagów.
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { readJson } from './json.ts'

export type Tags = Record<string, string>
export interface LatLon {
  lat: number
  lon: number
}
export interface OsmMember {
  type: string
  ref: number
  role: string
  geometry?: (LatLon | null)[]
}
export interface OsmEl {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: LatLon
  tags?: Tags
  geometry?: (LatLon | null)[]
  members?: OsmMember[]
}
export interface OsmFile {
  elements: OsmEl[]
}

// Elementy z data/raw/<name>.json; brak (opcjonalnego) pliku = pusta lista.
export async function readRaw(name: string, optional = true): Promise<OsmEl[]> {
  const file = `data/raw/${name}.json`
  if (optional && !existsSync(file)) return []
  return (await readJson<OsmFile>(file)).elements
}

// Dane świata są w kawałkach (world-R-C.json + landcover.json), które na brzegach się nakładają: usuwamy duplikaty.
export async function readRawWorld(): Promise<OsmEl[]> {
  const raw: OsmEl[] = []
  const seen = new Set<string>()
  for (const f of (await readdir('data/raw')).filter((f) => /^(world-[\w-]+|landcover)\.json$/.test(f)).sort()) {
    for (const el of (await readJson<OsmFile>(`data/raw/${f}`)).elements) {
      const id = el.type + el.id
      if (!seen.has(id)) {
        seen.add(id)
        raw.push(el)
      }
    }
  }
  return raw
}

// Liczba z tagu (przecinek dziesiętny dopuszczalny), inaczej null.
export const num = (v: string | undefined): number | null => {
  if (v == null) return null
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Pierwszy czterocyfrowy rok z tagu (np. start_date „ok. 1890”, „1905-1907”), inaczej null.
export const year = (v: string | undefined): number | null => {
  const m = v && String(v).match(/\d{4}/)
  return m ? +m[0] : null
}
