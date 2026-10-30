# Zastępcze źródło danych OSM: wycina obszar mapy z pliku województwa z Geofabrik
# (data/geofabrik/dolnoslaskie-latest.osm.pbf) do data/raw/world-geofabrik.json w formacie Overpass (`out geom`).
# Te same filtry co zapytanie `world` w scripts/fetch-osm.ts. Wymaga: pip install osmium
#   curl -L -o data/geofabrik/dolnoslaskie-latest.osm.pbf https://download.geofabrik.de/europe/poland/dolnoslaskie-latest.osm.pbf
#   python3 scripts/geofabrik.py
import json
import re
import sys

import osmium

PBF = 'data/geofabrik/dolnoslaskie-latest.osm.pbf'
OUT = 'data/raw/world-geofabrik.json'
S, W, N, E = 51.075, 16.917011, 51.15, 17.14  # jak BBOX w scripts/config.ts


def way_match(t):
    if 'building' in t or 'highway' in t:
        return True
    if t.get('natural') == 'water' or t.get('waterway') == 'riverbank':
        return True
    if re.fullmatch(r'park|garden|pitch|playground|stadium', t.get('leisure', '')):
        return True
    if re.fullmatch(r'grass|forest|cemetery|meadow|recreation_ground|allotments|village_green', t.get('landuse', '')):
        return True
    if re.fullmatch(r'wood|scrub|grassland', t.get('natural', '')):
        return True
    if re.fullmatch(r'rail|tram|light_rail', t.get('railway', '')):
        return True
    return t.get('place') == 'square' or t.get('barrier') == 'city_wall' or t.get('historic') == 'citywalls' or t.get('man_made') == 'bridge'


def rel_match(t):
    if 'building' in t or t.get('natural') in ('water', 'wood') or t.get('waterway') == 'riverbank':
        return True
    if re.fullmatch(r'park|garden', t.get('leisure', '')) or re.fullmatch(r'grass|forest|cemetery|meadow', t.get('landuse', '')):
        return True
    return t.get('place') == 'square'


def inside(lat, lon):
    return S <= lat <= N and W <= lon <= E


class Relations(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rels, self.members = [], set()

    def relation(self, r):
        t = dict(r.tags)
        if not rel_match(t):
            return
        mem = [{'type': 'way', 'ref': m.ref, 'role': m.role} for m in r.members if m.type == 'w']
        if mem:
            self.rels.append({'type': 'relation', 'id': r.id, 'tags': t, 'members': mem})
            self.members.update(m['ref'] for m in mem)


class Ways(osmium.SimpleHandler):
    def __init__(self, members):
        super().__init__()
        self.members, self.out, self.geom = members, [], {}

    def node(self, n):
        if n.tags.get('natural') == 'tree' and n.location.valid() and inside(n.location.lat, n.location.lon):
            self.out.append({'type': 'node', 'id': n.id, 'lat': n.location.lat, 'lon': n.location.lon, 'tags': dict(n.tags)})

    def way(self, w):
        want = way_match(w.tags)
        if not want and w.id not in self.members:
            return
        g = [{'lat': n.lat, 'lon': n.lon} if n.location.valid() else None for n in w.nodes]
        if w.id in self.members:
            self.geom[w.id] = g
        if want and any(p and inside(p['lat'], p['lon']) for p in g):
            self.out.append({'type': 'way', 'id': w.id, 'tags': dict(w.tags), 'geometry': g})


rh = Relations()
rh.apply_file(PBF)
print(f'relacje pasujące: {len(rh.rels)}', file=sys.stderr)
wh = Ways(rh.members)
wh.apply_file(PBF, locations=True, idx='flex_mem')
rels = []
for r in rh.rels:
    for m in r['members']:
        m['geometry'] = wh.geom.get(m['ref'])
    pts = [p for m in r['members'] if m['geometry'] for p in m['geometry'] if p]
    if any(inside(p['lat'], p['lon']) for p in pts):
        r['members'] = [m for m in r['members'] if m['geometry']]
        rels.append(r)
elements = wh.out + rels
with open(OUT, 'w') as f:
    json.dump({'elements': elements}, f)
print(f'{OUT}: {len(elements)} elementów ({len(wh.out)} punktów/linii, {len(rels)} relacji)', file=sys.stderr)
