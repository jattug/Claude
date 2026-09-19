/**
 * Charts.
 *
 * Palette: the validated default data-viz categorical slots 1-3 (blue, orange,
 * aqua) — all six checks pass in both light and dark. Diverging work uses the
 * blue <-> red pair with a gray midpoint. Status colors are reserved and always
 * ship beside a label. Never a dual axis; a legend whenever there are two or
 * more series; hairline grid; direct labels only on endpoints and extremes.
 */
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell, LabelList,
} from 'recharts'
import type { ReactNode } from 'react'
import type { EquityPoint, CompliancePoint, RBucket, DeviationStat, Segment } from '../lib/metrics'
import { money, pct, rMult } from '../lib/format'

// Read the resolved token so charts follow the theme toggle and the OS setting.
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

const AXIS_TICK = { fontSize: 11, fill: 'var(--text-muted)' }

/**
 * Clear space reserved to the left of a horizontal bar chart's plot area, so a
 * negative bar's value label has somewhere to sit without landing on top of the
 * category labels. The y-axis band is widened by the same amount and its tick
 * text pushed left, which keeps the gutter empty.
 */
const LABEL_GUTTER = 46

/** Keep a category label inside its band; the tooltip carries the full text. */
function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

export function ChartCard({ title, sub, children, footer }: {
  title: string; sub?: string; children: ReactNode; footer?: ReactNode
}) {
  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {sub ? <div className="chart-sub">{sub}</div> : null}
      <div className="chart-body">{children}</div>
      {footer}
    </div>
  )
}

