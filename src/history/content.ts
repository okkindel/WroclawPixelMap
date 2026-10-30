// Wrocław Pixel Map — treści (epoki, obiekty, fortyfikacje, easter eggi, krasnale).
// Współrzędne obiektów w większości z OpenStreetMap (data/raw/world.json, centroidy budynków),
// przebieg fosy/murów wyprowadzony z geometrii "Fosa Miejska" i ulic w OSM.

export type Flag = 'pl' | 'cz' | 'hab' | 'pru' | 'de' | 'prl'
export type EpochMode = 'today' | 'walls' | 'festung' | 'flood' | 'medieval'

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

export interface Walls {
  inner: [number, number][]
  outer: [number, number][]
  bastions: { lat: number; lon: number; name: string }[]
}

// ---------------------------------------------------------------------------
// EPOKI
// ---------------------------------------------------------------------------

export const EPOCHS: Epoch[] = [
  {
    id: 'grod',
    year: 1000,
    label: 'Gród na Ostrowie',
    state: 'Polska (Piastowie)',
    city: 'Wrotizla',
    flag: 'pl',
    mode: 'medieval',
    text: 'Na zjeździe gnieźnieńskim w 1000 r. powstaje biskupstwo wrocławskie. Miasto to na razie drewniany gród na Ostrowie Tumskim, schowany między odnogami Odry — wyspa była najlepszym murem obronnym.',
  },
  {
    id: 'lokacja',
    year: 1242,
    label: 'Lokacja miasta',
    state: 'Polska (Piastowie, Księstwo Śląskie)',
    city: 'Wratislavia',
    flag: 'pl',
    mode: 'medieval',
    text: 'Po spaleniu osady podczas najazdu mongolskiego w 1241 r. miasto lokowano na prawie magdeburskim. Wytyczono Rynek i regularną szachownicę ulic, którą widać na mapie do dziś.',
  },
  {
    id: 'czechy',
    year: 1335,
    label: 'Pod koroną czeską',
    state: 'Korona Czeska (Luksemburgowie)',
    city: 'Vratislav',
    flag: 'cz',
    mode: 'medieval',
    text: 'Po śmierci księcia Henryka VI Dobrego w 1335 r. Wrocław przechodzi pod władzę króla Czech Jana Luksemburskiego. Kupieckie miasto bogaci się, należy do Hanzy, a ratusz i kościoły rosną w gotyckim tempie.',
  },
  {
    id: 'habsburgowie',
    year: 1526,
    label: 'Habsburgowie',
    state: 'Monarchia Habsburgów (Korona Czeska)',
    city: 'Breslau',
    flag: 'hab',
    mode: 'walls',
    text: 'Po bitwie pod Mohaczem czeską koronę, a z nią Wrocław, przejmują Habsburgowie. Miasto przyjmuje reformację, otacza się bastionami (Ceglarski powstał w 1585 r.), a w 1702 r. cesarz Leopold I zakłada tu uniwersytet.',
  },
  {
    id: 'prusy',
    year: 1741,
    label: 'Fryderyk Wielki',
    state: 'Królestwo Prus',
    city: 'Breslau',
    flag: 'pru',
    mode: 'walls',
    text: 'W styczniu 1741 r. wojska Fryderyka II zajmują Wrocław bez walki, a pokój wrocławski z 1742 r. oddaje niemal cały Śląsk Prusom. Zmienia się władca, mury zostają.',
  },
  {
    id: 'twierdza',
    year: 1800,
    label: 'Miasto-twierdza',
    state: 'Królestwo Prus',
    city: 'Breslau',
    flag: 'pru',
    mode: 'walls',
    text: 'Około 1800 r. Stare Miasto wciąż ściskają wały, bastiony i fosa, a do środka wchodzi się przez bramy. Za murami są już przedmieścia, ale centrum wygląda jeszcze jak z rycin.',
  },
  {
    id: 'napoleon',
    year: 1807,
    label: 'Napoleon i Promenada',
    state: 'Królestwo Prus (okupacja francuska)',
    city: 'Breslau',
    flag: 'pru',
    mode: 'today',
    text: 'Na początku 1807 r. miasto kapituluje przed wojskami napoleońskimi, a Hieronim Bonaparte każe zburzyć fortyfikacje. Z wałów zostają wzgórza widokowe, a wzdłuż fosy powstaje Promenada — najlepsza rzecz, jaką Wrocław dostał od okupanta.',
  },
  {
    id: 'industrial',
    year: 1900,
    label: 'Breslau przemysłowy',
    state: 'Cesarstwo Niemieckie (od 1871)',
    city: 'Breslau',
    flag: 'de',
    mode: 'today',
    text: 'Od 1871 r. Breslau leży w zjednoczonych Niemczech i jest jednym z największych miast kraju. Kolej (pierwsza linia już w 1842 r.), fabryki i kamienice rozpychają miasto daleko poza dawną fosę.',
  },
  {
    id: 'hala',
    year: 1913,
    label: 'Hala Stulecia',
    state: 'Cesarstwo Niemieckie',
    city: 'Breslau',
    flag: 'de',
    mode: 'today',
    text: 'Na stulecie wojen wyzwoleńczych z 1813 r. Max Berg stawia Halę Stulecia z żelbetową kopułą o rozpiętości 65 m. Wokół powstają Pergola i Pawilon Czterech Kopuł — wystawa, która przeszła do historii architektury.',
  },
  {
    id: 'festung',
    year: 1945,
    label: 'Festung Breslau',
    state: 'III Rzesza',
    city: 'Breslau',
    flag: 'de',
    mode: 'festung',
    text: 'Od lutego 1945 r. okrążone miasto broni się jako twierdza; by zbudować pas startowy, wyburzono zabudowę dzisiejszego pl. Grunwaldzkiego. Kapitulacja przychodzi dopiero 6 maja 1945 r., gdy miasto leży w gruzach.',
  },
  {
    id: 'powojnie',
    year: 1946,
    label: 'Wrocław z gruzów',
    state: 'Polska',
    city: 'Wrocław',
    flag: 'pl',
    mode: 'festung',
    text: 'Niemieckich mieszkańców wysiedlono, a do miasta przybywają Polacy, m.in. ze Lwowa — razem z nimi Ossolineum i Panorama Racławicka. Cegły z ruin jadą na odbudowę Warszawy, a w 1948 r. Wystawa Ziem Odzyskanych stawia Iglicę.',
  },
  {
    id: 'prl',
    year: 1988,
    label: 'Pomarańczowa Alternatywa',
    state: 'PRL',
    city: 'Wrocław',
    flag: 'prl',
    mode: 'today',
    text: 'Major Waldemar Fydrych i Pomarańczowa Alternatywa walczą z systemem absurdem: malują krasnale na zamalowanych hasłach i robią happeningi. 1 czerwca 1988 r. przez centrum przechodzi ponad 10 tys. ludzi w krasnalowych czapkach.',
  },
  {
    id: 'powodz',
    year: 1997,
    label: 'Powódź tysiąclecia',
    state: 'Polska',
    city: 'Wrocław',
    flag: 'pl',
    mode: 'flood',
    text: '12 lipca 1997 r. fala kulminacyjna Odry wdziera się do miasta; pod wodą jest prawie 40% Wrocławia. Mieszkańcy workami z piaskiem ratują Rynek, ZOO i własne podwórka.',
  },
  {
    id: 'esk',
    year: 2016,
    label: 'Europejska Stolica Kultury',
    state: 'Polska',
    city: 'Wrocław',
    flag: 'pl',
    mode: 'today',
    text: 'W 2016 r. Wrocław jest Europejską Stolicą Kultury (razem z San Sebastián) i Światową Stolicą Książki UNESCO. Rok wcześniej otwiera się Narodowe Forum Muzyki.',
  },
  {
    id: 'dzis',
    year: 2026,
    label: 'Dziś',
    state: 'Polska',
    city: 'Wrocław',
    flag: 'pl',
    mode: 'today',
    text: 'Miasto mostów, wysp i studentów — i setek krasnali, które trzeba omijać na chodniku. Zabudowa pokazuje dziś ponad tysiąc lat historii czterech państw.',
  },
]

