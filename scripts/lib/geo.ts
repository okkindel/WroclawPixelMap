// Rzutowanie lat/lon ↔ lokalne metry projektu (x = wschód, y = północ), liniowe wokół punktu odniesienia.
// To samo co toLocal/toLatLon w src/engine/geo.ts; tu dodatkowo wersja zaokrąglona do 0.1 m do zapisu danych.
import { ORIGIN } from './config.ts'

export type Pt = [number, number]

export const r1 = (v: number) => Math.round(v * 10) / 10
export const r2 = (v: number) => Math.round(v * 100) / 100

export function projection(origin: readonly [number, number] = ORIGIN) {
  const [lat0, lon0] = origin
  const KX = Math.cos((lat0 * Math.PI) / 180) * 111320
  const KY = 110540
  return {
    KX,
    KY,
    // zaokrąglone do 0.1 m (zapis danych)
    proj: (lat: number, lon: number): Pt => [r1((lon - lon0) * KX), r1((lat - lat0) * KY)],
    // dokładne (np. dalsze obliczenia przed zaokrągleniem)
    local: (lat: number, lon: number): Pt => [(lon - lon0) * KX, (lat - lat0) * KY],
    // odwrotnie: metry lokalne → [lat, lon]
    toLatLon: (x: number, y: number): Pt => [y / KY + lat0, x / KX + lon0],
  }
}
