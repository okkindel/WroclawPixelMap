// Okienko z opisem (zabytek, krasnal, ciekawostka) i krótkie powiadomienia.
import { byId } from './dom.ts'

const popup = byId('popup')
const body = byId('popup-body')
const toastEl = byId('toast')

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

popup.querySelector('.close')!.addEventListener('click', closePopup)
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePopup()
})

export interface PopupContent {
  title: string
  sub?: string
  text?: string
  img?: string
  link?: { href: string; label: string }
  credit?: string // podpis zdjęcia (autor, licencja)
}

// tylko zdjęcia z adresu http(s) z rozszerzeniem obrazka
const isImageUrl = (src: string) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(src) && src.startsWith('http')

export function openPopup(c: PopupContent) {
  const credit = c.credit ? `<small class="credit">fot. ${esc(c.credit)}</small>` : ''
  // zdjęcie w ramce z szkieletem do czasu wczytania; jeśli się nie wczyta, znika razem z podpisem
  const img =
    c.img && isImageUrl(c.img)
      ? `<figure class="photo loading"><img src="${esc(c.img)}" alt="" referrerpolicy="no-referrer">${credit}</figure>`
      : ''
  const link =
    c.link && /^https?:/.test(c.link.href) ? `<a href="${esc(c.link.href)}" target="_blank" rel="noopener">${esc(c.link.label)}</a>` : ''
  body.innerHTML = [
    `<h2>${esc(c.title)}</h2>`,
    c.sub ? `<div class="sub">${esc(c.sub)}</div>` : '',
    img,
    c.text ? `<p>${esc(c.text)}</p>` : '',
    link,
  ].join('')
  const photo = body.querySelector<HTMLElement>('.photo')
  const pic = photo?.querySelector('img')
  if (photo && pic) {
    const done = () => photo.classList.remove('loading')
    if (pic.complete && pic.naturalWidth) done()
    pic.addEventListener('load', done)
    pic.addEventListener('error', () => photo.remove())
  }
  popup.hidden = false
}

export function closePopup() {
  popup.hidden = true
}

let toastTimer = 0
export function toast(text: string, ms = 2600) {
  toastEl.textContent = text
  toastEl.hidden = false
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toastEl.hidden = true), ms)
}
