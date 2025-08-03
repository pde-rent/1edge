import type {
  Order,
  OneInchLimitOrderParams,
  PairSymbol,
} from "@common/types";
import { OrderStatus } from "@common/types";
import { logger } from "@back/utils/logger";
import {
  LimitOrder,
  LimitOrderContract,
  Address,
  MakerTraits,
} from "@1inch/limit-order-sdk";
import { LimitOrderService, createLimitOrderService } from "@back/services/limitOrder";
import { ethers } from "ethers";
import { getConfig } from "@back/services/config";
import { priceCache } from "@back/services/priceCache";
import {
  getSymbolFromAssets,
  addressToSymbol,
  mapSymbolForFeed,
} from "@common/utils";
import { saveOrder } from "@back/services/storage";
import deployments from "../../deployments.json";

// Common constants
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MS_PER_HOUR = 60 * 60 * 1000;
export const MS_PER_MINUTE = 60 * 1000;

// RSI thresholds
export const RSI_OVERSOLD = 30;
export const RSI_OVERBOUGHT = 70;

/**
 * Price information interface
 */
export interface PriceInfo {
  symbol: PairSymbol;
  price: number;
  priceData: any;
}

/**
 * Order execution context
 */
export interface OrderExecutionContext {
  order: Order;
  currentPrice: number;
  symbol: PairSymbol;
  step?: number;
  totalSteps?: number;
  triggerAmount?: string;
  priceData?: any;
}

/**
 * Base interface for all order watchers
 * Each order type implements this interface
 */
export interface OrderWatcher {
  /**
   * Check if trigger conditions are met
   */
  shouldTrigger(order: Order): Promise<boolean>;

  /**
   * Trigger the order when conditions are met (creates 1inch limit order)
   * @param order The order to trigger
   * @param makingAmount The amount of maker asset to use for this trigger
   * @param takingAmount The amount of taker asset to use for this trigger
   */
  trigger(
    order: Order,
    makingAmount: string,
    takingAmount: string,
  ): Promise<void>;

  /**
   * Update order state after trigger (for recurring orders)
   */
  updateNextTrigger?(order: Order): void;
}

/**
 * Base order watcher class with 1inch integration and common utilities
 */
export abstract class BaseOrderWatcher implements OrderWatcher {
  protected mockMode: boolean;
  protected provider?: ethers.Provider;
  protected contractAddress?: string;
  protected chainId?: number;
  protected delegateProxy?: ethers.Contract;
  protected keeper?: ethers.Wallet;
  protected limitOrderService?: LimitOrderService;

  constructor(mockMode: boolean = false) {
    this.mockMode = mockMode;

    if (!mockMode) {
      const config = getConfig();
      const networkConfig = config.networks[56]; // BSC for now, make configurable later

      this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      this.contractAddress = networkConfig.aggregatorV6;
      this.chainId = networkConfig.chainId;

      // Setup keeper wallet
      if (process.env.KEEPER_PK) {
        this.keeper = new ethers.Wallet(process.env.KEEPER_PK, this.provider);
      }

      // Setup DelegateProxy contract
      const proxyAddress =
        deployments.deployments[this.chainId.toString() as keyof typeof deployments.deployments]?.proxy;
      if (proxyAddress && this.keeper) {
        this.delegateProxy = new ethers.Contract(
          proxyAddress,
          deployments.abi,
          this.keeper,
        );
      }

      // Setup limit order service
      if (process.env.ONE_INCH_API_KEY) {
        this.limitOrderService = createLimitOrderService(
          process.env.ONE_INCH_API_KEY,
          this.chainId,
          this.keeper,
          this.provider,
        );
      }
    }
  }

  abstract shouldTrigger(order: Order): Promise<boolean>;
  abstract updateNextTrigger?(order: Order): void;

