/**
 * A sample month.
 *
 * Deliberately not a highlight reel: it contains the exact failure modes the
 * book describes — a chased entry, a boredom trade in bad weather, a revenge
 * trade after a stop-out, a winner cut early, and one profitable rule break so
 * the Lucky Win quadrant has something in it. The point is to show what the
 * analytics look like when they have something honest to say.
 */
import { db, newTrade, newLog, uid, nowIso, getPlan } from '../db'
import type { Trade, DailyLog, Weather, Emotion, Deviation, ExitReason } from '../types'
import { computePnl } from './rules'

interface Spec {
  ticker: string
  daysAgo: number
  holdDays: number
  setup: Trade['setupType']
  sector: string
  weather: Weather
  entry: number
  stop: number
  plannedEntry?: number
  exitPrice: number
  exitReason: ExitReason
  positionPct: number
  rs: number
  adr: number
  tightDays: number
  grade: Trade['grade']
  emotionBefore: Emotion[]
  emotionAfter: Emotion[]
  deviations: Deviation[]
  conviction: number
  mfeR?: number
  maeR?: number
  lesson: string
  context?: string
}

const SPECS: Spec[] = [
  {
    ticker: 'NVDA', daysAgo: 30, holdDays: 6, setup: 'Breakout — Tight Consolidation',
    sector: 'AI infrastructure', weather: 'BULLISH', entry: 118.40, stop: 115.90,
    exitPrice: 131.20, exitReason: 'Trailing MA close break', positionPct: 12,
    rs: 96, adr: 5.2, tightDays: 3, grade: 'A+',
    emotionBefore: ['Calm', 'Focused'], emotionAfter: ['Calm'], deviations: [],
    conviction: 4, mfeR: 5.6, maeR: -0.3,
    lesson: 'Textbook. Three tight days at the rising 10DSMA, partial on day 3, trailed the rest out.',
  },
  {
    ticker: 'CRWD', daysAgo: 28, holdDays: 1, setup: 'Breakout — Tight Consolidation',
    sector: 'Cybersecurity', weather: 'BULLISH', entry: 342.10, stop: 336.50,
    exitPrice: 336.50, exitReason: 'Initial stop hit', positionPct: 10,
    rs: 92, adr: 4.1, tightDays: 2, grade: 'A+',
    emotionBefore: ['Calm'], emotionAfter: ['Calm'], deviations: [],
    conviction: 4, mfeR: 0.4, maeR: -1.0,
    lesson: 'Clean stop-out. Nothing to fix — this is the cost of doing business.',
  },
  {
    ticker: 'SMCI', daysAgo: 26, holdDays: 1, setup: 'NON-SETUP',
    sector: 'Servers', weather: 'CAUTION', entry: 48.20, stop: 45.80,
    exitPrice: 45.10, exitReason: 'Initial stop hit', positionPct: 14,
    rs: 71, adr: 8.4, tightDays: 0, grade: 'NO-TRADE',
    emotionBefore: ['Bored', 'Impatient'], emotionAfter: ['Frustrated'],
    deviations: ['Traded a non-setup', 'Boredom trade', 'Held past the stop'],
    conviction: 2, mfeR: 0.2, maeR: -1.3,
    lesson: 'Dead hour, nothing on the focus list, took it because I wanted to be doing something. RS was 71.',
    context: 'Quiet mid-day, no A+ setups triggering, watched it run without me for twenty minutes first.',
  },
  {
    ticker: 'AMD', daysAgo: 25, holdDays: 1, setup: 'Breakout — Tight Consolidation',
    sector: 'Semis', weather: 'CAUTION', entry: 164.90, stop: 161.20,
    exitPrice: 161.20, exitReason: 'Initial stop hit', positionPct: 11,
    rs: 88, adr: 4.6, tightDays: 2, grade: 'A',
    emotionBefore: ['Frustrated', 'Desperate'], emotionAfter: ['Deflated'],
    deviations: ['Revenge trade', 'Traded during cooling-off'],
    conviction: 3, mfeR: 0.3, maeR: -1.0,
    lesson: 'Entered eleven minutes after the SMCI stop-out. The cooling-off rule exists precisely for this.',
    context: 'Straight after being stopped out of SMCI. Wanted the money back immediately.',
  },
  {
    ticker: 'VRT', daysAgo: 21, holdDays: 8, setup: 'Breakout — Tight Consolidation',
    sector: 'Data centre power', weather: 'BULLISH', entry: 92.30, stop: 89.60,
    exitPrice: 108.40, exitReason: 'Trailing MA close break', positionPct: 12,
    rs: 94, adr: 5.8, tightDays: 4, grade: 'A+',
    emotionBefore: ['Calm', 'Confident'], emotionAfter: ['Calm'], deviations: [],
    conviction: 5, mfeR: 6.4, maeR: -0.2,
    lesson: 'Four tight days is the tell. Sat through two ugly intraday pullbacks and did nothing, which was the work.',
  },
  {
    ticker: 'APP', daysAgo: 18, holdDays: 2, setup: 'Episodic Pivot (EP)',
    sector: 'Adtech', weather: 'BULLISH', entry: 312.00, plannedEntry: 298.50, stop: 296.00,
    exitPrice: 305.50, exitReason: 'Discretionary — fear', positionPct: 10,
    rs: 97, adr: 7.2, tightDays: 1, grade: 'A',
    emotionBefore: ['FOMO', 'Rushed'], emotionAfter: ['Frustrated'],
    deviations: ['Chased the entry', 'Cut a winner early'],
    conviction: 3, mfeR: 1.8, maeR: -0.7,
    lesson: 'Paid 13 points above my own trigger, so every wiggle felt like a loss. Then sold into strength out of anxiety. The chase caused the early exit.',
    context: 'Gapped through my level at the open and I took it anyway rather than letting it go.',
  },
  {
    ticker: 'PLTR', daysAgo: 15, holdDays: 5, setup: 'Shoryuken (MA pullback)',
    sector: 'Software', weather: 'BULLISH', entry: 58.20, stop: 56.40,
    exitPrice: 64.10, exitReason: 'Trailing MA close break', positionPct: 10,
    rs: 95, adr: 5.5, tightDays: 2, grade: 'A+',
    emotionBefore: ['Calm', 'Focused'], emotionAfter: ['Confident'], deviations: [],
    conviction: 4, mfeR: 3.6, maeR: -0.4,
    lesson: 'Sharp pullback to the rising 10, entered over the high of the pullback candle. Rules all the way through.',
  },
  {
    ticker: 'MSTR', daysAgo: 12, holdDays: 3, setup: 'Breakout — Tight Consolidation',
    sector: 'Crypto proxy', weather: 'CAUTION', entry: 402.00, stop: 388.00,
    exitPrice: 448.00, exitReason: 'Discretionary — greed', positionPct: 22,
    rs: 93, adr: 9.1, tightDays: 1, grade: 'B',
    emotionBefore: ['Euphoric', 'Overconfident', 'Greedy'], emotionAfter: ['Euphoric'],
    deviations: ['Oversized', 'Ignored market weather'],
    conviction: 5, mfeR: 3.9, maeR: -0.5,
    lesson: 'Made money, broke two rules to do it. 22% position in choppy weather off one tight day. This is the trade that will blow up the account the third time I try it.',
    context: 'Right after the PLTR winner closed. Felt untouchable.',
  },
  {
    ticker: 'ANET', daysAgo: 9, holdDays: 1, setup: 'Breakout — Tight Consolidation',
    sector: 'Networking', weather: 'BEARISH', entry: 402.50, stop: 394.00,
    exitPrice: 394.00, exitReason: 'Initial stop hit', positionPct: 10,
    rs: 91, adr: 4.3, tightDays: 3, grade: 'A',
    emotionBefore: ['Impatient'], emotionAfter: ['Frustrated'],
    deviations: ['Ignored market weather'],
    conviction: 3, mfeR: 0.5, maeR: -1.0,
    lesson: 'Good chart, wrong tide. QQQ was below a falling 20 and the plan says no new long breakouts. The setup was not the problem.',
  },
  {
    ticker: 'HOOD', daysAgo: 6, holdDays: 4, setup: 'Breakout — Tight Consolidation',
    sector: 'Fintech', weather: 'BULLISH', entry: 41.80, stop: 40.60,
    exitPrice: 46.20, exitReason: 'Trailing MA close break', positionPct: 11,
    rs: 94, adr: 5.9, tightDays: 3, grade: 'A+',
    emotionBefore: ['Calm'], emotionAfter: ['Calm'], deviations: [],
    conviction: 4, mfeR: 4.1, maeR: -0.3,
    lesson: 'Tightest chart on the list that morning and it was the one that worked. That keeps being true.',
  },
  {
    ticker: 'TSLA', daysAgo: 4, holdDays: 1, setup: 'Breakout — Tight Consolidation',
    sector: 'Autos', weather: 'BULLISH', entry: 348.00, stop: 341.00,
    exitPrice: 341.00, exitReason: 'Initial stop hit', positionPct: 10,
    rs: 90, adr: 4.8, tightDays: 2, grade: 'A+',
    emotionBefore: ['Calm', 'Focused'], emotionAfter: ['Calm'], deviations: [],
    conviction: 4, mfeR: 0.6, maeR: -1.0,
    lesson: 'Stopped out clean. Logged it, took the break, did not look for a replacement.',
  },
  {
    ticker: 'NBIS', daysAgo: 2, holdDays: 1, setup: 'NON-SETUP',
    sector: 'AI infrastructure', weather: 'BULLISH', entry: 38.90, stop: 36.50,
    exitPrice: 36.20, exitReason: 'Initial stop hit', positionPct: 9,
    rs: 84, adr: 9.8, tightDays: 0, grade: 'NO-TRADE',
    emotionBefore: ['FOMO'], emotionAfter: ['Deflated'],
    deviations: ['Traded a non-setup', 'Chased the entry', 'Skipped the checklist'],
    conviction: 2, mfeR: 0.1, maeR: -1.2,
    lesson: 'Saw it on Twitter, no base, no tightness, never opened the checklist. Fourth non-setup this month and they are all losses.',
    context: 'Saw it moving on social media and bought within thirty seconds.',
  },
]

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function buildTrade(s: Spec, equity: number): Trade {
  const riskPerShare = Math.abs(s.entry - s.stop)
  const shares = Math.max(1, Math.floor((equity * (s.positionPct / 100)) / s.entry))
  const entryDate = isoDaysAgo(s.daysAgo)
  const exitDate = isoDaysAgo(Math.max(0, s.daysAgo - s.holdDays))
  const compliant = s.deviations.length === 0

  // Multi-day winners took the scheduled partial first, as the rulebook says.
  const exits = s.holdDays >= 3 && s.exitPrice > s.entry
    ? [
        {
          id: uid(), date: isoDaysAgo(Math.max(0, s.daysAgo - 2)),
          price: s.entry + riskPerShare * 1.6, shares: Math.floor(shares / 2),
          reason: 'Scheduled partial (Day 3-5)' as ExitReason,
        },
        {
          id: uid(), date: exitDate, price: s.exitPrice,
          shares: shares - Math.floor(shares / 2), reason: s.exitReason,
        },
      ]
    : [{ id: uid(), date: exitDate, price: s.exitPrice, shares, reason: s.exitReason }]

  const t: Trade = {
    ...newTrade(),
    ticker: s.ticker,
    direction: 'LONG',
    setupType: s.setup,
    status: 'CLOSED',
    plannedEntry: s.plannedEntry ?? s.entry,
    plannedStop: s.stop,
    plannedShares: shares,
    checklistCompletedAt: s.deviations.includes('Skipped the checklist') ? undefined : `${entryDate}T13:10:00.000Z`,
    checklist: {},
    grade: s.grade,
    rsRating: s.rs,
    adrPct: s.adr,
    dollarVolume: 250_000_000,
    sector: s.sector,
    tightDays: s.tightDays,
    entryDate,
    entryTime: '14:42',
    entryPrice: s.entry,
    shares,
    initialStop: s.stop,
    currentStop: s.stop,
    weatherAtEntry: s.weather,
    equityAtEntry: equity,
    exits,
    stopChanges: [],
    exitDate,
    maeR: s.maeR,
    mfeR: s.mfeR,
    audit: {
      setupMetCriteria: s.grade !== 'NO-TRADE',
      entryPerPlan: !s.deviations.includes('Chased the entry'),
      stopPlacedImmediately: true,
      sizePerPlan: !s.deviations.includes('Oversized'),
      exitPerRules: !s.exitReason.startsWith('Discretionary'),
      withinRiskLimits: !s.deviations.includes('Oversized') && !s.deviations.includes('Traded during cooling-off'),
      checklistUsedBeforeEntry: !s.deviations.includes('Skipped the checklist'),
    },
    deviations: s.deviations,
    deviationNote: s.context,
    emotionBefore: s.emotionBefore,
    emotionDuring: compliant ? ['Calm'] : ['Anxious'],
    emotionAfter: s.emotionAfter,
    conviction: s.conviction,
    precedingContext: s.context,
    wouldRepeat: compliant,
    lesson: s.lesson,
    charts: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  const { pnl, rMultiple } = computePnl(t)
  t.pnl = pnl ?? undefined
  t.rMultiple = rMultiple ?? undefined
  return t
}

function buildLog(date: string, weather: Weather, seed: number): DailyLog {
  const all = (steps: string[]) => Object.fromEntries(steps.map((k) => [k, true]))
  const most = (steps: string[]) =>
    Object.fromEntries(steps.map((k, i) => [k, (i + seed) % 5 !== 0]))

  return {
    ...newLog(date),
    weather,
    indexSymbol: 'QQQ',
    indexAbove20: weather !== 'BEARISH',
    ma10Above20: weather === 'BULLISH',
    ma20Rising: weather === 'BULLISH',
    watchlistQuality: weather === 'BULLISH' ? 4 : weather === 'CAUTION' ? 3 : 2,
    sleepHours: 6.5 + ((seed % 4) * 0.5),
    energy: 3 + (seed % 3),
    stress: 1 + (seed % 3),
    preMarket: all(['mindset', 'weather', 'positions', 'scans', 'gameplan', 'alerts', 'rehearsal']),
    marketHours: most(['focus', 'triggers', 'stops', 'size', 'nochase', 'manage', 'honored', 'break', 'log']),
    postMarket: most(['decompress', 'journal', 'missed', 'metrics', 'context', 'prep', 'lesson', 'study', 'shutdown']),
    processGoal: 'Checklist before every entry. No exceptions.',
    watchlist: [],
  }
}

export async function loadDemoData(): Promise<void> {
  const plan = await getPlan()
  const equity = plan.startingEquity

  const trades = SPECS.map((s) => buildTrade(s, equity))
  await db.trades.bulkPut(trades)

  // One log per weekday of the last month, so routine-adherence stats have a base.
  const logs: DailyLog[] = []
  for (let i = 30; i >= 0; i--) {
    const date = isoDaysAgo(i)
    const dow = new Date(date + 'T12:00:00').getDay()
    if (dow === 0 || dow === 6) continue
    const spec = SPECS.find((s) => s.daysAgo === i)
    const weather: Weather = spec?.weather ?? (i % 7 === 0 ? 'BEARISH' : i % 3 === 0 ? 'CAUTION' : 'BULLISH')
    logs.push(buildLog(date, weather, i))
  }
  await db.logs.bulkPut(logs)

  const realised = trades.reduce((s, t) => s + (t.pnl ?? 0), 0)
  await db.plan.put({ ...plan, currentEquity: Math.round(plan.startingEquity + realised) })
}
