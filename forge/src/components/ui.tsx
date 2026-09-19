import type {
  ReactNode, CSSProperties, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes,
} from 'react'

export function Card({ children, className = '', style }: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return <div className={`card ${className}`} style={style}>{children}</div>
}

export function Stat({ label, value, note, tone = 'default', size = 'lg' }: {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'muted'
  size?: 'lg' | 'sm'
}) {
  const cls = tone === 'default' ? '' : tone
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${size === 'sm' ? 'sm' : ''} ${cls}`}>{value}</div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  )
}

export function Callout({ tone, title, children, icon }: {
  tone: 'good' | 'warn' | 'bad' | 'info'
  title?: string
  children: ReactNode
  icon?: string
}) {
  const fallback = tone === 'good' ? '✓' : tone === 'warn' ? '!' : tone === 'bad' ? '✕' : 'i'
  return (
    <div className={`callout callout-${tone}`}>
      <span className="callout-icon" aria-hidden="true">{icon ?? fallback}</span>
      <div className="callout-body">
        {title ? <div className="callout-title">{title}</div> : null}
        <div>{children}</div>
      </div>
    </div>
  )
}

export function Badge({ tone = 'neutral', children }: {
  tone?: 'good' | 'warn' | 'bad' | 'neutral' | 'accent'
  children: ReactNode
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>
        <span className="field-label">{label}</span>
        {children}
      </label>
      {hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...props} />
}

export function NumberInput({ value, onValue, ...rest }: {
  value: number | undefined | null
  onValue: (n: number | undefined) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={(e) => onValue(e.target.value === '' ? undefined : Number(e.target.value))}
      {...rest}
    />
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />
}

export function Select({ children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest}>{children}</select>
}

export function ChipToggle({ on, onClick, children, flag = false }: {
  on: boolean
  onClick: () => void
  children: ReactNode
  flag?: boolean
}) {
  return (
    <button
      type="button"
      className={`chip ${on ? 'on' : ''} ${flag ? 'flag' : ''}`}
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function Meter({ value, tone }: { value: number; tone?: 'good' | 'warn' | 'bad' }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="meter" role="meter" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`meter-fill ${tone ?? ''}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  )
}

export function Quote({ children, source }: { children: ReactNode; source: string }) {
  return (
    <blockquote className="quote">
      {children}
      <cite>— {source}</cite>
    </blockquote>
  )
}

export function Tabs<T extends string>({ tabs, active, onChange }: {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`tab ${active === t.id ? 'on' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button
          key={o.id}
          className={value === o.id ? 'on' : ''}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false }: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ marginBottom: 14 }}>
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Yes / No / unanswered. Used for the process audit, where "unanswered" matters. */
export function TriToggle({ value, onChange, yesLabel = 'Yes', noLabel = 'No' }: {
  value: boolean | null | undefined
  onChange: (v: boolean | null) => void
  yesLabel?: string
  noLabel?: string
}) {
  return (
    <div className="seg">
      <button className={value === true ? 'on' : ''} onClick={() => onChange(value === true ? null : true)}>
        {yesLabel}
      </button>
      <button className={value === false ? 'on' : ''} onClick={() => onChange(value === false ? null : false)}>
        {noLabel}
      </button>
    </div>
  )
}
