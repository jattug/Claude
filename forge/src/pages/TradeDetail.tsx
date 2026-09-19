/**
 * The full trade record (Ch.21).
 *
 * Execution, management, the five audit questions, and the psychological
 * debrief. The audit is where the compliance number comes from, so the app
 * nudges hard toward finishing it — and proposes the deviations it can detect
 * on its own, because catching your own rule breaks is the hard part.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveTrade, uid, today } from '../db'
import {
  AUDIT_QUESTIONS, DEVIATIONS, EMOTIONS, EXIT_REASONS, SETUP_TYPES,
  type Trade, type Deviation, type Emotion, type ExitReason, type ProcessAudit, type SetupType,
  type Plan,
} from '../types'
import {
  isCompliant, quadrantOf, QUADRANT_META, inferDeviations, computePnl,
  oneR, openShares, realisedShares, avgExitPrice, calcSize, gradeSetup, nextAction,
} from '../lib/rules'
import { money, num, rMult, signedMoney, longDate, pct } from '../lib/format'
import {
  Card, Field, NumberInput, TextInput, TextArea, Select, Callout, Badge,
  ChipToggle, TriToggle, Tabs, Modal,
} from '../components/ui'

type Tab = 'execution' | 'audit' | 'psychology' | 'charts'

export default function TradeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const plan = useLiveQuery(() => db.plan.get('plan'), [])
  const stored = useLiveQuery(() => (id ? db.trades.get(id) : undefined), [id])
  const [trade, setTrade] = useState<Trade | null>(null)
  const [tab, setTab] = useState<Tab>('execution')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { if (stored) setTrade(stored) }, [stored])

  if (!plan) return <p className="muted">Loading…</p>
  if (!trade) return <Callout tone="warn" title="Trade not found">
    <Link to="/trades">Back to the journal</Link>
  </Callout>

  const update = (patch: Partial<Trade>) => {
    const next = { ...trade, ...patch }
    const { pnl, rMultiple } = computePnl(next)
    next.pnl = pnl ?? undefined
    next.rMultiple = rMultiple ?? undefined
    setTrade(next)
    void saveTrade(next)
  }

  const simple = plan.mode !== 'full'
  const compliant = isCompliant(trade)
  const quad = quadrantOf(trade)
  const meta = quad ? QUADRANT_META[quad] : null
  const r = oneR(trade)
  const suggested = inferDeviations(trade, plan).filter((d) => !trade.deviations.includes(d))
  const auditDone = Object.values(trade.audit).every((v) => v !== null)

  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <div className="row">
            <h1>{trade.ticker || 'Untitled'}</h1>
            <Badge tone={trade.grade === 'A+' ? 'good' : trade.grade === 'NO-TRADE' ? 'bad' : 'warn'}>
              {trade.grade}
            </Badge>
            <Badge tone="neutral">
              {trade.status === 'PLANNED' ? 'Armed' : trade.status === 'OPEN' ? 'Open' : 'Closed'}
            </Badge>
            {trade.direction === 'SHORT' ? <Badge tone="neutral">Short</Badge> : null}
          </div>
          <div className="btn-row">
            <Link to="/trades" className="btn btn-sm btn-ghost">← Journal</Link>
            <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
          </div>
        </div>
        <p>
          {trade.setupType} · {trade.entryDate ? longDate(trade.entryDate) : 'not yet entered'}
          {trade.sector ? ` · ${trade.sector}` : ''}
        </p>
      </div>

      {meta ? (
        <Callout tone={meta.tone === 'good' ? 'good' : meta.tone === 'warning' ? 'warn' : 'bad'}
          title={`${meta.label} — ${meta.verdict}`}>
          {meta.blurb}
        </Callout>
      ) : trade.status === 'CLOSED' && !auditDone ? (
        <Callout tone="warn" title="This trade is closed but not reviewed">
          {simple
            ? 'One question and it joins your compliance rate.'
            : 'Until the seven questions are answered it does not count toward your compliance rate.'}{' '}
          <button className="btn btn-sm" onClick={() => setTab('audit')}>
            {simple ? 'Answer it' : 'Audit it now'}
          </button>
        </Callout>
      ) : null}

      {trade.status === 'OPEN' ? (
        <Callout tone="info" title={nextAction(trade, plan).headline}>
          {nextAction(trade, plan).detail}{' '}
          <Link to="/positions">Manage the position</Link>
        </Callout>
      ) : null}

      {trade.status === 'CLOSED' ? (
        <div className="grid grid-4" style={{ marginTop: 14 }}>
          <Metric label="R multiple" value={rMult(trade.rMultiple)}
            tone={trade.rMultiple != null ? (trade.rMultiple > 0 ? 'good' : 'bad') : undefined} />
          <Metric label="Net P&L" value={signedMoney(trade.pnl, plan.currency)}
            tone={trade.pnl != null ? (trade.pnl > 0 ? 'good' : 'bad') : undefined} />
          <Metric label="1R was" value={r ? money(r, plan.currency) : '—'}
            note={trade.equityAtEntry ? `${pct((r ?? 0) / trade.equityAtEntry * 100, 2)} of equity` : undefined} />
          <Metric label="Rules followed" value={compliant === null ? '—' : compliant ? 'Yes' : 'No'}
            tone={compliant === null ? undefined : compliant ? 'good' : 'bad'}
            note={trade.deviations.length ? `${trade.deviations.length} deviation${trade.deviations.length > 1 ? 's' : ''}` : undefined} />
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <Tabs<Tab>
          active={tab} onChange={setTab}
          tabs={[
            { id: 'execution', label: 'Execution' },
            {
              id: 'audit',
              label: simple
                ? (auditDone ? 'Review ✓' : 'Review')
                : (auditDone ? 'Process audit ✓' : 'Process audit'),
            },
            ...(simple ? [] : [{ id: 'psychology' as const, label: 'Psychology' }]),
            { id: 'charts', label: `Charts${trade.charts.length ? ` (${trade.charts.length})` : ''}` },
          ]}
        />
      </div>

      {tab === 'execution' ? <ExecutionTab trade={trade} plan={plan} update={update} /> : null}
      {tab === 'audit' ? (
        plan.mode === 'simple'
          ? <SimpleAudit trade={trade} update={update} suggested={suggested} compliant={compliant} />
          : <AuditTab trade={trade} update={update} suggested={suggested} compliant={compliant} />
      ) : null}
      {tab === 'psychology' ? <PsychologyTab trade={trade} update={update} /> : null}
      {tab === 'charts' ? <ChartsTab trade={trade} update={update} /> : null}

      {confirmDelete ? (
        <Modal title="Delete this trade?" onClose={() => setConfirmDelete(false)}>
          <p>
            This permanently removes <b>{trade.ticker}</b> and everything logged against it. Deleting
            losing or embarrassing trades is the fastest way to make your own statistics useless.
          </p>
          <div className="btn-row">
            <button className="btn btn-danger" onClick={async () => {
              await db.trades.delete(trade.id); navigate('/trades')
            }}>Delete permanently</button>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}

function Metric({ label, value, note, tone }: {
  label: string; value: string; note?: string; tone?: 'good' | 'bad'
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value sm ${tone ?? ''}`}>{value}</div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------- execution

function ExecutionTab({ trade, plan, update }: {
  trade: Trade
  plan: Plan
  update: (p: Partial<Trade>) => void
}) {
  const [showExit, setShowExit] = useState(false)
  const remaining = openShares(trade)
  const sold = realisedShares(trade)
  const avgExit = avgExitPrice(trade)
  const g = gradeSetup(trade.checklist)
  const size = calcSize(
    trade.entryPrice ?? trade.plannedEntry,
    trade.initialStop ?? trade.plannedStop,
    trade.equityAtEntry ?? plan.currentEquity,
    plan.standardPositionPct,
    plan.maxRiskPerTradePct,
  )

  // Was the size you actually took the size the plan permitted?
  const actualPct = trade.shares && trade.entryPrice
    ? (trade.shares * trade.entryPrice / (trade.equityAtEntry ?? plan.currentEquity)) * 100
    : null

  function enterTrade() {
    update({
      status: 'OPEN',
      entryDate: trade.entryDate ?? today(),
      entryPrice: trade.entryPrice ?? trade.plannedEntry,
      shares: trade.shares ?? trade.plannedShares,
      initialStop: trade.initialStop ?? trade.plannedStop,
      currentStop: trade.currentStop ?? trade.plannedStop,
      equityAtEntry: trade.equityAtEntry ?? plan.currentEquity,
    })
  }

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="stack">
        <Card>
          <div className="card-head"><h2>The plan</h2></div>
          <div className="grid grid-2">
            <Field label="Ticker">
              <TextInput value={trade.ticker}
                onChange={(e) => update({ ticker: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Setup">
              <Select value={trade.setupType}
                onChange={(e) => update({ setupType: e.target.value as SetupType })}>
                {SETUP_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Planned entry">
              <NumberInput value={trade.plannedEntry || undefined} step={0.01}
                onValue={(v) => update({ plannedEntry: v ?? 0 })} />
            </Field>
            <Field label="Planned stop">
              <NumberInput value={trade.plannedStop || undefined} step={0.01}
                onValue={(v) => update({ plannedStop: v ?? 0 })} />
            </Field>
          </div>
          <div className="row" style={{ fontSize: 12.5, gap: 16 }}>
            <span className="muted">Gate grade: <b>{g.grade}</b></span>
            <span className="muted">
              Checklist: {trade.checklistCompletedAt
                ? <b className="good">completed before entry</b>
                : <b className="bad">never completed</b>}
            </span>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h2>What actually happened</h2>
            {trade.status === 'PLANNED'
              ? <button className="btn btn-sm btn-primary" onClick={enterTrade}>Mark as filled</button>
              : null}
          </div>
          <div className="grid grid-3">
            <Field label="Entry date">
              <input type="date" value={trade.entryDate ?? ''}
                onChange={(e) => update({ entryDate: e.target.value })} />
            </Field>
            <Field label="Entry time">
              <input type="time" value={trade.entryTime ?? ''}
                onChange={(e) => update({ entryTime: e.target.value })} />
            </Field>
            <Field label="Fill price">
              <NumberInput value={trade.entryPrice} step={0.01}
                onValue={(v) => update({ entryPrice: v })} />
            </Field>
            <Field label="Shares">
              <NumberInput value={trade.shares} onValue={(v) => update({ shares: v })} />
            </Field>
            <Field label="Initial stop">
              <NumberInput value={trade.initialStop} step={0.01}
                onValue={(v) => update({ initialStop: v })} />
            </Field>
            <Field label="Fees">
              <NumberInput value={trade.fees} step={0.01} onValue={(v) => update({ fees: v })} />
            </Field>
          </div>

          {trade.entryPrice != null && trade.plannedEntry > 0 ? (
            <ChaseCheck trade={trade} />
          ) : null}

          {actualPct != null ? (
            <p style={{ fontSize: 12.5, margin: '8px 0 0' }}>
              Position was <b>{pct(actualPct)}</b> of equity.{' '}
              {actualPct > plan.maxPositionPct * 1.02 ? (
                <span className="bad">
                  That is over your {plan.maxPositionPct}% cap — logged as oversizing.
                </span>
              ) : (
                <span className="muted">Plan allows up to {plan.maxPositionPct}%.</span>
              )}
              {size.shares > 0 ? (
                <span className="muted"> The rules-based size here was {size.shares.toLocaleString()} shares.</span>
              ) : null}
            </p>
          ) : null}

          <div className="grid grid-2" style={{ marginTop: 10 }}>
            <Field label="MAE (worst excursion, in R)"
              hint="How far against you did it go before working? Tells you if your stops are too tight.">
              <NumberInput value={trade.maeR} step={0.1} onValue={(v) => update({ maeR: v })} />
            </Field>
            <Field label="MFE (best excursion, in R)"
              hint="How far did it run at its best? The gap to your realised R is what you left behind.">
              <NumberInput value={trade.mfeR} step={0.1} onValue={(v) => update({ mfeR: v })} />
            </Field>
          </div>
          {trade.mfeR != null && trade.rMultiple != null && trade.mfeR - trade.rMultiple > 1 ? (
            <Callout tone="warn" title={`You left ${rMult(trade.mfeR - trade.rMultiple, 1)} on the table`}>
              Ch.10 — cutting winners short is what starves an account of the outliers that pay for
              all the small losses. Was that exit in your rulebook?
            </Callout>
          ) : null}
        </Card>
      </div>

      <div className="stack">
        <Card>
          <div className="card-head">
            <h2>Exits</h2>
            {trade.status === 'OPEN'
              ? <button className="btn btn-sm btn-primary" onClick={() => setShowExit(true)}>Record exit</button>
              : null}
          </div>
          {trade.exits.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nothing sold yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th className="num">Price</th><th className="num">Shares</th><th>Reason</th><th></th></tr>
                </thead>
                <tbody>
                  {trade.exits.map((e) => {
                    const emotional = e.reason.startsWith('Discretionary')
                    return (
                      <tr key={e.id}>
                        <td className="muted">{e.date.slice(5)}</td>
                        <td className="num">{num(e.price)}</td>
                        <td className="num">{e.shares.toLocaleString()}</td>
                        <td style={{ fontSize: 12.5 }}>
                          {emotional ? <Badge tone="bad">✕ {e.reason}</Badge> : e.reason}
                        </td>
                        <td>
                          <button className="btn btn-sm btn-ghost" aria-label="Remove exit"
                            onClick={() => update({ exits: trade.exits.filter((x) => x.id !== e.id) })}>✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {sold > 0 ? (
            <p style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }} className="muted">
              {sold.toLocaleString()} sold at an average of {num(avgExit)}
              {remaining > 0 ? `, ${remaining.toLocaleString()} still open` : ' — position closed'}.
            </p>
          ) : null}
        </Card>

        <Card>
          <div className="card-head"><h2>Stop history</h2></div>
          {trade.stopChanges.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Stop never moved. For a trade that ran, that usually means you missed a trail; for one
              that did not, it is exactly right.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th className="num">From</th><th className="num">To</th><th>By a rule?</th></tr></thead>
                <tbody>
                  {trade.stopChanges.map((c) => (
                    <tr key={c.id}>
                      <td className="muted">{c.date.slice(5)}</td>
                      <td className="num">{num(c.from)}</td>
                      <td className="num">{num(c.to)}</td>
                      <td>
                        {c.ruleBased
                          ? <Badge tone="good">✓ Rule</Badge>
                          : <Badge tone="bad">✕ Discretion</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="card-head"><h3>Setup measurements</h3></div>
          <div className="grid grid-2">
            <Field label="RS rating"><NumberInput value={trade.rsRating} onValue={(v) => update({ rsRating: v })} /></Field>
            <Field label="ADR %"><NumberInput value={trade.adrPct} step={0.1} onValue={(v) => update({ adrPct: v })} /></Field>
            <Field label="Tight days"><NumberInput value={trade.tightDays} onValue={(v) => update({ tightDays: v })} /></Field>
            <Field label="Pole gain %"><NumberInput value={trade.poleGainPct} step={5} onValue={(v) => update({ poleGainPct: v })} /></Field>
            <Field label="Sector"><TextInput value={trade.sector ?? ''} onChange={(e) => update({ sector: e.target.value })} /></Field>
            <Field label="Conviction (1-5)"><NumberInput value={trade.conviction} min={1} max={5} onValue={(v) => update({ conviction: v })} /></Field>
          </div>
        </Card>
      </div>

      {showExit ? (
        <ExitModalInline trade={trade} update={update} onClose={() => setShowExit(false)} />
      ) : null}
    </div>
  )
}

function ChaseCheck({ trade }: { trade: Trade }) {
  const plannedRisk = Math.abs(trade.plannedEntry - trade.plannedStop)
  if (!plannedRisk || trade.entryPrice == null) return null
  const slip = trade.direction === 'SHORT'
    ? trade.plannedEntry - trade.entryPrice
    : trade.entryPrice - trade.plannedEntry
  const slipR = slip / plannedRisk
  if (slipR <= 0.25) {
    return (
      <p style={{ fontSize: 12.5, margin: '8px 0 0' }} className="good">
        ✓ Filled at or near the pivot. Clean entry.
      </p>
    )
  }
  return (
    <Callout tone="bad" title={`You paid ${slipR.toFixed(2)}R above your own trigger`}>
      Ch.9 — chasing makes the risk/reward worse before the trade has done anything. The plan said{' '}
      {num(trade.plannedEntry)}; you paid {num(trade.entryPrice)}. Flagged as a chased entry.
    </Callout>
  )
}

function ExitModalInline({ trade, update, onClose }: {
  trade: Trade; update: (p: Partial<Trade>) => void; onClose: () => void
}) {
  const remaining = openShares(trade)
  const [price, setPrice] = useState<number | undefined>()
  const [shares, setShares] = useState<number | undefined>(remaining)
  const [reason, setReason] = useState<ExitReason>('Scheduled partial (Day 3-5)')

  function submit() {
    if (!price || !shares) return
    const exits = [...trade.exits, { id: uid(), date: today(), price, shares, reason }]
    const stillOpen = (trade.shares ?? 0) - exits.reduce((s, e) => s + e.shares, 0)
    update({
      exits,
      status: stillOpen <= 0 ? 'CLOSED' : 'OPEN',
      exitDate: stillOpen <= 0 ? today() : trade.exitDate,
    })
    onClose()
  }

  return (
    <Modal title="Record an exit" onClose={onClose}>
      <div className="grid grid-3">
        <Field label="Price"><NumberInput value={price} onValue={setPrice} step={0.01} autoFocus /></Field>
        <Field label="Shares"><NumberInput value={shares} onValue={setShares} max={remaining} /></Field>
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value as ExitReason)}>
            {EXIT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={submit} disabled={!price || !shares}>Record</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}


/**
 * The audit, as one question.
 *
 * Compliance only needs to know whether the plan was followed. The seven-part
 * breakdown is for diagnosing a bad trade, not for taxing a good one — so a
 * clean trade closes in a single tap, and the detail only appears when the
 * answer is no.
 *
 * Answering "no" deliberately does NOT write the audit until a deviation is
 * named: an unnamed rule break would otherwise read as compliant and quietly
 * inflate the number the whole app is built on.
 */
