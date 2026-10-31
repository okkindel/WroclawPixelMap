# Heurystyki

Wszystko, co mapa zgaduje, gdy dane milczą. Reguły wypiekania są w `scripts/lib/rules.ts`,
reguły przeglądarki w `src/rules/`. Zmiana progu = zmiana w jednym miejscu (i ponowne `npm run bake` dla reguł skryptów).

## Budynki (`npm run bake`)

| Reguła | Co robi | Dlaczego | Wyjątki / uwagi | Gdzie |
| --- | --- | --- | --- | --- |
| Rodzaj bryły | `building=*` → rodzaj (kościół, mieszkalny, handel, publiczny, przemysł, niski, wiata, ruina, ogólny) | od rodzaju zależą ściany, okna i domyślna wysokość | `amenity=place_of_worship` bez `building=church` też jest kościołem | `scripts/lib/rules.ts` `BUILDING_KIND`, `buildingKind` |
| Kominy i zbiorniki | `man_made=chimney` → komin; `storage_tank`, `silo`, `gasometer`, `water_tower` → zbiornik | bywają tagowane jako `building`, a nie mają okien | — | `buildingKind`, `TANKS` |
| Komin bez tagu | okrągła (≥ 8 wierzchołków), wąska (< 400 m²), > 40 m, smukłość > 3 → komin | elektrociepłownie mają kominy tylko jako `building=yes` | nie dla części budynków i brył z `roof:shape` (wieże kościołów) | `looksLikeChimney` |
| Wysokość z pięter | `levels × 3.2 m + 1.5 m` | typowa kondygnacja + dach/attyka | `height` ma pierwszeństwo | `taggedHeight`, `LEVEL_H`, `LEVELS_EXTRA_H` |
| Domyślna wysokość | wg rodzaju: niski 3.5, wiata/ruina 4, kościół 22, mieszkalny 15, handel 14, publiczny 16, przemysł 9, reszta 12 m | większość budynków w OSM nie ma ani `height`, ani pięter | zastępowana pomiarem LoD1, jeśli jest | `DEFAULT_H`, `FALLBACK_H`, `guessHeight` |
| Domy jednorodzinne | `house`, `detached`, `villa`… albo ogólny < 180 m² → 8 m; ogólny < 400 m² → 10 m | małe budynki to domki i przybudówki, średnie ok. 3 kondygnacje | — | `HOUSES`, `isHouse`, `HOUSE_H`, `MID_H` |
| Dach dwuspadowy | dom bez wysokości i bez `roof:shape` dostaje `gabled` | płaski dach na domku wygląda jak blok | gdy OSM zna wysokość/piętra, nie zgadujemy dachu | `roofShape` |
| Wiata | dolna krawędź ok. 0.6 m pod wierzchem | `building=roof` to sam dach na słupach | pergola: stałe 3.6–4.2 m | `minHeight`, `PERGOLA` |
| Limity | wysokość ≤ 220 m, obrys ≥ 6 m² | Sky Tower ma ~212 m; mniejsze obrysy to śmieci | — | `MAX_H`, `MIN_BUILDING_AREA` |
| Budowa w toku | `building=construction` dostaje rok bieżący | w dawnych epokach budowy nie ma | — | `constructionYear` |
| Wysokość szacowana | bez `height`, `roof:shape`, nie kościół, nie część | tylko takie można zastąpić pomiarem LoD1 | kościoły (wieże), części i jawne `height` są dokładniejsze niż mediana ALS | `isEstimatedHeight` |
| LoD1 GUGiK | mediana ALS > 1.5 m zastępuje szacunek; przy dachu spadzistym × 1.15; ≥ dolna krawędź + 2 m | mediana wypada w połowie dachu, kalenica jest wyżej | dopasowanie: środek modelu w obrysie budynku | `LOD1_*`, `lod1Height`; etap `scripts/bake/world/lod1.ts` |
| Części budynków | części (Simple 3D) zastępują obrys, gdy pokrywają ≥ 70% jego pola (albo obrys ma H < 1 m) | często zmapowana jest tylko wieża albo arkady | część dziedziczy nazwę, rok; część kościoła jest kościołem | `PARTS_REPLACE_SHARE`, `partsReplaceOutline`, `partKind`; `scripts/bake/world/parts.ts` |
| Z-fighting | obrys zostający obok części: −0.4 m (≥ podstawa + 0.5 m) i zwężony o 0.15 m | wspólne dachy i ściany migotałyby | — | `Z_FIGHT_LOWER`, `Z_FIGHT_SHRINK` |
| Kolor dachu z ortofoto | piksele w obrysie (~400 próbek), bez koron drzew (zieleń > R+8, > B+4), środkowa połowa wg jasności | odrzuca cienie, kominy, świetliki i blaski | < 4 pikseli albo < 40% obrysu → brak; zielonkawy wynik tylko na kościołach (patyna); rozpiętość < 28 → neutralna szarość; `roof:colour` z OSM wygrywa | `isTreePixel`, `roofColour`, `ORTHO_*`; `scripts/bake/world/ortho.ts` |

