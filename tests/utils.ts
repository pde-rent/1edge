#!/usr/bin/env bun
import { beforeAll, afterAll, mock } from "bun:test";
import { ethers } from "ethers";
import { generateOrderId } from "@common/utils";
import { OrderType, OrderStatus } from "@common/types";
import type {
  Order,
  DCAParams,
  ChaseLimitParams,
  IcebergParams,
  MomentumReversalParams,
  StopLimitParams,
} from "@common/types";
import { getConfig } from "@back/services/config";
import { initStorage } from "@back/services/storage";
import { createOrderRegistry } from "@back/services/orderRegistry";

// Common test constants
export const TEST_PRICES = {
  ETH: 4000,
  INITIAL: 3800,
  MOVEMENT: 200,
  HIGH: 4200,
  LOW: 3600,
} as const;

export const TEST_TIMEOUTS = {
  SHORT: 2000,
  MEDIUM: 5000,
  LONG: 8000,
  EXTENDED: 20000,
  MAX: 30000,
} as const;

// Test context type
export interface TestContext {
  testWallet: ethers.HDNodeWallet;
  orderRegistry: any;
}

// Price cache mock configuration
export interface PriceCacheConfig {
  price?: number;
  analysis?: {
    rsi?: number[];
    sma?: number[];
    ema?: number[];
    bb?: { upper: number[]; middle: number[]; lower: number[] };
    macd?: { macd: number[]; signal: number[]; histogram: number[] };
  };
}

// Dynamic price mock for tests that need price changes
export class DynamicPriceMock {
  private currentPrice: number;
  private priceHistory: number[] = [];

  constructor(initialPrice: number = TEST_PRICES.ETH) {
    this.currentPrice = initialPrice;
    this.priceHistory.push(initialPrice);
  }

  setPrice(price: number): void {
    this.currentPrice = price;
    this.priceHistory.push(price);
  }

  getPrice(): number {
    return this.currentPrice;
  }

  getHistory(): number[] {
    return [...this.priceHistory];
  }

  // Simulate price movement
  moveBy(amount: number): number {
    this.setPrice(this.currentPrice + amount);
    return this.currentPrice;
  }

  moveByPercent(percent: number): number {
    const change = this.currentPrice * (percent / 100);
    return this.moveBy(change);
  }
}

// Price series generators for technical analysis
export class PriceSeriesGenerator {
  // Generate RSI series for oversold/overbought conditions
  static rsi(options: {
    periods: number;
    currentRSI: number;
    condition: "oversold" | "overbought" | "neutral";
    trend?: "up" | "down" | "sideways";
  }): number[] {
    const { periods, currentRSI, condition, trend = "sideways" } = options;
    const series: number[] = [];

    // Generate base RSI values based on condition
    let baseRSI: number;
    switch (condition) {
      case "oversold":
        baseRSI = 25;
        break;
      case "overbought":
        baseRSI = 75;
        break;
      default:
        baseRSI = 50;
    }

    // Generate historical RSI values
    for (let i = 0; i < periods - 1; i++) {
      const variation = (Math.random() - 0.5) * 10; // �5 RSI points
      let rsi = baseRSI + variation;

      // Apply trend
      if (trend === "up") {
        rsi += (i / periods) * 10;
      } else if (trend === "down") {
        rsi -= (i / periods) * 10;
      }

      series.push(Math.max(0, Math.min(100, rsi)));
    }

    // Add current RSI
    series.push(currentRSI);

    return series;
  }

  // Generate price series with specific patterns
  static price(options: {
    length: number;
    startPrice: number;
    endPrice?: number;
    volatility?: number;
    trend?: "up" | "down" | "sideways";
  }): number[] {
    const {
      length,
      startPrice,
      endPrice = startPrice,
      volatility = 0.02,
      trend = "sideways",
    } = options;
    const series: number[] = [];

    for (let i = 0; i < length; i++) {
      const progress = i / (length - 1);
      let price: number;

      if (trend === "sideways") {
        price = startPrice + (Math.random() - 0.5) * startPrice * volatility;
      } else {
        const basePrice = startPrice + (endPrice - startPrice) * progress;
        const randomVariation = (Math.random() - 0.5) * basePrice * volatility;
        price = basePrice + randomVariation;
      }

      series.push(Math.max(price * 0.1, price)); // Prevent negative prices
    }

    return series;
  }