export function Legend({ items }: { items: { color: string; label: string; block?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span className="legend-item" key={i.label}>
          <span className={`legend-swatch ${i.block ? 'block' : ''}`} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}


/**
 * Value label for a horizontal bar, placed just beyond the bar's far end.
 * `position="right"` puts a negative bar's label on its left edge, where it
 * collides with the category axis labels — this places it by sign instead.
 */
function barValueLabel(format: (v: number) => string) {
  return (props: {
    x?: number | string; y?: number | string
    width?: number | string; height?: number | string; value?: number | string
  }) => {
    const value = Number(props.value)
    if (!Number.isFinite(value)) return null
    const x = Number(props.x)
    const w = Number(props.width)
    const y = Number(props.y)
    const h = Number(props.height)
    // Recharts reports a bar spanning [x, x+w]; for negatives w can be signed.
    const left = Math.min(x, x + w)
    const right = Math.max(x, x + w)
    const negative = value < 0
    return (
      <text
        x={negative ? left - 6 : right + 6}
        y={y + h / 2}
        dominantBaseline="central"
        textAnchor={negative ? 'end' : 'start'}
        fontSize={11}
        fill="var(--text-secondary)"
      >
        {format(value)}
      </text>
    )
  }
}

function TipBox({ title, rows }: { title: string; rows: { k: string; v: string }[] }) {
  return (
    <div className="tooltip">
      <div className="tooltip-title">{title}</div>
      {rows.map((r) => (
        <div className="tooltip-row" key={r.k}><span>{r.k}</span><b>{r.v}</b></div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Equity: what happened, versus what would have happened without the rule breaks
// ---------------------------------------------------------------------------

export function EquityChart({ data, currency }: { data: EquityPoint[]; currency: string }) {
  if (data.length < 2) return <NoData>Close a few trades and the curve appears here.</NoData>
  const s1 = token('--series-1', '#2a78d6')
  const s2 = token('--series-2', '#eb6834')
  const last = data[data.length - 1]

  // Equity curves live in a narrow band; a zero baseline flattens them into one
  // line and hides the only thing this chart is for — the gap between them.
  const values = data.flatMap((p) => [p.actual, p.disciplined])
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const rawPad = Math.max((hi - lo) * 0.18, hi * 0.005)
  // Round the bounds outward to a clean step so the ticks are readable numbers.
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(rawPad, 1))))
  const lo0 = Math.floor((lo - rawPad) / step) * step
  const hi0 = Math.ceil((hi + rawPad) / step) * step

  return (
    <>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--axis)' }}
            tickFormatter={(d: string) => d.slice(5)} minTickGap={28} />
          <YAxis domain={[lo0, hi0]} tick={AXIS_TICK} tickLine={false} axisLine={false}
            width={66} tickFormatter={(v: number) => money(v, currency)} />
          <Tooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as EquityPoint
            return <TipBox title={`${label} · ${p.label}`} rows={[
              { k: 'Actual', v: money(p.actual, currency) },
              { k: 'Rules only', v: money(p.disciplined, currency) },
              { k: 'Gap', v: money(p.disciplined - p.actual, currency) },
            ]} />
          }} />
          <Line type="monotone" dataKey="disciplined" stroke={s2} strokeWidth={2} dot={false}
            name="If you had only taken the compliant trades" />
          <Line type="monotone" dataKey="actual" stroke={s1} strokeWidth={2} dot={false}
            name="Actual equity" />
        </LineChart>
      </ResponsiveContainer>
      {/* End values sit in the legend rather than on the plot: the two lines run
          close together, so floating labels would overlap each other. */}
      <Legend items={[
        { color: s1, label: `Actual equity · ${money(last.actual, currency)}` },
        { color: s2, label: `Compliant trades only · ${money(last.disciplined, currency)}` },
      ]} />
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0' }}>
        {last.disciplined > last.actual
          ? <>Sticking to your own rules would have left you <b>{money(last.disciplined - last.actual, currency)}</b> better off.</>
          : last.disciplined < last.actual
            ? <>Your rule breaks are currently <b>{money(last.actual - last.disciplined, currency)}</b> ahead — which is luck, not method, and it reverses.</>
            : <>No gap yet: every closed trade followed the plan.</>}
      </p>
    </>
  )
}

// ---------------------------------------------------------------------------
// Compliance over time — one series, so no legend box; the title names it
// ---------------------------------------------------------------------------

export function ComplianceChart({ data, target = 95 }: { data: CompliancePoint[]; target?: number }) {
  if (data.length < 2) return <NoData>Audit a few closed trades to build this trend.</NoData>
  const s1 = token('--series-1', '#2a78d6')
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--axis)' }}
          tickFormatter={(d: string) => d.slice(5)} minTickGap={28} />
        <YAxis domain={[0, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40}
          tickFormatter={(v: number) => `${v}%`} />
        <ReferenceLine y={target} stroke="var(--axis)" strokeWidth={1}
          label={{ value: `target ${target}%`, position: 'insideTopRight', fontSize: 10, fill: 'var(--text-muted)' }} />
        <Tooltip content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null
          const p = payload[0].payload as CompliancePoint
          return <TipBox title={String(label)} rows={[
            { k: 'That day', v: pct(p.rate, 0) },
            { k: 'Rolling 10', v: p.rolling == null ? '—' : pct(p.rolling, 0) },
            { k: 'Trades', v: String(p.trades) },
          ]} />
        }} />
        <Line type="monotone" dataKey="rolling" stroke={s1} strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// R distribution — diverging by sign (blue positive / red negative, gray zero)
// ---------------------------------------------------------------------------

