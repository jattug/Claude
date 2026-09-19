/**
 * Open positions (Ch.10, Ch.20).
 *
 * The screen answers one question per position: what does the rulebook tell me
 * to do with this today? Trade management stops being a judgement call.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveTrade, uid, today, getOrCreateLog, saveLog } from '../db'
import { EXIT_REASONS, type Trade, type ExitReason, type Plan } from '../types'
import {
  nextAction, tradeDayNumber, openShares, realisedShares, computePnl, oneR,
} from '../lib/rules'
import { money, num, rMult, signedMoney } from '../lib/format'
import {
  Card, Callout, Badge, Empty, Field, NumberInput, Select, Modal, TextArea, Quote,
} from '../components/ui'

export default function OpenPositions() {
  const plan = useLiveQuery(() => db.plan.get('plan'), [])
  const trades = useLiveQuery(() => db.trades.toArray(), []) ?? []
  const [exitFor, setExitFor] = useState<Trade | null>(null)
  const [stopFor, setStopFor] = useState<Trade | null>(null)

  if (!plan) return <p className="muted">Loading…</p>

  const open = trades.filter((t) => t.status === 'OPEN')
  const planned = trades.filter((t) => t.status === 'PLANNED')

  const totalRisk = open.reduce((s, t) => {
    const remaining = openShares(t)
    const stop = t.currentStop ?? t.initialStop
    if (!remaining || stop == null || t.entryPrice == null) return s
    return s + Math.max(0, Math.abs(t.entryPrice - stop) * remaining)
  }, 0)
  const totalExposure = open.reduce(
    (s, t) => s + openShares(t) * (t.entryPrice ?? 0), 0)

  return (
    <>
      <div className="page-head">
        <h1>Open Positions</h1>
        <p>
          Every position shows the one mechanical action your rulebook prescribes today. If the
          card says hold, hold — fiddling with a working trade is impatience wearing a suit.
        </p>
      </div>

      <div className="grid grid-4">
        <StatBox label="Open positions" value={`${open.length} / ${plan.maxOpenPositions}`}
          tone={open.length > plan.maxOpenPositions ? 'bad' : undefined} />
        <StatBox label="Capital deployed" value={money(totalExposure, plan.currency)}
          note={`${((totalExposure / plan.currentEquity) * 100).toFixed(0)}% of equity`} />
        <StatBox label="Open risk if every stop hits" value={money(totalRisk, plan.currency)}
          note={`${((totalRisk / plan.currentEquity) * 100).toFixed(2)}% of equity`}
          tone={(totalRisk / plan.currentEquity) * 100 > plan.maxRiskPerTradePct * 4 ? 'warn' : 'good'} />
        <StatBox label="Armed, waiting on a trigger" value={String(planned.length)} />
      </div>

      {open.length === 0 ? (
        <div style={{ marginTop: 14 }}>
          <Empty title="No open positions"
            action={<Link to="/gate" className="btn btn-primary">Run a candidate through the gate</Link>}>
            Flat is a position. In choppy or bearish weather it is usually the right one.
          </Empty>
          <Card className="" >
            <Quote source="Qullamaggie">
              Sometimes you have to be in cash for weeks and months on end when the market is not good.
            </Quote>
          </Card>
        </div>
      ) : (
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          {open.map((t) => (
            <PositionCard key={t.id} trade={t} plan={plan}
              onExit={() => setExitFor(t)} onStop={() => setStopFor(t)} />
          ))}
        </div>
      )}

      {planned.length ? (
        <Card style={{ marginTop: 14 }}>
          <div className="card-head"><h2>Armed candidates</h2></div>
          <div className="card-sub">
            Passed the gate, waiting on the trigger. If a name sits here for days without
            triggering, the setup has decayed — re-run it rather than taking a stale plan.
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticker</th><th>Setup</th><th>Grade</th>
                  <th className="num">Trigger</th><th className="num">Stop</th>
                  <th className="num">Shares</th><th></th>
                </tr>
              </thead>
              <tbody>
                {planned.map((t) => (
                  <tr key={t.id}>
                    <td><b>{t.ticker}</b></td>
                    <td style={{ fontSize: 12.5 }}>{t.setupType}</td>
                    <td>
                      <Badge tone={t.grade === 'A+' ? 'good' : t.grade === 'NO-TRADE' ? 'bad' : 'warn'}>
                        {t.grade}
                      </Badge>
                    </td>
                    <td className="num">{num(t.plannedEntry)}</td>
                    <td className="num">{num(t.plannedStop)}</td>
                    <td className="num">{t.plannedShares.toLocaleString()}</td>
                    <td><Link to={`/trades/${t.id}`} className="btn btn-sm">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {exitFor ? (
        <ExitModal trade={exitFor} currency={plan.currency}
          coolingOffMinutes={plan.coolingOffMinutes} onClose={() => setExitFor(null)} />
      ) : null}
      {stopFor ? <StopModal trade={stopFor} onClose={() => setStopFor(null)} /> : null}
    </>
  )
}

function StatBox({ label, value, note, tone }: {
  label: string; value: string; note?: string; tone?: 'good' | 'warn' | 'bad'
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value sm ${tone ?? ''}`}>{value}</div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  )
}

function PositionCard({ trade, plan, onExit, onStop }: {
  trade: Trade
  plan: Plan
  onExit: () => void
  onStop: () => void
}) {
  const action = nextAction(trade, plan)
  const day = tradeDayNumber(trade)
  const remaining = openShares(trade)
  const sold = realisedShares(trade)
  const stop = trade.currentStop ?? trade.initialStop
  const r = oneR(trade)
  const realised = computePnl(trade)

  const tone = action.urgency === 'ACTION' ? 'warn' : action.urgency === 'WATCH' ? 'info' : 'good'

  return (
    <Card>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <div className="row" style={{ gap: 8 }}>
          <Link to={`/trades/${trade.id}`}><h2 style={{ display: 'inline' }}>{trade.ticker}</h2></Link>
          <Badge tone={trade.grade === 'A+' ? 'good' : trade.grade === 'NO-TRADE' ? 'bad' : 'warn'}>
            {trade.grade}
          </Badge>
          <Badge tone="neutral">Day {day}</Badge>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>{trade.setupType}</span>
      </div>

      <Callout tone={tone} title={action.headline} icon={action.urgency === 'ACTION' ? '!' : action.urgency === 'HOLD' ? '✓' : 'i'}>
        {action.detail}
      </Callout>

      <div className="grid grid-4" style={{ marginTop: 12, gap: 10 }}>
        <MiniStat label="Entry" value={num(trade.entryPrice)} />
        <MiniStat label="Stop" value={num(stop)} />
        <MiniStat label="Open shares" value={remaining.toLocaleString()}
          note={sold ? `${sold.toLocaleString()} sold` : undefined} />
        <MiniStat label="1R" value={r ? money(r, plan.currency) : '—'} />
      </div>

      {sold > 0 ? (
        <p style={{ fontSize: 12.5, margin: '10px 0 0', color: 'var(--text-secondary)' }}>
          Booked so far: <b className={realised.pnl && realised.pnl > 0 ? 'good' : 'bad'}>
            {signedMoney(realised.pnl, plan.currency)}
          </b>{' '}({rMult(realised.rMultiple)})
        </p>
      ) : null}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={onExit}>Record an exit</button>
        <button className="btn btn-sm" onClick={onStop}>Adjust stop</button>
        <Link to={`/trades/${trade.id}`} className="btn btn-sm btn-ghost">Full record</Link>
      </div>
    </Card>
  )
}

function MiniStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600 }} className="num">{value}</div>
      {note ? <div className="muted" style={{ fontSize: 11 }}>{note}</div> : null}
    </div>
  )
}

function ExitModal({ trade, currency, coolingOffMinutes, onClose }: {
  trade: Trade; currency: string; coolingOffMinutes: number; onClose: () => void
}) {
  const remaining = openShares(trade)
  const [price, setPrice] = useState<number | undefined>()
  const [shares, setShares] = useState<number | undefined>(remaining)
  const [reason, setReason] = useState<ExitReason>('Scheduled partial (Day 3-5)')
  const [note, setNote] = useState('')

  const discretionary = reason.startsWith('Discretionary')

  async function submit() {
    if (!price || !shares) return
    const exits = [...trade.exits, {
      id: uid(), date: today(), price, shares, reason, note: note || undefined,
    }]
    const stillOpen = (trade.shares ?? 0) - exits.reduce((s, e) => s + e.shares, 0)
    const updated: Trade = {
      ...trade,
      exits,
      status: stillOpen <= 0 ? 'CLOSED' : 'OPEN',
      exitDate: stillOpen <= 0 ? today() : trade.exitDate,
    }
    const { pnl, rMultiple } = computePnl(updated)
    updated.pnl = pnl ?? undefined
    updated.rMultiple = rMultiple ?? undefined
    await saveTrade(updated)

    // Ch.15 — a stop-out starts the mandatory walk-away.
    if (reason === 'Initial stop hit') {
      const log = await getOrCreateLog(today())
      const until = new Date(Date.now() + coolingOffMinutes * 60_000).toISOString()
      await saveLog({ ...log, coolingOffUntil: until })
    }
    onClose()
  }

  return (
    <Modal title={`Record an exit — ${trade.ticker}`} onClose={onClose}>
      <div className="grid grid-3">
        <Field label="Exit price">
          <NumberInput value={price} onValue={setPrice} step={0.01} autoFocus />
        </Field>
        <Field label="Shares" hint={`${remaining.toLocaleString()} open`}>
          <NumberInput value={shares} onValue={setShares} max={remaining} min={1} />
        </Field>
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value as ExitReason)}>
            {EXIT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
      </div>

      {discretionary ? (
        <Callout tone="warn" title="This is a discretionary exit">
          Ch.10 — an exit that did not come from a rule is a rule break, even if it books a profit.
          It will be flagged in your audit. Record it honestly; that is what makes the numbers worth
          anything.
        </Callout>
      ) : null}
      {reason === 'Initial stop hit' ? (
        <Callout tone="info" title={`A ${coolingOffMinutes} minute cooling-off period starts now`}>
          Ch.15 — stand up, leave the desk, and do not look for the next trade. Honouring a stop is
          a process success, not a failure.
        </Callout>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <Field label="Note (optional)">
          <TextArea value={note} rows={2} onChange={(e) => setNote(e.target.value)}
            placeholder="What did the chart actually do?" />
        </Field>
      </div>

      {price && shares && trade.entryPrice ? (
        <p style={{ fontSize: 13 }}>
          This leg:{' '}
          <b className={(trade.direction === 'SHORT' ? -1 : 1) * (price - trade.entryPrice) > 0 ? 'good' : 'bad'}>
            {signedMoney((trade.direction === 'SHORT' ? -1 : 1) * (price - trade.entryPrice) * shares, currency)}
          </b>
        </p>
      ) : null}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn btn-primary" onClick={submit} disabled={!price || !shares}>
          Record exit
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}

function StopModal({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const current = trade.currentStop ?? trade.initialStop ?? 0
  const [to, setTo] = useState<number | undefined>(current)
  const [ruleBased, setRuleBased] = useState(true)
  const [reason, setReason] = useState('')

  const movingAway = to != null && (trade.direction === 'SHORT' ? to > current : to < current)

  async function submit() {
    if (to == null) return
    await saveTrade({
      ...trade,
      currentStop: to,
      stopChanges: [...trade.stopChanges, {
        id: uid(), date: today(), from: current, to, ruleBased, reason,
      }],
    })
    onClose()
  }

  return (
    <Modal title={`Adjust stop — ${trade.ticker}`} onClose={onClose}>
      <div className="grid grid-2">
        <Field label="Current stop"><NumberInput value={current} onValue={() => {}} disabled /></Field>
        <Field label="New stop"><NumberInput value={to} onValue={setTo} step={0.01} autoFocus /></Field>
      </div>

      {movingAway ? (
        <Callout tone="bad" title="You are moving the stop away from price">
          Ch.15 — there is no rule in your plan that widens a stop. This is loss aversion asking for
          more room. It will be logged as a deviation.
        </Callout>
      ) : null}

      <div className="field">
        <span className="field-label">Did a rule tell you to do this?</span>
        <div className="seg">
          <button className={ruleBased ? 'on' : ''} onClick={() => setRuleBased(true)}>
            Yes — it is in my plan
          </button>
          <button className={!ruleBased ? 'on' : ''} onClick={() => setRuleBased(false)}>
            No — I decided in the moment
          </button>
        </div>
      </div>

      <Field label="Which rule, or what were you feeling?">
        <TextArea value={reason} rows={2} onChange={(e) => setReason(e.target.value)}
          placeholder="Partial booked and the 10DSMA cleared my entry, so the rest goes to breakeven." />
      </Field>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={submit} disabled={to == null}>Save</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}
