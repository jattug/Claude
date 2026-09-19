/**
 * The rules engine.
 *
 * This is the difference between a journal and a spreadsheet: the app knows the
 * rulebook, so it can grade a setup, size a position, tell you what today's
 * mechanical action on an open trade is, and refuse to pretend a lucky win was
 * a good trade.
 */
import {
  A_PLUS_CHECKLIST, CORE_CHECKLIST_KEYS,
  type Plan, type Trade, type SetupGrade, type Quadrant,
  type DailyLog, type Weather, type ProcessAudit, type Deviation,
  RULE_BASED_EXITS,
} from '../types'

// ---------------------------------------------------------------------------
// Position sizing (Ch.11 / Ch.14) — mechanical, never a feeling
// ---------------------------------------------------------------------------

export interface SizeResult {
  shares: number
  positionValue: number
  positionPct: number
  riskPerShare: number
  riskDollars: number
  riskPct: number
  /** Shares you'd have to drop to if riskPct exceeds the plan's ceiling. */
  cappedShares: number
  cappedRiskPct: number
  withinRiskLimit: boolean
  /** Ch.11 — a setup that can't carry standard size at legal risk isn't tight enough. */
  verdict: 'OK' | 'REDUCE_SIZE' | 'NOT_TRADEABLE'
  message: string
}

export function calcSize(
  entry: number,
  stop: number,
  equity: number,
  positionPct: number,
  maxRiskPct: number,
): SizeResult {
  const riskPerShare = Math.abs(entry - stop)
  const empty: SizeResult = {
    shares: 0, positionValue: 0, positionPct: 0, riskPerShare: 0, riskDollars: 0,
    riskPct: 0, cappedShares: 0, cappedRiskPct: 0, withinRiskLimit: false,
    verdict: 'NOT_TRADEABLE', message: 'Enter an entry and a stop.',
  }
  if (!entry || !stop || !equity || riskPerShare <= 0) return empty

  const positionValue = equity * (positionPct / 100)
  const shares = Math.floor(positionValue / entry)
  if (shares < 1) {
    return { ...empty, message: 'Position size is below one share at this price.' }
  }

  const riskDollars = shares * riskPerShare
  const riskPct = (riskDollars / equity) * 100
  const maxRiskDollars = equity * (maxRiskPct / 100)
  const cappedShares = Math.max(0, Math.floor(maxRiskDollars / riskPerShare))
  const cappedRiskPct = (cappedShares * riskPerShare / equity) * 100
  const withinRiskLimit = riskPct <= maxRiskPct + 1e-9

  let verdict: SizeResult['verdict'] = 'OK'
  let message = `Standard ${positionPct}% position risks ${riskPct.toFixed(2)}% of equity. Inside your ${maxRiskPct}% ceiling.`
  if (!withinRiskLimit) {
    if (cappedShares < 1) {
      verdict = 'NOT_TRADEABLE'
      message = `The stop is too far away. Even one share breaches your ${maxRiskPct}% risk ceiling.`
    } else {
      verdict = 'REDUCE_SIZE'
      const cappedPositionPct = (cappedShares * entry / equity) * 100
      message =
        `A ${positionPct}% position here risks ${riskPct.toFixed(2)}% — over your ${maxRiskPct}% ceiling. ` +
        `Either cut to ${cappedShares} shares (${cappedPositionPct.toFixed(1)}% of equity) or skip it. ` +
        `A stop this wide usually means the chart is not tight enough.`
    }
  }

  return {
    shares, positionValue: shares * entry,
    positionPct: (shares * entry / equity) * 100,
    riskPerShare, riskDollars, riskPct,
    cappedShares, cappedRiskPct, withinRiskLimit, verdict, message,
  }
}

// ---------------------------------------------------------------------------
// Tightness (Ch.8) — the quantitative gate
// ---------------------------------------------------------------------------

export function tightnessOk(tightDays: number | undefined, plan: Plan): boolean {
  return (tightDays ?? 0) >= plan.minTightDays
}

/** Max daily range, in % of price, that still counts as a "tight" day. */
export function tightRangeThresholdPct(adrPct: number | undefined, plan: Plan): number | null {
  if (!adrPct) return null
  return adrPct * plan.tightnessAdrFraction
}

