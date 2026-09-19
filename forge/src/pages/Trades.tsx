import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Trade } from '../types'
import { isCompliant, quadrantOf, QUADRANT_META } from '../lib/rules'
import { rMult, shortDate, signedMoney } from '../lib/format'
import { Card, Badge, Empty, Segmented, TextInput } from '../components/ui'

type Filter = 'all' | 'open' | 'planned' | 'closed' | 'unaudited' | 'violations'

export default function Trades() {
  const navigate = useNavigate()
  const plan = useLiveQuery(() => db.plan.get('plan'), [])
  const trades = useLiveQuery(() => db.trades.toArray(), []) ?? []
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    let list = [...trades]
    if (filter === 'open') list = list.filter((t) => t.status === 'OPEN')
    if (filter === 'planned') list = list.filter((t) => t.status === 'PLANNED')
    if (filter === 'closed') list = list.filter((t) => t.status === 'CLOSED')
    if (filter === 'unaudited') list = list.filter((t) => t.status === 'CLOSED' && isCompliant(t) === null)
    if (filter === 'violations') list = list.filter((t) => isCompliant(t) === false)
    if (q.trim()) {
      const needle = q.trim().toUpperCase()
      list = list.filter((t) =>
        t.ticker.includes(needle) || t.setupType.toUpperCase().includes(needle) ||
        (t.sector ?? '').toUpperCase().includes(needle))
    }
    return list.sort((a, b) =>
      (b.entryDate ?? b.createdAt).localeCompare(a.entryDate ?? a.createdAt))
  }, [trades, filter, q])

  const unaudited = trades.filter((t) => t.status === 'CLOSED' && isCompliant(t) === null).length
  const currency = plan?.currency ?? 'USD'

  return (
    <>
      <div className="page-head">
        <div className="row-between">
          <h1>Trade Journal</h1>
          <Link to="/gate" className="btn btn-primary">New candidate</Link>
        </div>
        <p>Every trade, including the ones you passed on. The pass is as much a record as the fill.</p>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <Segmented<Filter>
          value={filter} onChange={setFilter}
          options={[
            { id: 'all', label: `All ${trades.length}` },
            { id: 'planned', label: 'Armed' },
            { id: 'open', label: 'Open' },
            { id: 'closed', label: 'Closed' },
            { id: 'unaudited', label: `Needs audit${unaudited ? ` (${unaudited})` : ''}` },
            { id: 'violations', label: 'Rule breaks' },
          ]}
        />
        <div style={{ flex: '1 1 180px', maxWidth: 260 }}>
          <TextInput value={q} placeholder="Search ticker, setup, sector"
            onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty title="Nothing here yet"
          action={<Link to="/gate" className="btn btn-primary">Run a candidate through the gate</Link>}>
          {trades.length
            ? 'No trades match this filter.'
            : 'Your journal is empty. Start with a candidate — even one you end up rejecting.'}
        </Empty>
      ) : (
        <Card>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Ticker</th><th>Setup</th><th>Grade</th>
                  <th>Status</th><th className="num">R</th><th className="num">P&amp;L</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => <Row key={t.id} t={t} currency={currency}
                  onClick={() => navigate(`/trades/${t.id}`)} />)}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

function Row({ t, currency, onClick }: { t: Trade; currency: string; onClick: () => void }) {
  const compliant = isCompliant(t)
  const quad = quadrantOf(t)
  const meta = quad ? QUADRANT_META[quad] : null

  return (
    <tr className="clickable" onClick={onClick}>
      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{shortDate(t.entryDate ?? t.createdAt)}</td>
      <td><b>{t.ticker || '—'}</b>{t.direction === 'SHORT' ? <span className="muted"> S</span> : null}</td>
      <td style={{ fontSize: 12.5, maxWidth: 190 }}>{t.setupType}</td>
      <td>
        <Badge tone={t.grade === 'A+' ? 'good' : t.grade === 'NO-TRADE' ? 'bad' : 'warn'}>{t.grade}</Badge>
      </td>
      <td>
        <Badge tone={t.status === 'OPEN' ? 'accent' : t.status === 'PLANNED' ? 'neutral' : 'neutral'}>
          {t.status === 'PLANNED' ? 'Armed' : t.status === 'OPEN' ? 'Open' : 'Closed'}
        </Badge>
      </td>
      <td className="num">
        {t.rMultiple != null
          ? <span className={t.rMultiple > 0 ? 'good' : 'bad'}>{rMult(t.rMultiple)}</span>
          : <span className="muted">—</span>}
      </td>
      <td className="num">
        {t.pnl != null
          ? <span className={t.pnl > 0 ? 'good' : 'bad'}>{signedMoney(t.pnl, currency)}</span>
          : <span className="muted">—</span>}
      </td>
      <td>
        {meta ? (
          <Badge tone={meta.tone === 'good' ? 'good' : meta.tone === 'warning' ? 'warn' : 'bad'}>
            {meta.tone === 'good' ? '✓' : meta.tone === 'warning' ? '!' : '✕'} {meta.label}
          </Badge>
        ) : t.status === 'CLOSED' && compliant === null ? (
          <Badge tone="warn">! Needs audit</Badge>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
    </tr>
  )
}
