// Reguły wydajności: uproszczone bryły z daleka, co chować przy małym przybliżeniu, tryb oszczędny.

// Próg uproszczonych brył (z histerezą, żeby nie migało przy powiększeniu w okolicy progu).
export const LOD_IN = 0.55
export const LOD_OUT = 0.65
// Ile wersji budynków wolno dobudować w jednej klatce przy przełączaniu (bez przycięć animacji).
export const LOD_BUDGET = 4

// Daleko (zoom poniżej): ludzie, auta i drzewa są mniejsze niż piksel — nie liczymy ich i nie rysujemy.
export const FAR_ZOOM = 0.55
export const TREES_MIN_ZOOM = 0.35
// Pomniki chowamy z daleka (są mniejsze niż piksel).
export const MONUMENTS_MIN_ZOOM = 0.3

// Tryb oszczędny: gdy przez WINDOW_S sekund średnio rysujemy wolniej niż MIN_FPS, schodzimy o stopień jakości
// (najpierw większy piksel, aż do PIXEL_SAVER_MAX, potem bez cieni). Karta w tle się nie liczy.
export const SAVER_WINDOW_S = 4
export const SAVER_MIN_FPS = 24
// Wielkość piksela: domyślna i największa, do której schodzi tryb oszczędny.
export const PIXEL_DEFAULT = 1.5
// zakres suwaka wielkości piksela (index.html)
export const PIXEL_MIN = 1
export const PIXEL_MAX = 3
export const PIXEL_SAVER_MAX = 3
export const PIXEL_SAVER_STEP = 0.5
