import { logger } from "@back/utils/logger";
import type { Symbol } from "@common/types";
import { PubSubClient } from "./pubSubClient";

/**
 * Shared price cache service that subscribes to pub/sub price feed
 * and provides current prices to API and WebSocket servers
 */
class PriceCacheService {
  private static instance: PriceCacheService;
  private priceCache: Map<Symbol, any> = new Map();
  private pubSubClient: PubSubClient;
  private isConnected: boolean = false;

  private constructor() {
    this.pubSubClient = new PubSubClient();
  }

  static getInstance(): PriceCacheService {
    if (!PriceCacheService.instance) {
      PriceCacheService.instance = new PriceCacheService();
    }
    return PriceCacheService.instance;
  }

  async connect() {
    if (this.isConnected) {
      logger.info(`📡 Price cache already connected`);
      return;
    }

    try {
      logger.info(`📡 Price cache connecting to pub/sub...`);
      await this.pubSubClient.connect();

      // Subscribe to all price updates
      logger.info(`📡 Price cache subscribing to all price updates (prices.*)`);
      this.pubSubClient.subscribeToAllPrices(
        (symbol: Symbol, priceData: any) => {
          this.handlePriceUpdate(symbol, priceData);
        },
      );

      logger.info(`✅ Price cache connected to pub/sub feed`);
      this.isConnected = true;

      // Log connection stats
      const stats = this.pubSubClient.getStats();
      logger.info(`📊 PubSub Client Stats: ${JSON.stringify(stats)}`);
    } catch (error) {
      logger.error("Failed to connect price cache to pub/sub:", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pubSubClient) {
      this.pubSubClient.disconnect();
      this.isConnected = false;
    }
  }

  private handlePriceUpdate(symbol: Symbol, priceData: any) {
    try {
      // Get existing data to preserve history
      const existingData = this.priceCache.get(symbol);

      // Update cache - preserve history if it exists
      const cacheData = {
        ...priceData,
        symbol,
        lastUpdate: Date.now(),
        // Preserve existing history if not provided in update
        history: priceData.history ||
          existingData?.history || {
            ts: [],
            o: [],
            h: [],
            l: [],
            c: [],
            v: [],
          },
      };

      this.priceCache.set(symbol, cacheData);

      // Price cache updated silently
    } catch (error) {
      logger.error("Error handling price cache update:", error);
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
