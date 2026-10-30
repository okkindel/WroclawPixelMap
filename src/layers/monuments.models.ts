// Ręczne modele najbardziej znanych pomników (zamiast generycznej bryły z monuments.ts).
// Każdy model: przodem wzdłuż +X, w metrach, podstawa na y = 0; kolory w wierzchołkach.
// angle: kierunek „przodu” na mapie (stopnie, 0 = wschód, przeciwnie do zegara), wyznaczony z dróg wokół.
import * as THREE from 'three'
import { merge } from '../world/geometry.ts'
import { box } from '../scenes/util.ts'

type Part = [THREE.BufferGeometry, string]

// Prostopadłościan obrócony wokół osi Z (pochylenie w płaszczyźnie przód–góra), środek w (x, y, z).
function tilt(l: number, h: number, w: number, x: number, y: number, z: number, rz: number) {
  return new THREE.BoxGeometry(l, h, w).rotateZ(rz).translate(x, y, z)
}

// Aleksander Fredro (Rynek, L. Marconi 1897): siedzi w fotelu, brąz z zieloną patyną na wysokim cokole
// z czerwonego piaskowca; stoi przy południowej pierzei, przodem na południe.
function fredro() {
  const S = '#8e5446', S2 = '#7a4639', B = '#5f9e8c', B2 = '#4c8070'
  const p: Part[] = [
    [box(3.4, 0.3, 3.4, 0, 0), '#9b968c'], // płyta z ogrodzeniem
    [box(2.6, 0.6, 2.6, 0, 0.3), S2],
    [box(2.0, 2.4, 2.0, 0, 0.9), S],
    [box(0.06, 1.1, 1.1, 1.0, 1.8), S2], // tablica z napisem
    [box(2.5, 0.35, 2.5, 0, 3.3), S2],
    [box(2.1, 0.25, 2.1, 0, 3.65), S],
    // figura
    [box(1.6, 0.15, 1.4, 0, 3.9), B2],
    [box(0.9, 0.9, 1.3, -0.3, 4.05), B2], // fotel z opadającą czamarą
    [box(0.25, 1.5, 1.2, -0.72, 4.05), B2], // oparcie
    [box(0.3, 0.9, 0.3, 0.4, 4.05, -0.2), B], [box(0.3, 0.9, 0.3, 0.4, 4.05, 0.2), B], // goleni
    [box(0.85, 0.3, 0.75, 0.15, 4.9), B], // uda
    [box(0.5, 0.95, 0.75, -0.3, 5.15), B], // tułów
    [box(0.55, 0.2, 0.18, 0.1, 5.2, 0.44), B], [box(0.55, 0.2, 0.18, 0.1, 5.2, -0.44), B], // przedramiona na kolanach
    [box(0.18, 0.5, 0.18, 0.3, 5.3, 0.44), B2], // zwój papieru w dłoni
    [box(0.18, 0.1, 0.18, -0.28, 6.1), B],
    [box(0.32, 0.38, 0.32, -0.25, 6.2), B], // głowa
  ]
  return merge(p)
}

// Bolesław Chrobry (2007): pomnik konny, ciemny brąz na szarym granitowym cokole z brązową wstęgą,
// prawa przednia noga konia uniesiona, król z włócznią; ok. 10 m z cokołem.
function chrobry() {
  const G = '#a3a29c', G2 = '#8c8b85', B = '#4a4843', B2 = '#3a3935'
  const p: Part[] = [
    [box(6.2, 0.4, 3.4, 0, 0), G2],
    [box(5.4, 3.6, 2.6, 0, 0.4), G],
    [box(5.46, 0.6, 2.66, 0, 2.7), B2], // wstęga z brązu z płaskorzeźbami
    [box(5.7, 0.3, 2.9, 0, 4.0), G2],
    // koń
    [box(0.38, 2.1, 0.38, -1.35, 4.3, -0.42), B], [box(0.38, 2.1, 0.38, -1.35, 4.3, 0.42), B], // tylne nogi
    [box(0.38, 2.1, 0.38, 1.3, 4.3, -0.42), B], // lewa przednia
    [box(0.36, 0.9, 0.36, 1.35, 5.5, 0.42), B], // prawa przednia uniesiona: ramię…
    [tilt(0.8, 0.32, 0.34, 1.75, 5.5, 0.42, 0.5), B], // …i zgięta pęcina
    [box(3.5, 1.45, 1.35, 0, 6.15), B], // tułów
    [tilt(0.8, 1.9, 0.75, 1.85, 7.8, 0, -0.5), B], // szyja
    [tilt(1.15, 0.52, 0.55, 2.55, 8.6, 0, -0.55), B], // łeb
    [box(0.15, 0.3, 0.12, 2.15, 9.0, -0.15), B], [box(0.15, 0.3, 0.12, 2.15, 9.0, 0.15), B], // uszy
    [tilt(0.35, 1.5, 0.3, -1.95, 6.6, 0, -0.35), B2], // ogon
    // jeździec
    [box(0.55, 1.15, 0.25, 0.15, 6.0, -0.8), B], [box(0.55, 1.15, 0.25, 0.15, 6.0, 0.8), B], // nogi wzdłuż boków konia
    [box(0.9, 0.35, 1.5, 0, 7.5), B2], // siodło z udami
    [box(0.62, 1.2, 0.85, -0.05, 7.6), B], // tułów
    [box(0.3, 1.1, 0.95, -0.42, 7.5), B2], // płaszcz na plecach
    [box(0.6, 0.2, 0.2, 0.3, 8.0, -0.58), B], // ręka z włócznią
    [box(0.13, 4.2, 0.13, 0.55, 6.0, -0.62), B2], // włócznia św. Maurycego
    [box(0.13, 0.4, 0.13, 0.55, 10.2, -0.62), B],
    [box(0.4, 0.45, 0.4, 0, 8.8), B], // głowa
    [box(0.46, 0.18, 0.46, 0, 9.25), '#6d6a5e'], // korona
  ]
  return merge(p)
}

