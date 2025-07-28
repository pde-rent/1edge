import { logger } from "@back/utils/logger";
import type { Symbol } from "@common/types";
import { ZMQ_PRICE_FEED_PORT } from "@common/constants";
import * as zmq from "zeromq";

/**
 * Shared price cache service that subscribes to ZeroMQ price feed
 * and provides current prices to API and WebSocket servers
 */
class PriceCacheService {
  private static instance: PriceCacheService;
  private priceCache: Map<Symbol, any> = new Map();
  private subscriber: zmq.Subscriber | null = null;
  private isConnected: boolean = false;
  
  private constructor() {}
  
  static getInstance(): PriceCacheService {
    if (!PriceCacheService.instance) {
      PriceCacheService.instance = new PriceCacheService();
    }
    return PriceCacheService.instance;
  }
  
  async connect() {
    if (this.isConnected) return;
    
    try {
      this.subscriber = new zmq.Subscriber();
      this.subscriber.connect(`tcp://127.0.0.1:${ZMQ_PRICE_FEED_PORT}`);
      
      // Subscribe to all price updates
      this.subscriber.subscribe("prices.");
      
      logger.info(`📡 Price cache connected to ZeroMQ feed at tcp://127.0.0.1:${ZMQ_PRICE_FEED_PORT}`);
      this.isConnected = true;
      
      // Process messages
      this.processMessages();
    } catch (error) {
      logger.error("Failed to connect price cache to ZeroMQ:", error);
      throw error;
    }
  }
  
  async disconnect() {
    if (this.subscriber) {
      this.subscriber.close();
      this.subscriber = null;
      this.isConnected = false;
    }
  }
  
  private async processMessages() {
    if (!this.subscriber) return;
    
    try {
      for await (const [topic, message] of this.subscriber) {
        this.handleMessage(topic.toString(), message.toString());
      }
    } catch (error) {
      logger.error("Error processing price cache messages:", error);
      this.isConnected = false;
    }
  }
  
  private handleMessage(topic: string, messageStr: string) {
    try {
      const message = JSON.parse(messageStr);
      const symbol = message.symbol;
      
      // Update cache
      this.priceCache.set(symbol, {
        ...message.data,
        symbol,
        lastUpdate: Date.now()
      });
      
      logger.debug(`💰 Price cache updated: ${symbol} - ${message.data.mid}`);
    } catch (error) {
      logger.error("Error handling price cache message:", error);
    }
  }
  
  /**
   * Get current price data for a symbol
   */
  getPrice(symbol: Symbol): any {
    return this.priceCache.get(symbol);
  }
  
  /**
   * Get all active prices
   */
  getAllPrices(): Record<Symbol, any> {
    const prices: Record<Symbol, any> = {};
    for (const [symbol, data] of this.priceCache) {
      prices[symbol] = data;
    }
    return prices;
  }
  
  /**
   * Get list of available symbols
   */
  getAvailableSymbols(): Symbol[] {
    return Array.from(this.priceCache.keys());
  }
}

export const priceCache = PriceCacheService.getInstance();