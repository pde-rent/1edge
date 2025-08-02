# Order Internals: 1edge vs 1inch Orders

## Overview

This document explains the relationship between 1edge internal orders and 1inch limit orders, and how our system manages the 1:N relationship between them.

## Order Types and Relationships

### 1edge Internal Orders

1edge internal orders are high-level order tracking objects that represent complex trading strategies. They are stored in our database and managed by our OrderRegistry service.

**Key characteristics:**

- Each order has a unique internal ID (hash-based)
- Can spawn multiple 1inch limit orders over time
- Tracks overall strategy progress and state
- Contains configuration parameters for complex order types
- May not have pre-defined `makingAmount` and `takingAmount` (calculated dynamically)

### 1inch Limit Orders

1inch limit orders are individual on-chain orders submitted to the 1inch Limit Order Protocol.

**Key characteristics:**

- Each has an on-chain order hash
- Represents a single atomic swap
- Has fixed `makingAmount` and `takingAmount`
- Managed by 1inch infrastructure
- Can be filled, cancelled, or expired independently

## 1:N Relationship

### Simple Orders (1:1)

Some order types result in a single 1inch order:

- `LIMIT` orders
- `STOP_LIMIT` orders (once triggered)

### Complex Orders (1:N)

Other order types spawn multiple 1inch orders over time:

- `TWAP` orders - split into multiple time-based executions
- `ICEBERG` orders - split into multiple size-based chunks
- `DCA` orders - recurring purchases over time
- `GRID_TRADING` orders - multiple orders at different price levels

## Order Management Architecture

### OrderRegistry Responsibilities

- Validates and stores 1edge internal orders
- Monitors trigger conditions for pending orders
- Delegates execution to specialized order watchers
- Tracks overall order progress and status

### Order Watchers Responsibilities

- Handle order-type-specific logic
- Create and submit 1inch orders when triggered
- Monitor 1inch order status and updates
- Update internal order state based on 1inch fills
- Handle dynamic pricing calculations

### Database Tracking

1edge orders track their spawned 1inch orders via the `oneInchOrderHashes` array:

```typescript
interface Order {
  id: string; // Internal 1edge order ID
  oneInchOrderHashes?: string[]; // Array of spawned 1inch order hashes
  // ... other fields
}
```

## Order State Management

### Status Transitions

1edge orders progress through these states:

1. `PENDING` - Created but not yet triggered
2. `ACTIVE` - Has spawned at least one 1inch order
3. `PARTIALLY_FILLED` - Some but not all 1inch orders filled
4. `FILLED` - All 1inch orders filled, strategy complete
5. `CANCELLED`/`EXPIRED` - Manually cancelled or expired

### Cross-Order Synchronization

- Watchers monitor all 1inch orders spawned by their 1edge order
- Order status is updated based on aggregate fill status
- `remainingSize` is decremented as 1inch orders get filled
- Order is marked `FILLED` when `remainingSize` reaches zero

## Example: TWAP Order Lifecycle

1. **Creation**: User creates TWAP order to sell 1 ETH over 4 hours in 15-minute intervals
2. **Storage**: OrderRegistry stores 1edge order with `PENDING` status
3. **Triggering**: Every 15 minutes, TwapWatcher creates a new 1inch order for 0.0625 ETH
4. **Tracking**: Each 1inch order hash is added to `oneInchOrderHashes` array
5. **Monitoring**: TwapWatcher monitors all spawned 1inch orders for fills
6. **Updates**: As 1inch orders fill, `remainingSize` is decremented
7. **Completion**: When all 1inch orders are filled, TWAP order is marked `FILLED`

## Key Differences Summary

| Aspect       | 1edge Order              | 1inch Order          |
| ------------ | ------------------------ | -------------------- |
| Scope        | High-level strategy      | Atomic swap          |
| Storage      | Internal database        | On-chain             |
| Lifespan     | Can be long-running      | Single execution     |
| Amounts      | May be dynamic           | Always fixed         |
| Relationship | 1:N with 1inch orders    | N:1 with 1edge order |
| Management   | OrderRegistry + Watchers | 1inch Protocol       |

## Benefits of This Architecture

1. **Separation of Concerns**: Complex strategy logic is separate from atomic swap execution
2. **Flexibility**: Can implement any order type without 1inch protocol changes
3. **Reliability**: If individual 1inch orders fail, strategy can continue
4. **Monitoring**: Comprehensive tracking of both strategy and execution progress
5. **Efficiency**: Only creates 1inch orders when needed, reducing on-chain overhead
