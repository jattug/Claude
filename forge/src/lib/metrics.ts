/**
 * Analytics.
 *
 * Ch.2: P&L is secondary, used only to evaluate efficiency. So the headline
 * number here is compliance, and every P&L figure is reported in R and sliced
 * by whether you followed your rules.
 */
import type { Trade, DailyLog, Deviation, Emotion, Quadrant, Plan } from '../types'
import { isCompliant, quadrantOf } from './rules'

export interface CoreStats {
  trades: number
  audited: number
  compliant: number
  complianceRate: number | null
  wins: number
  losses: number
  winRate: number | null
  totalR: number
  totalPnl: number
  avgWinR: number | null
  avgLossR: number | null
  expectancyR: number | null
  profitFactor: number | null
  largestWinR: number | null
  largestLossR: number | null
  maxConsecutiveLosses: number
}

const EMPTY: CoreStats = {
  trades: 0, audited: 0, compliant: 0, complianceRate: null, wins: 0, losses: 0,
  winRate: null, totalR: 0, totalPnl: 0, avgWinR: null, avgLossR: null,
  expectancyR: null, profitFactor: null, largestWinR: null, largestLossR: null,
  maxConsecutiveLosses: 0,
}

export function closedTrades(trades: Trade[]): Trade[] {
  return trades.filter((t) => t.status === 'CLOSED')
}

export function coreStats(trades: Trade[]): CoreStats {
  const closed = closedTrades(trades)
  if (!closed.length) return { ...EMPTY }

  const audited = closed.filter((t) => isCompliant(t) !== null)
  const compliant = audited.filter((t) => isCompliant(t) === true)
  const rs = closed.map((t) => t.rMultiple).filter((r): r is number => r != null)
  const winsR = rs.filter((r) => r > 0)
  const lossesR = rs.filter((r) => r <= 0)

  let streak = 0, maxStreak = 0
  for (const t of [...closed].sort(byDate)) {
    if ((t.pnl ?? 0) < 0) { streak++; maxStreak = Math.max(maxStreak, streak) } else streak = 0
  }

  const grossWin = winsR.reduce((s, r) => s + r, 0)
  const grossLoss = Math.abs(lossesR.reduce((s, r) => s + r, 0))

  return {
    trades: closed.length,
    audited: audited.length,
    compliant: compliant.length,
    complianceRate: audited.length ? (compliant.length / audited.length) * 100 : null,
    wins: winsR.length,
    losses: lossesR.length,
    winRate: rs.length ? (winsR.length / rs.length) * 100 : null,
    totalR: rs.reduce((s, r) => s + r, 0),
    totalPnl: closed.reduce((s, t) => s + (t.pnl ?? 0), 0),
    avgWinR: winsR.length ? grossWin / winsR.length : null,
    avgLossR: lossesR.length ? -grossLoss / lossesR.length : null,
    expectancyR: rs.length ? rs.reduce((s, r) => s + r, 0) / rs.length : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    largestWinR: winsR.length ? Math.max(...winsR) : null,
    largestLossR: lossesR.length ? Math.min(...lossesR) : null,
    maxConsecutiveLosses: maxStreak,
  }
}

function byDate(a: Trade, b: Trade): number {
  return (a.exitDate ?? a.entryDate ?? '').localeCompare(b.exitDate ?? b.entryDate ?? '')
}

// ---------------------------------------------------------------------------
// The cost of indiscipline (Ch.13 — "make this pain visible")
// ---------------------------------------------------------------------------

export interface DisciplineCost {
  compliantPnl: number
  compliantR: number
  compliantCount: number
  violatingPnl: number
  violatingR: number
  violatingCount: number
  /** What your account would look like if the rule breaks had simply not happened. */
  cost: number
  costR: number
  avgCompliantR: number | null
  avgViolatingR: number | null
}

