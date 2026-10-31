// Słownik interfejsu. PL jest wzorcem: EN musi mieć te same klucze (pilnuje tego typ).
// Zmienne w tekstach: {nazwa}. Klucze *.html zawierają zaufany, statyczny HTML.
export const PL = {
  'meta.title': 'Wrocław w pikselach',
  'meta.description':
    'Interaktywna pikselowa mapa 3D Wrocławia: od grodu na Ostrowie Tumskim po dziś, z osią czasu, krasnalami i ciekawostkami.',
  'meta.locale': 'pl_PL',

  'lang.switch': 'EN',
  'lang.switchTitle': 'English version',

  'top.subtitle': 'w pikselach',
  'top.search': 'Ulica, zabytek albo krasnal…',
  'top.dwarfs': 'Znalezione krasnale: kliknij krasnala na mapie',
  'top.about': 'O mapie',
  'top.settings': 'Ustawienia',
  'info.fold': 'Zwiń',
  close: 'Zamknij',

  'drawer.time': 'Pora',
  'time.now': 'Teraz',
  'time.day': 'Południe',
  'time.dusk': 'Zmierzch',
  'time.night': 'Noc',
  'time.hour': 'Godzina',
  'season.summer': 'Lato',
  'season.autumn': 'Jesień',
  'season.winter': 'Zima',
  'drawer.look': 'Wygląd',
  'look.pixel': 'Wielkość piksela',
  'look.palette': 'Paleta',
  'look.outline': 'Kontury',
  'look.dither': 'Dithering',
  'look.hover': 'Obrys pod kursorem',
  'drawer.layers': 'Na mapie',
  'layer.dwarfs': 'Krasnale',
  'layer.trams': 'Tramwaje',
  'layer.trains': 'Pociągi',
  'layer.cars': 'Auta',
  'layer.people': 'Ludzie',
  'layer.birds': 'Ptaki',
  'layer.clouds': 'Chmury',
  'layer.trees': 'Drzewa',
  'layer.plans': 'Dawne plany',
  'layer.labels': 'Zabytki',
  'layer.eggs': 'Ciekawostki',
  'drawer.markers': 'Znaczniki',
  'layer.markers': 'Wszystkie znaczniki',
  'layer.places': 'Nazwy osiedli',
  'layer.pois': 'Obiekty z OSM',
  'layer.unis': 'Uczelnie',
  'layer.cult': 'Kultowe miejsca',
  'drawer.scenes': 'Scenki',
  'scene.market': 'Jarmark',
  'scene.fireworks': 'Fajerwerki',
  'layer.boats': 'Statki',
  'layer.neons': 'Neony',
  'layer.monuments': 'Pomniki',
  'scene.lamplighter': 'Latarnik',
  'scene.match': 'Mecz',
  'scene.speedway': 'Żużel',
  'scene.hint':
    'Scenki pojawiają się same w swoim czasie (jarmark w grudniu, fajerwerki w sylwestra, mecze i żużel w terminach zawodów); tu włączysz je od razu.',
  'btn.link': 'Kopiuj link',
  'btn.photo': 'Zrób zdjęcie',
  'drawer.hint.html':
    'Przeciągnij, żeby przesunąć · prawy przycisk obraca i pochyla · kompas wraca do widoku z góry · <kbd>Q</kbd>/<kbd>E</kbd> obrót · <kbd>H</kbd> chowa interfejs',
  'drawer.credits.html':
    'Dane © współtwórcy <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (ODbL) · ortofotomapa © <a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">GUGiK</a> (CC BY 4.0)',

  'tools.rotL': 'Obróć w lewo (Q)',
  'tools.rotR': 'Obróć w prawo (E)',
  'tools.compass': 'Domyślny widok: północ u góry',
  timeline: 'Oś czasu',

  'about.intro':
    'Interaktywna pikselowa mapa Wrocławia: od grodu na Ostrowie Tumskim po dziś. To ilustracja do oglądania i poznawania historii miasta, nie mapa do nawigacji. Wygląd dawnych epok jest przybliżony.',
  'about.data': 'Dane i licencje',
  'about.osm.html':
    '© współtwórcy <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, licencja <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL 1.0</a>. Dane mapy (katalog <code>public/data</code>) są bazą pochodną udostępnioną na tej samej licencji.',
  'about.ortho.html':
    'Ortofotomapa: <a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">GUGiK</a>, <a href="https://creativecommons.org/licenses/by/4.0/deed.pl" target="_blank" rel="noopener">CC BY 4.0</a>; dane przetworzone (kolory dachów).',
  'about.gtfs.html':
    'Rozkład jazdy tramwajów: <a href="https://www.wroclaw.pl/dla-mieszkanca/otwarte-dane-open-data-wroclaw" target="_blank" rel="noopener">Otwarte Dane Wrocław</a> (GTFS MPK Wrocław, kopia <a href="https://mobilitydatabase.org" target="_blank" rel="noopener">Mobility Database</a>); dane przetworzone.',
  'about.lod1.html':
    'Wysokości budynków: <a href="https://www.geoportal.gov.pl/pl/dane/inne-dane/modele-3d-budynkow/" target="_blank" rel="noopener">Modele 3D budynków LoD1 2024</a>, GUGiK, <a href="https://creativecommons.org/licenses/by/4.0/deed.pl" target="_blank" rel="noopener">CC BY 4.0</a>; dane przetworzone.',
  'about.plan1732.html':
    'Plan miasta z ok. 1732 r. (epoki 1242–1807): <a href="https://kartenforum.slub-dresden.de/" target="_blank" rel="noopener">SLUB Dresden / Deutsche Fotothek, Virtuelles Kartenforum</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.pl" target="_blank" rel="noopener">CC BY-SA 4.0</a>; kafle przetworzone, udostępnione na tej samej licencji.',
  'about.plan1895.html':
    'Plan miasta z 1895 r. (epoki 1900–1945): „Neuer Plan der Stadt Breslau”, 1:10 000, E. Morgenstern / Wagner &amp; Debes, domena publiczna; skan: <a href="https://geoportost.ios-regensburg.de/" target="_blank" rel="noopener">GeoPortOst, IOS Regensburg</a>; ułożony na mapie przez autora.',
  'about.nid': 'Daty budowy zabytków: rejestr zabytków nieruchomych, Narodowy Instytut Dziedzictwa (dane.gov.pl); dane przetworzone.',
  'about.dwarfs': 'Krasnale: dane z OpenStreetMap; zdjęcia należą do ich autorów i są wyświetlane z oryginalnych adresów.',
  'about.monuments.html': 'Pomniki: dane z OpenStreetMap i Wikidanych; zdjęcia z Wikimedia Commons (autor i licencja przy zdjęciu).',
  'about.trivia': 'Ciekawostki: opracowanie własne na podstawie źródeł podanych przy każdej z nich.',
  'about.wiki.html':
    'Opisy miejsc: skróty artykułów z <a href="https://pl.wikipedia.org/" target="_blank" rel="noopener">Wikipedii</a> (link do artykułu w okienku), <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.pl" target="_blank" rel="noopener">CC BY-SA 4.0</a>; zdjęcia z Wikimedia Commons.',
  'about.fonts': 'Fonty: VT323 i Work Sans (SIL Open Font License).',
  'about.inspirations': 'Inspiracje',
  'about.author.html':
    'Autor: <a href="https://okkindel.github.io/" target="_blank" rel="noopener">Maciej Hajduk (okkindel)</a> · <a href="https://github.com/okkindel/WroclawPixelMap" target="_blank" rel="noopener">GitHub</a>',
  'about.version': 'Wersja {v}',
  'about.thanks.html':
    'Dziękujemy autorom podobnych map za pomysł: <a href="https://michalpietralik.pl/cracowpixelmap/" target="_blank" rel="noopener">Cracow Pixel Map</a> Michała Pietralika, <a href="https://bedirhanyildirim.com/warsaw-izo/" target="_blank" rel="noopener">Isometric Warsaw</a>, <a href="https://isometric.nyc/" target="_blank" rel="noopener">isometric.nyc</a> i <a href="https://tiny.london/" target="_blank" rel="noopener">tiny.london</a>. Kod, grafika i teksty tej mapy powstały od zera.',
  'attrib.html':
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · ortofoto © GUGiK · rozkład MPK Wrocław',
  loading: 'Wczytuję Wrocław…',
  loadError: 'Nie udało się wczytać mapy :(',

  // teksty z app.ts
  'sub.trivia': 'Ciekawostka',
  'sub.uni': 'Uczelnia',
  'sub.cult': 'Kultowe miejsce',
  'sub.stadium': 'Stadion',
  source: 'Źródło',
  'poi.mall': 'Galeria handlowa',
  'poi.culture': 'Kultura',
  'poi.church': 'Świątynia',
  'poi.edu': 'Uczelnia',
  'poi.school': 'Szkoła',
  'poi.health': 'Szpital',
  'poi.sport': 'Sport',
  'poi.notable': 'Ciekawe miejsce',
  'kind.zabytek': 'zabytek',
  'kind.ciekawostka': 'ciekawostka',
  'kind.uczelnia': 'uczelnia',
  'kind.kultowe': 'kultowe',
  'kind.krasnal': 'krasnal',
  'kind.ulica': 'ulica',
  'kind.budynek': 'budynek',
  'toast.linkCopied': 'Link skopiowany',
  'tram.title': 'Tramwaj linii {line}',
  'tram.sub': 'kierunek: {head}',
  'tram.text': 'Kurs {dep}–{arr} według rozkładu MPK Wrocław.',
  'scene.speedway.title': 'Żużel na Olimpijskim',
  'scene.speedway.text':
    'Na Stadionie Olimpijskim ścigają się żużlowcy Sparty Wrocław. Cztery okrążenia, same lewe zakręty i motocykle bez hamulców: zwalnia się, kładąc maszynę w łuk.',
  'building.built': 'zbudowany {y}',
  'scene.market.title': 'Jarmark Bożonarodzeniowy',
  'scene.market.text':
    'Od końca listopada do 7 stycznia Rynek i plac Solny wypełniają drewniane budki z grzańcem, piernikami, pierogami i rękodziełem. Do tego wielka choinka, karuzela i tysiące światełek: to jeden z największych jarmarków świątecznych w Polsce.',
  'scene.fireworks.title': 'Sylwester na Rynku',
  'scene.fireworks.text': 'O północy niebo nad Rynkiem rozbłyska fajerwerkami, a na płycie bawią się tysiące wrocławian i turystów.',
  'scene.barge.title': 'Barka na Odrze',
  'scene.barge.text':
    'Przez Wrocław biegnie Odrzańska Droga Wodna. W mieście Odra rozgałęzia się, tworząc Wrocławski Węzeł Wodny: sieć kanałów, śluz i jazów. Barki towarowe płyną głównie Głównym Szlakiem Żeglugowym na północy, a przez centrum prowadzi Miejski Szlak Żeglugowy.',
  'scene.cruise.title': 'Statek spacerowy',
  'scene.cruise.text':
    'Od wiosny do jesieni po Odrze kursują statki wycieczkowe i gondole. Z wody najlepiej widać, że Wrocław leży na kilkunastu wyspach połączonych ponad setką mostów i kładek.',
  'scene.kayak.title': 'Kajakiem po Odrze',
  'scene.kayak.text':
    'W ciepłe miesiące można wypożyczyć kajak i opłynąć Ostrów Tumski, Wyspę Piasek i Słodową. Miejskie odnogi Odry to jeden z najciekawszych szlaków kajakowych w Polsce.',
  'scene.lamplighter.title': 'Latarnik z Ostrowa Tumskiego',
  'scene.lamplighter.text':
    'Na Ostrowie Tumskim wciąż świeci blisko sto latarni gazowych (dziś 98). Codziennie o zmierzchu latarnik w czarnej pelerynie i cylindrze zapala je ręcznie długą tyczką, a o świcie gasi. To jedyny taki latarnik w Polsce.',
  'dwarf.author': 'autor: {a}',
  'dwarf.since': 'od {d}',
  'dwarf.quote': '„{s}”',
  'dwarf.osm': 'Zobacz w OpenStreetMap',
  'toast.newDwarf': 'Nowy krasnal! {n}/{total}',
  'toast.allDwarfs': 'Wszystkie krasnale znalezione. Jesteś Papą Krasnalem!',
  progress: 'Wczytuję dzielnice… {done}/{total}',
  'saver.pixel': 'Tryb oszczędny: większy piksel',
  'saver.shadows': 'Tryb oszczędny: bez cieni',
}

