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
import type { Order, KeeperConfig } from "@common/types";
import { OrderStatus, OrderType } from "@common/types";
import { sleep, generateId } from "@common/utils";
import { getOrderWatcher } from "@back/orders";
import { ethers } from "ethers";
import type { TwapParams, RangeOrderParams } from "@common/types";

class OrderRegistryService {
  private config: KeeperConfig;
  private isRunning: boolean = false;
  private watchers: Map<string, boolean> = new Map();
  private mockMode: boolean = false;

  constructor(mockMode: boolean = false) {
    this.config = getServiceConfig("keeper");
    this.mockMode = mockMode;
    initStorage(getServiceConfig("keeper" as any));
  }

  async start() {
    logger.info("Starting Order Registry service...");
    this.isRunning = true;

    // Reliability: Load pending orders from database to restart watchers
    // This ensures watchers are restored after server shutdown/restart
    const pendingOrders = await getPendingOrders();
    logger.info(
      `Restoring ${pendingOrders.length} pending orders from database`,
    );

    for (const order of pendingOrders) {
      this.startWatcher(order);
      logger.debug(`Restored watcher for order ${order.id}`);
    }

    logger.info(
      `Order Registry service started with ${pendingOrders.length} active watchers`,
    );
  }

  async stop() {
    logger.info("Stopping Order Registry service...");
    this.isRunning = false;
    this.watchers.clear();
    logger.info("Order Registry service stopped");
  }