// Mikołaj Kopernik (L. Podsiadły 1974): wysoki słup ze sztucznego kamienia z płaskorzeźbą układu
// heliocentrycznego, zwieńczony popiersiem astronoma.
function kopernik() {
  const K = '#c7ae9e', K2 = '#b39787', K3 = '#d8c4b4'
  const p: Part[] = [
    [box(2.0, 0.25, 1.8, 0, 0), '#a8a39a'],
    [box(1.1, 4.0, 1.25, 0, 0.25), K],
    [box(0.3, 2.4, 0.9, 0.62, 1.5), K2], // płaszcz/drapowanie z przodu
    [box(0.12, 0.7, 0.7, 0.8, 3.0), K3], // tarcza układu heliocentrycznego
    [box(0.14, 0.24, 0.24, 0.84, 3.23), K2], // słońce
    [box(1.0, 0.55, 1.35, 0.05, 4.25), K], // barki
    [box(0.6, 0.55, 0.6, -0.05, 4.55), K2], // włosy
    [box(0.35, 0.55, 0.42, 0.3, 4.6), K], // twarz
    [box(0.1, 0.15, 0.12, 0.5, 4.75), K2], // nos
  ]
  return merge(p)
}

// Juliusz Słowacki (1984): siedząca, zamyślona postać w płaszczu oparta łokciem o blok z napisem,
// ciemny brąz na niskim granitowym cokole stojącym na okrągłej platformie.
function slowacki() {
  const G = '#8f8f8a', B = '#50544f', B2 = '#40433f'
  const ring = new THREE.CylinderGeometry(2.6, 2.7, 0.3, 16).translate(0, 0.15, 0)
  const p: Part[] = [
    [ring, '#b8b6ae'],
    [box(1.7, 1.0, 3.0, 0, 0.3), G],
    [box(0.65, 1.15, 0.6, 0.25, 1.3, 0.95), B2], // blok z napisem (po prawej ręce)
    [box(0.95, 0.8, 1.05, -0.3, 1.3, -0.1), B2], // siedzisko przykryte płaszczem
    [box(1.0, 1.05, 0.4, -0.25, 1.3, -0.75), B], // płaszcz rozłożony w lewo
    [box(0.32, 0.75, 0.6, 0.48, 1.3, -0.1), B], // goleni
    [box(0.8, 0.3, 0.62, 0.15, 2.0, -0.1), B], // uda
    [box(0.5, 0.95, 0.72, -0.12, 2.15, 0.05), B], // tułów pochylony ku blokowi
    [box(0.22, 0.25, 0.5, 0.2, 2.45, 0.68), B], // łokieć na bloku
    [tilt(0.2, 0.62, 0.2, 0.18, 2.85, 0.42, 0.25), B], // przedramię do czoła
    [box(0.34, 0.4, 0.34, 0.02, 3.08, 0.18), B], // głowa wsparta na dłoni
  ]
  return merge(p)
}

