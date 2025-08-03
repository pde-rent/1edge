#!/usr/bin/env bun

import { getServiceConfig } from "./config";
import {
  initStorage,
  saveOrder,
  getOrder,
  getActiveOrders,
  getPendingOrders,
  saveOrderEvent,
  getOrdersByMaker,
} from "./storage";
import { logger } from "@back/utils/logger";
import type { Order, KeeperConfig } from "@common/types";
import { OrderStatus, OrderType } from "@common/types";
import { sleep, generateId } from "@common/utils";
import { getOrderWatcher } from "@back/orders";
import { ethers } from "ethers";
import type { TwapParams, RangeOrderParams } from "@common/types";
import { SERVICE_PORTS } from "@common/constants";

class OrderRegistryService {
  private config: KeeperConfig;
  private isRunning: boolean = false;
  private activeOrders: Set<string> = new Set(); // Track active order IDs
  private mockMode: boolean = false;
  private server?: any;
  private watchInterval?: any; // Single interval for all orders

  constructor(mockMode: boolean = false) {
    this.config = getServiceConfig("keeper");
    this.mockMode = mockMode;
    initStorage(getServiceConfig("keeper" as any));
  }

  async start() {
    logger.info("Starting Order Registry service...");
    this.isRunning = true;

    // Start HTTP server (skip in mock mode)
    if (!this.mockMode) {
      await this.startHttpServer();
    }

    // Load active orders from database
    const activeOrders = await getActiveOrders();
    for (const order of activeOrders) {
      this.activeOrders.add(order.id);
    }

    logger.info(
      `Order Registry service started with ${activeOrders.length} active orders`,
    );

    // Start a single watch interval that processes all orders
    this.startWatchInterval();
  }

  async stop() {
    logger.info("Stopping Order Registry service...");
    this.isRunning = false;

    // Stop watch interval
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = undefined;
    }

    this.activeOrders.clear();

    // Stop HTTP server
    if (this.server) {
      this.server.stop();
      logger.info("Order Registry HTTP server stopped");
    }

