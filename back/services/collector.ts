#!/usr/bin/env bun

import { getServiceConfig } from "./config";
import { initStorage } from "./storage";
import { updateAggregatedTicker, closeAllExchanges, subToTickerFeeds } from "./marketData";
import { logger } from "@back/utils/logger";
import type { CollectorConfig, Symbol, AggregatedTicker } from "@common/types";
import { sleep } from "@common/utils";

class CollectorService {
  private config: CollectorConfig;
  private isRunning: boolean = false;
  private wsSubscription: { close: () => void } | null = null;
  
  constructor() {
    this.config = getServiceConfig("collector");
    initStorage(getServiceConfig("collector" as any));
  }
  
  async start() {
    logger.info("🚀 Starting Collector service with WebSocket streaming...");
    this.isRunning = true;
    
    if (Object.keys(this.config.tickers).length === 0) {
      logger.warn("No tickers configured for WebSocket streaming");
      return;
    }
    
    // Start WebSocket subscriptions
    this.wsSubscription = subToTickerFeeds(
      this.config.tickers,
      this.onTickerUpdate.bind(this),
      this.onTickerError.bind(this),
      5000 // 5 second reconnect interval
    );
    
    logger.info(`✅ Collector service started with WebSocket streaming for ${Object.keys(this.config.tickers).length} tickers`);
  }
  
  async stop() {
    logger.info("🛑 Stopping Collector service...");
    this.isRunning = false;
    
    // Close WebSocket subscriptions
    if (this.wsSubscription) {
      this.wsSubscription.close();
      this.wsSubscription = null;
    }
    
    await closeAllExchanges();
    logger.info("✅ Collector service stopped");
  }
  
  private onTickerUpdate(symbol: Symbol, data: AggregatedTicker) {
    if (!this.isRunning) return;
    
    // Log price updates
    if (data.last && data.last.mid > 0) {
      logger.debug(`💰 ${symbol}: ${data.last.mid} (${data.status})`);
    }
  }
  
  private onTickerError(error: any) {
    if (!this.isRunning) return;
    
    logger.error("❌ WebSocket ticker error:", error);
  }
  
  // Keep the legacy polling method as fallback (not used by default)
  private async updateAllTickers() {
    const tickers = Object.entries(this.config.tickers);
    
    if (tickers.length === 0) {
      logger.warn("No tickers configured");
      return;
    }
    
    logger.debug(`Updating ${tickers.length} aggregated tickers...`);
    
    // Update all tickers in parallel
    const updatePromises = tickers.map(async ([symbol, config]) => {
      try {
        await updateAggregatedTicker(symbol as Symbol, config);
        logger.debug(`Updated ${symbol}`);
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
  logger.info("Received SIGINT signal");
  await collector.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM signal");
  await collector.stop();
  process.exit(0);
});

// Start the service
collector.start().catch((error) => {
  logger.error("Failed to start Collector service:", error);
  process.exit(1);
});