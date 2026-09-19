/**
 * The Rulebook (Ch.3 — the written plan IS the system).
 *
 * Everything the engine enforces comes from this page. Changes are logged with
 * a date and a reason, because an undocumented rule change is just drift.
 */
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db, savePlan, uid, today, exportAll, importAll, wipeAll, defaultPlan, type Backup,
} from '../db'
import type { Plan } from '../types'
import { money } from '../lib/format'
import { loadDemoData } from '../lib/demo'
import {
  Card, Field, NumberInput, TextInput, Select, Callout,
  Badge, Modal, Tabs, Quote,
} from '../components/ui'

type Tab = 'risk' | 'selection' | 'exits' | 'friction' | 'scaling' | 'data'

export default function Rulebook() {
  const stored = useLiveQuery(() => db.plan.get('plan'), [])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [tab, setTab] = useState<Tab>('risk')

  useEffect(() => { if (stored) setPlan(stored) }, [stored])
  if (!plan) return <p className="muted">Loading…</p>

  const update = (patch: Partial<Plan>) => {
    const next = { ...plan, ...patch }
    setPlan(next)
    void savePlan(next)
  }

  return (
    <>
      <div className="page-head">
        <h1>Rulebook</h1>
        <p>
          This is your trading business's operating manual, and the app enforces every number on
          it. Set these once, calmly, away from the market — then let them overrule you when you
          are not calm.
        </p>
      </div>

      <div className="grid grid-3">
        <Field label="Trader">
          <TextInput value={plan.traderName} placeholder="Your name"
            onChange={(e) => update({ traderName: e.target.value })} />
        </Field>
        <Field label="Current equity">
          <NumberInput value={plan.currentEquity} step={100}
            onValue={(v) => update({ currentEquity: v ?? 0 })} />
        </Field>
        <Field label="Currency">
          <Select value={plan.currency} onChange={(e) => update({ currency: e.target.value })}>
            <option value="USD">USD</option><option value="EUR">EUR</option>
            <option value="GBP">GBP</option><option value="CAD">CAD</option>
            <option value="AUD">AUD</option><option value="INR">INR</option>
          </Select>
        </Field>
      </div>

      <Tabs<Tab>
        active={tab} onChange={setTab}
        tabs={[
          { id: 'risk', label: 'Risk & sizing' },
          { id: 'selection', label: 'Stock selection' },
          { id: 'exits', label: 'Exits' },
          { id: 'friction', label: 'Friction' },
          { id: 'scaling', label: 'Scaling ladder' },
          { id: 'data', label: 'Data & backup' },
        ]}
      />

      {tab === 'risk' ? <RiskTab plan={plan} update={update} /> : null}
      {tab === 'selection' ? <SelectionTab plan={plan} update={update} /> : null}
      {tab === 'exits' ? <ExitsTab plan={plan} update={update} /> : null}
      {tab === 'friction' ? <FrictionTab plan={plan} update={update} /> : null}
      {tab === 'scaling' ? <ScalingTab plan={plan} update={update} /> : null}
      {tab === 'data' ? <DataTab plan={plan} /> : null}

      <ChangeLog plan={plan} update={update} />
    </>
  )
}

type TabProps = { plan: Plan; update: (p: Partial<Plan>) => void }

