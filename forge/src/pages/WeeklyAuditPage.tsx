/**
 * The weekly system audit (Ch.22, Appendix D).
 *
 * The week's numbers are computed for you so the writing can be about patterns
 * rather than arithmetic.
 */
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, today } from '../db'
import type { WeeklyAudit } from '../types'
import { coreStats, disciplineCost, deviationLeaderboard, behaviourStats } from '../lib/metrics'
import { isCompliant } from '../lib/rules'
import { money, pct, rMult, signedMoney, weekEndingOf, longDate } from '../lib/format'
import { Card, Field, TextArea, TextInput, Callout, Stat, Quote } from '../components/ui'

export default function WeeklyAuditPage() {
  const [weekEnding, setWeekEnding] = useState(() => weekEndingOf(today()))
  const plan = useLiveQuery(() => db.plan.get('plan'), [])
  const allTrades = useLiveQuery(() => db.trades.toArray(), []) ?? []
  const stored = useLiveQuery(() => db.audits.get(weekEnding), [weekEnding])
  const [audit, setAudit] = useState<WeeklyAudit | null>(null)
  const [newGoal, setNewGoal] = useState('')

  useEffect(() => {
    setAudit(stored ?? {
      id: weekEnding, weekEnding, goalsNextWeek: [],
      createdAt: nowIso(), updatedAt: nowIso(),
    })
  }, [stored, weekEnding])

  if (!plan || !audit) return <p className="muted">Loading…</p>

  const update = (patch: Partial<WeeklyAudit>) => {
    const next = { ...audit, ...patch, updatedAt: nowIso() }
    setAudit(next)
    void db.audits.put(next)
  }

  // Monday-to-Friday window ending on the selected date.
  const end = weekEnding
  const startDate = new Date(end + 'T12:00:00')
  startDate.setDate(startDate.getDate() - 4)
  const start = startDate.toISOString().slice(0, 10)

  const weekTrades = allTrades.filter((t) => {
    const d = t.exitDate ?? t.entryDate
    return d != null && d >= start && d <= end
  })

  const stats = coreStats(weekTrades)
  const cost = disciplineCost(weekTrades)
  const deviations = deviationLeaderboard(weekTrades)
  const behaviour = behaviourStats(weekTrades)
  const unaudited = weekTrades.filter((t) => t.status === 'CLOSED' && isCompliant(t) === null)

  function addGoal() {
    if (!newGoal.trim()) return
    update({ goalsNextWeek: [...audit!.goalsNextWeek, newGoal.trim()] })
    setNewGoal('')
  }

  function shiftWeek(delta: number) {
    const d = new Date(weekEnding + 'T12:00:00')
    d.setDate(d.getDate() + delta * 7)
    setWeekEnding(d.toISOString().slice(0, 10))
  }

  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <h1>Weekly System Audit</h1>
          <div className="row">
            <button className="btn btn-sm" onClick={() => shiftWeek(-1)}>← Previous</button>
            <input type="date" value={weekEnding} style={{ width: 'auto' }}
              onChange={(e) => setWeekEnding(weekEndingOf(e.target.value))} />
            <button className="btn btn-sm" onClick={() => shiftWeek(1)}>Next →</button>
          </div>
        </div>
        <p>
          Week of {longDate(start)} to {longDate(end)}. Ch.22 — this is where the system actually
          improves. Respond to patterns; never react to a single bad week.
        </p>
      </div>

      {unaudited.length ? (
        <Callout tone="warn" title={`${unaudited.length} closed trade${unaudited.length > 1 ? 's' : ''} from this week are not audited`}>
          Finish those first, or the numbers below flatter you: {unaudited.map((t) => t.ticker).join(', ')}.
        </Callout>
      ) : null}

      <div className="grid grid-4">
        <Stat label="Trades closed" value={String(stats.trades)} size="sm" />
        <Stat label="Compliance" value={pct(stats.complianceRate, 0)} size="sm"
          tone={stats.complianceRate != null && stats.complianceRate >= 90 ? 'good' : 'bad'} />
        <Stat label="Total R" value={rMult(stats.totalR, 1)} size="sm"
          tone={stats.totalR > 0 ? 'good' : 'bad'} />
        <Stat label="Net P&L" value={signedMoney(stats.totalPnl, plan.currency)} size="sm"
          tone={stats.totalPnl > 0 ? 'good' : 'bad'} />
      </div>

      {stats.trades > 0 ? (
        <div style={{ marginTop: 14 }}>
          <Callout
            tone={stats.complianceRate != null && stats.complianceRate >= 90 ? 'good' : 'warn'}
            title={verdictTitle(stats.complianceRate, stats.totalR)}>
            {verdictBody(stats.complianceRate, stats.totalR)}
          </Callout>
        </div>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 14, alignItems: 'start' }}>
        <div className="stack">
          <Card>
            <div className="card-head"><h2>1. Did last week's goals get met?</h2></div>
            <div className="card-sub">Answer this before setting new ones, or the goals become decoration.</div>
            <Field label="">
              <TextArea value={audit.previousGoalsMet ?? ''} rows={3}
                placeholder="Goal was zero non-setup trades. Hit it Monday to Thursday, broke it Friday afternoon."
                onChange={(e) => update({ previousGoalsMet: e.target.value })} />
            </Field>
          </Card>

          <Card>
            <div className="card-head"><h2>2. Discipline and execution audit</h2></div>
            {deviations.length ? (
              <>
                <div className="card-sub">
                  Your rule breaks this week, costliest first. A trade with several deviations
                  appears against each one, so the P&amp;L column does not sum to a total.
                </div>
                <div className="table-wrap" style={{ marginBottom: 12 }}>
                  <table>
                    <thead><tr><th>Deviation</th><th className="num">Times</th><th className="num">P&amp;L</th></tr></thead>
                    <tbody>
                      {deviations.map((d) => (
                        <tr key={d.deviation}>
                          <td>{d.deviation}</td>
                          <td className="num">{d.count}</td>
                          <td className={`num ${d.totalPnl < 0 ? 'bad' : 'good'}`}>
                            {signedMoney(d.totalPnl, plan.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <Callout tone="good" title="No logged deviations this week">
                Either a genuinely clean week, or the audits were not filled in honestly. You know which.
              </Callout>
            )}
            {cost.violatingCount > 0 ? (
              <p style={{ fontSize: 13 }}>
                Cost of indiscipline this week: <b className="bad">{money(cost.cost, plan.currency)}</b>.
                Compliant trades averaged {rMult(cost.avgCompliantR)}; non-compliant {rMult(cost.avgViolatingR)}.
              </p>
            ) : null}
            <Field label="Top one or two deviation patterns"
              hint="Not a list of everything. The one or two that recur, and when in the day they happen.">
              <TextArea value={audit.topDeviations ?? ''} rows={3}
                onChange={(e) => update({ topDeviations: e.target.value })} />
            </Field>
          </Card>

          <Card>
            <div className="card-head"><h2>3. Emotional patterns</h2></div>
            <div className="card-sub">
              Read back through the week's psychology tabs. Which states kept showing up before the
              mistakes, and did your countermeasures actually work?
            </div>
            <Field label="">
              <TextArea value={audit.emotionalPatterns ?? ''} rows={4}
                placeholder="Two stop-outs in a row on Wednesday, then a revenge trade within ten minutes. The cooling-off rule was ignored both times."
                onChange={(e) => update({ emotionalPatterns: e.target.value })} />
            </Field>
            {behaviour.missedTwiceCount > 0 ? (
              <Callout tone="warn" title={`${behaviour.missedTwiceCount} back-to-back rule break${behaviour.missedTwiceCount > 1 ? 's' : ''}`}>
                Ch.12 — "never miss twice". One slip is human; the second is the spiral. What would
                have interrupted it?
              </Callout>
            ) : null}
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="card-head"><h2>4. System and scanning effectiveness</h2></div>
            <Field label="Did the setups behave as expected in this week's conditions?">
              <TextArea value={audit.systemEffectiveness ?? ''} rows={3}
                onChange={(e) => update({ systemEffectiveness: e.target.value })} />
            </Field>
            <Field label="Did the scans catch the week's actual best movers?"
              hint="Compare your focus lists against what really ran. Missing them repeatedly is a scanner problem, not a discipline problem.">
              <TextArea value={audit.scanningEffectiveness ?? ''} rows={3}
                onChange={(e) => update({ scanningEffectiveness: e.target.value })} />
            </Field>
          </Card>

          <Card>
            <div className="card-head"><h2>5. Workflow</h2></div>
            <Field label="Routines completed? Any step you keep skipping?">
              <TextArea value={audit.workflowNotes ?? ''} rows={3}
                onChange={(e) => update({ workflowNotes: e.target.value })} />
            </Field>
          </Card>

          <Card>
            <div className="card-head"><h2>6. Refinements</h2></div>
            <Callout tone="warn" title="Respond, do not react">
              Ch.22 — never change a core rule on one week of data, especially an unusual week.
              Clarify wording, tighten a scan, add an if-then plan. Leave the strategy alone.
            </Callout>
            <Field label="Changes made, with the reasoning"
              hint="Log any rulebook edit in the Rulebook change log too, with today's date.">
              <TextArea value={audit.refinements ?? ''} rows={3}
                onChange={(e) => update({ refinements: e.target.value })} />
            </Field>
          </Card>

          <Card>
            <div className="card-head"><h2>7. Next week's process goals</h2></div>
            <div className="card-sub">
              One or two, specific and measurable. Behaviour, never P&amp;L.
            </div>
            <div className="row" style={{ gap: 8 }}>
              <TextInput value={newGoal} placeholder="Zero trades without a completed checklist"
                style={{ flex: 1 }}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addGoal() }} />
              <button className="btn btn-sm" onClick={addGoal}>Add</button>
            </div>
            {audit.goalsNextWeek.length ? (
              <ul style={{ margin: '12px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
                {audit.goalsNextWeek.map((g, i) => (
                  <li key={i}>
                    {g}{' '}
                    <button className="btn btn-sm btn-ghost" aria-label="Remove goal"
                      onClick={() => update({ goalsNextWeek: audit.goalsNextWeek.filter((_, j) => j !== i) })}>✕</button>
                  </li>
                ))}
              </ul>
            ) : null}
            {audit.goalsNextWeek.length > 2 ? (
              <p className="warn" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
                More than two goals is no goals. Pick the one that matters.
              </p>
            ) : null}
          </Card>

          <Card>
            <Quote source="peoplewish">
              Build sub-systems that force you to constantly audit and refine the system as a whole,
              to simplify and improve it over time.
            </Quote>
          </Card>
        </div>
      </div>
    </>
  )
}

function verdictTitle(compliance: number | null, totalR: number): string {
  if (compliance == null) return 'Not enough audited trades to judge the week'
  if (compliance >= 90 && totalR >= 0) return 'Good week — you followed the plan and it paid'
  if (compliance >= 90) return 'Good week, despite the P&L'
  if (totalR >= 0) return 'Profitable week, poor process'
  return 'Bad week on both counts'
}

function verdictBody(compliance: number | null, totalR: number): string {
  if (compliance == null) return 'Audit the closed trades and this verdict fills in.'
  if (compliance >= 90 && totalR >= 0) {
    return 'The one to repeat. Note what made the discipline easy this week — that is the thing to reproduce, not the P&L.'
  }
  if (compliance >= 90) {
    return 'You executed your system and the market did not pay. That is what a normal losing week looks like for a trader with an edge. Nothing to fix. Do not change a rule on the back of it.'
  }
  if (totalR >= 0) {
    return 'The dangerous week. Money came in while the process broke down, which teaches your brain the wrong lesson at full volume. Treat the green number as noise and fix the process.'
  }
  return 'Both the money and the lesson point the same way, which at least makes the work obvious. Find the one recurring deviation and build friction against it before next week.'
}
