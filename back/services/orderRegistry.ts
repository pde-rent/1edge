#!/usr/bin/env bun

import { getServiceConfig } from "./config";
import {
  initStorage,
  saveOrder,
  getOrder,
  getActiveOrders,
  getPendingOrders,
  saveOrderEvent,
} from "./storage";
import { logger } from "@back/utils/logger";
import type { Order, KeeperConfig, TriggerType } from "@common/types";
import { OrderStatus } from "@common/types";
import { sleep, generateId } from "@common/utils";
import { getOrderHandler } from "@back/orders";
import { ethers } from "ethers";

class OrderRegistryService {
  private config: KeeperConfig;
  private isRunning: boolean = false;
  private watchers: Map<string, boolean> = new Map();

  constructor() {
    this.config = getServiceConfig("keeper");
    initStorage(getServiceConfig("keeper" as any));
  }

  async start() {
    logger.info("Starting Order Registry service...");
    this.isRunning = true;

    // Reliability: Load pending orders from database to restart watchers
    // This ensures watchers are restored after server shutdown/restart
    const pendingOrders = await getPendingOrders();
    logger.info(`Restoring ${pendingOrders.length} pending orders from database`);
    
    for (const order of pendingOrders) {
      this.startWatcher(order);
      logger.debug(`Restored watcher for order ${order.id}`);
    }

    logger.info(`Order Registry service started with ${pendingOrders.length} active watchers`);
  }

  async stop() {
    logger.info("Stopping Order Registry service...");
    this.isRunning = false;
    this.watchers.clear();
    logger.info("Order Registry service stopped");
  }

  async createOrder(order: Order) {
    // Validate order signature (EVM signature verification)
    if (!this.validateOrderSignature(order)) {
      throw new Error("Invalid order signature");
    }

    // Initialize order fields
    order.status = OrderStatus.PENDING;
    order.triggerCount = 0;
    order.remainingSize = order.size;
    order.createdAt = Date.now();

    // Save the order to the database
    await saveOrder(order);

    // Create order event
    await saveOrderEvent({
      orderId: order.id,
      status: OrderStatus.PENDING,
      timestamp: Date.now(),
    });

    // Start a watcher for the new order
    this.startWatcher(order);
    
    logger.info(`Order ${order.id} registered successfully`);
  }

  async cancelOrder(orderId: string): Promise<void> {
    const order = await getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Stop watcher
    this.watchers.delete(orderId);

    // Update order status
    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = Date.now();
    await saveOrder(order);

    // Create cancelled event
    await saveOrderEvent({
      orderId: order.id,
      status: OrderStatus.CANCELLED,
      timestamp: Date.now(),
    });

    logger.info(`Order ${orderId} cancelled successfully`);
  }

  async modifyOrder(orderId: string, newOrderData: Partial<Order>): Promise<string> {
    // Cancel existing order
    await this.cancelOrder(orderId);

    // Create new order with updated data
    const existingOrder = await getOrder(orderId);
    if (!existingOrder) {
      throw new Error(`Order ${orderId} not found`);
    }

    const newOrder: Order = {
      ...existingOrder,
      ...newOrderData,
      id: generateId(), // New ID
      status: OrderStatus.PENDING,
      createdAt: Date.now(),
      triggerCount: 0,
      cancelledAt: undefined,
      executedAt: undefined,
    };

    await this.createOrder(newOrder);
    
    logger.info(`Order ${orderId} modified successfully, new order: ${newOrder.id}`);
    return newOrder.id;
  }

  private startWatcher(order: Order) {
    if (this.watchers.has(order.id)) {
      return;
    }

    this.watchers.set(order.id, true);
    this.watchOrder(order);
  }

  private async watchOrder(order: Order) {
    while (this.isRunning && this.watchers.has(order.id)) {
      try {
        const currentOrder = await getOrder(order.id);
        if (!currentOrder || currentOrder.status !== OrderStatus.PENDING) {
          this.watchers.delete(order.id);
          break;
        }

        // Check trigger conditions
        const triggered = await this.checkTriggers(currentOrder);
        if (triggered) {
          await this.executeOrder(currentOrder);
          this.watchers.delete(order.id);
          break;
        }
      } catch (error) {
        logger.error(`Error watching order ${order.id}:`, error);
      }

      await sleep(5000); // 5 seconds
    }
  }

  private async checkTriggers(order: Order): Promise<boolean> {
    const handler = getOrderHandler(order.type);
    if (!handler) {
      logger.warn(`No handler found for order type: ${order.type}`);
      return false;
    }
    
    return handler.shouldTrigger(order);
  }

  private async executeOrder(order: Order) {
    try {
      const handler = getOrderHandler(order.type);
      if (!handler) {
        throw new Error(`No handler found for order type: ${order.type}`);
      }

      logger.info(`Executing order ${order.id}`);
      
      // Increment trigger count
      order.triggerCount = (order.triggerCount || 0) + 1;
      
      // Execute using handler
      await handler.execute(order);
      
      // Create 1inch order hash (placeholder - will be set by handler)
      const mockOrderHash = `0x${generateId()}`;
      if (!order.oneInchOrderHashes) {
        order.oneInchOrderHashes = [];
      }
      order.oneInchOrderHashes.push(mockOrderHash);

      // Update order status
      order.status = OrderStatus.ACTIVE;
      
      // Update next trigger for recurring orders
      if (handler.updateNextTrigger) {
        handler.updateNextTrigger(order);
      }
      
      await saveOrder(order);

      // Create order event
      await saveOrderEvent({
        orderId: order.id,
        orderHash: mockOrderHash,
        status: OrderStatus.SUBMITTED,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`Failed to execute order ${order.id}:`, error);

      // Update order status
      order.status = OrderStatus.FAILED;
      await saveOrder(order);

      // Create failed event
      await saveOrderEvent({
        orderId: order.id,
        status: OrderStatus.FAILED,
        timestamp: Date.now(),
        error: error.message,
      });
    }
  }

  private validateOrderSignature(order: Order): boolean {
    if (!order.userSignedPayload || !order.signature) {
      logger.warn("Order missing signature or payload");
      return false;
    }

    try {
      // Reconstruct the message that was signed
      const message = JSON.stringify({
        type: order.type,
        pair: order.pair,
        size: order.size,
        params: order.params,
        maker: order.maker,
        makerAsset: order.makerAsset,
        takerAsset: order.takerAsset,
      });

      // Recover signer address from signature
      const messageHash = ethers.utils.hashMessage(message);
      const signerAddress = ethers.utils.recoverAddress(messageHash, order.signature);

      // Verify signer matches order maker
      const isValid = signerAddress.toLowerCase() === order.maker.toLowerCase();
      
      if (!isValid) {
        logger.warn(`Invalid signature: expected ${order.maker}, got ${signerAddress}`);
      }
      
      return isValid;
    } catch (error) {
      logger.error("Error validating signature:", error);
      return false;
    }
  }
}

// Export singleton instance
export const orderRegistry = new OrderRegistryService();

// Main execution when run directly
if (import.meta.main) {
  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Received SIGINT signal");
    await orderRegistry.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM signal");
    await orderRegistry.stop();
    process.exit(0);
  });

  // Start the service
  orderRegistry.start().catch((error) => {
    logger.error("Failed to start Order Registry service:", error);
    process.exit(1);
  });
}
