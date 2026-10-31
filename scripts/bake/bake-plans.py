# Historyczne plany miasta (data/plans/<id>: tiles/I_J.jpg w stylu mapy, classes/I_J.png z klasami) do aplikacji:
# public/data/history/<id>/I_J.png (512 px, z przezroczystością), water.json (woda epoki), built.png (maska zabudowy) i index.json.
#
#  - Kafle: woda planu przezroczysta (pod spodem rysujemy ją jako wodę 3D), brzeg planu przechodzi w łąkę
#    ditherowanym pasem FADE_M metrów.
#  - Woda epoki: woda z planu blisko jego zabudowy, dzisiejsze rzeki dalej; w pasie na granicy obie naraz,
#    żeby rzeka nie urywała się na krawędzi arkusza.
#  - Maska zabudowy (MASK_M m/px, cała mapa): 255 kwartał lub gmach z planu, 128 woda planu, 0 reszta zasięgu planu,
#    1 poza planem. Aplikacja zostawia w zasięgu planu tylko budynki bez daty stojące na zabudowie (src/app/apply.ts).
#
# Klasy (classes/I_J.png): 0 poza planem, 1 ulica, 2 kwartał, 3 gmach, 4 woda, 5 zieleń, 6 ruiny.
# Użycie: python3 scripts/bake/bake-plans.py   (potrzebuje numpy, opencv-python, pillow; najpierw node scripts/bake/export-water.ts)
import json
import os
import shutil
import sys

import cv2
import numpy as np
from PIL import Image

PLANS = {  # rok, od którego w planie są kanały i porty (późniejsza woda z dzisiejszej mapy poza zasięgiem planu)
    '1732': {'late_water': False, 'trust': 200},  # arkusz kończy się tuż za miastem, odnogi urywają się na jego brzegu
    '1895': {'late_water': True},
    'pharus1914': {'late_water': True},
    'plan1947': {'late_water': True},
}
TILE_PX = 1000  # kafle źródłowe: 1 m/px
OUT_PX = 512
FADE_M = 200
BLEND_M = 250  # pas przy granicy wiarygodnej wody planu, w którym woda z planu i dzisiejsza są sumowane
TRUST_M = 500  # woda z planu obowiązuje do tylu metrów od jego zabudowy (plan może podać mniej: 'trust')
WATER_M = 2  # rozdzielczość rastra wody (m/px)
PALETTE_COLORS = 48  # kolory kafla PNG (plan ma płaskie kolory klas i tusz)
KEY = (255, 0, 255)  # kolor przezroczystości w palecie
MASK_M = 4
WATER, BUILT_A, BUILT_B, OUTSIDE = 4, 2, 3, 0

today = json.load(open('data/plans/water-today.json'))
bx0, by0, bx1, by1 = today['bounds']
T = today['tile']
NI, NJ = int(np.ceil((bx1 - bx0) / T)), int(np.ceil((by1 - by0) / T))
W, H = NI * T, NJ * T  # cała siatka kafli w metrach


def load(plan_dir, sub, ext, flag):
    """Mozaika całej siatki w 1 m/px (wiersz 0 = północ) z kafli I_J; brak kafla = None."""
    out = None
    for f in os.listdir(f'{plan_dir}/{sub}'):
        if not f.endswith(ext):
            continue
        i, j = map(int, f[: -len(ext)].split('_'))
        im = cv2.imread(f'{plan_dir}/{sub}/{f}', flag)
        if out is None:
            out = np.zeros((H, W) + im.shape[2:], im.dtype) if flag == cv2.IMREAD_UNCHANGED else np.full((H, W, 3), 255, np.uint8)
        y = (NJ - 1 - j) * T
        out[y : y + T, i * T : i * T + T] = im
    return out


