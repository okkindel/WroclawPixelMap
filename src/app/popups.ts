// Treść wszystkich okienek mapy: zabytki, ciekawostki, neony, krasnale, tramwaje, scenki, obiekty z OSM, stadiony,
// budynki i pomniki. Wygląd okienka: src/ui/popup.ts. Opisy i zdjęcia z Wikipedii: public/data/wiki.json
// (scripts/bake/bake-wiki.ts), wczytywane leniwie przy pierwszym kliknięciu.
import type { Egg, Landmark, NeonSpec, Trivia } from '../content/index.ts'
import { loadJson } from '../engine/data.ts'
import { lang, t } from '../i18n/index.ts'
import type { Dwarf } from '../types/world.ts'
import { openPopup, type PopupContent } from '../ui/popup.ts'

export const showLandmark = (l: Landmark) => openPopup({ title: l.name, sub: l.year, text: l.text })

export const showEgg = (e: Egg) => openPopup({ title: e.title, text: e.text, sub: t('sub.trivia') })

export function showTrivia(tr: Trivia) {
  const sub = { miejsce: t('sub.trivia'), uczelnia: t('sub.uni'), kultowe: t('sub.cult') }[tr.category]
  openPopup({ title: tr.title, sub, text: tr.text, link: { href: tr.source, label: t('source') } })
}

// Neon: to samo okienko po kliknięciu w szyld i w znacznik ciekawostki przy nim.
export function showNeon(n: NeonSpec) {
  const L = lang()
  openPopup({
    title: n.title[L],
    sub: t('layer.neons'),
    text: n.text[L],
    img: n.img,
    credit: n.credit,
    link: { href: n.source, label: t('source') },
  })
}

// Krasnal: autor i data odsłonięcia, napis z tabliczki albo losowa ciekawostka o krasnalach.
export function showDwarf(dwarf: Dwarf, facts: string[]) {
  const sub = [dwarf.a && t('dwarf.author', { a: dwarf.a }), dwarf.d && t('dwarf.since', { d: dwarf.d })].filter(Boolean).join(' · ')
  const fact = facts[Math.floor(Math.random() * facts.length)]
  openPopup({
    title: dwarf.n,
    sub,
    img: dwarf.img,
    text: dwarf.i ? t('dwarf.quote', { s: dwarf.i }) : fact,
    link: { href: `https://www.openstreetmap.org/node/${dwarf.id}`, label: t('dwarf.osm') },
  })
}

// Tramwaj z rozkładu MPK: linia, kierunek, godziny kursu.
export const showTram = (info: { line: string; head: string; dep: string; arr: string }) =>
  openPopup({
    title: t('tram.title', { line: info.line }),
    sub: t('tram.sub', { head: info.head }),
    text: t('tram.text', { dep: info.dep, arr: info.arr }),
  })

export const showScene = (s: { title: string; text: string }) => openPopup({ title: s.title, sub: t('sub.trivia'), text: s.text })

// Pomnik: treść gotowa w warstwie pomników (opis, zdjęcie z Commons, link).
export const showMonument = (m: PopupContent) => openPopup(m)

export const showStadium = (name: string) => openPopup({ title: name, sub: t('sub.stadium') })

// Budynek bez własnego napisu, ale z rokiem budowy.
export const showBuilding = (name: string, year: number) => openPopup({ title: name, sub: t('building.built', { y: year }) })

// Obiekt z OSM: rodzaj w podtytule, opis i zdjęcie z Wikipedii, jeśli są.
export async function showPoi(name: string, sub: string, wiki?: string | null) {
  openPopup({ title: name, sub, ...(await wikiContent(wiki ?? undefined)) })
}

// ---------- Wikipedia ----------

interface WikiEntry {
  pl?: string
  en?: string
  img?: string
  credit?: string
}

let wiki: Promise<Record<string, WikiEntry>> | null = null
const wikiData = () => (wiki ??= loadJson<Record<string, WikiEntry>>('wiki.json').then((w) => w ?? {}))

// Opis dla adresu artykułu: tekst w bieżącym języku (albo drugim), zdjęcie z podpisem i link.
async function wikiContent(href: string | undefined): Promise<Partial<PopupContent>> {
  if (!href) return {}
  const w = (await wikiData())[href]
  const label = href.includes('wikipedia') ? 'Wikipedia' : 'Wikidata'
  return { text: w?.[lang()] ?? w?.pl ?? w?.en, img: w?.img, credit: w?.credit, link: { href, label } }
}
