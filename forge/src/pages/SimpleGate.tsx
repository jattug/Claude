/**
 * The gate, stripped to what actually decides the trade.
 *
 * The full checklist is sixteen ticks. Three of them do nearly all the work:
 * is the weather right, is this a leader, is it tight. Everything else either
 * follows from those or is detail you want when reviewing, not when deciding.
 * Entry and stop are here because the sizing maths is the one thing you must
 * never do in your head.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { SETUP_TYPES, type Trade, type Emotion, type SetupType } from '../types'
import { db, newTrade, saveTrade, today, nowIso, getOrCreateLog } from '../db'
import { calcSize, evaluateBreakers, weatherSizeCap, WEATHER_PLAYBOOK } from '../lib/rules'
import { money, pct } from '../lib/format'
import {
  Card, Field, NumberInput, TextInput, Select, Callout, ChipToggle, TriToggle,
} from '../components/ui'

/** The three that carry the decision. */
const QUESTIONS = [
  { key: 'weather', label: 'Is the market weather right for this?',
    hint: 'Bullish for longs. In chop, only the very best; in a downtrend, nothing.' },
  { key: 'leader', label: 'Is it a genuine leader?',
    hint: 'Strong relative strength, near highs, enough ADR and volume, leading group.' },
  { key: 'tight', label: 'Is it tight right at the moving average?',
    hint: 'Two or more quiet days against a rising 10 or 20 day MA. This is what makes the stop cheap.' },
] as const

/** Six states, not seventeen. These are the ones that precede rule breaks. */
const QUICK_EMOTIONS: Emotion[] = ['Calm', 'Confident', 'Impatient', 'FOMO', 'Frustrated', 'Greedy']
const RISKY: Emotion[] = ['Impatient', 'FOMO', 'Frustrated', 'Greedy']