def today_water(late):
    """Dzisiejsza woda jako raster WATER_M m/px."""
    s = 1 / WATER_M
    img = np.zeros((int(H * s), int(W * s)), np.uint8)
    to_px = lambda flat: np.round(np.stack([(np.array(flat[0::2]) - bx0) * s, (by0 + H - np.array(flat[1::2])) * s], -1) * 8).astype(np.int32)
    for w in today['water']:
        if w.get('late') and not late:
            continue
        cv2.fillPoly(img, [to_px(w['o'])], 255, cv2.LINE_8, shift=3)
        for h in w.get('h') or []:
            cv2.fillPoly(img, [to_px(h)], 0, cv2.LINE_8, shift=3)
    return img


def polygons(mask):
    """Wielokąty (metry lokalne, płaskie [x, y, ...]) z rastra WATER_M m/px, z dziurami."""
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    to_m = lambda c: [round(v, 1) for p in c.reshape(-1, 2) for v in (bx0 + (p[0] + 0.5) * WATER_M, by0 + H - (p[1] + 0.5) * WATER_M)]
    for k, c in enumerate(cs):
        if hier[0][k][3] != -1 or cv2.contourArea(c) < 20:
            continue
        o = cv2.approxPolyDP(c, 0.75, True)
        if len(o) < 3:
            continue
        holes = []
        ch = hier[0][k][2]
        while ch != -1:
            hc = cv2.approxPolyDP(cs[ch], 0.75, True)
            if len(hc) >= 3 and cv2.contourArea(hc) >= 20:
                holes.append(to_m(hc))
            ch = hier[0][ch][0]
        out.append({'o': to_m(o), 'h': holes} if holes else {'o': to_m(o)})
    return out


