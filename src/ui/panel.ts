// Panel ustawień, oś czasu i karta informacyjna epoki.
import type { Epoch } from '../content/index.ts'
import { lang } from '../i18n/index.ts'
import { SEASONS, type Season, TIME_PRESETS, type TimePreset } from '../engine/sun.ts'
import { byId, oneOf } from './dom.ts'

export const LAYERS = [
  'dwarfs',
  'neons',
  'monuments',
  'trams',
  'trains',
  'boats',
  'cars',
  'people',
  'birds',
  'clouds',
  'trees',
  // znaczniki: główny przełącznik i grupy (PinGroup w layers/labels.ts)
  'markers',
  'labels',
  'places',
  'pois',
  'unis',
  'eggs',
  'cult',
] as const
export type Layer = (typeof LAYERS)[number]
export const LOOK_OPTS = ['palette', 'outline', 'dither'] as const
export type LookOpt = (typeof LOOK_OPTS)[number]

export interface PanelHandlers {
  time: (v: TimePreset) => void
  // godzina z suwaka, w minutach od północy
  hour: (minutes: number) => void
  season: (v: Season) => void
  pixel: (v: number) => void
  look: (opt: LookOpt, on: boolean) => void
  layer: (layer: Layer, on: boolean) => void
}

export function initPanel(h: PanelHandlers) {
  document.querySelectorAll<HTMLElement>('.seg').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('button') : null
      if (!b) return
      for (const x of seg.querySelectorAll('button')) x.classList.toggle('on', x === b)
      const v = b.dataset.v
      if (seg.dataset.group === 'time') {
        const p = oneOf(TIME_PRESETS, v)
        if (p) h.time(p)
      } else if (seg.dataset.group === 'season') {
        const s = oneOf(SEASONS, v)
        if (s) h.season(s)
      }
    })
  })
  const hour = byId<HTMLInputElement>('hour')
  hour.addEventListener('input', () => {
    // ręczna godzina: żaden skrót (Teraz, Południe…) nie jest już wybrany
    for (const b of document.querySelectorAll('.seg[data-group="time"] button')) b.classList.remove('on')
    showHour(+hour.value)
    h.hour(+hour.value)
  })
  const px = byId<HTMLInputElement>('pixel')
  px.addEventListener('input', () => {
    byId('pixel-v').textContent = px.value
    h.pixel(+px.value)
  })
  for (const i of document.querySelectorAll<HTMLInputElement>('input[data-opt]')) {
    const opt = oneOf(LOOK_OPTS, i.dataset.opt)
    if (opt) i.addEventListener('change', () => h.look(opt, i.checked))
  }
  for (const i of document.querySelectorAll<HTMLInputElement>('input[data-layer]')) {
    i.addEventListener('change', () => {
      // główny przełącznik znaczników wygasza pozostałe (ich stan zostaje)
      if (i.dataset.layer === 'markers') {
        for (const m of document.querySelectorAll<HTMLInputElement>('input[data-marker]')) m.disabled = !i.checked
      }
      const layer = oneOf(LAYERS, i.dataset.layer)
      if (layer) h.layer(layer, i.checked)
    })
  }

  const drawer = byId('drawer')
  const btn = byId('btn-settings')
  btn.addEventListener('click', () => {
    drawer.hidden = !drawer.hidden
    // otwarta szuflada zasłania przyciski obrotu — chowamy je na ten czas
    document.body.classList.toggle('drawer-open', !drawer.hidden)
    btn.setAttribute('aria-expanded', String(!drawer.hidden))
  })
  const attrib = byId('attrib')
  const fold = () => attrib.classList.add('folded')
  setTimeout(fold, 8000)
  byId('map').addEventListener('pointerdown', fold, { once: true })
  const about = byId<HTMLDialogElement>('about')
  byId('btn-about').addEventListener('click', () => about.showModal())
  about.querySelector('.close')!.addEventListener('click', () => about.close())
  about.addEventListener('click', (e) => {
    if (e.target === about) about.close()
  })
  const card = byId('info')
  const foldBtn = card.querySelector<HTMLButtonElement>('.fold')!
  foldBtn.addEventListener('click', () => {
    foldBtn.textContent = card.classList.toggle('folded') ? '+' : '–'
  })
  // dotknięcie kartki rozwija i zwija opis epoki (na telefonie opis jest domyślnie schowany)
  card.addEventListener('click', (e) => {
    if (e.target !== foldBtn) card.classList.toggle('expanded')
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
  // aktywna epoka na środku osi (na telefonie oś jest szersza niż ekran); przy starcie bez animacji
  let first = true
  return (e: Epoch) =>
    buttons.forEach((b, i) => {
      const on = epochs[i].id === e.id
      b.classList.toggle('on', on)
      if (!on) return
      nav.scrollTo({ left: rail.offsetLeft + b.offsetLeft - nav.clientWidth / 2, behavior: first ? 'instant' : 'smooth' })
      first = false
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

// Suwak pory dnia: położenie i podpis (skróty i „Teraz” przesuwają go same).
export function showHour(minutes: number) {
  byId<HTMLInputElement>('hour').value = String(minutes - (minutes % 15))
  byId('hour-v').textContent = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
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
