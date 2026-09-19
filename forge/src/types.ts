/**
 * Forge data model.
 *
 * Every field here exists because a chapter of "The Disciplined Swing Trader"
 * says it is a thing that decides whether you survive. Chapter references are
 * in the comments so the journal and the rulebook never drift apart.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Ch.6 — "the weather". The market regime gates how aggressive you're allowed to be. */
export type Weather = 'BULLISH' | 'CAUTION' | 'BEARISH'

/** Ch.8 — focus is power. One mastered setup beats five half-known ones. */
export type SetupType =
  | 'Breakout — Tight Consolidation'
  | 'Episodic Pivot (EP)'
  | 'High Tight Flag'
  | 'Undercut & Rally'
  | 'Shoryuken (MA pullback)'
  | 'Short — Lose the 20'
  | 'Short — Double Top (DTSS)'
  | 'Short — Punchbowl (PBOD)'
  | 'NON-SETUP'

export const SETUP_TYPES: SetupType[] = [
  'Breakout — Tight Consolidation',
  'Episodic Pivot (EP)',
  'High Tight Flag',
  'Undercut & Rally',
  'Shoryuken (MA pullback)',
  'Short — Lose the 20',
  'Short — Double Top (DTSS)',
  'Short — Punchbowl (PBOD)',
  'NON-SETUP',
]

/** Ch.4 — name the demon. You cannot manage an impulse you cannot label. */
export type Emotion =
  | 'Calm' | 'Confident' | 'Focused'
  | 'Anxious' | 'Fearful' | 'Hesitant'
  | 'Bored' | 'Impatient' | 'Rushed'
  | 'FOMO' | 'Greedy' | 'Euphoric' | 'Overconfident'
  | 'Frustrated' | 'Angry' | 'Desperate' | 'Deflated'

export const EMOTIONS: Emotion[] = [
  'Calm', 'Confident', 'Focused',
  'Anxious', 'Fearful', 'Hesitant',
  'Bored', 'Impatient', 'Rushed',
  'FOMO', 'Greedy', 'Euphoric', 'Overconfident',
  'Frustrated', 'Angry', 'Desperate', 'Deflated',
]

/** Emotions that reliably precede rule-breaking. Used to warn you at the gate. */
export const RED_FLAG_EMOTIONS: Emotion[] = [
  'Bored', 'Impatient', 'Rushed', 'FOMO', 'Greedy',
  'Euphoric', 'Overconfident', 'Frustrated', 'Angry', 'Desperate',
]

/**
 * Ch.12-15 — the demon taxonomy. Free-text "I messed up" is useless; you cannot
 * count it. A closed list means the app can tell you which specific demon costs
 * you the most money.
 */
export type Deviation =
  | 'Traded a non-setup'
  | 'Chased the entry'
  | 'Hesitated / missed the trigger'
  | 'Boredom trade'
  | 'Oversized'
  | 'Undersized (fear)'
  | 'Revenge trade'
  | 'Skipped the checklist'
  | 'No stop placed'
  | 'Moved stop away from price'
  | 'Held past the stop'
  | 'Cut a winner early'
  | 'Held past the exit signal'
  | 'Ignored market weather'
  | 'Traded past daily loss limit'
  | 'Traded during cooling-off'
  | 'Exceeded position count / concentration'

export const DEVIATIONS: Deviation[] = [
  'Traded a non-setup',
  'Chased the entry',
  'Hesitated / missed the trigger',
  'Boredom trade',
  'Oversized',
  'Undersized (fear)',
  'Revenge trade',
  'Skipped the checklist',
  'No stop placed',
  'Moved stop away from price',
  'Held past the stop',
  'Cut a winner early',
  'Held past the exit signal',
  'Ignored market weather',
  'Traded past daily loss limit',
  'Traded during cooling-off',
  'Exceeded position count / concentration',
]

/** Ch.10 — every exit must trace back to a rule, or it is an emotional exit. */
export type ExitReason =
  | 'Initial stop hit'
  | 'Day-1 red close cut'
  | 'Scheduled partial (Day 3-5)'
  | 'Trailing MA close break'
  | 'Breakeven stop hit'
  | 'Parabolic / extension trim'
  | 'Setup invalidated'
  | 'Discretionary — fear'
  | 'Discretionary — greed'
  | 'Discretionary — other'

export const EXIT_REASONS: ExitReason[] = [
  'Initial stop hit',
  'Day-1 red close cut',
  'Scheduled partial (Day 3-5)',
  'Trailing MA close break',
  'Breakeven stop hit',
  'Parabolic / extension trim',
  'Setup invalidated',
  'Discretionary — fear',
  'Discretionary — greed',
  'Discretionary — other',
]

