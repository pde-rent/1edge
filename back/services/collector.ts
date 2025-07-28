#!/usr/bin/env bun

import { getServiceConfig } from "./config";
import { initStorage } from "./storage";
import { updateAggregatedTicker, closeAllExchanges, subToTickerFeeds } from "./marketData";
import { logger } from "@back/utils/logger";
import type { CollectorConfig, Symbol, AggregatedTicker } from "@common/types";
import { sleep } from "@common/utils";
import { ZMQ_PRICE_FEED_PORT } from "@common/constants";
import * as zmq from "zeromq";

class CollectorService {
  private config: CollectorConfig;
  private isRunning: boolean = false;
  private wsSubscription: { close: () => void } | null = null;
  private publisher: zmq.Publisher | null = null;
  private priceCache: Map<Symbol, AggregatedTicker> = new Map();
  
  constructor() {
    this.config = getServiceConfig("collector");
    initStorage(getServiceConfig("collector" as any));
  }
  
  async start() {
    logger.info("🚀 Starting Collector service with WebSocket streaming and ZeroMQ publishing...");
    this.isRunning = true;
    
    // Initialize ZeroMQ publisher
    await this.initializePublisher();
    
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
    
    // Close ZeroMQ publisher
    if (this.publisher) {
      this.publisher.close();
      this.publisher = null;
    }
    
    await closeAllExchanges();
    logger.info("✅ Collector service stopped");
  }
  
  private async initializePublisher() {
    try {
      this.publisher = new zmq.Publisher();
      await this.publisher.bind(`tcp://127.0.0.1:${ZMQ_PRICE_FEED_PORT}`);
      logger.info(`📡 ZeroMQ publisher listening on tcp://127.0.0.1:${ZMQ_PRICE_FEED_PORT}`);
    } catch (error) {
      logger.error("Failed to initialize ZeroMQ publisher:", error);
      throw error;
    }
  }
  
  private onTickerUpdate(symbol: Symbol, data: AggregatedTicker) {
    if (!this.isRunning) return;
    
    // Update cache
    this.priceCache.set(symbol, data);
    
    // Log price updates
    if (data.last && data.last.mid > 0) {
      logger.debug(`💰 ${symbol}: ${data.last.mid} (${data.status})`);
    }
    
    // Publish via ZeroMQ
    if (this.publisher) {
      const message = {
        type: "price_update",
        symbol,
        data: {
          bid: data.last.bid,
          ask: data.last.ask,
          mid: data.last.mid,
          last: data.last.last,
          volume: data.last.volume,
          timestamp: data.last.timestamp,
          status: data.status,
          history: data.history,
          analysis: data.analysis
        }
      };
      
      // Send topic-based message: "prices.{symbol}" followed by JSON data
      this.publisher.send([`prices.${symbol}`, JSON.stringify(message)]).catch(err => {
        logger.error(`Failed to publish price update for ${symbol}:`, err);
      });
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