    logger.info("Order Registry service stopped");
  }

  async createOrder(order: Order) {
    if (!this.validateOrderSignature(order)) {
      throw new Error("Invalid order signature");
    }

    // Validate that order has required params
    if (!order.params?.makingAmount) {
      throw new Error("Order must have params.makingAmount defined");
    }

    // Initialize order fields with proper defaults
    order.status = OrderStatus.PENDING;
    order.triggerCount = 0;
    order.remainingMakerAmount = order.params.makingAmount;
    order.createdAt = Date.now();

    // Set other required fields to null if not provided
    order.orderHash = order.orderHash;
    // strategyId removed - strategies are just fancy orders
    order.receiver = order.receiver;
    order.salt = order.salt;
    order.nextTriggerValue = order.nextTriggerValue;
    order.nextTriggerValue = order.nextTriggerValue;
    order.filledAmount = order.filledAmount || "0";
    order.executedAt = order.executedAt;
    order.cancelledAt = order.cancelledAt;
    order.txHash = order.txHash;
    order.expiry = order.expiry;
    order.oneInchOrderHashes = order.oneInchOrderHashes;

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

    // Add to active orders set
    this.activeOrders.add(cleanOrder.id);

    logger.info(`Order ${cleanOrder.id} registered successfully`);
  }

  async cancelOrder(orderId: string): Promise<void> {
    const order = await getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Remove from active orders
    this.activeOrders.delete(orderId);

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

  private startWatchInterval() {
    // Process all active orders every 5 seconds
    this.watchInterval = setInterval(async () => {
      if (!this.isRunning) return;

      // Process orders in batches to avoid blocking
      const orderIds = Array.from(this.activeOrders);
      logger.info(`📊 Processing ${orderIds.length} active orders: [${orderIds.join(', ')}]`);
      
      for (const orderId of orderIds) {
        try {
          await this.processOrder(orderId);
        } catch (error) {
          logger.error(`Error processing order ${orderId}:`, error);
        }
      }
    }, 5000); // 5 seconds
  }

  private async processOrder(orderId: string) {
    logger.info(`🔍 Processing order: ${orderId}`);
    const order = await getOrder(orderId);
    if (!order) {
      logger.warn(`Order ${orderId} not found in database, removing from active set`);
      this.activeOrders.delete(orderId);
      return;
    }

    // Remove completed/failed orders from tracking
    if (
      order.status === OrderStatus.FILLED ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.FAILED
    ) {
      this.activeOrders.delete(orderId);
      return;
    }

    // Get the appropriate watcher for this order type
    const orderType = order.params?.type;
    logger.info(`Order ${order.id} type: ${orderType}`);
    if (!orderType) {
      logger.warn(`Order ${order.id} missing type in params`);
      return;
    }

    const watcher = getOrderWatcher(orderType);
    logger.info(`Watcher for ${orderType}: ${watcher ? 'found' : 'not found'}`);
    if (!watcher) {
      logger.warn(`No watcher found for order type: ${orderType}`);
      return;
    }

    // For ACTIVE/PARTIALLY_FILLED orders, update from on-chain data
    if (
      order.status === OrderStatus.ACTIVE ||
      order.status === OrderStatus.PARTIALLY_FILLED
    ) {
      await (watcher as any).updateOrderFromOnChain?.(order);

      // Check if order completed after update
      const updatedOrder = await getOrder(orderId);
      if (updatedOrder?.status === OrderStatus.FILLED) {
        this.activeOrders.delete(orderId);
        return;
      }
    }

    // Check if trigger conditions are met for PENDING orders
    logger.info(`Order ${order.id} status: ${order.status}`);
    if (order.status === OrderStatus.PENDING) {
      // Check if order has expired before triggering
      if ((watcher as any).isExpired?.(order)) {
        logger.info(
          `⏰ Order ${order.id.slice(0, 8)}... has expired before triggering`,
        );
        order.status = OrderStatus.EXPIRED;
        order.cancelledAt = Date.now();
        await saveOrder(order);
        this.activeOrders.delete(orderId);

        await saveOrderEvent({
          orderId: order.id,
          status: OrderStatus.EXPIRED,
          timestamp: Date.now(),
        });
        return;
      }

      logger.info(`Checking if order ${order.id} should trigger...`);
      const shouldTrigger = await watcher.shouldTrigger(order);
      logger.info(`Order ${order.id} shouldTrigger result: ${shouldTrigger}`);
      if (!shouldTrigger) return;

      // Execute the order
      try {
        logger.info(
          `🚀 Triggering order ${order.id.slice(0, 8)}... (${orderType})`,
        );

        // Calculate amounts for this trigger
        const amounts = await this.calculateTriggerAmounts(order);

        // Let the watcher handle the execution (creates 1inch order and submits)
        await watcher.trigger(
          order,
          amounts.makingAmount,
          amounts.takingAmount,
        );

        // Order state is updated within the trigger method

        // Let watcher update next trigger if needed
        if (watcher.updateNextTrigger) {
          watcher.updateNextTrigger(order);
        }

        // Create order event
        await saveOrderEvent({
          orderId: order.id,
          status: OrderStatus.SUBMITTED,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error(`❌ Failed to execute order ${order.id}:`, error);

        // Mark as failed
        order.status = OrderStatus.FAILED;
        await saveOrder(order);

        // Remove from active orders
        this.activeOrders.delete(orderId);

        // Create failed event
        await saveOrderEvent({
          orderId: order.id,
          status: OrderStatus.FAILED,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async calculateTriggerAmounts(order: Order): Promise<{
    makingAmount: string;
    takingAmount: string;
  }> {
    // For orders with specific makingAmount params, calculate based on type
    if (order.params?.makingAmount) {
      const totalMakingAmount = order.params.makingAmount;

      // Calculate how much to execute for this trigger
      let triggerRatio = 1; // Default to full amount

      if (order.params.type === OrderType.TWAP) {
        const params = order.params as TwapParams;
        const duration = params.endDate - params.startDate;
        if (duration > 0 && params.interval > 0) {
          const intervals = Math.ceil(duration / params.interval);
          triggerRatio = 1 / intervals;
        }
      } else if (order.params.type === OrderType.RANGE) {
        const params = order.params as RangeOrderParams;
        const priceRange = Math.abs(params.endPrice - params.startPrice);
        const stepSize = priceRange * (params.stepPct / 100);
        const steps = Math.ceil(priceRange / stepSize);
        triggerRatio = 1 / steps;
      }

      const triggerMakingAmount = totalMakingAmount * triggerRatio;

      // For now, return string representation for 1inch integration
      // We'll calculate takingAmount dynamically in the watcher based on current price
      return {
        makingAmount: triggerMakingAmount.toString(),
        takingAmount: "0", // Will be calculated dynamically based on current price
      };
    }

    // Fallback: use remaining amount
    return {
      makingAmount: order.remainingMakerAmount.toString(),
      takingAmount: "0", // Will be calculated dynamically
    };
  }

  private async startHttpServer() {
    const port = SERVICE_PORTS.ORDER_REGISTRY;

    this.server = Bun.serve({
      port,
      fetch: async (request: Request): Promise<Response> => {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // CORS headers
        const corsHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        // Handle preflight requests
        if (method === "OPTIONS") {
          return new Response(null, { status: 200, headers: corsHeaders });
        }

        try {
          // Health check endpoint
          if (path === "/ping" && method === "GET") {
            return new Response(
              JSON.stringify({ status: "ok", service: "order-registry" }),
              {
                headers: { "Content-Type": "application/json", ...corsHeaders },
              },
            );
          }

          // Create order
          if (path === "/orders" && method === "POST") {
            const order = (await request.json()) as Order;
            await this.createOrder(order);
            return new Response(
              JSON.stringify({ success: true, orderId: order.id }),
              {
                headers: { "Content-Type": "application/json", ...corsHeaders },
              },
            );
          }

          // Get orders (with optional maker filter)
          if (path === "/orders" && method === "GET") {
            const makerAddress = url.searchParams.get("maker");
            let orders;

            if (makerAddress) {
              orders = await getOrdersByMaker(makerAddress);
            } else {
              orders = await getActiveOrders();
            }

            return new Response(
              JSON.stringify({ success: true, data: orders }),
              {
                headers: { "Content-Type": "application/json", ...corsHeaders },
              },
            );
          }

          // Get specific order
          if (path.startsWith("/orders/") && method === "GET") {
            const orderId = path.split("/")[2];
            const order = await getOrder(orderId);

            if (!order) {
              return new Response(
                JSON.stringify({ success: false, error: "Order not found" }),
                {
                  status: 404,
                  headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
                  },
                },
              );
            }

            return new Response(
              JSON.stringify({ success: true, data: order }),
              {
                headers: { "Content-Type": "application/json", ...corsHeaders },
              },
            );
          }

          // Cancel order
          if (
            path.startsWith("/orders/") &&
            path.endsWith("/cancel") &&
            method === "POST"
          ) {
            const orderId = path.split("/")[2];
            await this.cancelOrder(orderId);
            return new Response(JSON.stringify({ success: true }), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }

          // Modify order
          if (path.startsWith("/orders/") && method === "PUT") {
            const orderId = path.split("/")[2];
            const newOrderData = (await request.json()) as Partial<Order>;
            const newOrderId = await this.modifyOrder(orderId, newOrderData);
            return new Response(JSON.stringify({ success: true, newOrderId }), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }

          // 404 for unknown endpoints
          return new Response(
            JSON.stringify({ success: false, error: "Not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        } catch (error: any) {
          logger.error("Order Registry HTTP error:", error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }
      },
    });

    logger.info(`Order Registry HTTP server started on port ${port}`);
  }

  private validateOrderSignature(order: Order): boolean {
    if (!order.signature || !order.params) {
      logger.warn("Order missing signature or params");
      return false;
    }

    try {
      // The user signs the OrderParams directly
      const messageToSign = JSON.stringify(order.params);

      logger.debug(`Message to verify: ${messageToSign}`);
      const signerAddress = ethers.verifyMessage(
        messageToSign,
        order.signature,
      );

      const expectedMaker = order.params.maker;
      logger.debug(
        `Recovered signer: ${signerAddress}, Expected maker: ${expectedMaker}`,
      );

      const isValid =
        signerAddress.toLowerCase() === expectedMaker.toLowerCase();

      if (!isValid) {
        logger.warn(
          `Invalid signature: expected ${expectedMaker}, got ${signerAddress}`,
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