## Daty budowy (rejestr zabytków NID)

| Reguła | Co robi | Dlaczego | Wyjątki / uwagi | Gdzie |
| --- | --- | --- | --- | --- |
| Chronologia → rok | zakres lat → początek; wiek → środek, z doprecyzowaniem (poł., ćw., pocz., koniec, przełom) | NID podaje opisowe „XIX w., 2. poł.” | rok spoza 1000…dziś odrzucany | `scripts/bake/nid.ts` `parseChronology` |
| Ulica i numer | bez diakrytyków, prefiksów (ul., pl.) i tytułów (św., gen.); „7-9” → 7, 9; „7/9” → 7, 9; „8/1a” (OSM) → 8 | zapis adresów w NID i OSM się różni | nazwa skrócona („Bujwida”) tylko gdy jednoznaczna i słowa w tej samej kolejności | `streetKey`, `houseNumbers`, `lookup` |
| Nie-budynki | mury, ogrodzenia, parki, cmentarze, pomniki nie dają roku | ich data nie jest datą budynku pod adresem | — | `NOT_BUILDING` |
| Najstarszy wpis | kilka wpisów pod adresem → najstarszy rok | zespół i jego obiekty | `start_date` z OSM ma pierwszeństwo | `loadNid`, `NidMatcher.yearFor` |
| Punkt obok budynku | punkt adresowy z NID poza obrysami → najbliższy budynek do 15 m | punkty PRG leżą często przy wejściu | pomija garaże i wiaty, nie nadpisuje roku | `NID_NEAR_RADIUS`, `nidNearSkip`; `scripts/bake/world/nid-match.ts` |

## Konstrukcje, tereny, drogi (`npm run bake`)

| Reguła | Co robi | Dlaczego | Wyjątki / uwagi | Gdzie |
| --- | --- | --- | --- | --- |
| Wysokość konstrukcji | wieża ciśnień 30, maszt 40, wieża telekom. 60, wieża 25, obelisk 12, latarnia 20, reszta 20 m | brak `height` | słup kolei linowej 35 m | `STRUCTURE_H`, `PYLON_H` |
| Maszty bez wysokości | maszt bez `height` i `tower:type` pomijamy | to zwykle słupek (hotspot, lampa), nie 40-metrowy maszt | — | `isTrivialMast` |
| Rodzaj konstrukcji | jupiter (`tower:type=lighting`), wieża ciśnień, maszt; smukła (H/r > 12) iglica, reszta wieża | inny model 3D | promień z obrysu albo 2 m (wieża ciśnień 7 m) | `structureKind`, `structureRadius` |
| Jupitery i słupy | jupiter celuje w środek stadionu do 400 m; słup należy do kolei linowej do 60 m | OSM nie zapisuje kierunku ani przynależności | — | `FLOODLIGHT_MAX_DIST`, `PYLON_MAX_DIST` |
| Stadiony i boiska | stadion > 3000 m², boisko piłkarskie > 4000 m², zieleń > 20 m² | tylko pełnowymiarowe obiekty dostają trybuny / mecz | — | `STADIUM_MIN_AREA`, `SOCCER_MIN_AREA`, `GREEN_MIN_AREA` |
| Szerokość drogi | z `width` (≤ 30 m), inaczej typowa dla klasy | tagi bywają błędne | chodnik zawsze typowy (`width` to często cały pas) | `ROAD_MAX_WIDTH`; `ROAD_WIDTH` w `scripts/bake/world/features.ts` |
| Pas startowy 1945 | jezdnie placu Grunwaldzkiego = pas Festung Breslau | historyczny pas biegł osią placu | — | `isFestungRunway` |

## Napisy obiektów z OSM (POI)

