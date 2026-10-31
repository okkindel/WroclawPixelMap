// Lata, od których coś istnieje na mapie (warstwy i obiekty zależne od epoki).
export const SINCE = {
  railway: 1842, // kolej dotarła do Wrocławia
  trams: 1877, // tramwaj konny
  cars: 1925,
  stadium: 1928, // otwarcie Stadionu Olimpijskiego (trybuny)
  speedway: 1988, // easter egg: bieg żużlowy na Olimpijskim
  dwarfs: 2001, // pierwszy krasnal
  // kanały Żeglugowy i Powodziowy (od 1897), port miejski, zbiorniki: wcześniej tylko rzeki i starorzecza
  canals: 1897,
  arena: 2011, // Tarczyński Arena (mecz Śląska)
  gasLamps: 1850, // latarnie gazowe na Ostrowie Tumskim (gazownia miejska od 1847 r.)
  fireworks: 1990, // sylwester miejski na Rynku to współczesny zwyczaj
  // konstrukcje bez daty w OSM (maszty, wieże ciśnień, kominy) to epoka przemysłowa i później
  undatedStructures: 1850,
  // od tego roku epoka „dziś” wygląda jak współczesne dane (bez filtrowania budynków)
  today: 2020,
} as const

// Historyczne plany kładzione pod epoki, które przybliżają (public/data/history, scripts/bake/bake-history.ts),
// nad dzisiejszymi drogami i torami (do 0.32 m, src/world/ground.ts).
// paper: jasność, od której piksel planu jest przezroczysty (papier poza rysunkiem). Na planie z 1895 r. ulice są
// prawie tak jasne jak papier, więc przezroczysty jest tylko biały margines.
// meadow: poza planem łąka zamiast dzisiejszego terenu (plan z 1895 r. obejmuje całe ówczesne miasto); plan z 1732 r.
// pokazuje tylko Stare Miasto, więc wokół zostaje dzisiejsza mapa.
export const HISTORY_PLANS = [
  { id: '1732', from: 1242, to: 1807, paper: 0.86, meadow: false }, // plan twierdzy, Stare Miasto
  { id: '1895', from: 1850, to: 1945, paper: 0.97, meadow: true }, // Neuer Plan der Stadt Breslau, całe miasto z przedmieściami
] as const
export const historyPlanFor = (year: number) => HISTORY_PLANS.find((p) => year >= p.from && year <= p.to) ?? null
