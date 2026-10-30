// Opisy i zdjęcia z Wikipedii dla obiektów z OSM (public/data/wiki.json, scripts/bake/bake-wiki.ts).
// Wczytywane leniwie przy pierwszym kliknięciu.
import { lang } from '../i18n/index.ts'
import type { WorldMeta } from '../types/world.ts'

export interface WikiEntry { pl?: string; en?: string; img?: string; credit?: string }
export interface WikiInfo { text?: string; img?: string; credit?: string; link?: { href: string; label: string } }

let cache: Promise<Record<string, WikiEntry>> | null = null
export const wikiData = (): Promise<Record<string, WikiEntry>> =>
  (cache ??= fetch(`${import.meta.env.BASE_URL}data/wiki.json`)
    .then((r): Promise<Record<string, WikiEntry>> => (r.ok ? r.json() : Promise.resolve({})))
    .catch(() => ({})))

export const wikiLabel = (href: string) => (href.includes('wikipedia') ? 'Wikipedia' : 'Wikidata')

// Opis dla adresu artykułu: tekst w bieżącym języku (albo drugim), zdjęcie z podpisem i link.
export async function wikiInfo(wiki: string | undefined): Promise<WikiInfo> {
  if (!wiki) return {}
  const w = (await wikiData())[wiki]
  return { text: w?.[lang()] ?? w?.pl ?? w?.en, img: w?.img, credit: w?.credit, link: { href: wiki, label: wikiLabel(wiki) } }
}

// Artykuł dla budynku: obiekt z OSM (meta.pois) o tej samej nazwie w promieniu 250 m.
export function wikiForBuilding(meta: WorldMeta, name: string, x: number, y: number): string | undefined {
  return meta.pois.find(([n, px, py, , , w]) => n === name && w && Math.hypot(px - x, py - y) < 250)?.[5]
}
