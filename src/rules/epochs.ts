// Heurystyki epok: które budynki bez daty budowy pokazać w dawnych latach.
// OSM zna rok budowy tylko części budynków (ok. 2 tys. z 82 tys.), resztę zgadujemy z bryły.
import { signedArea } from '../engine/geo.ts'
import type { Building } from '../types/world.ts'
import { SINCE } from './milestones.ts'

// Lokacja miasta (1242): wcześniej jest tylko gród na Ostrowie Tumskim.
export const LOCATION_YEAR = 1242
// Gród na Ostrowie Tumskim (ok. 1000 r.): wał drewniano-ziemny z palisadą wokół zachodniej części wyspy,
// od kościoła św. Marcina (kaplica książęca) po katedrę Chrobrego (bazylika ok. 33,5 × 18 m, wieże od wschodu).
// Układ w metrach względem punktu `at` (x = wschód, y = północ). Obwód odrysowany z dzisiejszych brzegów Odry
// (zachodnia odnoga przy Moście Tumskim, Odra Południowa) z marginesem ok. 12 m; od północy i wschodu
// wyspę oblewała odnoga zasypana po 1807 r. (jej śladem jest staw w Ogrodzie Botanicznym).
type XY = [number, number]
export const GROD: { at: XY; ring: XY[]; cathedral: XY; martin: XY; palatium: XY; square: XY; roads: XY[][]; huts: number } = {
  at: [51.1148, 17.044],
  // pierwszy punkt = brama od strony Mostu Tumskiego (szlak z Piasku)
  ring: [
    [-84, -12],
    [-68, -60],
    [-48, -98],
    [0, -134],
    [80, -166],
    [160, -188],
    [238, -206],
    [285, -150],
    [280, -40],
    [250, 60],
    [170, 95],
    [90, 128],
    [-40, 130],
    [-122, 110],
    [-118, 60],
    [-96, 22],
  ],
  cathedral: [185, -70],
  martin: [-84, 78],
  palatium: [-25, 92],
  square: [60, -20],
  // drogi: od bramy przez placyk pod katedrę i do palatium
  roads: [
    [
      [-84, -12],
      [-40, -16],
      [60, -20],
      [120, -48],
      [166, -68],
    ],
    [
      [60, -20],
      [20, 40],
      [-25, 82],
    ],
  ],
  huts: 70,
}
// Po lokacji wał grodu jeszcze stoi (z resztkami palisady), potem znika pod zabudową.
export const GROD_RAMPART_UNTIL = 1300
// W murach (średniowiecze / twierdza): bez daty zostają kościoły i bryły niższe niż tyle metrów
// (wyższe to kamienice z XIX w. i bloki).
export const WALLED_MAX_H = { medieval: 18, fortress: 24 } as const
// Poza murami bez daty zostają tylko kościoły w tym promieniu od katedry: Ostrów Tumski i Piasek (NMP na Piasku 354 m);
// dalej, np. na Ołbinie, stoją kościoły z XIX i XX w.
export const CATHEDRAL_RADIUS = 400

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
  if (Y >= 2000) return false
  const glass = b.bm === 'glass' || b.bm === 'mirror'
  const area = Math.abs(signedArea(b.o))
  return glass || (b.k === 'com' && (b.H > 20 || area > 4000))
}