  // Generate moving average series
  static ma(prices: number[], period: number): number[] {
    const ma: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        ma.push(prices[i]); // Not enough data for MA
      } else {
        const sum = prices
          .slice(i - period + 1, i + 1)
          .reduce((a, b) => a + b, 0);
        ma.push(sum / period);
      }
    }

    return ma;
  }
}

// Mock price cache with configurable data
export function mockPriceCache(
  config: PriceCacheConfig | DynamicPriceMock,
): void {
  if (config instanceof DynamicPriceMock) {
    mock.module("@back/services/priceCache", () => ({
      priceCache: {
        getPrice: () => ({
          last: { mid: config.getPrice() },
        }),
      },
    }));
  } else {
    mock.module("@back/services/priceCache", () => ({
      priceCache: {
        getPrice: () => ({
          last: { mid: config.price || TEST_PRICES.ETH },
          analysis: config.analysis || {},
        }),
      },
    }));
  }
}

// Test suite setup utilities
export function createTestSuite(): {
  setup: () => Promise<TestContext>;
  teardown: (context: TestContext) => Promise<void>;
} {
  return {
    setup: async (): Promise<TestContext> => {
      initStorage(getConfig().storage);
      const testWallet = ethers.Wallet.createRandom();
      const orderRegistry = createOrderRegistry(true);
      await orderRegistry.start();

      return { testWallet, orderRegistry };
    },

    teardown: async (context: TestContext): Promise<void> => {
      await context.orderRegistry.stop();
    },
  };
}

// Order factory utilities
export class OrderFactory {
  private static base(
    wallet: ethers.HDNodeWallet,
    type: OrderType,
    amount: string,
    price: number = TEST_PRICES.ETH,
  ): Partial<Order> {
    const config = getConfig();
    const orderId = generateOrderId(wallet.address);
    const now = Date.now();

    const makingAmountWei = ethers.parseEther(amount).toString();
    const takingAmountUsdt = ethers
      .parseUnits((parseFloat(amount) * price).toString(), 6)
      .toString();

    return {
      id: orderId,
      type,
      size: amount,
      maker: wallet.address,
      makerAsset: config.tokenMapping.WETH["1"],
      takerAsset: config.tokenMapping.USDT["1"],
      makingAmount: makingAmountWei,
      takingAmount: takingAmountUsdt,
      createdAt: now,
      remainingSize: amount,
      triggerCount: 0,
      userSignedPayload: "test",
      status: OrderStatus.PENDING,
      oneInchOrderHashes: [],
      salt: Math.floor(Math.random() * 1000000000).toString(),
    };
  }

  static async dca(
    wallet: ethers.HDNodeWallet,
    params: DCAParams,
    price: number = TEST_PRICES.ETH,
  ): Promise<Order> {
    const baseOrder = this.base(wallet, OrderType.DCA, params.amount, price);

    const order: Order = {
      ...baseOrder,
      params,
      nextTriggerValue: params.startDate,
      signature: await wallet.signMessage(
        JSON.stringify({
          type: OrderType.DCA,
          size: params.amount,
          params,
          maker: wallet.address,
          makerAsset: getConfig().tokenMapping.WETH["1"],
          takerAsset: getConfig().tokenMapping.USDT["1"],
        }),
      ),
    } as Order;

    return order;
  }

  static async chase(
    wallet: ethers.HDNodeWallet,
    params: ChaseLimitParams,
    price: number = TEST_PRICES.ETH,
  ): Promise<Order> {
    const baseOrder = this.base(
      wallet,
      OrderType.CHASE_LIMIT,
      params.amount,
      price,
    );

    const order: Order = {
      ...baseOrder,
      params,
      triggerPrice: price,
      signature: await wallet.signMessage(
        JSON.stringify({
          type: OrderType.CHASE_LIMIT,
          size: params.amount,
          params,
          maker: wallet.address,
          makerAsset: getConfig().tokenMapping.WETH["1"],
          takerAsset: getConfig().tokenMapping.USDT["1"],
        }),
      ),
    } as Order;

    return order;
  }

  static async iceberg(
    wallet: ethers.HDNodeWallet,
    params: IcebergParams,
    price: number = TEST_PRICES.ETH,
  ): Promise<Order> {
    const baseOrder = this.base(
      wallet,
      OrderType.ICEBERG,
      params.amount,
      price,
    );

    const order: Order = {
      ...baseOrder,
      params,
      signature: await wallet.signMessage(
        JSON.stringify({
          type: OrderType.ICEBERG,
          size: params.amount,
          params,
          maker: wallet.address,
          makerAsset: getConfig().tokenMapping.WETH["1"],
          takerAsset: getConfig().tokenMapping.USDT["1"],
        }),
      ),
    } as Order;

    return order;
  }

