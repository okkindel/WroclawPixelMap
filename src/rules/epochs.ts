// Heurystyki epok: które budynki bez daty budowy pokazać w dawnych latach.
// OSM zna rok budowy tylko części budynków (ok. 2 tys. z 82 tys.), resztę zgadujemy z bryły.
import { signedArea } from '../engine/geo.ts'
import type { Building } from '../types/world.ts'
import { SINCE } from './milestones.ts'

// Lokacja miasta (1242): wcześniej jest tylko gród na Ostrowie Tumskim.
export const LOCATION_YEAR = 1242
// W grodzie zostają tylko miejsca pierwszych świątyń (katedra, św. Marcin); reszta przyszła później.
export const GROD_CHURCHES = /Archikatedra|Marcina/
// W murach (średniowiecze / twierdza): bez daty zostają kościoły i bryły niższe niż tyle metrów
// (wyższe to kamienice z XIX w. i bloki).
export const WALLED_MAX_H = { medieval: 18, fortress: 24 } as const
// Poza murami bez daty zostają tylko kościoły w tym promieniu od katedry (Ostrów Tumski, Piasek).
export const CATHEDRAL_RADIUS = 900

// Przed wojną: przybliżony zasięg zabudowy wokół Rynku [m] (rozrost miasta w XIX w. i na początku XX w.).
export const prewarRadius = (Y: number) => (Y < 1850 ? 1300 : Y < 1905 ? 2600 : 3200)
// Na Starym Mieście kamienice często nie mają tagu dachu: chowamy tylko wyraźnie wysokie bryły.
export const OLD_TOWN_MAX_H = 28

// Dachy typowe dla zabudowy sprzed 1945 r.
const OLD_ROOFS = new Set(['gabled', 'hipped', 'half-hipped', 'mansard', 'gambrel', 'pyramidal', 'dome', 'onion'])

// Bez daty w OSM zgadujemy: płaski dach i wysokość jak blok/biurowiec, albo handel = po 1945.
export function looksPostwar(b: Building) {
  if (b.k === 'church') return false
  // przedwojenny Wrocław nie miał wysokościowców (poza wieżami kościołów)
  if (b.H > 35) return true
  if (b.rs && OLD_ROOFS.has(b.rs)) return false
  return b.H > 17 || b.k === 'com' || (b.k === 'res' && b.H > 12)
}

// Po wojnie, budynki bez daty: szkło i lustra, biurowce i duże galerie handlowe to w Polsce głównie
// lata 90. i później; ponad 100 m — dopiero XXI w. (Sky Tower 2012). Komin to wyjątek (elektrociepłownie).
export function looksLaterThan(b: Building, Y: number) {
  if (Y >= SINCE.today) return false
  if (b.H > 100 && b.k !== 'chimney') return Y < 2010
  if (Y >= 1995) return false
  const glass = b.bm === 'glass' || b.bm === 'mirror'
  const area = Math.abs(signedArea(b.o))
  return glass || (b.k === 'com' && (b.H > 20 || area > 4000))
}
