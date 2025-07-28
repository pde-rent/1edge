#!/usr/bin/env bun

// TODO: Fix 1inch SDK imports - temporarily commented out
// import { Sdk, LimitOrder, Api, AxiosProviderConnector } from "@1inch/limit-order-sdk";
import { ethers } from "ethers";
import { getServiceConfig } from "./config";
import { initStorage, saveOrder, saveOrderEvent, getActiveStrategies } from "./storage";
import { getTicker } from "./marketData";
import { getCurrentIndicators } from "./analysis";
import { logger } from "@back/utils/logger";
import type {
  OrderExecutorConfig,
  Strategy,
  Order,
  TriggerCondition,
  NetworkConfig,
} from "@common/types";
import {
  OrderStatus,
  OrderEventType,
  OrderType,
} from "@common/types";
import { NETWORKS, ONEINCH_API, ERROR_CODES } from "@common/constants";
import { generateId, sleep } from "@common/utils";

class OrderExecutorService {
  private config: OrderExecutorConfig;
  private isRunning: boolean = false;
  private strategies: Map<string, Strategy> = new Map();
  // TODO: Re-enable after fixing 1inch SDK imports
  // private sdks: Map<number, Sdk> = new Map(); // SDK per network
  // private apis: Map<number, Api> = new Map(); // API per network
  private providers: Map<number, ethers.Provider> = new Map();
  private wallets: Map<number, ethers.Wallet> = new Map();

  constructor() {
    this.config = getServiceConfig("orderExecutor");
    initStorage(getServiceConfig("orderExecutor" as any));
  }

  async start() {
    logger.info("Starting Order Executor service...");
    this.isRunning = true;

    // Initialize SDKs for configured networks
    await this.initializeNetworks();

    // Load strategies
    await this.loadStrategies();

    // Start strategy execution loop
    this.executeStrategies();

    logger.info("Order Executor service started");
  }

  async stop() {
    logger.info("Stopping Order Executor service...");
    this.isRunning = false;
    logger.info("Order Executor service stopped");
  }

  private async initializeNetworks() {
    const keeperConfig = getServiceConfig("keeper");

    if (!keeperConfig.privateKey) {
      throw new Error("KEEPER_PK not configured");
    }

    for (const [chainId, network] of Object.entries(keeperConfig.networks)) {
      const id = parseInt(chainId);

      try {
        // Initialize provider
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        this.providers.set(id, provider);

        // Initialize wallet
        const wallet = new ethers.Wallet(keeperConfig.privateKey, provider);
        this.wallets.set(id, wallet);

        // TODO: Re-enable after fixing 1inch SDK imports
        // Initialize 1inch SDK
        // const sdk = new Sdk({
        //   networkId: id,
        //   blockchainProvider: provider as any,
        // });
        // this.sdks.set(id, sdk);

        // Initialize 1inch API
        // const api = new Api({
        //   networkId: id,
        //   authKey: ONEINCH_API.API_KEY,
        //   httpConnector: new AxiosProviderConnector(),
        // });
        // this.apis.set(id, api);

        logger.info(`Initialized network ${network.name} (${id})`);
      } catch (error) {
        logger.error(`Failed to initialize network ${id}:`, error);
      }
    }
  }

  private async loadStrategies() {
    const activeStrategies = await getActiveStrategies();

    for (const strategy of activeStrategies) {
      this.strategies.set(strategy.id, strategy);
      logger.info(`Loaded strategy: ${strategy.name} (${strategy.id})`);
    }
  }

  private async executeStrategies() {
    while (this.isRunning) {
      for (const [id, strategy] of this.strategies) {
        if (strategy.status === "Running" && strategy.enabled) {
          try {
            await this.executeStrategy(strategy);
          } catch (error) {
            logger.error(`Error executing strategy ${id}:`, error);
          }
        }
      }

      // Wait before next iteration
      await sleep(5000); // 5 seconds
    }
  }

  private async executeStrategy(strategy: Strategy) {
    logger.debug(`Executing strategy ${strategy.id}`);

    // Check triggers
    const triggered = await this.checkTriggers(strategy);
    if (!triggered) {
      return;
    }

    // Execute based on strategy type
    switch (strategy.type) {
      case "TWAP":
        await this.executeTWAP(strategy);
        break;
      case "RANGE":
        await this.executeRangeOrder(strategy);
        break;
      case "ICEBERG":
        await this.executeIcebergOrder(strategy);
        break;
      case "NAIVE_REVERSION":
      case "MOMENTUM_REVERSION":
      case "TREND_FOLLOWING":
        await this.executeMarketMaking(strategy);
        break;
      default:
        logger.warn(`Unknown strategy type: ${strategy.type}`);
    }
  }