  /**
   * Get price data for an order
   */
  protected getPriceInfo(order: Order): PriceInfo | null {
    try {
      const chainId = order.params?.chainId || 1; // Default to Ethereum if not specified
      const makerAsset = order.params?.makerAsset;
      const takerAsset = order.params?.takerAsset;

      if (!makerAsset || !takerAsset) {
        logger.warn("Order missing makerAsset or takerAsset in params");
        return null;
      }

      // Get token mapping from config
      const config = getConfig();
      const tokenMapping = config.tokenMapping;

      // Convert asset addresses to symbols
      const makerSymbol = addressToSymbol(makerAsset, tokenMapping, chainId);
      const takerSymbol = addressToSymbol(takerAsset, tokenMapping, chainId);

      // Map symbols for price feeds (WETH -> ETH, WBTC -> BTC)
      const mappedMakerSymbol = mapSymbolForFeed(makerSymbol);
      const mappedTakerSymbol = mapSymbolForFeed(takerSymbol);

      // Create price feed symbol
      const symbol =
        `agg:spot:${mappedMakerSymbol}${mappedTakerSymbol}` as PairSymbol;
      const priceData = priceCache.getPrice(symbol);

      if (!priceData?.mid) {
        logger.warn(`No price data available for ${symbol}`);
        return null;
      }

      return {
        symbol,
        price: priceData.mid,
        priceData,
      };
    } catch (error) {
      logger.error(`Failed to get price info: ${error}`);
      return null;
    }
  }

  /**
   * Check if order has expired
   */
  protected isExpired(order: Order, expiryDays?: number): boolean {
    // Check explicit expiry from order params (in days from frontend)
    if (order.params?.expiry && order.params.expiry > 0) {
      const now = Date.now();
      const expiryTime = order.createdAt + (order.params.expiry * 24 * 60 * 60 * 1000);
      return now >= expiryTime;
    }

    // Fallback to days-based expiry for backwards compatibility
    if (!expiryDays) return false;

    const now = Date.now();
    const expiryTime = order.createdAt + expiryDays * MS_PER_DAY;
    return now >= expiryTime;
  }

  /**
   * Check if current price exceeds max price constraint
   */
  protected exceedsMaxPrice(order: Order, maxPrice?: number): boolean {
    if (!maxPrice) return false;

    const priceInfo = this.getPriceInfo(order);
    return priceInfo ? priceInfo.price > maxPrice : false;
  }

  /**
   * Calculate step amount for stepped orders
   */
  protected calculateStepAmount(
    totalAmount: string,
    steps: number,
    currentStep: number,
  ): string {
    const total = parseFloat(totalAmount);
    const amountPerStep = total / steps;
    const remaining = total - amountPerStep * currentStep;

    // Return the minimum of amount per step or remaining
    return Math.min(amountPerStep, remaining).toFixed(8);
  }

  /**
   * Calculate percentage of a value
   */
  protected calculatePercentage(value: number, percentage: number): number {
    return value * (percentage / 100);
  }

  /**
   * Log order execution
   */
  protected logExecution(context: OrderExecutionContext): void {
    const { order, currentPrice, step, totalSteps, triggerAmount } = context;

    let message = `[${order.params?.type || "UNKNOWN"}] Order ${order.id.slice(0, 8)}... triggered at price ${currentPrice}`;

    if (step !== undefined && totalSteps !== undefined) {
      message += ` (Step ${step}/${totalSteps})`;
    }

    if (triggerAmount) {
      message += ` - Amount: ${triggerAmount}`;
    }

    logger.info(message);
  }

  /**
   * Validate order parameters exist
   */
  protected validateParams<T>(order: Order): T | null {
    if (!order.params) {
      logger.error(`No parameters found for order ${order.id}`);
      return null;
    }
    return order.params as T;
  }

  /**
   * Get time until next interval
   */
  protected getTimeUntilNext(lastTrigger: number, intervalMs: number): number {
    const now = Date.now();
    const timeSinceLastTrigger = now - lastTrigger;
    return Math.max(0, intervalMs - timeSinceLastTrigger);
  }