// ---------------------------------------------------------------------------
// Setup grading (Ch.8) — the bouncer at the door
// ---------------------------------------------------------------------------

export interface GradeResult {
  grade: SetupGrade
  coreFailed: string[]
  bonusFailed: string[]
  coreMet: number
  coreTotal: number
}

export function gradeSetup(checklist: Record<string, boolean>): GradeResult {
  const coreFailed = CORE_CHECKLIST_KEYS.filter((k) => !checklist[k])
  const bonusFailed = A_PLUS_CHECKLIST.filter((i) => !i.core && !checklist[i.key]).map((i) => i.key)
  const coreTotal = CORE_CHECKLIST_KEYS.length
  const coreMet = coreTotal - coreFailed.length

  let grade: SetupGrade
  if (coreFailed.length > 0) grade = 'NO-TRADE'
  else if (bonusFailed.length === 0) grade = 'A+'
  else if (bonusFailed.length <= 2) grade = 'A'
  else grade = 'B'

  return { grade, coreFailed, bonusFailed, coreMet, coreTotal }
}

export function checklistLabel(key: string): string {
  return A_PLUS_CHECKLIST.find((i) => i.key === key)?.label ?? key
}

// ---------------------------------------------------------------------------
// Market weather (Ch.6)
// ---------------------------------------------------------------------------

export function deriveWeather(log: Partial<DailyLog>): Weather | undefined {
  const { indexAbove20, ma10Above20, ma20Rising } = log
  if (indexAbove20 == null || ma10Above20 == null || ma20Rising == null) return undefined
  if (indexAbove20 && ma10Above20 && ma20Rising) return 'BULLISH'
  if (!indexAbove20 && !ma10Above20) return 'BEARISH'
  return 'CAUTION'
}

export const WEATHER_PLAYBOOK: Record<Weather, { stance: string; sizing: string; detail: string }> = {
  BULLISH: {
    stance: 'Trade your setups',
    sizing: 'Standard size',
    detail: 'Index above a rising 20MA with 10 > 20. Breakouts have the tide behind them. This is the 30-40% of the year you are paid for — press A+ setups at full standard size.',
  },
  CAUTION: {
    stance: 'Do less, on less size',
    sizing: 'Half size, A+ only',
    detail: 'The MAs are conflicting or the 20 is flat. Breakouts fail more often here. Take only the very best charts, halve your size, and accept that most days produce nothing.',
  },
  BEARISH: {
    stance: 'No new long breakouts',
    sizing: 'Capital preservation',
    detail: 'Index below a falling 20MA and/or 10 < 20. Swimming against the tide. Protect capital, get off margin, and let the cash pile up for when the weather turns.',
  },
}

/** What the plan allows you to size up to today, given the weather. */
export function weatherSizeCap(weather: Weather | undefined, plan: Plan): number {
  if (weather === 'BEARISH') return 0
  if (weather === 'CAUTION') return plan.standardPositionPct / 2
  return plan.standardPositionPct
}

// ---------------------------------------------------------------------------
// Compliance & the quadrant reframe (Ch.2)
// ---------------------------------------------------------------------------

export function auditAnswered(audit: ProcessAudit): boolean {
  return Object.values(audit).every((v) => v !== null && v !== undefined)
}

export function isCompliant(trade: Trade): boolean | null {
  const vals = Object.values(trade.audit)
  if (vals.some((v) => v === null || v === undefined)) return null
  return vals.every((v) => v === true) && trade.deviations.length === 0
}

export function quadrantOf(trade: Trade): Quadrant | null {
  const compliant = isCompliant(trade)
  if (compliant === null || trade.status !== 'CLOSED' || trade.pnl == null) return null
  const won = trade.pnl > 0
  if (compliant) return won ? 'PROCESS_SUCCESS' : 'GOOD_LOSS'
  return won ? 'LUCKY_WIN' : 'PROCESS_FAILURE'
}