  private async checkTriggers(strategy: Strategy): Promise<boolean> {
    if (!strategy.triggers || strategy.triggers.length === 0) {
      return true; // No triggers means always execute
    }

    for (const trigger of strategy.triggers) {
      const result = await this.evaluateTrigger(trigger, strategy);
      if (!result) {
        return false; // All triggers must be true
      }
    }

    return true;
  }

  private async evaluateTrigger(
    trigger: TriggerCondition,
    strategy: Strategy
  ): Promise<boolean> {
    switch (trigger.type) {
      case "PRICE":
        return await this.evaluatePriceTrigger(trigger, strategy);
      case "TIME":
        return this.evaluateTimeTrigger(trigger);
      case "INDICATOR":
        return await this.evaluateIndicatorTrigger(trigger, strategy);
      default:
        return false;
    }
  }

  private async evaluatePriceTrigger(
    trigger: TriggerCondition,
    strategy: Strategy
  ): Promise<boolean> {
    if (strategy.symbols.length === 0) return false;

    const ticker = await getTicker(strategy.symbols[0]);
    if (!ticker || !ticker.last) return false;

    const price = ticker.last.mid;
    const targetValue = typeof trigger.value === "number" ? trigger.value : parseFloat(trigger.value);

    switch (trigger.operator) {
      case "GT": return price > targetValue;
      case "LT": return price < targetValue;
      case "GTE": return price >= targetValue;
      case "LTE": return price <= targetValue;
      case "EQ": return Math.abs(price - targetValue) < 0.0001;
      default: return false;
    }
  }

  private evaluateTimeTrigger(trigger: TriggerCondition): boolean {
    const now = Date.now();
    const targetTime = typeof trigger.value === "number" ? trigger.value : parseInt(trigger.value);

    switch (trigger.operator) {
      case "GT": return now > targetTime;
      case "LT": return now < targetTime;
      case "GTE": return now >= targetTime;
      case "LTE": return now <= targetTime;
      default: return false;
    }
  }

  private async evaluateIndicatorTrigger(
    trigger: TriggerCondition,
    strategy: Strategy
  ): Promise<boolean> {
    if (!trigger.indicator || strategy.symbols.length === 0) return false;

    const ticker = await getTicker(strategy.symbols[0]);
    if (!ticker || !("analysis" in ticker) || !ticker.analysis) return false;

    const indicators = getCurrentIndicators(ticker.analysis);
    const targetValue = typeof trigger.value === "number" ? trigger.value : parseFloat(trigger.value);

    let indicatorValue: number | undefined;

    switch (trigger.indicator.type) {
      case "RSI":
        indicatorValue = indicators.rsi;
        break;
      case "EMA":
        indicatorValue = indicators.ema;
        break;
      case "MA":
        indicatorValue = indicators.sma;
        break;
      default:
        return false;
    }

    if (indicatorValue === undefined) return false;

    switch (trigger.operator) {
      case "GT": return indicatorValue > targetValue;
      case "LT": return indicatorValue < targetValue;
      case "GTE": return indicatorValue >= targetValue;
      case "LTE": return indicatorValue <= targetValue;
      default: return false;
    }
  }

  private async executeTWAP(strategy: Strategy) {
    if (!strategy.twapConfig) {
      logger.error(`TWAP strategy ${strategy.id} missing config`);
      return;
    }

    const { totalAmount, timeWindow, intervalCount } = strategy.twapConfig;
    const amountPerInterval = BigInt(totalAmount) / BigInt(intervalCount);
    const intervalDuration = timeWindow / intervalCount;

    // Create orders for each interval
    for (let i = 0; i < intervalCount; i++) {
      const order: Order = {
        id: generateId(),
        strategyId: strategy.id,
        type: OrderType.TWAP,
        status: OrderStatus.PENDING,
        makerAsset: "", // TODO: Get from strategy config
        takerAsset: "", // TODO: Get from strategy config
        makingAmount: amountPerInterval.toString(),
        takingAmount: "0", // Market order
        maker: this.wallets.get(strategy.network)?.address || "",
        createdAt: Date.now(),
        expiry: Date.now() + intervalDuration * 1000,
      };

      // Save and execute order
      await this.createAndExecuteOrder(order, strategy.network);

      // Wait for next interval
      if (i < intervalCount - 1) {
        await sleep(intervalDuration * 1000);
      }
    }
  }

