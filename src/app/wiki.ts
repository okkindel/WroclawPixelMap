// Opisy i zdjęcia z Wikipedii dla obiektów z OSM (public/data/wiki.json, scripts/bake/bake-wiki.ts).
// Wczytywane leniwie przy pierwszym kliknięciu.
import { loadJson } from '../engine/data.ts'
import { lang } from '../i18n/index.ts'

export interface WikiEntry {
  pl?: string
  en?: string
  img?: string
  credit?: string
}
export interface WikiInfo {
  text?: string
  img?: string
  credit?: string
  link?: { href: string; label: string }
}

let cache: Promise<Record<string, WikiEntry>> | null = null
export const wikiData = (): Promise<Record<string, WikiEntry>> =>
  (cache ??= loadJson<Record<string, WikiEntry>>('wiki.json').then((w) => w ?? {}))

export const wikiLabel = (href: string) => (href.includes('wikipedia') ? 'Wikipedia' : 'Wikidata')

// Opis dla adresu artykułu: tekst w bieżącym języku (albo drugim), zdjęcie z podpisem i link.
export async function wikiInfo(wiki: string | undefined): Promise<WikiInfo> {
  if (!wiki) return {}
  const w = (await wikiData())[wiki]
  return { text: w?.[lang()] ?? w?.pl ?? w?.en, img: w?.img, credit: w?.credit, link: { href: wiki, label: wikiLabel(wiki) } }
}
