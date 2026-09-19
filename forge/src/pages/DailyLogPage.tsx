/**
 * The daily operating system (Ch.19-21, Appendix C).
 *
 * Pre-market prep, the weather call, the focus list, and the honest post-market
 * review — in the order the book runs them.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getOrCreateLog, saveLog, uid, today } from '../db'
import {
  PREMARKET_STEPS, MARKET_HOURS_STEPS, POSTMARKET_STEPS, SETUP_TYPES,
  type DailyLog, type WatchItem, type SetupType,
} from '../types'
import { deriveWeather, WEATHER_PLAYBOOK } from '../lib/rules'
import { longDate, pct } from '../lib/format'
import {
  Card, Field, NumberInput, TextInput, TextArea, Select, Callout, Badge,
  Meter, Tabs, TriToggle, Quote,
} from '../components/ui'

type Tab = 'pre' | 'hours' | 'post'

export default function DailyLogPage() {
  const [date, setDate] = useState(today())
  const [tab, setTab] = useState<Tab>('pre')
  const [log, setLog] = useState<DailyLog | null>(null)
  const trades = useLiveQuery(() => db.trades.toArray(), []) ?? []

  useEffect(() => { void getOrCreateLog(date).then(setLog) }, [date])

  if (!log) return <p className="muted">Loading…</p>

  const update = (patch: Partial<DailyLog>) => {
    const next = { ...log, ...patch }
    next.weather = deriveWeather(next) ?? next.weather
    setLog(next)
    void saveLog(next)
  }

  const toggleStep = (phase: 'preMarket' | 'marketHours' | 'postMarket', key: string) =>
    update({ [phase]: { ...log[phase], [key]: !log[phase]?.[key] } } as Partial<DailyLog>)

  const progress = (phase: 'preMarket' | 'marketHours' | 'postMarket', steps: { key: string }[]) => {
    const done = steps.filter((s) => log[phase]?.[s.key]).length
    return { done, total: steps.length, pct: (done / steps.length) * 100 }
  }

  const pre = progress('preMarket', PREMARKET_STEPS)
  const hours = progress('marketHours', MARKET_HOURS_STEPS)
  const post = progress('postMarket', POSTMARKET_STEPS)
  const daysTrades = trades.filter((t) => t.entryDate === date)

  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <h1>Daily Log</h1>
          <div className="row">
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)}
              style={{ width: 'auto' }} />
            {date !== today()
              ? <button className="btn btn-sm" onClick={() => setDate(today())}>Today</button>
              : null}
          </div>
        </div>
        <p>{longDate(date)} — the day starts before the bell and is not over until it is reviewed.</p>
      </div>

      <div className="grid grid-3">
        <PhaseCard label="Pre-market prep" p={pre} onClick={() => setTab('pre')} />
        <PhaseCard label="Market hours" p={hours} onClick={() => setTab('hours')} />
        <PhaseCard label="Post-market review" p={post} onClick={() => setTab('post')} />
      </div>

      <div style={{ marginTop: 18 }}>
        <Tabs<Tab>
          active={tab} onChange={setTab}
          tabs={[
            { id: 'pre', label: `Pre-Market (${pre.done}/${pre.total})` },
            { id: 'hours', label: `Market Hours (${hours.done}/${hours.total})` },
            { id: 'post', label: `Post-Market (${post.done}/${post.total})` },
          ]}
        />
      </div>

      {tab === 'pre' ? (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="stack">
            <Card>
              <div className="card-head">
                <h2>Read the weather</h2>
                {log.weather ? (
                  <Badge tone={log.weather === 'BULLISH' ? 'good' : log.weather === 'CAUTION' ? 'warn' : 'bad'}>
                    {log.weather}
                  </Badge>
                ) : null}
              </div>
              <div className="card-sub">
                Ch.6 — environment is most of your day-to-day success. Three objective questions,
                answered before you look at a single stock chart.
              </div>

              <Field label="Reference index">
                <TextInput value={log.indexSymbol}
                  onChange={(e) => update({ indexSymbol: e.target.value.toUpperCase() })} />
              </Field>

              <div className="stack" style={{ gap: 12, marginTop: 6 }}>
                <WeatherQuestion label={`Is ${log.indexSymbol} above its 20-day MA?`}
                  value={log.indexAbove20} onChange={(v) => update({ indexAbove20: v })} />
                <WeatherQuestion label="Is the 10-day MA above the 20-day?"
                  value={log.ma10Above20} onChange={(v) => update({ ma10Above20: v })} />
                <WeatherQuestion label="Is the 20-day MA rising?"
                  value={log.ma20Rising} onChange={(v) => update({ ma20Rising: v })} />
              </div>

              <div className="grid grid-2" style={{ marginTop: 14 }}>
                <Field label="VIX"><NumberInput value={log.vix} onValue={(v) => update({ vix: v })} step={0.1} /></Field>
                <Field label="Watchlist quality (1-5)"
                  hint="Your own breadth indicator: are the scans producing tight, clean charts, or sloppy ones?">
                  <NumberInput value={log.watchlistQuality} min={1} max={5}
                    onValue={(v) => update({ watchlistQuality: v })} />
                </Field>
              </div>
              <Field label="Breadth / internals note">
                <TextInput value={log.breadthNote ?? ''} placeholder="Leaders holding up, semis extended"
                  onChange={(e) => update({ breadthNote: e.target.value })} />
              </Field>

              {log.weather ? (
                <Callout tone={log.weather === 'BULLISH' ? 'good' : log.weather === 'CAUTION' ? 'warn' : 'bad'}
                  title={`${WEATHER_PLAYBOOK[log.weather].stance} · ${WEATHER_PLAYBOOK[log.weather].sizing}`}>
                  {WEATHER_PLAYBOOK[log.weather].detail}
                </Callout>
              ) : (
                <Callout tone="info">Answer the three questions and the regime is derived for you.</Callout>
              )}
            </Card>

            <Card>
              <div className="card-head"><h2>Fit to trade</h2></div>
              <div className="card-sub">
                Ch.26 — sleep and stress measurably change your decision quality. Logging them lets
                the analytics tell you whether your worst trades cluster on your worst mornings.
              </div>
              <div className="grid grid-3">
                <Field label="Sleep (hours)">
                  <NumberInput value={log.sleepHours} onValue={(v) => update({ sleepHours: v })} step={0.5} />
                </Field>
                <Field label="Energy (1-5)">
                  <NumberInput value={log.energy} min={1} max={5} onValue={(v) => update({ energy: v })} />
                </Field>
                <Field label="Stress (1-5)">
                  <NumberInput value={log.stress} min={1} max={5} onValue={(v) => update({ stress: v })} />
                </Field>
              </div>
              <Field label="Anything going on outside the market?">
                <TextInput value={log.externalStressors ?? ''}
                  onChange={(e) => update({ externalStressors: e.target.value })} />
              </Field>
              {(log.sleepHours != null && log.sleepHours < 6) || (log.stress != null && log.stress >= 4) ? (
                <Callout tone="warn" title="Reduced capacity today">
                  This is when old habits resurface. Consider half size, or treat today as a study
                  day. Sitting out is a legitimate use of a bad morning.
                </Callout>
              ) : null}
            </Card>

            <Card>
              <div className="card-head"><h2>Today's process goal</h2></div>
              <div className="card-sub">Ch.2 — one behavioural goal, not a P&amp;L target.</div>
              <Field label="">
                <TextInput value={log.processGoal ?? ''}
                  placeholder="Checklist on every trade, no exceptions."
                  onChange={(e) => update({ processGoal: e.target.value })} />
              </Field>
            </Card>
          </div>

          <div className="stack">
            <Card>
              <div className="card-head"><h3>Pre-market checklist</h3></div>
              {PREMARKET_STEPS.map((s) => (
                <label key={s.key} className="check-row">
                  <input type="checkbox" checked={!!log.preMarket?.[s.key]}
                    onChange={() => toggleStep('preMarket', s.key)} />
                  <span className="check-text"><span className="check-label">{s.label}</span></span>
                </label>
              ))}
            </Card>
            <WatchlistCard log={log} update={update} />
          </div>
        </div>
      ) : null}

      {tab === 'hours' ? (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Card>
            <div className="card-head"><h2>Execution checklist</h2></div>
            <div className="card-sub">
              Ch.20 — during the session your only job is to execute triggers. Tick these honestly
              at the close; they feed your routine-adherence stats.
            </div>
            {MARKET_HOURS_STEPS.map((s) => (
              <label key={s.key} className="check-row">
                <input type="checkbox" checked={!!log.marketHours?.[s.key]}
                  onChange={() => toggleStep('marketHours', s.key)} />
                <span className="check-text"><span className="check-label">{s.label}</span></span>
              </label>
            ))}
          </Card>
          <div className="stack">
            <Card>
              <div className="card-head"><h3>Trades entered today</h3></div>
              {daysTrades.length === 0 ? (
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                  None. If the scans produced nothing that met your criteria, that is a successful
                  day — capital preserved, edge intact.
                </p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Ticker</th><th>Setup</th><th>Grade</th><th></th></tr></thead>
                    <tbody>
                      {daysTrades.map((t) => (
                        <tr key={t.id}>
                          <td><b>{t.ticker}</b></td>
                          <td style={{ fontSize: 12.5 }}>{t.setupType}</td>
                          <td>
                            <Badge tone={t.grade === 'A+' ? 'good' : t.grade === 'NO-TRADE' ? 'bad' : 'warn'}>
                              {t.grade}
                            </Badge>
                          </td>
                          <td><Link to={`/trades/${t.id}`} className="btn btn-sm">Journal</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card>
              <Quote source="Qullamaggie">
                Don't do anything stupid, out of boredom.
              </Quote>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'post' ? (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="stack">
            <Card>
              <div className="card-head"><h2>The honest debrief</h2></div>
              <div className="card-sub">
                Ch.21 — decompress first, then write this calmly. Glossing over a mistake here is
                how it becomes permanent.
              </div>
              <Field label="How did the day go, process-wise?"
                hint="Not the P&L. Did you follow the plan? Where did you nearly not?">
                <TextArea value={log.daySummary ?? ''} rows={4}
                  placeholder="Three A+ setups scanned, one triggered, took it clean. Nearly chased a name off the list at 11am and did not."
                  onChange={(e) => update({ daySummary: e.target.value })} />
              </Field>
              <Field label="The single most important lesson">
                <TextArea value={log.keyLesson ?? ''} rows={2}
                  onChange={(e) => update({ keyLesson: e.target.value })} />
              </Field>
              <Field label="One thing to reinforce tomorrow">
                <TextArea value={log.tomorrowFocus ?? ''} rows={2}
                  onChange={(e) => update({ tomorrowFocus: e.target.value })} />
              </Field>
            </Card>
            {daysTrades.some((t) => Object.values(t.audit).some((v) => v === null)) ? (
              <Callout tone="warn" title="Some of today's trades are not audited yet">
                An un-audited trade does not count toward your compliance rate, which means the
                number on your dashboard is flattering you.{' '}
                <Link to="/trades">Finish the audits</Link>
              </Callout>
            ) : null}
          </div>
          <Card>
            <div className="card-head"><h3>Post-market checklist</h3></div>
            {POSTMARKET_STEPS.map((s) => (
              <label key={s.key} className="check-row">
                <input type="checkbox" checked={!!log.postMarket?.[s.key]}
                  onChange={() => toggleStep('postMarket', s.key)} />
                <span className="check-text"><span className="check-label">{s.label}</span></span>
              </label>
            ))}
          </Card>
        </div>
      ) : null}
    </>
  )
}

function PhaseCard({ label, p, onClick }: {
  label: string; p: { done: number; total: number; pct: number }; onClick: () => void
}) {
  const tone = p.pct === 100 ? 'good' : p.pct >= 50 ? 'warn' : 'bad'
  return (
    <button className="stat" onClick={onClick}
      style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--border)' }}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value sm ${tone}`}>{p.done} / {p.total}</div>
      <div style={{ marginTop: 8 }}><Meter value={p.pct} tone={tone} /></div>
    </button>
  )
}

function WeatherQuestion({ label, value, onChange }: {
  label: string; value: boolean | null; onChange: (v: boolean | null) => void
}) {
  return (
    <div className="row-between">
      <span style={{ fontSize: 13.5 }}>{label}</span>
      <TriToggle value={value} onChange={onChange} />
    </div>
  )
}

function WatchlistCard({ log, update }: { log: DailyLog; update: (p: Partial<DailyLog>) => void }) {
  const [ticker, setTicker] = useState('')
  const [tier, setTier] = useState<WatchItem['tier']>('FOCUS')
  const [setupType, setSetupType] = useState<SetupType>('Breakout — Tight Consolidation')

  const focusCount = log.watchlist.filter((w) => w.tier === 'FOCUS').length

  function add() {
    if (!ticker.trim()) return
    update({
      watchlist: [...log.watchlist, {
        id: uid(), ticker: ticker.trim().toUpperCase(), tier, setupType,
        alertSet: false, outcome: 'PENDING',
      }],
    })
    setTicker('')
  }

  const patch = (id: string, p: Partial<WatchItem>) =>
    update({ watchlist: log.watchlist.map((w) => (w.id === id ? { ...w, ...p } : w)) })

  const remove = (id: string) => update({ watchlist: log.watchlist.filter((w) => w.id !== id) })

  return (
    <Card>
      <div className="card-head">
        <h3>Focus list</h3>
        <Badge tone={focusCount > 5 ? 'bad' : 'good'}>{focusCount} focus names</Badge>
      </div>
      <div className="card-sub">
        Ch.13 — a big watchlist is a playground for impatience. Five names maximum on the focus
        tier. Everything else waits on the secondary list.
      </div>
      {focusCount > 5 ? (
        <Callout tone="bad" title="Your focus list is too long">
          It is much easier to watch a few than many. Cut it to the five best or you will end up
          trading the sixth.
        </Callout>
      ) : null}

      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <TextInput value={ticker} placeholder="Ticker" style={{ flex: '1 1 90px' }}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
        <Select value={tier} onChange={(e) => setTier(e.target.value as WatchItem['tier'])}
          style={{ flex: '0 0 140px' }}>
          <option value="FOCUS">Focus</option>
          <option value="NMS">Needs more sideways</option>
          <option value="OBSERVE">Missed — observe</option>
        </Select>
        <button className="btn btn-sm" onClick={add}>Add</button>
      </div>
      <div style={{ marginTop: 6 }}>
        <Select value={setupType} onChange={(e) => setSetupType(e.target.value as SetupType)}>
          {SETUP_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {log.watchlist.length ? (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr><th>Ticker</th><th>Tier</th><th>Outcome</th><th></th></tr>
            </thead>
            <tbody>
              {log.watchlist.map((w) => (
                <tr key={w.id}>
                  <td><b>{w.ticker}</b></td>
                  <td>
                    <Badge tone={w.tier === 'FOCUS' ? 'accent' : 'neutral'}>
                      {w.tier === 'FOCUS' ? 'Focus' : w.tier === 'NMS' ? 'NMS' : 'Observe'}
                    </Badge>
                  </td>
                  <td>
                    <Select value={w.outcome} style={{ fontSize: 12, padding: '4px 6px' }}
                      onChange={(e) => patch(w.id, { outcome: e.target.value as WatchItem['outcome'] })}>
                      <option value="PENDING">Pending</option>
                      <option value="TAKEN">Triggered — taken</option>
                      <option value="TRIGGERED_MISSED">Triggered — MISSED</option>
                      <option value="NO_TRIGGER">Never triggered</option>
                      <option value="INVALIDATED">Setup invalidated</option>
                    </Select>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-ghost" onClick={() => remove(w.id)} aria-label={`Remove ${w.ticker}`}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {log.watchlist.some((w) => w.outcome === 'TRIGGERED_MISSED') ? (
        <div style={{ marginTop: 12 }}>
          <Callout tone="warn" title="You missed a valid trigger">
            Ch.21 — this is data about you, not the market. Was it fear, distraction, or a platform
            problem? Write it in the debrief; a missed A+ costs the same as a bad trade.
          </Callout>
          {log.watchlist.filter((w) => w.outcome === 'TRIGGERED_MISSED').map((w) => (
            <div key={w.id} className="grid grid-2" style={{ marginTop: 8 }}>
              <Field label={`${w.ticker} — why did you not take it?`}>
                <TextInput value={w.missedReason ?? ''}
                  onChange={(e) => patch(w.id, { missedReason: e.target.value })} />
              </Field>
              <Field label="Estimated R forgone">
                <NumberInput value={w.estimatedRMissed} step={0.5}
                  onValue={(v) => patch(w.id, { estimatedRMissed: v })} />
              </Field>
            </div>
          ))}
        </div>
      ) : null}

      {log.watchlist.length ? (
        <p className="muted" style={{ fontSize: 11.5, marginTop: 10, marginBottom: 0 }}>
          Focus-list accuracy so far:{' '}
          {pct(
            (log.watchlist.filter((w) => w.outcome === 'TAKEN').length /
              Math.max(1, log.watchlist.filter((w) => w.outcome === 'TAKEN' || w.outcome === 'TRIGGERED_MISSED').length)) * 100,
            0,
          )}{' '}of triggered names were actually taken.
        </p>
      ) : null}
    </Card>
  )
}
