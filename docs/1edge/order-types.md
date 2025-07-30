# Supported Order Types

Periods are in ms.

## One-off Orders

### Stop-Limit Order

Trigger: Order is created when the price level is reached; only one order at a time.
Description: Creates a limit order as the price reaches a stop level.
Params: amount, stopPrice, limitPrice, expiry
Defaults: 0, now, spot - 0.5%, spot - 0.5%, 10

### Chase-Limit Order

Trigger: Cancellation and re-creation of the order when the price drifts away; only one order at a time.
Description: Trails a limit order as the price moves away from it.
Params: amount, distancePct, expiry, maxPrice
Defaults: 0, now, spot - 0.5%, spot - 0.5%, 10

### Time Weighted Average Price (TWAP)

Trigger: Creation of the next order every time a time interval has passed; only one order at a time.
Description: Buys at fixed time intervals until the amount is reached, using closely placed chase-limit orders (stealth).
Params: amount, startDate, endDate, interval, maxPrice
Defaults: 0, now, in 1 month, 1 day (30 orders, recurring)

### Range Order

Trigger: Creation of the next order every time a step is reached (order is executed); only one order at a time.
Description: Buys at fixed price intervals until the amount is reached (stealth).
Params: amount, startPrice, endPrice, stepPct, expiry
Defaults: 0, spot - 0.5%, spot - 2%, 0.3% (5 orders)

### Iceberg Order

Trigger: Creation of the next order every time an order is executed; only one order at a time.
Description: Buys sequentially until the amount is reached (stealth).
Params: amount, startPrice, endPrice, steps, expiry
Defaults: 0, now, spot - 0.5%, spot - 0.5%, 10

## Recurring Orders

### Dollar-Cost Averaging (DCA)

Trigger: Creation of the next order every time a time interval has passed; only one order at a time.
Description: Perpetually buys by creating timed, closely placed chase-limit orders.
Params: amount, startDate, interval, maxPrice
Defaults: 0, now, 1 day (30 orders, recurring)

### Grid Trading

Trigger: Creation of the next order every time a step is reached (order is executed); only one order at a time.
Description: Naive market making using one or two range orders.
Params: amount, startPrice, endPrice, stepPct, stepMultiplier, singleSide, tpPct
Defaults: 0, spot - 0.5%, spot - 2%, false, 0.3% (5 orders)

### Momentum Reversal Trading

Trigger: Order is created when price momentum changes: RSI crosses the RSI MA (up = long, down = short); only one order at a time.
Description: Market making at times of mean reversal using RSI and chase-limit orders.
Params: amount, rsiPeriod, rsimaPeriod, tpPct, slPct
Defaults: 0, 12 (hours), 12 (hours), 2%, 1%

### Range Breakout Trading

Trigger: Order is created when a trend starts: ADX crosses the ADX MA (up + bullish EMA = long, up + bearish EMA = short); only one order at a time.
Description: Market making at times of range breakout using ADX and chase-limit orders.
Params: adxPeriod, adxmaPeriod, emaPeriod, tpPct, slPct
Defaults: 0, 12 (hours), 12 (hours), 12 (hours), 2%, 1%
