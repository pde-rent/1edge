import { cacheTicker, getCachedTicker } from "@back/services/memoryStorage";
import { logger } from "@back/utils/logger";
import {
  AggregatedTicker,
  AggregatedTickerConfig,
  FeedStatus,
  PairSymbol,
  TickerConfig,
  TickerFeed,
  TickerOHLCV,
  TickerTick,
  TimeFrame,
} from "@common/types";
import { roundSig, sleep } from "@common/utils";
import type { Ticker as CcxtTicker } from "ccxt";
import ccxt from "ccxt";
import { analyse } from "./analysis";

// In-memory stores
const aggregatedDataStore: Record<PairSymbol, AggregatedTicker> = {};
const activeExchanges: Record<string, any> = {};

/**
 * Parses a Symbol string into its components.
 */
function parseSymbol(
  symbolInput: PairSymbol,
):
  | { exchangeId: string; marketType?: string; tickerSymbol: string }
  | undefined {
  const parts = String(symbolInput).split(":");
  if (parts.length === 3) {
    return {
      exchangeId: parts[0],
      marketType: parts[1] === "undefined" ? undefined : parts[1],
      tickerSymbol: parts[2],
    };
  } else if (parts.length === 2) {
    return { exchangeId: parts[0], tickerSymbol: parts[1] };
  }
  logger.error(`[ParseSymbol] Invalid symbol format: ${symbolInput}`);
  return undefined;
}

/**
 * Fetch ticker data on an exchange REST API.
 */
export async function getCexTicker(
  symbolInput: PairSymbol,
): Promise<CcxtTicker | undefined> {
  const parsed = parseSymbol(symbolInput);
  if (!parsed) return undefined;
  const { exchangeId, tickerSymbol } = parsed;

  try {
    const ex = await getExchange(exchangeId);
    if (!ex.has["fetchTicker"]) {
      logger.error(`[REST] ${exchangeId} cannot fetchTicker.`);
      return undefined;
    }
    const ticker = await ex.fetchTicker(tickerSymbol);
    if (ticker?.last === undefined) {
      return undefined;
    }
    return ticker;
  } catch (err: any) {
    logger.error(
      `[REST] Error ${exchangeId}:${tickerSymbol} - ${err.message || err}`,
    );
    return undefined;
  }
}

/**
 * Get an exchange singleton instance with WebSocket support.
 */
export async function getExchange(exchangeId: string): Promise<any> {
  if (activeExchanges[exchangeId]) return activeExchanges[exchangeId];

  const ctor = (ccxt as any).pro[exchangeId] || (ccxt as any)[exchangeId];
  if (!ctor) throw new Error(`ccxt exchange ${exchangeId} not found.`);

  // Exchange-specific configuration for rate limiting
  const exchangeConfig: any = {
    enableRateLimit: true,
    rateLimit: exchangeId === "bitget" ? 1200 : 1000, // Slower rate for Bitget
  };

  // Add exchange-specific options
  if (exchangeId === "bitget") {
    exchangeConfig.options = {
      defaultType: "spot", // Use spot trading by default
      recvWindow: 10000, // Larger receive window
    };
  }

  const ex = new ctor(exchangeConfig);

  // Retry market loading with exponential backoff
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount <= maxRetries) {
    try {
      await ex.loadMarkets();
      activeExchanges[exchangeId] = ex;
      return ex;
    } catch (error: any) {
      retryCount++;

      if (
        error.message?.includes("429") ||
        error.message?.includes("Too Many Requests")
      ) {
        const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10s
        logger.warn(
          `[${exchangeId}] Rate limited, retrying in ${backoffMs}ms (attempt ${retryCount}/${maxRetries})`,
        );
        await sleep(backoffMs);
      } else if (retryCount > maxRetries) {
        logger.error(
          `[${exchangeId}] Failed to connect after ${maxRetries} attempts:`,
          error.message,
        );
        throw error;
      } else {
        logger.warn(
          `[${exchangeId}] Connection attempt ${retryCount} failed:`,
          error.message,
        );
        await sleep(2000 * retryCount);
      }
    }
  }

  throw new Error(
    `Failed to connect to ${exchangeId} after ${maxRetries} attempts`,
  );
}

/**
 * Update the weighted average for a destination ticker.
 */