function SimpleAudit({ trade, update, suggested, compliant }: {
  trade: Trade
  update: (p: Partial<Trade>) => void
  suggested: Deviation[]
  compliant: boolean | null
}) {
  const [brokePlan, setBrokePlan] = useState<boolean | null>(
    compliant === null ? null : !compliant,
  )

  const allTrue: ProcessAudit = {
    setupMetCriteria: true, entryPerPlan: true, stopPlacedImmediately: true,
    sizePerPlan: true, exitPerRules: true, withinRiskLimits: true,
    checklistUsedBeforeEntry: true,
  }
  const unanswered: ProcessAudit = {
    setupMetCriteria: null, entryPerPlan: null, stopPlacedImmediately: null,
    sizePerPlan: null, exitPerRules: null, withinRiskLimits: null,
    checklistUsedBeforeEntry: null,
  }

  function answer(broke: boolean) {
    setBrokePlan(broke)
    if (!broke) {
      update({ audit: allTrue, deviations: [] })
    } else {
      // Hold the audit open until at least one deviation is named.
      update({ audit: trade.deviations.length ? allTrue : unanswered })
    }
  }

  function toggleDeviation(d: Deviation) {
    const next = trade.deviations.includes(d)
      ? trade.deviations.filter((x) => x !== d)
      : [...trade.deviations, d]
    update({ deviations: next, audit: next.length ? allTrue : unanswered })
  }

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card>
        <div className="card-head"><h2>One question</h2></div>
        <div className="card-sub">
          Not whether it made money — whether you did what you said you would.
        </div>

        <div className="btn-row" style={{ marginTop: 6 }}>
          <button
            className={`btn ${brokePlan === false ? 'btn-primary' : ''}`}
            style={{ flex: 1, minHeight: 52, fontSize: 15 }}
            aria-pressed={brokePlan === false}
            onClick={() => answer(false)}
          >
            I followed my plan
          </button>
          <button
            className={`btn ${brokePlan === true ? 'btn-danger' : ''}`}
            style={{ flex: 1, minHeight: 52, fontSize: 15 }}
            aria-pressed={brokePlan === true}
            onClick={() => answer(true)}
          >
            I broke it
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          {compliant === true ? (
            <Callout tone="good" title="Counted as a process success">
              Whatever the P&amp;L says, this is the trade you are trying to repeat.
            </Callout>
          ) : compliant === false ? (
            <Callout tone="bad" title="Counted as a rule break">
              Now it can be counted, and the analytics can tell you what this habit costs.
            </Callout>
          ) : brokePlan === true ? (
            <Callout tone="warn" title="Name what went wrong">
              Pick at least one below. Until you do, this trade is not counted either way —
              an unnamed rule break would quietly flatter your compliance rate.
            </Callout>
          ) : (
            <Callout tone="info">Answer and this trade joins your compliance rate.</Callout>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <Field label="One line for your future self" >
            <TextArea value={trade.lesson ?? ''} rows={2}
              placeholder="Wait for the close below the 10DSMA. The intraday poke is not the signal."
              onChange={(e) => update({ lesson: e.target.value })} />
          </Field>
        </div>
      </Card>

      {brokePlan === true ? (
        <Card>
          <div className="card-head"><h2>What happened?</h2></div>
          {suggested.length ? (
            <Callout tone="warn" title="The numbers suggest these">
              <div className="chip-row" style={{ marginTop: 6 }}>
                {suggested.map((d) => (
                  <button key={d} className="chip" onClick={() => toggleDeviation(d)}>+ {d}</button>
                ))}
              </div>
            </Callout>
          ) : null}
          <div className="chip-row" style={{ marginTop: 12 }}>
            {DEVIATIONS.map((d) => (
              <ChipToggle key={d} on={trade.deviations.includes(d)} flag
                onClick={() => toggleDeviation(d)}>
                {d}
              </ChipToggle>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="What set it off?"
              hint="The cue, not the action. A stop-out? A missed move? A slow hour?">
              <TextInput value={trade.deviationNote ?? ''}
                onChange={(e) => update({ deviationNote: e.target.value })} />
            </Field>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="card-head"><h3>Want the full breakdown?</h3></div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            The seven-part audit — entry, stop, size, exit, limits, checklist — lives in full mode,
            switchable from the Rulebook. It is worth a weekend pass over a bad week; it is too
            much for every trade.
          </p>
        </Card>
      )}
    </div>
  )
}

// -------------------------------------------------------------- full audit

function AuditTab({ trade, update, suggested, compliant }: {
  trade: Trade
  update: (p: Partial<Trade>) => void
  suggested: Deviation[]
  compliant: boolean | null
}) {
  const setAudit = (k: keyof ProcessAudit, v: boolean | null) =>
    update({ audit: { ...trade.audit, [k]: v } })

  const toggleDeviation = (d: Deviation) =>
    update({
      deviations: trade.deviations.includes(d)
        ? trade.deviations.filter((x) => x !== d)
        : [...trade.deviations, d],
    })

  const answered = Object.values(trade.audit).filter((v) => v !== null).length

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card>
        <div className="card-head">
          <h2>The audit</h2>
          <span className="muted" style={{ fontSize: 12 }}>{answered} of {AUDIT_QUESTIONS.length} answered</span>
        </div>
        <div className="card-sub">
          Ch.21 — brutal honesty, no self-flagellation. You are collecting data on your own
          behaviour, not passing judgement on yourself. Every "no" is a finding, not a failing.
        </div>
        {AUDIT_QUESTIONS.map((q) => (
          <div key={q.key} style={{ padding: '11px 0', borderBottom: '1px solid var(--grid)' }}>
            <div className="row-between" style={{ gap: 14 }}>
              <div style={{ flex: '1 1 240px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{q.label}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{q.help}</div>
              </div>
              <TriToggle value={trade.audit[q.key]} onChange={(v) => setAudit(q.key, v)} />
            </div>
          </div>
        ))}

        <div style={{ marginTop: 16 }}>
          {compliant === true ? (
            <Callout tone="good" title="Compliant trade">
              You did exactly what you said you would do. Whatever the P&amp;L says, this one goes in
              the win column of the only scoreboard that predicts the future.
            </Callout>
          ) : compliant === false ? (
            <Callout tone="bad" title="Non-compliant trade">
              Tag the deviations so the pattern can be counted. Vague regret changes nothing;
              a countable habit does.
            </Callout>
          ) : (
            <Callout tone="info">Answer all seven and this trade joins your compliance rate.</Callout>
          )}
        </div>
      </Card>

      <div className="stack">
        <Card>
          <div className="card-head"><h2>Deviations</h2></div>
          <div className="card-sub">
            Name the demon. A closed list means the app can tell you which one costs you the most
            money — and that is the one to work on first.
          </div>
          {suggested.length ? (
            <Callout tone="warn" title="The numbers suggest these">
              <div className="chip-row" style={{ marginTop: 6 }}>
                {suggested.map((d) => (
                  <button key={d} className="chip" onClick={() => toggleDeviation(d)}>
                    + {d}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11.5, margin: '8px 0 0' }} className="muted">
                Derived from what you actually logged. Add the ones that are true; ignore the rest.
              </p>
            </Callout>
          ) : null}
          <div className="chip-row" style={{ marginTop: 12 }}>
            {DEVIATIONS.map((d) => (
              <ChipToggle key={d} on={trade.deviations.includes(d)} flag
                onClick={() => toggleDeviation(d)}>
                {d}
              </ChipToggle>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="What triggered the deviation?"
              hint="Ch.12 — the cue, not the action. What happened in the minutes before you broke the rule?">
              <TextArea value={trade.deviationNote ?? ''} rows={3}
                onChange={(e) => update({ deviationNote: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="card-head"><h3>The honest question</h3></div>
          <div className="row-between">
            <span style={{ fontSize: 13.5 }}>Would you take this trade again, exactly this way?</span>
            <TriToggle value={trade.wouldRepeat} onChange={(v) => update({ wouldRepeat: v })} />
          </div>
          {trade.wouldRepeat === false ? (
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
              Then the lesson below is the most valuable thing on this page. Write it as an
              instruction to your future self, not as a complaint.
            </p>
          ) : null}
          <div style={{ marginTop: 12 }}>
            <Field label="The one lesson">
              <TextArea value={trade.lesson ?? ''} rows={3}
                placeholder="Wait for the close below the 10DSMA. The intraday poke is not the signal."
                onChange={(e) => update({ lesson: e.target.value })} />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  )
}

// --------------------------------------------------------------- psychology

function PsychologyTab({ trade, update }: { trade: Trade; update: (p: Partial<Trade>) => void }) {
  const toggle = (field: 'emotionBefore' | 'emotionDuring' | 'emotionAfter', e: Emotion) =>
    update({
      [field]: trade[field].includes(e)
        ? trade[field].filter((x) => x !== e)
        : [...trade[field], e],
    } as Partial<Trade>)

  return (
    <div className="stack">
      <Card>
        <div className="card-head"><h2>Emotional arc</h2></div>
        <div className="card-sub">
          Ch.4 — you cannot manage an impulse you have not learned to recognise. Tag all three
          moments; over enough trades the pattern becomes obvious and therefore fixable.
        </div>
        {([
          ['emotionBefore', 'Right before you entered'],
          ['emotionDuring', 'While you held it — especially in the pullbacks'],
          ['emotionAfter', 'Immediately after you closed it'],
        ] as const).map(([field, label]) => (
          <div key={field} style={{ marginBottom: 16 }}>
            <div className="field-label">{label}</div>
            <div className="chip-row">
              {EMOTIONS.map((e) => (
                <ChipToggle key={e} on={trade[field].includes(e)} onClick={() => toggle(field, e)}>
                  {e}
                </ChipToggle>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <div className="grid grid-2">
        <Card>
          <div className="card-head"><h3>The cue</h3></div>
          <Field label="What happened just before this trade?"
            hint="A win, a stop-out, a missed move, a slow hour, something on social media. This is the trigger half of the habit loop.">
            <TextArea value={trade.precedingContext ?? ''} rows={3}
              onChange={(e) => update({ precedingContext: e.target.value })} />
          </Field>
        </Card>
        <Card>
          <div className="card-head"><h3>Free notes</h3></div>
          <Field label="Anything else worth remembering">
            <TextArea value={trade.notes ?? ''} rows={5}
              onChange={(e) => update({ notes: e.target.value })} />
          </Field>
        </Card>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ charts

function ChartsTab({ trade, update }: { trade: Trade; update: (p: Partial<Trade>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<'BEFORE' | 'DURING' | 'AFTER'>('BEFORE')
  const [error, setError] = useState<string | null>(null)

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { setError('Only image files can be attached.'); continue }
      if (file.size > 4_000_000) {
        setError(`${file.name} is over 4MB. Screenshot the chart area rather than the whole screen.`)
        continue
      }
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result))
        r.onerror = () => rej(r.error)
        r.readAsDataURL(file)
      })
      update({ charts: [...trade.charts, { id: uid(), phase, dataUrl }] })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="stack">
      <Card>
        <div className="card-head"><h2>Chart record</h2></div>
        <div className="card-sub">
          Ch.21 — annotate the setup before entry, and the result after. Screenshots are what turn
          a list of numbers into pattern recognition you can actually use a year from now. Images
          are stored locally in this browser, never uploaded.
        </div>
        <div className="row">
          <div className="seg">
            {(['BEFORE', 'DURING', 'AFTER'] as const).map((p) => (
              <button key={p} className={phase === p ? 'on' : ''} onClick={() => setPhase(p)}>
                {p[0] + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            Attach screenshot
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => void onFiles(e.target.files)} />
        </div>
        {error ? <div style={{ marginTop: 10 }}><Callout tone="warn">{error}</Callout></div> : null}
      </Card>

      {(['BEFORE', 'DURING', 'AFTER'] as const).map((p) => {
        const shots = trade.charts.filter((c) => c.phase === p)
        if (!shots.length) return null
        return (
          <Card key={p}>
            <div className="card-head"><h3>{p[0] + p.slice(1).toLowerCase()} the trade</h3></div>
            <div className="grid grid-2">
              {shots.map((c) => (
                <div key={c.id}>
                  <img src={c.dataUrl} alt={`${trade.ticker} ${p.toLowerCase()}`} className="chart-thumb" />
                  <div className="row" style={{ marginTop: 6 }}>
                    <TextInput value={c.caption ?? ''} placeholder="Annotation"
                      onChange={(e) => update({
                        charts: trade.charts.map((x) => x.id === c.id ? { ...x, caption: e.target.value } : x),
                      })} />
                    <button className="btn btn-sm btn-ghost" aria-label="Remove image"
                      onClick={() => update({ charts: trade.charts.filter((x) => x.id !== c.id) })}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      })}
      {trade.charts.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          No screenshots yet. A year of annotated charts is worth more than a year of P&amp;L.
        </p>
      ) : null}
    </div>
  )
}