export const QUADRANT_META: Record<Quadrant, {
  label: string; verdict: string; tone: 'good' | 'warning' | 'critical'; blurb: string
}> = {
  PROCESS_SUCCESS: {
    label: 'Process Success', verdict: 'Won by the rules', tone: 'good',
    blurb: 'The system worked and you let it. This is the trade you are trying to repeat.',
  },
  GOOD_LOSS: {
    label: 'Good Loss', verdict: 'Lost by the rules', tone: 'good',
    blurb: 'A cost of doing business. You executed perfectly and the market said no. Nothing to fix.',
  },
  LUCKY_WIN: {
    label: 'Lucky Win', verdict: 'Won by breaking the rules', tone: 'warning',
    blurb: 'The most expensive trade you can take. It pays you for bad behaviour and makes the next rule break easier. Count it as a mistake.',
  },
  PROCESS_FAILURE: {
    label: 'Process Failure', verdict: 'Lost by breaking the rules', tone: 'critical',
    blurb: 'The only quadrant where the money and the lesson point the same way. Find the cue that started it.',
  },
}

// ---------------------------------------------------------------------------
// P&L and R (Ch.24 — anchor to R, not to dollars)
// ---------------------------------------------------------------------------

export function realisedShares(trade: Trade): number {
  return trade.exits.reduce((s, e) => s + e.shares, 0)
}

export function openShares(trade: Trade): number {
  return Math.max(0, (trade.shares ?? 0) - realisedShares(trade))
}

export function avgExitPrice(trade: Trade): number | null {
  const shares = realisedShares(trade)
  if (!shares) return null
  return trade.exits.reduce((s, e) => s + e.price * e.shares, 0) / shares
}

/** One R in dollars — the initial risk the trade was built on. */
export function oneR(trade: Trade): number | null {
  if (trade.entryPrice == null || trade.initialStop == null || !trade.shares) return null
  const r = Math.abs(trade.entryPrice - trade.initialStop) * trade.shares
  return r > 0 ? r : null
}

export function computePnl(trade: Trade): { pnl: number | null; rMultiple: number | null } {
  const { entryPrice, shares, direction } = trade
  if (entryPrice == null || !shares) return { pnl: null, rMultiple: null }
  const sign = direction === 'SHORT' ? -1 : 1
  const gross = trade.exits.reduce((s, e) => s + sign * (e.price - entryPrice) * e.shares, 0)
  const pnl = gross - (trade.fees ?? 0)
  const r = oneR(trade)
  return { pnl, rMultiple: r ? pnl / r : null }
}

// ---------------------------------------------------------------------------
// The exit engine (Ch.10) — what the rulebook says to do with this trade today
// ---------------------------------------------------------------------------

export interface NextAction {
  urgency: 'ACTION' | 'WATCH' | 'HOLD'
  headline: string
  detail: string
}

/** Entry day is Day 1, matching how the partial-sell rule is written. */
export function tradeDayNumber(trade: Trade, today = new Date()): number {
  if (!trade.entryDate) return 0
  const start = new Date(trade.entryDate + 'T00:00:00')
  const end = new Date(today.toISOString().slice(0, 10) + 'T00:00:00')
  let days = 1
  const cur = new Date(start)
  while (cur < end) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) days++
  }
  return days
}