// Św. Jan Paweł II (ul. Gliniana): stojąca postać w sutannie i pelerynce z pastorałem-krzyżem, na cokole.
function janPawel() {
  const S = '#b9b4a8', S2 = '#a19c90', B = '#6b5d45', B2 = '#5a4e3a'
  const p: Part[] = [
    [box(1.8, 0.3, 1.8, 0, 0), S2],
    [box(1.15, 2.2, 1.15, 0, 0.3), S],
    [box(1.35, 0.2, 1.35, 0, 2.5), S2],
    [box(0.85, 1.15, 0.75, 0, 2.7), B], // sutanna rozszerzona u dołu
    [box(0.6, 0.75, 0.55, 0, 3.85), B],
    [box(0.72, 0.38, 0.66, 0, 4.2), B2], // pelerynka
    [box(0.16, 0.1, 0.16, 0, 4.58), B],
    [box(0.3, 0.36, 0.3, 0.02, 4.66), B], // głowa
    [box(0.26, 0.06, 0.26, 0, 5.02), B2], // piuska
    [box(0.4, 0.18, 0.18, 0.22, 3.95, 0.42), B], // ręka trzymająca pastorał
    [box(0.08, 2.75, 0.08, 0.42, 2.7, 0.42), B2], // pastorał
    [box(0.08, 0.08, 0.34, 0.42, 5.2, 0.42), B2], // poprzeczka krzyża
  ]
  return merge(p)
}

// Pomnik Anonimowego Przechodnia (J. Kalina 2005): 14 postaci naturalnej wielkości idących wzdłuż Świdnickiej
// przez ul. Piłsudskiego — 7 zapada się w chodnik przed jezdnią, 7 wynurza się po drugiej stronie skrzyżowania.
// OSM ma jeden punkt (przy północno-wschodnim narożniku); przód = kierunek marszu (na południe wzdłuż Świdnickiej).
function przechodnie() {
  const B = '#6f7a6f', B2 = '#5c665c', P = '#8a857c'
  type Bx = [l: number, h: number, w: number, x: number, y: number, z: number, c: string]
  const fig: Bx[] = [
    [0.26, 0.85, 0.36, 0, 0, 0, B2], // nogi
    [0.36, 0.8, 0.5, 0, 0.8, 0, B], // płaszcz
    [0.16, 0.6, 0.12, 0.02, 0.95, 0.31, B], [0.16, 0.6, 0.12, 0.02, 0.95, -0.31, B], // ręce
    [0.24, 0.3, 0.12, 0.02, 0.75, 0.38, B2], // teczka/torba
    [0.12, 0.08, 0.12, 0.02, 1.6, 0, B],
    [0.24, 0.26, 0.22, 0.02, 1.66, 0, B], // głowa
  ]
  const p: Part[] = []
  // f: jaka część postaci jest nad chodnikiem; części pod ziemią przycinamy do y = 0
  const walker = (s: number, z: number, f: number, k: number) => {
    const sink = (1 - f) * 1.92
    for (const [l, h, w, x, y, zz, c] of fig) {
      let y0 = y - sink, hh = h
      if (y0 + hh <= 0.02) continue
      if (y0 < 0) { hh += y0; y0 = 0 }
      p.push([box(l, hh, w, s + x, y0, z + zz), c])
    }
    if (f < 1) // wyłamane płyty chodnika wokół
      for (let j = 0; j < 4; j++) {
        const a = j * Math.PI / 2 + k
        p.push([tilt(0.45, 0.08, 0.4, s + Math.cos(a) * 0.45, 0.06, z + Math.sin(a) * 0.45, 0.3 * (j % 2 ? 1 : -1)), P])
      }
  }
  const north = [1, 1, 1, 1, 0.8, 0.55, 0.35] // od najdalszej do krawężnika
  const south = [0.3, 0.5, 0.75, 1, 1, 1, 1] // od krawężnika w głąb
  const zs = [0.5, -0.4, 0.3, -0.5, 0.4, -0.3, 0.1]
  north.forEach((f, k) => walker(-0.4 - (6 - k) * 1.5, zs[k], f, k))
  // za skrzyżowaniem (jezdnia, torowisko i łącznica mają tu ~30 m): chodnik po wschodniej stronie Świdnickiej
  // przed Arkadami, ok. (-1437, -1263) na mapie = (36.9, -4.6) w układzie modelu
  south.forEach((f, k) => walker(36.9 + k * 1.5, -4.6 - zs[k], f, k))
  return merge(p)
}

export const SPECIAL: Record<string, { angle: number; build: () => THREE.BufferGeometry }> = {
  w101129503: { angle: -108, build: fredro }, // przodem na południe Rynku (prostopadle do pierzei, oś Rynku ~18°)
  n269609132: { angle: 162, build: chrobry }, // przodem do ul. Świdnickiej (biegnie pod kątem ~72°)
  n269595304: { angle: -100, build: kopernik }, // przodem do Promenady Staromiejskiej
  n267903225: { angle: -90, build: slowacki }, // przodem do alei Czesława Słani
  n12382766573: { angle: -111, build: janPawel }, // przodem do ul. Glinianej
  n3176881040: { angle: 252, build: przechodnie }, // marsz wzdłuż Świdnickiej na południe, przez Piłsudskiego
}