| Reguła | Co robi | Dlaczego | Wyjątki / uwagi | Gdzie |
| --- | --- | --- | --- | --- |
| Rodzaj POI | galeria, kultura, uczelnia, szpital, sport, świątynia | rozpoznawalne funkcje | — | `scripts/lib/rules.ts` `poiKind` |
| Szkoły | tylko licea albo szkoły z Wikipedią | inaczej setki „Szkoła Podstawowa nr …” | punkty szkół zamieniane na jednopunktowe linie | `poiKind`; `addSchools` |
| „notable” | obiekt bez znanej funkcji tylko z artykułem w Wikipedii | sam wpis w Wikidanych mają też zwykłe kamienice | — | `poiKind` |
| Nazwy ogólnikowe | „Kościół”, „Dom”, „Hala”… bez napisu | sama funkcja to nie nazwa | — | `GENERIC` |
| Ranga | galerie i obiekty z Wiki → widoczne z daleka | znane miejsca | — | `poiRank` |
| Jedna nazwa = jeden napis | duplikaty nazw scalane | budynek bywa zmapowany jako obszar i bryła | zostaje ostatni wpis na miejscu pierwszego | `uniquePois` |

## Napisy w przeglądarce (`src/rules/labels.ts`)

| Reguła | Co robi | Dlaczego | Wyjątki / uwagi | Gdzie |
| --- | --- | --- | --- | --- |
| Progi zoomu POI | świątynia 1.5, znane/uczelnia 0.3, reszta 1.2, jednostka uczelni 2.2, szkoła 1.5 | z daleka tylko najważniejsze napisy | — | `POI_MIN_ZOOM`, `poiLabelRule` |
| Jednostki uczelni | Wydział, Instytut, Katedra, Kampus… tylko z bliska | tłok napisów na kampusach | „Katedra” u świątyń to kościół, nie jednostka | `poiLabelRule` (`UNIT`) |
| Uczelnie główne | Uniwersytet, Politechnika, Akademia… zawsze z daleka, grupa „unis” | punkt orientacyjny | — | `UNIVERSITY` |
| Szkoły | Liceum, Technikum… z bliska, podtytuł „Szkoła” | to nie uczelnie | — | `SCHOOL` |
| Deduplikacja z zabytkami | POI < 150 m od zabytku z listy, gdy znaczące słowa jednej nazwy zawierają się w drugiej („NMP” = „Najświętszej Marii Panny”, bez „św.”, „pw.”, „Wrocław”) → pomijany | „Hala Targowa” jest już na liście | sąsiad o innej nazwie zostaje („Kamienica Pod Złotym Słońcem” obok „Pod Gryfami”) | `POI_DEDUP_RADIUS`, `sameName` |
| Od kiedy POI | `start_date` z OSM; bez niego galerie od 2000, świątynie od 1850, reszta od 1950 | funkcje współczesne; większość galerii we Wrocławiu to lata 2001–2007 | — | `poiFrom` |
| Rok zabytku | pierwszy rok z opisu albo środek wieku (XIII w. / 13th c. → 1250) | napis znika w epokach sprzed budowy | — | `yearOf` |
| Ranga zabytku | ranga 1 od zoomu 0, ranga 2 od 0.9, reszta od 1.6 | z daleka tylko ikony miasta | — | `landmarkMinZoom` |
| Osiedla, znaczniki | dzielnica/osiedle/okolica: osobne zakresy zoomu; ciekawostka od 0.75, ukryta („zoom”) od 3 | nazwy osiedli z bliska przeszkadzają | — | `PLACE_ZOOM`, `markerMinZoom` |
| Kultowe miejsca | od 1950 | to głównie PRL i później | — | `CULT_FROM` |

## Epoki (`src/rules/epochs.ts`, `src/rules/milestones.ts`)

