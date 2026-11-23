# Quin momentum bot — btc-race-24h-20261123-0511

[![btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/quintana111/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/quintana111/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)

A single-symbol (CBBTC) long-only momentum bot for the make.fun BTC race,
retuned for this edition's dev window. The 0801 winner's settings (15-min
lookback, +0.50% trigger, TP +0.80%, 8h hold) lose $7.01 on this window,
so the bot was retuned here: a 19-minute lookback with a +0.40% trigger,
take-profit +1.50% over cost, trailing stop 0.80% below the peak value
since entry, 19-minute momentum reversal below -0.40%, or 240 bars (4h)
held. A 10-bar cooldown after a sell prevents re-buying the same burst.
Max slippage 100 bps per order.

**Grading.** On the kit's frozen 24h dev window (1,440 one-minute bars)
with the kit's own harness (`grade-local --driver process`): net PnL
**+$36.88 on $1,000**, 16 trades, win rate 62.5%, max drawdown 1.87%,
fees $6.57, guardrails met, two executions reproduced byte for byte;
still +$30.32 at 2× fees. The flat-model backtest of the same settings
reads +$43.95 (2× fees +$22.42). The whole tuned neighbourhood is
profitable at 1× fees (48/48 configs over N 18–20, momentum 0.375–0.45%,
trailing 0.6–1.2%), so this is the middle of a broad profitable region,
not a single knife-edge fit.

**Files.** `main.ts` is the bot (Node 22, run by the grader as
`node /bot/main.ts`). `vendor/makefun-bars.ts` is a byte-identical copy of
the kit's bars-replay shim. No other dependencies.
