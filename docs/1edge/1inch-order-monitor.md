# 1inch Order Monitor Architecture

## Overview

The 1inch Order Monitor system tracks the execution status of 1inch limit orders created by 1edge order watchers. This system provides real-time monitoring of order fills, remaining amounts, and status changes through a pub/sub architecture similar to the existing price feed system.

## Architecture Components

### 1. oneInchOrderMonitor Service

**Location**: `@back/services/oneInchOrderMonitor.ts`

The monitor service polls the 1inch API to track order status and pushes updates through websockets.

**Key Features**:
- Polls 1inch API using the pattern shown in user example
- Tracks orders by DelegateProxy address
- Pushes real-time updates via pub/sub
- Handles API rate limiting and error recovery
- Monitors multiple order statuses: active, partially filled, filled, expired

**API Integration**:
```javascript
// Base endpoint for BSC (chain 56)
const url = "https://api.1inch.dev/orderbook/v4.0/56/address/{delegateProxyAddress}";

// Authentication
headers: {
  Authorization: "Bearer T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu"
}

// Query parameters
params: {
  page: 1,
  limit: "500", 
  statuses: "1,2,3" // Active, partially filled, filled
}
```

**Update Frequency**: Every 10 seconds (configurable)

### 2. oneInchOrderCache Service

**Location**: `@back/services/oneInchOrderCache.ts`

Caches 1inch order data and provides fast access to order states, similar to `priceCache.ts`.

**Key Features**:
- Subscribes to oneInchOrderMonitor updates
- Maintains in-memory cache of order states
- Provides getter methods for order data by hash
- Supports bulk queries for multiple orders
- Tracks order metadata (creation time, last update, etc.)

**Data Structure**:
```typescript
interface OneInchOrderData {
  orderHash: string;
  createDateTime: string;
  remainingMakerAmount: string;
  makerBalance: string;
  makerAllowance: string;
  data: {
    makerAsset: string;
    takerAsset: string;
    makingAmount: string;
    takingAmount: string;
    // ... complete 1inch order data
  };
  makerRate: string;
  takerRate: string;
  isMakerContract: boolean;
  orderInvalidReason?: string;
  lastUpdate: number; // Timestamp of last cache update
}
```

### 3. Base Order Watcher Integration

**Location**: `@back/orders/base.ts`

Each order watcher monitors its underlying 1inch orders using the shared cache.

**Key Changes**:
- `updateOrderFromOnChain()` method uses `oneInchOrderCache` instead of direct DelegateProxy calls
- Real-time status updates without blockchain queries
- Faster order state transitions
- Improved error handling and retry logic

**Monitoring Flow**:
1. Watcher triggers and creates 1inch order
2. Order hash stored in `order.oneInchOrderHashes`
3. Watcher polls `oneInchOrderCache.getOrder(hash)` for status
4. Cache data used to update 1edge order status
5. Status changes pushed to `orderRegistry`

### 4. OrderRegistry Integration

**Location**: `@back/services/orderRegistry.ts`

Enhanced to expose real-time 1inch order data through API endpoints.

**New API Endpoints**:
- `GET /orders/{orderId}/1inch` - Get all 1inch orders for a 1edge order
- `GET /1inch-orders/{hash}` - Get specific 1inch order data
- `GET /1inch-orders` - Get all cached 1inch orders

**Real-time Updates**:
- Order status changes immediately reflected in API responses
- WebSocket notifications for order state changes
- Bulk order status queries for dashboard views

## Data Flow

```
1inch API í oneInchOrderMonitor í pubSubServer í oneInchOrderCache
                                                      ì
orderWatchers ê orderRegistry ê storage ê baseOrderWatcher
```

**Detailed Flow**:

1. **Monitoring Phase**:
   - `oneInchOrderMonitor` polls 1inch API every 10 seconds
   - Fetches orders for DelegateProxy address
   - Compares with cached data to detect changes
   - Publishes updates to `pubSubServer` on channel `1inch-orders.{hash}`

2. **Caching Phase**:
   - `oneInchOrderCache` subscribes to all `1inch-orders.*` channels
   - Updates in-memory cache with new order data
   - Maintains order metadata and timestamps

3. **Watcher Phase**:
   - `baseOrderWatcher.updateOrderFromOnChain()` queries cache instead of blockchain
   - Fast access to current order state
   - Updates 1edge order status based on 1inch order fills
   - Saves updated order to database

4. **Registry Phase**:
   - `orderRegistry` exposes cached data through HTTP API
   - Real-time order status available to frontend
   - WebSocket notifications for status changes

## Configuration

**Environment Variables**:
- `ONE_INCH_API_KEY` - 1inch API authentication token
- `ONE_INCH_MONITOR_INTERVAL` - Polling interval (default: 10000ms)
- `DELEGATE_PROXY_ADDRESS` - Address to monitor orders for

**Service Configuration** (`config.json`):
```json
{
  "oneInchMonitor": {
    "enabled": true,
    "apiKey": "${ONE_INCH_API_KEY}",
    "chainId": 56,
    "pollInterval": 10000,
    "delegateProxyAddress": "${DELEGATE_PROXY_ADDRESS}",
    "maxOrdersPerPage": 500,
    "retryAttempts": 3,
    "retryDelay": 5000
  }
}
```

## Error Handling

**API Failures**:
- Exponential backoff for rate limiting
- Fallback to blockchain queries if API unavailable
- Error notifications through logging system
- Service health monitoring

**Cache Inconsistency**:
- Periodic cache validation against blockchain
- Automatic cache refresh on detected inconsistencies
- Graceful degradation to direct blockchain queries

## Performance Considerations

**Caching Strategy**:
- In-memory cache for fastest access
- TTL-based cache invalidation
- Bulk API queries to minimize requests
- Selective monitoring (only active orders)

**Scalability**:
- Horizontal scaling through pub/sub architecture
- Multiple monitor instances for different chains
- Load balancing for high-frequency updates
- Database optimization for order storage

## Monitoring & Observability

**Metrics**:
- API response times and success rates
- Cache hit/miss ratios
- Order status transition counts
- WebSocket connection counts

**Logging**:
- Order status changes with timestamps
- API errors and retry attempts
- Cache operations and performance
- Service health and connectivity

## Benefits

1. **Real-time Updates**: Immediate notification of order fills and status changes
2. **Reduced Blockchain Queries**: Faster updates without RPC calls
3. **Scalable Architecture**: Supports multiple orders and chains
4. **Consistent Data**: Shared cache ensures all components see same state
5. **Better UX**: Fast API responses for frontend dashboards
6. **Robust Monitoring**: Comprehensive order lifecycle tracking

## Implementation Priority

1.  Architecture documentation (this document)
2. = Implement `oneInchOrderMonitor` service
3. = Create `oneInchOrderCache` service  
4. = Update `baseOrderWatcher` to use cache
5. = Enhance `orderRegistry` with 1inch data endpoints
6. = Add WebSocket notifications for real-time updates
7. = Testing and integration with existing e2e tests