function RiskTab({ plan, update }: TabProps) {
  const riskDollars = plan.currentEquity * (plan.maxRiskPerTradePct / 100)
  const positionDollars = plan.currentEquity * (plan.standardPositionPct / 100)
  const dailyLoss = plan.currentEquity * (plan.maxDailyLossPct / 100)
  const tenLossDrawdown = plan.maxRiskPerTradePct * 10

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card>
        <div className="card-head"><h2>Risk per trade</h2></div>
        <div className="card-sub">
          Ch.11 — experienced swing traders risk far less than beginners assume: 0.2% to 0.5% is
          normal, and 2% was described as "huge". Start conservative; you can always earn your way up.
        </div>
        <div className="grid grid-2">
          <Field label="Maximum risk per trade (%)"
            hint="The hard ceiling. The gate refuses any size that breaches it.">
            <NumberInput value={plan.maxRiskPerTradePct} step={0.05} min={0.05} max={3}
              onValue={(v) => update({ maxRiskPerTradePct: v ?? 0.5 })} />
          </Field>
          <Field label="Target risk per trade (%)"
            hint="What a genuinely tight setup should cost you.">
            <NumberInput value={plan.targetRiskPerTradePct} step={0.05} min={0.05} max={3}
              onValue={(v) => update({ targetRiskPerTradePct: v ?? 0.35 })} />
          </Field>
        </div>
        <Callout tone={tenLossDrawdown > 10 ? 'bad' : 'info'}
          title={`Ten losses in a row would cost you ${tenLossDrawdown.toFixed(1)}% of your account`}>
          That is {money(riskDollars * 10, plan.currency)} — and a losing streak of six or seven is
          routine in this style. {tenLossDrawdown > 10
            ? 'This is more than you should be willing to give back to a normal streak. Cut the risk.'
            : 'Survivable, which is the entire point.'}
        </Callout>
      </Card>

      <Card>
        <div className="card-head"><h2>Position size</h2></div>
        <div className="card-sub">
          Ch.14 — pick one size and hold it, regardless of how good a setup feels. Your confidence
          belongs to the system over many trades, not to any single chart.
        </div>
        <div className="grid grid-2">
          <Field label="Standard position (% of equity)"
            hint={`${money(positionDollars, plan.currency)} at current equity.`}>
            <NumberInput value={plan.standardPositionPct} step={1} min={1} max={50}
              onValue={(v) => update({ standardPositionPct: v ?? 10 })} />
          </Field>
          <Field label="Maximum position (% of equity)">
            <NumberInput value={plan.maxPositionPct} step={1} min={1} max={50}
              onValue={(v) => update({ maxPositionPct: v ?? 20 })} />
          </Field>
          <Field label="Max daily loss (%)"
            hint={`Circuit breaker at ${money(dailyLoss, plan.currency)}. The app blocks new trades past it.`}>
            <NumberInput value={plan.maxDailyLossPct} step={0.25} min={0.25} max={10}
              onValue={(v) => update({ maxDailyLossPct: v ?? 2 })} />
          </Field>
          <Field label="Max open positions">
            <NumberInput value={plan.maxOpenPositions} min={1} max={30}
              onValue={(v) => update({ maxOpenPositions: v ?? 10 })} />
          </Field>
          <Field label="Max single sector exposure (%)">
            <NumberInput value={plan.maxSectorExposurePct} step={5} min={5} max={100}
              onValue={(v) => update({ maxSectorExposurePct: v ?? 30 })} />
          </Field>
        </div>
        <Quote source="peoplewish">
          If you only trade tight charts, you don't need to calculate risk. The LOD stop will on
          average be under 0.5% of your account — if you size correctly.
        </Quote>
      </Card>
    </div>
  )
}

function SelectionTab({ plan, update }: TabProps) {
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card>
        <div className="card-head"><h2>Leader criteria</h2></div>
        <div className="card-sub">
          Ch.7 — a perfect pattern on a laggard is not a setup. The gate checks these
          automatically and fails the Leader criterion if any is missed.
        </div>
        <div className="grid grid-2">
          <Field label="Minimum RS rating"><NumberInput value={plan.minRsRating} min={0} max={99}
            onValue={(v) => update({ minRsRating: v ?? 90 })} /></Field>
          <Field label="Minimum ADR (%)" hint="High ADR is where the range to profit from lives.">
            <NumberInput value={plan.minAdrPct} step={0.5} min={0} max={30}
              onValue={(v) => update({ minAdrPct: v ?? 4 })} /></Field>
          <Field label="Minimum average $ volume"
            hint="Liquidity you can actually get in and out of at your size.">
            <NumberInput value={plan.minDollarVolume} step={5_000_000} min={0}
              onValue={(v) => update({ minDollarVolume: v ?? 50_000_000 })} /></Field>
        </div>
      </Card>

      <Card>
        <div className="card-head"><h2>The tightness rule</h2></div>
        <div className="card-sub">
          Ch.8 — this is the criterion that makes everything else work. Tight charts are what let
          you take a large position for a small risk, which is the whole mechanism.
        </div>
        <div className="grid grid-2">
          <Field label="Tight-day range as a fraction of ADR"
            hint="0.667 means a day counts as tight when its range is two thirds of the ADR or less.">
            <NumberInput value={plan.tightnessAdrFraction} step={0.033} min={0.1} max={1}
              onValue={(v) => update({ tightnessAdrFraction: v ?? 0.667 })} /></Field>
          <Field label="Consecutive tight days required">
            <NumberInput value={plan.minTightDays} min={1} max={10}
              onValue={(v) => update({ minTightDays: v ?? 2 })} /></Field>
        </div>
        <Callout tone="info" title="Worked example">
          On a stock with a 6% ADR, a tight day is one whose high-to-low range is under{' '}
          <b>{(6 * plan.tightnessAdrFraction).toFixed(2)}%</b>. You need{' '}
          <b>{plan.minTightDays}</b> of those in a row, right at the moving average, before the gate
          calls it an A+ setup.
        </Callout>
      </Card>
    </div>
  )
}