export type Key = keyof typeof PL

export const EN: Record<Key, string> = {
  'meta.title': 'Wrocław in pixels',
  'meta.description':
    'An interactive 3D pixel-art map of Wrocław, Poland: from the stronghold on Ostrów Tumski to today, with a timeline, dwarfs and local trivia.',
  'meta.locale': 'en_GB',

  'lang.switch': 'PL',
  'lang.switchTitle': 'Wersja polska',

  'top.subtitle': 'in pixels',
  'top.search': 'Street, landmark or dwarf…',
  'top.dwarfs': 'Dwarfs found: click a dwarf on the map',
  'top.about': 'About the map',
  'top.settings': 'Settings',
  'info.fold': 'Collapse',
  close: 'Close',

  'drawer.time': 'Time of day',
  'time.now': 'Now',
  'time.day': 'Noon',
  'time.dusk': 'Dusk',
  'time.night': 'Night',
  'time.hour': 'Hour',
  'season.summer': 'Summer',
  'season.autumn': 'Autumn',
  'season.winter': 'Winter',
  'drawer.look': 'Look',
  'look.pixel': 'Pixel size',
  'look.palette': 'Palette',
  'look.outline': 'Outlines',
  'look.dither': 'Dithering',
  'look.hover': 'Hover outline',
  'drawer.layers': 'On the map',
  'layer.dwarfs': 'Dwarfs',
  'layer.trams': 'Trams',
  'layer.trains': 'Trains',
  'layer.cars': 'Cars',
  'layer.people': 'People',
  'layer.birds': 'Birds',
  'layer.clouds': 'Clouds',
  'layer.trees': 'Trees',
  'layer.plans': 'Old city plans',
  'layer.labels': 'Landmarks',
  'layer.eggs': 'Trivia',
  'drawer.markers': 'Markers',
  'layer.markers': 'All markers',
  'layer.places': 'District names',
  'layer.pois': 'Places from OSM',
  'layer.unis': 'Universities',
  'layer.cult': 'Cult places',
  'drawer.scenes': 'Scenes',
  'scene.market': 'Christmas market',
  'scene.fireworks': 'Fireworks',
  'layer.boats': 'Boats',
  'layer.neons': 'Neon signs',
  'layer.monuments': 'Monuments',
  'scene.lamplighter': 'Lamplighter',
  'scene.match': 'Match',
  'scene.speedway': 'Speedway',
  'scene.hint':
    'Scenes appear on their own at the right time (the market in December, fireworks on New Year’s Eve, matches and speedway on race days); switch them on here any time.',
  'btn.link': 'Copy link',
  'btn.photo': 'Take a photo',
  'drawer.hint.html':
    'Drag to pan · right button rotates and tilts · the compass returns to the top-down view · <kbd>Q</kbd>/<kbd>E</kbd> rotate · <kbd>H</kbd> hides the interface',
  'drawer.credits.html':
    'Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors (ODbL) · orthophoto © <a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">GUGiK</a> (CC BY 4.0)',

  'tools.rotL': 'Rotate left (Q)',
  'tools.rotR': 'Rotate right (E)',
  'tools.compass': 'Default view: north up',
  timeline: 'Timeline',

  'about.intro':
    'An interactive pixel-art map of Wrocław: from the stronghold on Ostrów Tumski to today. It is an illustration for exploring the city and its history, not a map for navigation. The look of past eras is approximate.',
  'about.data': 'Data and licences',
  'about.osm.html':
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, licensed under <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL 1.0</a>. The map data (the <code>public/data</code> directory) is a derivative database shared under the same licence.',
  'about.ortho.html':
    'Orthophoto: <a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">GUGiK</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>; processed data (roof colours).',
  'about.gtfs.html':
    'Tram timetable: <a href="https://www.wroclaw.pl/dla-mieszkanca/otwarte-dane-open-data-wroclaw" target="_blank" rel="noopener">Otwarte Dane Wrocław</a> (Wrocław Open Data; GTFS of MPK Wrocław, mirrored by <a href="https://mobilitydatabase.org" target="_blank" rel="noopener">Mobility Database</a>); processed data.',
  'about.lod1.html':
    'Building heights: <a href="https://www.geoportal.gov.pl/pl/dane/inne-dane/modele-3d-budynkow/" target="_blank" rel="noopener">LoD1 3D building models 2024</a>, GUGiK, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>; processed data.',
  'about.plan1732.html':
    'City plan of c. 1732 (epochs 1242–1807): <a href="https://kartenforum.slub-dresden.de/" target="_blank" rel="noopener">SLUB Dresden / Deutsche Fotothek, Virtuelles Kartenforum</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>; processed tiles shared under the same licence.',
  'about.plan1895.html':
    'City plan of 1895 (epochs 1900–1945): “Neuer Plan der Stadt Breslau”, 1:10,000, E. Morgenstern / Wagner &amp; Debes, public domain; scan: <a href="https://geoportost.ios-regensburg.de/" target="_blank" rel="noopener">GeoPortOst, IOS Regensburg</a>; georeferenced by the author.',
  'about.nid':
    'Construction dates of historic buildings: register of immovable monuments, National Heritage Board of Poland (Narodowy Instytut Dziedzictwa, dane.gov.pl); processed data.',
  'about.dwarfs': 'Dwarfs: data from OpenStreetMap; photos belong to their authors and are shown from their original addresses.',
  'about.monuments.html':
    'Monuments: data from OpenStreetMap and Wikidata; photos from Wikimedia Commons (author and licence shown with each photo).',
  'about.trivia': 'Trivia: our own write-ups based on the sources linked from each item.',
  'about.wiki.html':
    'Place descriptions: excerpts of <a href="https://en.wikipedia.org/" target="_blank" rel="noopener">Wikipedia</a> articles (linked in each popup), <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>; photos from Wikimedia Commons.',
  'about.fonts': 'Fonts: VT323 and Work Sans (SIL Open Font License).',
  'about.inspirations': 'Inspirations',
  'about.author.html':
    'Author: <a href="https://okkindel.github.io/" target="_blank" rel="noopener">Maciej Hajduk (okkindel)</a> · <a href="https://github.com/okkindel/WroclawPixelMap" target="_blank" rel="noopener">GitHub</a>',
  'about.version': 'Version {v}',
  'about.thanks.html':
    'Thanks to the authors of similar maps for the idea: <a href="https://michalpietralik.pl/cracowpixelmap/" target="_blank" rel="noopener">Cracow Pixel Map</a> by Michał Pietralik, <a href="https://bedirhanyildirim.com/warsaw-izo/" target="_blank" rel="noopener">Isometric Warsaw</a>, <a href="https://isometric.nyc/" target="_blank" rel="noopener">isometric.nyc</a> and <a href="https://tiny.london/" target="_blank" rel="noopener">tiny.london</a>. The code, graphics and texts of this map were made from scratch.',
  'attrib.html':
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · orthophoto © GUGiK · timetable MPK Wrocław',
  loading: 'Loading Wrocław…',
  loadError: 'Could not load the map :(',

  'sub.trivia': 'Trivia',
  'sub.uni': 'University',
  'sub.cult': 'Iconic spot',
  'sub.stadium': 'Stadium',
  source: 'Source',
  'poi.mall': 'Shopping mall',
  'poi.culture': 'Culture',
  'poi.church': 'Place of worship',
  'poi.edu': 'University',
  'poi.school': 'School',
  'poi.health': 'Hospital',
  'poi.sport': 'Sport',
  'poi.notable': 'Notable place',
  'kind.zabytek': 'landmark',
  'kind.ciekawostka': 'trivia',
  'kind.uczelnia': 'university',
  'kind.kultowe': 'iconic',
  'kind.krasnal': 'dwarf',
  'kind.ulica': 'street',
  'kind.budynek': 'building',
  'toast.linkCopied': 'Link copied',
  'tram.title': 'Tram line {line}',
  'tram.sub': 'towards: {head}',
  'tram.text': 'Trip {dep}–{arr} according to the MPK Wrocław timetable.',
  'scene.speedway.title': 'Speedway at the Olympic Stadium',
  'scene.speedway.text':
    'Sparta Wrocław’s speedway riders race at the Olympic Stadium. Four laps, nothing but left turns and bikes without brakes: you slow down by laying the bike into the bend.',
  'building.built': 'built {y}',
  'scene.market.title': 'Christmas market',
  'scene.market.text':
    'From late November to 7 January the Market Square and Salt Square fill with wooden stalls selling mulled wine, gingerbread, pierogi and crafts. Add a giant Christmas tree, a carousel and thousands of lights: it is one of the largest Christmas markets in Poland.',
  'scene.fireworks.title': 'New Year’s Eve on the Market Square',
  'scene.fireworks.text':
    'At midnight fireworks light up the sky over the Market Square, where thousands of locals and visitors celebrate.',
  'scene.barge.title': 'Barge on the Oder',
  'scene.barge.text':
    'The Oder Waterway runs through Wrocław. In the city the river branches into the Wrocław Water Junction, a network of canals, locks and weirs. Cargo barges mostly take the Main Shipping Route in the north, while the City Shipping Route crosses the centre.',
  'scene.cruise.title': 'Pleasure boat',
  'scene.cruise.text':
    'From spring to autumn cruise boats and gondolas sail the Oder. From the water it is easiest to see that Wrocław sits on a dozen islands linked by more than a hundred bridges and footbridges.',
  'scene.kayak.title': 'Kayaking on the Oder',
  'scene.kayak.text':
    'In the warm months you can rent a kayak and paddle around Ostrów Tumski, Sand Island and Słodowa Island. The city’s Oder branches are among the most interesting kayak routes in Poland.',
  'scene.lamplighter.title': 'The lamplighter of Ostrów Tumski',
  'scene.lamplighter.text':
    'Almost a hundred gas lamps still glow on Ostrów Tumski (98 today). Every evening at dusk a lamplighter in a black cape and top hat lights them by hand with a long pole, and puts them out at dawn. He is the only lamplighter of this kind in Poland.',
  'dwarf.author': 'by {a}',
  'dwarf.since': 'since {d}',
  'dwarf.quote': '“{s}”',
  'dwarf.osm': 'View on OpenStreetMap',
  'toast.newDwarf': 'New dwarf! {n}/{total}',
  'toast.allDwarfs': 'All dwarfs found. You are Papa Krasnal!',
  progress: 'Loading districts… {done}/{total}',
  'saver.pixel': 'Power saving: bigger pixels',
  'saver.shadows': 'Power saving: no shadows',
}
