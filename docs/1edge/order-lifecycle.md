# Order Lifecycle

> **Complete Order Journey**: From user creation to on-chain execution through the 1inch network, this document tracks every step of an order's lifecycle in the 1edge system.

This document describes the complete lifecycle of an order in the 1edge system, from creation by the user to execution on the 1inch network.

| Phase | Component | Status |
|-------|-----------|--------|
| Creation | Frontend UI | Active |
| Validation | API Server | Active |
| Registration | OrderRegistry | Active |
| Monitoring | Watcher System | Active |
| Execution | Order Handlers | Active |
| Integration | 1inch Protocol | Active |

##  Overview

The order lifecycle is managed by the `OrderRegistry` service, which receives, stores, monitors, and executes all orders. Each order is processed by a dedicated "watcher" that monitors trigger conditions and executes when conditions are met. All order types (including strategies, which are recurring orders) follow the same unified flow.

##  Architecture & Flow

The order lifecycle is divided into three main phases:

### Phase 1: 1edge Order Creation

```mermaid
%%{init: {'theme':'dark', 'themeVariables': {'primaryColor':'#22c55e','background':'transparent','primaryBorderColor':'#22c55e','lineColor':'#6b7280','sectionBkgColor':'transparent','altSectionBkgColor':'transparent','clusterBkg':'transparent','clusterBorder':'#6b7280'}}}%%
graph TD
    A[User] --signs order--> D[API /order]
    A --approves--> G[DelegateProxy]
    D --registers--> E[OrderRegistry]
    E --persists--> F[Database]
    E --spawns--> G[Watcher]
    E --"ok"--> D --"ok"--> A
```

### Phase 2: Recurring 1inch Order Submission

```mermaid
%%{init: {'theme':'dark', 'themeVariables': {'primaryColor':'#22c55e','background':'transparent','primaryBorderColor':'#22c55e','lineColor':'#6b7280','sectionBkgColor':'transparent','altSectionBkgColor':'transparent','clusterBkg':'transparent','clusterBorder':'#6b7280'}}}%%
graph TD
    A[Watcher condition met?] --yes--> D[Keeper]
    A --> C[No] --loops--> A
    D --calls--> E[DelegateSafe.createUserOrder]
    E --1inch order signature--> D
    D --submits order--> F[1inch LOP]
    D --updates db--> G[Order status: ACTIVE]
```

### Phase 2bis: 1inch Orders Fulfillment

```mermaid
%%{init: {'theme':'dark', 'themeVariables': {'primaryColor':'#22c55e','background':'transparent','primaryBorderColor':'#22c55e','lineColor':'#6b7280','sectionBkgColor':'transparent','altSectionBkgColor':'transparent','clusterBkg':'transparent','clusterBorder':'#6b7280'}}}%%
graph TD
    A["Market Taker (Trader)"] --fillOrder--> B[AggregationProxyV6]
    B --preInteraction transferFrom--> C["Receiver (User)"] --transfer makerAsset--> D[DelegateProxy]
    B --> D --transfer makerAsset--> A
    A --transfer takerAsset--> C
    B --postInteraction updateRemaining--> D
```

### Phase 3: 1edge Order Fulfillment

```mermaid
%%{init: {'theme':'dark', 'themeVariables': {'primaryColor':'#22c55e','background':'transparent','primaryBorderColor':'#22c55e','lineColor':'#6b7280','sectionBkgColor':'transparent','altSectionBkgColor':'transparent','clusterBkg':'transparent','clusterBorder':'#6b7280'}}}%%
graph TD
    A[Watcher] --"observes"--> B[1inch order fill]
    A --> C[Stop condition met?]
    C --> D[Yes] --stops--> A
    C --no--> A
    D --updates db--> F[Order status: FILLED]
```

##  Complete Flow

###  Order Creation (Frontend)
- User configures order parameters in the UI
- Frontend validates inputs and estimates gas/fees
- User signs order payload with their wallet (EVM signature)
- Signed order is submitted to `POST /orders` endpoint

###  Order Validation (API Server)
- `apiServer.ts` receives the order request at `/orders` endpoint
- Validates the EVM signature using `ethers.utils.recoverAddress`
- Ensures the recovered address matches the order maker
- Forwards valid order to `OrderRegistry.createOrder()`

###  Order Registration (OrderRegistry)
- Validates order signature using `validateOrderSignature()`
- Initializes order fields: `status=PENDING`, `triggerCount=0`, `remainingSize=size`
- Saves order to database via `saveOrder()`
- Creates order event with `PENDING` status
- Spawns a new watcher for the order via `startWatcher()`

###  Order Monitoring (Watcher)
- Each order has a dedicated watcher running in `watchOrder()` loop
- Watcher checks trigger conditions every 5 seconds using modular handlers
- Handlers implement `OrderWatcher` interface with `shouldTrigger()` method
- Supports all order types: stop-limit, chase-limit, TWAP, DCA, etc.

###  Trigger Evaluation (Order Handlers)
| Order Type | Trigger Mechanism | Status |
|------------|-------------------|--------|
| Stop-Limit | Price breach monitoring |  |
| Chase-Limit | Dynamic price tracking |  |
| TWAP | Time intervals + volume |  |
| DCA | Scheduled recurring |  |
| Handler Response | Boolean condition check |  |