export function RDistributionChart({ data }: { data: RBucket[] }) {
  const total = data.reduce((s, b) => s + b.count, 0)
  if (!total) return <NoData>No closed trades with an R value yet.</NoData>
  const pos = token('--series-1', '#2a78d6')
  const neg = token('--critical', '#d03b3b')
  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }} barCategoryGap="18%">
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 10 }} tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }} interval={0} angle={-38} textAnchor="end" height={54} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as RBucket
            return <TipBox title={p.label} rows={[
              { k: 'Trades', v: String(p.count) },
              { k: 'Share', v: pct((p.count / total) * 100, 0) },
            ]} />
          }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((b) => <Cell key={b.label} fill={b.lower < 0 ? neg : pos} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <Legend items={[
        { color: neg, label: 'Losing trades', block: true },
        { color: pos, label: 'Winning trades', block: true },
      ]} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Deviation leaderboard — one measure, horizontal bars, labels always visible
// ---------------------------------------------------------------------------

export function DeviationChart({ data, currency }: { data: DeviationStat[]; currency: string }) {
  if (!data.length) {
    return <NoData>No logged rule breaks. Either you are executing cleanly, or the audits are not being filled in honestly.</NoData>
  }
  const rows = data.slice(0, 8)
  const height = Math.max(160, rows.length * 34 + 40)
  const neg = token('--critical', '#d03b3b')
  const pos = token('--series-3', '#1baf7a')
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 62, bottom: 4, left: 4 }} barCategoryGap="22%">
        <CartesianGrid stroke="var(--grid)" horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false}
          tickFormatter={(v: number) => money(v, currency)} />
        <YAxis type="category" dataKey="deviation" width={182 + LABEL_GUTTER} tickMargin={LABEL_GUTTER}
          tick={{ ...AXIS_TICK, fontSize: 11 }} tickLine={false} axisLine={false}
          tickFormatter={(v: string) => truncate(v, 28)} />
        <ReferenceLine x={0} stroke="var(--axis)" />
        <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          const p = payload[0].payload as DeviationStat
          return <TipBox title={p.deviation} rows={[
            { k: 'Occurrences', v: String(p.count) },
            { k: 'Total P&L', v: money(p.totalPnl, currency) },
            { k: 'Avg outcome', v: rMult(p.avgR) },
          ]} />
        }} />
        <Bar dataKey="totalPnl" radius={4}>
          {rows.map((d) => <Cell key={d.deviation} fill={d.totalPnl < 0 ? neg : pos} />)}
          <LabelList dataKey="totalPnl" content={barValueLabel((v) => money(v, currency))} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Segment bars — avg R by any dimension. One measure, one color, zero line.
// ---------------------------------------------------------------------------

export function SegmentChart({ data, metric = 'avgR', emptyText }: {
  data: Segment[]
  metric?: 'avgR' | 'totalR'
  emptyText?: string
}) {
  if (!data.length) return <NoData>{emptyText ?? 'Not enough trades in this slice yet.'}</NoData>
  const rows = data.slice(0, 10)
  const height = Math.max(150, rows.length * 32 + 36)
  const pos = token('--series-1', '#2a78d6')
  const neg = token('--critical', '#d03b3b')
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barCategoryGap="22%">
        <CartesianGrid stroke="var(--grid)" horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false}
          tickFormatter={(v: number) => `${v.toFixed(1)}R`} />
        <YAxis type="category" dataKey="key" width={158 + LABEL_GUTTER} tickMargin={LABEL_GUTTER}
          tick={{ ...AXIS_TICK, fontSize: 11 }} tickLine={false} axisLine={false}
          tickFormatter={(v: string) => truncate(v, 24)} />
        <ReferenceLine x={0} stroke="var(--axis)" />
        <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          const p = payload[0].payload as Segment
          return <TipBox title={p.key} rows={[
            { k: 'Trades', v: String(p.trades) },
            { k: 'Avg R', v: rMult(p.avgR) },
            { k: 'Total R', v: rMult(p.totalR) },
            { k: 'Win rate', v: pct(p.winRate, 0) },
            { k: 'Compliance', v: p.complianceRate == null ? '—' : pct(p.complianceRate, 0) },
          ]} />
        }} />
        <Bar dataKey={metric} radius={4}>
          {rows.map((d) => <Cell key={d.key} fill={d[metric] < 0 ? neg : pos} />)}
          <LabelList dataKey={metric} content={barValueLabel((v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}R`)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function NoData({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)',
      fontSize: 12.5, lineHeight: 1.5,
    }}>
      {children}
    </div>
  )
}
