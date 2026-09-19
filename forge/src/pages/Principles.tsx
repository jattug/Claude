/**
 * The source material, condensed.
 *
 * Kept inside the app deliberately: Ch.12 says to make the good cue obvious.
 * The rulebook you can re-read in ninety seconds is the one you actually follow.
 */
import { useState } from 'react'
import { Card, Tabs, Quote, Callout } from '../components/ui'

type Tab = 'mindset' | 'system' | 'execution' | 'routine' | 'scale' | 'glossary'

export default function Principles() {
  const [tab, setTab] = useState<Tab>('mindset')

  return (
    <>
      <div className="page-head">
        <h1>Principles</h1>
        <p>
          The method Forge is built on, in the order the book teaches it. Every rule the app
          enforces traces back to something on this page. Re-read it when you feel the urge to
          override your own system.
        </p>
      </div>

      <Tabs<Tab>
        active={tab} onChange={setTab}
        tabs={[
          { id: 'mindset', label: 'Mindset' },
          { id: 'system', label: 'The system' },
          { id: 'execution', label: 'Execution' },
          { id: 'routine', label: 'Routines' },
          { id: 'scale', label: 'Scaling' },
          { id: 'glossary', label: 'Glossary' },
        ]}
      />

      {tab === 'mindset' ? (
        <div className="stack">
          <Card>
            <div className="card-head"><h2>The knowledge-execution gap</h2></div>
            <p>
              Most struggling traders do not lack knowledge. They can identify the pattern, they
              know the risk rules, they understand why winners must be allowed to run. The failure
              is in the moment of execution, where impulse beats intention.
            </p>
            <Quote source="peoplewish">
              It's not the strategies that are faulty. It's the fact that people cannot follow a
              simple rule, set unwaveringly, to save their lives.
            </Quote>
            <p style={{ marginTop: 10 }}>
              So the work is not to find another setup. It is to build a system that makes
              following your existing one the path of least resistance.
            </p>
          </Card>

          <Card>
            <div className="card-head"><h2>Process over P&amp;L</h2></div>
            <p>
              Judging yourself by daily P&amp;L guarantees an emotional rollercoaster: green makes
              you feel invincible and leads to oversizing; red makes you feel wrong and leads to
              fear or revenge. Both destroy execution.
            </p>
            <Callout tone="info" title="The inversion this whole app is built on">
              A <b>profitable</b> trade taken against your rules is a <b>mistake</b> — it pays you
              for bad behaviour. A <b>losing</b> trade taken perfectly is a <b>success</b> — it is
              the cost of doing business in a probabilistic game.
            </Callout>
            <p style={{ marginTop: 10 }}>
              The metric that matters, especially early, is your process compliance rate: of the
              trades you took, how many followed every single rule? Target 100%. Anything less is
              a question for the journal.
            </p>
          </Card>

          <Card>
            <div className="card-head"><h2>Know your demons</h2></div>
            <p>Awareness precedes control. The recurring ones:</p>
            <ul style={{ lineHeight: 1.8, paddingLeft: 20 }}>
              <li><b>Impatience</b> — forcing trades on suboptimal patterns rather than waiting.</li>
              <li><b>Trading non-setups</b> — knowingly entering something that fails your own criteria.</li>
              <li><b>Emotional volatility</b> — euphoria after wins, despair after losses, both clouding judgement.</li>
              <li><b>Overtrading</b> — activity as a substitute for productivity.</li>
              <li><b>Oversizing</b> — the fastest route to catastrophic loss, almost always emotional.</li>
              <li><b>Instant gratification</b> — cutting winners short, abandoning the long compounding process.</li>
            </ul>
            <p>
              Label them as they happen. "That is FOMO" creates the psychological distance between
              you and the impulse.
            </p>
          </Card>

          <Card>
            <div className="card-head"><h2>Patience is the edge</h2></div>
            <Quote source="Qullamaggie">
              All a patience game — remember, the money is not made trading, the money is made
              waiting. That's where the big money is. You have to wait for the big opportunities.
            </Quote>
            <p style={{ marginTop: 10 }}>
              In a good year perhaps 30-40% of the time offers genuinely good conditions. The rest
              is break-even or worse. Waiting is not idleness; it is capital preservation and
              opportunity stalking, and it is the work.
            </p>
          </Card>
        </div>
      ) : null}

      {tab === 'system' ? (
        <div className="stack">
          <Card>
            <div className="card-head"><h2>Read the weather first</h2></div>
            <p>
              Breakout strategies work when the market is in momentum mode and get chopped to
              pieces when it is not. Before looking at a single stock, classify the regime:
            </p>
            <ul style={{ lineHeight: 1.8, paddingLeft: 20 }}>
              <li><b>Bullish</b> — index above a rising 20-day MA, 10-day above the 20-day. Trade your setups at standard size.</li>
              <li><b>Caution</b> — MAs conflicting or the 20-day flat. Do less, on less size, A+ only.</li>
              <li><b>Bearish</b> — index below a falling 20-day and/or 10 below 20. No new long breakouts. Preserve capital.</li>
            </ul>
            <p>
              A practical secondary gauge: the quality of your own watchlist. If the scans keep
              producing tight, clean charts, internals are healthy. If they are sparse and sloppy,
              they are not — whatever the index is doing.
            </p>
          </Card>

          <Card>
            <div className="card-head"><h2>Hunt only leaders</h2></div>
            <Quote source="Qullamaggie">
              You need to focus on the momo leaders. You need to be in the best stocks — if you
              wanna make a lot of money, you need to be in the best stocks.
            </Quote>
            <p style={{ marginTop: 10 }}>
              A minority of stocks drive nearly all market returns, and roughly half of a stock's
              move is attributable to its industry group. Filter hard on demonstrated momentum,
              high relative strength, proximity to highs, sufficient liquidity and enough ADR to
              be worth the risk — before you look for a pattern at all.
            </p>
          </Card>

          <Card>
            <div className="card-head"><h2>Expansion from contraction</h2></div>
            <p>
              The core dynamic: price alternates between expansion and contraction. You want to
              enter exactly as a quiet, tight consolidation resolves back into expansion. That
              transition is where risk is smallest and potential is largest.
            </p>
            <p>
              Master one setup before adding a second. Depth in a simple, high-probability pattern
              beats a shallow acquaintance with ten.
            </p>
          </Card>

          <Card>
            <div className="card-head"><h2>Risk is woven in, not bolted on</h2></div>
            <p>
              The elegant part of the method: risk management is not a separate step. Because you
              only trade genuinely tight charts, the stop sits very close to the entry — so a
              standard 10-20% position naturally risks well under 0.5% of equity. Tightness,
              sizing and risk are one mechanism.
            </p>
            <Callout tone="info" title="The corollary">
              If a setup is not tight, a standard position breaches your risk limit. The system
              then refuses the trade for you. That is not an inconvenience; it is the filter
              working.
            </Callout>
          </Card>

          <Card>
            <div className="card-head"><h2>Eliminate noise</h2></div>
            <Quote source="Qullamaggie">
              Sometimes getting an edge is having fewer things on your charts. I just try to keep
              it very basic — if anything I want to remove stuff.
            </Quote>
            <p style={{ marginTop: 10 }}>
              Price, volume, and a few moving averages. No MACD, no RSI, no Bollinger bands, no
              level 2. Fewer inputs means less ambiguity, faster decisions and a system you can
              actually evaluate.
            </p>
          </Card>
        </div>
      ) : null}

      {tab === 'execution' ? (
        <div className="stack">
          <Card>
            <div className="card-head"><h2>Entries</h2></div>
            <p>
              The trigger must be one unambiguous event — a break of the pivot, a trendline break,
              an opening-range high. When it happens, execute immediately. All the thinking was
              done in preparation; the moment of execution should require none.
            </p>
            <p>
              If it gaps through your entry and the stop is now too far away, you missed it. Do
              not chase. Chasing worsens your risk/reward before the trade has done anything.
            </p>
          </Card>

          <Card>
            <div className="card-head"><h2>Exits</h2></div>
            <ol style={{ lineHeight: 1.9, paddingLeft: 20 }}>
              <li><b>Initial stop</b> — the low of the entry day, placed immediately, honoured without negotiation.</li>
              <li><b>Day-1 red close</b> — optionally cut anything that closes red on day one, stop untouched or not.</li>
              <li><b>Scheduled partial</b> — sell 50% on day 3, 4 or 5. Pick one day; stop renegotiating.</li>
              <li><b>Breakeven</b> — move the rest to breakeven only once the trailing MA passes your entry.</li>
              <li><b>Trail</b> — sell the remainder on the first daily <i>close</i> below the trailing MA.</li>
            </ol>
            <Quote source="Qullamaggie">
              Of course I hit the stop, why would I not? The only way to make millions in the
              market is to hit your stops.
            </Quote>
          </Card>

          <Card>
            <div className="card-head"><h2>Handling losses</h2></div>
            <p>
              Expect to be stopped out on the majority of trades — 60-70% is normal for this
              style. A stop honoured is a plan executed, not a failure. The market did not gun for
              you; it moved.
            </p>
            <p>
              After a stop: step away for ten to fifteen minutes. Do not look for the next trade.
              Do not re-enter the same name out of frustration. The post-loss minutes are when
              revenge trading is born.
            </p>
          </Card>

          <Card>
            <div className="card-head"><h2>Checklists and friction</h2></div>
            <p>
              Pilots and surgeons use checklists because experts forget steps under pressure. Your
              pre-trade checklist is a gatekeeper: if one box is unticked, the trade is forbidden.
            </p>
            <p>
              Then make the bad path harder — disable one-click trading, force manual size
              calculation, separate your charting and execution platforms, impose cooling-off
              periods. Friction gives your slow, rational mind time to overrule the fast one.
            </p>
          </Card>
        </div>
      ) : null}

      {tab === 'routine' ? (
        <div className="stack">
          <Card>
            <div className="card-head"><h2>Pre-market, 90-120 minutes</h2></div>
            <ol style={{ lineHeight: 1.9, paddingLeft: 20 }}>
              <li>Reset your environment and check in with your own state.</li>
              <li>Assess the market weather and write it down.</li>
              <li>Review every open position and confirm its plan.</li>
              <li>Run the scans, cut ruthlessly to five focus names or fewer.</li>
              <li>Write entry, stop and size for each one. Set the alerts. Rehearse.</li>
            </ol>
          </Card>

          <Card>
            <div className="card-head"><h2>Market hours</h2></div>
            <p>
              Your only job is executing prepared triggers. Intense focus through the open, then
              step back and let alerts do the watching. If nothing on the focus list triggers, you
              are done — that is a complete, successful day.
            </p>
            <Quote source="Qullamaggie">Don't do anything stupid, out of boredom.</Quote>
          </Card>

          <Card>
            <div className="card-head"><h2>Post-market, 45-90 minutes</h2></div>
            <p>
              Decompress first, then review calmly. For every trade: the numbers, the charts, the
              five audit questions, and an honest note on what you felt before, during and after.
              Then the day's compliance rate, the missed opportunities, and one focus for tomorrow.
            </p>
            <p>
              Rushing this phase is how mistakes fossilise into habits.
            </p>
          </Card>

          <Card>
            <div className="card-head"><h2>Weekly audit</h2></div>
            <p>
              Zoom out. Aggregate the week's metrics, find the one or two recurring deviation
              patterns, check whether the scans caught the real movers, and set one or two process
              goals for next week. Change rules only on evidence spanning many weeks — respond to
              patterns, never react to a bad Friday.
            </p>
          </Card>
        </div>
      ) : null}

      {tab === 'scale' ? (
        <div className="stack">
          <Card>
            <div className="card-head"><h2>Earn the size</h2></div>
            <p>Before any increase, all of these must be true:</p>
            <ul style={{ lineHeight: 1.8, paddingLeft: 20 }}>
              <li>Compliance consistently above 90-95% over weeks or months.</li>
              <li>A profitable equity curve driven by the system, not by a few lucky trades.</li>
              <li>Genuine psychological calm at your current size.</li>
            </ul>
            <Quote source="Qullamaggie">
              You have to do it from a position of strength. You do it when you've had a good
              period, not when things are going bad.
            </Quote>
          </Card>

          <Card>
            <div className="card-head"><h2>Handling bigger numbers</h2></div>
            <p>
              The percentages stay the same; the dollars do not. Anchor relentlessly to R-multiples
              and compliance rather than the dollar P&amp;L, scale in small increments so you
              desensitise gradually, and know your sleeping point — the total exposure at which you
              remain objective.
            </p>
            <p>
              And plan the retreat: if discipline wavers at the new size, drop back a tier
              immediately. Ego is not a risk parameter.
            </p>
          </Card>

          <Card>
            <div className="card-head"><h2>Avoid complacency</h2></div>
            <p>
              The signs: skipping routines because things are going well, tolerating small rule
              deviations, studying less, judging weeks by profit again. The market changes; what
              worked will need refining.
            </p>
            <Quote source="Qullamaggie">
              You have to constantly adapt. What worked 20 years ago probably won't work going
              forward. I think being able to adapt is the greatest superpower.
            </Quote>
          </Card>

          <Card>
            <div className="card-head"><h2>Trading for life</h2></div>
            <p>
              Sleep, exercise, real breaks, an identity outside the screen. These are not
              soft extras — under-slept and over-stressed is measurably when old habits return.
              The goal is a career, not a good quarter.
            </p>
          </Card>
        </div>
      ) : null}

      {tab === 'glossary' ? (
        <Card>
          <div className="card-head"><h2>Glossary</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Term</th><th>Meaning</th></tr></thead>
              <tbody>
                {GLOSSARY.map(([term, def]) => (
                  <tr key={term}><td><b>{term}</b></td><td>{def}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  )
}

const GLOSSARY: [string, string][] = [
  ['A+ setup', 'A candidate meeting every predefined criterion in your written plan. Trading these exclusively is the entire discipline problem.'],
  ['ADR', 'Average Daily Range — the average high-to-low move, as a percentage. Gauges volatility and filters stock selection.'],
  ['Compliance rate', 'The percentage of trades that followed every rule. The primary metric while discipline is being rebuilt.'],
  ['Consolidation', 'Sideways or contracting price action after a trend — a flag, pennant or tight channel. Where setups form.'],
  ['EP', 'Episodic Pivot — a large gap on exceptional volume driven by a fundamental catalyst. Often starts a major move.'],
  ['High Tight Flag', 'A tight sideways pause after a very sharp advance, often 100%+ in under eight weeks.'],
  ['HVC', 'High Volume Close — a price level closed on exceptional volume, which often acts as support or resistance later.'],
  ['Leader', 'A stock significantly outperforming the market and its group. Where probability concentrates.'],
  ['LOD', 'Low of Day — the standard initial stop-loss for a day-one breakout entry.'],
  ['MAE / MFE', 'Maximum Adverse / Favourable Excursion — the worst and best points a trade reached before you exited.'],
  ['MOC', 'Market On Close — an order filling at the official closing price, used for end-of-day exit rules.'],
  ['ORB', 'Opening Range Breakout — entering on a break of the high set in the first minutes of the session.'],
  ['Pivot point', 'The precise level whose break triggers entry, usually the high of a tight consolidation.'],
  ['R-multiple', 'Profit or loss measured in units of initial risk. Risk $100, make $500, that is +5R. Normalises results across position sizes.'],
  ['RS', 'Relative Strength — performance versus the broader market. High RS means outperformance.'],
  ['Shoryuken', 'A sharp pullback to a rising key MA inside an uptrend, entered over the high of the pullback candle.'],
  ['Tightness', 'Range compression before a breakout, defined quantitatively as a daily range at or under two thirds of ADR.'],
  ['UnR', 'Undercut and Rally — price briefly breaks a support level then reclaims it, trapping shorts.'],
]
