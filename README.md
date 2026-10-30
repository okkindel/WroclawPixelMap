# Wrocław w pikselach

Interaktywna pikselowa mapa 3D Wrocławia: od grodu na Ostrowie Tumskim po dziś. Oś czasu z epokami trzech państw,
warstwa krasnali do kolekcjonowania, tramwaje, pociągi, Polinka, żużel na Olimpijskim i kilkaset ciekawostek.

TypeScript + Vite + three.js. Dane: © współtwórcy OpenStreetMap (ODbL), ortofotomapa © GUGiK (CC BY 4.0).

```bash
npm install
npm run dev          # gotowe dane są w public/data
```

Odtworzenie danych od zera:

```bash
npm run fetch        # OSM z Overpass → data/raw (w kawałkach, pomija pobrane)
npm run bake         # → public/data (meta.json + kafle)
npm run fetch-ortho  # zdjęcia lotnicze GUGiK → data/ortho (kolory dachów)
npm run bake
```

## Licencje danych

- `public/data` to baza pochodna OpenStreetMap, udostępniona na licencji
  [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). © współtwórcy OpenStreetMap.
- Kolory dachów: przetworzona ortofotomapa © GUGiK, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Rozkład tramwajów: przetworzony GTFS MPK Wrocław (Otwarte Dane Wrocław, kopia Mobility Database).