| Reguła | Co robi | Dlaczego | Wyjątki / uwagi | Gdzie |
| --- | --- | --- | --- | --- |
| Rok budowy rozstrzyga | budynek z datą jest widoczny od swojego roku | jedyna pewna informacja | daty ma ~2,5% budynków | `src/history/epochs.ts` `epochScene` |
| Gród | przed 1242: wał z palisadą wokół zachodniej części Ostrowa, rekonstrukcja katedry, św. Marcina, palatium i ok. 70 chat; budynki z OSM ukryte; do 1300 sam wał z resztkami palisady | miasto lokacyjne powstało później; wymiary katedry i przebieg wału z literatury | obwód odrysowany z dzisiejszych brzegów | `LOCATION_YEAR`, `GROD`, `GROD_RAMPART_UNTIL` |
| W murach | bez daty: kościoły i bryły < 18 m (średniowiecze) / < 24 m (twierdza) | wyższe to XIX-wieczne kamienice i bloki | poza murami tylko kościoły do 400 m od katedry (Ostrów Tumski, Piasek) | `WALLED_MAX_H`, `CATHEDRAL_RADIUS` |
| Przed 1945 | zasięg zabudowy od Rynku: 1300 m (< 1850), 2600 m (< 1905), 3200 m | rozrost miasta w XIX w. | Stare Miasto: chowamy tylko bryły ≥ 28 m (oprócz kościołów i publicznych) | `prewarRadius`, `OLD_TOWN_MAX_H` |
| Wygląda na powojenne | > 35 m, albo > 17 m / handel / mieszkalny > 12 m bez starego dachu | przedwojenny Wrocław nie miał wysokościowców | kościoły nigdy; dachy dwuspadowe, mansardowe, hełmy = stare | `looksPostwar` |
| Wygląda na późniejsze | szkło/lustro, biurowiec > 20 m albo > 4000 m² przed 2000; > 100 m przed 2010 | galerie i biurowce to głównie lata 2001–2010 (Dominikańska 2001, Arkady i Magnolia 2007); Sky Tower 2012 | kominy wyjątkiem; od 2020 bez filtra | `looksLaterThan` |
| Kamienie milowe | kolej 1842, tramwaj 1877, auta 1925, stadion 1928, żużel 1988, krasnale 2001, „dziś” od 2020 | warstwy istnieją od tych lat | — | `SINCE` |
| Plany historyczne | przed 1242: sama woda z najstarszych planów (`early`); 1732 w 1242–1807, 1895 w 1850–1909, Pharus 1901–1914 w 1910–1944, plan z 1947 w 1945–1950 (w 1945 tylko podkład); w zasięgu planu łąka i budynki bez daty tylko na zabudowie planu; woda epoki: przed 1897 r. Odra z planu 1895 (z detalem z 1732 tylko blisko niej), później plan epoki i plany najbliższe w czasie, dzisiejsze rzeki tylko poza wszystkimi planami, od 1897 r. dzisiejsze kanały i porty; przerwy w korytach do 35 m (mosty) zamykane | każda epoka pokazuje układ miasta i bieg rzek ze swojego czasu | plany ułożone z dokładnością ok. 5–30 m; scripts/bake/bake-plans.py | `HISTORY_PLANS`, `historyPlanFor`, `MASK` |

## Wydajność (`src/rules/render.ts`)

| Reguła | Co robi | Dlaczego | Wyjątki / uwagi | Gdzie |
| --- | --- | --- | --- | --- |
| LOD kafli | uproszczone bryły poniżej zoomu 0.55, pełne powyżej 0.65; ≤ 4 przebudowy na klatkę | histereza zapobiega miganiu; budżet — przycięciom | — | `LOD_IN`, `LOD_OUT`, `LOD_BUDGET` |
| Daleki widok | ludzie, auta < 0.55; drzewa < 0.35; pomniki < 0.3 — nie liczymy | mniejsze niż piksel | — | `FAR_ZOOM`, `TREES_MIN_ZOOM`, `MONUMENTS_MIN_ZOOM` |
| Tryb oszczędny | < 24 kl./s przez 4 s → piksel +0.5 (do 3), potem bez cieni | słabe urządzenia | karta w tle się nie liczy | `SAVER_*`, `PIXEL_*`; `src/app/saver.ts` |

## Inne skrypty

| Reguła | Co robi | Dlaczego | Gdzie |
| --- | --- | --- | --- |
| Pomniki: filtr | bez tablic, krasnali, grobów; `historic=memorial` bez rodzaju i Wiki pomijany | to zwykle tablice | `scripts/bake/bake-monuments.ts` `SKIP_MEMORIAL` |
| Pomniki: rodzaj i materiał | z `memorial`/`artwork_type`; kolumna → obelisk, głaz → stela; figura bez materiału = brąz | domyślny wygląd | `kindOf`, `materialOf` |
| Pomniki: duplikaty | ta sama nazwa albo Wikidane < 40 m → jeden, bogatszy opis | punkt i obszar tego samego pomnika | `kept` |
| Tramwaje: przyciąganie | trasy GTFS zagęszczone co 4 m i przyciągnięte do torów OSM do 30 m | kształty GTFS są uproszczone | `scripts/bake/bake-gtfs.ts` `snap` |
| Latarnie gazowe | brak latarni w OSM → co 12 m na przemian po obu stronach ul. Katedralnej | latarnie gazowe nie są oznaczone | `scripts/bake/bake-scenes.ts` |
| Teren | węzły < 50 m n.p.m. to dziury WCS → średnia sąsiadów | WCS zwraca 0 na szwach arkuszy | `scripts/fetch/fetch-terrain.ts` |
