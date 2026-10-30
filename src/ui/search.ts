// Wyszukiwarka: ulice i budynki z OSM, zabytki, krasnale. Dopasowanie bez polskich znaków.
import { byId } from './dom.ts'

export interface SearchItem {
  name: string
  kind: string
  x: number
  y: number
  onPick?: () => void
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

export function initSearch(items: SearchItem[], fly: (x: number, y: number) => void) {
  const input = byId<HTMLInputElement>('search-input')
  const list = byId('search-results')
  const indexed = items.map((it) => ({ it, key: norm(it.name) }))
  let shown: SearchItem[] = []
  let sel = 0

  const pick = (it: SearchItem) => {
    fly(it.x, it.y)
    it.onPick?.()
    input.value = it.name
    list.innerHTML = ''
    input.blur()
  }

  const render = () => {
    list.innerHTML = ''
    shown.forEach((it, i) => {
      const li = document.createElement('li')
      li.className = i === sel ? 'sel' : ''
      li.innerHTML = `<span></span><small></small>`
      li.children[0].textContent = it.name
      li.children[1].textContent = it.kind
      li.onclick = () => pick(it)
      list.appendChild(li)
    })
  }

  input.addEventListener('input', () => {
    const q = norm(input.value.trim())
    sel = 0
    if (q.length < 2) {
      shown = []
      render()
      return
    }
    shown = indexed
      .filter((e) => e.key.includes(q))
      .sort((a, b) => Number(!a.key.startsWith(q)) - Number(!b.key.startsWith(q)) || a.key.length - b.key.length)
      .slice(0, 12)
      .map((e) => e.it)
    render()
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      sel = Math.min(sel + 1, shown.length - 1)
      render()
      e.preventDefault()
    }
    if (e.key === 'ArrowUp') {
      sel = Math.max(sel - 1, 0)
      render()
      e.preventDefault()
    }
    if (e.key === 'Enter' && shown[sel]) pick(shown[sel])
  })
}