// ---------------------------------------------------------------------------
// OBIEKTY
// ---------------------------------------------------------------------------

// Napisy widoczne z daleka (ranga 1) i przy średnim przybliżeniu (ranga 2); reszta po przybliżeniu.
export const LANDMARK_RANK: Record<string, 1 | 2> = {
  'Ratusz': 1, 'Uniwersytet Wrocławski (Aula Leopoldina)': 1, 'Archikatedra św. Jana Chrzciciela': 1,
  'Hala Stulecia': 1, 'Dworzec Główny': 1, 'Most Grunwaldzki': 1, 'Politechnika Wrocławska': 1,
  'Panorama Racławicka': 1, 'ZOO Wrocław': 1, 'Plac Grunwaldzki': 1, 'Narodowe Forum Muzyki': 1,
  'Hala Targowa': 1, 'Ogród Botaniczny': 1,
  'Rynek': 2, 'Kościół NMP na Piasku': 2, 'Most Tumski': 2, 'Opera Wrocławska': 2, 'Muzeum Narodowe': 2,
  'Pałac Królewski': 2, 'Kościół św. Elżbiety': 2, 'Dworzec Świebodzki': 2, 'Iglica': 2, 'Pergola i Fontanna': 2,
  'Plac Solny': 2, 'Ossolineum': 2, 'Wzgórze Polskie (Bastion Ceglarski)': 2, 'Ogród Japoński': 2,
}

