// Wersja językowa: wybór języka, tłumaczenie tekstów UI i podmiana napisów w index.html.
import { EN, PL, type Key } from './dict.ts'

export type Lang = 'pl' | 'en'
export type { Key }
export { dwarfFacts, eggs, epochs, landmarkRank, landmarks, trivia } from '../content/index.ts'

const STORE = 'wpm.lang'
const SITE = 'https://okkindel.github.io/projects/wroclaw-w-pikselach/'
const ok = (v: string | null | undefined): Lang | null => (v === 'pl' || v === 'en' ? v : null)

let current: Lang | null = null

// Kolejność: ?lang=en w adresie, wybór zapamiętany w localStorage, język przeglądarki.
export function lang(): Lang {
  if (current) return current
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORE)
  } catch {
    /* brak dostępu */
  }
  current = ok(new URLSearchParams(location.search).get('lang')) ?? ok(stored) ?? 'pl' // domyślnie polski (wersja angielska: ?lang=en albo przełącznik)
  return current
}

// Zapamiętuje wybór i przeładowuje stronę z ?lang=… (hash z widokiem mapy zostaje).
export function setLang(l: Lang) {
  try {
    localStorage.setItem(STORE, l)
  } catch {
    /* brak dostępu */
  }
  location.href = langUrl(l)
}

function langUrl(l: Lang) {
  const u = new URL(location.href)
  u.searchParams.set('lang', l)
  return u.href
}

// Tekst ze słownika; {zmienne} podstawiane z vars. Nieznany klucz wraca bez zmian.
export function t(key: Key | (string & {}), vars?: Record<string, string | number>): string {
  const dict: Record<string, string> = lang() === 'en' ? EN : PL
  const s = dict[key] ?? key
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
}

// Podmienia teksty oznaczone data-i18n*, tytuł, meta (opis, Open Graph, Twitter) i przełącznik języka.
export function applyI18n(root: ParentNode = document) {
  const l = lang()
  document.documentElement.lang = l
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n!)
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml!)
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]'))
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder!))
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle!)
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria!))

  document.title = t('meta.title')
  const meta = (sel: string, v: string) => document.head.querySelector(sel)?.setAttribute('content', v)
  meta('meta[name="description"]', t('meta.description'))
  meta('meta[property="og:title"]', t('meta.title'))
  meta('meta[property="og:description"]', t('meta.description'))
  meta('meta[property="og:locale"]', t('meta.locale'))
  meta('meta[property="og:locale:alternate"]', l === 'en' ? 'pl_PL' : 'en_GB')
  meta('meta[name="twitter:title"]', t('meta.title'))
  meta('meta[name="twitter:description"]', t('meta.description'))
  const url = l === 'en' ? `${SITE}?lang=en` : SITE
  meta('meta[property="og:url"]', url)
  document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', url)

  // przełącznik to zwykły link do drugiej wersji (czytelny też dla robotów)
  const sw = document.querySelector<HTMLAnchorElement>('#btn-lang')
  if (sw) {
    const other: Lang = l === 'en' ? 'pl' : 'en'
    sw.hreflang = other
    sw.href = `?lang=${other}`
    sw.onclick = (e) => {
      e.preventDefault()
      setLang(other)
    }
  }
}