export function disciplineCost(trades: Trade[]): DisciplineCost {
  const closed = closedTrades(trades).filter((t) => isCompliant(t) !== null)
  const good = closed.filter((t) => isCompliant(t) === true)
  const bad = closed.filter((t) => isCompliant(t) === false)
  const sum = (ts: Trade[], k: 'pnl' | 'rMultiple') => ts.reduce((s, t) => s + (t[k] ?? 0), 0)

  const violatingPnl = sum(bad, 'pnl')
  const violatingR = sum(bad, 'rMultiple')
  return {
    compliantPnl: sum(good, 'pnl'),
    compliantR: sum(good, 'rMultiple'),
    compliantCount: good.length,
    violatingPnl, violatingR,
    violatingCount: bad.length,
    cost: -violatingPnl,
    costR: -violatingR,
    avgCompliantR: good.length ? sum(good, 'rMultiple') / good.length : null,
    avgViolatingR: bad.length ? violatingR / bad.length : null,
  }
}

// ---------------------------------------------------------------------------
// Equity curves — actual, versus the one where you only took the good trades
// ---------------------------------------------------------------------------

export interface EquityPoint {
  date: string
  actual: number
  disciplined: number
  label: string
}

export function equityCurve(trades: Trade[], startingEquity: number): EquityPoint[] {
  const closed = closedTrades(trades)
    .filter((t) => t.exitDate)
    .sort(byDate)
  let actual = startingEquity
  let disciplined = startingEquity
  const pts: EquityPoint[] = [{
    date: closed[0]?.exitDate ?? new Date().toISOString().slice(0, 10),
    actual, disciplined, label: 'Start',
  }]
  for (const t of closed) {
    actual += t.pnl ?? 0
    if (isCompliant(t) !== false) disciplined += t.pnl ?? 0
    pts.push({ date: t.exitDate!, actual, disciplined, label: t.ticker })
  }
  return pts
}

export function maxDrawdown(points: EquityPoint[], key: 'actual' | 'disciplined' = 'actual'): number {
  let peak = -Infinity, dd = 0
  for (const p of points) {
    peak = Math.max(peak, p[key])
    if (peak > 0) dd = Math.max(dd, ((peak - p[key]) / peak) * 100)
  }
  return dd
}

// ---------------------------------------------------------------------------
// Compliance over time
// ---------------------------------------------------------------------------

export interface CompliancePoint { date: string; rate: number; rolling: number | null; trades: number }