  static async momentum(
    wallet: ethers.HDNodeWallet,
    params: MomentumReversalParams,
    price: number = TEST_PRICES.ETH,
  ): Promise<Order> {
    const baseOrder = this.base(
      wallet,
      OrderType.MOMENTUM_REVERSAL,
      params.amount,
      price,
    );

    const order: Order = {
      ...baseOrder,
      params,
      signature: await wallet.signMessage(
        JSON.stringify({
          type: OrderType.MOMENTUM_REVERSAL,
          size: params.amount,
          params,
          maker: wallet.address,
          makerAsset: getConfig().tokenMapping.WETH["1"],
          takerAsset: getConfig().tokenMapping.USDT["1"],
        }),
      ),
    } as Order;

    return order;
  }

  static async stop(
    wallet: ethers.HDNodeWallet,
    params: StopLimitParams,
    price: number = TEST_PRICES.ETH,
  ): Promise<Order> {
    const baseOrder = this.base(
      wallet,
      OrderType.STOP_LIMIT,
      params.amount,
      price,
    );

    const order: Order = {
      ...baseOrder,
      params,
      signature: await wallet.signMessage(
        JSON.stringify({
          type: OrderType.STOP_LIMIT,
          size: params.amount,
          params,
          maker: wallet.address,
          makerAsset: getConfig().tokenMapping.WETH["1"],
          takerAsset: getConfig().tokenMapping.USDT["1"],
        }),
      ),
    } as Order;

    return order;
  }

  static async generic(
    wallet: ethers.HDNodeWallet,
    type: OrderType,
    params: any,
    price: number = TEST_PRICES.ETH,
  ): Promise<Order> {
    const baseOrder = this.base(wallet, type, params.amount, price);

    const order: Order = {
      ...baseOrder,
      params,
      signature: await wallet.signMessage(
        JSON.stringify({
          type,
          size: params.amount,
          params,
          maker: wallet.address,
          makerAsset: getConfig().tokenMapping.WETH["1"],
          takerAsset: getConfig().tokenMapping.USDT["1"],
        }),
      ),
    } as Order;

    return order;
  }
}

// Wait utilities
export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const waitShort = (): Promise<void> => wait(TEST_TIMEOUTS.SHORT);
export const waitMedium = (): Promise<void> => wait(TEST_TIMEOUTS.MEDIUM);
export const waitLong = (): Promise<void> => wait(TEST_TIMEOUTS.LONG);

// Test helpers
export function expectOrderState(
  order: Order | null,
  expectedStates: {
    triggerCount?: number | "greater-than-zero";
    status?: OrderStatus | OrderStatus[];
    type?: OrderType;
  },
): void {
  if (!order) {
    throw new Error("Order is null or undefined");
  }

  if (expectedStates.triggerCount !== undefined) {
    if (expectedStates.triggerCount === "greater-than-zero") {
      expect(order.triggerCount).toBeGreaterThan(0);
    } else {
      expect(order.triggerCount).toBe(expectedStates.triggerCount);
    }
  }

  if (expectedStates.status !== undefined) {
    if (Array.isArray(expectedStates.status)) {
      expect(order.status).toBeOneOf(expectedStates.status);
    } else {
      expect(order.status).toBe(expectedStates.status);
    }
  }

  if (expectedStates.type !== undefined) {
    expect(order.type).toBe(expectedStates.type);
  }
}

// Logging utilities
export function logOrderState(order: Order | null, context: string = ""): void {
  if (!order) {
    console.log(`${context} Order is null`);
    return;
  }

  console.log(
    `${context} Order state - ID: ${order.id.slice(0, 8)}..., Type: ${order.type}, Status: ${order.status}, Triggers: ${order.triggerCount}`,
  );

  if (order.triggerPrice) {
    console.log(`  Trigger Price: ${order.triggerPrice}`);
  }

  if (order.nextTriggerValue) {
    console.log(
      `  Next Trigger: ${new Date(order.nextTriggerValue).toISOString()}`,
    );
  }
}

