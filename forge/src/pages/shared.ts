import type { Quadrant } from '../types'

/** Fixed display order for the outcome matrix: rules-followed row first. */
export const QUADRANT_ORDER: Quadrant[] = [
  'PROCESS_SUCCESS', 'LUCKY_WIN', 'GOOD_LOSS', 'PROCESS_FAILURE',
]
