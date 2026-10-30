// Lata, od których coś istnieje na mapie (warstwy i obiekty zależne od epoki).
export const SINCE = {
  railway: 1842, // kolej dotarła do Wrocławia
  trams: 1877, // tramwaj konny
  cars: 1925,
  stadium: 1928, // otwarcie Stadionu Olimpijskiego (trybuny)
  speedway: 1988, // easter egg: bieg żużlowy na Olimpijskim
  dwarfs: 2001, // pierwszy krasnal
  // od tego roku epoka „dziś” wygląda jak współczesne dane (bez filtrowania budynków)
  today: 2020,
} as const