export const LANDMARKS: Landmark[] = [
  {
    name: 'Politechnika Wrocławska',
    lat: 51.10793,
    lon: 17.06176,
    year: '1910',
    text: 'Gmach główny (A-1) przy Wybrzeżu Wyspiańskiego powstał dla Königliche Technische Hochschule Breslau, otwartej w 1910 r. Po wojnie uczelnię uruchomili w dużej części profesorowie ze Lwowa.',
  },
  { name: 'Ratusz', lat: 51.10958, lon: 17.03201, year: 'XIII–XVI w.', text: 'Gotycki ratusz rozbudowywano przez blisko trzy stulecia. W piwnicach działa Piwnica Świdnicka, uchodząca za jedną z najstarszych restauracji w Europie.' },
  { name: 'Rynek', lat: 51.10995, lon: 17.03150, year: '1242', text: 'Wytyczony przy lokacji miasta, należy do największych rynków w Polsce. Kamienice wokół mają nazwy jak z bajki: Pod Gryfami, Pod Złotym Słońcem, Pod Siedmioma Elektorami.' },
  { name: 'Pręgierz', lat: 51.10962, lon: 17.03290, year: '1492 (replika 1985)', text: 'Oryginał stał przed ratuszem od 1492 r. do 1945 r. Replikę postawiono w 1985 r., a figurka kata wróciła na szczyt dopiero w 2002 r.' },
  { name: 'Kamienica Pod Gryfami', lat: 51.11086, lon: 17.03051, year: '1587', text: 'Renesansowa kamienica z gryfami na szczycie, jedna z najbardziej charakterystycznych pierzei Rynku.' },
  { name: 'Pomnik Aleksandra Fredry', lat: 51.10925, lon: 17.03160, year: '1956 we Wrocławiu', text: 'Pomnik komediopisarza przyjechał ze Lwowa, podobnie jak wielu powojennych mieszkańców miasta. Stoi na Rynku od 1956 r.' },
  { name: 'Kościół Marii Magdaleny i Mostek Pokutnic', lat: 51.10957, lon: 17.03507, year: 'XIV w.', text: 'Gotycka katedra polskokatolicka. Jej dwie wieże łączy na wysokości ok. 45 m Mostek Pokutnic (Czarownic), dziś taras widokowy.' },
  { name: 'Kościół św. Elżbiety', lat: 51.11163, lon: 17.03043, year: 'XIV w.', text: 'Wieża mierzy ok. 91 m i jest punktem widokowym. Kościół przetrwał zawalenie hełmu w 1529 r. i wielki pożar w 1976 r.' },
  { name: 'Jaś i Małgosia', lat: 51.11125, lon: 17.03080, year: 'ok. 1400 (XVIII w.)', text: 'Dwa domki altarystów przy kościele św. Elżbiety, połączone barokową bramą. W "Jasiu" mieszkał i pracował grafik Eugeniusz Get-Stankiewicz.' },
  { name: 'Plac Solny', lat: 51.10939, lon: 17.02941, year: 'XIII w.', text: 'Dawny targ solny tuż przy Rynku, dziś znany z całodobowych kwiaciarni. Stoi tu mała iglica Adama Wyspiańskiego z 1996 r.' },
  { name: 'Uniwersytet Wrocławski (Aula Leopoldina)', lat: 51.11400, lon: 17.03420, year: '1728–1742', text: 'Barokowy gmach jezuickiej Leopoldiny, uczelni założonej przez cesarza Leopolda I w 1702 r. Aula Leopoldina to jedno z najwspanialszych barokowych wnętrz Europy Środkowej.' },
  { name: 'Kościół Najświętszego Imienia Jezus', lat: 51.11395, lon: 17.03522, year: '1689–1698', text: 'Jezuicki kościół uniwersytecki, barokowy od posadzki po sklepienie z iluzjonistycznymi freskami.' },
  { name: 'Ossolineum', lat: 51.11375, lon: 17.03675, year: 'XVII–XVIII w. (Ossolineum od 1946 r.)', text: 'Barokowy gmach dawnego szpitala krzyżowców z czerwoną gwiazdą. Po wojnie trafiły tu zbiory Zakładu Narodowego im. Ossolińskich przywiezione ze Lwowa.' },
  { name: 'Arsenał Miejski', lat: 51.11304, lon: 17.02658, year: 'XV–XVI w.', text: 'Najstarszy zachowany zespół budowli obronnych miasta, przy dawnej Bramie Mikołajskiej. Mieści Muzeum Militariów i Muzeum Archeologiczne.' },
  { name: 'Synagoga Pod Białym Bocianem', lat: 51.10842, lon: 17.02545, year: '1829', text: 'Klasycystyczna synagoga projektu Carla Ferdinanda Langhansa. Przetrwała Noc Kryształową, bo stała w ciasnym podwórzu i jej podpalenie groziło sąsiednim kamienicom.' },
  { name: 'Narodowe Forum Muzyki', lat: 51.10695, lon: 17.02638, year: '2015', text: 'Sala koncertowa przy pl. Wolności, otwarta tuż przed rokiem Europejskiej Stolicy Kultury.' },
  { name: 'Pałac Królewski', lat: 51.10754, lon: 17.02890, year: 'XVIII w.', text: 'Dawna rezydencja królów pruskich, dziś Muzeum Miejskie Wrocławia. W 1813 r. we Wrocławiu ustanowiono Krzyż Żelazny i ogłoszono odezwę "An mein Volk".' },
  { name: 'Opera Wrocławska', lat: 51.10570, lon: 17.03063, year: '1841', text: 'Gmach opery zaprojektował Carl Ferdinand Langhans; stoi tuż przy Fosie Miejskiej.' },
  { name: 'Bastion Sakwowy (Wzgórze Partyzantów)', lat: 51.10490, lon: 17.03860, year: 'XVI–XVII w., wzgórze po 1807', text: 'Pozostałość bastionu przerobiona na wzgórze widokowe Liebichshöhe (1867). W 2024 r. przywrócono mu historyczną nazwę Bastion Sakwowy.' },
  { name: 'Wzgórze Polskie (Bastion Ceglarski)', lat: 51.11170, lon: 17.04470, year: '1585', text: 'Bastion projektu Hansa Schneidera von Lindau, nazwany od cechu ceglarzy, który go bronił. Przed wojną nosił nazwę Holteihöhe.' },
  { name: 'Hala Targowa', lat: 51.11241, lon: 17.04043, year: '1908', text: 'Hala Richarda Plüddemanna z żelbetowymi łukami, wtedy technologiczna nowinka. W środku pachnie kiszonymi ogórkami i kwiatami.' },
  { name: 'Panorama Racławicka', lat: 51.11014, lon: 17.04440, year: '1894 (we Wrocławiu od 1985)', text: 'Obraz Jana Styki i Wojciecha Kossaka ma ok. 114 × 15 m. Przywieziony ze Lwowa w 1946 r., na pokazanie w rotundzie czekał do 14 czerwca 1985 r.' },
  { name: 'Muzeum Narodowe', lat: 51.11088, lon: 17.04764, year: '1886', text: 'Neorenesansowy gmach dawnej rejencji śląskiej, latem zielony, jesienią czerwony od oplatającego go winobluszczu.' },
  { name: 'Kościół NMP na Piasku', lat: 51.11462, lon: 17.04137, year: 'od 1334', text: 'Gotycka hala na Wyspie Piasek ze sklepieniami gwiaździstymi, budowana od 1334 r. Jej masywna bryła dominuje nad wyspą.' },
  { name: 'Most Tumski', lat: 51.11471, lon: 17.04233, year: '1889', text: 'Stalowy, nitowany most łączący Wyspę Piasek z Ostrowem Tumskim. Do 1945 r. Dombrücke, czyli Most Katedralny.' },
  { name: 'Archikatedra św. Jana Chrzciciela', lat: 51.11422, lon: 17.04668, year: 'od XIII w.', text: 'Gotycka katedra stoi w miejscu wcześniejszych świątyń biskupstwa założonego w 1000 r. Zniszczone w 1945 r. hełmy wież odtworzono dopiero w 1991 r.' },
  { name: 'Kolegiata św. Krzyża', lat: 51.11494, lon: 17.04413, year: '1288–1350', text: 'Kościół dwupoziomowy: dwa kościoły jeden nad drugim. Ufundował go książę Henryk IV Probus.' },
  { name: 'Kościół św. Idziego', lat: 51.11455, lon: 17.04694, year: 'ok. 1230', text: 'Najstarszy zachowany kościół Wrocławia. Obok przejście przez Bramę Kluskową.' },
  { name: 'Wyspa Słodowa', lat: 51.11610, lon: 17.03780, year: '—', text: 'Wyspa między Starym Miastem a Nadodrzem, latem najpopularniejsze miejsce na wieczór nad wodą.' },
  { name: 'Ogród Botaniczny', lat: 51.11621, lon: 17.04667, year: '1811', text: 'Ogród Uniwersytetu Wrocławskiego założony w 1811 r. tuż za katedrą, na Ostrowie Tumskim.' },
  { name: 'Most Grunwaldzki', lat: 51.10950, lon: 17.05254, year: '1910', text: 'Wiszący most z kamiennymi pylonami, otwarty jako Kaiserbrücke. Prowadzi wprost na pl. Grunwaldzki.' },
  { name: 'Plac Grunwaldzki', lat: 51.11147, lon: 17.06054, year: '1945 / lata 70.', text: 'W 1945 r. wyburzony pod lotnisko oblężonej twierdzy. Potem kampus i "Sedesowce" Jadwigi Grabowskiej-Hawrylak — bloki z charakterystycznymi owalnymi oknami.' },
  { name: 'Wieża ciśnień Na Grobli', lat: 51.10457, lon: 17.05782, year: '1866–1871', text: 'Neogotycka wieża dawnych wodociągów nad Odrą. Obok, w podziemnym zbiorniku wody, działa centrum wiedzy Hydropolis.' },
  { name: 'Hala Stulecia', lat: 51.10699, lon: 17.07716, year: '1913', text: 'Żelbetowa kopuła Maxa Berga o rozpiętości 65 m była rekordowa w czasach budowy. Od 2006 r. na liście UNESCO.' },
  { name: 'Iglica', lat: 51.10755, lon: 17.07519, year: '1948', text: 'Stalowy pomnik Stanisława Hempla na Wystawę Ziem Odzyskanych. Miał 106 m; po kolejnych skróceniach mierzy ok. 90 m.' },
  { name: 'Pergola i Fontanna', lat: 51.10888, lon: 17.07914, year: '1913', text: 'Betonowa pergola Hansa Poelziga otacza staw z multimedialną fontanną, która gra wieczorami w sezonie.' },
  { name: 'Pawilon Czterech Kopuł', lat: 51.10786, lon: 17.07579, year: '1913', text: 'Pawilon Hansa Poelziga z Wystawy Stulecia, dziś muzeum sztuki współczesnej.' },
  { name: 'Ogród Japoński', lat: 51.10975, lon: 17.08000, year: '1913', text: 'Założony na Wystawę Stulecia, odtworzony z pomocą japońskich ogrodników w latach 90. Zalany w czasie powodzi w 1997 r.' },
  { name: 'ZOO Wrocław', lat: 51.10420, lon: 17.07450, year: '1865', text: 'Najstarszy ogród zoologiczny w dzisiejszych granicach Polski. Jego Afrykarium pokazuje ekosystemy wodne Afryki.' },
  { name: 'Dworzec Główny', lat: 51.09897, lon: 17.03661, year: '1857', text: 'Neogotycki dworzec Wilhelma Grapowa, trochę zamek, trochę stacja. Gruntownie odnowiony przed Euro 2012.' },
  { name: 'Dworzec Świebodzki', lat: 51.10765, lon: 17.01918, year: 'ok. 1842', text: 'Jeden z pierwszych dworców w mieście, z czasów, gdy kolej dopiero docierała do Breslau.' },
]