export function nextAction(trade: Trade, plan: Plan, today = new Date()): NextAction {
  if (trade.status !== 'OPEN') {
    return { urgency: 'HOLD', headline: 'Not an open position', detail: '' }
  }
  const day = tradeDayNumber(trade, today)
  const partialTaken = trade.exits.some((e) => e.reason === 'Scheduled partial (Day 3-5)')
  const stop = trade.currentStop ?? trade.initialStop

  if (day === 1 && plan.cutDay1RedClose) {
    return {
      urgency: 'WATCH',
      headline: `Day 1 — stop is the low of day (${stop != null ? stop.toFixed(2) : 'set it now'})`,
      detail: 'Your plan cuts any Day-1 red close. At the bell: if it closes below your entry, sell it, even if the stop was never touched.',
    }
  }
  if (day === 1) {
    return {
      urgency: 'WATCH',
      headline: `Day 1 — stop is the low of day (${stop != null ? stop.toFixed(2) : 'set it now'})`,
      detail: 'No other exit exists between Day 1 and Day 3. Leave it alone and let it work.',
    }
  }
  if (day < plan.partialSellDay && !partialTaken) {
    return {
      urgency: 'HOLD',
      headline: `Day ${day} — hold, nothing to do`,
      detail: `The Day-1 low stop stands until Day ${plan.partialSellDay}. Fiddling with it now is impatience, not management.`,
    }
  }
  if (!partialTaken && day >= plan.partialSellDay) {
    return {
      urgency: 'ACTION',
      headline: `Day ${day} — sell ${plan.partialSellPct}% at the close`,
      detail: `Your scheduled partial is due. ${plan.partialSellPct}% is the amount that leaves you neither feeling you missed out nor that you should have sold more. Take it and stop negotiating.`,
    }
  }
  if (plan.breakevenAfterMaClearsEntry && !trade.stopChanges.some((c) => c.ruleBased && trade.entryPrice != null && Math.abs(c.to - trade.entryPrice) < 0.01)) {
    return {
      urgency: 'WATCH',
      headline: `Partial booked — move the rest to breakeven once the ${plan.trailingMa} clears your entry`,
      detail: `Do not trail yet. Until the ${plan.trailingMa} is above ${trade.entryPrice?.toFixed(2) ?? 'your entry'}, a trail just stops you out on normal noise.`,
    }
  }
  return {
    urgency: 'WATCH',
    headline: `Trailing the ${plan.trailingMa}`,
    detail: `Sell the remainder on the first daily CLOSE below the ${plan.trailingMa}. An intraday poke through is not a signal — wait for the close.`,
  }
}

// ---------------------------------------------------------------------------
// Circuit breakers (Ch.15 / Ch.17) — friction the app can actually enforce
// ---------------------------------------------------------------------------

export interface Breaker {
  id: string
  tripped: boolean
  severity: 'block' | 'warn'
  label: string
  detail: string
}

export function evaluateBreakers(args: {
  plan: Plan
  log?: DailyLog
  todaysTrades: Trade[]
  openTrades: Trade[]
  now?: Date
}): Breaker[] {
  const { plan, log, todaysTrades, openTrades } = args
  const now = args.now ?? new Date()
  const out: Breaker[] = []

  const realisedToday = todaysTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const lossLimit = plan.currentEquity * (plan.maxDailyLossPct / 100)
  out.push({
    id: 'dailyLoss',
    tripped: realisedToday <= -lossLimit,
    severity: 'block',
    label: 'Daily loss limit',
    detail: realisedToday <= -lossLimit
      ? `Down ${fmtAbs(realisedToday)} today against a ${plan.maxDailyLossPct}% limit. You are done for the day. Close the platform.`
      : `${fmtAbs(realisedToday)} of ${fmtAbs(-lossLimit)} used.`,
  })

  out.push({
    id: 'tradeCount',
    tripped: todaysTrades.length >= plan.maxTradesPerDay,
    severity: 'block',
    label: 'Trades today',
    detail: `${todaysTrades.length} of ${plan.maxTradesPerDay} allowed.`,
  })

  const coolUntil = log?.coolingOffUntil ? new Date(log.coolingOffUntil) : null
  const cooling = !!coolUntil && coolUntil > now
  out.push({
    id: 'coolingOff',
    tripped: cooling,
    severity: 'block',
    label: 'Cooling-off period',
    detail: cooling
      ? `Stopped out recently. No new trades for ${Math.ceil((coolUntil!.getTime() - now.getTime()) / 60000)} more minutes. Stand up and walk away from the desk.`
      : 'Clear.',
  })

  out.push({
    id: 'positions',
    tripped: openTrades.length >= plan.maxOpenPositions,
    severity: 'warn',
    label: 'Open positions',
    detail: `${openTrades.length} of ${plan.maxOpenPositions}.`,
  })

  if (log?.weather === 'BEARISH') {
    out.push({
      id: 'weather',
      tripped: true,
      severity: 'block',
      label: 'Market weather is bearish',
      detail: 'Your plan forbids new long breakouts in this weather. Sitting in cash is the trade.',
    })
  } else if (log?.weather === 'CAUTION') {
    out.push({
      id: 'weather',
      tripped: true,
      severity: 'warn',
      label: 'Market weather is choppy',
      detail: `Half size (${(plan.standardPositionPct / 2).toFixed(0)}% of equity) and A+ charts only.`,
    })
  }

  if (log && (log.sleepHours != null && log.sleepHours < 6)) {
    out.push({
      id: 'sleep',
      tripped: true,
      severity: 'warn',
      label: 'Under-slept',
      detail: `${log.sleepHours}h of sleep. Emotional regulation and decision quality are measurably worse today. Consider half size or no trading.`,
    })
  }
  if (log && log.stress != null && log.stress >= 4) {
    out.push({
      id: 'stress',
      tripped: true, severity: 'warn', label: 'High stress',
      detail: 'You logged high stress this morning. This is when old habits resurface. Checklist on every single trade.',
    })
  }

  if (plan.requireChecklistBeforeEntry) {
    const missing = openTrades.filter((t) => !t.checklistCompletedAt)
    if (missing.length) {
      out.push({
        id: 'checklist', tripped: true, severity: 'warn', label: 'Un-gated open positions',
        detail: `${missing.map((t) => t.ticker).join(', ')} went on without a completed checklist.`,
      })
    }
  }
  return out
}

