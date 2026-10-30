// Panel ustawień, oś czasu i karta informacyjna epoki.
import type { Epoch } from '../history/content.ts'

export type Layer = 'dwarfs' | 'trams' | 'trains' | 'cars' | 'people' | 'birds' | 'clouds' | 'trees' | 'labels' | 'eggs'
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
  const px = document.getElementById('pixel') as HTMLInputElement
  px.addEventListener('input', () => {
    document.getElementById('pixel-v')!.textContent = px.value
    h.pixel(+px.value)
  })
  document.querySelectorAll<HTMLInputElement>('input[data-opt]').forEach((i) => i.addEventListener('change', () => h.look(i.dataset.opt as LookOpt, i.checked)))
  document.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((i) => i.addEventListener('change', () => h.layer(i.dataset.layer as Layer, i.checked)))

  const drawer = document.getElementById('drawer')!
  const btn = document.getElementById('btn-settings')!
  btn.addEventListener('click', () => {
    drawer.hidden = !drawer.hidden
    btn.setAttribute('aria-expanded', String(!drawer.hidden))
  })
  const card = document.getElementById('info')!
  const fold = card.querySelector<HTMLButtonElement>('.fold')!
  fold.addEventListener('click', () => {
    fold.textContent = card.classList.toggle('folded') ? '+' : '–'
  })
}

// Oś czasu jako linijka: epoki rozłożone równo, aktywna zaznaczona czerwonym rombem.
export function initTimeline(epochs: Epoch[], onPick: (e: Epoch) => void) {
  const nav = document.getElementById('timeline')!
  const rail = document.createElement('div')
  rail.className = 'rail'
  rail.style.minWidth = `${epochs.length * 84}px`
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
  document.getElementById('compass')!.style.setProperty('--rot', `${azimuth}rad`)
}

export function showEpoch(e: Epoch) {
  document.getElementById('info-city')!.textContent = e.city
  document.getElementById('info-year')!.textContent = String(e.year)
  document.getElementById('info-label')!.textContent = e.label
  document.getElementById('info-state')!.textContent = e.state
  document.getElementById('info-text')!.textContent = e.text
  document.getElementById('info-flag')!.className = `flag flag-${e.flag}`
}

export function setClock(d: Date) {
  document.getElementById('info-clock')!.textContent = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}

export function setDwarfCount(found: number, total: number) {
  const el = document.getElementById('dwarf-found')!
  if (el.textContent !== String(found) && el.textContent !== '0') {
    const badge = el.parentElement!
    badge.classList.remove('pop')
    void badge.offsetWidth
    badge.classList.add('pop')
  }
  el.textContent = String(found)
  document.getElementById('dwarf-total')!.textContent = String(total)
}