// ---------------------------------------------------------------------------
// FORTYFIKACJE (ok. 1800)
// outer: nowożytna linia wałów wzdłuż wewnętrznego brzegu Fosy Miejskiej
//        (od Odry na zachodzie, łukiem na południe, do Bastionu Ceglarskiego nad Odrą na wschodzie);
//        odcinek od wschodniego końca fosy do Wzgórza Polskiego przybliżony (fosa tam zasypana).
// inner: pierwszy (XIII-wieczny) pas murów — Nowy Świat, ul. Kazimierza Wielkiego (dawna Czarna Oława),
//        wschodni bok przy ul. św. Katarzyny / Baszcie Niedźwiadka, północny wzdłuż Odry (ul. Grodzka).
//        Przebieg przybliżony.
// ---------------------------------------------------------------------------

export const WALLS: Walls = {
  outer: [
    [51.11410, 17.02470],
    [51.11337, 17.02413],
    [51.11304, 17.02399],
    [51.11241, 17.02364],
    [51.11210, 17.02342],
    [51.11130, 17.02290],
    [51.11060, 17.02244],
    [51.10995, 17.02258],
    [51.10904, 17.02246],
    [51.10837, 17.02231],
    [51.10784, 17.02311],
    [51.10721, 17.02476],
    [51.10675, 17.02582],
    [51.10621, 17.02695],
    [51.10573, 17.02794],
    [51.10546, 17.02847],
    [51.10496, 17.02945],
    [51.10458, 17.03027],
    [51.10441, 17.03182],
    [51.10437, 17.03346],
    [51.10423, 17.03456],
    [51.10457, 17.03597],
    [51.10431, 17.03789],
    [51.10409, 17.03941],
    [51.10556, 17.04037],
    [51.10627, 17.04057],
    [51.10704, 17.04096],
    [51.10792, 17.04150],
    [51.10841, 17.04236],
    [51.10940, 17.04320],
    [51.11050, 17.04400],
    [51.11170, 17.04470],
    [51.11240, 17.04520],
  ],
  inner: [
    [51.11342, 17.03152],
    [51.11309, 17.03087],
    [51.11292, 17.03003],
    [51.11282, 17.02889],
    [51.11264, 17.02798],
    [51.11162, 17.02691],
    [51.11039, 17.02639],
    [51.10935, 17.02665],
    [51.10848, 17.02739],
    [51.10820, 17.02812],
    [51.10783, 17.03053],
    [51.10742, 17.03150],
    [51.10711, 17.03298],
    [51.10709, 17.03471],
    [51.10724, 17.03603],
    [51.10762, 17.03747],
    [51.10931, 17.03861],
    [51.11071, 17.03903],
    [51.11190, 17.04000],
    [51.11300, 17.03990],
    [51.11348, 17.03869],
    [51.11404, 17.03739],
    [51.11459, 17.03568],
    [51.11418, 17.03410],
    [51.11372, 17.03272],
    [51.11342, 17.03152],
  ],
  bastions: [
    { lat: 51.11170, lon: 17.04470, name: 'Bastion Ceglarski (Wzgórze Polskie)' },
    { lat: 51.10490, lon: 17.03860, name: 'Bastion Sakwowy (Wzgórze Partyzantów)' },
  ],
}

