// Treść okienek dla zabytków, ciekawostek, neonów i krasnali.
import type { Egg, Landmark, NeonSpec, Trivia } from '../content/index.ts'
import type { Dwarf } from '../types/world.ts'
import { lang, t } from '../i18n/index.ts'
import { openPopup } from '../ui/popup.ts'

export const showLandmark = (l: Landmark) => openPopup({ title: l.name, sub: l.year, text: l.text })

export const showEgg = (e: Egg) => openPopup({ title: e.title, text: e.text, sub: t('sub.trivia') })

export function showTrivia(tr: Trivia) {
  const sub = { miejsce: t('sub.trivia'), uczelnia: t('sub.uni'), kultowe: t('sub.cult') }[tr.category]
  openPopup({ title: tr.title, sub, text: tr.text, link: { href: tr.source, label: t('source') } })
}

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
  const sub = [dwarf.a && t('dwarf.author', { a: dwarf.a }), dwarf.d && t('dwarf.since', { d: dwarf.d })]
    .filter(Boolean)
    .join(' · ')
  const fact = facts[Math.floor(Math.random() * facts.length)]
  openPopup({
    title: dwarf.n,
    sub,
    img: dwarf.img,
    text: dwarf.i ? t('dwarf.quote', { s: dwarf.i }) : fact,
    link: { href: `https://www.openstreetmap.org/node/${dwarf.id}`, label: t('dwarf.osm') },
  })
}
