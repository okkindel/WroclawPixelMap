// Tryb oszczędny: gdy przez kilka sekund rysujemy za wolno, kolejno obniżamy jakość (progi: src/rules/render.ts).
import { SAVER_MIN_FPS as MIN_FPS, SAVER_WINDOW_S as WINDOW_S } from '../rules/render.ts'

export class PowerSaver {
  private acc = 0
  private frames = 0
  private step = 0
  // kolejne stopnie; stopień zwraca false, gdy nie da się go zastosować (wtedy zostajemy na nim)
  private steps: (() => boolean)[]

  constructor(steps: (() => boolean)[]) {
    this.steps = steps
  }

  tick(dt: number) {
    this.acc += dt
    this.frames++
    if (this.acc < WINDOW_S) return
    const fps = this.frames / this.acc
    this.acc = this.frames = 0
    if (fps >= MIN_FPS || document.hidden) return
    const step = this.steps[this.step]
    if (step?.()) this.step++
  }
}
