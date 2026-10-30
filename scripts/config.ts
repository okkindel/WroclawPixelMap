// south, west, north, east: od Pilczyc i Tarczyński Areny po Swojczyce, od Krzyków po Karłowice
// (Stare Miasto, Nadodrze, Ołbin, Biskupin, Sępolno, Dąbie, Zalesie, Szczepin, Gajowice).
// Punkt odniesienia współrzędnych lokalnych (metry) — stały, niezależny od BBOX, żeby poszerzanie mapy
// nie przesuwało wcześniej policzonych danych (zdjęcia dachów, rozkłady, pomniki, plany historyczne).
export const ORIGIN = [51.1125, 17.05] as const
// Zachodnia granica przesunięta o równe 3 kafle (3000 m) względem pierwotnej (16.96), żeby siatka kafli się nie zmieniła.
export const BBOX = [51.075, 16.9170734, 51.15, 17.14] as const
// Pobieranie z Overpass w kawałkach (siatka zapytań), żeby uniknąć limitów czasu.
export const FETCH_GRID = [3, 4] as const // [wiersze, kolumny]
// Bok kafla w metrach (dane i siatki w przeglądarce dzielone są na kafle).
export const TILE = 1000
