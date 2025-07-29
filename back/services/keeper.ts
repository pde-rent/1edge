#!/usr/bin/env bun

import { ethers } from "ethers";
import { getServiceConfig } from "./config";
import {
  initStorage,
  getActiveOrders,
  saveOrderEvent,
  saveOrder,
  getOrderEvents,
} from "./storage";
import { logger } from "@back/utils/logger";
import type { KeeperConfig, Order, NetworkConfig } from "@common/types";
import { OrderStatus, OrderEventType } from "@common/types";
import { NETWORKS } from "@common/constants";
import { sleep } from "@common/utils";

class KeeperService {
  private config: KeeperConfig;
  private isRunning: boolean = false;
  private providers: Map<number, ethers.Provider> = new Map();
  private wallets: Map<number, ethers.Wallet> = new Map();
  private contracts: Map<number, ethers.Contract> = new Map();

  constructor() {
    this.config = getServiceConfig("keeper");
    // Initialize storage for order tracking
    initStorage(getServiceConfig("keeper" as any));
  }

  async start() {
    logger.info("Starting Keeper service...");
    this.isRunning = true;

    // DISABLED: Blockchain monitoring not needed right now
    // We'll focus on price tracking and periodic 1inch API checks instead
    logger.info(
      "⚠️  Blockchain monitoring disabled - focusing on price tracking only",
    );

    // TODO: Implement periodic 1inch API order status checks when needed
    // await this.initializeNetworks();
    // this.monitorOrders();

    logger.info("Keeper service started (monitoring disabled)");
  }

  async stop() {
    logger.info("Stopping Keeper service...");
    this.isRunning = false;
    logger.info("Keeper service stopped");
  }

  private async initializeNetworks() {
    if (!this.config.privateKey) {
      throw new Error("KEEPER_PK not configured");
    }

    for (const [chainId, network] of Object.entries(this.config.networks)) {
      const id = parseInt(chainId);

      try {
        // Initialize provider
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        this.providers.set(id, provider);

        // Initialize wallet
        const wallet = new ethers.Wallet(this.config.privateKey, provider);
        this.wallets.set(id, wallet);

        // Initialize limit order contract
        const limitOrderAbi = [
          // Basic ABI for monitoring events
          "event OrderFilled(bytes32 indexed orderHash, uint256 makingAmount, uint256 takingAmount)",
          "event OrderCancelled(bytes32 indexed orderHash)",
          "function fillOrder(tuple(uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order, bytes signature, bytes interaction, uint256 makingAmount, uint256 takingAmount, uint256 skipPermitAndThresholdAmount) payable returns (uint256, uint256, bytes32)",
          "function cancelOrder(tuple(uint256 salt, address makerAsset, address takerAsset, address maker, address receiver, address allowedSender, uint256 makingAmount, uint256 takingAmount, uint256 offsets, bytes interactions) order)",
          "function remaining(bytes32 orderHash) view returns (uint256)",
        ];

        const contract = new ethers.Contract(
          network.limitOrderContract,
          limitOrderAbi,
          wallet,
        );
        this.contracts.set(id, contract);

        // Set up event listeners
        this.setupEventListeners(id, contract);

        logger.info(`Initialized keeper for ${network.name} (${id})`);
      } catch (error) {
        logger.error(`Failed to initialize network ${id}:`, error);
      }
    }
  }

  private setupEventListeners(chainId: number, contract: ethers.Contract) {
    // Listen for OrderFilled events
    contract.on(
      "OrderFilled",
      async (orderHash, makingAmount, takingAmount, event) => {
        logger.info(`Order filled: ${orderHash}`);
        await this.handleOrderFilled(
          chainId,
          orderHash,
          makingAmount,
          takingAmount,
          event,
        );
      },
    );

    // Listen for OrderCancelled events
    contract.on("OrderCancelled", async (orderHash, event) => {
      logger.info(`Order cancelled: ${orderHash}`);
      await this.handleOrderCancelled(chainId, orderHash, event);
    });
  }