function ExitsTab({ plan, update }: TabProps) {
  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <Card>
        <div className="card-head"><h2>Cutting losses</h2></div>
        <div className="card-sub">
          Ch.10 — the initial stop is the low of the entry day, placed immediately, honoured
          without negotiation. There is no other exit between day one and the partial.
        </div>
        <label className="check-row">
          <input type="checkbox" checked={plan.cutDay1RedClose}
            onChange={(e) => update({ cutDay1RedClose: e.target.checked })} />
          <span className="check-text">
            <span className="check-label">Cut any position that closes red on day one</span>
            <span className="check-hint">
              Even if the stop was never touched. Cuts failures faster at the cost of some shakeouts.
            </span>
          </span>
        </label>
      </Card>

      <Card>
        <div className="card-head"><h2>Managing winners</h2></div>
        <div className="card-sub">
          Ch.10 — take a mechanical partial, then trail. Deciding this in advance is what stops
          fear and greed from deciding it for you in the moment.
        </div>
        <div className="grid grid-2">
          <Field label="Partial sell on day"
            hint="Entry day counts as day one. Pick one and stop renegotiating it.">
            <Select value={String(plan.partialSellDay)}
              onChange={(e) => update({ partialSellDay: Number(e.target.value) })}>
              <option value="3">Day 3</option><option value="4">Day 4</option><option value="5">Day 5</option>
            </Select>
          </Field>
          <Field label="Partial size (%)"
            hint="50% is the amount that leaves you neither feeling you missed out nor that you should have sold more.">
            <NumberInput value={plan.partialSellPct} step={5} min={10} max={90}
              onValue={(v) => update({ partialSellPct: v ?? 50 })} />
          </Field>
          <Field label="Trailing moving average">
            <Select value={plan.trailingMa} onChange={(e) => update({ trailingMa: e.target.value })}>
              <option value="10DSMA">10-day SMA</option>
              <option value="20DSMA">20-day SMA</option>
              <option value="50DSMA">50-day SMA</option>
            </Select>
          </Field>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={plan.breakevenAfterMaClearsEntry}
            onChange={(e) => update({ breakevenAfterMaClearsEntry: e.target.checked })} />
          <span className="check-text">
            <span className="check-label">Move to breakeven only once the {plan.trailingMa} clears my entry</span>
            <span className="check-hint">
              Trailing any earlier just stops you out on ordinary noise before the trend establishes.
            </span>
          </span>
        </label>
        <Callout tone="info" title="Your exit sequence">
          Day 1: stop at the low of day{plan.cutDay1RedClose ? ', cut on a red close' : ''}. Day{' '}
          {plan.partialSellDay}: sell {plan.partialSellPct}%. Then breakeven once the{' '}
          {plan.trailingMa} passes your entry, and finally sell the rest on the first daily{' '}
          <b>close</b> below the {plan.trailingMa}. An intraday poke is not a signal.
        </Callout>
      </Card>
    </div>
  )
}

function FrictionTab({ plan, update }: TabProps) {
  return (
    <Card>
      <div className="card-head"><h2>Friction and circuit breakers</h2></div>
      <div className="card-sub">
        Ch.17 — impulsive actions thrive on ease and speed. These settings make the bad path
        harder, which is more reliable than willpower.
      </div>
      <div className="grid grid-3">
        <Field label="Max trades per day"
          hint="A hard cap on activity. Overtrading is almost always boredom in disguise.">
          <NumberInput value={plan.maxTradesPerDay} min={1} max={20}
            onValue={(v) => update({ maxTradesPerDay: v ?? 3 })} />
        </Field>
        <Field label="Cooling-off after a stop-out (minutes)"
          hint="The app blocks new trades for this long. Stand up and leave the desk.">
          <NumberInput value={plan.coolingOffMinutes} min={0} max={240} step={5}
            onValue={(v) => update({ coolingOffMinutes: v ?? 15 })} />
        </Field>
        <Field label="No new trades in the last N minutes"
          hint="Avoids rushed, fatigue-driven decisions into the close.">
          <NumberInput value={plan.noNewTradesLastMinutes} min={0} max={120} step={5}
            onValue={(v) => update({ noNewTradesLastMinutes: v ?? 30 })} />
        </Field>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={plan.requireChecklistBeforeEntry}
          onChange={(e) => update({ requireChecklistBeforeEntry: e.target.checked })} />
        <span className="check-text">
          <span className="check-label">Require a completed checklist before a trade can be armed</span>
          <span className="check-hint">
            Your single best defence against impatience. Turning this off defeats the purpose of the app.
          </span>
        </span>
      </label>
      {!plan.requireChecklistBeforeEntry ? (
        <Callout tone="warn" title="Checklist enforcement is off">
          Ch.13 — the mandatory checklist is described as the number one defence against trading
          non-setups. Consider turning it back on.
        </Callout>
      ) : null}
    </Card>
  )
}