// Common test scenarios
export class TestScenarios {
  static async createStoreOrder(
    orderRegistry: any,
    order: Order,
    expectedStatus: OrderStatus = OrderStatus.PENDING,
  ): Promise<Order> {
    await orderRegistry.createOrder(order);
    await waitShort();

    const updatedOrder = await import("@back/services/storage").then((m) =>
      m.getOrder(order.id),
    );
    expectOrderState(updatedOrder, {
      status: expectedStatus,
      triggerCount: 0,
      type: order.type,
    });

    return updatedOrder!;
  }

  static async priceTrigger(
    priceMock: DynamicPriceMock,
    orderId: string,
    newPrice: number,
    waitTime: number = TEST_TIMEOUTS.MEDIUM,
  ): Promise<Order> {
    priceMock.setPrice(newPrice);
    await wait(waitTime);

    const updatedOrder = await import("@back/services/storage").then((m) =>
      m.getOrder(orderId),
    );
    return updatedOrder!;
  }

  static async timeTrigger(orderId: string, waitTime: number): Promise<Order> {
    await wait(waitTime);
    const updatedOrder = await import("@back/services/storage").then((m) =>
      m.getOrder(orderId),
    );
    return updatedOrder!;
  }

  static async multiSteps(
    priceMock: DynamicPriceMock | null,
    orderId: string,
    steps: { price?: number; waitTime: number }[],
  ): Promise<Order[]> {
    const results: Order[] = [];

    for (const step of steps) {
      if (priceMock && step.price !== undefined) {
        priceMock.setPrice(step.price);
      }
      await wait(step.waitTime);

      const updatedOrder = await import("@back/services/storage").then((m) =>
        m.getOrder(orderId),
      );
      if (updatedOrder) {
        results.push(updatedOrder);
      }
    }

    return results;
  }

  static async orderExpiry(
    orderRegistry: any,
    order: Order,
    expiryWaitTime: number,
  ): Promise<Order> {
    await orderRegistry.createOrder(order);
    await wait(expiryWaitTime);

    const expiredOrder = await import("@back/services/storage").then((m) =>
      m.getOrder(order.id),
    );
    return expiredOrder!;
  }
}

// Technical analysis test helpers
export class TechnicalAnalysisScenarios {
  static rsi(
    condition: "oversold-reversal" | "overbought-reversal" | "neutral",
    rsiPeriod: number = 14,
    rsimaPeriod: number = 5,
  ): PriceCacheConfig {
    let rsiSeries: number[];

    switch (condition) {
      case "oversold-reversal":
        // Create RSI series that shows oversold reversal
        rsiSeries = PriceSeriesGenerator.rsi({
          periods: rsiPeriod + rsimaPeriod + 5,
          currentRSI: 25, // Below 30 but turning up
          condition: "oversold",
          trend: "up",
        });
        break;

      case "overbought-reversal":
        // Create RSI series that shows overbought reversal
        rsiSeries = PriceSeriesGenerator.rsi({
          periods: rsiPeriod + rsimaPeriod + 5,
          currentRSI: 75, // Above 70 but turning down
          condition: "overbought",
          trend: "down",
        });
        break;

      default:
        // Neutral RSI
        rsiSeries = PriceSeriesGenerator.rsi({
          periods: rsiPeriod + rsimaPeriod + 5,
          currentRSI: 50,
          condition: "neutral",
          trend: "sideways",
        });
    }

    return {
      price: TEST_PRICES.ETH,
      analysis: { rsi: rsiSeries },
    };
  }

  static adx(
    trend: "strong" | "weak",
    adxValue: number = 25,
  ): PriceCacheConfig {
    const adxSeries = Array.from({ length: 20 }, (_, i) => {
      if (trend === "strong") {
        return Math.min(100, adxValue + i * 2); // Trending up
      } else {
        return Math.max(0, adxValue - i * 0.5); // Trending down
      }
    });

    return {
      price: TEST_PRICES.ETH,
      analysis: { adx: adxSeries },
    };
  }

  static breakout(
    adxThreshold: number = 25,
    adxmaPeriod: number = 5,
    breakoutPct: number = 2.0,
    currentPrice: number = TEST_PRICES.ETH,
  ): PriceCacheConfig {
    // Generate ADX series showing strong trend
    const adxSeries = Array.from({ length: 20 }, (_, i) => {
      if (i < 10) {
        return adxThreshold - 5; // Below threshold initially
      }
      return adxThreshold + (i - 10) * 2; // Above threshold and rising
    });

    // Generate EMA series for breakout condition
    const emaPrice = currentPrice / (1 + breakoutPct / 100 + 0.01); // Price that will trigger breakout
    const emaSeries = Array.from({ length: 20 }, () => emaPrice);

    return {
      price: currentPrice,
      analysis: {
        adx: adxSeries,
        ema: emaSeries,
      },
    };
  }

