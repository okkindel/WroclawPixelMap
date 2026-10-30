// Treści (epoki, zabytki, easter eggi, ciekawostki, krasnale) w bieżącym języku.
import * as PL from '../history/content.ts'
import * as EN from '../history/content.en.ts'
import { TRIVIA as TRIVIA_PL } from '../history/trivia.ts'
import { TRIVIA as TRIVIA_EN } from '../history/trivia.en.ts'
import { lang } from './index.ts'

const en = () => lang() === 'en'

export const epochs = () => (en() ? EN.EPOCHS : PL.EPOCHS)
export const landmarks = () => (en() ? EN.LANDMARKS : PL.LANDMARKS)
export const landmarkRank = () => (en() ? EN.LANDMARK_RANK : PL.LANDMARK_RANK)
export const eggs = () => (en() ? EN.EGGS : PL.EGGS)
export const trivia = () => (en() ? TRIVIA_EN : TRIVIA_PL)
export const dwarfFacts = () => (en() ? EN.DWARF_FACTS : PL.DWARF_FACTS)