  /**
   * Check if technical indicator condition is met
   */
  protected checkTechnicalCondition(
    priceData: any,
    indicator: string,
    condition: (value: number) => boolean,
  ): boolean {
    const analysis = priceData?.analysis?.[indicator];
    if (!analysis || !Array.isArray(analysis) || analysis.length === 0) {
      return false;
    }

    const currentValue = analysis[analysis.length - 1];
    return condition(currentValue);
  }

  /**
   * Calculate moving average of an array
   */
  protected calculateMA(values: number[], period: number): number {
    if (values.length < period) return 0;
    const slice = values.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
  }

  /**
   * Check if current value is above its moving average
   */
  protected isAboveMA(values: number[], maPeriod: number): boolean {
    if (values.length < maPeriod) return false;
    const current = values[values.length - 1];
    const ma = this.calculateMA(values, maPeriod);
    return current > ma;
  }

  /**
   * Calculate optimal limit price for fast fills
   * For sells: spot + 0.05% or halfway to best ask
   * For buys: spot - 0.05% or halfway to best bid
   */
  protected calculateLimitPrice(
    spotPrice: number,
    bid: number,
    ask: number,
    isSell: boolean = true,
  ): number {
    const spread = ask - bid;
    const spotAdjustment = spotPrice * 0.00025; // 0.025%

    if (isSell) {
      // For selling: price between spot and ask, but not too aggressive
      const targetPrice = Math.min(
        spotPrice + spotAdjustment,
        ask - spread / 4, // Stay within spread
      );
      return targetPrice;
    } else {
      // For buying: price between spot and bid, but not too aggressive
      const targetPrice = Math.max(
        spotPrice - spotAdjustment,
        bid + spread / 4, // Stay within spread
      );
      return targetPrice;
    }
  }

  /**
   * Determine if this is a sell order based on maker/taker assets
   */
  protected isSellOrder(order: Order): boolean {
    const config = getConfig();
    const wethAddresses = Object.values(config.tokenMapping.WETH || {});
    const usdtAddresses = Object.values(config.tokenMapping.USDT || {});

    const makerAsset = order.params?.makerAsset?.toLowerCase();
    const takerAsset = order.params?.takerAsset?.toLowerCase();

    if (!makerAsset || !takerAsset) {
      return false; // Default to false if assets not defined
    }

    // If maker asset is WETH-like and taker is USDT-like, it's a sell
    return (
      wethAddresses.includes(makerAsset) && usdtAddresses.includes(takerAsset)
    );
  }