// ---------------------------------------------------------------------------
// EASTER EGGI
// ---------------------------------------------------------------------------

export const EGGS: Egg[] = [
  {
    id: 'papa-krasnal',
    lat: 51.10754,
    lon: 17.03251,
    title: 'Papa Krasnal',
    text: 'Pierwszy wrocławski krasnal stanął 1 czerwca 2001 r. na Świdnickiej, gdzie Pomarańczowa Alternatywa robiła happeningi. To pomnik ruchu, który walczył z PRL-em za pomocą absurdu.',
    trigger: 'click',
  },
  {
    id: 'konami-orange',
    lat: 51.10754,
    lon: 17.03251,
    title: 'Rewolucja Krasnoludków',
    text: 'Tryb pomarańczowy włączony! 1 czerwca 1988 r. ponad 10 tys. osób w pomarańczowych czapkach przemaszerowało przez centrum miasta. Milicja nie wiedziała, kogo aresztować: krasnoludków się nie zamyka.',
    trigger: 'konami',
  },
  {
    id: 'mostek-pokutnic',
    lat: 51.10957,
    lon: 17.03507,
    title: 'Mostek Pokutnic',
    text: 'Według legendy duchy panien, które wolały zabawę od zamążpójścia, za karę zamiatają ten mostek między wieżami. Dziś za wejście płaci się biletem, nie wieczną pokutą.',
    trigger: 'click',
  },
  {
    id: 'klodki',
    lat: 51.11471,
    lon: 17.04233,
    title: 'Kłódki zakochanych',
    text: 'Przez lata pary wieszały na Moście Tumskim kłódki, a klucze wyrzucały do Odry. Przy remoncie zdjęto ich ok. 40 tys. i dziś wieszać ich już nie wolno, bo zabytkowy most ma dość ciężaru.',
    trigger: 'click',
  },
  {
    id: 'latarnik',
    lat: 51.11440,
    lon: 17.04500,
    title: 'Latarnik z Ostrowa',
    text: 'Po zmroku na Ostrowie Tumskim gazowe latarnie zapala ręcznie latarnik w pelerynie i cylindrze. Na tej mapie wystarczy poczekać do wieczora.',
    trigger: 'time',
  },
  {
    id: 'pregierz',
    lat: 51.10962,
    lon: 17.03290,
    title: 'Pręgierz',
    text: 'Od 1492 r. przed ratuszem karano chłostą i publicznym wstydem. Kat na szczycie repliki wrócił dopiero w 2002 r. — uważaj, gdzie klikasz.',
    trigger: 'click',
  },
  {
    id: 'most-szpiegow',
    lat: 51.12120,
    lon: 17.02800,
    title: 'Most szpiegów',
    text: 'Jesienią 2014 r. Steven Spielberg zamienił Nadodrze w Berlin Wschodni: na Ptasiej wyrósł mur, a Kurkowa zagrała Checkpoint Charlie. Wrocław w filmie z Tomem Hanksem gra Niemcy — tym razem z dobrym scenariuszem.',
    trigger: 'click',
  },
  {
    id: 'elyan',
    lat: 51.11422,
    lon: 17.04668,
    title: 'Pierwsze drukowane słowa po polsku',
    text: 'W 1475 r. kanonik katedralny Kasper Elyan wydrukował we Wrocławiu statuty synodalne, a w nich modlitwy po polsku: Ojcze nasz, Zdrowaś Maryjo i Wierzę. To pierwszy znany druk z tekstem w języku polskim.',
    trigger: 'click',
  },
  {
    id: 'iglica-lustra',
    lat: 51.10755,
    lon: 17.07519,
    title: 'Lustra na Iglicy',
    text: 'Na szczycie Iglicy obracał się dysk z ośmioma lustrami, który miał rzucać nocą błyski. Dwa tygodnie po otwarciu w 1948 r. zniszczyła go burza, a resztki zdjęli wspinacze z Krakowa. W 2007 r. Iglica była największą choinką w Europie.',
    trigger: 'zoom',
  },
  {
    id: 'zoo-1997',
    lat: 51.10420,
    lon: 17.07450,
    title: 'Ratowanie ZOO',
    text: 'W lipcu 1997 r. ok. 10 tys. ochotników układało worki z piaskiem wokół wrocławskiego ZOO. Zwierzęta przeżyły powódź tysiąclecia dzięki ludziom.',
    trigger: 'click',
  },
  {
    id: 'liebichshohe',
    lat: 51.10490,
    lon: 17.03860,
    title: 'Wzgórze (nie)miłości',
    text: 'Niemiecka nazwa Liebichshöhe pochodzi od kupca Adolfa Liebicha, ale przez podobieństwo do słowa Liebe po wojnie mówiono tu o "Wzgórzu Miłości". Pomyłka romantyczna, choć nie najgorsza.',
    trigger: 'click',
  },
  {
    id: 'picasso',
    lat: 51.10730,
    lon: 17.06000,
    title: 'Picasso we Wrocławiu',
    text: 'W sierpniu 1948 r. w gmachu Politechniki odbył się Światowy Kongres Intelektualistów w Obronie Pokoju. Przyjechał na niego Pablo Picasso.',
    trigger: 'click',
  },
  {
    id: 'krzyz-zelazny',
    lat: 51.10754,
    lon: 17.02890,
    title: 'Krzyż Żelazny',
    text: 'W marcu 1813 r. król Fryderyk Wilhelm III ustanowił we Wrocławiu order Krzyża Żelaznego i wydał stąd odezwę "An mein Volk". Sto lat później miasto uczciło te wydarzenia budową Hali Stulecia.',
    trigger: 'click',
  },
  {
    id: 'mosty',
    lat: 51.11300,
    lon: 17.04000,
    title: 'Miasto mostów',
    text: 'Odra, Oława, kanały i fosa sprawiają, że we Wrocławiu jest ponad sto mostów i kładek. Spróbuj policzyć te widoczne na mapie.',
    trigger: 'zoom',
  },
]

// ---------------------------------------------------------------------------
// KRASNALE
// ---------------------------------------------------------------------------

export const DWARF_FACTS: string[] = [
  'Krasnal to symbol Pomarańczowej Alternatywy, która w latach 80. dorysowywała krasnoludki na plamach farby zamalowujących antysystemowe hasła.',
  'Pierwszy, duży krasnal — Papa Krasnal — stanął na ul. Świdnickiej 1 czerwca 2001 r. jako pomnik Pomarańczowej Alternatywy.',
  'Małe krasnale z brązu pojawiły się 3 sierpnia 2005 r.: pierwsze, m.in. Syzyfki, Rzeźnik i Szermierz, zaprojektował Tomasz Moczek.',
  'Przy Rynku stoją Głuchak i Ślepak (2008) — krasnale przypominające o potrzebach osób z niepełnosprawnościami.',
  'W OpenStreetMap jest dziś zmapowanych ponad 750 wrocławskich krasnali, z czego większość w centrum, a co roku przybywają nowe.',
]