/** Exits that came from the rulebook rather than from a feeling. */
export const RULE_BASED_EXITS: ExitReason[] = [
  'Initial stop hit',
  'Day-1 red close cut',
  'Scheduled partial (Day 3-5)',
  'Trailing MA close break',
  'Breakeven stop hit',
  'Parabolic / extension trim',
  'Setup invalidated',
]

/**
 * Ch.2 — the reframe that the whole app is built around.
 * A win taken by breaking the rules is a FAILURE. A loss taken correctly is a SUCCESS.
 */
export type Quadrant = 'PROCESS_SUCCESS' | 'GOOD_LOSS' | 'LUCKY_WIN' | 'PROCESS_FAILURE'

export type SetupGrade = 'A+' | 'A' | 'B' | 'NO-TRADE'

// ---------------------------------------------------------------------------
// The rulebook (Ch.3 — the written plan IS the system)
// ---------------------------------------------------------------------------

export interface ScalingTier {
  id: string
  /** Account equity that unlocks this tier. */
  equityMilestone: number
  /** Rolling compliance rate you must hold to earn it (Ch.23 — scale from strength). */
  minCompliance: number
  /** Position size this tier permits, as % of equity. */
  positionSizePct: number
  label: string
}

export interface PlanChange {
  id: string
  date: string
  change: string
  /** Ch.22 — no undocumented rule changes. Reactionary tinkering is how systems die. */
  rationale: string
}

export interface Plan {
  id: 'plan'
  traderName: string
  startingEquity: number
  currentEquity: number
  currency: string

  // --- Risk (Ch.11) ---
  maxRiskPerTradePct: number      // hard ceiling, e.g. 0.5
  targetRiskPerTradePct: number   // what a good tight setup should cost, e.g. 0.35
  standardPositionPct: number     // e.g. 10
  maxPositionPct: number          // e.g. 20
  maxDailyLossPct: number         // circuit breaker, e.g. 2
  maxOpenPositions: number
  maxSectorExposurePct: number

  // --- Stock selection (Ch.7) ---
  minRsRating: number             // e.g. 90
  minAdrPct: number               // e.g. 4
  minDollarVolume: number         // e.g. 50_000_000

  // --- Tightness (Ch.8) — the quantitative gate that makes the risk math work ---
  tightnessAdrFraction: number    // daily range <= this * ADR, e.g. 0.667
  minTightDays: number            // consecutive, e.g. 2

  // --- Exits (Ch.10) ---
  partialSellDay: number          // 3, 4 or 5
  partialSellPct: number          // e.g. 50
  trailingMa: string              // e.g. "10DSMA"
  cutDay1RedClose: boolean
  breakevenAfterMaClearsEntry: boolean

  // --- Friction (Ch.17) ---
  maxTradesPerDay: number
  coolingOffMinutes: number       // after a stop-out
  noNewTradesLastMinutes: number  // before the close
  requireChecklistBeforeEntry: boolean

  scalingTiers: ScalingTier[]
  changeLog: PlanChange[]
}

// ---------------------------------------------------------------------------
// The A+ gate (Ch.8 / Appendix B)
// ---------------------------------------------------------------------------

/**
 * The pre-trade checklist. `core: true` items are the bouncer — if any one of
 * them is false, the trade is forbidden regardless of how good it looks.
 */
export interface ChecklistItem {
  key: string
  group: string
  label: string
  core: boolean
  hint?: string
}

export const A_PLUS_CHECKLIST: ChecklistItem[] = [
  { key: 'weather', group: 'Market Context', label: 'Market weather permits this direction', core: true,
    hint: 'Ch.6 — index above a rising 20MA with 10 > 20 for longs. Bad weather = no new breakouts.' },
  { key: 'leader', group: 'Stock Selection', label: 'Meets every Leader criterion (RS, ADR, $Vol)', core: true,
    hint: 'Ch.7 — half of a stock\'s move comes from its group. No laggards, ever.' },
  { key: 'group', group: 'Stock Selection', label: 'In a leading sector / theme', core: false },
  { key: 'pole', group: 'Pattern', label: 'Clear, strong prior uptrend (the pole)', core: true,
    hint: 'The bigger the first leg, the bigger the second leg.' },
  { key: 'orderly', group: 'Pattern', label: 'Orderly consolidation — not wide or choppy', core: true },
  { key: 'maSupport', group: 'Moving Averages', label: 'Consolidating at a RISING 10 or 20 day MA', core: true,
    hint: 'Ch.8 — this is the institutional-support tell. Non-negotiable.' },
  { key: 'maStacked', group: 'Moving Averages', label: 'MAs stacked bullishly (10 > 20 > 50)', core: false },
  { key: 'tightVisual', group: 'Tightness', label: 'Last few days visibly calmer than the base', core: true },
  { key: 'tightQuant', group: 'Tightness', label: 'Quantitative tightness rule satisfied', core: true,
    hint: 'Computed for you from ADR and the tight-day count. This is what makes a 10% position cost 0.35% risk.' },
  { key: 'tightAtPivot', group: 'Tightness', label: 'Tightness sits at the MA and the pivot', core: false },
  { key: 'volContraction', group: 'Volume', label: 'Volume contracted through the base', core: true },
  { key: 'volLowOnTight', group: 'Volume', label: 'Volume notably low on the tightest days', core: false },
  { key: 'pivotClear', group: 'Trigger & Stop', label: 'Obvious breakout pivot identified', core: true },
  { key: 'stopClear', group: 'Trigger & Stop', label: 'Obvious, logical stop level identified', core: true },
  { key: 'riskOk', group: 'Trigger & Stop', label: 'Risk at planned size is within plan limits', core: true,
    hint: 'Computed for you. If this fails, the setup is not tradeable at standard size.' },
  { key: 'catalyst', group: 'Bonus', label: 'Recent catalyst / EP behind the move', core: false },
]

