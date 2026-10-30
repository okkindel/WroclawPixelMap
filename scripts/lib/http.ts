// Pobieranie z ponawianiem (serwery GUGiK, SLUB, Wikidane bywają przeciążone).
import { errMsg } from './json.ts'

export const UA = 'wroclaw-pixel-map/0.1'
export const UA_LONG = 'wroclaw-pixel-map/0.1 (https://github.com/okkindel/WroclawPixelMap)'

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Wywołuje fn do `attempts` razy; błąd (np. throw new Error(`HTTP ${status}`)) wypisuje z etykietą
// i czeka delay(próba) ms przed kolejną próbą. Po wyczerpaniu prób zwraca null.
export async function withRetry<T>(
  label: string,
  attempts: number,
  delay: (attempt: number) => number,
  fn: () => Promise<T>,
): Promise<T | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      console.log(`${label}: ${errMsg(err)}`)
    }
    await sleep(delay(attempt))
  }
  return null
}

// Odpowiedź jako bufor; `valid` odrzuca np. stronę błędu zamiast obrazka.
export async function fetchBuffer(url: string, valid: (buf: Buffer, res: Response) => boolean = (_, res) => res.ok): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  const buf = Buffer.from(await res.arrayBuffer())
  if (!valid(buf, res)) throw new Error(`HTTP ${res.status}`)
  return buf
}

export const isJpeg = (buf: Buffer) => buf[0] === 0xff && buf[1] === 0xd8