function ScalingTab({ plan, update }: TabProps) {
  const tiers = [...plan.scalingTiers].sort((a, b) => a.equityMilestone - b.equityMilestone)

  const patch = (id: string, p: Partial<(typeof tiers)[number]>) =>
    update({ scalingTiers: plan.scalingTiers.map((t) => (t.id === id ? { ...t, ...p } : t)) })

  return (
    <Card>
      <div className="card-head"><h2>The scaling ladder</h2></div>
      <div className="card-sub">
        Ch.23 — size increases are earned, in planned increments, from a position of strength.
        Both the equity milestone and the compliance bar must be met; the dashboard tells you when.
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tier</th><th className="num">Equity milestone</th>
              <th className="num">Min compliance %</th><th className="num">Position size %</th><th></th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.id}>
                <td>
                  <TextInput value={t.label} onChange={(e) => patch(t.id, { label: e.target.value })} />
                </td>
                <td className="num">
                  <NumberInput value={t.equityMilestone} step={1000}
                    onValue={(v) => patch(t.id, { equityMilestone: v ?? 0 })} />
                </td>
                <td className="num">
                  <NumberInput value={t.minCompliance} min={0} max={100}
                    onValue={(v) => patch(t.id, { minCompliance: v ?? 0 })} />
                </td>
                <td className="num">
                  <NumberInput value={t.positionSizePct} min={1} max={50}
                    onValue={(v) => patch(t.id, { positionSizePct: v ?? 10 })} />
                </td>
                <td>
                  {plan.currentEquity >= t.equityMilestone
                    ? <Badge tone="good">✓ Equity met</Badge>
                    : <Badge tone="neutral">Locked</Badge>}
                  <button className="btn btn-sm btn-ghost" aria-label="Remove tier"
                    onClick={() => update({ scalingTiers: plan.scalingTiers.filter((x) => x.id !== t.id) })}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-sm" style={{ marginTop: 12 }}
        onClick={() => update({
          scalingTiers: [...plan.scalingTiers, {
            id: uid(), label: `Tier ${plan.scalingTiers.length}`,
            equityMilestone: plan.currentEquity * 1.25, minCompliance: 95,
            positionSizePct: Math.min(plan.maxPositionPct, plan.standardPositionPct + 3),
          }],
        })}>
        Add a tier
      </button>
      <Callout tone="warn" title="Scaling back down is also a rule">
        If a size increase brings a drawdown, or you simply notice your discipline slipping under
        the bigger numbers, drop back to the previous tier immediately. Plan that retreat now,
        while it costs nothing to admit.
      </Callout>
    </Card>
  )
}

