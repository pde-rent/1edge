# Supported Order Types

> **Trading Strategy Arsenal**: Comprehensive order types supporting both one-off executions and recurring strategies for advanced trading automation.

 **Note**: All time periods are specified in milliseconds for precise control.

##  One-off Orders

> **Single Execution Orders**: Execute once when conditions are met, then complete.

###  Stop-Limit Order

| Property | Value | Status |
|----------|-------|---------|
| **Trigger** | Price level reached |  |
| **Execution** | Single order at a time |  |
| **Description** | Limit order at stop level |  |

**Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `amount` | 0 | Order size |
| `stopPrice` | spot - 0.5% | Trigger price |
| `limitPrice` | spot - 0.5% | Execution price |
| `expiry` | 10 | Expiration time |

###  Chase-Limit Order

| Property | Value | Status |
|----------|-------|---------|
| **Trigger** | Price drift cancellation/recreation |  |
| **Execution** | Single order at a time |  |
| **Description** | Trailing limit order |  |

**Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `amount` | 0 | Order size |
| `distancePct` | spot - 0.5% | Trail distance |
| `expiry` | 10 | Expiration time |
| `maxPrice` | spot - 0.5% | Maximum price |

###  Time Weighted Average Price (TWAP)

| Property | Value | Status |
|----------|-------|---------|
| **Trigger** | Time interval based |  |
| **Execution** | Sequential until complete |  |
| **Description** | Stealth execution via chase-limit |  |

**Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `amount` | 0 | Total target size |
| `startDate` | now | Execution start |
| `endDate` | +1 month | Execution end |
| `interval` | 1 day | Time between orders |
| `maxPrice` | market | Maximum execution price |

 **Strategy**: 30 orders recurring over time period

###  Range Order

| Property | Value | Status |
|----------|-------|---------|
| **Trigger** | Price step execution |  |
| **Execution** | Single order at a time |  |
| **Description** | Fixed price interval buying |  |

**Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `amount` | 0 | Total target size |
| `startPrice` | spot - 0.5% | Starting price |
| `endPrice` | spot - 2% | Ending price |
| `stepPct` | 0.3% | Price step size |
| `expiry` | - | Order expiration |

 **Strategy**: 5 orders across price range

###  Iceberg Order

| Property | Value | Status |
|----------|-------|---------|
| **Trigger** | Order execution based |  |
| **Execution** | Sequential until complete |  |
| **Description** | Large order stealth execution |  |

**Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `amount` | 0 | Total target size |
| `startPrice` | spot - 0.5% | Starting price |
| `endPrice` | spot - 0.5% | Ending price |
| `steps` | 10 | Number of sub-orders |
| `expiry` | - | Order expiration |

##  Recurring Orders

> **Perpetual Strategies**: Continuously executing orders that repeat based on time or market conditions.

###  Dollar-Cost Averaging (DCA)

| Property | Value | Status |
|----------|-------|---------|
| **Trigger** | Time interval recurring |  |
| **Execution** | Perpetual until stopped |  |
| **Description** | Regular chase-limit purchases |  |

**Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `amount` | 0 | Per-order size |
| `startDate` | now | Strategy start |
| `interval` | 1 day | Time between orders |
| `maxPrice` | market | Maximum execution price |

 **Strategy**: 30 orders recurring indefinitely

###  Grid Trading

| Property | Value | Status |
|----------|-------|---------|
| **Trigger** | Price step execution |  |
| **Execution** | Recurring market making |  |
| **Description** | Automated grid strategy |  |

**Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `amount` | 0 | Per-order size |
| `startPrice` | spot - 0.5% | Grid start price |
| `endPrice` | spot - 2% | Grid end price |
| `stepPct` | 0.3% | Grid step size |
| `stepMultiplier` | - | Step scaling factor |
| `singleSide` | false | One-directional grid |
| `tpPct` | - | Take profit percentage |

 **Strategy**: 5 orders in grid formation

###  Momentum Reversal Trading

| Property | Value | Status |
|----------|-------|---------|
| **Trigger** | RSI momentum reversal |  |
| **Execution** | Mean reversion timing |  |
| **Description** | RSI-based chase-limit orders |  |

**Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `amount` | 0 | Order size |
| `rsiPeriod` | 12 hours | RSI calculation period |
| `rsimaPeriod` | 12 hours | RSI moving average |
| `tpPct` | 2% | Take profit percentage |
| `slPct` | 1% | Stop loss percentage |

 **Signal**: RSI crosses RSI MA (up = long, down = short)

###  Range Breakout Trading

| Property | Value | Status |
|----------|-------|---------|
| **Trigger** | ADX trend breakout |  |
| **Execution** | Range breakout timing |  |
| **Description** | ADX-based chase-limit orders |  |

**Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `amount` | 0 | Order size |
| `adxPeriod` | 12 hours | ADX calculation period |
| `adxmaPeriod` | 12 hours | ADX moving average |
| `emaPeriod` | 12 hours | EMA trend filter |
| `tpPct` | 2% | Take profit percentage |
| `slPct` | 1% | Stop loss percentage |

 **Signal**: ADX crosses ADX MA + EMA direction (bullish EMA = long, bearish EMA = short)
