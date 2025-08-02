import type { Order, LimitOrderParams, Symbol } from "@common/types";
import { logger } from "@back/utils/logger";
import {
  LimitOrder,
  LimitOrderContract,
  Address,
  Uint256,
} from "@1inch/limit-order-sdk";
import { ethers } from "ethers";
import { getConfig } from "@back/services/config";
import { priceCache } from "@back/services/priceCache";
import { getSymbolFromAssets } from "@back/utils/assetMapping";

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
  symbol: Symbol;
  price: number;
  priceData: any;
}

/**
 * Order execution context
 */
export interface OrderExecutionContext {
  order: Order;
  currentPrice: number;
  symbol: Symbol;
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
   * @param makerAmount The amount of maker asset to use for this trigger
   * @param takerAmount The amount of taker asset to use for this trigger
   */
  trigger(
    order: Order,
    makerAmount: string,
    takerAmount: string,
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

  constructor(mockMode: boolean = false) {
    this.mockMode = mockMode;

    if (!mockMode) {
      const config = getConfig();
      const networkConfig = config.networks[1]; // Default to Ethereum

      this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      this.contractAddress = networkConfig.aggregatorV6;
      this.chainId = networkConfig.chainId;
    }
  }

  abstract shouldTrigger(order: Order): Promise<boolean>;
  abstract updateNextTrigger?(order: Order): void;

  /**
   * Get price data for an order
   */
  protected getPriceInfo(order: Order): PriceInfo | null {
    try {
      const symbol = getSymbolFromAssets(order.makerAsset, order.takerAsset);
      const priceData = priceCache.getPrice(symbol);

      if (!priceData?.last?.mid) {
        logger.warn(`No price data available for ${symbol}`);
        return null;
      }

      return {
        symbol,
        price: priceData.last.mid,
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

    let message = `[${order.type}] Order ${order.id.slice(0, 8)}... triggered at price ${currentPrice}`;

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
   * Trigger order with specified amounts - creates 1inch limit order or logs in mock mode
   */
  async trigger(
    order: Order,
    makerAmount: string,
    takerAmount: string,
  ): Promise<void> {
    if (this.mockMode) {
      logger.info(
        `[MOCK] Would trigger 1inch limit order: ${makerAmount} tokens from ${order.makerAsset} -> ${takerAmount} tokens of ${order.takerAsset}`,
      );
      return;
    }

    try {
      // Create 1inch LimitOrder with the provided amounts
      const limitOrder = new LimitOrder({
        salt: BigInt(order.salt || this.generateSalt()),
        maker: new Address(order.maker),
        receiver: order.receiver
          ? new Address(order.receiver)
          : new Address(order.maker),
        makerAsset: new Address(order.makerAsset),
        takerAsset: new Address(order.takerAsset),
        makingAmount: BigInt(ethers.parseUnits(makerAmount, 18).toString()),
        takingAmount: BigInt(ethers.parseUnits(takerAmount, 6).toString()),
      });

      // Get order hash for tracking
      const orderHash = limitOrder.getOrderHash(this.chainId || 1);

      // In production, this would be signed by the user's wallet and submitted to 1inch
      logger.info(
        `Created 1inch limit order: ${makerAmount} -> ${takerAmount} tokens`,
      );
      logger.debug(`Order hash: ${orderHash}`);

      // Store the order hash for tracking
      if (!order.oneInchOrderHashes) {
        order.oneInchOrderHashes = [];
      }
      order.oneInchOrderHashes.push(orderHash);
    } catch (error) {
      logger.error(`Failed to trigger 1inch limit order: ${error}`);
      throw error;
    }
  }

  private generateSalt(): string {
    return Math.floor(Math.random() * 1000000000).toString();
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