export const CORE_CHECKLIST_KEYS = A_PLUS_CHECKLIST.filter((i) => i.core).map((i) => i.key)

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

export interface Exit {
  id: string
  date: string
  price: number
  shares: number
  reason: ExitReason
  note?: string
}

export interface StopChange {
  id: string
  date: string
  from: number
  to: number
  /** The honest question: did the rulebook tell you to do this, or did hope? */
  ruleBased: boolean
  reason: string
}

/** Ch.21 — the five questions. All YES = compliant. Anything else is a deviation. */
export interface ProcessAudit {
  setupMetCriteria: boolean | null
  entryPerPlan: boolean | null
  stopPlacedImmediately: boolean | null
  sizePerPlan: boolean | null
  exitPerRules: boolean | null
  withinRiskLimits: boolean | null
  checklistUsedBeforeEntry: boolean | null
}

export const AUDIT_QUESTIONS: { key: keyof ProcessAudit; label: string; help: string }[] = [
  { key: 'setupMetCriteria', label: 'Did the setup meet every A+ criterion?', help: 'If no — what made you take it anyway?' },
  { key: 'entryPerPlan', label: 'Was the entry trigger executed exactly as planned?', help: 'Chasing and hesitating both count as no.' },
  { key: 'stopPlacedImmediately', label: 'Was the hard stop placed immediately after entry?', help: 'Ch.10 — the stop is your survival line.' },
  { key: 'sizePerPlan', label: 'Was position size calculated and used per the rules?', help: 'Ch.14 — size is law, not a feeling.' },
  { key: 'exitPerRules', label: 'Was every exit driven by a pre-defined rule?', help: 'Fear-selling a winner is a rule break even when it books a profit.' },
  { key: 'withinRiskLimits', label: 'Did the trade respect daily and portfolio risk limits?', help: 'Loss limit, position count, sector concentration.' },
  { key: 'checklistUsedBeforeEntry', label: 'Did you complete the checklist BEFORE entering?', help: 'Ch.17 — the friction only works if it comes first.' },
]

export interface Trade {
  id: string
  ticker: string
  direction: 'LONG' | 'SHORT'
  setupType: SetupType
  status: 'PLANNED' | 'OPEN' | 'CLOSED'

  // --- Plan, captured before entry ---
  plannedEntry: number
  plannedStop: number
  plannedShares: number
  /** Timestamp the gate was completed. Proof the checklist came first. */
  checklistCompletedAt?: string
  checklist: Record<string, boolean>
  grade: SetupGrade

  // --- Leader metrics (Ch.7), stored so you can test whether they actually matter ---
  rsRating?: number
  adrPct?: number
  dollarVolume?: number
  pctFrom52wHigh?: number
  sector?: string
  /** Consecutive days with range <= tightnessAdrFraction * ADR. */
  tightDays?: number
  baseLengthDays?: number
  baseDepthPct?: number
  poleGainPct?: number

  // --- Execution ---
  entryDate?: string
  entryTime?: string
  entryPrice?: number
  shares?: number
  initialStop?: number
  weatherAtEntry?: Weather
  equityAtEntry?: number

  // --- Management ---
  exits: Exit[]
  stopChanges: StopChange[]
  currentStop?: number
  /** Ch.24 — MAE/MFE in R tell you if your stops and exits are in the right place. */
  maeR?: number
  mfeR?: number

  // --- Outcome ---
  exitDate?: string
  pnl?: number
  rMultiple?: number
  fees?: number

  // --- The audit (Ch.21) ---
  audit: ProcessAudit
  deviations: Deviation[]
  deviationNote?: string

  // --- Psychology (Ch.4, Ch.21) ---
  emotionBefore: Emotion[]
  emotionDuring: Emotion[]
  emotionAfter: Emotion[]
  conviction?: number          // 1-5
  /** What happened just before this trade — the cue half of the habit loop (Ch.12). */
  precedingContext?: string
  wouldRepeat?: boolean | null
  lesson?: string

