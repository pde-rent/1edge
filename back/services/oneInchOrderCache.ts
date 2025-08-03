import { logger } from "@back/utils/logger";
import { PubSubClient } from "./pubSubClient";
import type { OneInchOrderData } from "./oneInchOrderMonitor";

/**
 * Enhanced order data with cache metadata
 */
export interface CachedOneInchOrderData extends OneInchOrderData {
  lastUpdate: number;
  monitorTimestamp: number;
  cacheTimestamp: number;
}

/**
 * Shared 1inch order cache service that subscribes to pub/sub order updates
 * and provides current order states to watchers and API
 */
class OneInchOrderCacheService {
  private static instance: OneInchOrderCacheService;
  private orderCache: Map<string, CachedOneInchOrderData> = new Map();
  private pubSubClient: PubSubClient;
  private isConnected: boolean = false;

  private constructor() {
    this.pubSubClient = new PubSubClient();
  }

  static getInstance(): OneInchOrderCacheService {
    if (!OneInchOrderCacheService.instance) {
      OneInchOrderCacheService.instance = new OneInchOrderCacheService();
    }
    return OneInchOrderCacheService.instance;
  }

  async connect() {
    if (this.isConnected) {
      logger.info(`📡 1inch order cache already connected`);
      return;
    }

    try {
      logger.info(`📡 1inch order cache connecting to pub/sub...`);
      await this.pubSubClient.connect();

      // Subscribe to all 1inch order updates
      logger.info(`📡 1inch order cache subscribing to 1inch order updates (1inch-orders.*)`);
      this.pubSubClient.subscribe(
        "1inch-orders.*",
        (channel: string, orderData: any) => {
          this.handleOrderUpdate(channel, orderData);
        },
      );

      // Subscribe to bulk updates
      this.pubSubClient.subscribe(
        "1inch-orders.all",
        (channel: string, orderData: any) => {
          this.handleOrderUpdate(channel, orderData);
        },
      );

      logger.info(`✅ 1inch order cache connected to pub/sub feed`);
      this.isConnected = true;

      // Log connection stats
      const stats = this.pubSubClient.getStats();
      logger.info(`📊 PubSub Client Stats: ${JSON.stringify(stats)}`);
    } catch (error) {
      logger.error("Failed to connect 1inch order cache to pub/sub:", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pubSubClient) {
      this.pubSubClient.disconnect();
      this.isConnected = false;
    }
  }

  private handleOrderUpdate(channel: string, orderData: any) {
    try {
      // Extract order hash from channel or data
      let orderHash: string;
      
      if (channel === "1inch-orders.all") {
        orderHash = orderData.orderHash;
      } else {
        // Extract from channel pattern: 1inch-orders.{hash}
        orderHash = channel.split('.')[1];
      }

      if (!orderHash) {
        logger.warn("Received 1inch order update without valid hash");
        return;
      }

      // Get existing data to preserve additional metadata
      const existingData = this.orderCache.get(orderHash);

      // Update cache with enhanced metadata
      const cacheData: CachedOneInchOrderData = {
        ...orderData,
        orderHash, // Ensure hash is set
        cacheTimestamp: Date.now(),
        // Preserve monitor timestamp if available
        lastUpdate: orderData.lastUpdate || Date.now(),
        monitorTimestamp: orderData.monitorTimestamp || existingData?.monitorTimestamp || Date.now(),
      };

      this.orderCache.set(orderHash, cacheData);

      // Log significant changes
      if (!existingData) {
        logger.debug(`📝 New 1inch order cached: ${orderHash.slice(0, 10)}... - ${cacheData.remainingMakerAmount} remaining`);
      } else if (existingData.remainingMakerAmount !== cacheData.remainingMakerAmount) {
        logger.debug(`📊 1inch order amount changed: ${orderHash.slice(0, 10)}... - ${existingData.remainingMakerAmount} → ${cacheData.remainingMakerAmount}`);
      }

      // Check for order completion
      if (cacheData.remainingMakerAmount === "0" || cacheData.orderInvalidReason) {
        logger.info(`🎯 1inch order completed/invalidated: ${orderHash.slice(0, 10)}... - reason: ${cacheData.orderInvalidReason || 'fully filled'}`);
      }

    } catch (error) {
      logger.error("Error handling 1inch order cache update:", error);
    }
  }

  /**
   * Get current order data by hash
   */
  getOrder(orderHash: string): CachedOneInchOrderData | null {
    return this.orderCache.get(orderHash) || null;
  }

  /**
   * Get multiple orders by hash array
   */
  getOrders(orderHashes: string[]): (CachedOneInchOrderData | null)[] {
    return orderHashes.map(hash => this.getOrder(hash));
  }

  /**
   * Get all cached orders
   */
  getAllOrders(): CachedOneInchOrderData[] {
    return Array.from(this.orderCache.values());
  }

  /**
   * Get orders by maker address
   */
  getOrdersByMaker(makerAddress: string): CachedOneInchOrderData[] {
    return Array.from(this.orderCache.values()).filter(
      order => order.data.maker.toLowerCase() === makerAddress.toLowerCase()
    );
  }

  /**
   * Get active orders (orders with remaining amount > 0 and no invalid reason)
   */
  getActiveOrders(): CachedOneInchOrderData[] {
    return Array.from(this.orderCache.values()).filter(
      order => 
        parseFloat(order.remainingMakerAmount) > 0 && 
        !order.orderInvalidReason
    );
  }

  /**
   * Get filled orders (orders with remaining amount = 0)
   */
  getFilledOrders(): CachedOneInchOrderData[] {
    return Array.from(this.orderCache.values()).filter(
      order => parseFloat(order.remainingMakerAmount) === 0
    );
  }

  /**
   * Get orders by status/reason
   */
  getOrdersByStatus(status: string): CachedOneInchOrderData[] {
    return Array.from(this.orderCache.values()).filter(
      order => order.orderInvalidReason === status
    );
  }

  /**
   * Check if order exists in cache
   */
  hasOrder(orderHash: string): boolean {
    return this.orderCache.has(orderHash);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const orders = Array.from(this.orderCache.values());
    const activeOrders = orders.filter(order => 
      parseFloat(order.remainingMakerAmount) > 0 && !order.orderInvalidReason
    );
    const filledOrders = orders.filter(order => 
      parseFloat(order.remainingMakerAmount) === 0
    );
    const invalidOrders = orders.filter(order => 
      order.orderInvalidReason
    );

    return {
      isConnected: this.isConnected,
      totalOrders: this.orderCache.size,
      activeOrders: activeOrders.length,
      filledOrders: filledOrders.length,
      invalidOrders: invalidOrders.length,
      cacheKeys: Array.from(this.orderCache.keys()).map(key => key.slice(0, 10) + '...'),
    };
  }

  /**
   * Calculate aggregated order state for a 1edge order with multiple 1inch orders
   */
  calculateAggregatedState(orderHashes: string[]): {
    totalFilled: number;
    totalRemaining: number;
    hasPartialFills: boolean;
    isCompletelyFilled: boolean;
    allOrdersValid: boolean;
    invalidReasons: string[];
  } {
    let totalFilled = 0;
    let totalRemaining = 0;
    let hasPartialFills = false;
    let invalidReasons: string[] = [];

    for (const hash of orderHashes) {
      const order = this.getOrder(hash);
      if (!order) {
        // Order not found in cache - could be very new or removed
        continue;
      }

      const remaining = parseFloat(order.remainingMakerAmount);
      const original = parseFloat(order.data.makingAmount);
      const filled = original - remaining;

      totalRemaining += remaining;
      totalFilled += filled;

      if (filled > 0) {
        hasPartialFills = true;
      }

      if (order.orderInvalidReason) {
        invalidReasons.push(order.orderInvalidReason);
      }
    }

    return {
      totalFilled,
      totalRemaining,
      hasPartialFills,
      isCompletelyFilled: totalRemaining === 0 && totalFilled > 0,
      allOrdersValid: invalidReasons.length === 0,
      invalidReasons: [...new Set(invalidReasons)], // Remove duplicates
    };
  }

  /**
   * Clean up old/expired orders from cache
   */
  cleanupExpiredOrders(maxAge: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [hash, order] of this.orderCache) {
      const age = now - order.cacheTimestamp;
      
      // Remove orders that are old and either filled or invalid
      if (age > maxAge && (
        parseFloat(order.remainingMakerAmount) === 0 || 
        order.orderInvalidReason
      )) {
        this.orderCache.delete(hash);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info(`🧹 Cleaned up ${removedCount} expired 1inch orders from cache`);
    }

    return removedCount;
  }

  /**
   * Get list of available order hashes
   */
  getAvailableOrderHashes(): string[] {
    return Array.from(this.orderCache.keys());
  }

  /**
   * Force refresh order data (useful for testing)
   */
  async refreshOrder(orderHash: string): Promise<CachedOneInchOrderData | null> {
    // This would trigger a refresh from the monitor
    // For now, just return current cached data
    return this.getOrder(orderHash);
  }
}

export const oneInchOrderCache = OneInchOrderCacheService.getInstance();