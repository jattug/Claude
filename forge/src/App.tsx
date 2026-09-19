import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getPlan, today } from './db'
import { evaluateBreakers } from './lib/rules'
import Dashboard from './pages/Dashboard'
import PreTradeGate from './pages/PreTradeGate'
import OpenPositions from './pages/OpenPositions'
import Trades from './pages/Trades'
import TradeDetail from './pages/TradeDetail'
import DailyLogPage from './pages/DailyLogPage'
import Analytics from './pages/Analytics'
import WeeklyAuditPage from './pages/WeeklyAuditPage'
import Rulebook from './pages/Rulebook'
import Principles from './pages/Principles'

type Theme = 'light' | 'dark' | 'system'

const NAV = [
  {
    group: 'Today',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: '◎' },
      { to: '/gate', label: 'Pre-Trade Gate', icon: '⊘' },
      { to: '/positions', label: 'Open Positions', icon: '▤' },
      { to: '/daily', label: 'Daily Log', icon: '☀' },
    ],
  },
  {
    group: 'Record',
    items: [
      { to: '/trades', label: 'Trade Journal', icon: '≡' },
      { to: '/analytics', label: 'Analytics', icon: '◱' },
      { to: '/weekly', label: 'Weekly Audit', icon: '◷' },
    ],
  },
  {
    group: 'System',
    items: [
      { to: '/rulebook', label: 'Rulebook', icon: '§' },
      { to: '/principles', label: 'Principles', icon: '✦' },
    ],
  },
]

export default function App() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('forge-theme') as Theme) ?? 'system',
  )
  const location = useLocation()

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('forge-theme', theme)
  }, [theme])

  // Make sure a plan row exists before any page reads it.
  useEffect(() => { void getPlan() }, [])

  const plan = useLiveQuery(() => db.plan.get('plan'), [])
  const trades = useLiveQuery(() => db.trades.toArray(), []) ?? []
  const log = useLiveQuery(() => db.logs.get(today()), [location.pathname])

  const openTrades = trades.filter((t) => t.status === 'OPEN')
  const plannedTrades = trades.filter((t) => t.status === 'PLANNED')
  const todaysTrades = trades.filter((t) => t.entryDate === today())

  const breakers = plan
    ? evaluateBreakers({ plan, log, todaysTrades, openTrades })
    : []
  const blocked = breakers.filter((b) => b.tripped && b.severity === 'block').length

  const badges: Record<string, { count: number; muted?: boolean }> = {
    '/positions': { count: openTrades.length, muted: true },
    '/gate': { count: plannedTrades.length, muted: true },
    '/dashboard': { count: blocked },
  }

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <div className="brand-name">FORGE</div>
          <div className="brand-sub">Process first.<br />P&amp;L is the byproduct.</div>
        </div>
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group-label">{g.group}</div>
            {g.items.map((i) => {
              const b = badges[i.to]
              return (
                <NavLink key={i.to} to={i.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <span className="nav-icon" aria-hidden="true">{i.icon}</span>
                  {i.label}
                  {b && b.count > 0 ? (
                    <span className={`nav-badge ${b.muted ? 'muted' : ''}`}>{b.count}</span>
                  ) : null}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="main">
        <header className="topbar">
          <strong style={{ fontSize: 15 }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </strong>
          {log?.weather ? (
            <span className={`badge badge-${log.weather === 'BULLISH' ? 'good' : log.weather === 'CAUTION' ? 'warn' : 'bad'}`}>
              {log.weather === 'BULLISH' ? '▲' : log.weather === 'CAUTION' ? '◆' : '▼'} {log.weather}
            </span>
          ) : (
            <span className="badge badge-neutral">Weather not set</span>
          )}
          {blocked > 0 ? (
            <span className="badge badge-bad">✕ {blocked} breaker{blocked > 1 ? 's' : ''} tripped</span>
          ) : null}
          <div className="topbar-spacer" />
          <div className="seg">
            {(['light', 'system', 'dark'] as Theme[]).map((t) => (
              <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}
                aria-pressed={theme === t} title={`${t} theme`}>
                {t === 'light' ? '☀' : t === 'dark' ? '☾' : 'Auto'}
              </button>
            ))}
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Sections">
          {NAV.flatMap((g) => g.items).map((i) => (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              {i.label}
            </NavLink>
          ))}
        </nav>

        <main className="page">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/gate" element={<PreTradeGate />} />
            <Route path="/gate/:id" element={<PreTradeGate />} />
            <Route path="/positions" element={<OpenPositions />} />
            <Route path="/daily" element={<DailyLogPage />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/trades/:id" element={<TradeDetail />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/weekly" element={<WeeklyAuditPage />} />
            <Route path="/rulebook" element={<Rulebook />} />
            <Route path="/principles" element={<Principles />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