function updateWeightedAvg(aggSymbol: PairSymbol): void {
  const aggTicker = aggregatedDataStore[aggSymbol];
  if (!aggTicker || !aggTicker.sources) return;

  let totalMid = 0;
  let totalWeight = 0;

  for (const [srcSymbol, srcFeed] of Object.entries(aggTicker.sources)) {
    const config = aggTicker.sources[srcSymbol as PairSymbol];
    if (config && srcFeed.last?.mid) {
      const weight = (config as any).weight || 1;
      totalMid += srcFeed.last.mid * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight > 0) {
    const weightedMid = totalMid / totalWeight;
    aggTicker.last.mid = roundSig(weightedMid, 6);
    aggTicker.last.bid = roundSig(weightedMid * 0.9995, 6); // 0.05% spread
    aggTicker.last.ask = roundSig(weightedMid * 1.0005, 6);
    aggTicker.last.last = weightedMid;
    aggTicker.last.timestamp = Date.now();
    aggTicker.updatedAt = Date.now();
  }
}

/**
 * Fetch OHLCV data for a ticker.
 */
async function fetchOHLCV(
  symbol: PairSymbol,
  timeframe: TimeFrame,
  limit: number = 100,
): Promise<TickerOHLCV | undefined> {
  const parsed = parseSymbol(symbol);
  if (!parsed) return undefined;
  const { exchangeId, tickerSymbol } = parsed;

  try {
    const ex = await getExchange(exchangeId);
    if (!ex.has["fetchOHLCV"]) {
      logger.error(`[OHLCV] ${exchangeId} cannot fetchOHLCV.`);
      return undefined;
    }

    const tfMap: Record<number, string> = {
      [TimeFrame.M1]: "1m",
      [TimeFrame.M5]: "5m",
      [TimeFrame.M15]: "15m",
      [TimeFrame.M30]: "30m",
      [TimeFrame.H1]: "1h",
      [TimeFrame.H4]: "4h",
      [TimeFrame.D1]: "1d",
    };

    const tf = tfMap[timeframe] || "1m";
    const ohlcv = await ex.fetchOHLCV(tickerSymbol, tf, undefined, limit);

    if (!ohlcv || ohlcv.length === 0) {
      return undefined;
    }

    // Convert to our format
    const result: TickerOHLCV = {
      ts: [],
      o: [],
      h: [],
      l: [],
      c: [],
      v: [],
    };

    for (const candle of ohlcv) {
      result.ts.push(candle[0]);
      result.o.push(candle[1]);
      result.h.push(candle[2]);
      result.l.push(candle[3]);
      result.c.push(candle[4]);
      result.v.push(candle[5]);
    }

    return result;
  } catch (err: any) {
    logger.error(
      `[OHLCV] Error ${exchangeId}:${tickerSymbol} - ${err.message || err}`,
    );
    return undefined;
  }
}

/**
 * Initialize ticker feed with data.
 */
async function initializeTickerFeed(
  symbol: PairSymbol,
  config: TickerConfig | AggregatedTickerConfig,
): Promise<TickerFeed> {
  const ticker = await getCexTicker(symbol);
  const ohlcv = await fetchOHLCV(symbol, config.tf);
  const parsed = parseSymbol(symbol);

  const feed: TickerFeed = {
    id: symbol,
    exchange: parsed?.exchangeId || "unknown",
    tf: config.tf,
    status: ticker ? FeedStatus.ACTIVE : FeedStatus.ERROR,
    last: {
      bid: ticker?.bid || 0,
      ask: ticker?.ask || 0,
      mid: ((ticker?.bid || 0) + (ticker?.ask || 0)) / 2,
      last: ticker?.last || 0,
      volume: ticker?.quoteVolume || 0,
      timestamp: Date.now(),
    },
    history: ohlcv || { ts: [], o: [], h: [], l: [], c: [], v: [] },
    updatedAt: Date.now(),
  };

  // Analyze if we have history
  if (ohlcv && ohlcv.c.length > 0) {
    feed.analysis = analyse(ohlcv);
  }

  return feed;
}

/**
 * Update a single source ticker.
 */
async function updateSourceTicker(
  symbol: PairSymbol,
  config: TickerConfig,
): Promise<TickerFeed | undefined> {
  try {
    // Check cache first
    const cached = await getCachedTicker(symbol);
    if (cached && "last" in cached) {
      return cached as TickerFeed;
    }

    // Fetch fresh data
    const feed = await initializeTickerFeed(symbol, config);

    // Cache the result
    await cacheTicker(symbol, feed, config.ttl);

    return feed;
  } catch (err: any) {
    logger.error(`[UpdateSource] Error updating ${symbol}: ${err.message}`);
    return undefined;
  }
}

/**
 * Update an aggregated ticker.
 */
export async function updateAggregatedTicker(
  aggSymbol: PairSymbol,
  config: AggregatedTickerConfig,
): Promise<AggregatedTicker> {
  // Initialize if not exists
  if (!aggregatedDataStore[aggSymbol]) {
    aggregatedDataStore[aggSymbol] = {
      id: aggSymbol,
      exchange: "aggregate",
      tf: config.tf,
      status: FeedStatus.INACTIVE,
      last: { bid: 0, ask: 0, mid: 0, last: 0, timestamp: 0 },
      history: { ts: [], o: [], h: [], l: [], c: [], v: [] },
      sources: {},
      updatedAt: 0,
    };
  }

  const aggTicker = aggregatedDataStore[aggSymbol];

  // Update all sources
  const updatePromises = Object.entries(config.sources).map(
    async ([srcSymbol, srcConfig]) => {
      const feed = await updateSourceTicker(
        srcSymbol as PairSymbol,
        {
          id: srcSymbol as PairSymbol,
          name: srcSymbol,
          exchange:
            parseSymbol(srcSymbol as PairSymbol)?.exchangeId || "unknown",
          tf: config.tf,
          lookback: config.lookback,
          ttl: 60, // 1 minute cache for sources
          weight: srcConfig.weight,
        } as TickerConfig,
      );

      if (feed) {
        aggTicker.sources[srcSymbol as PairSymbol] = feed;
      }
    },
  );

  await Promise.all(updatePromises);

  // Update weighted average
  updateWeightedAvg(aggSymbol);

  // Update status
  const activeSourceCount = Object.values(aggTicker.sources).filter(
    (src) => src.status === FeedStatus.ACTIVE,
  ).length;

  aggTicker.status =
    activeSourceCount > 0 ? FeedStatus.ACTIVE : FeedStatus.ERROR;

  // Cache aggregated data
  await cacheTicker(aggSymbol, aggTicker, 300); // 5 minute cache

  return aggTicker;
}

/**
 * Get current ticker data.
 */
export async function getTicker(
  symbol: PairSymbol,
): Promise<TickerFeed | AggregatedTicker | null> {
  // Check if it's an aggregated ticker
  if (symbol.startsWith("agg:")) {
    return aggregatedDataStore[symbol] || null;
  }

  // Check cache for regular ticker
  return await getCachedTicker(symbol);
}

/**
 * Initialize aggregated ticker in store if not exists.
 */
function initAgg(
  aggSymbol: PairSymbol,
  aggCfg: AggregatedTickerConfig,
): AggregatedTicker {
  if (!aggregatedDataStore[aggSymbol]) {
    aggregatedDataStore[aggSymbol] = {
      id: aggSymbol,
      exchange: "aggregate",
      tf: aggCfg.tf,
      status: FeedStatus.INACTIVE,
      last: { bid: 0, ask: 0, mid: 0, last: 0, volume: 0, timestamp: 0 },
      history: { ts: [], o: [], h: [], l: [], c: [], v: [] },
      sources: {},
      updatedAt: 0,
    };
  }
  return aggregatedDataStore[aggSymbol];
}

/**
 * Initialize source ticker in aggregated ticker.
 */
function initSrc(
  agg: AggregatedTicker,
  srcCfg: TickerConfig,
  timestamp: number,
): TickerFeed {
  if (!agg.sources[srcCfg.id]) {
    const parsed = parseSymbol(srcCfg.id);
    agg.sources[srcCfg.id] = {
      id: srcCfg.id,
      exchange: parsed?.exchangeId || "unknown",
      tf: srcCfg.tf,
      status: FeedStatus.INACTIVE,
      last: { bid: 0, ask: 0, mid: 0, last: 0, volume: 0, timestamp },
      history: { ts: [], o: [], h: [], l: [], c: [], v: [] },
      updatedAt: timestamp,
    };
  }
  return agg.sources[srcCfg.id];
}

/**
 * Get Unix timestamp floored to timeframe.
 */
function getUnixTimeFloor(timestamp: number, tf: number): number {
  return Math.floor(timestamp / (tf * 1000)) * tf;
}

/**
 * Record a candle tick in OHLCV history.
 */
function recordCandle(
  history: TickerOHLCV,
  price: number,
  vol: number,
  tf: number,
  lb: number,
  analysisTarget?: AggregatedTicker,
): void {
  const t0 = getUnixTimeFloor(Date.now(), tf);
  if (history.ts[0] !== t0) {
    history.ts.unshift(t0);
    history.o.unshift(price);
    history.h.unshift(price);
    history.l.unshift(price);
    history.c.unshift(price);
    history.v.unshift(vol);
  } else {
    history.h[0] = Math.max(history.h[0], price);
    history.l[0] = Math.min(history.l[0], price);
    history.c[0] = price;
    history.v[0] += vol;
  }
  const max = Math.ceil(lb / tf);
  while (history.ts.length > max) {
    history.ts.pop();
    history.o.pop();
    history.h.pop();
    history.l.pop();
    history.c.pop();
    history.v.pop();
  }
  if (analysisTarget) {
    const analysis = analyse(history);
    analysisTarget.analysis = analysis;
  }
}

/**
 * Build full source config from aggregated config.
 */
function buildFullSrcCfg(
  srcSymbol: string,
  srcConfig: any,
  aggCfg: AggregatedTickerConfig,
): TickerConfig {
  const parsed = parseSymbol(srcSymbol as PairSymbol);
  return {
    id: srcSymbol as PairSymbol,
    name: srcSymbol,
    exchange: parsed?.exchangeId || "unknown",
    tf: aggCfg.tf,
    lookback: aggCfg.lookback,
    ttl: 60,
    weight: srcConfig.weight || 1,
  } as TickerConfig;
}

/**
 * Ensure aggregated ticker exists in store.
 */
function ensureAggStore(
  dest: PairSymbol,
  aggCfg: AggregatedTickerConfig,
): void {
  if (!aggregatedDataStore[dest]) {
    aggregatedDataStore[dest] = {
      id: dest,
      exchange: "aggregate",
      tf: aggCfg.tf,
      status: FeedStatus.INACTIVE,
      last: { bid: 0, ask: 0, mid: 0, last: 0, volume: 0, timestamp: 0 },
      history: { ts: [], o: [], h: [], l: [], c: [], v: [] },
      sources: {},
      updatedAt: 0,
      lookback: aggCfg.lookback,
    };
  }
}

// Exchange connection tracking for batched subscriptions
interface BatchedConnection {
  exchange: any | null;
  subscriptions: Map<
    string,
    {
      aggSymbol: PairSymbol;
      srcCfg: TickerConfig;
      aggCfg: AggregatedTickerConfig;
    }
  >;
  stopSignal: { stop: boolean };
  isRunning: boolean;
}

const batchedConnections = new Map<string, BatchedConnection>();

/**
 * Get or create a batched connection for an exchange.
 */
async function getBatchedConnection(
  exchangeId: string,
  onUpdate: (dest: PairSymbol, data: AggregatedTicker) => void,
  onError: (err: any) => void,
  reconnectMs: number,
): Promise<BatchedConnection> {
  if (batchedConnections.has(exchangeId)) {
    return batchedConnections.get(exchangeId)!;
  }

  const connection: BatchedConnection = {
    exchange: null, // Will be set when ready
    subscriptions: new Map(),
    stopSignal: { stop: false },
    isRunning: false,
  };

  batchedConnections.set(exchangeId, connection);

  // Initialize exchange connection in background
  getExchange(exchangeId)
    .then((exchange) => {
      connection.exchange = exchange;
      // Start monitoring loop if we have subscriptions and aren't already running
      if (connection.subscriptions.size > 0 && !connection.isRunning) {
        void startBatchedTickerLoop(
          exchangeId,
          connection,
          onUpdate,
          onError,
          reconnectMs,
        );
      }
    })
    .catch((error) => {
      logger.error(`❌ Failed to initialize exchange ${exchangeId}:`, error);
      onError(error);
    });

  return connection;
}

/**
 * Start the batched ticker monitoring loop for an exchange.
 */
async function startBatchedTickerLoop(
  exchangeId: string,
  connection: BatchedConnection,
  onUpdate: (dest: PairSymbol, data: AggregatedTicker) => void,
  onError: (err: any) => void,
  reconnectMs: number,
): Promise<void> {
  if (connection.isRunning) return;
  connection.isRunning = true;

  while (!connection.stopSignal.stop) {
    try {
      if (!connection.exchange) {
        await sleep(1000); // Wait for exchange to be ready
        continue;
      }

      if (connection.subscriptions.size === 0) {
        await sleep(1000); // Wait for subscriptions to be added
        continue;
      }

      // Get all symbols for this exchange
      const symbols = Array.from(connection.subscriptions.keys());

      // Use batch ticker fetching to avoid rate limits
      let tickerData: Record<string, any> = {};
      const fetchStart = Date.now();

      try {
        // Try to use batch ticker fetching if available
        if (connection.exchange.has["fetchTickers"]) {
          const tickers = await connection.exchange.fetchTickers(symbols);
          tickerData = tickers;
        } else {
          // Fallback: fetch tickers individually with delay
          for (const symbol of symbols) {
            try {
              const ticker = await connection.exchange.fetchTicker(symbol);
              tickerData[symbol] = ticker;
              // Add small delay to avoid rate limiting
              await sleep(100);
            } catch (tickerError) {
              logger.warn(
                `[Batch:${exchangeId}] Failed to fetch ${symbol}: ${tickerError.message}`,
              );
            }
          }
        }

        const fetchTime = Date.now() - fetchStart;
        const validTickers = Object.keys(tickerData).length;

        // Log batch summary only if we have activity
        if (validTickers > 0) {
        }
      } catch (batchError) {
        logger.error(`[Batch:${exchangeId}] Batch fetch failed:`, batchError);
        // If batch fails, try WebSocket for individual symbols
        await handleWebSocketFallback(
          exchangeId,
          connection,
          onUpdate,
          onError,
        );
        continue;
      }

      // Process each ticker update
      let processedCount = 0;
      let updatedSymbols: string[] = [];

      // Create mapping from exchange-specific symbols to CCXT standardized symbols
      const symbolMap = new Map<string, string>();
      for (const [tickerSymbol] of connection.subscriptions) {
        // tickerSymbol is exchange-specific (e.g., "BTC-USDT" for OKX, "BTCUSDT" for Binance)
        // We need to find the corresponding CCXT key (e.g., "BTC/USDT")
        for (const ccxtKey of Object.keys(tickerData)) {
          // Convert CCXT key to exchange format for comparison
          const exchangeKey = ccxtKey.replace(
            "/",
            exchangeId === "okx" ? "-" : "",
          );
          if (exchangeKey === tickerSymbol) {
            symbolMap.set(tickerSymbol, ccxtKey);
            break;
          }
        }
      }

      for (const [tickerSymbol, subscription] of connection.subscriptions) {
        const ccxtKey = symbolMap.get(tickerSymbol);
        const ticker = ccxtKey ? tickerData[ccxtKey] : undefined;
        if (!ticker || !ticker.last) {
          continue;
        }

        const { aggSymbol, srcCfg, aggCfg } = subscription;
        processedCount++;
        updatedSymbols.push(aggSymbol);

        // Update data structures
        const price = ticker.last;
        const bid = ticker.bid || price;
        const ask = ticker.ask || price;
        const timestamp = ticker.timestamp || Date.now();
        const baseVolume = ticker.baseVolume || 0;
        const mid = (bid + ask) / 2;

        const agg = initAgg(aggSymbol, aggCfg);
        const src = initSrc(agg, srcCfg, timestamp);
        src.last = {
          bid,
          ask,
          mid,
          last: price,
          volume: baseVolume,
          timestamp,
        };
        src.status = FeedStatus.ACTIVE;
        src.updatedAt = timestamp;

        // Update weighted average
        updateWeightedAvg(aggSymbol);
        agg.status = FeedStatus.ACTIVE;

        // Record candle data
        recordCandle(
          agg.history,
          agg.last.mid,
          baseVolume,
          agg.tf || 60,
          agg.lookback || 86400,
          agg,
        );

        // Trigger update callback
        onUpdate(aggSymbol, agg);

        // Cache the result
        await cacheTicker(aggSymbol, agg, 300);
      }

      // Log processing summary
      if (processedCount > 0) {
      }

      // Wait before next batch update (adjust based on exchange rate limits)
      const batchDelay = exchangeId === "bitget" ? 2000 : 1000; // 2s for Bitget, 1s for others
      await sleep(batchDelay);
    } catch (err) {
      onError(err);
      logger.error(`[Batch:${exchangeId}] error:`, err);
      await sleep(reconnectMs);

      // Recreate exchange connection
      delete activeExchanges[exchangeId];
      try {
        connection.exchange = await getExchange(exchangeId);
      } catch (reconnectError) {
        logger.error(
          `[Batch:${exchangeId}] Failed to reconnect:`,
          reconnectError,
        );
      }
    }
  }

  connection.isRunning = false;
}

/**
 * Fallback to WebSocket for individual symbols when batch fails.
 */
async function handleWebSocketFallback(
  exchangeId: string,
  connection: BatchedConnection,
  onUpdate: (dest: PairSymbol, data: AggregatedTicker) => void,
  onError: (err: any) => void,
): Promise<void> {
  try {
    // Try WebSocket for the first few symbols only to avoid overwhelming
    const symbolsToTry = Array.from(connection.subscriptions.keys()).slice(
      0,
      3,
    );

    for (const tickerSymbol of symbolsToTry) {
      try {
        const subscription = connection.subscriptions.get(tickerSymbol)!;
        const { aggSymbol, srcCfg, aggCfg } = subscription;

        const trades = await (connection.exchange as any).watchTrades(
          tickerSymbol,
          undefined,
          1,
        );
        if (trades && trades[0]) {
          const trade = trades[0];
          const price = trade.price;
          const timestamp = trade.timestamp;
          const baseVolume = trade.amount;

          // Get previous bid/ask or estimate from price
          const prevFeed = aggregatedDataStore[aggSymbol]?.sources[srcCfg.id];
          const bid =
            trade.side === "sell" ? price : prevFeed?.last.bid || price;
          const ask =
            trade.side === "buy" ? price : prevFeed?.last.ask || price;
          const mid = (bid + ask) / 2;

          const agg = initAgg(aggSymbol, aggCfg);
          const src = initSrc(agg, srcCfg, timestamp);
          src.last = {
            bid,
            ask,
            mid,
            last: price,
            volume: baseVolume,
            timestamp,
          };
          src.status = FeedStatus.ACTIVE;
          src.updatedAt = timestamp;

          updateWeightedAvg(aggSymbol);
          agg.status = FeedStatus.ACTIVE;

          recordCandle(
            agg.history,
            agg.last.mid,
            baseVolume,
            agg.tf || 60,
            agg.lookback || 86400,
            agg,
          );

          onUpdate(aggSymbol, agg);
          await cacheTicker(aggSymbol, agg, 300);
        }
      } catch (wsError) {
        logger.warn(
          `[WS:${exchangeId}] WebSocket fallback failed for ${tickerSymbol}:`,
          wsError.message,
        );
      }
    }
  } catch (fallbackError) {
    logger.error(`[WS:${exchangeId}] WebSocket fallback error:`, fallbackError);
  }
}

/**
 * Add a ticker subscription to the batched connection.
 */
async function addBatchedSubscription(
  srcCfg: TickerConfig,
  aggSymbol: PairSymbol,
  aggCfg: AggregatedTickerConfig,
  onUpdate: (dest: PairSymbol, data: AggregatedTicker) => void,
  onError: (err: any) => void,
  reconnectMs: number,
): Promise<void> {
  const parsed = parseSymbol(srcCfg.id);
  if (!parsed) {
    onError(new Error(`Invalid symbol: ${srcCfg.id}`));
    return;
  }

  const { exchangeId, tickerSymbol } = parsed;
  const connection = await getBatchedConnection(
    exchangeId,
    onUpdate,
    onError,
    reconnectMs,
  );

  connection.subscriptions.set(tickerSymbol, {
    aggSymbol,
    srcCfg,
    aggCfg,
  });

  // Start monitoring loop if exchange is ready and this is the first subscription
  if (connection.exchange && !connection.isRunning) {
    void startBatchedTickerLoop(
      exchangeId,
      connection,
      onUpdate,
      onError,
      reconnectMs,
    );
  }
}

/**
 * Remove a ticker subscription from the batched connection.
 */
function removeBatchedSubscription(srcCfg: TickerConfig): void {
  const parsed = parseSymbol(srcCfg.id);
  if (!parsed) return;

  const { exchangeId, tickerSymbol } = parsed;
  const connection = batchedConnections.get(exchangeId);

  if (connection) {
    connection.subscriptions.delete(tickerSymbol);

    // Clean up empty connections
    if (connection.subscriptions.size === 0) {
      connection.stopSignal.stop = true;
      batchedConnections.delete(exchangeId);
    }
  }
}

/**
 * Subscribe to all ticker feeds with batched WebSocket streaming.
 */
export function subToTickerFeeds(
  config: Record<PairSymbol, AggregatedTickerConfig>,
  onUpdate: (destSymbol: PairSymbol, data: AggregatedTicker) => void,
  onError: (err: any) => void = (err) =>
    logger.error("General subscription error", err),
  reconnectMs = 5000,
): { close: () => void; getAllActiveSignals: () => { stop: boolean }[] } {
  const subscriptionKeys: string[] = [];

  // Group subscriptions by exchange to enable batching
  const exchangeGroups = new Map<
    string,
    Array<{
      dest: PairSymbol;
      srcKey: string;
      srcConfig: any;
      aggCfg: AggregatedTickerConfig;
    }>
  >();

  for (const [destStr, aggCfg] of Object.entries(config)) {
    const dest = destStr as PairSymbol;
    if (!aggCfg.sources || !Object.keys(aggCfg.sources).length) {
      logger.warn(`No sources for ${dest}.`);
      continue;
    }

    ensureAggStore(dest, aggCfg);

    for (const [sk, sc] of Object.entries(aggCfg.sources)) {
      const fullCfg = buildFullSrcCfg(sk, sc, aggCfg);
      const parsed = parseSymbol(fullCfg.id);
      if (!parsed) continue;

      const { exchangeId } = parsed;
      if (!exchangeGroups.has(exchangeId)) {
        exchangeGroups.set(exchangeId, []);
      }

      exchangeGroups.get(exchangeId)!.push({
        dest,
        srcKey: sk,
        srcConfig: sc,
        aggCfg,
      });

      subscriptionKeys.push(`${dest}:${sk}`);
    }
  }

  // Start batched subscriptions for each exchange in parallel

  const subscriptionPromises: Promise<void>[] = [];

  for (const [exchangeId, subscriptions] of exchangeGroups) {
    // Start all subscriptions for this exchange in parallel
    const exchangePromises = subscriptions.map(
      ({ dest, srcKey, srcConfig, aggCfg }) => {
        const fullCfg = buildFullSrcCfg(srcKey, srcConfig, aggCfg);
        return addBatchedSubscription(
          fullCfg,
          dest,
          aggCfg,
          onUpdate,
          onError,
          reconnectMs,
        );
      },
    );

    subscriptionPromises.push(...exchangePromises);
  }

  // Don't wait for all subscriptions to complete - let them run in background
  Promise.allSettled(subscriptionPromises).then((results) => {
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.length - failed;
    if (failed > 0) {
      logger.warn(
        `Subscription setup: ${succeeded} succeeded, ${failed} failed`,
      );
    }
  });

  return {
    close: () => {
      // Stop all batched connections
      for (const connection of batchedConnections.values()) {
        connection.stopSignal.stop = true;
      }

      // Clear all connections
      batchedConnections.clear();
    },
    getAllActiveSignals: () => {
      // Return all stop signals from batched connections
      return Array.from(batchedConnections.values()).map(
        (conn) => conn.stopSignal,
      );
    },
  };
}

/**
 * Subscribe to ticker updates (WebSocket implementation).
 */
export function subscribeTicker(
  symbol: PairSymbol,
  callback: (ticker: TickerTick) => void,
): () => void {
  // For now, return a placeholder unsubscribe function
  // Full implementation would use subToTickerFeeds internally
  return () => {
    logger.debug(`🛑 Unsubscribed from ${symbol}`);
  };
}

/**
 * Get all active tickers.
 */
export function getActiveTickers(): Record<
  PairSymbol,
  TickerFeed | AggregatedTicker
> {
  return { ...aggregatedDataStore };
}

/**
 * Close all exchange connections.
 */
export async function closeAllExchanges(): Promise<void> {
  // Close batched connections first
  for (const [exchangeId, connection] of batchedConnections) {
    connection.stopSignal.stop = true;
  }
  batchedConnections.clear();

  // Close individual exchange connections
  for (const [exchangeId, exchange] of Object.entries(activeExchanges)) {
    try {
      if (exchange.close) {
        await exchange.close();
      }
      delete activeExchanges[exchangeId];
    } catch (err: any) {
      logger.error(`Error closing ${exchangeId}: ${err.message}`);
    }
  }
}
