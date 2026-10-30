// Neony i napisy miejskie Wrocławia. Położenie sprawdzone w Nominatim i dopasowane do obrysów budynków z kafli
// (h = wysokość dachu/miejsca na elewacji, az = kierunek, w który patrzy lico napisu: 0 = N, 90 = E).
// Kolory neonów z Galerii Neon Side są umowne (źródła ich nie podają), lata bez źródła — przybliżone.

export type Txt = { pl: string; en: string }

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
}

const RUSKA = 'https://www.wroclaw.pl/dla-mieszkanca/nowe-neony-w-galerii-neon-side-w-podworku-przy-ulicy-ruskiej-46-wroclaw'
const RUSKA2 = 'https://www.wroclaw.pl/dla-mieszkanca/galeria-neonow-poznaj-wroclaw'
const RUSKA3 = 'https://www.wroclaw.pl/dla-mieszkanca/wroclawska-galeria-neonow-neon-side-znow-swieci'

// Neon z Galerii Neon Side (podwórko przy ul. Ruskiej 46c, od 14.11.2014): ściany zachodnia, wschodnia i południowa.
function ruska(id: string, text: string, color: string, wall: 'W' | 'E' | 'S', lat: number, lon: number, h: number, span: number, from: number, origin: Txt, source = RUSKA, flicker = 1): NeonSpec {
  return {
    id, lines: [text], color, kind: 'wall', lat, lon, h, az: { W: 113.2, E: 293.2, S: 21.8 }[wall], letter: 1.5, span, from, flicker,
    title: { pl: `Neon „${text}”`, en: `“${text}” neon` },
    text: {
      pl: `${origin.pl} Dziś świeci w Galerii Neon Side na podwórku przy ul. Ruskiej 46c, gdzie w PRL działała wytwórnia neonów „Reklama”.`,
      en: `${origin.en} Today it glows in the Neon Side Gallery in the courtyard at 46c Ruska Street, where the “Reklama” neon workshop operated in communist times.`,
    },
    source,
  }
}

