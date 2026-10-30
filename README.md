# Wrocław w pikselach

Interaktywna pikselowa mapa 3D Wrocławia: od grodu na Ostrowie Tumskim po dziś, z osią czasu, krasnalami i ciekawostkami.
Strona: https://okkindel.github.io/projects/wroclaw-w-pikselach/

TypeScript + Vite + three.js.

## Funkcje

- oś czasu 15 epok (od grodu na Ostrowie Tumskim, przez twierdzę i Festung Breslau, po dziś) z podkładem planu miasta z ok. 1732 r.,
- krasnale do kolekcjonowania (ponad 650 z OpenStreetMap),
- tramwaje według rozkładu GTFS MPK Wrocław, a także Polinka, pociągi i statki na Odrze,
- scenki: jarmark na Rynku, fajerwerki, latarnik na Ostrowie Tumskim, mecz na Tarczyński Arena, żużel na Olimpijskim,
- neony z galerii przy Ruskiej i z miasta,
- pomniki z OSM i Wikidanych, najbardziej znane modelowane ręcznie,
- kilkaset ciekawostek ze źródłami, opisy i zdjęcia z Wikipedii,
- wersja polska i angielska (`?lang=en`),
- PWA (działa jako aplikacja i offline po pierwszym wczytaniu).

## Struktura repozytorium

- `content/` — treści w JSON, oba języki obok siebie: epoki, zabytki, ciekawostki, neony, mury, smaczki.
- `src/` — aplikacja:
  - `app/` — składanie mapy: napisy, klikanie, widok i kamera, wyszukiwarka, tryb oszczędny,
  - `content/` — wczytanie treści z `content/` w bieżącym języku,
  - `engine/` — rzutowanie, paleta, filtr pikselowy, słońce, wczytywanie danych,
  - `history/` — sceny epok (mury, bastiony, powódź, dym, pas startowy),
  - `i18n/` — słownik PL/EN,
  - `layers/` — krasnale, neony, pomniki, napisy,
  - `life/` — ruch: auta, ludzie, pociągi, tramwaje z rozkładu, ptaki, chmury,
  - `rules/` — heurystyki przeglądarki (epoki, progi napisów, LOD, tryb oszczędny),
  - `scenes/` — scenki (jarmark, fajerwerki, latarnik, mecz, żużel, statki),
  - `styles/` — CSS,
  - `types/` — formaty danych wspólne ze skryptami,
  - `ui/` — panel, okienka, wyszukiwarka,
  - `world/` — kafle, budynki, teren, konstrukcje, format binarny kafli.
- `scripts/` — skrypty danych (Node uruchamia `.ts` bezpośrednio):
  - `fetch/` — pobieranie do `data/` (Overpass, GUGiK, SLUB, GTFS; `geofabrik.py`),
  - `bake/` — wypiekanie do `public/data/` (`bake.ts` z etapami w `bake/world/`),
  - `lib/` — wspólne: konfiguracja obszaru, rzutowanie, Overpass z ponawianiem, heurystyki (`rules.ts`),
  - `test/` — test formatu kafli.
- `public/data/` — wypieczone dane (kafle, `meta.json`, pomniki, rozkład, opisy z Wikipedii, plan 1732).
- `docs/HEURISTICS.md` — wszystkie reguły zgadywania (wysokości, daty, napisy, epoki): co robią, dlaczego i gdzie są.

## Uruchomienie

```bash
npm install
npm run dev      # serwer deweloperski; gotowe dane są w public/data
npm run build    # sprawdzenie typów + build do dist/
npm run lint     # Biome (src, scripts)
npm run format   # formatowanie Biome
```

## Odtworzenie danych od zera

Surowe dane trafiają do `data/` (poza repozytorium). Kolejność:

```bash
npm run fetch           # sieć: OSM z Overpass → data/raw (w kawałkach, pomija pobrane; --force od nowa)
npm run bake            # → public/data: kafle + meta.json
npm run fetch-ortho     # sieć: ortofotomapa GUGiK → data/ortho (kolory dachów; potrzebuje meta.json)
npm run lod2            # sieć (gdy brak paczki w data/lod2): modele LoD1 GUGiK → data/lod2 (wysokości)
npm run bake            # ponownie: z kolorami dachów i wysokościami
npm run fetch-gtfs      # sieć: rozkład MPK → data/gtfs
npm run bake-gtfs       # → public/data/trams.json
npm run bake-monuments  # sieć przy pierwszym uruchomieniu (Overpass, Wikidane, Commons; potem z pamięci w data/raw)
npm run bake-scenes     # sieć przy pierwszym uruchomieniu (Overpass) → public/data/scenes.json
npm run bake-wiki       # sieć przy pierwszym uruchomieniu (Wikipedia, Commons) → public/data/wiki.json
npm run fetch-history   # sieć: plany historyczne SLUB → data/history
npm run bake-history    # → public/data/history (tylko plan z ok. 1732 na otwartej licencji)
```

Opcjonalnie: `npm run fetch-terrain` (sieć, model terenu GUGiK) i `npm run test-tilecodec` (test formatu kafli).
Rejestr zabytków NID (daty budowy) czyta się z `data/nid/zrn-utf8.csv` pobranego z dane.gov.pl; bez niego `bake` pomija ten krok.

Gdy Overpass jest przeciążony, dane świata można wyciąć z pliku województwa z Geofabrik:
`python3 scripts/fetch/geofabrik.py` (wymaga `pip install osmium`, instrukcja w nagłówku skryptu).

## Dane i licencje

- `public/data` to baza pochodna OpenStreetMap, udostępniona na licencji
  [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). © współtwórcy OpenStreetMap.
- Kolory dachów: przetworzona ortofotomapa © GUGiK, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Wysokości budynków: przetworzone Modele 3D budynków LoD1 2024 © GUGiK, CC BY 4.0 (`npm run lod2`).
- Plan miasta ok. 1732 (`public/data/history`): SLUB Dresden / Deutsche Fotothek, CC BY-SA 4.0 (kafle przetworzone, ta sama licencja).
- Daty budowy: rejestr zabytków nieruchomych NID (dane.gov.pl), dane przetworzone.
- Rozkład tramwajów: przetworzony GTFS MPK Wrocław (Otwarte Dane Wrocław, kopia Mobility Database).
- Opisy i zdjęcia: Wikipedia (CC BY-SA) i Wikimedia Commons (licencje plików, z autorami podanymi w okienkach).

## Licencja kodu

Wszelkie prawa zastrzeżone — szczegóły w pliku [LICENSE](LICENSE).

## Autor

Maciej Hajduk ([okkindel](https://github.com/okkindel)).