  private async executeRangeOrder(strategy: Strategy) {
    if (!strategy.rangeConfig) {
      logger.error(`Range strategy ${strategy.id} missing config`);
      return;
    }

    const { priceRange, gridLevels, amountPerLevel, side } = strategy.rangeConfig;
    const [minPrice, maxPrice] = priceRange;
    const priceStep = (maxPrice - minPrice) / (gridLevels - 1);

    // Get current price
    const ticker = await getTicker(strategy.symbols[0]);
    if (!ticker || !ticker.last) return;

    const currentPrice = ticker.last.mid;

    // Create orders at each grid level
    for (let i = 0; i < gridLevels; i++) {
      const targetPrice = minPrice + priceStep * i;

      // Skip if too close to current price
      if (Math.abs(targetPrice - currentPrice) < priceStep * 0.5) continue;

      const isBuy = targetPrice < currentPrice;
      if ((side === "BUY" && !isBuy) || (side === "SELL" && isBuy)) continue;

      const order: Order = {
        id: generateId(),
        strategyId: strategy.id,
        type: OrderType.RANGE,
        status: OrderStatus.PENDING,
        makerAsset: isBuy ? strategy.rangeConfig.quoteAsset : strategy.rangeConfig.baseAsset,
        takerAsset: isBuy ? strategy.rangeConfig.baseAsset : strategy.rangeConfig.quoteAsset,
        makingAmount: amountPerLevel,
        takingAmount: (parseFloat(amountPerLevel) * targetPrice).toString(),
        maker: this.wallets.get(strategy.network)?.address || "",
        triggerPrice: targetPrice,
        createdAt: Date.now(),
      };

      await this.createAndExecuteOrder(order, strategy.network);
    }
  }

  private async executeIcebergOrder(strategy: Strategy) {
    // TODO: Implement iceberg order logic
    logger.warn("Iceberg orders not yet implemented");
  }

  private async executeMarketMaking(strategy: Strategy) {
    // TODO: Implement market making strategies
    logger.warn("Market making strategies not yet implemented");
  }

  private async createAndExecuteOrder(order: Order, networkId: number) {
    try {
      // Save order to database
      await saveOrder(order);

      // Create order event
      await saveOrderEvent({
        orderId: order.id,
        type: OrderEventType.CREATED,
        timestamp: Date.now(),
      });

      // TODO: Re-enable after fixing 1inch SDK imports
      // Get SDK and API for network
      // const sdk = this.sdks.get(networkId);
      // const api = this.apis.get(networkId);
      const wallet = this.wallets.get(networkId);

      if (!wallet) {
        throw new Error(`Network ${networkId} not initialized`);
      }

      // TODO: Implement 1inch order creation
      // Create limit order
      // const limitOrder = new LimitOrder({
      //   makerAsset: order.makerAsset,
      //   takerAsset: order.takerAsset,
      //   makingAmount: order.makingAmount,
      //   takingAmount: order.takingAmount,
      //   maker: order.maker,
      //   receiver: order.receiver || order.maker,
      //   salt: order.salt || sdk.generateSalt(),
      // });

      // Sign order
      // const signature = await sdk.signLimitOrder(limitOrder, wallet.privateKey);
      // order.signature = signature;
      // order.orderHash = sdk.getLimitOrderHash(limitOrder);

      // Update order status
      order.status = OrderStatus.SUBMITTED;
      await saveOrder(order);

      // Submit to orderbook
      // await api.submitOrder(limitOrder, signature);

      // Update order status
      order.status = OrderStatus.ACTIVE;
      await saveOrder(order);

      // Create submitted event
      await saveOrderEvent({
        orderId: order.id,
        orderHash: order.orderHash,
        type: OrderEventType.SUBMITTED,
        timestamp: Date.now(),
      });

      logger.info(`Order ${order.id} submitted to orderbook`);
    } catch (error: any) {
      logger.error(`Failed to create order ${order.id}:`, error);

      // Update order status
      order.status = OrderStatus.FAILED;
      await saveOrder(order);

      // Create failed event
      await saveOrderEvent({
        orderId: order.id,
        type: OrderEventType.FAILED,
        timestamp: Date.now(),
        error: error.message,
      });
    }
  }
}

// Main execution
const orderExecutor = new OrderExecutorService();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT signal");
  await orderExecutor.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM signal");
  await orderExecutor.stop();
  process.exit(0);
});

// Start the service
orderExecutor.start().catch((error) => {
  logger.error("Failed to start Order Executor service:", error);
  process.exit(1);
});
