#!/usr/bin/env bun

import { getServiceConfig } from "./config";
import { logger } from "@back/utils/logger";
import { pubSubServer } from "./pubSubServer";
import axios, { AxiosResponse } from "axios";
import { sleep } from "@common/utils";

/**
 * 1inch order data structure from API
 */
export interface OneInchOrderData {
  orderHash: string;
  createDateTime: string;
  remainingMakerAmount: string;
  makerBalance: string;
  makerAllowance: string;
  data: {
    makerAsset: string;
    takerAsset: string;
    salt: string;
    receiver: string;
    makingAmount: string;
    takingAmount: string;
    maker: string;
    extension: string;
    makerTraits: string;
  };
  makerRate: string;
  takerRate: string;
  isMakerContract: boolean;
  orderInvalidReason?: string;
  signature: string;
}

/**
 * 1inch API response structure
 */
interface OneInchAPIResponse {
  orders: OneInchOrderData[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Monitor configuration
 */
interface OneInchMonitorConfig {
  enabled: boolean;
  apiKey: string;
  chainId: number;
  pollInterval: number;
  delegateProxyAddress: string;
  maxOrdersPerPage: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Service to monitor 1inch orders and push updates via pub/sub
 */
class OneInchOrderMonitorService {
  private config: OneInchMonitorConfig;
  private isRunning: boolean = false;
  private monitorInterval?: any;
  private orderCache: Map<string, OneInchOrderData> = new Map();
  private lastPollTime: number = 0;
  private apiBaseUrl: string;
  
  constructor() {
    const serviceConfig = getServiceConfig("oneInchMonitor" as any) || {};
    
    this.config = {
      enabled: serviceConfig.enabled ?? true,
      apiKey: process.env.ONE_INCH_API_KEY || "",
      chainId: serviceConfig.chainId || 56, // BSC by default
      pollInterval: serviceConfig.pollInterval || 10000, // 10 seconds
      delegateProxyAddress: process.env.DELEGATE_PROXY_ADDRESS || "",
      maxOrdersPerPage: serviceConfig.maxOrdersPerPage || 500,
      retryAttempts: serviceConfig.retryAttempts || 3,
      retryDelay: serviceConfig.retryDelay || 5000,
    };

    this.apiBaseUrl = `https://api.1inch.dev/orderbook/v4.0/${this.config.chainId}`;
    
    if (!this.config.apiKey) {
      logger.warn("1inch API key not configured - 1inch order monitoring disabled");
      this.config.enabled = false;
    }
    
    if (!this.config.delegateProxyAddress) {
      logger.warn("DelegateProxy address not configured - 1inch order monitoring disabled");
      this.config.enabled = false;
    }
  }

  async start() {
    if (!this.config.enabled) {
      logger.info("1inch Order Monitor disabled in configuration");
      return;
    }

    logger.info("Starting 1inch Order Monitor service...");
    this.isRunning = true;

    // Initialize pub/sub server if not already started
    if (!pubSubServer.isRunning) {
      await pubSubServer.start();
    }

    // Start monitoring loop
    this.startMonitoringLoop();
    
    logger.info(`1inch Order Monitor started - polling every ${this.config.pollInterval}ms for proxy ${this.config.delegateProxyAddress}`);
  }

  async stop() {
    logger.info("Stopping 1inch Order Monitor service...");
    this.isRunning = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }

    this.orderCache.clear();
    logger.info("1inch Order Monitor service stopped");
  }

  private startMonitoringLoop() {
    // Initial poll
    this.pollOrders().catch(error => {
      logger.error("Initial 1inch order poll failed:", error);
    });

    // Set up polling interval
    this.monitorInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.pollOrders();
      } catch (error) {
        logger.error("1inch order polling error:", error);
      }
    }, this.config.pollInterval);
  }

  private async pollOrders() {
    const startTime = performance.now();
    
    try {
      logger.debug(`📡 Polling 1inch orders for proxy ${this.config.delegateProxyAddress}...`);
      
      // Fetch orders from 1inch API
      const orders = await this.fetchOrdersFromAPI();
      
      // Process and compare with cache
      const updatedOrders = this.processOrderUpdates(orders);
      
      // Publish updates
      for (const order of updatedOrders) {
        await this.publishOrderUpdate(order);
      }
      
      const duration = performance.now() - startTime;
      this.lastPollTime = Date.now();
      
      logger.debug(`✅ 1inch poll completed: ${orders.length} orders, ${updatedOrders.length} updates (${duration.toFixed(2)}ms)`);
      
    } catch (error) {
      logger.error("Failed to poll 1inch orders:", error);
      
      // Exponential backoff on errors
      if (this.isRunning) {
        const retryDelay = Math.min(this.config.retryDelay * 2, 30000);
        logger.info(`Retrying 1inch poll in ${retryDelay}ms...`);
        await sleep(retryDelay);
      }
    }
  }

  private async fetchOrdersFromAPI(): Promise<OneInchOrderData[]> {
    const url = `${this.apiBaseUrl}/address/${this.config.delegateProxyAddress}`;
    
    const config = {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      params: {
        page: 1,
        limit: this.config.maxOrdersPerPage.toString(),
        statuses: "1,2,3", // Active, partially filled, filled
      },
      paramsSerializer: {
        indexes: null,
      },
      timeout: 10000, // 10 second timeout
    };

    let attempt = 0;
    while (attempt < this.config.retryAttempts) {
      try {
        const response: AxiosResponse<OneInchAPIResponse> = await axios.get(url, config);
        
        if (response.status === 200 && response.data) {
          logger.debug(`1inch API response: ${response.data.orders?.length || 0} orders from page ${response.data.meta?.page || 1}`);
          return response.data.orders || [];
        } else {
          throw new Error(`Unexpected API response: ${response.status}`);
        }
      } catch (error: any) {
        attempt++;
        
        if (error.response?.status === 429) {
          // Rate limiting
          const retryAfter = error.response.headers['retry-after'] ? 
            parseInt(error.response.headers['retry-after']) * 1000 : 
            this.config.retryDelay;
          
          logger.warn(`1inch API rate limited, retrying in ${retryAfter}ms...`);
          await sleep(retryAfter);
          continue;
        }
        
        if (attempt >= this.config.retryAttempts) {
          throw new Error(`1inch API request failed after ${attempt} attempts: ${error.message}`);
        }
        
        logger.warn(`1inch API request failed (attempt ${attempt}/${this.config.retryAttempts}): ${error.message}`);
        await sleep(this.config.retryDelay * attempt);
      }
    }
    
    return [];
  }

  private processOrderUpdates(currentOrders: OneInchOrderData[]): OneInchOrderData[] {
    const updatedOrders: OneInchOrderData[] = [];
    const currentOrderMap = new Map<string, OneInchOrderData>();
    
    // Build map of current orders
    for (const order of currentOrders) {
      currentOrderMap.set(order.orderHash, order);
    }
    
    // Check for new or updated orders
    for (const [orderHash, currentOrder] of currentOrderMap) {
      const cachedOrder = this.orderCache.get(orderHash);
      
      if (!cachedOrder) {
        // New order
        logger.debug(`📝 New 1inch order detected: ${orderHash.slice(0, 10)}...`);
        this.orderCache.set(orderHash, currentOrder);
        updatedOrders.push(currentOrder);
      } else {
        // Check for changes in key fields
        const hasChanges = 
          cachedOrder.remainingMakerAmount !== currentOrder.remainingMakerAmount ||
          cachedOrder.makerBalance !== currentOrder.makerBalance ||
          cachedOrder.orderInvalidReason !== currentOrder.orderInvalidReason;
        
        if (hasChanges) {
          logger.debug(`📊 1inch order updated: ${orderHash.slice(0, 10)}... - remaining: ${currentOrder.remainingMakerAmount}, reason: ${currentOrder.orderInvalidReason || 'none'}`);
          this.orderCache.set(orderHash, currentOrder);
          updatedOrders.push(currentOrder);
        }
      }
    }
    
    // Check for removed orders (orders that are no longer in API response)
    for (const [orderHash, cachedOrder] of this.orderCache) {
      if (!currentOrderMap.has(orderHash)) {
        logger.debug(`🗑️ 1inch order removed from API: ${orderHash.slice(0, 10)}...`);
        this.orderCache.delete(orderHash);
        
        // Publish removal update
        const removalUpdate = {
          ...cachedOrder,
          orderInvalidReason: "removed_from_api",
          remainingMakerAmount: "0"
        };
        updatedOrders.push(removalUpdate);
      }
    }
    
    return updatedOrders;
  }

  private async publishOrderUpdate(order: OneInchOrderData) {
    try {
      const channel = `1inch-orders.${order.orderHash}`;
      const updateData = {
        ...order,
        lastUpdate: Date.now(),
        monitorTimestamp: this.lastPollTime,
      };
      
      // Publish to specific order channel
      pubSubServer.publish(channel, updateData);
      
      // Also publish to general 1inch orders channel for bulk listeners
      pubSubServer.publish("1inch-orders.all", updateData);
      
      logger.debug(`📤 Published 1inch order update: ${order.orderHash.slice(0, 10)}... to ${channel}`);
      
    } catch (error) {
      logger.error(`Failed to publish 1inch order update for ${order.orderHash}:`, error);
    }
  }

  /**
   * Get current order data from cache
   */
  getOrder(orderHash: string): OneInchOrderData | null {
    return this.orderCache.get(orderHash) || null;
  }

  /**
   * Get all cached orders
   */
  getAllOrders(): OneInchOrderData[] {
    return Array.from(this.orderCache.values());
  }

  /**
   * Get orders by maker address
   */
  getOrdersByMaker(makerAddress: string): OneInchOrderData[] {
    return Array.from(this.orderCache.values()).filter(
      order => order.data.maker.toLowerCase() === makerAddress.toLowerCase()
    );
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      totalOrders: this.orderCache.size,
      lastPollTime: this.lastPollTime,
      config: {
        chainId: this.config.chainId,
        pollInterval: this.config.pollInterval,
        delegateProxyAddress: this.config.delegateProxyAddress,
      },
    };
  }

  /**
   * Force immediate poll (for testing/debugging)
   */
  async forcePoll(): Promise<void> {
    if (!this.isRunning) {
      throw new Error("Service not running");
    }
    
    await this.pollOrders();
  }
}

// Export singleton instance
export const oneInchOrderMonitor = new OneInchOrderMonitorService();

// Main execution when run directly
if (import.meta.main) {
  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Received SIGINT signal");
    await oneInchOrderMonitor.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM signal");
    await oneInchOrderMonitor.stop();
    process.exit(0);
  });

  // Start the service
  oneInchOrderMonitor.start().catch((error) => {
    logger.error("Failed to start 1inch Order Monitor service:", error);
    process.exit(1);
  });
}