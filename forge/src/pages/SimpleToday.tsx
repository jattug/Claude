/**
 * Today, in about thirty seconds.
 *
 * The full daily log is twenty-five checkboxes across three tabs. This asks
 * for the weather (the one input that changes what you are allowed to do), a
 * focus line, and an honest flag for a bad morning. The routine checklists
 * still exist in full mode for anyone who wants to tick them.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getOrCreateLog, saveLog, today } from '../db'
import type { DailyLog, Weather } from '../types'
import { WEATHER_PLAYBOOK, nextAction, isCompliant } from '../lib/rules'
import { longDate } from '../lib/format'
import { Card, Field, TextInput, Callout, Badge } from '../components/ui'

const WEATHERS: { id: Weather; label: string; icon: string }[] = [
  { id: 'BULLISH', label: 'Bullish', icon: '▲' },
  { id: 'CAUTION', label: 'Choppy', icon: '◆' },
  { id: 'BEARISH', label: 'Bearish', icon: '▼' },
]

export default function SimpleToday() {
  const [log, setLog] = useState<DailyLog | null>(null)
  const plan = useLiveQuery(() => db.plan.get('plan'), [])
  const trades = useLiveQuery(() => db.trades.toArray(), []) ?? []

  useEffect(() => { void getOrCreateLog(today()).then(setLog) }, [])
  if (!log || !plan) return <p className="muted">Loading…</p>

  const update = (patch: Partial<DailyLog>) => {
    const next = { ...log, ...patch }
    setLog(next)
    void saveLog(next)
  }

  const open = trades.filter((t) => t.status === 'OPEN')
  const dueToday = open
    .map((t) => ({ t, a: nextAction(t, plan) }))
    .filter((x) => x.a.urgency === 'ACTION')
  const needsAudit = trades.filter((t) => t.status === 'CLOSED' && isCompliant(t) === null)
  const offDay = !!log.externalStressors

  return (
    <>
      <div className="page-head">
        <h1>Today</h1>
        <p>{longDate(log.date)}</p>
      </div>

      <Card>
        <div className="card-head"><h2>What is the market doing?</h2></div>
        <div className="card-sub">
          The one call that changes what you are allowed to do. Index above a rising 20-day
          with the 10 above it is bullish; below a falling 20 is bearish; anything else is choppy.
        </div>
        <div className="btn-row">
          {WEATHERS.map((w) => (
            <button
              key={w.id}
              className={`btn ${log.weather === w.id ? 'btn-primary' : ''}`}
              style={{ flex: '1 1 120px', minHeight: 46, fontSize: 15 }}
              aria-pressed={log.weather === w.id}
              onClick={() => update({ weather: w.id })}
            >
              <span aria-hidden="true">{w.icon}</span> {w.label}
            </button>
          ))}
        </div>
        {log.weather ? (
          <div style={{ marginTop: 12 }}>
            <Callout
              tone={log.weather === 'BULLISH' ? 'good' : log.weather === 'CAUTION' ? 'warn' : 'bad'}
              title={`${WEATHER_PLAYBOOK[log.weather].stance} · ${WEATHER_PLAYBOOK[log.weather].sizing}`}
            >
              {WEATHER_PLAYBOOK[log.weather].detail}
            </Callout>
          </div>
        ) : null}
      </Card>

      <div className="grid grid-2" style={{ marginTop: 14, alignItems: 'start' }}>
        <Card>
          <div className="card-head"><h3>One thing to get right today</h3></div>
          <Field label="" hint="A behaviour, not a number. Leave it blank if nothing needs fixing.">
            <TextInput value={log.processGoal ?? ''}
              placeholder="No trade without checking the three questions first"
              onChange={(e) => update({ processGoal: e.target.value })} />
          </Field>

          <hr className="divider" />

          <label className="check-row" style={{ padding: '4px 0' }}>
            <input type="checkbox" checked={offDay}
              onChange={(e) => update({ externalStressors: e.target.checked ? 'Off day' : undefined })} />
            <span className="check-text">
              <span className="check-label">I am not at my best today</span>
              <span className="check-hint">
                Short on sleep, stressed, distracted. Flagging it means the analytics can later show
                you whether your worst trades cluster on these days.
              </span>
            </span>
          </label>
          {offDay ? (
            <Callout tone="warn" title="Half size, or sit it out">
              This is when old habits come back. Nothing says you have to trade today.
            </Callout>
          ) : null}
        </Card>

        <div className="stack">
          {dueToday.length ? (
            <Card>
              <div className="card-head"><h3>Do this at the close</h3></div>
              {dueToday.map(({ t, a }) => (
                <div key={t.id} style={{ marginBottom: 10 }}>
                  <Badge tone="warn">! {t.ticker}</Badge>{' '}
                  <span style={{ fontSize: 13.5 }}>{a.headline}</span>
                </div>
              ))}
            </Card>
          ) : null}

          <Card>
            <div className="card-head">
              <h3>Open positions</h3>
              <Link to="/positions" className="btn btn-sm btn-ghost">Manage →</Link>
            </div>
            {open.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Flat. In the wrong weather that is the right place to be.
              </p>
            ) : (
              <p style={{ fontSize: 13, margin: 0 }}>
                {open.map((t) => t.ticker).join(', ')} — {open.length} open.
              </p>
            )}
          </Card>

          {needsAudit.length ? (
            <Callout tone="warn" title={`${needsAudit.length} trade${needsAudit.length > 1 ? 's' : ''} to close out`}>
              One question each. Until they are answered your compliance rate is flattering you.{' '}
              <Link to="/trades">Do it now</Link>
            </Callout>
          ) : (
            <Callout tone="good" title="Nothing outstanding">
              Every closed trade is journalled.
            </Callout>
          )}
        </div>
      </div>
    </>
  )
}