  charts: ChartShot[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ChartShot {
  id: string
  phase: 'BEFORE' | 'DURING' | 'AFTER'
  dataUrl: string
  caption?: string
}

// ---------------------------------------------------------------------------
// Daily log (Ch.19-21 / Appendix C)
// ---------------------------------------------------------------------------

export interface WatchItem {
  id: string
  ticker: string
  tier: 'FOCUS' | 'NMS' | 'OBSERVE'
  setupType: SetupType
  trigger?: number
  stop?: number
  alertSet: boolean
  outcome: 'PENDING' | 'TAKEN' | 'TRIGGERED_MISSED' | 'NO_TRIGGER' | 'INVALIDATED'
  /** Ch.21 — a valid trigger you failed to take is data about YOU, not the market. */
  missedReason?: string
  estimatedRMissed?: number
}

export interface DailyLog {
  id: string           // the date, YYYY-MM-DD
  date: string

  // --- Weather (Ch.6) ---
  weather?: Weather
  indexSymbol: string
  indexAbove20: boolean | null
  ma10Above20: boolean | null
  ma20Rising: boolean | null
  breadthNote?: string
  vix?: number
  watchlistQuality?: number   // 1-5, peoplewish's own breadth indicator

  // --- Fitness to trade (Ch.26) ---
  sleepHours?: number
  energy?: number             // 1-5
  stress?: number             // 1-5
  externalStressors?: string

  // --- Routines (Appendix C) ---
  preMarket: Record<string, boolean>
  marketHours: Record<string, boolean>
  postMarket: Record<string, boolean>

  processGoal?: string
  watchlist: WatchItem[]

  daySummary?: string
  keyLesson?: string
  tomorrowFocus?: string

  /** Ch.15 — set when a stop is hit, enforces the walk-away. */
  coolingOffUntil?: string
  createdAt: string
  updatedAt: string
}

export const PREMARKET_STEPS = [
  { key: 'mindset', label: 'Mindset & environment reset complete' },
  { key: 'weather', label: 'Market weather assessed and written down' },
  { key: 'positions', label: 'Open positions reviewed, plan confirmed for each' },
  { key: 'scans', label: 'Scans run, focus list cut to 5 names or fewer' },
  { key: 'gameplan', label: 'Entry, stop and size written for every focus name' },
  { key: 'alerts', label: 'Alerts set at triggers and stops' },
  { key: 'rehearsal', label: 'Mental rehearsal and rules affirmation done' },
]

export const MARKET_HOURS_STEPS = [
  { key: 'focus', label: 'Stayed on the focus list through the open' },
  { key: 'triggers', label: 'Entries taken only on precise triggers' },
  { key: 'stops', label: 'Hard stops placed immediately after every entry' },
  { key: 'size', label: 'Size calculated and executed per the rules' },
  { key: 'nochase', label: 'No chasing, no non-setups, no impulse overrides' },
  { key: 'manage', label: 'Open positions managed only by pre-defined rules' },
  { key: 'honored', label: 'Stops honoured immediately when hit' },
  { key: 'break', label: 'Took the mandatory break after a stop-out' },
  { key: 'log', label: 'Trade basics logged in real time' },
]

export const POSTMARKET_STEPS = [
  { key: 'decompress', label: 'Decompressed before reviewing' },
  { key: 'journal', label: 'Every trade journalled — charts, audit, psychology' },
  { key: 'missed', label: 'Missed opportunities analysed honestly' },
  { key: 'metrics', label: 'Daily metrics calculated (P&L, R, compliance)' },
  { key: 'context', label: 'Market context review noted' },
  { key: 'prep', label: 'Preliminary scans and watchlist for tomorrow' },
  { key: 'lesson', label: 'Key lesson and tomorrow\'s focus identified' },
  { key: 'study', label: 'Dedicated study time completed' },
  { key: 'shutdown', label: 'Workspace shut down, out of trader mode' },
]

// ---------------------------------------------------------------------------
// Weekly audit (Ch.22 / Appendix D)
// ---------------------------------------------------------------------------

export interface WeeklyAudit {
  id: string          // week ending date
  weekEnding: string
  /** Did last week's goals get hit? Answered before new ones are set. */
  previousGoalsMet?: string
  topDeviations?: string
  emotionalPatterns?: string
  systemEffectiveness?: string
  scanningEffectiveness?: string
  workflowNotes?: string
  refinements?: string
  goalsNextWeek: string[]
  createdAt: string
  updatedAt: string
}

/** Ch.17 — rule breaks that happen outside of any single trade still count. */
export interface Incident {
  id: string
  date: string
  kind: Deviation | 'Skipped routine' | 'Other'
  note: string
  costEstimate?: number
}
