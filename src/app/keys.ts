// Skróty klawiszowe: H chowa interfejs, Q/E obracają mapę, kod Konami uruchamia easter egga.
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

export function initKeys(h: { rotate: (dir: -1 | 1) => void; konami: () => void }) {
  let keys: string[] = []
  addEventListener('keydown', (ev) => {
    if (ev.target instanceof HTMLElement && ev.target.tagName === 'INPUT') return
    keys = [...keys, ev.key].slice(-KONAMI.length)
    if (keys.join() === KONAMI.join()) {
      h.konami()
      keys = []
    }
    if (ev.key === 'h' || ev.key === 'H') document.body.classList.toggle('hide-ui')
    if (ev.key === 'q') h.rotate(-1)
    if (ev.key === 'e') h.rotate(1)
  })
}
