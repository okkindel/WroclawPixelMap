// Okienko z opisem (zabytek, krasnal, ciekawostka) i krótkie powiadomienia.
const popup = document.getElementById('popup')!
const body = document.getElementById('popup-body')!
const toastEl = document.getElementById('toast')!

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

popup.querySelector('.close')!.addEventListener('click', closePopup)
addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopup() })

export interface PopupContent {
  title: string
  sub?: string
  text?: string
  img?: string
  link?: { href: string; label: string }
}

export function openPopup(c: PopupContent) {
  const img = c.img && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(c.img) && c.img.startsWith('http') ? `<img src="${esc(c.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''
  body.innerHTML = `<h2>${esc(c.title)}</h2>${c.sub ? `<div class="sub">${esc(c.sub)}</div>` : ''}${img}${c.text ? `<p>${esc(c.text)}</p>` : ''}${
    c.link && /^https?:/.test(c.link.href) ? `<a href="${esc(c.link.href)}" target="_blank" rel="noopener">${esc(c.link.label)}</a>` : ''
  }`
  popup.hidden = false
}

export function closePopup() { popup.hidden = true }

let toastTimer = 0
export function toast(text: string, ms = 2600) {
  toastEl.textContent = text
  toastEl.hidden = false
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toastEl.hidden = true), ms)
}