  /**
   * Trigger order with specified amounts - creates and submits 1inch limit order using LimitOrderService
   */
  async trigger(
    order: Order,
    makingAmount: string,
    takingAmount: string,
  ): Promise<void> {
    if (this.mockMode) {
      logger.info(
        `[MOCK] Would trigger 1inch limit order: ${makingAmount} tokens from ${order.params?.makerAsset} -> ${takingAmount} tokens of ${order.params?.takerAsset}`,
      );
      return;
    }

    if (!this.limitOrderService || !this.delegateProxy) {
      throw new Error("LimitOrderService or DelegateProxy not configured");
    }

    try {
      // Get current price data for dynamic pricing
      const priceInfo = this.getPriceInfo(order);
      if (!priceInfo) {
        throw new Error(`No price data available for order ${order.id}`);
      }

      const isSell = this.isSellOrder(order);
      const limitPrice = this.calculateLimitPrice(
        priceInfo.priceData.mid,
        priceInfo.priceData.bid,
        priceInfo.priceData.ask,
        isSell,
      );

      logger.info(
        `[${order.params?.type || "UNKNOWN"}] Triggering order ${order.id.slice(0, 8)}... at optimized limit price $${limitPrice.toFixed(6)} (spot: $${priceInfo.price.toFixed(6)}, ${isSell ? "sell" : "buy"})`,
      );

      // Calculate dynamic taking amount based on limit price
      const makingAmountFloat = parseFloat(makingAmount);
      let dynamicTakingAmount: string;
      
      if (isSell) {
        // Selling WETH for USDT: takingAmount = makingAmount * limitPrice
        const usdtAmount = makingAmountFloat * limitPrice;
        dynamicTakingAmount = usdtAmount.toFixed(6);
      } else {
        // Buying WETH with USDT
        const usdtAmount = makingAmountFloat * limitPrice;
        dynamicTakingAmount = usdtAmount.toFixed(6);
      }
      
      logger.debug(`Calculated takingAmount: ${dynamicTakingAmount} USDT for ${makingAmount} WETH at $${limitPrice}`);

      // Parse amounts with proper decimals
      const makingAmountWei = ethers.parseUnits(parseFloat(makingAmount).toFixed(18), 18); // WETH has 18 decimals
      const takingAmountWei = ethers.parseUnits(parseFloat(dynamicTakingAmount).toFixed(6), 6); // USDT has 6 decimals

      // Create order parameters for LimitOrderService
      const orderParams: OneInchLimitOrderParams = {
        makerAsset: order.params!.makerAsset,
        takerAsset: order.params!.takerAsset,
        makingAmount: makingAmountWei,
        takingAmount: takingAmountWei,
        maker: this.delegateProxy.target.toString(), // DelegateProxy as maker
        receiver: order.params!.maker, // User receives the assets
        salt: BigInt(order.params?.salt || this.generateSalt()),
        expirationMs: order.params?.expiry && order.params.expiry > 0 ? Date.now() + (order.params.expiry * 24 * 60 * 60 * 1000) : undefined,
        partialFillsEnabled: true, // Enable partial fills by default
      };

      // Update order tracking before submission
      const oldTriggerCount = order.triggerCount || 0;
      order.triggerCount = oldTriggerCount + 1;
      order.status = order.status === OrderStatus.PENDING ? OrderStatus.ACTIVE : order.status;
      
      logger.debug(`Updating order: triggerCount ${oldTriggerCount} -> ${order.triggerCount}, status: ${order.status}`);

      // Use LimitOrderService to create and submit the order
      const result = await this.limitOrderService.createAndSubmitOrder(
        orderParams,
        order.params!.maker,
        this.keeper,
      );

      // Store the order hash and details for tracking
      if (!order.oneInchOrderHashes) {
        order.oneInchOrderHashes = [];
      }
      order.oneInchOrderHashes.push(result.orderHash);
      
      // Store 1inch order details for monitoring
      if (!order.oneInchOrders) {
        order.oneInchOrders = [];
      }
      order.oneInchOrders.push({
        hash: result.orderHash,
        makingAmount: makingAmount,
        takingAmount: dynamicTakingAmount,
        limitPrice: limitPrice.toString(),
        createdAt: Date.now()
      });
      
      await saveOrder(order);

      logger.info(
        `🎯 Order ${order.id.slice(0, 8)}... triggered successfully - Hash: ${result.orderHash.slice(0, 10)}..., Amount: ${makingAmount}, Limit: $${limitPrice.toFixed(6)}`,
      );

      // Enhanced logging for debugging
      logger.info(`📋 1inch Order Details:
        - Full Hash: ${result.orderHash}
        - Order ID: ${order.id}
        - Type: ${order.params?.type}
        - Maker Asset: ${order.params?.makerAsset}
        - Taker Asset: ${order.params?.takerAsset}
        - Making Amount (decimal): ${makingAmount}
        - Taking Amount (USDT): ${dynamicTakingAmount}
        - Limit Price: $${limitPrice.toFixed(6)}
        - Spot Price: $${priceInfo.price.toFixed(6)}
        - Is Sell: ${isSell}
        - API Success: ${result.success}
        - Expiry: ${order.params?.expiry ? `${order.params.expiry} days (${new Date(order.createdAt + order.params.expiry * 24 * 60 * 60 * 1000).toISOString()})` : 'none'}
        - Chain ID: ${this.chainId || 1}`);

      if (!result.success) {
        logger.warn(`⚠️ Order created on DelegateProxy but API submission failed: ${result.error}`);
      }

    } catch (error) {
      logger.error(`❌ Failed to trigger order ${order.id}: ${error}`);
      throw error;
    }
  }