  async createOrder(order: Order) {
    if (!this.validateOrderSignature(order)) {
      throw new Error("Invalid order signature");
    }
    if (!order.makingAmount && order.params?.amount) {
      // For TWAP orders, use the total amount from params
      if (order.type === OrderType.TWAP) {
        order.makingAmount = order.params.amount;
      } else {
        // For other order types, use size as fallback
        order.makingAmount = order.size.toString();
      }
    } else if (!order.makingAmount) {
      // Fallback to size if no params.amount
      order.makingAmount = order.size.toString();
    }

    if (!order.takingAmount) {
      // Calculate taking amount based on maxPrice if available
      if (order.params?.maxPrice) {
        const makingAmountNum = parseFloat(order.makingAmount);
        const maxPrice = order.params.maxPrice;
        order.takingAmount = (makingAmountNum * maxPrice * 1e6).toString();
      } else {
        // Fallback calculation - assume 1:2000 ratio (1 ETH = 2000 USDT)
        const makingAmountNum = parseFloat(order.makingAmount);
        const estimatedTakingAmount = makingAmountNum * 2000;
        // Convert to proper decimal places (USDT has 6 decimals)
        order.takingAmount = (estimatedTakingAmount * 1e6).toString();
      }
    }

    // Initialize order fields with proper defaults
    order.status = OrderStatus.PENDING;
    order.triggerCount = 0;
    order.remainingSize = order.size.toString();
    order.createdAt = Date.now();

    // Set other required fields to null if not provided
    order.orderHash = order.orderHash || null;
    order.strategyId = order.strategyId || null;
    order.receiver = order.receiver || null;
    order.salt = order.salt || null;
    order.nextTriggerValue = order.nextTriggerValue || null;
    order.triggerPrice = order.triggerPrice || null;
    order.filledAmount = order.filledAmount || "0";
    order.executedAt = order.executedAt || null;
    order.cancelledAt = order.cancelledAt || null;
    order.txHash = order.txHash || null;
    order.expiry = order.expiry || null;
    order.oneInchOrderHashes = order.oneInchOrderHashes || null;

    // Clean up extra fields that shouldn't be stored
    const { pair, validateOnly, ...cleanOrder } = order as any;

    console.log("Order after processing:", cleanOrder);

    // Save the order to the database
    await saveOrder(cleanOrder);

    // Create order event
    await saveOrderEvent({
      orderId: cleanOrder.id,
      status: OrderStatus.PENDING,
      timestamp: Date.now(),
    });

    // Start a watcher for the new order
    this.startWatcher(cleanOrder);

    logger.info(`Order ${cleanOrder.id} registered successfully`);
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

  async modifyOrder(
    orderId: string,
    newOrderData: Partial<Order>,
  ): Promise<string> {
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

    logger.info(
      `Order ${orderId} modified successfully, new order: ${newOrder.id}`,
    );
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
        if (
          !currentOrder ||
          (currentOrder.status !== OrderStatus.PENDING &&
            currentOrder.status !== OrderStatus.ACTIVE)
        ) {
          this.watchers.delete(order.id);
          break;
        }

        // Check trigger conditions
        const triggered = await this.checkTriggers(currentOrder);
        if (triggered) {
          await this.executeOrder(currentOrder);

          // For recurring orders, check if they should continue based on completion criteria
          const updatedOrder = await getOrder(currentOrder.id);
          if (updatedOrder) {
            const shouldComplete = this.shouldCompleteOrder(updatedOrder);
            if (shouldComplete) {
              // Mark order as completed and stop watcher
              logger.info(
                `Order ${updatedOrder.id} completed, marking as finished`,
              );
              updatedOrder.status = OrderStatus.COMPLETED;
              await saveOrder(updatedOrder);
              this.watchers.delete(order.id);
              break;
            }
          }
        }
      } catch (error) {
        logger.error(`Error watching order ${order.id}:`, error);
      }

      await sleep(5000); // 5 seconds
    }
  }

  private async checkTriggers(order: Order): Promise<boolean> {
    const watcher = getOrderWatcher(order.type);
    if (!watcher) {
      logger.warn(`No watcher found for order type: ${order.type}`);
      return false;
    }

    return watcher.shouldTrigger(order);
  }

  private async executeOrder(order: Order) {
    try {
      const watcher = getOrderWatcher(order.type);
      if (!watcher) {
        throw new Error(`No watcher found for order type: ${order.type}`);
      }

      logger.info(`Executing order ${order.id}`);

      // Increment trigger count
      order.triggerCount = (order.triggerCount || 0) + 1;

      // Calculate amounts based on order type
      const amounts = this.calculateOrderAmounts(order);

      // Trigger using watcher with calculated amounts
      await watcher.trigger(order, amounts.makerAmount, amounts.takerAmount);

      // Update order status
      order.status = OrderStatus.ACTIVE;

      // Update next trigger for recurring orders
      if (watcher.updateNextTrigger) {
        watcher.updateNextTrigger(order);
      }

      await saveOrder(order);

      // Create order event (order hash will be set by watcher in oneInchOrderHashes)
      await saveOrderEvent({
        orderId: order.id,
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

  private shouldCompleteOrder(order: Order): boolean {
    const now = Date.now();

    // For TWAP orders, check if we've completed all intervals or reached end date
    if (order.type === OrderType.TWAP && order.params) {
      const params = order.params as any;
      if (params.endDate && now >= params.endDate) {
        return true; // Past end date
      }

      if (params.interval && params.endDate && params.startDate) {
        const totalDuration = params.endDate - params.startDate;
        const intervalMs = params.interval;
        const totalIntervals = Math.ceil(totalDuration / intervalMs);

        if ((order.triggerCount || 0) >= totalIntervals) {
          return true; // Completed all intervals
        }
      }
    }

    // For Range orders, check if we've completed all steps or reached expiry
    if (order.type === OrderType.RANGE && order.params) {
      const params = order.params as RangeOrderParams;

      // Check expiry
      if (params.expiry) {
        const expiryTime =
          order.createdAt + params.expiry * 24 * 60 * 60 * 1000;
        if (now >= expiryTime) {
          return true; // Past expiry
        }
      }

      // Check if all steps completed
      const priceRange = Math.abs(params.endPrice - params.startPrice);
      const stepSize = priceRange * (params.stepPct / 100);
      const totalSteps = Math.ceil(priceRange / stepSize);

      if ((order.triggerCount || 0) >= totalSteps) {
        return true; // Completed all steps
      }
    }

    // For other order types, implement similar logic as needed
    return false; // Continue watching by default
  }

  private calculateOrderAmounts(order: Order): {
    makerAmount: string;
    takerAmount: string;
  } {
    // Calculate amounts based on order type
    switch (order.type) {
      case OrderType.TWAP: {
        const params = order.params as TwapParams;
        if (!params) {
          throw new Error("Invalid TWAP order params");
        }

        // Calculate total intervals and amount per interval
        const totalDuration = params.endDate - params.startDate;
        const intervalMs = params.interval;
        const totalIntervals = Math.ceil(totalDuration / intervalMs);
        const amountPerInterval = parseFloat(params.amount) / totalIntervals;

        // Calculate taking amount based on making amount ratio
        const originalMaking = parseFloat(order.makingAmount);
        const ratio = amountPerInterval / parseFloat(params.amount);
        const takerAmountForInterval = (
          parseFloat(order.takingAmount) * ratio
        ).toString();

        return {
          makerAmount: amountPerInterval.toString(),
          takerAmount: takerAmountForInterval,
        };
      }

      case OrderType.RANGE: {
        const params = order.params as RangeOrderParams;
        if (!params) {
          throw new Error("Invalid Range order params");
        }

        // Calculate total steps and amount per step
        const priceRange = Math.abs(params.endPrice - params.startPrice);
        const stepSize = priceRange * (params.stepPct / 100);
        const totalSteps = Math.ceil(priceRange / stepSize);
        const amountPerStep = parseFloat(params.amount) / totalSteps;

        // Calculate taking amount based on making amount ratio
        const ratio = amountPerStep / parseFloat(params.amount);
        const takerAmountForStep = (
          parseFloat(order.takingAmount) * ratio
        ).toString();

        return {
          makerAmount: amountPerStep.toString(),
          takerAmount: takerAmountForStep,
        };
      }

      case OrderType.STOP_LIMIT:
      default: {
        // For stop-limit and other orders, use the full amounts
        return {
          makerAmount: order.size,
          takerAmount: order.takingAmount,
        };
      }
    }
  }

  private validateOrderSignature(order: Order): boolean {
    if (!order.userSignedPayload || !order.signature) {
      logger.warn("Order missing signature or payload");
      return false;
    }

    try {
      let messageToSign: string;

      if (typeof order.userSignedPayload === "string") {
        messageToSign = order.userSignedPayload;
      } else {
        messageToSign = JSON.stringify(order.userSignedPayload);
      }

      logger.debug(`Message to verify: ${messageToSign}`);
      const signerAddress = ethers.verifyMessage(
        messageToSign,
        order.signature,
      );

      logger.debug(
        `Recovered signer: ${signerAddress}, Expected maker: ${order.maker}`,
      );

      const isValid = signerAddress.toLowerCase() === order.maker.toLowerCase();

      if (!isValid) {
        logger.warn(
          `Invalid signature: expected ${order.maker}, got ${signerAddress}`,
        );
      } else {
        logger.info(`✅ Valid signature for order ${order.id}`);
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

// Export function to create instance with mock mode
export function createOrderRegistry(
  mockMode: boolean = false,
): OrderRegistryService {
  return new OrderRegistryService(mockMode);
}

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