function fmtAbs(n: number): string {
  return (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString()
}

// ---------------------------------------------------------------------------
// Deviation inference — the app proposes, you confirm (Ch.21 honesty aid)
// ---------------------------------------------------------------------------

/**
 * Looks at what actually happened and suggests the deviations it implies.
 * Catching your own rule breaks is hard; the numbers do not have that problem.
 */
export function inferDeviations(trade: Trade, plan: Plan): Deviation[] {
  const found = new Set<Deviation>()

  if (trade.setupType === 'NON-SETUP') found.add('Traded a non-setup')
  if (trade.grade === 'NO-TRADE' && trade.status !== 'PLANNED') found.add('Traded a non-setup')
  if (plan.requireChecklistBeforeEntry && trade.status !== 'PLANNED' && !trade.checklistCompletedAt) {
    found.add('Skipped the checklist')
  }
  if (trade.status !== 'PLANNED' && trade.initialStop == null) found.add('No stop placed')

  // Chasing: paid meaningfully above the pivot you planned to buy.
  if (trade.entryPrice != null && trade.plannedEntry && trade.plannedStop) {
    const plannedRisk = Math.abs(trade.plannedEntry - trade.plannedStop)
    const slip = trade.direction === 'SHORT'
      ? trade.plannedEntry - trade.entryPrice
      : trade.entryPrice - trade.plannedEntry
    if (plannedRisk > 0 && slip > 0.25 * plannedRisk) found.add('Chased the entry')
  }

  // Sizing: compare what you did against what the plan permits.
  if (trade.shares && trade.entryPrice != null) {
    const equity = trade.equityAtEntry ?? plan.currentEquity
    const pct = (trade.shares * trade.entryPrice / equity) * 100
    if (pct > plan.maxPositionPct * 1.02) found.add('Oversized')
    const r = oneR(trade)
    if (r != null && (r / equity) * 100 > plan.maxRiskPerTradePct * 1.05) found.add('Oversized')
  }

  // Stops moved away from price are always hope, never a rule.
  for (const c of trade.stopChanges) {
    if (c.ruleBased) continue
    const away = trade.direction === 'SHORT' ? c.to > c.from : c.to < c.from
    if (away) found.add('Moved stop away from price')
  }

  // An exit below the stop means the stop was not honoured when it was hit.
  if (trade.initialStop != null && trade.entryPrice != null) {
    for (const e of trade.exits) {
      const beyond = trade.direction === 'SHORT'
        ? e.price > trade.initialStop * 1.02
        : e.price < trade.initialStop * 0.98
      if (beyond && e.reason === 'Initial stop hit') found.add('Held past the stop')
    }
  }

  for (const e of trade.exits) {
    if (!RULE_BASED_EXITS.includes(e.reason)) {
      if (e.reason === 'Discretionary — fear') found.add('Cut a winner early')
      else if (e.reason === 'Discretionary — greed') found.add('Held past the exit signal')
    }
  }

  if (trade.weatherAtEntry === 'BEARISH' && trade.direction === 'LONG') {
    found.add('Ignored market weather')
  }
  return [...found]
}
