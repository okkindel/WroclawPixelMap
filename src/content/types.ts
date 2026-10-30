// Typy treści z katalogu content/ (epoki, obiekty, fortyfikacje, easter eggi, ciekawostki, neony, krasnale).
// Pliki JSON trzymają oba języki obok siebie: dane wspólne raz, teksty w polach `pl` i `en`.

export type Flag = 'pl' | 'cz' | 'hab' | 'pru' | 'de' | 'prl'
export type EpochMode = 'today' | 'walls' | 'festung' | 'flood' | 'medieval'
export type Txt = { pl: string; en: string }

export interface Epoch {
  id: string
  year: number
  label: string
  state: string
  city: string
  flag: Flag
  mode: EpochMode
  text: string
}

// Współrzędne obiektów w większości z OpenStreetMap (data/raw/world.json, centroidy budynków).
export interface Landmark {
  name: string
  lat: number
  lon: number
  year: string
  text: string
}

export interface Egg {
  id: string
  lat: number
  lon: number
  title: string
  text: string
  trigger: 'click' | 'konami' | 'zoom' | 'time'
}

// Fortyfikacje ok. 1800, przebieg fosy/murów wyprowadzony z geometrii "Fosa Miejska" i ulic w OSM.
// outer: nowożytna linia wałów wzdłuż wewnętrznego brzegu Fosy Miejskiej
//        (od Odry na zachodzie, łukiem na południe, do Bastionu Ceglarskiego nad Odrą na wschodzie);
//        odcinek od wschodniego końca fosy do Wzgórza Polskiego przybliżony (fosa tam zasypana).
// inner: pierwszy (XIII-wieczny) pas murów — Nowy Świat, ul. Kazimierza Wielkiego (dawna Czarna Oława),
//        wschodni bok przy ul. św. Katarzyny / Baszcie Niedźwiadka, północny wzdłuż Odry (ul. Grodzka).
//        Przebieg przybliżony.
export interface Walls {
  inner: [number, number][]
  outer: [number, number][]
  bastions: { lat: number; lon: number; name: string }[]
}

// Ciekawostki o miejscach: pochodzenie nazw, obiekty, których już nie ma, „było — jest”,
// a także uczelnie (category: 'uczelnia') i kultowe miejsca życia miejskiego (category: 'kultowe').
// Każda pozycja ma w polu `source` adres źródła, które potwierdza opisany fakt.
// Współrzędne sprawdzone w OpenStreetMap (Nominatim / dane z data/raw).
export type TriviaCategory = 'miejsce' | 'uczelnia' | 'kultowe'

export interface Trivia extends Egg {
  category: TriviaCategory
  source: string
}

// Neony i napisy miejskie Wrocławia. Położenie sprawdzone w Nominatim i dopasowane do obrysów budynków z kafli
// (h = wysokość dachu/miejsca na elewacji, az = kierunek, w który patrzy lico napisu: 0 = N, 90 = E).
// Kolory neonów z Galerii Neon Side są umowne (źródła ich nie podają), lata bez źródła — przybliżone.
export interface NeonSpec {
  id: string
  lines: string[]
  color: string // kolor świecenia
  colors?: string[] // kolory kolejnych liter (cyklicznie)
  accent?: [string, string] // fragment napisu w innym kolorze: [tekst, kolor]
  font?: 'block' | 'script'
  bg?: string // tło tablicy
  sprite?: 'gent' | 'lion' // obrazek z lewej strony napisu
  thief?: true // cztery sylwetki złodzieja na prawo od napisu (animacja PZU), wyróżnienie większą czcionką
  free?: true // litery wolnostojące: bez tablicy i stelaża, tylko cienkie pręty
  day?: string // kolor liter za dnia (np. niebieska blacha), inaczej przygaszony kolor nocny
  kind: 'roof' | 'wall' | 'gate'
  lat: number
  lon: number
  h: number // wysokość dolnej krawędzi [m]
  az: number
  letter: number // wysokość wiersza [m]
  span: number // długość krawędzi dachu/elewacji [m] — dłuższy napis dostaje mniejsze litery
  from: number
  to?: number
  flicker?: number // ile liter migocze jak zużyta rura
  title: Txt
  text: Txt
  source: string
  img?: string // zdjęcie z Wikimedia Commons
  credit?: string // autor i licencja zdjęcia
}

// Kształt rekordów w plikach JSON.
type Loc<T> = { pl: T; en: T }

export type EpochEntry = Omit<Epoch, 'label' | 'state' | 'text'> & Loc<Pick<Epoch, 'label' | 'state' | 'text'>>

// `year` wspólny dla obu języków albo osobno w `pl`/`en`; `rank`: napis widoczny z daleka (1) lub przy średnim przybliżeniu (2).
export type LandmarkEntry = { id: string; lat: number; lon: number; year?: string; rank?: 1 | 2 } & Loc<{ name: string; year?: string; text: string }>

export type EggEntry = Omit<Egg, 'title' | 'text'> & Loc<Pick<Egg, 'title' | 'text'>>

export type TriviaEntry = Omit<Trivia, 'title' | 'text'> & Loc<Pick<Trivia, 'title' | 'text'>>