export function complianceOverTime(trades: Trade[], window = 10): CompliancePoint[] {
  const audited = closedTrades(trades)
    .filter((t) => isCompliant(t) !== null && t.exitDate)
    .sort(byDate)

  const byDay = new Map<string, Trade[]>()
  for (const t of audited) {
    const d = t.exitDate!
    byDay.set(d, [...(byDay.get(d) ?? []), t])
  }

  const out: CompliancePoint[] = []
  const seq: boolean[] = []
  for (const [date, ts] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const t of ts) seq.push(isCompliant(t) === true)
    const dayRate = (ts.filter((t) => isCompliant(t) === true).length / ts.length) * 100
    const tail = seq.slice(-window)
    out.push({
      date,
      rate: dayRate,
      rolling: seq.length >= Math.min(window, 3)
        ? (tail.filter(Boolean).length / tail.length) * 100
        : null,
      trades: ts.length,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Segmentation — where does the edge actually live?
// ---------------------------------------------------------------------------

export interface Segment {
  key: string
  trades: number
  totalR: number
  avgR: number
  winRate: number
  complianceRate: number | null
}

function segmentBy(trades: Trade[], keyOf: (t: Trade) => string | null | undefined): Segment[] {
  const groups = new Map<string, Trade[]>()
  for (const t of closedTrades(trades)) {
    const k = keyOf(t)
    if (!k) continue
    groups.set(k, [...(groups.get(k) ?? []), t])
  }
  return [...groups.entries()].map(([key, ts]) => {
    const rs = ts.map((t) => t.rMultiple).filter((r): r is number => r != null)
    const audited = ts.filter((t) => isCompliant(t) !== null)
    return {
      key,
      trades: ts.length,
      totalR: rs.reduce((s, r) => s + r, 0),
      avgR: rs.length ? rs.reduce((s, r) => s + r, 0) / rs.length : 0,
      winRate: rs.length ? (rs.filter((r) => r > 0).length / rs.length) * 100 : 0,
      complianceRate: audited.length
        ? (audited.filter((t) => isCompliant(t) === true).length / audited.length) * 100
        : null,
    }
  }).sort((a, b) => b.totalR - a.totalR)
}

export const bySetup = (t: Trade[]) => segmentBy(t, (x) => x.setupType)
export const byWeather = (t: Trade[]) => segmentBy(t, (x) => x.weatherAtEntry)
export const bySector = (t: Trade[]) => segmentBy(t, (x) => x.sector)
export const byGrade = (t: Trade[]) => segmentBy(t, (x) => x.grade)
export const byConviction = (t: Trade[]) => segmentBy(t, (x) => x.conviction ? `${x.conviction}/5` : null)
export const byDayOfWeek = (t: Trade[]) => segmentBy(t, (x) =>
  x.entryDate ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(x.entryDate + 'T12:00:00').getDay()] : null)

/** Does the tightness rule actually earn its keep? Bucket by tight-day count. */
export const byTightness = (t: Trade[]) => segmentBy(t, (x) => {
  if (x.tightDays == null) return null
  if (x.tightDays === 0) return '0 tight days'
  if (x.tightDays === 1) return '1 tight day'
  if (x.tightDays <= 3) return '2-3 tight days'
  return '4+ tight days'
})

export const byEmotionBefore = (trades: Trade[]): Segment[] => {
  const groups = new Map<Emotion, Trade[]>()
  for (const t of closedTrades(trades)) {
    for (const e of t.emotionBefore) groups.set(e, [...(groups.get(e) ?? []), t])
  }
  return [...groups.entries()].map(([key, ts]) => {
    const rs = ts.map((t) => t.rMultiple).filter((r): r is number => r != null)
    const audited = ts.filter((t) => isCompliant(t) !== null)
    return {
      key, trades: ts.length,
      totalR: rs.reduce((s, r) => s + r, 0),
      avgR: rs.length ? rs.reduce((s, r) => s + r, 0) / rs.length : 0,
      winRate: rs.length ? (rs.filter((r) => r > 0).length / rs.length) * 100 : 0,
      complianceRate: audited.length
        ? (audited.filter((t) => isCompliant(t) === true).length / audited.length) * 100 : null,
    }
  }).sort((a, b) => b.trades - a.trades)
}

// ---------------------------------------------------------------------------
// Deviation leaderboard — which demon is the most expensive?
// ---------------------------------------------------------------------------

export interface DeviationStat {
  deviation: Deviation
  count: number
  totalPnl: number
  totalR: number
  avgR: number
}

export function deviationLeaderboard(trades: Trade[]): DeviationStat[] {
  const map = new Map<Deviation, Trade[]>()
  for (const t of closedTrades(trades)) {
    for (const d of t.deviations) map.set(d, [...(map.get(d) ?? []), t])
  }
  return [...map.entries()].map(([deviation, ts]) => {
    const rs = ts.map((t) => t.rMultiple).filter((r): r is number => r != null)
    return {
      deviation,
      count: ts.length,
      totalPnl: ts.reduce((s, t) => s + (t.pnl ?? 0), 0),
      totalR: rs.reduce((s, r) => s + r, 0),
      avgR: rs.length ? rs.reduce((s, r) => s + r, 0) / rs.length : 0,
    }
  }).sort((a, b) => a.totalPnl - b.totalPnl)
}

export function quadrantCounts(trades: Trade[]): Record<Quadrant, Trade[]> {
  const out: Record<Quadrant, Trade[]> = {
    PROCESS_SUCCESS: [], GOOD_LOSS: [], LUCKY_WIN: [], PROCESS_FAILURE: [],
  }
  for (const t of trades) {
    const q = quadrantOf(t)
    if (q) out[q].push(t)
  }
  return out
}

// ---------------------------------------------------------------------------
// R distribution
// ---------------------------------------------------------------------------

export interface RBucket { label: string; lower: number; count: number }

export function rDistribution(trades: Trade[]): RBucket[] {
  const edges = [-Infinity, -2, -1.5, -1, -0.5, 0, 0.5, 1, 2, 3, 5, Infinity]
  const labels = ['< -2R', '-2 to -1.5', '-1.5 to -1', '-1 to -0.5', '-0.5 to 0',
    '0 to 0.5', '0.5 to 1', '1 to 2', '2 to 3', '3 to 5', '5R +']
  const buckets: RBucket[] = labels.map((label, i) => ({ label, lower: edges[i], count: 0 }))
  for (const t of closedTrades(trades)) {
    const r = t.rMultiple
    if (r == null) continue
    for (let i = 0; i < edges.length - 1; i++) {
      if (r >= edges[i] && r < edges[i + 1]) { buckets[i].count++; break }
    }
  }
  return buckets
}

// ---------------------------------------------------------------------------
// Behavioural metrics that a P&L tracker never shows you
// ---------------------------------------------------------------------------

export interface BehaviourStats {
  stopHonourRate: number | null
  stopsMovedCount: number
  checklistUseRate: number | null
  nonSetupCount: number
  nonSetupPnl: number
  /** Ch.10 — R you gave back by exiting before the rule said to. */
  rLeftOnTable: number | null
  avgChaseR: number | null
  currentCompliantStreak: number
  bestCompliantStreak: number
  /** Ch.12 — "never miss twice": did a rule break get followed by another? */
  missedTwiceCount: number
}

export function behaviourStats(trades: Trade[]): BehaviourStats {
  const closed = closedTrades(trades).sort(byDate)

  const withStopAudit = closed.filter((t) => t.audit.stopPlacedImmediately !== null)
  const stopHonourRate = withStopAudit.length
    ? (withStopAudit.filter((t) => t.audit.stopPlacedImmediately && !t.deviations.includes('Held past the stop')).length
       / withStopAudit.length) * 100
    : null

  const withChecklistAudit = closed.filter((t) => t.audit.checklistUsedBeforeEntry !== null)
  const checklistUseRate = withChecklistAudit.length
    ? (withChecklistAudit.filter((t) => t.audit.checklistUsedBeforeEntry).length / withChecklistAudit.length) * 100
    : null

  const nonSetups = closed.filter((t) => t.deviations.includes('Traded a non-setup') || t.setupType === 'NON-SETUP')

  // Winners cut early: the gap between how far it ran and what you actually took.
  const early = closed.filter((t) => t.deviations.includes('Cut a winner early') && t.mfeR != null && t.rMultiple != null)
  const rLeftOnTable = early.length
    ? early.reduce((s, t) => s + Math.max(0, (t.mfeR ?? 0) - (t.rMultiple ?? 0)), 0)
    : null

  const chased = closed.filter((t) => t.deviations.includes('Chased the entry') && t.rMultiple != null)
  const avgChaseR = chased.length ? chased.reduce((s, t) => s + (t.rMultiple ?? 0), 0) / chased.length : null

  let cur = 0, best = 0, missedTwice = 0
  let prevBad = false
  for (const t of closed) {
    const c = isCompliant(t)
    if (c === true) { cur++; best = Math.max(best, cur); prevBad = false }
    else if (c === false) {
      if (prevBad) missedTwice++
      cur = 0; prevBad = true
    }
  }

  return {
    stopHonourRate,
    stopsMovedCount: closed.filter((t) => t.stopChanges.some((c) => !c.ruleBased)).length,
    checklistUseRate,
    nonSetupCount: nonSetups.length,
    nonSetupPnl: nonSetups.reduce((s, t) => s + (t.pnl ?? 0), 0),
    rLeftOnTable,
    avgChaseR,
    currentCompliantStreak: cur,
    bestCompliantStreak: best,
    missedTwiceCount: missedTwice,
  }
}

// ---------------------------------------------------------------------------
// Patience (Ch.5) and missed opportunities (Ch.21)
// ---------------------------------------------------------------------------

export interface PatienceStats {
  tradingDays: number
  daysWithTrades: number
  /** Ch.5 — a day you scanned, found nothing and did nothing is a WIN. */
  disciplinedNoTradeDays: number
  avgTradesPerActiveDay: number
  focusListAccuracy: number | null
  missedTriggers: number
  estimatedRMissed: number
}

export function patienceStats(trades: Trade[], logs: DailyLog[]): PatienceStats {
  const dates = new Set(trades.filter((t) => t.entryDate).map((t) => t.entryDate!))
  const withTrades = logs.filter((l) => dates.has(l.date)).length
  const noTradeDays = logs.filter((l) => !dates.has(l.date) && (l.preMarket?.scans || l.watchlist.length > 0))

  const allWatch = logs.flatMap((l) => l.watchlist)
  const triggered = allWatch.filter((w) => w.outcome === 'TAKEN' || w.outcome === 'TRIGGERED_MISSED')
  const missed = allWatch.filter((w) => w.outcome === 'TRIGGERED_MISSED')

  return {
    tradingDays: logs.length,
    daysWithTrades: withTrades,
    disciplinedNoTradeDays: noTradeDays.length,
    avgTradesPerActiveDay: withTrades
      ? trades.filter((t) => t.entryDate).length / withTrades : 0,
    focusListAccuracy: triggered.length
      ? (triggered.filter((w) => w.outcome === 'TAKEN').length / triggered.length) * 100 : null,
    missedTriggers: missed.length,
    estimatedRMissed: missed.reduce((s, w) => s + (w.estimatedRMissed ?? 0), 0),
  }
}

// ---------------------------------------------------------------------------
// Scaling readiness (Ch.23) — you do not size up on a hunch
// ---------------------------------------------------------------------------

export interface ScalingReadiness {
  currentTier: string
  nextTier: string | null
  equityMet: boolean
  complianceMet: boolean
  rollingCompliance: number | null
  requiredCompliance: number | null
  requiredEquity: number | null
  ready: boolean
  verdict: string
}

export function scalingReadiness(plan: Plan, trades: Trade[]): ScalingReadiness {
  const tiers = [...plan.scalingTiers].sort((a, b) => a.equityMilestone - b.equityMilestone)
  const recent = closedTrades(trades).sort(byDate).slice(-20)
  const audited = recent.filter((t) => isCompliant(t) !== null)
  const rolling = audited.length >= 5
    ? (audited.filter((t) => isCompliant(t) === true).length / audited.length) * 100
    : null

  const current = [...tiers].reverse().find((t) => plan.currentEquity >= t.equityMilestone)
  const next = tiers.find((t) => t.equityMilestone > (current?.equityMilestone ?? -Infinity))

  if (!next) {
    return {
      currentTier: current?.label ?? 'Base',
      nextTier: null, equityMet: true, complianceMet: true,
      rollingCompliance: rolling, requiredCompliance: null, requiredEquity: null,
      ready: false, verdict: 'Top of your ladder. Add a tier in the Rulebook when you are ready to plan the next step up.',
    }
  }

  const equityMet = plan.currentEquity >= next.equityMilestone
  const complianceMet = rolling != null && rolling >= next.minCompliance
  const ready = equityMet && complianceMet

  let verdict: string
  if (ready) {
    verdict = `Earned. Equity and a ${rolling!.toFixed(0)}% compliance rate both clear the bar — step up to ${next.positionSizePct}% positions.`
  } else if (!equityMet && !complianceMet) {
    verdict = 'Neither the equity milestone nor the discipline bar is met. Stay where you are.'
  } else if (!equityMet) {
    verdict = `Discipline is there. You need ${fmt(next.equityMilestone - plan.currentEquity)} more equity. Scale from strength, never to catch up.`
  } else {
    verdict = rolling == null
      ? 'Equity is there, but you have not closed enough audited trades to prove the discipline yet.'
      : `Equity is there but compliance is ${rolling.toFixed(0)}%, under the ${next.minCompliance}% bar. Size increases are earned with behaviour, not account balance.`
  }

  return {
    currentTier: current?.label ?? 'Base',
    nextTier: next.label,
    equityMet, complianceMet, rollingCompliance: rolling,
    requiredCompliance: next.minCompliance, requiredEquity: next.equityMilestone,
    ready, verdict,
  }
}

function fmt(n: number): string { return '$' + Math.round(n).toLocaleString() }

// ---------------------------------------------------------------------------
// Routine adherence (Appendix C)
// ---------------------------------------------------------------------------

export function routineAdherence(logs: DailyLog[], steps: { key: string }[], phase: 'preMarket' | 'marketHours' | 'postMarket'): number | null {
  if (!logs.length) return null
  let done = 0, total = 0
  for (const l of logs) {
    for (const s of steps) { total++; if (l[phase]?.[s.key]) done++ }
  }
  return total ? (done / total) * 100 : null
}

export function dateRangeFilter(trades: Trade[], days: number | null): Trade[] {
  if (days == null) return trades
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const iso = cutoff.toISOString().slice(0, 10)
  return trades.filter((t) => (t.exitDate ?? t.entryDate ?? '') >= iso)
}
