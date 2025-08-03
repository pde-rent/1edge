#!/usr/bin/env bun

import { getServiceConfig } from "./config";
import { initStorage } from "./storage";
import {
  updateAggregatedTicker,
  closeAllExchanges,
  subToTickerFeeds,
} from "./marketData";
import { logger } from "@back/utils/logger";
import type {
  CollectorConfig,
  PairSymbol,
  AggregatedTicker,
} from "@common/types";
import { sleep } from "@common/utils";
import { pubSubServer } from "./pubSubServer";
import { initOHLCStorage, getOHLCStorage } from "./ohlcStorage";

interface IndexData {
  bid: number;
  ask: number;
  mid: number;
  vask: number; // volume ask
  vbid: number; // volume bid
  velocity: number; // sqrt of trades/ticks per period
  dispersion: number; // stdev of exchange prices vs index mid
  timestamp: number;
  tickCount: number; // internal counter for velocity calculation
}

interface PerformanceMetrics {
  averageCalculationTime: number;
  maxCalculationTime: number;
  averagePublishTime: number;
  maxPublishTime: number;
  totalProcessed: number;
  droppedUpdates: number;
}

class CollectorService {
  private config: CollectorConfig;
  private isRunning: boolean = false;
  private wsSubscription: { close: () => void } | null = null;
  private priceCache: Map<PairSymbol, AggregatedTicker> = new Map();
  private lastStatsLog: number = 0;
  private indexData: Map<PairSymbol, IndexData> = new Map();
  private publishInterval: any = null;
  private readonly PUBLISH_INTERVAL_MS = 1000; // 1000ms = 1 time per second
  private metrics: PerformanceMetrics = {
    averageCalculationTime: 0,
    maxCalculationTime: 0,
    averagePublishTime: 0,
    maxPublishTime: 0,
    totalProcessed: 0,
    droppedUpdates: 0,
  };
  private calculationTimes: number[] = [];
  private publishTimes: number[] = [];
  private readonly MAX_METRIC_SAMPLES = 1000;
  private processingQueue: Map<PairSymbol, number> = new Map(); // Track pending updates per symbol
  private readonly MAX_PENDING_PER_SYMBOL = 3; // Max pending updates per symbol

  constructor() {
    this.config = getServiceConfig("collector");
    initStorage(getServiceConfig("collector" as any));
  }

  async start() {
    this.isRunning = true;

    // Initialize OHLC storage
    initOHLCStorage();
    await getOHLCStorage().initialize();

    // Initialize pub/sub server
    await pubSubServer.start();

    const tickerKeys = Object.keys(this.config.tickers);
    if (tickerKeys.length === 0) {
      logger.warn("No tickers configured for WebSocket streaming");
      return;
    }

    // Run OHLC data sanity check and fill historical data if needed
    const symbols = tickerKeys as PairSymbol[];
    await getOHLCStorage().runDataSanityCheck(symbols);

    // Start WebSocket subscriptions
    this.wsSubscription = subToTickerFeeds(
      this.config.tickers,
      this.onTickerUpdate.bind(this),
      this.onTickerError.bind(this),
      5000, // 5 second reconnect interval
    );

    logger.info(
      `Collector service started: ${tickerKeys.length} tickers configured`,
    );

    // Start fixed interval publishing (every 200ms)
    this.startPublishingLoop();
  }

  async stop() {
    this.isRunning = false;

    // Stop publishing loop
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
      this.publishInterval = null;
    }

    // Close WebSocket subscriptions
    if (this.wsSubscription) {
      this.wsSubscription.close();
      this.wsSubscription = null;
    }

    // Stop pub/sub server
    await pubSubServer.stop();

    // Shutdown OHLC storage
    await getOHLCStorage().shutdown();

