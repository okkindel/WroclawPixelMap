// Typowane czytanie plików JSON (jedyne miejsce rzutowania wyniku JSON.parse w skryptach).
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { WorldMeta } from '../../src/types/world.ts'

// Typ T to umowa z plikiem (nie jest sprawdzany w czasie działania).
export function parseJson<T>(text: string): T {
  return JSON.parse(text) as T
}

export const readJson = async <T>(path: string): Promise<T> => parseJson<T>(await readFile(path, 'utf8'))
export const readJsonSync = <T>(path: string): T => parseJson<T>(readFileSync(path, 'utf8'))

// Opis świata z ostatniego `npm run bake` (kafle, granice, punkt odniesienia).
export const readMeta = () => readJson<WorldMeta>('public/data/meta.json')

// Komunikat błędu z dowolnej wartości rzuconej w catch.
export const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))
