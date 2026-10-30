// Treści z katalogu content/ (JSON, oba języki obok siebie) w wersji dla bieżącego języka.
import { lang } from '../i18n/index.ts'
import dwarfFactsJson from '../../content/dwarf-facts.json'
import eggsJson from '../../content/eggs.json'
import epochsJson from '../../content/epochs.json'
import landmarksJson from '../../content/landmarks.json'
import neonsJson from '../../content/neons.json'
import triviaJson from '../../content/trivia.json'
import wallsJson from '../../content/walls.json'
import type { Egg, EggEntry, Epoch, EpochEntry, Landmark, LandmarkEntry, NeonSpec, Trivia, TriviaEntry, Walls } from './types.ts'

export type * from './types.ts'

const EPOCHS = epochsJson as EpochEntry[]
const LANDMARKS = landmarksJson as LandmarkEntry[]
const EGGS = eggsJson as EggEntry[]
const TRIVIA = triviaJson as TriviaEntry[]

// Neony mają teksty w obu językach w polach title/text ({ pl, en }).
export const NEONS = neonsJson as NeonSpec[]
// Fortyfikacje nie mają tekstów widocznych w UI, więc są tylko po polsku.
export const WALLS = wallsJson as Walls

export const epochs = (): Epoch[] =>
  EPOCHS.map(({ id, year, city, flag, mode, [lang()]: l }) => ({ id, year, label: l.label, state: l.state, city, flag, mode, text: l.text }))

export const landmarks = (): Landmark[] =>
  LANDMARKS.map(({ lat, lon, year, [lang()]: l }) => ({ name: l.name, lat, lon, year: (year ?? l.year)!, text: l.text }))

// Napisy widoczne z daleka (ranga 1) i przy średnim przybliżeniu (ranga 2), kluczami są nazwy w bieżącym języku.
export const landmarkRank = (): Record<string, 1 | 2> =>
  Object.fromEntries(LANDMARKS.filter((x) => x.rank).map((x) => [x[lang()].name, x.rank!]))

export const eggs = (): Egg[] =>
  EGGS.map(({ id, lat, lon, trigger, [lang()]: l }) => ({ id, lat, lon, title: l.title, text: l.text, trigger }))

export const trivia = (): Trivia[] =>
  TRIVIA.map(({ id, lat, lon, trigger, category, source, [lang()]: l }) => ({ id, lat, lon, title: l.title, text: l.text, trigger, category, source }))

export const dwarfFacts = (): string[] => dwarfFactsJson[lang()]
