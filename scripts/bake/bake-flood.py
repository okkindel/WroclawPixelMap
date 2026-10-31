# Zasięg powodzi 1997 we Wrocławiu z mapy Urzędu Miejskiego (zasięg zalania zaznaczony jasnoniebieskim tłem),
# opublikowanej we fragmentach przez wro.city („Tak był zalany Wrocław. Mapa powodzi 1997”).
# Bierzemy z mapy tylko zasięg (wielokąty w metrach lokalnych), nie sam obraz.
#
# Georeferencja (jednorazowa, wynik w stałych poniżej):
#  - fragmenty są wycinkami jednej mapy w tej samej skali (SIFT: czyste przesunięcia między nimi),
#  - położenie każdego fragmentu z dopasowania koryt (kolor rzeki na mapie) do dzisiejszej wody
#    (data/plans/water-today.json), skala 10.25 m/px, potem ECC afinicznie na całej mozaice (zgodność ok. 0.58),
#  - fragment 0 (Leśnica, Jarnołtów) leży w całości poza obszarem mapy i jest pominięty.
#
# Wejście: data/plans/flood1997/powodz{1..4}.jpg (pobierane, gdy brak), zasięg mapy z data/plans/water-today.json. Wyjście: public/data/history/flood1997.json
# Użycie: PYTHONPATH=<numpy, opencv, pillow> python3 scripts/bake/bake-flood.py
import json, os, urllib.request
import numpy as np, cv2
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(REPO, 'data/plans/flood1997')
OUT = os.path.join(REPO, 'public/data/history/flood1997.json')
URL = 'https://wro.city/wp-content/uploads/2024/07/powodz{}.jpg'

# lewy górny róg fragmentu w pikselach mozaiki
OFFSET = {1: (0, 111), 2: (794, 0), 3: (31, 791), 4: (807, 800)}
# wymiary fragmentów (szer., wys.), dla których wyznaczono OFFSET i T: inny plik dałby przesunięty zasięg
SHAPE = {1: (806, 681), 2: (1091, 807), 3: (777, 838), 4: (1078, 833)}
# piksel mozaiki -> metry lokalne (x = wschód, y = północ)
T = np.array([[10.23429, 0.026005, -10490.74], [0.009383, -10.27368, 8383.59]])
SIZE = (1885, 1633)

# progi w metrach kwadratowych
SPECK_M2 = 25000  # mniejsze plamy jasnoniebieskiego to stawy i baseny, nie zalanie
HOLE_M2 = 40000  # mniejsze dziury w zalaniu to budynki i napisy mapy


def fetch(i):
    path = os.path.join(SRC, f'powodz{i}.jpg')
    if not os.path.exists(path):
        os.makedirs(SRC, exist_ok=True)
        req = urllib.request.Request(URL.format(i), headers={'User-Agent': 'WroclawPixelMap bake'})
        # najpierw do pliku tymczasowego: przerwane pobieranie nie zostawia niepełnego obrazu
        with urllib.request.urlopen(req, timeout=60) as r, open(path + '.part', 'wb') as f:
            f.write(r.read())
        os.replace(path + '.part', path)
    im = Image.open(path)
    if im.size != SHAPE[i]:
        raise SystemExit(f'{path}: {im.size}, oczekiwano {SHAPE[i]}; georeferencja dotyczy innego obrazu')
    return np.array(im.convert('RGB'))


def mosaic():
    W, H = SIZE
    canvas = np.full((H, W, 3), 255, np.uint8)
    for i in (1, 3, 2, 4):
        im = fetch(i)
        x, y = OFFSET[i]
        canvas[y:y + im.shape[0], x:x + im.shape[1]] = im
    return canvas


def flood_mask(im):
    # zalanie i rzeki: tło przyciemnione na niebiesko (B wyraźnie ponad R); zostawiamy cienkie linie siatki mapy poza
    im = im.astype(int)
    R, B = im[..., 0], im[..., 2]
    # autostrady i drogi ekspresowe mapa rysuje ciemnym niebieskim (R poniżej ok. 140): to nie woda
    road = cv2.dilate(((R < 140) & (B - R > 30)).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    m = ((B - R > 12) & (B > 150) & ~road).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    # droga w środku zalania jest zalana, gdy woda stoi po obu jej stronach
    m[road & (cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8)) > 0)] = 255
    # najpierw tylko obszar mapy (mozaika sięga dalej), potem progi pól: plama ucięta brzegiem mapy też musi być duża,
    # a sucha kieszeń przy brzegu łączy się z obszarem poza mapą i nie jest zalewana
    bx0, by0, bx1, by1 = json.load(open(os.path.join(REPO, 'data/plans/water-today.json')))['bounds']
    ys, xs = np.mgrid[0:m.shape[0], 0:m.shape[1]]
    X = xs * T[0, 0] + ys * T[0, 1] + T[0, 2]
    Y = xs * T[1, 0] + ys * T[1, 1] + T[1, 2]
    m[(X < bx0) | (X > bx1) | (Y < by0) | (Y > by1)] = 0
    m = cv2.copyMakeBorder(m, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    px = abs(np.linalg.det(T[:, :2]))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    keep = np.zeros(n, bool)
    keep[1:] = st[1:, cv2.CC_STAT_AREA] * px >= SPECK_M2
    m = keep[lab].astype(np.uint8) * 255
    n, lab, st, _ = cv2.connectedComponentsWithStats(255 - m, connectivity=4)
    small = np.zeros(n, bool)
    small[1:] = st[1:, cv2.CC_STAT_AREA] * px < HOLE_M2
    small[lab[0, 0]] = False  # obszar poza mapą
    m[small[lab]] = 255
    m = m[1:-1, 1:-1].copy()
    return m


def polygons(m):
    contours, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    to_m = lambda c: (c.reshape(-1, 2).astype(float) @ T[:, :2].T + T[:, 2]).round(1)
    for k, c in enumerate(contours):
        if hier[0][k][3] != -1:
            continue
        c = cv2.approxPolyDP(c, 1.0, True)
        if len(c) < 3 or cv2.contourArea(c) * abs(np.linalg.det(T[:, :2])) < SPECK_M2:
            continue
        holes = []
        h = hier[0][k][2]
        while h != -1:
            hc = cv2.approxPolyDP(contours[h], 1.0, True)
            if len(hc) >= 3:
                holes.append(to_m(hc).ravel().tolist())
            h = hier[0][h][0]
        out.append({'o': to_m(c).ravel().tolist(), 'h': holes} if holes else {'o': to_m(c).ravel().tolist()})
    return out


if __name__ == '__main__':
    polys = polygons(flood_mask(mosaic()))
    with open(OUT, 'w') as f:
        json.dump(polys, f, separators=(',', ':'))
    print(len(polys), 'wielokątów ->', os.path.relpath(OUT, REPO))
