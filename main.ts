// Quin momentum bot for the btc-race-24h-20261123-0511 bounty (make.fun).
//
// Long-only momentum on one symbol, CBBTC, on 1-minute bars, $1,000 of
// paper capital. This edition's frozen 24h dev window trends upward
// (+3.6% buy-and-hold), and the 0801 winner's settings (15-min lookback,
// +0.50% trigger, TP +0.80%, 8h hold) lose $7.01 on it, so the bot was
// retuned on this window instead of copied: a slightly longer 19-minute
// lookback with a lower +0.40% trigger catches the window's bursts
// earlier, a wider +1.50% take-profit lets winners run further in the
// uptrend, a tighter 0.80% trailing stop banks the move before it fades,
// and a 4h max hold stops the bot sitting through dead stretches. Every
// parameter was backtested on the kit's frozen 24h dev window (1,440
// bars) with the harness fill model (next-open fill, 4 bps fee + 2 bps
// slippage + ~7 bps pool impact per leg, 13 bps/leg):
//   - 19-minute return > +0.40%            -> buy (full cash)
//   - take profit at +1.50% over cost     -> sell
//   - trailing stop 0.80% below the peak value since entry -> sell
//   - momentum reversal: 19-min return < -0.40% -> sell
//   - time stop: 240 bars (4h) held       -> sell
//   - 10-bar cooldown after a sell, so a just-exited burst is not
//     re-bought in the same minute
// Local backtest on the kit's frozen 24h dev window: net PnL +$43.95 on
// $1,000, 16 trades (8 round trips), win rate 62.5%, max drawdown 1.8%,
// still +$22.42 at 2x fees. The kit's own harness grades the same bot
// (`grade-local --driver process`, two executions, reproduced byte for
// byte) at net PnL +$36.88, 16 trades, win rate 62.5%, max drawdown
// 1.87%, fees $6.57, guardrails met, still +$30.32 at 2x fees — the
// harness figure is the one that counts, the flat-model figure is the
// tuning record. The whole tuned neighbourhood is profitable
// at 1x fees (48/48 configs over N 18-20, momentum 0.375-0.45%, trailing
// 0.6-1.2%), and every immediate neighbour of the chosen set stays above
// +$39 at 1x and above +$19 at 2x fees, so this is the middle of a broad
// profitable region, not a single knife-edge fit.
//
// Deterministic: no clock, no environment, no Math.random. Every decision
// comes from the bar closes and the account state the harness sends.
// The grader runs `node /bot/main.ts` with this directory mounted at /bot.

import { BPS, runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Momentum lookback in bars (1 bar = 1 minute). */
const MOM_BARS = 19;
/** Entry trigger: N-bar return above this, in basis points. */
const MOM_BPS = 40;
/** Take profit: position value above this over its cost, in basis points. */
const TP_BPS = 150;
/** Trailing stop: position value below this under its peak since entry, in bps. */
const TRAIL_BPS = 80;
/** Time stop: sell after this many bars held. */
const MAX_HOLD_BARS = 240;
/** Bars to wait after a sell before the next buy. */
const COOLDOWN_BARS = 10;
const MAX_SLIPPAGE_BPS = 100;

/** Closes seen so far, in the harness's raw price units. */
const closes: number[] = [];
let peakValue = 0n;
let heldBars = 0;
let cooldown = 0;
/** Latched exit: once any exit fires, keep selling until the position is gone. */
let exitLatch = false;

/** N-bar return of the latest close, or null while warming up. */
function momentum(): number | null {
  if (closes.length <= MOM_BARS) return null;
  const now = closes[closes.length - 1];
  const ago = closes[closes.length - 1 - MOM_BARS];
  return (now - ago) / ago;
}

await runBars({
  onBatch(state: BarsState, batch) {
    // Only act on bars for our symbol; a minute with no sample changes nothing.
    let fresh = false;
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) {
        closes.push(Number(bar.c));
        fresh = true;
      }
    }
    if (!fresh) return [];

    if (cooldown > 0) cooldown--;
    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      heldBars++;
      const value = state.value(SYMBOL, held.qty);
      if (value > peakValue) peakValue = value;
      const m = momentum();
      const takeProfit = value * 10_000n >= held.cost * BigInt(10_000 + TP_BPS);
      const trailing = value * 10_000n <= peakValue * BigInt(10_000 - TRAIL_BPS);
      const timed = heldBars >= MAX_HOLD_BARS;
      const reversal = m !== null && m < -MOM_BPS / 10_000;
      if (takeProfit || trailing || timed || reversal) exitLatch = true;
      if (exitLatch) {
        cooldown = COOLDOWN_BARS;
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    // Not holding: reset per-trade state and look for the momentum entry.
    exitLatch = false;
    heldBars = 0;
    peakValue = 0n;
    const m = momentum();
    if (m === null || m <= MOM_BPS / 10_000 || cooldown > 0) return [];
    const { caps, fees } = state.hello;
    let slice = state.cash;
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    if (slice > byWeight) slice = byWeight;
    if (slice < BigInt(fees.min_notional_quote_units)) return [];
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
