/**
 * Analytics (Ch.22, Ch.25).
 *
 * Every slice answers a question the book raises: does the tightness rule earn
 * its keep? Does the weather filter matter? Which demon is the most expensive?
 */
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  coreStats, disciplineCost, equityCurve, complianceOverTime, rDistribution,
  deviationLeaderboard, bySetup, byWeather, byTightness, byGrade, byEmotionBefore,
  byDayOfWeek, bySector, byConviction, behaviourStats, dateRangeFilter,
  routineAdherence, maxDrawdown,
} from '../lib/metrics'
import { PREMARKET_STEPS, MARKET_HOURS_STEPS, POSTMARKET_STEPS } from '../types'
import { money, pct, rMult, signedMoney } from '../lib/format'
import { Card, Stat, Callout, Segmented, Empty, Tabs, Badge } from '../components/ui'
import {
  ChartCard, EquityChart, ComplianceChart, RDistributionChart,
  DeviationChart, SegmentChart,
} from '../components/charts'

type Range = '30' | '90' | '365' | 'all'
type Tab = 'overview' | 'discipline' | 'edge' | 'psychology'

export default function Analytics() {
  const plan = useLiveQuery(() => db.plan.get('plan'), [])
  const allTrades = useLiveQuery(() => db.trades.toArray(), []) ?? []
  const logs = useLiveQuery(() => db.logs.toArray(), []) ?? []
  const [range, setRange] = useState<Range>('all')
  const [tab, setTab] = useState<Tab>('overview')

  if (!plan) return <p className="muted">Loading…</p>

  const days = range === 'all' ? null : Number(range)
  const trades = dateRangeFilter(allTrades, days)
  const currency = plan.currency

  if (!allTrades.some((t) => t.status === 'CLOSED')) {
    return (
      <>
        <div className="page-head"><h1>Analytics</h1></div>
        <Empty title="No closed trades yet">
          Analytics needs finished, audited trades. Come back after your first week — and remember
          that a small sample of honest data beats a large sample of flattering data.
        </Empty>
      </>
    )
  }

  const stats = coreStats(trades)
  const cost = disciplineCost(trades)
  const behaviour = behaviourStats(trades)

  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <h1>Analytics</h1>
          <Segmented<Range>
            value={range} onChange={setRange}
            options={[
              { id: '30', label: '30d' }, { id: '90', label: '90d' },
              { id: '365', label: '1y' }, { id: 'all', label: 'All' },
            ]}
          />
        </div>
        <p>Ch.22 — change rules from patterns across many weeks, never from the last three trades.</p>
      </div>

      <Tabs<Tab>
        active={tab} onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'discipline', label: 'Discipline' },
          { id: 'edge', label: 'Where the edge lives' },
          { id: 'psychology', label: 'Psychology' },
        ]}
      />

      {tab === 'overview' ? (
        <>
          <div className="grid grid-4">
            <Stat label="Closed trades" value={String(stats.trades)} size="sm"
              note={`${stats.audited} audited`} />
            <Stat label="Expectancy" value={rMult(stats.expectancyR)} size="sm"
              tone={stats.expectancyR != null && stats.expectancyR > 0 ? 'good' : 'bad'}
              note="average R per trade" />
            <Stat label="Win rate" value={pct(stats.winRate, 0)} size="sm"
              note="a low win rate is normal and fine — the outliers pay" />
            <Stat label="Profit factor" value={stats.profitFactor?.toFixed(2) ?? '—'} size="sm"
              tone={stats.profitFactor != null && stats.profitFactor > 1.3 ? 'good' : 'warn'} />
            <Stat label="Avg win" value={rMult(stats.avgWinR)} size="sm" tone="good" />
            <Stat label="Avg loss" value={rMult(stats.avgLossR)} size="sm" tone="bad"
              note={stats.avgLossR != null && stats.avgLossR < -1.2
                ? 'worse than -1R — stops are not being honoured' : 'inside 1R, as designed'} />
            <Stat label="Best / worst" size="sm"
              value={`${rMult(stats.largestWinR, 1)} / ${rMult(stats.largestLossR, 1)}`} />
            <Stat label="Max drawdown" size="sm"
              value={pct(maxDrawdown(equityCurve(trades, plan.startingEquity)), 1)} />
          </div>

          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <ChartCard title="Equity: actual vs rules-only"
              sub="Ch.13 — the cost of deviation, made visible. If the orange line sits above the blue one, your rule breaks are paying for themselves in pain.">
              <EquityChart data={equityCurve(trades, plan.startingEquity)} currency={currency} />
            </ChartCard>
            <ChartCard title="R-multiple distribution"
              sub="A healthy momentum system looks like a wall of small losses at -1R and a thin tail of large winners. If the left side runs past -1R, stops are being ignored.">
              <RDistributionChart data={rDistribution(trades)} />
            </ChartCard>
          </div>
        </>
      ) : null}

      {tab === 'discipline' ? (
        <>
          <div className="grid grid-4">
            <Stat label="Compliance rate" value={pct(stats.complianceRate, 0)} size="sm"
              tone={stats.complianceRate != null && stats.complianceRate >= 90 ? 'good' : 'bad'} />
            <Stat label="Checklist use" value={pct(behaviour.checklistUseRate, 0)} size="sm"
              tone={behaviour.checklistUseRate != null && behaviour.checklistUseRate >= 95 ? 'good' : 'warn'} />
            <Stat label="Stop honour rate" value={pct(behaviour.stopHonourRate, 0)} size="sm"
              tone={behaviour.stopHonourRate != null && behaviour.stopHonourRate >= 95 ? 'good' : 'bad'} />
            <Stat label="Non-setup trades" value={String(behaviour.nonSetupCount)} size="sm"
              tone={behaviour.nonSetupCount === 0 ? 'good' : 'bad'}
              note={signedMoney(behaviour.nonSetupPnl, currency)} />
          </div>

          {cost.violatingCount > 0 ? (
            <div style={{ marginTop: 14 }}>
              <Callout tone={cost.cost > 0 ? 'bad' : 'warn'}
                title={cost.cost > 0
                  ? `Indiscipline has cost ${money(cost.cost, currency)} in this period`
                  : 'Your rule breaks made money in this period'}>
                Compliant trades average <b>{rMult(cost.avgCompliantR)}</b> across {cost.compliantCount} trades.
                Non-compliant ones average <b>{rMult(cost.avgViolatingR)}</b> across {cost.violatingCount}.
                {cost.cost <= 0
                  ? ' A profitable rule break is the most expensive kind — it buys a habit that will bill you later.'
                  : ''}
              </Callout>
            </div>
          ) : null}

          <div className="grid grid-2" style={{ marginTop: 14 }}>
            <ChartCard title="What each demon has cost you"
              sub="Ch.13 — quantify the cost of deviation. The one at the bottom is the habit to work on first; ignore the rest until it is gone.">
              <DeviationChart data={deviationLeaderboard(trades)} currency={currency} />
            </ChartCard>
            <ChartCard title="Compliance trend, rolling 10 trades"
              sub="Ch.23 — this line, held above 90%, is what earns a size increase. Nothing else does.">
              <ComplianceChart data={complianceOverTime(trades)} />
            </ChartCard>
          </div>

          <Card style={{ marginTop: 14 }}>
            <div className="card-head"><h2>Routine adherence</h2></div>
            <div className="card-sub">
              Ch.25 — skipped routines are the first sign of complacency, and they show up here
              before they show up in your P&amp;L.
            </div>
            <div className="grid grid-3">
              <Stat label="Pre-market prep" size="sm"
                value={pct(routineAdherence(logs, PREMARKET_STEPS, 'preMarket'), 0)} />
              <Stat label="Market hours" size="sm"
                value={pct(routineAdherence(logs, MARKET_HOURS_STEPS, 'marketHours'), 0)} />
              <Stat label="Post-market review" size="sm"
                value={pct(routineAdherence(logs, POSTMARKET_STEPS, 'postMarket'), 0)} />
            </div>
          </Card>

          <Card style={{ marginTop: 14 }}>
            <div className="card-head"><h2>Habit streaks</h2></div>
            <div className="grid grid-3">
              <Stat label="Current compliant streak" value={String(behaviour.currentCompliantStreak)} size="sm" />
              <Stat label="Personal best" value={String(behaviour.bestCompliantStreak)} size="sm" />
              <Stat label="Missed twice" value={String(behaviour.missedTwiceCount)} size="sm"
                tone={behaviour.missedTwiceCount === 0 ? 'good' : 'bad'}
                note="Ch.12 — one slip is human. Two in a row is a spiral." />
            </div>
          </Card>
        </>
      ) : null}

      {tab === 'edge' ? (
        <>
          <div className="grid grid-2">
            <ChartCard title="Average R by setup"
              sub="Ch.8 — focus is power. If one setup carries the account, master it before adding another.">
              <SegmentChart data={bySetup(trades)} />
            </ChartCard>
            <ChartCard title="Average R by market weather"
              sub="Ch.6 — this is the chart that proves or disproves your weather filter. If bearish-weather trades bleed, the filter is real and you should obey it.">
              <SegmentChart data={byWeather(trades)}
                emptyText="Log the weather in your Daily Log and this fills in." />
            </ChartCard>
            <ChartCard title="Average R by tightness"
              sub="Ch.8 — the core claim of the method: tighter charts produce better outcomes at lower risk. Here is your own evidence, for or against.">
              <SegmentChart data={byTightness(trades)}
                emptyText="Record tight-day counts at the gate and this fills in." />
            </ChartCard>
            <ChartCard title="Average R by setup grade"
              sub="If your A+ trades do not outperform your B trades, either the criteria are wrong or you are grading generously.">
              <SegmentChart data={byGrade(trades)} />
            </ChartCard>
            <ChartCard title="Average R by sector / theme"
              sub="Ch.7 — half of a stock's move comes from its group.">
              <SegmentChart data={bySector(trades)} emptyText="Tag sectors on your trades." />
            </ChartCard>
            <ChartCard title="Average R by conviction"
              sub="A useful humility check: most traders' self-rated conviction has no relationship to outcome.">
              <SegmentChart data={byConviction(trades)} emptyText="Rate conviction at the gate." />
            </ChartCard>
          </div>
        </>
      ) : null}

      {tab === 'psychology' ? (
        <>
          <div className="grid grid-2">
            <ChartCard title="Average R by pre-entry emotional state"
              sub="Ch.4 — the point is not to feel nothing. It is to know which states reliably precede bad decisions, so you can add friction on those days.">
              <SegmentChart data={byEmotionBefore(trades)}
                emptyText="Tag your state before entry and the pattern appears here." />
            </ChartCard>
            <ChartCard title="Average R by day of week"
              sub="Boredom and fatigue are not evenly distributed across the week.">
              <SegmentChart data={byDayOfWeek(trades)} />
            </ChartCard>
          </div>

          <Card style={{ marginTop: 14 }}>
            <div className="card-head"><h2>Emotional state and compliance</h2></div>
            <div className="card-sub">
              The column that matters is compliance, not R. A state can be profitable by luck and
              still be destroying your process.
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>State before entry</th><th className="num">Trades</th>
                    <th className="num">Avg R</th><th className="num">Win rate</th>
                    <th className="num">Compliance</th><th>Read</th>
                  </tr>
                </thead>
                <tbody>
                  {byEmotionBefore(trades).map((s) => {
                    const risky = s.complianceRate != null && s.complianceRate < 70
                    return (
                      <tr key={s.key}>
                        <td><b>{s.key}</b></td>
                        <td className="num">{s.trades}</td>
                        <td className={`num ${s.avgR > 0 ? 'good' : 'bad'}`}>{rMult(s.avgR)}</td>
                        <td className="num">{pct(s.winRate, 0)}</td>
                        <td className={`num ${risky ? 'bad' : ''}`}>{pct(s.complianceRate, 0)}</td>
                        <td>
                          {risky
                            ? <Badge tone="bad">✕ Rules break in this state</Badge>
                            : <Badge tone="good">✓ Executes cleanly</Badge>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {behaviour.rLeftOnTable != null || behaviour.avgChaseR != null ? (
            <div className="grid grid-2" style={{ marginTop: 14 }}>
              {behaviour.rLeftOnTable != null ? (
                <Card>
                  <div className="card-head"><h3>Winners cut short</h3></div>
                  <div className="stat-value bad">{rMult(behaviour.rLeftOnTable, 1)}</div>
                  <p className="stat-note">
                    Total R you were up at the high and did not take, on trades you tagged as cut
                    early out of fear. Ch.5 — this is what starves an account of the outliers.
                  </p>
                </Card>
              ) : null}
              {behaviour.avgChaseR != null ? (
                <Card>
                  <div className="card-head"><h3>What chasing costs</h3></div>
                  <div className={`stat-value ${behaviour.avgChaseR < 0 ? 'bad' : 'warn'}`}>
                    {rMult(behaviour.avgChaseR)}
                  </div>
                  <p className="stat-note">
                    Average outcome on trades where you paid up past your own trigger, against{' '}
                    {rMult(cost.avgCompliantR)} on clean entries.
                  </p>
                </Card>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  )
}
