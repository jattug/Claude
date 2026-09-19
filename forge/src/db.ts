/**
 * Local-first storage.
 *
 * Everything lives in this browser's IndexedDB. No account, no server, no
 * subscription, and your trading record never leaves your machine. Use
 * Rulebook -> Backup to take a JSON copy; that file is the only thing you need
 * to move the journal to another computer.
 */
import Dexie, { type Table } from 'dexie'
import type { Trade, DailyLog, Plan, WeeklyAudit, Incident } from './types'

export class ForgeDb extends Dexie {
  trades!: Table<Trade, string>
  logs!: Table<DailyLog, string>
  plan!: Table<Plan, string>
  audits!: Table<WeeklyAudit, string>
  incidents!: Table<Incident, string>

  constructor() {
    super('forge-journal')
    this.version(1).stores({
      trades: 'id, ticker, status, entryDate, exitDate, setupType',
      logs: 'id, date',
      plan: 'id',
      audits: 'id, weekEnding',
      incidents: 'id, date',
    })
  }
}

export const db = new ForgeDb()

export const uid = (): string =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

export const today = (): string => new Date().toISOString().slice(0, 10)

export const nowIso = (): string => new Date().toISOString()

// ---------------------------------------------------------------------------
// Defaults — deliberately conservative, straight out of Ch.11
// ---------------------------------------------------------------------------

export function defaultPlan(): Plan {
  return {
    id: 'plan',
    mode: 'simple',
    traderName: '',
    startingEquity: 50_000,
    currentEquity: 50_000,
    currency: 'USD',

    maxRiskPerTradePct: 0.5,
    targetRiskPerTradePct: 0.35,
    standardPositionPct: 10,
    maxPositionPct: 20,
    maxDailyLossPct: 2,
    maxOpenPositions: 10,
    maxSectorExposurePct: 30,

    minRsRating: 90,
    minAdrPct: 4,
    minDollarVolume: 50_000_000,

    tightnessAdrFraction: 0.667,
    minTightDays: 2,

    partialSellDay: 3,
    partialSellPct: 50,
    trailingMa: '10DSMA',
    cutDay1RedClose: true,
    breakevenAfterMaClearsEntry: true,

    maxTradesPerDay: 3,
    coolingOffMinutes: 15,
    noNewTradesLastMinutes: 30,
    requireChecklistBeforeEntry: true,

    scalingTiers: [
      { id: uid(), label: 'Base', equityMilestone: 0, minCompliance: 0, positionSizePct: 10 },
      { id: uid(), label: 'Tier 1', equityMilestone: 60_000, minCompliance: 90, positionSizePct: 12 },
      { id: uid(), label: 'Tier 2', equityMilestone: 75_000, minCompliance: 92, positionSizePct: 15 },
      { id: uid(), label: 'Tier 3', equityMilestone: 100_000, minCompliance: 95, positionSizePct: 20 },
    ],
    changeLog: [],
  }
}

export function emptyAudit() {
  return {
    setupMetCriteria: null, entryPerPlan: null, stopPlacedImmediately: null,
    sizePerPlan: null, exitPerRules: null, withinRiskLimits: null,
    checklistUsedBeforeEntry: null,
  }
}

export function newTrade(partial: Partial<Trade> = {}): Trade {
  return {
    id: uid(),
    ticker: '',
    direction: 'LONG',
    setupType: 'Breakout — Tight Consolidation',
    status: 'PLANNED',
    plannedEntry: 0,
    plannedStop: 0,
    plannedShares: 0,
    checklist: {},
    grade: 'NO-TRADE',
    exits: [],
    stopChanges: [],
    audit: emptyAudit(),
    deviations: [],
    emotionBefore: [],
    emotionDuring: [],
    emotionAfter: [],
    charts: [],
    wouldRepeat: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...partial,
  }
}

export function newLog(date: string): DailyLog {
  return {
    id: date,
    date,
    indexSymbol: 'QQQ',
    indexAbove20: null,
    ma10Above20: null,
    ma20Rising: null,
    preMarket: {},
    marketHours: {},
    postMarket: {},
    watchlist: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

export async function getPlan(): Promise<Plan> {
  const existing = await db.plan.get('plan')
  // Journals created before the mode flag existed default to simple.
  if (existing) return existing.mode ? existing : { ...existing, mode: 'simple' }
  const p = defaultPlan()
  await db.plan.put(p)
  return p
}

export async function savePlan(plan: Plan): Promise<void> {
  await db.plan.put(plan)
}

export async function saveTrade(trade: Trade): Promise<void> {
  await db.trades.put({ ...trade, updatedAt: nowIso() })
}

export async function saveLog(log: DailyLog): Promise<void> {
  await db.logs.put({ ...log, updatedAt: nowIso() })
}

export async function getOrCreateLog(date: string): Promise<DailyLog> {
  const existing = await db.logs.get(date)
  if (existing) return existing
  const l = newLog(date)
  await db.logs.put(l)
  return l
}

// ---------------------------------------------------------------------------
// Backup / restore
// ---------------------------------------------------------------------------

export interface Backup {
  app: 'forge'
  version: 1
  exportedAt: string
  plan: Plan | undefined
  trades: Trade[]
  logs: DailyLog[]
  audits: WeeklyAudit[]
  incidents: Incident[]
}

export async function exportAll(): Promise<Backup> {
  const [plan, trades, logs, audits, incidents] = await Promise.all([
    db.plan.get('plan'), db.trades.toArray(), db.logs.toArray(),
    db.audits.toArray(), db.incidents.toArray(),
  ])
  return { app: 'forge', version: 1, exportedAt: nowIso(), plan, trades, logs, audits, incidents }
}

export async function importAll(backup: Backup, mode: 'replace' | 'merge'): Promise<void> {
  if (backup.app !== 'forge') throw new Error('That file is not a Forge backup.')
  await db.transaction('rw', [db.plan, db.trades, db.logs, db.audits, db.incidents], async () => {
    if (mode === 'replace') {
      await Promise.all([db.trades.clear(), db.logs.clear(), db.audits.clear(), db.incidents.clear()])
    }
    if (backup.plan) await db.plan.put(backup.plan)
    if (backup.trades?.length) await db.trades.bulkPut(backup.trades)
    if (backup.logs?.length) await db.logs.bulkPut(backup.logs)
    if (backup.audits?.length) await db.audits.bulkPut(backup.audits)
    if (backup.incidents?.length) await db.incidents.bulkPut(backup.incidents)
  })
}

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', [db.plan, db.trades, db.logs, db.audits, db.incidents], async () => {
    await Promise.all([
      db.trades.clear(), db.logs.clear(), db.audits.clear(), db.incidents.clear(), db.plan.clear(),
    ])
  })
}