    await closeAllExchanges();
    logger.info("Collector service stopped");
  }

  private onTickerUpdate(symbol: PairSymbol, data: AggregatedTicker) {
    if (!this.isRunning) return;

    // Check if we have too many pending updates for this symbol
    const pendingCount = this.processingQueue.get(symbol) || 0;
    if (pendingCount >= this.MAX_PENDING_PER_SYMBOL) {
      this.metrics.droppedUpdates++;
      return;
    }

    // Update internal cache
    this.priceCache.set(symbol, data);

    // Update or create index data
    if (!this.indexData.has(symbol)) {
      this.indexData.set(symbol, {
        bid: 0,
        ask: 0,
        mid: 0,
        vask: 0,
        vbid: 0,
        velocity: 0,
        dispersion: 0,
        timestamp: Date.now(),
        tickCount: 0,
      });
    }

    const indexData = this.indexData.get(symbol)!;

    // Increment pending count
    this.processingQueue.set(symbol, pendingCount + 1);

    // Use setImmediate to make calculation non-blocking
    setImmediate(() => {
      if (!this.isRunning) return;

      const startTime = performance.now();

      // Calculate new weighted averages from all active sources
      this.calculateWeightedAverages(symbol, data, indexData);

      // Process OHLC data (async, non-blocking)
      if (indexData.mid > 0) {
        const estimatedVolume = (indexData.vbid + indexData.vask) / 2;
        setImmediate(() => {
          getOHLCStorage()
            .processPriceUpdate(symbol, indexData.mid, estimatedVolume)
            .catch((error) => {
              logger.error(`Failed to process OHLC for ${symbol}:`, error);
            });
        });
      }

      // Track calculation performance
      const calcTime = performance.now() - startTime;
      this.trackCalculationTime(calcTime);

      // Increment tick count for velocity calculation
      indexData.tickCount++;

      this.metrics.totalProcessed++;

      // Decrement pending count
      const currentPending = this.processingQueue.get(symbol) || 1;
      this.processingQueue.set(symbol, Math.max(0, currentPending - 1));
    });
  }

  private onTickerError(error: any) {
    if (!this.isRunning) return;

    logger.error("WebSocket ticker error:", error);
  }

  private calculateWeightedAverages(
    symbol: PairSymbol,
    data: AggregatedTicker,
    indexData: IndexData,
  ) {
    const config = this.config.tickers[symbol];
    if (!config || !data.sources) return;

    let totalBidWeighted = 0;
    let totalAskWeighted = 0;
    let totalBidVolume = 0;
    let totalAskVolume = 0;
    let totalWeight = 0;
    const activePrices: number[] = [];

    // Calculate weighted averages from all active sources
    for (const [srcSymbol, srcData] of Object.entries(data.sources)) {
      if (srcData.status !== "active" || !srcData.last?.mid) continue;

      const sourceConfig = config.sources[srcSymbol as PairSymbol];
      const weight = sourceConfig?.weight || 1;
      const bid = srcData.last.bid || srcData.last.mid;
      const ask = srcData.last.ask || srcData.last.mid;
      const volume = srcData.last.volume || 0;

      totalBidWeighted += bid * weight;
      totalAskWeighted += ask * weight;

      // Simulate different bid/ask volumes (bid volume typically higher for selling pressure)
      const bidVolume = volume * 0.6; // 60% of volume on bid side
      const askVolume = volume * 0.4; // 40% of volume on ask side
      totalBidVolume += bidVolume * weight;
      totalAskVolume += askVolume * weight;

      totalWeight += weight;
      activePrices.push(srcData.last.mid);
    }

    if (totalWeight > 0) {
      indexData.bid = totalBidWeighted / totalWeight;
      indexData.ask = totalAskWeighted / totalWeight;
      indexData.mid = (indexData.bid + indexData.ask) / 2;
      indexData.vbid = totalBidVolume / totalWeight;
      indexData.vask = totalAskVolume / totalWeight;

      // Calculate dispersion as relative percentage (stdev of source prices vs our index mid)
      if (activePrices.length > 1 && indexData.mid > 0) {
        const variance =
          activePrices.reduce((sum, price) => {
            const diff = price - indexData.mid;
            return sum + diff * diff;
          }, 0) / activePrices.length;
        const stdev = Math.sqrt(variance);
        indexData.dispersion = (stdev / indexData.mid) * 100; // Convert to percentage
      } else {
        indexData.dispersion = 0;
      }
    }
  }

  private startPublishingLoop() {
    this.publishInterval = setInterval(async () => {
      await this.publishAllIndexes();
    }, this.PUBLISH_INTERVAL_MS);
  }

  private async publishAllIndexes() {
    if (!this.isRunning) return;

    const publishStartTime = performance.now();
    const now = Date.now();
    const BATCH_SIZE = 10; // Process symbols in batches

    const symbols = Array.from(this.indexData.entries());

    // Process symbols in batches to avoid blocking
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);

      // Process each batch asynchronously
      await new Promise<void>((resolve) => {
        setImmediate(() => {
          if (!this.isRunning) {
            resolve();
            return;
          }

          for (const [symbol, indexData] of batch) {
            // Calculate velocity (sqrt of tick count per period)
            indexData.velocity = Math.sqrt(indexData.tickCount);
            indexData.timestamp = now;

            // Only publish if we have valid data
            if (indexData.mid > 0) {
              // Get the full aggregated data for this symbol to include history
              const aggData = this.priceCache.get(symbol);
              const publishData = {
                bid: indexData.bid,
                ask: indexData.ask,
                mid: indexData.mid,
                vask: indexData.vask,
                vbid: indexData.vbid,
                velocity: indexData.velocity,
                dispersion: indexData.dispersion,
                timestamp: indexData.timestamp,
                // Include history from the aggregated ticker data
                history: aggData?.history || {
                  ts: [],
                  o: [],
                  h: [],
                  l: [],
                  c: [],
                  v: [],
                },
              };

              pubSubServer.publishPrice(symbol, publishData);
            }

            // Reset tick count for next period
            indexData.tickCount = 0;
          }

          resolve();
        });
      });
    }

    // Track publish performance
    const publishTime = performance.now() - publishStartTime;
    this.trackPublishTime(publishTime);

    // Log stats periodically
    if (!this.lastStatsLog || now - this.lastStatsLog > 60000) {
      // Every 60 seconds
      const stats = pubSubServer.getStats();
      logger.info(
        `Collector stats: ${this.indexData.size} indexes | Clients: ${(stats as any).totalClients || stats.connectedClients} | Performance: ${JSON.stringify(this.getPerformanceStats())}`,
      );
      this.lastStatsLog = now;
    }
  }

  private trackCalculationTime(time: number) {
    this.calculationTimes.push(time);
    if (this.calculationTimes.length > this.MAX_METRIC_SAMPLES) {
      this.calculationTimes.shift();
    }

    // Update metrics
    this.metrics.averageCalculationTime =
      this.calculationTimes.reduce((a, b) => a + b, 0) /
      this.calculationTimes.length;
    this.metrics.maxCalculationTime = Math.max(...this.calculationTimes);
  }

  private trackPublishTime(time: number) {
    this.publishTimes.push(time);
    if (this.publishTimes.length > this.MAX_METRIC_SAMPLES) {
      this.publishTimes.shift();
    }

    // Update metrics
    this.metrics.averagePublishTime =
      this.publishTimes.reduce((a, b) => a + b, 0) / this.publishTimes.length;
    this.metrics.maxPublishTime = Math.max(...this.publishTimes);
  }

  private getPerformanceStats() {
    return {
      avgCalc: `${this.metrics.averageCalculationTime.toFixed(2)}ms`,
      maxCalc: `${this.metrics.maxCalculationTime.toFixed(2)}ms`,
      avgPub: `${this.metrics.averagePublishTime.toFixed(2)}ms`,
      maxPub: `${this.metrics.maxPublishTime.toFixed(2)}ms`,
      processed: this.metrics.totalProcessed,
      dropped: this.metrics.droppedUpdates,
    };
  }

  // Keep the legacy polling method as fallback (not used by default)
  private async updateAllTickers() {
    const tickers = Object.entries(this.config.tickers);

    if (tickers.length === 0) {
      logger.warn("No tickers configured");
      return;
    }

    // Update all tickers in parallel
    const updatePromises = tickers.map(async ([symbol, config]) => {
      try {
        await updateAggregatedTicker(symbol as PairSymbol, config);
      } catch (error) {
        logger.error(`Failed to update ${symbol}:`, error);
      }
    });

    await Promise.all(updatePromises);
  }
}

// Main execution
const collector = new CollectorService();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  await collector.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await collector.stop();
  process.exit(0);
});

// Start the service
collector.start().catch((error) => {
  logger.error("Failed to start Collector service:", error);
  process.exit(1);
});