function DataTab({ plan }: { plan: Plan }) {
  const [status, setStatus] = useState<string | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const trades = useLiveQuery(() => db.trades.toArray(), []) ?? []
  const logs = useLiveQuery(() => db.logs.toArray(), []) ?? []

  async function doExport() {
    const backup = await exportAll()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `forge-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setStatus('Backup downloaded.')
  }

  function exportCsv() {
    const header = [
      'ticker', 'direction', 'setup', 'grade', 'entryDate', 'exitDate', 'entryPrice',
      'shares', 'initialStop', 'pnl', 'rMultiple', 'weather', 'compliant',
      'deviations', 'emotionBefore', 'lesson',
    ]
    const rows = trades.filter((t) => t.status === 'CLOSED').map((t) => [
      t.ticker, t.direction, t.setupType, t.grade, t.entryDate ?? '', t.exitDate ?? '',
      t.entryPrice ?? '', t.shares ?? '', t.initialStop ?? '', t.pnl ?? '', t.rMultiple ?? '',
      t.weatherAtEntry ?? '',
      Object.values(t.audit).some((v) => v === null) ? '' : String(Object.values(t.audit).every(Boolean) && !t.deviations.length),
      t.deviations.join('; '), t.emotionBefore.join('; '), (t.lesson ?? '').replace(/"/g, '""'),
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c)}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `forge-trades-${today()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    setStatus('CSV downloaded.')
  }

  async function doImport(file: File, mode: 'replace' | 'merge') {
    try {
      const text = await file.text()
      await importAll(JSON.parse(text) as Backup, mode)
      setStatus(`Imported (${mode}). Reload if anything looks stale.`)
    } catch (e) {
      setStatus(`Import failed: ${(e as Error).message}`)
    }
  }

  return (
    <>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <div className="card-head"><h2>Your data</h2></div>
          <div className="card-sub">
            Everything lives in this browser's local storage. No account, no server, nothing
            leaves your machine — which also means nobody else is backing it up for you.
          </div>
          <p style={{ fontSize: 13 }}>
            <b>{trades.length}</b> trades · <b>{logs.length}</b> daily logs
          </p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={doExport}>Download JSON backup</button>
            <button className="btn" onClick={exportCsv}>Export trades as CSV</button>
          </div>
          <Callout tone="warn" title="Back up weekly">
            Clearing your browser's site data deletes this journal. Make the export part of your
            weekly audit routine.
          </Callout>
        </Card>

        <Card>
          <div className="card-head"><h2>Restore</h2></div>
          <div className="field">
            <span className="field-label">Import a Forge backup</span>
            <input type="file" accept="application/json" onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void doImport(f, 'merge')
              e.target.value = ''
            }} />
            <div className="field-hint">Merges into what is already here, keeping both sets.</div>
          </div>
          {status ? <Callout tone="info">{status}</Callout> : null}

          <hr className="divider" />
          <div className="card-head"><h3>Try it with sample data</h3></div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Loads a realistic month of trades — a mix of clean execution and exactly the rule
            breaks the book warns about — so you can see what every screen looks like with data
            in it. Merges alongside your own records.
          </p>
          <button className="btn" onClick={async () => {
            await loadDemoData()
            setStatus('Sample month loaded. Have a look at the Dashboard and Analytics.')
          }}>Load a sample month</button>

          <hr className="divider" />
          <div className="card-head"><h3>Danger zone</h3></div>
          <button className="btn btn-danger" onClick={() => setConfirmWipe(true)}>
            Erase everything
          </button>
        </Card>
      </div>

      {confirmWipe ? (
        <Modal title="Erase everything?" onClose={() => setConfirmWipe(false)}>
          <Callout tone="bad" title="This cannot be undone">
            Every trade, log, audit and rule setting is deleted permanently. Download a backup
            first unless you are certain.
          </Callout>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn btn-danger" onClick={async () => {
              await wipeAll()
              await savePlan({ ...defaultPlan(), currency: plan.currency })
              setConfirmWipe(false)
              setStatus('All data erased.')
            }}>Yes, erase it all</button>
            <button className="btn btn-ghost" onClick={() => setConfirmWipe(false)}>Cancel</button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}

function ChangeLog({ plan, update }: TabProps) {
  const [change, setChange] = useState('')
  const [rationale, setRationale] = useState('')

  function add() {
    if (!change.trim() || !rationale.trim()) return
    update({
      changeLog: [
        { id: uid(), date: today(), change: change.trim(), rationale: rationale.trim() },
        ...plan.changeLog,
      ],
    })
    setChange(''); setRationale('')
  }

  return (
    <Card>
      <div className="card-head"><h2>Rule change log</h2></div>
      <div className="card-sub">
        Ch.22 — every change to the plan gets a date and a reason. Without this you cannot tell
        deliberate refinement from slow drift, and drift is how systems quietly die.
      </div>
      <div className="grid grid-2">
        <Field label="What changed">
          <TextInput value={change} placeholder="Cut max risk per trade from 0.75% to 0.5%"
            onChange={(e) => setChange(e.target.value)} />
        </Field>
        <Field label="Why — based on what evidence">
          <TextInput value={rationale} placeholder="Six weeks of data: trades over 0.5% risk averaged -0.4R"
            onChange={(e) => setRationale(e.target.value)} />
        </Field>
      </div>
      <button className="btn btn-sm" onClick={add} disabled={!change.trim() || !rationale.trim()}>
        Log the change
      </button>

      {plan.changeLog.length ? (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead><tr><th>Date</th><th>Change</th><th>Rationale</th><th></th></tr></thead>
            <tbody>
              {plan.changeLog.map((c) => (
                <tr key={c.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{c.date}</td>
                  <td>{c.change}</td>
                  <td className="secondary">{c.rationale}</td>
                  <td>
                    <button className="btn btn-sm btn-ghost" aria-label="Remove entry"
                      onClick={() => update({ changeLog: plan.changeLog.filter((x) => x.id !== c.id) })}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
          No changes logged yet.
        </p>
      )}
    </Card>
  )
}
