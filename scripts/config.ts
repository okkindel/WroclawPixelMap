// south, west, north, east: od Kozanowa po Swojczyce, od Krzyków po Karłowice
// (Stare Miasto, Nadodrze, Ołbin, Biskupin, Sępolno, Dąbie, Zalesie, Szczepin, Gajowice).
export const BBOX = [51.075, 16.96, 51.15, 17.14] as const
// Pobieranie z Overpass w kawałkach (siatka zapytań), żeby uniknąć limitów czasu.
export const FETCH_GRID = [3, 4] as const // [wiersze, kolumny]
// Bok kafla w metrach (dane i siatki w przeglądarce dzielone są na kafle).
export const TILE = 1000
