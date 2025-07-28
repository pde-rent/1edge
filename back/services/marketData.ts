import { cacheTicker, getCachedTicker } from "@back/services/memoryStorage";
import { logger } from "@back/utils/logger";
import {
  AggregatedTicker,
  AggregatedTickerConfig,
  FeedStatus,
  Symbol,
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
const aggregatedDataStore: Record<Symbol, AggregatedTicker> = {};
const activeExchanges: Record<string, any> = {};

/**
 * Parses a Symbol string into its components.
 */
function parseSymbol(
  symbolInput: Symbol
): { exchangeId: string; marketType?: string; tickerSymbol: string } | undefined {
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
export async function getCexTicker(symbolInput: Symbol): Promise<CcxtTicker | undefined> {
  const parsed = parseSymbol(symbolInput);
  if (!parsed) return undefined;
  const { exchangeId, tickerSymbol } = parsed;

  try {
    const ex = await getExchange(exchangeId);
    if (!ex.has["fetchTicker"]) {
      logger.error(`[REST] ${exchangeId} cannot fetchTicker.`);
      return undefined;
    }
    logger.debug(`[REST] ${exchangeId} fetchTicker ${tickerSymbol}`);
    const ticker = await ex.fetchTicker(tickerSymbol);
    if (ticker?.last === undefined) {
      logger.warn(`[REST] No last price for ${exchangeId}:${tickerSymbol}`);
      return undefined;
    }
    logger.info(`[REST] ${exchangeId}:${tickerSymbol} last=${ticker.last}`);
    return ticker;
  } catch (err: any) {
    logger.error(`[REST] Error ${exchangeId}:${tickerSymbol} - ${err.message || err}`);
    return undefined;
  }
}

/**
 * Get an exchange singleton instance with WebSocket support.
 */
export async function getExchange(exchangeId: string): Promise<any> {
  if (activeExchanges[exchangeId]) return activeExchanges[exchangeId];
  logger.info(`Init ccxt websocket connection for ${exchangeId}`);
  const ctor = (ccxt as any).pro[exchangeId] || (ccxt as any)[exchangeId];
  if (!ctor) throw new Error(`ccxt exchange ${exchangeId} not found.`);
  const ex = new ctor({ enableRateLimit: true });
  await ex.loadMarkets();
  activeExchanges[exchangeId] = ex;
  return ex;
}

/**
 * Update the weighted average for a destination ticker.
 */
function updateWeightedAvg(aggSymbol: Symbol): void {
  const aggTicker = aggregatedDataStore[aggSymbol];
  if (!aggTicker || !aggTicker.sources) return;

  let totalMid = 0;
  let totalWeight = 0;

  for (const [srcSymbol, srcFeed] of Object.entries(aggTicker.sources)) {
    const config = aggTicker.sources[srcSymbol as Symbol];
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
  symbol: Symbol,
  timeframe: TimeFrame,
  limit: number = 100
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
    logger.error(`[OHLCV] Error ${exchangeId}:${tickerSymbol} - ${err.message || err}`);
    return undefined;
  }
}

/**
 * Initialize ticker feed with data.
 */
async function initializeTickerFeed(
  symbol: Symbol,
  config: TickerConfig | AggregatedTickerConfig
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
  symbol: Symbol,
  config: TickerConfig
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
  aggSymbol: Symbol,
  config: AggregatedTickerConfig
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
  const updatePromises = Object.entries(config.sources).map(async ([srcSymbol, srcConfig]) => {
    const feed = await updateSourceTicker(srcSymbol as Symbol, {
      id: srcSymbol as Symbol,
      name: srcSymbol,
      exchange: parseSymbol(srcSymbol as Symbol)?.exchangeId || "unknown",
      tf: config.tf,
      lookback: config.lookback,
      ttl: 60, // 1 minute cache for sources
      weight: srcConfig.weight,
    } as TickerConfig);

    if (feed) {
      aggTicker.sources[srcSymbol as Symbol] = feed;
    }
  });

  await Promise.all(updatePromises);

  // Update weighted average
  updateWeightedAvg(aggSymbol);

  // Update status
  const activeSourceCount = Object.values(aggTicker.sources).filter(
    (src) => src.status === FeedStatus.ACTIVE
  ).length;
  
  aggTicker.status = activeSourceCount > 0 ? FeedStatus.ACTIVE : FeedStatus.ERROR;

  // Cache aggregated data
  await cacheTicker(aggSymbol, aggTicker, 300); // 5 minute cache

  return aggTicker;
}

/**
 * Get current ticker data.
 */
export async function getTicker(symbol: Symbol): Promise<TickerFeed | AggregatedTicker | null> {
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
function initAgg(aggSymbol: Symbol, aggCfg: AggregatedTickerConfig): AggregatedTicker {
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
function initSrc(agg: AggregatedTicker, srcCfg: TickerConfig, timestamp: number): TickerFeed {
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
  aggCfg: AggregatedTickerConfig
): TickerConfig {
  const parsed = parseSymbol(srcSymbol as Symbol);
  return {
    id: srcSymbol as Symbol,
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
function ensureAggStore(dest: Symbol, aggCfg: AggregatedTickerConfig): void {
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

/**
 * Subscribe to a single source with WebSocket streaming and auto-reconnect.
 */
async function watchExchangeTicker(
  srcCfg: TickerConfig,
  aggSymbol: Symbol,
  aggCfg: AggregatedTickerConfig,
  onUpdate: (dest: Symbol, data: AggregatedTicker) => void,
  onError: (err: any) => void,
  reconnectMs: number,
  stopSignal: { stop: boolean },
): Promise<void> {
  const parsed = parseSymbol(srcCfg.id);
  if (!parsed) return onError(new Error(`Invalid symbol: ${srcCfg.id}`));
  const { exchangeId, marketType, tickerSymbol } = parsed;
  let ex = await getExchange(exchangeId);
  
  // Build exchange-specific parameters
  const params: any = {};
  if (marketType && marketType !== "undefined") {
    params.type = marketType;
  }
  
  // Add exchange-specific WebSocket parameters
  if (exchangeId === 'binance') {
    params.name = "aggTrade"; // Binance aggregate trades
  }
  // For other exchanges like Kraken, use default trade streams without special params

  logger.info(`🚀 Starting WebSocket stream for ${srcCfg.id} -> ${aggSymbol}`);

  while (!stopSignal.stop) {
    try {
      // Retrieve previous bid/ask from prior data
      const prevFeed = aggregatedDataStore[aggSymbol]?.sources[srcCfg.id];
      const prevBid = prevFeed?.last.bid ?? 0;
      const prevAsk = prevFeed?.last.ask ?? 0;

      // Use WebSocket to watch trades with exchange-specific params
      let bid: number, ask: number, timestamp: number, baseVolume: number, price: number;
      
      // Try WebSocket first, fallback to REST if WebSocket fails
      try {
        const trades = await (ex as any).watchTrades(
          tickerSymbol, 
          undefined, 
          1, 
          Object.keys(params).length > 0 ? params : undefined
        );
        const trade = trades[0];
        price = trade.price;
        
        // Reconstruct bid/ask from trade side
        if (trade.side === "buy") {
          ask = price;
          bid = prevBid || price;
        } else {
          bid = price;
          ask = prevAsk || price;
        }
        timestamp = trade.timestamp;
        baseVolume = trade.amount;
        
      } catch (wsError) {
        // WebSocket failed, fallback to REST API
        logger.warn(`[WS:${exchangeId}] WebSocket failed, falling back to REST for ${tickerSymbol}`);
        const ticker = await ex.fetchTicker(tickerSymbol);
        if (!ticker || !ticker.last) {
          throw new Error(`No ticker data available for ${tickerSymbol}`);
        }
        
        price = ticker.last;
        bid = ticker.bid || ticker.last;
        ask = ticker.ask || ticker.last;
        timestamp = ticker.timestamp || Date.now();
        baseVolume = ticker.baseVolume || 0;
      }
      
      if (!bid || !ask || !timestamp) continue;
      const mid = (bid + ask) / 2;
      
      // Update data structures
      const agg = initAgg(aggSymbol, aggCfg);
      const src = initSrc(agg, srcCfg, timestamp);
      src.last = { bid, ask, mid, last: price, volume: baseVolume, timestamp };
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
      
    } catch (err) {
      onError(err);
      logger.error(`[WS:${exchangeId}] error:`, err);
      await sleep(reconnectMs);
      delete activeExchanges[exchangeId];
      ex = await getExchange(exchangeId);
    }
  }
  logger.info(`⏹️ Stopped watching ${tickerSymbol} for ${aggSymbol}`);
}

/**
 * Subscribe to all ticker feeds with WebSocket streaming.
 */
export function subToTickerFeeds(
  config: Record<Symbol, AggregatedTickerConfig>,
  onUpdate: (destSymbol: Symbol, data: AggregatedTicker) => void,
  onError: (err: any) => void = (err) => logger.error("General subscription error", err),
  reconnectMs = 5000,
): { close: () => void; getAllActiveSignals: () => { stop: boolean }[] } {
  logger.info("🚀 Subscribing to WebSocket ticker feeds...");
  const stopSignals: Record<string, { stop: boolean }> = {};
  
  for (const [destStr, aggCfg] of Object.entries(config)) {
    const dest = destStr as Symbol;
    if (!aggCfg.sources || !Object.keys(aggCfg.sources).length) {
      logger.warn(`No sources for ${dest}.`);
      continue;
    }
    
    ensureAggStore(dest, aggCfg);
    
    for (const [sk, sc] of Object.entries(aggCfg.sources)) {
      const fullCfg = buildFullSrcCfg(sk, sc, aggCfg);
      const key = `${dest}:${sk}`;
      const signal = { stop: false };
      stopSignals[key] = signal;
      
      logger.info(`📡 Watching ${fullCfg.id} for ${dest}`);
      void watchExchangeTicker(fullCfg, dest, aggCfg, onUpdate, onError, reconnectMs, signal);
    }
  }
  
  return {
    close: () => {
      logger.info("🛑 Closing all WebSocket subscriptions...");
      Object.values(stopSignals).forEach((s) => (s.stop = true));
    },
    getAllActiveSignals: () => Object.values(stopSignals),
  };
}

/**
 * Subscribe to ticker updates (WebSocket implementation).
 */
export function subscribeTicker(
  symbol: Symbol,
  callback: (ticker: TickerTick) => void
): () => void {
  logger.info(`📡 Subscribing to ${symbol} WebSocket updates`);
  
  // For now, return a placeholder unsubscribe function
  // Full implementation would use subToTickerFeeds internally
  return () => {
    logger.debug(`🛑 Unsubscribed from ${symbol}`);
  };
}

/**
 * Get all active tickers.
 */
export function getActiveTickers(): Record<Symbol, TickerFeed | AggregatedTicker> {
  return { ...aggregatedDataStore };
}

/**
 * Close all exchange connections.
 */
export async function closeAllExchanges(): Promise<void> {
  for (const [exchangeId, exchange] of Object.entries(activeExchanges)) {
    try {
      if (exchange.close) {
        await exchange.close();
      }
      delete activeExchanges[exchangeId];
      logger.info(`Closed connection to ${exchangeId}`);
    } catch (err: any) {
      logger.error(`Error closing ${exchangeId}: ${err.message}`);
    }
  }
}