  private generateSalt(): string {
    return Math.floor(Math.random() * 1000000000).toString();
  }

  /**
   * Monitor and update order status from 1inch
   */
  async updateOrderFromOnChain(order: Order): Promise<void> {
    if (
      this.mockMode ||
      !this.delegateProxy ||
      !order.oneInchOrderHashes?.length
    ) {
      logger.debug(`Skipping updateOrderFromOnChain: mockMode=${this.mockMode}, delegateProxy=${!!this.delegateProxy}, orderHashes=${order.oneInchOrderHashes?.length || 0}`);
      return;
    }

    try {
      logger.debug(`🔍 Updating order ${order.id.slice(0, 8)}... from on-chain:
        - Order Hashes: ${order.oneInchOrderHashes.map(h => h.slice(0, 10) + '...').join(', ')}
        - Remaining Amount: ${order.remainingMakerAmount}
        - Status: ${order.status}`);
        
      // Check if order has expired
      if (this.isExpired(order)) {
        logger.info(
          `⏰ Order ${order.id.slice(0, 8)}... has expired, cancelling`,
        );
        await this.cancelExpiredOrder(order);
        return;
      }

      // Check status of all 1inch orders for this order
      const orderData = await this.delegateProxy.getOrderData(
        order.oneInchOrderHashes,
      );

      let totalFilled = 0n;
      let hasPartialFills = false;

      for (let i = 0; i < orderData.length; i++) {
        const data = orderData[i];
        // Convert decimal amount to wei using parseUnits with 18 decimals
        const remainingAmountStr = order.remainingMakerAmount.toFixed(18);
        logger.debug(`Converting decimal ${order.remainingMakerAmount} to fixed(18): ${remainingAmountStr}`);
        const originalAmount = ethers.parseUnits(remainingAmountStr, 18);
        const filled = originalAmount - data.remainingAmount;

        if (filled > 0n) {
          totalFilled += filled;
          hasPartialFills = true;

          logger.debug(
            `Order ${order.oneInchOrderHashes[i].slice(0, 10)}... filled: ${ethers.formatUnits(filled, 18)} (${((Number(filled) / Number(originalAmount)) * 100).toFixed(2)}%)`,
          );
        }
      }

      // Update order status based on fills
      const originalMakingAmount = order.params?.makingAmount || 0;
      const originalTotal = ethers.parseUnits(originalMakingAmount.toFixed(18), 18);
      const fillPercentage = originalMakingAmount > 0 ? (Number(totalFilled) / Number(originalTotal)) * 100 : 0;

      // Check if the total 1edge order makingAmount is completely filled
      const totalOrderFilled = totalFilled >= originalTotal;
      
      if (totalOrderFilled && totalFilled > 0n) {
        order.status = OrderStatus.FILLED;
        order.remainingMakerAmount = 0;
        logger.info(`🎉 Order ${order.id.slice(0, 8)}... completely filled! Total makingAmount (${originalMakingAmount}) reached.`);
      } else if (hasPartialFills) {
        // Any fill from underlying 1inch orders = PARTIALLY_FILLED for the 1edge order
        order.status = OrderStatus.PARTIALLY_FILLED;
        const remaining = originalTotal - totalFilled;
        order.remainingMakerAmount = parseFloat(ethers.formatUnits(remaining, 18));
        logger.info(
          `📈 Order ${order.id.slice(0, 8)}... ${fillPercentage.toFixed(2)}% filled (${ethers.formatUnits(totalFilled, 18)} of ${originalMakingAmount} WETH)`,
        );
      }

      // Save updated order
      await saveOrder(order);
    } catch (error) {
      logger.error(
        `Failed to update order ${order.id} from on-chain: ${error}`,
      );
    }
  }

