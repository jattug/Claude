/**
 * The dashboard.
 *
 * Ch.2 — the first number you see is compliance, not P&L. That ordering is the
 * whole thesis of the book, so it is the whole layout of this page.
 */
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, today } from '../db'
import {
  coreStats, disciplineCost, equityCurve, complianceOverTime,
  behaviourStats, quadrantCounts, patienceStats, scalingReadiness, maxDrawdown,
} from '../lib/metrics'
import {
  evaluateBreakers, nextAction, tradeDayNumber, QUADRANT_META, WEATHER_PLAYBOOK,
} from '../lib/rules'
import { money, signedMoney, pct, rMult, toneFor } from '../lib/format'
import { Card, Stat, Callout, Badge, Meter, Empty, Quote } from '../components/ui'
import { ChartCard, EquityChart, ComplianceChart } from '../components/charts'
import { QUADRANT_ORDER } from './shared'

export default function Dashboard() {
  const plan = useLiveQuery(() => db.plan.get('plan'), [])
  const trades = useLiveQuery(() => db.trades.toArray(), []) ?? []
  const logs = useLiveQuery(() => db.logs.toArray(), []) ?? []
  const log = logs.find((l) => l.date === today())

  if (!plan) return <p className="muted">Loading…</p>

  const openTrades = trades.filter((t) => t.status === 'OPEN')
  const plannedTrades = trades.filter((t) => t.status === 'PLANNED')
  const todaysTrades = trades.filter((t) => t.entryDate === today())
  const stats = coreStats(trades)
  const cost = disciplineCost(trades)
  const curve = equityCurve(trades, plan.startingEquity)
  const compliance = complianceOverTime(trades)
  const behaviour = behaviourStats(trades)
  const quads = quadrantCounts(trades)
  const patience = patienceStats(trades, logs)
  const scaling = scalingReadiness(plan, trades)
  const breakers = evaluateBreakers({ plan, log, todaysTrades, openTrades })
  const blocking = breakers.filter((b) => b.tripped && b.severity === 'block')
  const warnings = breakers.filter((b) => b.tripped && b.severity === 'warn')
  const dd = maxDrawdown(curve)

  const complianceTone = toneFor(stats.complianceRate, 90, 75)
  const actionsDue = openTrades
    .map((t) => ({ trade: t, action: nextAction(t, plan) }))
    .filter((x) => x.action.urgency === 'ACTION')

  const hasData = trades.length > 0

  if (!hasData) {
    return (
      <>
        <div className="page-head">
          <h1>Welcome to Forge</h1>
          <p>
            A journal built on one idea: you already know the setups. What is missing is the
            evidence of whether you actually followed them. Forge scores your discipline first and
            treats P&amp;L as the byproduct it is.
          </p>
        </div>
        <div className="grid grid-2">
          <Card>
            <div className="card-head"><h2>Start here</h2></div>
            <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 1.9, fontSize: 13.5 }}>
              <li><Link to="/rulebook">Set your rulebook</Link> — equity, risk ceiling, position size, exit rules.</li>
              <li><Link to="/daily">Open today's log</Link> — assess the weather before you look at a single chart.</li>
              <li><Link to="/gate">Run a candidate through the gate</Link> — it will tell you yes or no.</li>
              <li>Journal every trade at the close, including the ones you passed on.</li>
              <li><Link to="/weekly">Audit weekly</Link> — that is where the system actually improves.</li>
            </ol>
          </Card>
          <Card>
            <div className="card-head"><h2>Why this is not a P&amp;L tracker</h2></div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              A profitable trade taken against your rules is recorded here as a <b>mistake</b>. A
              losing trade taken perfectly is recorded as a <b>success</b>. Everything else in the
              app follows from that inversion.
            </p>
            <Quote source="peoplewish">
              PnL is secondary and used only to evaluate efficiency.
            </Quote>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <p>Process first. The P&amp;L is downstream of the number on the left.</p>
      </div>

      {blocking.map((b) => (
        <Callout key={b.id} tone="bad" title={b.label} icon="✕">{b.detail}</Callout>
      ))}
      {warnings.map((b) => (
        <Callout key={b.id} tone="warn" title={b.label} icon="!">{b.detail}</Callout>
      ))}
      {actionsDue.length ? (
        <Callout tone="info" title={`${actionsDue.length} position${actionsDue.length > 1 ? 's need' : ' needs'} a rule-based action today`}>
          {actionsDue.map((a) => (
            <div key={a.trade.id}>
              <b>{a.trade.ticker}</b> — {a.action.headline}
            </div>
          ))}
          <Link to="/positions" className="btn btn-sm" style={{ marginTop: 8 }}>Manage positions</Link>
        </Callout>
      ) : null}

      {/* Hero: compliance, then everything else. */}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(260px, 1fr) 2fr', marginTop: 14 }}>
        <Card>
          <div className="stat-label">Process compliance rate</div>
          <div className={`hero-figure ${complianceTone}`} style={{ margin: '8px 0 10px' }}>
            {stats.complianceRate == null ? '—' : `${Math.round(stats.complianceRate)}%`}
          </div>
          <Meter value={stats.complianceRate ?? 0} tone={complianceTone === 'muted' ? undefined : complianceTone} />
          <div className="stat-note" style={{ marginTop: 10 }}>
            {stats.compliant} of {stats.audited} audited trades followed every rule.
            {stats.trades > stats.audited
              ? ` ${stats.trades - stats.audited} still need auditing.` : ''}
          </div>
          <hr className="divider" />
          <div className="row-between">
            <span className="secondary" style={{ fontSize: 12.5 }}>Compliant streak</span>
            <b className="num">{behaviour.currentCompliantStreak}</b>
          </div>
          <div className="row-between" style={{ marginTop: 5 }}>
            <span className="secondary" style={{ fontSize: 12.5 }}>Best ever</span>
            <b className="num">{behaviour.bestCompliantStreak}</b>
          </div>
          <div className="row-between" style={{ marginTop: 5 }}>
            <span className="secondary" style={{ fontSize: 12.5 }}>
              Missed twice
              <span className="muted"> · back-to-back breaks</span>
            </span>
            <b className={`num ${behaviour.missedTwiceCount > 0 ? 'bad' : 'good'}`}>
              {behaviour.missedTwiceCount}
            </b>
          </div>
        </Card>

        <div className="stack">
          <div className="grid grid-3">
            <Stat label="Expectancy" value={rMult(stats.expectancyR)} size="sm"
              tone={stats.expectancyR != null && stats.expectancyR > 0 ? 'good' : 'bad'}
              note={`over ${stats.trades} closed trades`} />
            <Stat label="Total R" value={rMult(stats.totalR, 1)} size="sm"
              tone={stats.totalR > 0 ? 'good' : 'bad'}
              note={`${stats.wins}W / ${stats.losses}L · ${pct(stats.winRate, 0)} win rate`} />
            <Stat label="Net P&L" value={signedMoney(stats.totalPnl, plan.currency)} size="sm"
              tone={stats.totalPnl > 0 ? 'good' : 'bad'}
              note={`equity ${money(plan.currentEquity, plan.currency)}`} />
            <Stat label="Avg win / avg loss" size="sm"
              value={`${rMult(stats.avgWinR, 1)} / ${rMult(stats.avgLossR, 1)}`}
              note={stats.profitFactor ? `profit factor ${stats.profitFactor.toFixed(2)}` : undefined} />
            <Stat label="Max drawdown" value={pct(dd, 1)} size="sm"
              tone={dd > 15 ? 'bad' : dd > 8 ? 'warn' : 'good'}
              note={`worst losing streak: ${stats.maxConsecutiveLosses}`} />
            <Stat label="Stop honour rate" value={pct(behaviour.stopHonourRate, 0)} size="sm"
              tone={toneFor(behaviour.stopHonourRate, 95, 85) === 'muted' ? undefined : toneFor(behaviour.stopHonourRate, 95, 85)}
              note={behaviour.stopsMovedCount > 0
                ? `${behaviour.stopsMovedCount} trade${behaviour.stopsMovedCount > 1 ? 's' : ''} with a stop moved off-plan`
                : 'no off-plan stop moves'} />
          </div>

          {cost.violatingCount > 0 ? (
            <Callout tone={cost.cost > 0 ? 'bad' : 'warn'}
              title={cost.cost > 0
                ? `Breaking your rules has cost you ${money(cost.cost, plan.currency)}`
                : `Your rule breaks are net positive — and that is the dangerous case`}>
              {cost.violatingCount} non-compliant trade{cost.violatingCount > 1 ? 's' : ''} averaging{' '}
              <b>{rMult(cost.avgViolatingR)}</b>, against <b>{rMult(cost.avgCompliantR)}</b> on the{' '}
              {cost.compliantCount} you took by the book.{' '}
              {cost.cost <= 0
                ? 'Luck is paying you for bad behaviour right now. It will stop, and the habit will remain.'
                : 'That gap is the price of the habit, in your own currency.'}
            </Callout>
          ) : null}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <ChartCard
          title="Equity: what happened vs what the rules would have made"
          sub="The gap between the two lines is the cost of every trade you took against your own plan. Nothing in this app is more important than closing it."
        >
          <EquityChart data={curve} currency={plan.currency} />
        </ChartCard>

        <ChartCard
          title="Process compliance, rolling 10 trades"
          sub="The one metric to grow. Ch.23 — size increases are earned by holding this above 90%, not by a good week of P&L."
        >
          <ComplianceChart data={compliance} />
        </ChartCard>
      </div>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <Card>
          <div className="card-head">
            <h2>The four outcomes</h2>
            <span className="muted" style={{ fontSize: 12 }}>Ch.2 — the reframe</span>
          </div>
          <div className="card-sub">
            A win taken by breaking the rules is not a win. It is a lucky win, and it teaches you
            the wrong lesson at full volume.
          </div>
          <div className="quad-grid">
            {QUADRANT_ORDER.map((q) => {
              const meta = QUADRANT_META[q]
              const list = quads[q]
              const icon = meta.tone === 'good' ? '✓' : meta.tone === 'warning' ? '!' : '✕'
              return (
                <div key={q} className={`quad-cell quad-${meta.tone}`}>
                  <div className="quad-count num">{list.length}</div>
                  <div className="quad-label">
                    <span aria-hidden="true">{icon}</span> {meta.label}
                  </div>
                  <div className="quad-blurb">{meta.blurb}</div>
                </div>
              )
            })}
          </div>
        </Card>

        <div className="stack">
          <Card>
            <div className="card-head"><h2>Patience</h2></div>
            <div className="card-sub">Ch.5 — a day you scanned, found nothing and did nothing is a success, not a wasted day.</div>
            <div className="grid grid-2">
              <Stat label="Disciplined no-trade days" value={String(patience.disciplinedNoTradeDays)} size="sm"
                note={`out of ${patience.tradingDays} logged days`} />
              <Stat label="Trades per active day" value={patience.avgTradesPerActiveDay.toFixed(1)} size="sm"
                tone={patience.avgTradesPerActiveDay > plan.maxTradesPerDay ? 'bad' : 'good'}
                note={`your limit is ${plan.maxTradesPerDay}`} />
              <Stat label="Valid triggers missed" value={String(patience.missedTriggers)} size="sm"
                tone={patience.missedTriggers > 0 ? 'warn' : 'good'}
                note={patience.estimatedRMissed
                  ? `est. ${rMult(patience.estimatedRMissed, 1)} forgone` : 'hesitation costs too'} />
              <Stat label="Non-setup trades" value={String(behaviour.nonSetupCount)} size="sm"
                tone={behaviour.nonSetupCount > 0 ? 'bad' : 'good'}
                note={behaviour.nonSetupCount
                  ? `${signedMoney(behaviour.nonSetupPnl, plan.currency)} from trades that never qualified`
                  : 'none — this is the win'} />
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <h2>Scaling readiness</h2>
              {scaling.ready
                ? <Badge tone="good">✓ Earned</Badge>
                : <Badge tone="neutral">Not yet</Badge>}
            </div>
            <div className="card-sub">Ch.23 — you scale from strength, never to catch up.</div>
            <p style={{ fontSize: 13, margin: '0 0 10px' }}>{scaling.verdict}</p>
            {scaling.nextTier ? (
              <div className="row" style={{ gap: 18, fontSize: 12.5 }}>
                <span>
                  <span className="muted">Equity </span>
                  <b className={scaling.equityMet ? 'good' : ''}>
                    {scaling.equityMet ? '✓' : '○'} {money(scaling.requiredEquity, plan.currency)}
                  </b>
                </span>
                <span>
                  <span className="muted">Compliance </span>
                  <b className={scaling.complianceMet ? 'good' : ''}>
                    {scaling.complianceMet ? '✓' : '○'} {scaling.requiredCompliance}%
                  </b>
                </span>
                <span className="muted">→ {scaling.nextTier}</span>
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <Card>
          <div className="card-head">
            <h2>Open positions</h2>
            <Link to="/positions" className="btn btn-sm btn-ghost">Manage →</Link>
          </div>
          {openTrades.length === 0 ? (
            <Empty title="Flat">
              No open risk. In the wrong weather that is exactly where you should be.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticker</th><th>Day</th><th>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.map((t) => {
                    const a = nextAction(t, plan)
                    return (
                      <tr key={t.id}>
                        <td><Link to={`/trades/${t.id}`}><b>{t.ticker}</b></Link></td>
                        <td className="num">{tradeDayNumber(t)}</td>
                        <td>
                          {a.urgency === 'ACTION' ? <Badge tone="warn">! Due</Badge> : null}{' '}
                          <span style={{ fontSize: 12.5 }}>{a.headline}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {plannedTrades.length ? (
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
              {plannedTrades.length} armed candidate{plannedTrades.length > 1 ? 's' : ''} waiting on a trigger.{' '}
              <Link to="/trades">Review</Link>
            </p>
          ) : null}
        </Card>

        <Card>
          <div className="card-head">
            <h2>Today</h2>
            <Link to="/daily" className="btn btn-sm btn-ghost">Open log →</Link>
          </div>
          {log?.weather ? (
            <>
              <div className="row" style={{ marginBottom: 10 }}>
                <Badge tone={log.weather === 'BULLISH' ? 'good' : log.weather === 'CAUTION' ? 'warn' : 'bad'}>
                  {log.weather}
                </Badge>
                <b style={{ fontSize: 13 }}>{WEATHER_PLAYBOOK[log.weather].stance}</b>
                <span className="muted" style={{ fontSize: 12.5 }}>· {WEATHER_PLAYBOOK[log.weather].sizing}</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {WEATHER_PLAYBOOK[log.weather].detail}
              </p>
            </>
          ) : (
            <Callout tone="warn" title="Weather not assessed">
              Ch.6 — the regime decides whether your setups have the tide behind them. Two minutes
              in the Daily Log before you look at a single chart.
            </Callout>
          )}
          {log?.processGoal ? (
            <>
              <hr className="divider" />
              <div className="stat-label">Today's process goal</div>
              <p style={{ fontSize: 13.5, margin: '4px 0 0' }}>{log.processGoal}</p>
            </>
          ) : null}
        </Card>
      </div>
    </>
  )
}
