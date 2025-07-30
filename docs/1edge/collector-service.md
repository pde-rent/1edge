# Collector Service Documentation

## Overview

The Collector Service is the core data aggregation and processing component of the 1edge system. It handles real-time price data collection, index price computation, OHLC candle generation, and historical data management with comprehensive failover capabilities.

## Key Features

### 1. Real-Time Index Price Computation
- **Multi-Exchange Aggregation**: Collects price data from multiple exchanges simultaneously
- **Weighted Average Calculation**: Computes weighted bid/ask/mid prices based on configurable source weights
- **Advanced Metrics**: Calculates velocity, dispersion, and volume metrics for each trading pair
- **Performance Optimized**: Non-blocking processing with queue management and drop protection

### 2. OHLC Candle System
- **Multiple Timeframes**: Supports 5s, 20s, 1m, 5m, and 30m candles
- **Dual Storage Strategy**: 
  - **Cache**: 5s and 20s candles kept in memory for ultra-fast access
  - **Database**: 1m, 5m, 30m candles stored in per-pair SQLite databases
- **Async Processing**: Non-blocking candle computation and storage to maintain real-time performance
- **Boundary Detection**: Automatically detects timeframe boundaries and closes/opens candles

### 3. Historical Data Management
- **Automatic Gap Filling**: Uses CCXT to fetch historical data from Binance when gaps are detected
- **Data Integrity**: Maintains at least 2 weeks of historical data for all trading pairs
- **Startup Validation**: Runs sanity checks on startup to ensure data completeness
- **Timeframe Construction**: Builds higher timeframe data (5m, 30m) from 1m base data

### 4. High-Performance Pub/Sub Architecture
- **ZeroMQ Integration**: Uses dedicated pub/sub server for internal messaging
- **Scalable Broadcasting**: Publishes index prices and OHLC data to multiple subscribers
- **Rate Limiting**: Prevents overwhelming subscribers with configurable publishing intervals

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Exchange A    │    │   Exchange B    │    │   Exchange C    │
│   WebSocket     │    │   WebSocket     │    │   WebSocket     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Collector Service     │
                    │                         │
                    │ ┌─────────────────────┐ │
                    │ │  Index Calculator   │ │
                    │ │  - Weighted Avg     │ │
                    │ │  - Dispersion       │ │
                    │ │  - Velocity         │ │
                    │ └─────────────────────┘ │
                    │                         │
                    │ ┌─────────────────────┐ │
                    │ │  OHLC Processor     │ │
                    │ │  - Boundary Check   │ │
                    │ │  - Candle Update    │ │
                    │ │  - Async Storage    │ │
                    │ └─────────────────────┘ │
                    └─────────┬───────────────┘
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼─────────┐    ┌▼──────────┐   ┌▼─────────────┐
    │   Cache Storage   │    │ SQLite    │   │  Pub/Sub     │
    │   (5s, 20s)      │    │ DBs       │   │  Server      │
    │   - Memory        │    │ (1m,5m,   │   │  (ZeroMQ)    │
    │   - Ring Buffer   │    │  30m)     │   │              │
    └───────────────────┘    └───────────┘   └──┬───────────┘
                                                │
                            ┌───────────────────┼───────────────────┐
                            │                   │                   │
                  ┌─────────▼─────────┐ ┌──────▼──────┐ ┌─────────▼─────────┐
                  │   API Server      │ │ WebSocket   │ │ Order Executor    │
                  │   - REST API      │ │ Server      │ │ - Strategy Feeds  │
                  │   - OHLC Data     │ │ - Real-time │ │ - Price Triggers  │
                  └───────────────────┘ └─────────────┘ └───────────────────┘
