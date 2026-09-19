export function money(n: number | null | undefined, currency = 'USD'): string {
  if (n == null || Number.isNaN(n)) return '—'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''
  // Whole units everywhere: cents in a P&L column are noise, and ragged
  // decimals make a table of numbers harder to scan.
  const body = Math.round(abs).toLocaleString()
  return `${sign}${sym}${body}${sym ? '' : ' ' + currency}`
}

export function signedMoney(n: number | null | undefined, currency = 'USD'): string {
  if (n == null || Number.isNaN(n)) return '—'
  return (n > 0 ? '+' : '') + money(n, currency)
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${n.toFixed(digits)}%`
}

export function rMult(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}R`
}

export function num(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function shortDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function longDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/** Monday-anchored week end (Friday) used for the weekly audit key. */
export function weekEndingOf(dateIso: string): string {
  const d = new Date(dateIso + 'T12:00:00')
  const dow = d.getDay()
  const delta = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function toneFor(value: number | null, goodAt: number, warnAt: number): 'good' | 'warn' | 'bad' | 'muted' {
  if (value == null) return 'muted'
  if (value >= goodAt) return 'good'
  if (value >= warnAt) return 'warn'
  return 'bad'
}