export const NEONS: NeonSpec[] = [
  {
    id: 'dobry-wieczor', lines: ['Dobry wieczór', 'we Wrocławiu'], color: '#5dff8a', font: 'script', sprite: 'gent', kind: 'roof', free: true,
    lat: 51.099729, lon: 17.037852, h: 20.7, az: 199.4, letter: 2.5, span: 60, from: 1962, flicker: 2,
    title: { pl: 'Dobry wieczór we Wrocławiu', en: 'Good Evening in Wrocław' },
    text: {
      pl: 'Najsłynniejszy neon miasta (1962, proj. Janusz Tarantowicz): zielony napis i pan uchylający kapelusza, z kwiatkiem w dłoni. Stoi na dachu bloku przy ul. Piłsudskiego 110–116, naprzeciw Dworca Głównego; w 2024 r. dostał nowe szklane rurki.',
      en: 'The city’s most famous neon (1962, designed by Janusz Tarantowicz): green lettering and a gentleman tipping his hat, flower in hand. It stands on the roof of a block at 110–116 Piłsudskiego Street, opposite the main station; its glass tubes were remade in 2024.',
    },
    source: 'https://www.wroclaw.pl/dla-mieszkanca/neon-dobry-wieczor-we-wroclawiu-zdjety-z-dachu-bedzie-kopia',
  },
  {
    // wolnostojące litery wzdłuż długiej elewacji bloku KDM od strony ul. Świdnickiej (naprzeciw Renomy),
    // tuż przed licem elewacji, dolna krawędź nad okapem (ok. 12 m; kalenica 17.5 m)
    id: 'pzu', lines: ['Ubezpiecz mieszkanie w PZU'], color: '#5f8fe8', accent: ['PZU', '#eef6ff'], day: '#3a6fc4', thief: true, free: true, kind: 'roof',
    lat: 51.103682, lon: 17.030285, h: 13, az: 106.6, letter: 3, span: 43, from: 1975, flicker: 1,
    title: { pl: 'Złodziej z PZU', en: 'The PZU burglar' },
    text: {
      pl: '„Ubezpiecz mieszkanie w PZU” na dachu bloku KDM przy pl. Kościuszki (1975, proj. Jerzy Werszler): złodziej skrada się w czterech krokach, zapala się czerwone „PZU” i rabuś ucieka. Odnowiony w 2008 i 2020 r.',
      en: '“Insure your flat with PZU” on the roof of a KDM block on Kościuszki Square (1975, designed by Jerzy Werszler): a burglar creeps in four steps, a red “PZU” lights up and he runs away. Renovated in 2008 and 2020.',
    },
    source: 'https://archiwum.wroclife.pl/nasze-miasto/neon-plac-kosciuszki/',
  },
  {
    id: 'wroclaw-glowny', lines: ['WROCŁAW GŁÓWNY'], color: '#ff3b3b', kind: 'wall',
    lat: 51.098969, lon: 17.036027, h: 7.5, az: 11.3, letter: 1.8, span: 40, from: 1970,
    title: { pl: 'Wrocław Główny', en: 'Wrocław Główny' },
    text: {
      pl: 'Czerwony napis nad wejściem do dworca od ul. Piłsudskiego (jeden z kilkunastu neonów dworca z lat 70.). Oryginał trafił do Galerii Neon Side, na gmachu wisi kopia.',
      en: 'Red lettering above the station entrance on Piłsudskiego Street (one of a dozen station neons from the 1970s). The original went to the Neon Side Gallery; a replica hangs on the building.',
    },
    source: RUSKA3,
  },
  {
    id: 'zoo', lines: ['ZOO'], color: '#ffd23c', bg: '#1f7a3a', sprite: 'lion', kind: 'gate',
    lat: 51.105688, lon: 17.075771, h: 5, az: 28, letter: 2.5, span: 12, from: 1962,
    title: { pl: 'Lew nad bramą ZOO', en: 'The zoo gate lion' },
    text: {
      pl: 'Złoty lew na zielonym tle i napis „ZOO” nad wejściem do ogrodu zoologicznego przy ul. Wróblewskiego (lata 60., proj. Stanisław Chronowski). W 2015 r. burza strąciła lwa na bruk — wrócił po naprawie.',
      en: 'A golden lion on a green field and the word “ZOO” above the zoo entrance on Wróblewskiego Street (1960s, designed by Stanisław Chronowski). A storm knocked the lion down in 2015; it returned after repairs.',
    },
    source: 'https://tvn24.pl/wroclaw/burza-zniszczyla-neon-wroclawskiego-zoo-ra561702-ls3307575',
  },
  {
    id: 'barbara', lines: ['BARBARA'], color: '#ff5fb8', colors: ['#ff5fb8', '#5fd7ff', '#ffd23c', '#7dff6a', '#ff7a3c', '#c58bff', '#ff3b3b'], kind: 'wall',
    lat: 51.10777, lon: 17.032911, h: 3.8, az: 105.6, letter: 1.5, span: 18, from: 2015, flicker: 1,
    title: { pl: 'Barbara', en: 'Barbara' },
    text: {
      pl: 'Neon nad dawnym barem „Barbara” przy ul. Świdnickiej 8b, otwartym na nowo w 2015 r. jako punkt Europejskiej Stolicy Kultury. Każda litera nawiązuje do innego starego wrocławskiego neonu.',
      en: 'The sign above the former “Barbara” bar at 8b Świdnicka Street, reopened in 2015 as a European Capital of Culture venue. Every letter is inspired by a different old Wrocław neon.',
    },
    source: 'https://www.wroclaw.pl/en/barbara-bar-opens-on-june-1214-weekend',
  },
  {
    id: 'sto-mostow', lines: ['Wrocław. Sto mostów –', 'milion uśmiechów'], color: '#ffffff', accent: ['uśmiechów', '#ffd23c'], kind: 'roof',
    lat: 51.104143, lon: 17.004472, h: 21.7, az: 252.5, letter: 1.6, span: 60, from: 2018,
    title: { pl: 'Sto mostów – milion uśmiechów', en: 'A hundred bridges, a million smiles' },
    text: {
      pl: 'Neon na budynku osiedla przy ul. Tęczowej 103 (2018), widoczny z pociągów jadących w stronę Poznania. Hasło wybrano w konkursie z ASP i fundacją Neon Side spośród ponad 1600 propozycji.',
      en: 'A neon on an apartment building at 103 Tęczowa Street (2018), visible from trains heading towards Poznań. The slogan was picked from over 1,600 entries in a contest run with the Academy of Fine Arts and the Neon Side foundation.',
    },
    source: 'https://www.wroclaw.pl/przedsiebiorczy-wroclaw/nowy-neon-we-wroclawiu-przy-ul-teczowej',
  },
  {
    id: 'neon-side', lines: ['GALERIA NEON SIDE'], color: '#ff4fd8', kind: 'wall',
    lat: 51.109964, lon: 17.024547, h: 15, az: 293.2, letter: 1.5, span: 21, from: 2014,
    title: { pl: 'Galeria Neon Side', en: 'Neon Side Gallery' },
    text: {
      pl: 'Podwórko przy ul. Ruskiej 46c, gdzie fundacja Neon Side od 14 listopada 2014 r. wiesza uratowane przed złomowaniem neony z lat 60. i 70. Miasto wynajęło je do 2034 r.',
      en: 'The courtyard at 46c Ruska Street where, since 14 November 2014, the Neon Side foundation has hung 1960s–70s neons saved from the scrapyard. The city has leased them until 2034.',
    },
    source: RUSKA3,
  },
  ruska('ns-glowny', 'WROCŁAW GŁÓWNY', '#ff3b3b', 'E', 51.109964, 17.024547, 9, 21, 2014, { pl: 'Oryginalny czerwony napis znad wejścia do Dworca Głównego, zdjęty przy remoncie dworca.', en: 'The original red sign from above the main station entrance, taken down during the station’s renovation.' }, RUSKA2, 0),
  ruska('ns-hanka', 'HANKA', '#ff5fb8', 'W', 51.110062, 17.024413, 3, 7, 2015, { pl: 'Szyld sklepu Społem z ul. Powstańców Śląskich.', en: 'The sign of a Społem shop on Powstańców Śląskich Street.' }),
  ruska('ns-rumcajs', 'RUMCAJS', '#ffd23c', 'W', 51.11, 17.024371, 3, 7, 2014, { pl: 'Neon jednego z dawnych wrocławskich sklepów.', en: 'The neon of an old Wrocław shop.' }, RUSKA3),
  ruska('ns-kwiaty', 'KWIATY', '#7dff6a', 'W', 51.110062, 17.024413, 6, 7, 2014, { pl: 'Szyld kwiaciarni z ul. Wróblewskiego na Biskupinie.', en: 'A florist’s sign from Wróblewskiego Street in Biskupin.' }, RUSKA2),
  ruska('ns-obuwie', 'OBUWIE', '#5fd7ff', 'W', 51.11, 17.024371, 6, 7, 2015, { pl: 'Szyld sklepu obuwniczego z ul. Kościuszki.', en: 'A shoe shop sign from Kościuszki Street.' }),
  ruska('ns-warszawa', 'KINO WARSZAWA', '#ff3b3b', 'E', 51.109914, 17.024514, 3, 11, 2015, { pl: 'Neon kina „Warszawa” przy ul. Piłsudskiego (działało od 1945 r., dziś Dolnośląskie Centrum Filmowe).', en: 'The neon of the “Warszawa” cinema on Piłsudskiego Street (open from 1945, now the Lower Silesian Film Centre).' }),
  ruska('ns-dom-handlowy', 'DOM HANDLOWY', '#5fd7ff', 'E', 51.110013, 17.024581, 3, 11, 2019, { pl: 'Szyld domu handlowego, odnowiony w 2019 r.', en: 'A department store sign, restored in 2019.' }, RUSKA3),
  ruska('ns-spozywczy', 'SPOŻYWCZY', '#7dff6a', 'E', 51.109914, 17.024514, 6, 11, 2015, { pl: 'Szyld sklepu spożywczego z ul. Spółdzielczej.', en: 'A grocery sign from Spółdzielcza Street.' }),
  ruska('ns-cuprum', 'CUPRUM', '#ff7a3c', 'E', 51.110013, 17.024581, 6, 11, 2015, { pl: 'Neon z wyburzonego biurowca Cuprum przy pl. Jana Pawła II.', en: 'The neon from the demolished Cuprum office building on John Paul II Square.' }),
  ruska('ns-elam', 'ELAM', '#a8dcff', 'E', 51.109964, 17.024547, 12, 21, 2015, { pl: 'Neon zakładów automatyki Elam z ul. Chorwackiej, wiszący tam bardzo wysoko.', en: 'The sign of the Elam automation works on Chorwacka Street, once mounted very high up.' }),
  ruska('ns-tricot', 'TRICOT', '#c58bff', 'S', 51.109888, 17.024417, 3, 10, 2015, { pl: 'Szyld z ul. Inowrocławskiej.', en: 'A sign from Inowrocławska Street.' }),
  ruska('ns-moda-polska', 'MODA POLSKA', '#ff5fb8', 'S', 51.109888, 17.024417, 6, 10, 2014, { pl: 'Neon dawnego salonu firmowego Mody Polskiej w Rynku — walka o jego ocalenie dała początek ruchowi ratowania neonów.', en: 'The neon of the former Moda Polska salon on the Market Square; the fight to save it sparked the city’s neon rescue movement.' }, 'https://www.wroclaw.pl/wroclawmiasto-neonow1'),
  ruska('ns-grand', 'GRAND HOTEL', '#ffd23c', 'S', 51.109888, 17.024417, 9, 10, 2014, { pl: 'Neon hotelu Grand przy ul. Piłsudskiego, zamkniętego w 2000 r.', en: 'The neon of the Grand Hotel on Piłsudskiego Street, closed in 2000.' }, 'https://www.pap.pl/aktualnosci/kultowe-wroclawskie-neony-ida-do-remontu-maja-powrocic-w-marcu-2025-roku'),
]