def bake(pid, spec):
    src = f'data/plans/{pid}'
    dst = f'public/data/history/{pid}'
    if not os.path.isdir(f'{src}/classes'):
        return None
    cls = load(src, 'classes', '.png', cv2.IMREAD_UNCHANGED)
    col = load(src, 'tiles', '.jpg', cv2.IMREAD_COLOR)
    inside = (cls != OUTSIDE).astype(np.uint8)
    # odległość od brzegu planu (m) w jego zasięgu
    edge = cv2.distanceTransform(np.pad(inside, 1), cv2.DIST_L2, 5)[1:-1, 1:-1]

    # Kafle PNG z przezroczystością: przezroczyste poza planem i na wodzie planu (pod spodem woda 3D). Kolor zmniejszamy
    # z wagą krycia (bez mieszania z bielą), a pas brzegowy ditherujemy Bayerem dopiero w docelowej rozdzielczości,
    # piksel w piksel: krycie jest zero-jedynkowe, bez szarych obwódek.
    bayer = np.array([[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38],
                      [60, 28, 52, 20, 62, 30, 54, 22], [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
                      [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]]) / 64
    opaque = ((inside > 0) & (cls != WATER)).astype(np.float32)
    rgb = cv2.cvtColor(col, cv2.COLOR_BGR2RGB).astype(np.float32)

    if os.path.isdir(dst):
        shutil.rmtree(dst)
    os.makedirs(dst)
    tiles = []
    k = T / OUT_PX
    for j in range(NJ):
        for i in range(NI):
            y = (NJ - 1 - j) * T
            sl = (slice(y, y + T), slice(i * T, i * T + T))
            a = opaque[sl]
            if a.mean() < 0.002:
                continue
            a_s = cv2.resize(a, (OUT_PX, OUT_PX), interpolation=cv2.INTER_AREA)
            c_s = cv2.resize(rgb[sl] * a[..., None], (OUT_PX, OUT_PX), interpolation=cv2.INTER_AREA) / np.maximum(a_s[..., None], 1e-3)
            e_s = cv2.resize(edge[sl], (OUT_PX, OUT_PX), interpolation=cv2.INTER_AREA)
            yy, xx = np.indices((OUT_PX, OUT_PX))
            fade = np.clip(e_s / FADE_M, 0, 1)
            keep = (a_s >= 0.5) & (fade > bayer[(yy + y // 2) % 8, (xx + i * OUT_PX) % 8])
            # PNG z paletą (płaskie kolory planu): przezroczystość to osobny kolor palety (magenta)
            out = np.clip(c_s, 0, 255).astype(np.uint8)
            out[~keep] = KEY
            pal = Image.fromarray(out, 'RGB').quantize(colors=PALETTE_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
            key = pal.getpalette()[: PALETTE_COLORS * 3]
            idx = min(range(len(key) // 3), key=lambda n: sum((key[n * 3 + c] - KEY[c]) ** 2 for c in range(3)))
            pal.save(f'{dst}/{i}_{j}.png', optimize=True, transparency=idx)
            tiles.append(f'{i}_{j}')

    # Woda epoki. Plan rozstrzyga o wodzie tylko blisko swojej zabudowy (TRUST_M m od kwartałów i gmachów): tam rysunek
    # rzek jest wiarygodny, a dalej na polach bywa umowny i urywa się na brzegu arkusza. Poza tym obszarem dzisiejsze
    # rzeki; w pasie BLEND_M m przy granicy obie wody naraz, żeby koryta się łączyły.
    s = WATER_M
    small = lambda m, interp=cv2.INTER_NEAREST: cv2.resize(m, (W // s, H // s), interpolation=interp)
    cls_w = small(cls)
    built_w = ((cls_w == BUILT_A) | (cls_w == BUILT_B)).astype(np.uint8)
    near_built = cv2.distanceTransform(1 - built_w, cv2.DIST_L2, 5) * s < spec.get('trust', TRUST_M)
    trust = (near_built & (cls_w != OUTSIDE)).astype(np.uint8)
    trust_edge = cv2.distanceTransform(np.pad(trust, 1), cv2.DIST_L2, 5)[1:-1, 1:-1] * s
    plan_w = (cls_w == WATER).astype(np.uint8) * 255
    tw = today_water(spec['late_water'])
    water = np.where(trust > 0, plan_w, tw)
    band = (trust > 0) & (trust_edge < BLEND_M)
    water[band] |= tw[band]
    water = cv2.morphologyEx(water, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    json.dump(polygons(water), open(f'{dst}/water.json', 'w'), separators=(',', ':'))

    # maska zabudowy
    m = MASK_M
    mask = np.ones((H // m, W // m), np.uint8)
    cls_s = cv2.resize(cls, (W // m, H // m), interpolation=cv2.INTER_NEAREST)
    # zabudowa poszerzona o piksel (budynki na granicy kwartału), ale tylko na lądzie w zasięgu planu
    built = cv2.dilate(((cls_s == BUILT_A) | (cls_s == BUILT_B)).astype(np.uint8), np.ones((3, 3), np.uint8))
    mask[cls_s != OUTSIDE] = 0
    mask[(built > 0) & (cls_s != OUTSIDE) & (cls_s != WATER)] = 255
    mask[cls_s == WATER] = 128
    Image.fromarray(mask).save(f'{dst}/built.png', optimize=True)
    size = sum(os.path.getsize(f'{dst}/{f}') for f in os.listdir(dst))
    print(f'{pid}: {len(tiles)} kafli, {size / 1e6:.1f} MB')
    return {'tiles': tiles, 'mask': m}


# Wypieka wybrane plany (argumenty) albo wszystkie; wpisy niewybranych zostają w spisie, a katalogi planów spoza PLANS
# są usuwane tylko przy pełnym przebiegu.
OUT = 'public/data/history'
os.makedirs(OUT, exist_ok=True)
old = json.load(open(f'{OUT}/index.json')) if os.path.exists(f'{OUT}/index.json') else {}
chosen = sys.argv[1:] or list(PLANS)
index = {pid: old[pid] for pid in PLANS if pid not in chosen and pid in old}
for pid in chosen:
    r = bake(pid, PLANS[pid])
    if r:
        index[pid] = r
if not sys.argv[1:]:
    for d in os.listdir(OUT):
        if os.path.isdir(f'{OUT}/{d}') and d not in PLANS:
            shutil.rmtree(f'{OUT}/{d}')
json.dump(index, open(f'{OUT}/index.json', 'w'))