  static grid(
    startPrice: number,
    endPrice: number,
    currentPrice: number,
    stepPct: number = 2.0,
  ): PriceCacheConfig {
    return {
      price: currentPrice,
      analysis: {},
    };
  }
}

// Shared test configurations to eliminate boilerplate
export const TEST_CONFIGS = {
  CHASE_LIMIT: {
    distancePct: 3,
    expiry: 1,
    priceMovement: 200,
    amount: "1.0",
  },
  DCA: {
    amount: "5.0",
    intervalDays: 7,
    totalDays: 21,
    maxPrice: TEST_PRICES.ETH + 200,
  },
  GRID: {
    stepPct: 5.0,
    startPrice: 3900,
    endPrice: 4100,
    amount: "2.0",
  },
  ICEBERG: {
    steps: 3,
    minStepSize: "0.1",
    amount: "1.0",
  },
  MOMENTUM: {
    rsiPeriod: 14,
    rsimaPeriod: 5,
    amount: "1.0",
  },
  RANGE: {
    startPrice: 3980,
    endPrice: 3800,
    stepPct: 2.0,
    amount: "2.0",
  },
  STOP_LIMIT: {
    stopPrice: 4000,
    limitPrice: 4100,
    expiry: 1,
    amount: "1.0",
  },
  TWAP: {
    slices: 4,
    intervalMinutes: 30,
    amount: "2.0",
  },
  BREAKOUT: {
    adxThreshold: 25,
    adxmaPeriod: 5,
    breakoutPct: 2.0,
    amount: "1.0",
  },
} as const;

// Enhanced order test scenarios
export class OrderTestScenarios {
  static async priceBreakout(
    context: TestContext,
    orderId: string,
    config: typeof TEST_CONFIGS.BREAKOUT,
  ): Promise<Order> {
    const breakoutScenario = TechnicalAnalysisScenarios.breakout(
      config.adxThreshold,
      config.adxmaPeriod,
      config.breakoutPct,
    );
    mockPriceCache(breakoutScenario);
    await wait(TEST_TIMEOUTS.MEDIUM);
    return (await import("@back/services/storage").then((m) =>
      m.getOrder(orderId),
    ))!;
  }

  static async gridLevelMovement(
    priceMock: DynamicPriceMock,
    orderId: string,
    levels: number[],
  ): Promise<Order[]> {
    const results: Order[] = [];

    for (const level of levels) {
      priceMock.setPrice(level);
      await wait(TEST_TIMEOUTS.SHORT);
      const order = await import("@back/services/storage").then((m) =>
        m.getOrder(orderId),
      );
      if (order) results.push(order);
    }

    return results;
  }

  static async orderExpiration(
    orderId: string,
    expiryMs: number,
  ): Promise<Order> {
    await wait(expiryMs);
    return (await import("@back/services/storage").then((m) =>
      m.getOrder(orderId),
    ))!;
  }

  static async multiPriceMovements(
    priceMock: DynamicPriceMock,
    orderId: string,
    movements: number[],
  ): Promise<Order[]> {
    const results: Order[] = [];

    for (const price of movements) {
      const order = await TestScenarios.priceTrigger(priceMock, orderId, price);
      results.push(order);
    }

    return results;
  }
}

// Shared assertions to reduce test verbosity
export class TestAssertions {
  static expectTriggered(order: Order, expectedTriggers?: number): void {
    if (expectedTriggers) {
      expect(order.triggerCount).toBe(expectedTriggers);
    } else {
      expect(order.triggerCount).toBeGreaterThan(0);
    }
  }

  static expectNotTriggered(order: Order): void {
    expect(order.triggerCount).toBe(0);
    expect(order.status).toBe(OrderStatus.PENDING);
  }

  static expectCompleted(order: Order): void {
    expect(order.status).toBe(OrderStatus.COMPLETED);
    expect(order.triggerCount).toBeGreaterThan(0);
  }

  static expectActive(order: Order): void {
    expect(order.status).toBe(OrderStatus.ACTIVE);
    expect(order.triggerCount).toBeGreaterThan(0);
  }
}
