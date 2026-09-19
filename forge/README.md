# Forge — a process-first swing trading journal

Built on the principles in *The Disciplined Swing Trader: Forging Consistency from Knowledge*
(Dani / @trades_lakes, drawing on Qullamaggie, peoplewish and realsimpleariel).

Most trading journals — TradeZella, Tradervue and the rest — are P&L analytics tools. They
answer *how much did I make?* That is not the question the book says is killing you. Its
central claim is that you already know the setups; what you lack is evidence about whether
you actually followed them. So Forge inverts the scoreboard:

> **A profitable trade taken against your rules is recorded as a mistake.
> A losing trade taken perfectly is recorded as a success.**

Everything else in the app follows from that.

---

## What it does that a P&L tracker doesn't

**1. Compliance is the headline number.** The biggest figure on the dashboard is your process
compliance rate, not your P&L. P&L is a secondary tile.

**2. Two equity curves.** Your actual equity, and the equity you would have had if the
non-compliant trades had simply not happened. The gap between them is the price of the habit,
in your own currency. It is the single most useful chart in the app.

**3. Four outcomes, not two.** Every closed trade lands in a quadrant:

| | Followed the rules | Broke the rules |
|---|---|---|
| **Won** | Process Success | **Lucky Win** — counted as a mistake |
| **Lost** | **Good Loss** — counted as a success | Process Failure |

A Lucky Win is flagged as the most expensive trade you can take, because it pays you for bad
behaviour and makes the next rule break easier.

**4. The gate actually blocks you.** The pre-trade checklist is not a form you fill in
afterwards. If a core criterion fails, the *Arm this trade* button is disabled. Tightness,
leader criteria and risk-at-size are computed from your numbers rather than self-certified
with a tickbox.

**5. Circuit breakers that fire in real time.** Daily loss limit, max trades per day, a
cooling-off countdown that starts automatically when you log a stop-out, position count,
bearish weather, and an under-slept warning. Tripped breakers disable the gate.

**6. An exit engine.** Each open position shows the one mechanical action your rulebook
prescribes today — "Day 3, sell 50% at the close", "10DSMA now above your entry, move the rest
to breakeven" — so trade management stops being a judgement call under pressure.

**7. Deviations are a closed list.** "I messed up" cannot be counted. A fixed taxonomy of
seventeen named demons can, so the app can tell you which one costs you the most money — and
the app proposes the ones it can detect from your own numbers, because catching your own rule
breaks is the hard part.

---

## What it captures, and why

Every field traces to a chapter. Nothing is here because it was easy to collect.

### The rulebook (Ch.3, 11, 14)
Max risk per trade %, target risk %, standard and max position %, max daily loss %, max open
positions, sector concentration cap, min RS / ADR / $volume, the tightness rule
(range ≤ ⅔ × ADR for N consecutive days), the exit sequence, friction settings, and a
**scaling ladder** gating size increases on equity milestones *and* a sustained compliance
rate. Every rule change is logged with a date and a rationale — undocumented change is drift.

### Per trade
- **Gate:** the full A+ checklist, timestamped so the app knows the checklist came *before* the
  entry, plus a computed grade (A+ / A / B / NO-TRADE).
- **Leader metrics:** RS, ADR, $volume, distance from 52-week high, sector — stored so you can
  later test whether the criteria actually earn their keep.
- **Structure:** consecutive tight days, base length, base depth, pole gain.
- **Execution:** planned vs actual entry (the difference *is* your chase distance, measured in
  R), shares, planned vs actual position %, initial stop, whether it was placed immediately.
- **Management:** every exit with a reason from a closed list, and every stop change flagged
  rule-based or discretionary — a stop moved away from price is always hope, never a rule.
- **Outcome:** R-multiple, P&L, MAE and MFE in R (MFE minus realised R is what you left on the
  table).
- **Audit (Ch.21):** seven yes/no questions. All yes and no deviations = compliant.
- **Psychology (Ch.4):** emotional state before, during and after; conviction; the preceding
  cue; "would you take this trade again?"; and one lesson.
- **Charts:** before / during / after screenshots, stored locally.

### Per day (Ch.19–21)
Market weather derived from three objective questions, watchlist quality, VIX, fitness to
trade (sleep, energy, stress), the three routine checklists, a process goal, the focus list
with per-name outcomes — including **valid triggers you failed to take**, which is data about
you, not the market — and the honest debrief.

### Per week (Ch.22)
Aggregated metrics, deviation patterns, emotional patterns, system and scanning
effectiveness, refinements, and one or two measurable process goals for next week.

### Analytics
Expectancy, profit factor, R distribution, max drawdown, and average R sliced by setup,
weather, **tightness**, grade, sector, conviction, day of week and **pre-entry emotional
state** — each slice showing compliance alongside R, because a state can be profitable by luck
while destroying your process. Plus stop-honour rate, checklist-use rate, R left on the table,
what chasing costs, routine adherence, compliant streaks, and a "never miss twice" counter.

---

## Running it

```bash
cd forge
npm install
npm run dev      # http://localhost:5173
```

To build a static copy you can open anywhere:

```bash
npm run build    # outputs to dist/
npm run preview
```

There is no server, no account and no subscription. Everything is stored in your browser's
IndexedDB and never leaves your machine — which also means **nobody else is backing it up for
you**. Rulebook → Data & backup has JSON export/import and CSV export; make the export part of
your weekly audit.

**Rulebook → Data & backup → Load a sample month** fills the app with a realistic month
containing exactly the failure modes the book warns about (a chased entry, a boredom trade, a
revenge trade eleven minutes after a stop-out, a winner cut short, and one profitable rule
break), so you can see what every screen looks like with data in it.

## Stack

React 18 + TypeScript, Vite, Dexie (IndexedDB), Recharts. No backend, no telemetry, no
dependencies beyond those. Light and dark themes; the chart palette is validated for
colour-vision deficiency in both modes.

## First half hour

1. **Rulebook** — set your equity and risk numbers. Be conservative; you can earn your way up.
2. **Daily Log** — answer the three weather questions before looking at a single chart.
3. **Pre-Trade Gate** — run a candidate through. Expect it to say no; that is the app working.
4. **Trade Journal** — audit every closed trade at the end of the day, honestly.
5. **Weekly Audit** — every weekend. This is where the system actually improves.

The compliance number will be embarrassing for the first few weeks. That is the point — it is
the first honest measurement of the thing that has actually been costing you money.