  private async handleOrderFilled(
    chainId: number,
    orderHash: string,
    makingAmount: bigint,
    takingAmount: bigint,
    event: any,
  ) {
    try {
      // Find order by hash
      const orders = await getActiveOrders();
      const order = orders.find((o) => o.orderHash === orderHash);

      if (!order) {
        logger.warn(`Order not found for hash: ${orderHash}`);
        return;
      }

      // Update order status
      const remainingAmount = BigInt(order.makingAmount) - makingAmount;
      order.filledAmount = (
        BigInt(order.filledAmount || "0") + makingAmount
      ).toString();
      order.remainingAmount = remainingAmount.toString();

      if (remainingAmount === 0n) {
        order.status = OrderStatus.FILLED;
        order.executedAt = Date.now();
      } else {
        order.status = OrderStatus.PARTIALLY_FILLED;
      }

      order.txHash = event.transactionHash;
      await saveOrder(order);

      // Create filled event
      await saveOrderEvent({
        orderId: order.id,
        orderHash: order.orderHash,
        type:
          remainingAmount === 0n
            ? OrderEventType.FILLED
            : OrderEventType.PARTIALLY_FILLED,
        timestamp: Date.now(),
        txHash: event.transactionHash,
        filledAmount: makingAmount.toString(),
        remainingAmount: remainingAmount.toString(),
        gasUsed: event.gasUsed?.toString(),
      });

      logger.info(
        `Order ${order.id} filled: ${makingAmount.toString()} / ${order.makingAmount}`,
      );
    } catch (error) {
      logger.error(`Error handling order filled event:`, error);
    }
  }

  private async handleOrderCancelled(
    chainId: number,
    orderHash: string,
    event: any,
  ) {
    try {
      // Find order by hash
      const orders = await getActiveOrders();
      const order = orders.find((o) => o.orderHash === orderHash);

      if (!order) {
        logger.warn(`Order not found for hash: ${orderHash}`);
        return;
      }

      // Update order status
      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = Date.now();
      order.txHash = event.transactionHash;
      await saveOrder(order);

      // Create cancelled event
      await saveOrderEvent({
        orderId: order.id,
        orderHash: order.orderHash,
        type: OrderEventType.CANCELLED,
        timestamp: Date.now(),
        txHash: event.transactionHash,
        gasUsed: event.gasUsed?.toString(),
      });

      logger.info(`Order ${order.id} cancelled`);
    } catch (error) {
      logger.error(`Error handling order cancelled event:`, error);
    }
  }

  private async monitorOrders() {
    while (this.isRunning) {
      try {
        await this.checkOrderStatuses();
        await this.checkExpiredOrders();
        await this.executeScheduledOrders();
      } catch (error) {
        logger.error("Error in monitor loop:", error);
      }

      await sleep(this.config.pollIntervalMs);
    }
  }

  private async checkOrderStatuses() {
    const orders = await getActiveOrders();

    for (const order of orders) {
      if (!order.orderHash) continue;

      try {
        // Get the contract for this order's network
        const contract = this.contracts.get(1); // TODO: Get from order
        if (!contract) continue;

        // Check remaining amount on-chain
        const remaining = await contract.remaining(order.orderHash);

        if (remaining === 0n && order.status !== OrderStatus.FILLED) {
          // Order is filled but we missed the event
          order.status = OrderStatus.FILLED;
          order.executedAt = Date.now();
          order.filledAmount = order.makingAmount;
          order.remainingAmount = "0";
          await saveOrder(order);

          logger.info(`Order ${order.id} filled (detected by polling)`);
        }
      } catch (error) {
        logger.error(`Error checking order ${order.id}:`, error);
      }
    }
  }

  private async checkExpiredOrders() {
    const orders = await getActiveOrders();
    const now = Date.now() / 1000;

    for (const order of orders) {
      if (order.expiry && order.expiry < now) {
        // Order has expired
        order.status = OrderStatus.EXPIRED;
        await saveOrder(order);

        // Create expired event
        await saveOrderEvent({
          orderId: order.id,
          orderHash: order.orderHash,
          type: OrderEventType.EXPIRED,
          timestamp: Date.now(),
        });

        logger.info(`Order ${order.id} expired`);
      }
    }
  }

  private async executeScheduledOrders() {
    // TODO: Implement scheduled order execution for complex order types
    // This would handle things like:
    // - Next TWAP interval
    // - Iceberg order refresh
    // - Triggered orders based on conditions
  }

  private async checkGasPrice(chainId: number): Promise<boolean> {
    const provider = this.providers.get(chainId);
    if (!provider) return false;

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;

    if (!gasPrice) return true; // Proceed if we can't get gas price

    const maxGasPrice = ethers.parseUnits(
      this.config.maxGasPrice || "100",
      "gwei",
    );

    if (gasPrice > maxGasPrice) {
      logger.warn(
        `Gas price too high on chain ${chainId}: ${ethers.formatUnits(gasPrice, "gwei")} gwei`,
      );
      return false;
    }

    return true;
  }
}

// Main execution
const keeper = new KeeperService();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT signal");
  await keeper.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM signal");
  await keeper.stop();
  process.exit(0);
});

// Start the service
keeper.start().catch((error) => {
  logger.error("Failed to start Keeper service:", error);
  process.exit(1);
});
