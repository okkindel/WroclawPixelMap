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

// Historyczne plany miasta pod dawnymi epokami (public/data/history, scripts/bake/bake-plans.py). Każda epoka do 1950 r.
// ma swój plan; w jego zasięgu ulice i zabudowa są z planu, wokół łąka. Woda epoki jest odtworzona z planów najbliższych
// w czasie, dzisiejsze rzeki tylko tam, gdzie nie sięga żaden plan.
// buildings: maska zabudowy planu decyduje, które budynki stoją (false: tylko podkład, budynki według reguł epoki).
export const HISTORY_PLANS = [
  // przed lokacją: tylko woda odtworzona z najstarszych planów (bez podkładu i bez maski zabudowy)
  { id: 'early', from: 0, to: 1241, buildings: false },
  { id: '1732', from: 1242, to: 1807, buildings: true }, // plan twierdzy, Stare Miasto z przedmieściami (SLUB, CC BY-SA)
  { id: '1895', from: 1850, to: 1909, buildings: true }, // Neuer Plan der Stadt Breslau
  { id: 'pharus1914', from: 1910, to: 1944, buildings: true }, // Pharus-Plan Breslau 1901–1914
  // Plan m. Wrocławia, 6 V 1947. Pod Festung 1945 tylko podkład (ulice, woda): zabudowa z 1947 r. to już miasto po
  // zniszczeniach, więc budynki 1945 r. zostają według reguł epoki.
  { id: 'plan1947', from: 1945, to: 1945, buildings: false },
  { id: 'plan1947', from: 1946, to: 1950, buildings: true },
] as const
export type HistoryPlan = (typeof HISTORY_PLANS)[number]
export const historyPlanFor = (year: number) => HISTORY_PLANS.find((p) => year >= p.from && year <= p.to) ?? null
