// Panel ustawień, oś czasu i karta informacyjna epoki.
import type { Epoch } from '../history/content.ts'
import { lang } from '../i18n/index.ts'
import { byId } from './dom.ts'

export type Layer =
  | 'dwarfs' | 'neons' | 'monuments' | 'trams' | 'trains' | 'boats' | 'cars' | 'people' | 'birds' | 'clouds' | 'trees'
  // znaczniki: główny przełącznik i grupy (PinGroup w layers/labels.ts)
  | 'markers' | 'labels' | 'places' | 'pois' | 'unis' | 'eggs' | 'cult'
export type LookOpt = 'palette' | 'outline' | 'dither'

export interface PanelHandlers {
  time: (v: string) => void
  season: (v: string) => void
  pixel: (v: number) => void
  look: (opt: LookOpt, on: boolean) => void
  layer: (layer: Layer, on: boolean) => void
}

export function initPanel(h: PanelHandlers) {
  document.querySelectorAll<HTMLElement>('.seg').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button')
      if (!b) return
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b))
      const group = seg.dataset.group as 'time' | 'season'
      h[group](b.dataset.v!)
    })
  })
  const px = byId<HTMLInputElement>('pixel')
  px.addEventListener('input', () => {
    byId('pixel-v').textContent = px.value
    h.pixel(+px.value)
  })
  document.querySelectorAll<HTMLInputElement>('input[data-opt]').forEach((i) => i.addEventListener('change', () => h.look(i.dataset.opt as LookOpt, i.checked)))
  document.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((i) => i.addEventListener('change', () => {
    // główny przełącznik znaczników wygasza pozostałe (ich stan zostaje)
    if (i.dataset.layer === 'markers') {
      document.querySelectorAll<HTMLInputElement>('input[data-marker]').forEach((m) => (m.disabled = !i.checked))
    }
    h.layer(i.dataset.layer as Layer, i.checked)
  }))

  const drawer = byId('drawer')
  const btn = byId('btn-settings')
  btn.addEventListener('click', () => {
    drawer.hidden = !drawer.hidden
    btn.setAttribute('aria-expanded', String(!drawer.hidden))
  })
  const attrib = byId('attrib')
  const fold = () => attrib.classList.add('folded')
  setTimeout(fold, 8000)
  byId('map').addEventListener('pointerdown', fold, { once: true })
  const about = byId<HTMLDialogElement>('about')
  byId('btn-about').addEventListener('click', () => about.showModal())
  about.querySelector('.close')!.addEventListener('click', () => about.close())
  about.addEventListener('click', (e) => { if (e.target === about) about.close() })
  const card = byId('info')
  const foldBtn = card.querySelector<HTMLButtonElement>('.fold')!
  foldBtn.addEventListener('click', () => {
    foldBtn.textContent = card.classList.toggle('folded') ? '+' : '–'
  })
}

// Oś czasu jako linijka: epoki rozłożone równo, aktywna zaznaczona czerwonym rombem.
export function initTimeline(epochs: Epoch[], onPick: (e: Epoch) => void) {
  const nav = byId('timeline')
  const rail = document.createElement('div')
  rail.className = 'rail'
  rail.style.minWidth = `${epochs.length * 96}px`
  nav.appendChild(rail)
  const buttons = epochs.map((e, i) => {
    const b = document.createElement('button')
    b.className = 'tick'
    b.style.left = `${(i / (epochs.length - 1)) * 100}%`
    b.innerHTML = `<b>${e.year}</b><i></i><span></span>`
    b.querySelector('span')!.textContent = e.label
    b.onclick = () => onPick(e)
    rail.appendChild(b)
    return b
  })
  return (e: Epoch) => buttons.forEach((b, i) => {
    const on = epochs[i] === e
    b.classList.toggle('on', on)
    if (on) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  })
}

export function setCompass(azimuth: number) {
  byId('compass').style.setProperty('--rot', `${azimuth}rad`)
}

export function showEpoch(e: Epoch) {
  byId('info-city').textContent = e.city
  byId('info-year').textContent = String(e.year)
  byId('info-label').textContent = e.label
  byId('info-state').textContent = e.state
  byId('info-text').textContent = e.text
  byId('info-flag').className = `flag flag-${e.flag}`
}

export function setClock(d: Date) {
  byId('info-clock').textContent = d.toLocaleTimeString(lang() === 'en' ? 'en-GB' : 'pl-PL', { hour: '2-digit', minute: '2-digit' })
}

export function setDwarfCount(found: number, total: number) {
  const el = byId('dwarf-found')
  if (el.textContent !== String(found) && el.textContent !== '0') {
    const badge = el.parentElement!
    badge.classList.remove('pop')
    void badge.offsetWidth
    badge.classList.add('pop')
  }
  el.textContent = String(found)
  byId('dwarf-total').textContent = String(total)
}