###  Order Execution (Handler Execute)
- Watcher calls `handler.execute(order)` when triggered
- Handler creates appropriate 1inch limit order parameters
- Increments `triggerCount` and updates `nextTriggerValue` for recurring orders
- Calls `DelegateSafe` contract to transfer user funds and sign order
- Submits signed order to 1inch Orderbook API

###  1inch Integration
- Order posted to 1inch API with signed payload
- 1inch returns order hash for tracking
- Order hash stored in `order.oneInchOrderHashes[]` array
- Order status updated to `ACTIVE`
- Creates `SUBMITTED` order event

###  Order Tracking
- System monitors 1inch order status via API polling
- Tracks fills, cancellations, and expirations
- Updates order status accordingly: `FILLED`, `CANCELLED`, `EXPIRED`
- For recurring orders, watcher continues monitoring for next trigger

##  API Endpoints

### `POST /orders`
Creates a new order with EVM signature verification.

**Request Body:**
```json
{
  "id": "generated-uuid",
  "type": "STOP_LIMIT",
  "pair": "WETH/USDC",
  "size": 1.0,
  "maker": "0x742d35cc6734C0532925a3b8D0d5D0a8d1238a60",
  "makerAsset": "0xA0b86a33E6409c26C5E1d7D35644C7a9A6BdF4fE",
  "takerAsset": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "params": {
    "triggerPrice": 2500.00,
    "limitPrice": 2490.00
  },
  "signature": "0x...",
  "userSignedPayload": "..."
}
```

### `GET /orders`
Returns all active orders for monitoring.

### `GET /orders?maker=0x123...`
Returns all orders for a specific user address (transparent, no authentication required).

### `GET /orders/{orderId}`
Returns specific order details and status.

### `PUT /orders/{orderId}`
Modifies an order (cancels original, creates new).

### `DELETE /orders/{orderId}`
Cancels an order and stops its watcher.

##  Database Schema

| Column                 | Type     | Description                                 |
|------------------------|----------|---------------------------------------------|
| `id`                   | TEXT     | Unique order identifier                     |
| `order_hash`           | TEXT     | 1inch-computed order hash (unique)          |
| `strategy_id`          | TEXT     | Associated strategy identifier              |
| `type`                 | TEXT     | Order type (e.g., STOP_LIMIT, LIMIT)        |
| `status`               | TEXT     | Current order status                        |
| `maker_asset`          | TEXT     | Maker asset address                         |
| `taker_asset`          | TEXT     | Taker asset address                         |
| `making_amount`        | TEXT     | Amount of maker asset to sell               |
| `taking_amount`        | TEXT     | Amount of taker asset to buy                |
| `maker`                | TEXT     | Maker address (order creator)               |
| `receiver`             | TEXT     | Receiver address (optional)                 |
| `salt`                 | TEXT     | Unique salt for order hash                  |
| `signature`            | TEXT     | EVM signature for order                     |
| `size`                 | TEXT     | Original order size                         |
| `remaining_size`       | TEXT     | Remaining unfilled size                     |
| `trigger_count`        | INTEGER  | Number of times triggered                   |
| `next_trigger_value`   | TEXT     | Next trigger value for recurring orders     |
| `trigger_price`        | REAL     | Trigger price (if applicable)               |
| `filled_amount`        | TEXT     | Total filled amount                         |
| `created_at`           | INTEGER  | Order creation timestamp                    |
| `executed_at`          | INTEGER  | Execution timestamp (if filled)             |
| `cancelled_at`         | INTEGER  | Cancellation timestamp (if cancelled)       |
| `tx_hash`              | TEXT     | Transaction hash (if on-chain)              |
| `network`              | INTEGER  | Chain/network ID                            |
| `expiry`               | INTEGER  | Expiry timestamp (if set)                   |
| `user_signed_payload`  | TEXT     | User-signed payload (JSON or string)        |
| `one_inch_order_hashes`| TEXT     | JSON array of 1inch order hashes            |
| `raw_data`             | TEXT     | Complete JSON-serialized Order object       |

##  Order Statuses

| Status            | Description                          |
|-------------------|--------------------------------------|
| PENDING           | Order created, watcher monitoring    |
| ACTIVE            | Submitted to 1inch, awaiting fill    |
| PARTIALLY_FILLED  | Partially executed                   |
| FILLED            | Completely executed                  |
| CANCELLED         | Cancelled by user/system             |
| EXPIRED           | Expired without execution            |
| FAILED            | Execution failed                     |

##  Involved Components

| Component | Path | Responsibility | Status |
|-----------|------|----------------|---------|
| Frontend | `front/` | Order creation UI |  |
| API Server | `back/services/apiServer.ts` | REST endpoints |  |
| Order Registry | `back/services/orderRegistry.ts` | Lifecycle management |  |
| Order Watchers | `back/orders/` | Modular implementations |  |
| Storage Layer | `back/services/storage.ts` | Database persistence |  |
| Type Definitions | `common/types.ts` | Shared interfaces |  |
| Smart Contract | `contracts/DelegateSafe.sol` | Fund management |  |
