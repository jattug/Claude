/**
 * The Pre-Trade Gate (Ch.8, Ch.9, Ch.11, Ch.17).
 *
 * This screen exists to slow you down. You cannot arm a trade without walking
 * the checklist, and the app will tell you plainly when the answer is no. The
 * friction IS the feature.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  A_PLUS_CHECKLIST, SETUP_TYPES, EMOTIONS, RED_FLAG_EMOTIONS,
  type Trade, type Emotion, type SetupType,
} from '../types'
import { db, newTrade, saveTrade, today, nowIso, getOrCreateLog } from '../db'
import {
  calcSize, gradeSetup, tightnessOk, tightRangeThresholdPct,
  evaluateBreakers, weatherSizeCap, WEATHER_PLAYBOOK,
} from '../lib/rules'
import { money, pct, num } from '../lib/format'
import {
  Card, Field, NumberInput, TextInput, Select, Callout, Badge,
  ChipToggle, Quote, TextArea,
} from '../components/ui'

export default function PreTradeGate() {
  const { id } = useParams()
  const navigate = useNavigate()
  const plan = useLiveQuery(() => db.plan.get('plan'), [])
  const log = useLiveQuery(() => db.logs.get(today()), [])
  const allTrades = useLiveQuery(() => db.trades.toArray(), []) ?? []
  const existing = useLiveQuery(() => (id ? db.trades.get(id) : undefined), [id])

  const [draft, setDraft] = useState<Trade>(() => newTrade())
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => { if (existing) setDraft(existing) }, [existing])

  const set = <K extends keyof Trade>(k: K, v: Trade[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const toggleCheck = (key: string) =>
    setDraft((d) => ({ ...d, checklist: { ...d.checklist, [key]: !d.checklist[key] } }))

  const toggleEmotion = (e: Emotion) =>
    setDraft((d) => ({
      ...d,
      emotionBefore: d.emotionBefore.includes(e)
        ? d.emotionBefore.filter((x) => x !== e)
        : [...d.emotionBefore, e],
    }))

  const equity = plan?.currentEquity ?? 0
  const weatherCap = plan ? weatherSizeCap(log?.weather, plan) : 0
  const [sizePct, setSizePct] = useState<number | undefined>(undefined)
  const effectiveSizePct = sizePct ?? (plan ? Math.min(plan.standardPositionPct, weatherCap || plan.standardPositionPct) : 10)

  const size = useMemo(
    () => plan
      ? calcSize(draft.plannedEntry, draft.plannedStop, equity, effectiveSizePct, plan.maxRiskPerTradePct)
      : null,
    [draft.plannedEntry, draft.plannedStop, equity, effectiveSizePct, plan],
  )

  // The computed criteria are derived, not trusted to a tickbox.
  const tightOk = plan ? tightnessOk(draft.tightDays, plan) : false
  const riskOk = size?.withinRiskLimit ?? false
  const leaderOk = !!plan
    && (draft.rsRating ?? 0) >= plan.minRsRating
    && (draft.adrPct ?? 0) >= plan.minAdrPct
    && (draft.dollarVolume ?? 0) >= plan.minDollarVolume

  const effectiveChecklist: Record<string, boolean> = {
    ...draft.checklist,
    tightQuant: tightOk,
    riskOk,
    leader: leaderOk,
    weather: log?.weather === 'BULLISH' || (log?.weather === 'CAUTION' && !!draft.checklist.weather),
  }
  const g = gradeSetup(effectiveChecklist)

  const breakers = plan
    ? evaluateBreakers({
        plan, log,
        todaysTrades: allTrades.filter((t) => t.entryDate === today()),
        openTrades: allTrades.filter((t) => t.status === 'OPEN'),
      })
    : []
  const blocking = breakers.filter((b) => b.tripped && b.severity === 'block')
  const warnings = breakers.filter((b) => b.tripped && b.severity === 'warn')

  const redFlagEmotions = draft.emotionBefore.filter((e) => RED_FLAG_EMOTIONS.includes(e))
  const canArm = g.grade !== 'NO-TRADE' && blocking.length === 0 && !!draft.ticker.trim()

  const thresholdPct = plan ? tightRangeThresholdPct(draft.adrPct, plan) : null

  async function arm() {
    if (!plan || !size) return
    await getOrCreateLog(today())
    const t: Trade = {
      ...draft,
      ticker: draft.ticker.trim().toUpperCase(),
      checklist: effectiveChecklist,
      grade: g.grade,
      plannedShares: size.shares,
      checklistCompletedAt: nowIso(),
      status: 'PLANNED',
      weatherAtEntry: log?.weather,
      equityAtEntry: equity,
    }
    await saveTrade(t)
    setSaved(t.id)
    setDraft(newTrade())
    setSizePct(undefined)
  }

  async function saveAsRejected() {
    if (!plan) return
    const t: Trade = {
      ...draft,
      ticker: draft.ticker.trim().toUpperCase(),
      checklist: effectiveChecklist,
      grade: g.grade,
      status: 'PLANNED',
      notes: [draft.notes, 'REJECTED AT THE GATE — logged as a discipline win.'].filter(Boolean).join('\n'),
      checklistCompletedAt: nowIso(),
    }
    await saveTrade(t)
    setSaved(t.id)
    setDraft(newTrade())
  }

  if (!plan) return <p className="muted">Loading your rulebook…</p>

  const grouped = A_PLUS_CHECKLIST.reduce<Record<string, typeof A_PLUS_CHECKLIST>>((acc, i) => {
    acc[i.group] = [...(acc[i.group] ?? []), i]
    return acc
  }, {})
  const computedKeys = new Set(['tightQuant', 'riskOk', 'leader'])

  return (
    <>
      <div className="page-head">
        <h1>Pre-Trade Gate</h1>
        <p>
          Nothing gets past this screen without meeting every core criterion. If it is not a clear
          yes, it is a no — and logging the no is worth as much as logging the trade.
        </p>
      </div>

      {saved ? (
        <Callout tone="good" title="Logged">
          Saved to the journal.{' '}
          <button className="btn btn-sm" onClick={() => navigate(`/trades/${saved}`)}>Open it</button>{' '}
          <button className="btn btn-sm btn-ghost" onClick={() => setSaved(null)}>Log another</button>
        </Callout>
      ) : null}

      {blocking.length ? (
        <Callout tone="bad" title="Your own rules say you are not trading right now">
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {blocking.map((b) => <li key={b.id}><b>{b.label}:</b> {b.detail}</li>)}
          </ul>
        </Callout>
      ) : null}
      {warnings.map((b) => (
        <Callout key={b.id} tone="warn" title={b.label}>{b.detail}</Callout>
      ))}
      {!log?.weather ? (
        <Callout tone="warn" title="You have not assessed the weather today">
          Ch.6 — the market regime decides whether this setup is even worth taking. Fill in the
          Daily Log before you look for entries.
        </Callout>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 14, alignItems: 'start' }}>
        <div className="stack">
          <Card>
            <div className="card-head"><h2>The candidate</h2></div>
            <div className="grid grid-2">
              <Field label="Ticker">
                <TextInput value={draft.ticker} placeholder="NVDA"
                  onChange={(e) => set('ticker', e.target.value.toUpperCase())} />
              </Field>
              <Field label="Direction">
                <Select value={draft.direction}
                  onChange={(e) => set('direction', e.target.value as Trade['direction'])}>
                  <option value="LONG">Long</option>
                  <option value="SHORT">Short</option>
                </Select>
              </Field>
            </div>
            <Field label="Setup">
              <Select value={draft.setupType} onChange={(e) => set('setupType', e.target.value as SetupType)}>
                {SETUP_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Sector / theme">
              <TextInput value={draft.sector ?? ''} placeholder="AI infrastructure"
                onChange={(e) => set('sector', e.target.value)} />
            </Field>
          </Card>

          <Card>
            <div className="card-head">
              <h2>Leader test</h2>
              {leaderOk
                ? <Badge tone="good">✓ Passes</Badge>
                : <Badge tone="bad">✕ Fails</Badge>}
            </div>
            <div className="card-sub">
              Ch.7 — half of a stock's move comes from its group, and the minority of names drive all
              the returns. These thresholds come from your rulebook, so the app checks them for you.
            </div>
            <div className="grid grid-2">
              <Field label={`RS rating (min ${plan.minRsRating})`}>
                <NumberInput value={draft.rsRating} onValue={(v) => set('rsRating', v)} min={0} max={99} />
              </Field>
              <Field label={`ADR % (min ${plan.minAdrPct}%)`}>
                <NumberInput value={draft.adrPct} onValue={(v) => set('adrPct', v)} step={0.1} min={0} />
              </Field>
              <Field label={`Avg $ volume (min ${money(plan.minDollarVolume)})`}>
                <NumberInput value={draft.dollarVolume} onValue={(v) => set('dollarVolume', v)} step={1000000} />
              </Field>
              <Field label="% below 52-week high">
                <NumberInput value={draft.pctFrom52wHigh} onValue={(v) => set('pctFrom52wHigh', v)} step={0.5} />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <h2>Tightness test</h2>
              {tightOk ? <Badge tone="good">✓ Tight enough</Badge> : <Badge tone="bad">✕ Not tight</Badge>}
            </div>
            <div className="card-sub">
              Ch.8 — this is the criterion that makes the whole risk model work. A genuinely tight
              chart puts a {plan.standardPositionPct}% position behind a stop that only costs you a
              fraction of a percent. Without it, standard size means real damage.
            </div>
            <div className="grid grid-2">
              <Field
                label={`Consecutive tight days (need ${plan.minTightDays}+)`}
                hint={thresholdPct
                  ? `A day counts as tight when its range is ≤ ${thresholdPct.toFixed(2)}% (that is ${plan.tightnessAdrFraction} × the ${draft.adrPct}% ADR).`
                  : 'Enter ADR above and this tells you the exact range that qualifies.'}
              >
                <NumberInput value={draft.tightDays} onValue={(v) => set('tightDays', v)} min={0} max={20} />
              </Field>
              <Field label="Base length (days)">
                <NumberInput value={draft.baseLengthDays} onValue={(v) => set('baseLengthDays', v)} min={0} />
              </Field>
              <Field label="Base depth %">
                <NumberInput value={draft.baseDepthPct} onValue={(v) => set('baseDepthPct', v)} step={0.5} />
              </Field>
              <Field label="Pole gain % (prior leg)">
                <NumberInput value={draft.poleGainPct} onValue={(v) => set('poleGainPct', v)} step={5} />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="card-head"><h2>Trigger, stop and size</h2></div>
            <div className="grid grid-3">
              <Field label="Entry trigger">
                <NumberInput value={draft.plannedEntry || undefined}
                  onValue={(v) => set('plannedEntry', v ?? 0)} step={0.01} />
              </Field>
              <Field label="Initial stop">
                <NumberInput value={draft.plannedStop || undefined}
                  onValue={(v) => set('plannedStop', v ?? 0)} step={0.01} />
              </Field>
              <Field label="Position size %"
                hint={weatherCap && weatherCap < plan.standardPositionPct
                  ? `Weather caps you at ${weatherCap}% today.` : undefined}>
                <NumberInput value={effectiveSizePct} onValue={(v) => setSizePct(v)} step={1} min={0}
                  max={plan.maxPositionPct} />
              </Field>
            </div>

            {size && size.shares > 0 ? (
              <>
                <div className="grid grid-4" style={{ marginTop: 6 }}>
                  <SmallStat label="Shares" value={size.shares.toLocaleString()} />
                  <SmallStat label="Position" value={money(size.positionValue, plan.currency)}
                    note={pct(size.positionPct)} />
                  <SmallStat label="Risk" value={money(size.riskDollars, plan.currency)}
                    note={`${num(size.riskPerShare)}/share`} />
                  <SmallStat label="% of equity at risk" value={pct(size.riskPct, 2)}
                    tone={size.withinRiskLimit ? 'good' : 'bad'} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <Callout tone={size.verdict === 'OK' ? 'good' : size.verdict === 'REDUCE_SIZE' ? 'warn' : 'bad'}>
                    {size.message}
                  </Callout>
                </div>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>
                Enter a trigger and a stop and the size is calculated for you. Ch.14 — never do this
                in your head.
              </p>
            )}
          </Card>

          <Card>
            <div className="card-head"><h2>State of mind</h2></div>
            <div className="card-sub">
              Ch.4 — naming the feeling before you click creates the gap where discipline lives.
              Answer honestly; nobody else sees this.
            </div>
            <div className="chip-row">
              {EMOTIONS.map((e) => (
                <ChipToggle key={e} on={draft.emotionBefore.includes(e)} onClick={() => toggleEmotion(e)}
                  flag={RED_FLAG_EMOTIONS.includes(e)}>
                  {e}
                </ChipToggle>
              ))}
            </div>
            {redFlagEmotions.length ? (
              <div style={{ marginTop: 12 }}>
                <Callout tone="warn" title={`${redFlagEmotions.join(', ')} — this is the state that breaks rules`}>
                  You are not disqualified from trading, but this is exactly the moment your journal
                  says things go wrong. Re-read the checklist. If the setup is genuinely A+, it will
                  still be A+ in sixty seconds.
                </Callout>
              </div>
            ) : null}
            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <Field label="Conviction (1-5)">
                <NumberInput value={draft.conviction} onValue={(v) => set('conviction', v)} min={1} max={5} />
              </Field>
              <Field label="What happened right before this?"
                hint="A win? A stop-out? A missed move? This is the cue half of the habit loop.">
                <TextInput value={draft.precedingContext ?? ''}
                  placeholder="Stopped out of AMD ten minutes ago"
                  onChange={(e) => set('precedingContext', e.target.value)} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="stack" style={{ position: 'sticky', top: 78 }}>
          <div className={`verdict ${g.grade === 'NO-TRADE' ? 'verdict-stop' : g.grade === 'A+' ? 'verdict-go' : 'verdict-caution'}`}>
            <div className="verdict-grade">{g.grade}</div>
            <div className="verdict-text">
              {g.grade === 'NO-TRADE' ? (
                <>
                  <b>{g.coreFailed.length} core criteri{g.coreFailed.length === 1 ? 'on' : 'a'} unmet.</b>
                  {' '}This one does not get in. Logging the rejection is a win — take it.
                </>
              ) : g.grade === 'A+' ? (
                <>Every criterion met. This is the trade you have been waiting for. Execute without hesitating.</>
              ) : (
                <>
                  Core criteria all met, {g.bonusFailed.length} bonus item{g.bonusFailed.length === 1 ? '' : 's'} missing.
                  Tradeable — but A+ is what you are building the habit around.
                </>
              )}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
              Core criteria met: <b className="num">{g.coreMet} / {g.coreTotal}</b>
            </div>
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" disabled={!canArm} onClick={arm} style={{ flex: 1 }}>
              Arm this trade
            </button>
            <button className="btn" onClick={saveAsRejected} disabled={!draft.ticker.trim()}>
              Log the pass
            </button>
          </div>
          {!canArm && draft.ticker.trim() ? (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              {blocking.length
                ? 'A circuit breaker is tripped. Arming is disabled until it clears.'
                : 'Arming stays disabled while a core criterion is unmet. That is the point.'}
            </p>
          ) : null}

          <Card>
            <div className="card-head"><h3>The checklist</h3></div>
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="check-group-label">{group}</div>
                {items.map((item) => {
                  const computed = computedKeys.has(item.key)
                  const checked = !!effectiveChecklist[item.key]
                  return (
                    <label key={item.key} className="check-row"
                      style={computed ? { cursor: 'default', opacity: 0.95 } : undefined}>
                      <input type="checkbox" checked={checked} disabled={computed}
                        onChange={() => !computed && toggleCheck(item.key)} />
                      <span className="check-text">
                        <span className="check-label">
                          {item.label}{' '}
                          {item.core ? <span className="check-core">CORE</span> : null}
                          {computed ? <span className="muted" style={{ fontSize: 11 }}> · auto</span> : null}
                        </span>
                        {item.hint ? <span className="check-hint">{item.hint}</span> : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            ))}
          </Card>

          {log?.weather ? (
            <Card>
              <div className="card-head">
                <h3>Today's weather</h3>
                <Badge tone={log.weather === 'BULLISH' ? 'good' : log.weather === 'CAUTION' ? 'warn' : 'bad'}>
                  {log.weather}
                </Badge>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0 }}>
                {WEATHER_PLAYBOOK[log.weather].detail}
              </p>
            </Card>
          ) : null}

          <Card>
            <Quote source="Qullamaggie">
              The money is not made trading, the money is made waiting. That's where the big money
              is — you have to wait for the big opportunities.
            </Quote>
          </Card>

          <Field label="Notes on this candidate">
            <TextArea value={draft.notes ?? ''} rows={3}
              placeholder="What makes this one worth the capital?"
              onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </div>
    </>
  )
}

function SmallStat({ label, value, note, tone }: {
  label: string; value: string; note?: string; tone?: 'good' | 'bad'
}) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className={`stat-value sm ${tone ?? ''}`}>{value}</div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  )
}