export default function SimpleGate() {
  const navigate = useNavigate()
  const plan = useLiveQuery(() => db.plan.get('plan'), [])
  const log = useLiveQuery(() => db.logs.get(today()), [])
  const allTrades = useLiveQuery(() => db.trades.toArray(), []) ?? []

  const [ticker, setTicker] = useState('')
  const [setupType, setSetupType] = useState<SetupType>('Breakout — Tight Consolidation')
  const [entry, setEntry] = useState<number | undefined>()
  const [stop, setStop] = useState<number | undefined>()
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({})
  const [feeling, setFeeling] = useState<Emotion[]>([])
  const [sizePct, setSizePct] = useState<number | undefined>()
  const [saved, setSaved] = useState<string | null>(null)

  const equity = plan?.currentEquity ?? 0
  const cap = plan ? weatherSizeCap(log?.weather, plan) : 0
  const effectivePct = sizePct ?? (plan ? (cap || plan.standardPositionPct) : 10)

  const size = useMemo(
    () => plan && entry && stop
      ? calcSize(entry, stop, equity, effectivePct, plan.maxRiskPerTradePct)
      : null,
    [entry, stop, equity, effectivePct, plan],
  )

  const breakers = plan
    ? evaluateBreakers({
        plan, log,
        todaysTrades: allTrades.filter((t) => t.entryDate === today()),
        openTrades: allTrades.filter((t) => t.status === 'OPEN'),
      })
    : []
  const blocking = breakers.filter((b) => b.tripped && b.severity === 'block')

  const answered = QUESTIONS.filter((q) => answers[q.key] != null).length
  const allYes = QUESTIONS.every((q) => answers[q.key] === true)
  const anyNo = QUESTIONS.some((q) => answers[q.key] === false)
  const riskOk = size?.withinRiskLimit ?? false
  const risky = feeling.filter((e) => RISKY.includes(e))

  const go = allYes && riskOk && blocking.length === 0 && !!ticker.trim()

  if (!plan) return <p className="muted">Loading…</p>

  async function commit(asTrade: boolean) {
    if (!plan) return
    await getOrCreateLog(today())
    const t: Trade = {
      ...newTrade(),
      ticker: ticker.trim().toUpperCase(),
      setupType,
      plannedEntry: entry ?? 0,
      plannedStop: stop ?? 0,
      plannedShares: size?.shares ?? 0,
      // The three answers map onto the core checklist keys, so a trade logged
      // here grades and reports exactly like one logged the long way.
      checklist: {
        weather: answers.weather === true,
        leader: answers.leader === true,
        tightVisual: answers.tight === true,
        tightQuant: answers.tight === true,
        pole: answers.tight === true,
        orderly: answers.tight === true,
        maSupport: answers.tight === true,
        volContraction: answers.tight === true,
        pivotClear: true,
        stopClear: true,
        riskOk,
      },
      grade: allYes && riskOk ? 'A+' : 'NO-TRADE',
      checklistCompletedAt: nowIso(),
      status: 'PLANNED',
      weatherAtEntry: log?.weather,
      equityAtEntry: equity,
      emotionBefore: feeling,
      notes: asTrade ? undefined : 'Passed at the gate — logged as a discipline win.',
    }
    await saveTrade(t)
    setSaved(t.id)
    setTicker(''); setEntry(undefined); setStop(undefined)
    setAnswers({}); setFeeling([]); setSizePct(undefined)
  }

  return (
    <>
      <div className="page-head">
        <h1>Check a trade</h1>
        <p>Three questions and a stop. If any answer is no, there is no trade.</p>
      </div>

      {saved ? (
        <Callout tone="good" title="Logged">
          <button className="btn btn-sm" onClick={() => navigate(`/trades/${saved}`)}>Open it</button>{' '}
          <button className="btn btn-sm btn-ghost" onClick={() => setSaved(null)}>Check another</button>
        </Callout>
      ) : null}

      {blocking.map((b) => (
        <Callout key={b.id} tone="bad" title={b.label} icon="✕">{b.detail}</Callout>
      ))}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <div className="grid grid-2">
            <Field label="Ticker">
              <TextInput value={ticker} placeholder="NVDA" autoFocus
                onChange={(e) => setTicker(e.target.value.toUpperCase())} />
            </Field>
            <Field label="Setup">
              <Select value={setupType} onChange={(e) => setSetupType(e.target.value as SetupType)}>
                {SETUP_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>

          <hr className="divider" />

          {QUESTIONS.map((q) => (
            <div key={q.key} style={{ padding: '10px 0', borderBottom: '1px solid var(--grid)' }}>
              <div className="row-between" style={{ gap: 14 }}>
                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{q.label}</div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{q.hint}</div>
                </div>
                <TriToggle value={answers[q.key] ?? null}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))} />
              </div>
            </div>
          ))}

          <div style={{ marginTop: 16 }}>
            <div className="field-label">How do you feel right now? <span className="muted">(optional)</span></div>
            <div className="chip-row">
              {QUICK_EMOTIONS.map((e) => (
                <ChipToggle key={e} on={feeling.includes(e)} flag={RISKY.includes(e)}
                  onClick={() => setFeeling((f) =>
                    f.includes(e) ? f.filter((x) => x !== e) : [...f, e])}>
                  {e}
                </ChipToggle>
              ))}
            </div>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <div className="card-head"><h2>Entry and stop</h2></div>
            <div className="grid grid-3">
              <Field label="Entry">
                <NumberInput value={entry} onValue={setEntry} step={0.01} />
              </Field>
              <Field label="Stop">
                <NumberInput value={stop} onValue={setStop} step={0.01} />
              </Field>
              <Field label="Size %">
                <NumberInput value={effectivePct} onValue={setSizePct} step={1}
                  min={0} max={plan.maxPositionPct} />
              </Field>
            </div>

            {size && size.shares > 0 ? (
              <>
                <div className="row" style={{ gap: 22, marginTop: 4 }}>
                  <div>
                    <div className="stat-label">Buy</div>
                    <div className="stat-value sm num">{size.shares.toLocaleString()}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {money(size.positionValue, plan.currency)}
                    </div>
                  </div>
                  <div>
                    <div className="stat-label">Risking</div>
                    <div className={`stat-value sm ${riskOk ? 'good' : 'bad'}`}>
                      {pct(size.riskPct, 2)}
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {money(size.riskDollars, plan.currency)}
                    </div>
                  </div>
                </div>
                {!riskOk ? (
                  <div style={{ marginTop: 10 }}>
                    <Callout tone="bad">{size.message}</Callout>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
                Enter both and the share count is worked out for you.
              </p>
            )}
          </Card>

          <div className={`verdict ${go ? 'verdict-go' : anyNo || (size && !riskOk) ? 'verdict-stop' : 'verdict-caution'}`}>
            <div className="verdict-grade">{go ? 'TAKE IT' : anyNo || (size && !riskOk) ? 'NO' : '—'}</div>
            <div className="verdict-text">
              {go
                ? 'All three yes and the risk fits. Execute without hesitating.'
                : anyNo
                  ? 'One of the three is a no. That is the whole answer — log the pass and move on.'
                  : size && !riskOk
                    ? 'The stop is too far for this size. The chart is not tight enough.'
                    : `${answered} of 3 answered.`}
            </div>
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!go}
              onClick={() => commit(true)}>
              Take it
            </button>
            <button className="btn" disabled={!ticker.trim()} onClick={() => commit(false)}>
              Log the pass
            </button>
          </div>

          {risky.length ? (
            <Callout tone="warn" title={`${risky.join(', ')} — the state that breaks rules`}>
              If it is genuinely A+, it will still be A+ in sixty seconds. Take them.
            </Callout>
          ) : null}

          {log?.weather ? (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Weather is <b>{log.weather}</b> — {WEATHER_PLAYBOOK[log.weather].sizing.toLowerCase()}.
            </p>
          ) : (
            <p className="warn" style={{ fontSize: 12, margin: 0 }}>
              You have not set today's weather. Two taps on the Today screen.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