  /**
   * Cancel expired order and underlying 1inch orders
   */
  private async cancelExpiredOrder(order: Order): Promise<void> {
    try {
      // Update order status to expired
      order.status = OrderStatus.EXPIRED;
      order.cancelledAt = Date.now();
      await saveOrder(order);

      // Cancel underlying 1inch orders if we have the capability
      if (this.delegateProxy && order.oneInchOrderHashes?.length) {
        for (const orderHash of order.oneInchOrderHashes) {
          try {
            // Note: Actual cancellation would require the appropriate method on DelegateProxy
            // This is a placeholder - implement based on your contract interface
            logger.debug(
              `Would cancel 1inch order ${orderHash.slice(0, 10)}...`,
            );
          } catch (cancelError) {
            logger.warn(
              `Failed to cancel 1inch order ${orderHash.slice(0, 10)}...: ${cancelError}`,
            );
          }
        }
      }

      logger.info(`🚫 Order ${order.id.slice(0, 8)}... expired and cancelled`);
    } catch (error) {
      logger.error(`Failed to cancel expired order ${order.id}: ${error}`);
    }
  }
}

/**
 * Abstract base for time-based order watchers (DCA, TWAP)
 */
export abstract class TimeBasedOrderWatcher extends BaseOrderWatcher {
  protected checkTimeInterval(
    lastTriggerTime: number,
    intervalMs: number,
  ): boolean {
    const now = Date.now();
    return now >= lastTriggerTime + intervalMs;
  }

  protected getNextTriggerTime(
    lastTriggerTime: number,
    intervalMs: number,
  ): number {
    return lastTriggerTime + intervalMs;
  }
}

/**
 * Abstract base for price-based order watchers (Stop, Chase, Breakout)
 */
export abstract class PriceBasedOrderWatcher extends BaseOrderWatcher {
  protected checkPriceThreshold(
    currentPrice: number,
    threshold: number,
    direction: "above" | "below",
  ): boolean {
    return direction === "above"
      ? currentPrice >= threshold
      : currentPrice <= threshold;
  }

  protected calculatePriceWithSlippage(
    price: number,
    slippagePct: number = 0.5,
  ): number {
    return price * (1 + slippagePct / 100);
  }
}

/**
 * Abstract base for stepped order watchers (Iceberg, Range, Grid)
 */
export abstract class SteppedOrderWatcher extends BaseOrderWatcher {
  protected getCurrentStep(order: Order): number {
    return order.triggerCount || 0;
  }

  protected isLastStep(currentStep: number, totalSteps: number): boolean {
    return currentStep >= totalSteps - 1;
  }

  protected calculateStepProgress(
    currentStep: number,
    totalSteps: number,
  ): number {
    return currentStep / totalSteps;
  }

  protected calculateStepAmount(
    totalAmount: string,
    steps: number,
    currentStep: number,
  ): string {
    const remaining = parseFloat(totalAmount);
    const remainingSteps = steps - currentStep;
    if (remainingSteps <= 0) return "0";

    return (remaining / remainingSteps).toString();
  }

  /**
   * Get trigger amount for current step
   */
  protected getTriggerAmount(
    order: Order,
    totalAmount: string,
    totalSteps: number,
  ): string {
    const currentStep = this.getCurrentStep(order);
    return this.calculateStepAmount(totalAmount, totalSteps, currentStep);
  }

  /**
   * Check if step sequence is complete
   */
  protected isStepSequenceComplete(order: Order, totalSteps: number): boolean {
    return this.getCurrentStep(order) >= totalSteps;
  }

  /**
   * Calculate step progress percentage
   */
  protected getStepProgress(order: Order, totalSteps: number): number {
    const currentStep = this.getCurrentStep(order);
    return totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  }
}

/**
 * Registry of order watchers by type
 */
export const orderHandlers = new Map<string, OrderWatcher>();

/**
 * Register an order watcher
 */
export function registerOrderWatcher(
  type: string,
  watcher: OrderWatcher,
): void {
  orderHandlers.set(type, watcher);
  logger.debug(`Registered watcher for order type: ${type}`);
}

/**
 * Get handler for order type
 */
export function getOrderWatcher(type: string): OrderWatcher | undefined {
  return orderHandlers.get(type);
}