```

## Data Flow

### 1. Price Data Ingestion
```
Exchange WebSocket → onTickerUpdate → calculateWeightedAverages → OHLC Processing → Pub/Sub Broadcast
```

### 2. OHLC Candle Processing
```
Price Update → Timeframe Check → Boundary Detection → Candle Close/Open → Async Storage → Cache/DB
```

### 3. Historical Data Flow
```
Startup → Data Sanity Check → CCXT Fetch → Timeframe Construction → SQLite Storage
```

## Storage Architecture

### Per-Pair Database Structure
Each trading pair (e.g., BTCUSDT) has its own SQLite database with the following tables:

```sql
-- 1-minute candles
CREATE TABLE candles_1m (
  timestamp INTEGER PRIMARY KEY,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 5-minute candles
CREATE TABLE candles_5m (
  timestamp INTEGER PRIMARY KEY,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 30-minute candles  
CREATE TABLE candles_30m (
  timestamp INTEGER PRIMARY KEY,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);
```

### Cache Structure
Short-timeframe candles are kept in memory:
```typescript
interface CacheEntry {
  candles: OHLCCandle[];
  maxSize: number; // Ring buffer size
}

// Cache limits
{
  5: 720,   // 1 hour of 5s candles
  20: 180,  // 1 hour of 20s candles
}
```

## API Endpoints

### OHLC Data Retrieval
```
GET /ohlc/{symbol}?timeframe={seconds}&startTime={timestamp}&endTime={timestamp}&limit={number}
```

**Parameters:**
- `symbol`: Trading pair (e.g., `binance:spot:BTCUSDT`)
- `timeframe`: Timeframe in seconds (5, 20, 60, 300, 1800)
- `startTime`: Start timestamp (optional)
- `endTime`: End timestamp (optional)
- `limit`: Maximum number of candles (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "binance:spot:BTCUSDT",
    "timeframe": 60,
    "candles": [
      {
        "timestamp": 1640995200000,
        "open": 47000.5,
        "high": 47100.0,
        "low": 46900.0,
        "close": 47050.0,
        "volume": 1250.75
      }
    ],
    "count": 1
  }
}
```

### Data Statistics
```
GET /ohlc-stats/{symbol}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "binance:spot:BTCUSDT",
    "statistics": {
      "60": {
        "count": 20160,
        "oldest": "2024-01-01T00:00:00.000Z",
        "newest": "2024-01-15T00:00:00.000Z"
      },
      "300": {
        "count": 4032,
        "oldest": "2024-01-01T00:00:00.000Z",
        "newest": "2024-01-15T00:00:00.000Z"
      },
      "5_cache": {
        "count": 720,
        "maxSize": 720
      }
    }
  }
}
```

## Configuration

### Collector Configuration
```typescript
interface CollectorConfig {
  pollIntervalMs: number;
  tickers: Record<Symbol, AggregatedTickerConfig>;
}

interface AggregatedTickerConfig {
  id: Symbol;
  name: string;
  tf: TimeFrame;
  lookback: number;
  sources: Record<Symbol, { weight: number }>;
}
```

### Example Configuration
```json
{
  "collector": {
    "pollIntervalMs": 1000,
    "tickers": {
      "binance:spot:BTCUSDT": {
        "id": "binance:spot:BTCUSDT",
        "name": "Bitcoin/USDT",
        "tf": 60,
        "lookback": 3600,
        "sources": {
          "binance:spot:BTCUSDT": { "weight": 1.0 },
          "coinbase:spot:BTC-USD": { "weight": 0.8 }
        }
      }
    }
  }
}
```

## Performance Characteristics

### Metrics Tracked
- **Average Calculation Time**: Time to compute index prices
- **Max Calculation Time**: Peak calculation latency
- **Average Publish Time**: Time to broadcast updates
- **Max Publish Time**: Peak publish latency
- **Total Processed**: Number of price updates processed
- **Dropped Updates**: Updates dropped due to backpressure

### Performance Optimizations
1. **Non-blocking Processing**: Uses `setImmediate` for async operations
2. **Queue Management**: Limits pending updates per symbol (max 3)
3. **Batch Operations**: Groups database writes for efficiency
4. **Ring Buffers**: Efficient memory management for cache storage
5. **Concurrent Processing**: Parallel processing across trading pairs

## Monitoring & Logging

### Health Checks
- Database connectivity validation
- Historical data completeness verification
- WebSocket connection status monitoring
- Pub/Sub server availability checks

### Log Levels
- **INFO**: Service lifecycle events, data sanity results
- **DEBUG**: Individual candle saves, cache operations
- **ERROR**: WebSocket errors, database failures, CCXT issues
- **WARN**: Missing data, configuration issues

### Metrics Export
Statistics are logged every 60 seconds:
```
Collector stats: 5 indexes | Clients: 3 | Performance: {"avgCalc":"0.45ms","maxCalc":"2.10ms","avgPub":"1.20ms","maxPub":"5.30ms","processed":15420,"dropped":0}
```

## Error Handling & Recovery

### WebSocket Failures
- Automatic reconnection with configurable intervals (5s default)
- Graceful degradation when sources become unavailable
- Weight redistribution across active sources

### Database Failures
- Transaction rollback on write failures
- Queue persistence during temporary outages
- Automatic retry mechanisms for transient errors

### Historical Data Failures
- Fallback to alternative data sources
- Partial data reconstruction from available timeframes
- Graceful startup with incomplete historical data

## Scalability Considerations

### Horizontal Scaling
- Each trading pair can be processed independently
- Database files are isolated per pair for parallel access
- Pub/Sub architecture supports multiple collector instances

### Vertical Scaling
- Memory usage scales with number of cached timeframes
- Database storage grows linearly with data retention
- CPU usage scales with update frequency and pair count

### Resource Requirements
- **Memory**: ~10MB per trading pair for cache storage
- **Disk**: ~50MB per trading pair per year for historical data
- **CPU**: ~5% per trading pair at 1Hz update frequency
- **Network**: ~1KB/s per trading pair for WebSocket data

## Development & Testing

### Local Development
```bash
# Start collector service
bun run start:collector

# Test WebSocket connections
bun run test:websocket

# Check service status
curl http://localhost:40005/services/status
```

### API Testing
```bash
# Get OHLC data
curl "http://localhost:40005/ohlc/binance:spot:BTCUSDT?timeframe=60&limit=100"

# Get data statistics
curl "http://localhost:40005/ohlc-stats/binance:spot:BTCUSDT"
```

### Database Inspection
```bash
# Connect to pair database
sqlite3 ./data/ohlc/BTCUSDT.db

# Check candle counts
SELECT COUNT(*) FROM candles_1m;
SELECT MIN(timestamp), MAX(timestamp) FROM candles_1m;
```

## Future Enhancements

### Planned Features
1. **Data Compression**: Implement compression for long-term storage
2. **Distributed Storage**: Support for distributed database backends
3. **Advanced Analytics**: Real-time technical indicator computation
4. **Data Export**: CSV/Parquet export functionality
5. **Backup System**: Automated backup and recovery procedures

### Performance Improvements
1. **Batch Processing**: Larger batch sizes for database operations
2. **Connection Pooling**: Database connection optimization
3. **Memory Optimization**: More efficient cache data structures
4. **Parallel Processing**: Multi-threaded OHLC computation

## Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check cache sizes
curl "http://localhost:40005/ohlc-stats/binance:spot:BTCUSDT"

# Reduce cache limits in configuration
# Restart collector service
```

#### Missing Historical Data
```bash
# Check data gaps
sqlite3 ./data/ohlc/BTCUSDT.db "SELECT MIN(timestamp), MAX(timestamp) FROM candles_1m"

# Force re-fetch (delete database and restart)
rm ./data/ohlc/BTCUSDT.db
bun run start:collector
```

#### WebSocket Connection Issues
```bash
# Check network connectivity
curl -I https://api.binance.com/api/v3/ping

# Review collector logs
tail -f logs/collector.log
```

#### Database Lock Errors
```bash
# Check for concurrent access
lsof ./data/ohlc/BTCUSDT.db

# Stop all services and restart
bun run kill:all
bun run start:services
```

This collector service provides a robust foundation for real-time price data processing and historical data management, ensuring high availability and performance for trading strategy execution.