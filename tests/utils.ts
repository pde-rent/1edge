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
} from "../common/types";
import { getConfig } from "../back/services/config";
import { initStorage } from "../back/services/storage";
import { createOrderRegistry } from "../back/services/orderRegistry";

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
      nextTriggerValue: price,
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

  if (order.nextTriggerValue) {
    console.log(`  Trigger Price: ${order.nextTriggerValue}`);
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

    const updatedOrder = await import("../back/services/storage").then((m) =>
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

    const updatedOrder = await import("../back/services/storage").then((m) =>
      m.getOrder(orderId),
    );
    return updatedOrder!;
  }

  static async timeTrigger(orderId: string, waitTime: number): Promise<Order> {
    await wait(waitTime);
    const updatedOrder = await import("../back/services/storage").then((m) =>
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

      const updatedOrder = await import("../back/services/storage").then((m) =>
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

    const expiredOrder = await import("../back/services/storage").then((m) =>
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
    return (await import("../back/services/storage").then((m) =>
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
      const order = await import("../back/services/storage").then((m) =>
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
    return (await import("../back/services/storage").then((m) =>
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

// Generic ERC20 token contract interface
export interface ERC20 extends ethers.Contract {
  // View functions
  balanceOf(address: string): Promise<bigint>;
  allowance(owner: string, spender: string): Promise<bigint>;
  decimals(): Promise<number>;
  symbol(): Promise<string>;
  name(): Promise<string>;

  // State-changing functions
  approve(
    spender: string,
    amount: bigint,
  ): Promise<ethers.ContractTransactionResponse>;
  transfer(
    to: string,
    amount: bigint,
  ): Promise<ethers.ContractTransactionResponse>;
  transferFrom(
    from: string,
    to: string,
    amount: bigint,
  ): Promise<ethers.ContractTransactionResponse>;
}

// ERC20 contract factory
export function erc20(
  address: string,
  signerOrProvider: ethers.Signer | ethers.Provider,
): ERC20 {
  const abi = [
    // View functions
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function totalSupply() view returns (uint256)",

    // State-changing functions
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",

    // Events
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
  ];

  return new ethers.Contract(address, abi, signerOrProvider) as ERC20;
}

// Token helper utilities
export class TokenUtils {
  // Get token balance in human-readable format
  static async getBalance(
    token: ERC20,
    address: string,
    decimals?: number,
  ): Promise<string> {
    const balance = await token.balanceOf(address);
    const dec = decimals ?? (await token.decimals());
    return ethers.formatUnits(balance, dec);
  }

  // Check and approve token spending if needed
  static async ensureApproval(
    token: ERC20,
    spender: string,
    amount: bigint,
    signer: ethers.Signer,
  ): Promise<void> {
    const signerAddress = await signer.getAddress();
    const currentAllowance = await token.allowance(signerAddress, spender);

    if (currentAllowance < amount) {
      console.log(
        `Approving ${spender} to spend ${ethers.formatUnits(amount, await token.decimals())} ${await token.symbol()}`,
      );
      const tx = await token.connect(signer).approve(spender, amount);
      await tx.wait();
    }
  }

  // Format token amount with proper decimals
  static async formatAmount(token: ERC20, amount: bigint): Promise<string> {
    const decimals = await token.decimals();
    const symbol = await token.symbol();
    return `${ethers.formatUnits(amount, decimals)} ${symbol}`;
  }

  // Parse token amount from string
  static async parseAmount(token: ERC20, amount: string): Promise<bigint> {
    const decimals = await token.decimals();
    return ethers.parseUnits(amount, decimals);
  }
}

// Multicall3 contract interface for batching RPC calls
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL3_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) public payable returns (tuple(bool success, bytes returnData)[] returnData)",
  "function getEthBalance(address addr) public view returns (uint256 balance)"
];

export class Multicall3Utils {
  private multicall: ethers.Contract;
  private provider: ethers.Provider;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
    this.multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  }

  /**
   * Execute multiple calls in a single RPC request using Multicall3
   */
  async execute(calls: Array<{
    target: string;
    allowFailure: boolean;
    callData: string;
  }>): Promise<Array<{ success: boolean; returnData: string }>> {
    // Use staticCall for read-only operations (no gas cost)
    const results = await this.multicall.aggregate3.staticCall(calls);
    return results.map((result: any) => ({
      success: result.success,
      returnData: result.returnData
    }));
  }

  /**
   * Batch multiple balance checks (ETH/BNB + ERC20 tokens)
   */
  async batchBalanceChecks(addresses: string[], tokens: Array<{ address: string; decimals: number; symbol: string }>): Promise<{
    ethBalances: string[];
    tokenBalances: { [tokenSymbol: string]: string[] };
  }> {
    const calls: Array<{ target: string; allowFailure: boolean; callData: string }> = [];

    // Add ETH/BNB balance calls
    for (const address of addresses) {
      calls.push({
        target: MULTICALL3_ADDRESS,
        allowFailure: false,
        callData: this.multicall.interface.encodeFunctionData("getEthBalance", [address])
      });
    }

    // Add ERC20 balance calls
    const erc20Interface = new ethers.Interface([
      "function balanceOf(address owner) view returns (uint256)"
    ]);

    for (const token of tokens) {
      for (const address of addresses) {
        calls.push({
          target: token.address,
          allowFailure: false,
          callData: erc20Interface.encodeFunctionData("balanceOf", [address])
        });
      }
    }

    // Execute all calls in single RPC request
    const results = await this.execute(calls);

    // Parse ETH balances
    const ethBalances: string[] = [];
    for (let i = 0; i < addresses.length; i++) {
      if (results[i].success) {
        const balance = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], results[i].returnData)[0];
        ethBalances.push(ethers.formatEther(balance));
      } else {
        ethBalances.push("0");
      }
    }

    // Parse token balances
    const tokenBalances: { [tokenSymbol: string]: string[] } = {};
    let resultIndex = addresses.length; // Start after ETH balance results

    for (const token of tokens) {
      tokenBalances[token.symbol] = [];
      for (let i = 0; i < addresses.length; i++) {
        if (results[resultIndex].success) {
          const balance = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], results[resultIndex].returnData)[0];
          tokenBalances[token.symbol].push(ethers.formatUnits(balance, token.decimals));
        } else {
          tokenBalances[token.symbol].push("0");
        }
        resultIndex++;
      }
    }

    return { ethBalances, tokenBalances };
  }

  /**
   * Batch allowance checks for multiple tokens and spenders
   */
  async batchAllowanceChecks(
    owner: string,
    checks: Array<{ tokenAddress: string; spender: string; symbol: string; decimals: number }>
  ): Promise<Array<{ symbol: string; spender: string; allowance: string; needsApproval: boolean; amount?: bigint }>> {
    const erc20Interface = new ethers.Interface([
      "function allowance(address owner, address spender) view returns (uint256)"
    ]);

    const calls = checks.map(check => ({
      target: check.tokenAddress,
      allowFailure: false,
      callData: erc20Interface.encodeFunctionData("allowance", [owner, check.spender])
    }));

    const results = await this.execute(calls);

    return checks.map((check, index) => {
      if (results[index].success) {
        const allowance = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], results[index].returnData)[0];
        return {
          symbol: check.symbol,
          spender: check.spender,
          allowance: ethers.formatUnits(allowance, check.decimals),
          needsApproval: allowance < (check.amount || 0n), // Compare if amount provided
          amount: check.amount
        };
      }
      return {
        symbol: check.symbol,
        spender: check.spender,
        allowance: "0",
        needsApproval: true,
        amount: check.amount
      };
    });
  }

  /**
   * Batch network info checks (block number, chain ID, etc.)
   */
  async batchNetworkInfo(): Promise<{
    blockNumber: number;
    chainId: number;
  }> {
    // These calls don't go through multicall since they're provider-level
    // But we can still batch them efficiently
    const [blockNumber, network] = await Promise.all([
      this.provider.getBlockNumber(),
      this.provider.getNetwork()
    ]);

    return {
      blockNumber,
      chainId: Number(network.chainId)
    };
  }
}

// E2E Test Helper Functions for concise testing
export class E2EHelpers {
  /**
   * Setup and verify all prerequisites for E2E test in single call
   */
  static async setupE2ETest(config: {
    chainId: number;
    user: ethers.Wallet;
    keeper: ethers.Wallet; 
    provider: ethers.Provider;
    wethAddress: string;
    usdtAddress: string;
    pairSymbol: string;
  }): Promise<{
    priceData: any;
    balances: { user: string; keeper: string; weth: string; usdt: string };
  }> {
    const multicall = new Multicall3Utils(config.provider);
    
    // Single RPC call for network info + balances
    const [networkInfo, balanceResults] = await Promise.all([
      multicall.batchNetworkInfo(),
      multicall.batchBalanceChecks(
        [config.user.address, config.keeper.address],
        [
          { address: config.wethAddress, decimals: 18, symbol: "WETH" },
          { address: config.usdtAddress, decimals: 6, symbol: "USDT" }
        ]
      )
    ]);

    // Initialize services
    const { initStorage } = await import("../back/services/storage");
    const { getConfig } = await import("../back/services/config");
    const { createOrderRegistry } = await import("../back/services/orderRegistry");
    const { priceCache } = await import("../back/services/priceCache");
    
    initStorage(getConfig().storage);
    // Note: Order registry service should already be running
    await priceCache.connect();
    
    // Wait for price data
    await new Promise(resolve => setTimeout(resolve, 2000));
    const priceData = priceCache.getPrice(config.pairSymbol);
    
    if (!priceData?.mid) {
      throw new Error(`Collector service not running - no price data for ${config.pairSymbol}`);
    }

    const balances = {
      user: balanceResults.ethBalances[0],
      keeper: balanceResults.ethBalances[1], 
      weth: balanceResults.tokenBalances.WETH[0],
      usdt: balanceResults.tokenBalances.USDT[0]
    };

    console.log(`✅ E2E Setup: Chain ${networkInfo.chainId}, Block ${networkInfo.blockNumber}, Price $${priceData.mid.toFixed(2)}`);
    console.log(`💰 Balances - User: ${balances.user} BNB, ${balances.weth} WETH, ${balances.usdt} USDT`);
    
    return { priceData, balances };
  }

  /**
   * Create and register order with single function call
   */
  static async createAndRegisterOrder(
    orderRegistry: any,
    user: ethers.Wallet,
    params: {
      orderId: string;
      wethAmount: number;
      spotPrice: number;
      wethAddress: string;
      usdtAddress: string;
      chainId: number;
      startDelayMs?: number;
      durationMs?: number;
    }
  ): Promise<{ order: any; orderHash: string }> {
    const { generateOrderId } = await import("../common/utils");
    const { OrderType, OrderStatus } = await import("../common/types");
    
    const now = Date.now();
    const twapParams = {
      type: OrderType.TWAP,
      makingAmount: params.wethAmount,
      startDate: now + (params.startDelayMs || 10000),
      endDate: now + (params.durationMs || 60000),
      interval: 0,
      maxPrice: 0,
      expiry: 0,
      maker: user.address,
      makerAsset: params.wethAddress,
      takerAsset: params.usdtAddress,
      chainId: params.chainId,
    };

    const order = {
      id: params.orderId,
      signature: await user.signMessage(JSON.stringify(twapParams)),
      params: twapParams,
      status: OrderStatus.PENDING,
      remainingMakerAmount: 0,
      triggerCount: 0,
      createdAt: now,
      nextTriggerValue: twapParams.startDate,
    };

    await orderRegistry.createOrder(order);
    
    console.log(`📋 Order created: ${params.orderId.slice(0, 8)}... (${params.wethAmount} WETH @ $${params.spotPrice})`);
    
    return { order, orderHash: params.orderId };
  }

  /**
   * Check and approve token with single function call
   */
  static async ensureApproval(
    tokenAddress: string,
    spender: string,
    user: ethers.Wallet,
    provider: ethers.Provider,
    amountEther: string = "1"
  ): Promise<boolean> {
    const multicall = new Multicall3Utils(provider);
    const amount = ethers.parseEther(amountEther);
    
    const [approvalCheck] = await multicall.batchAllowanceChecks(user.address, [{
      tokenAddress,
      spender,
      symbol: "TOKEN",
      decimals: 18,
      amount
    }]);

    if (approvalCheck.needsApproval) {
      const token = erc20(tokenAddress, provider);
      const tx = await token.connect(user).approve(spender, amount);
      await tx.wait();
      console.log(`✅ Token approved: ${spender.slice(0, 8)}...`);
      return true;
    }
    
    console.log(`✅ Token already approved`);
    return false;
  }

  /**
   * Monitor order execution with real-time price tracking
   */
  static async monitorOrderExecution(
    orderId: string,
    maxAttempts: number = 12,
    intervalMs: number = 5000,
    pairSymbol: string
  ): Promise<{ order: any; priceData: any; executed: boolean }> {
    const { getOrder } = await import("../back/services/storage");
    const { priceCache } = await import("../back/services/priceCache");
    const { OrderStatus } = await import("../common/types");
    
    let attempts = 0;
    let finalOrder: any = null;
    
    while (attempts < maxAttempts) {
      finalOrder = await getOrder(orderId);
      const currentPriceData = priceCache.getPrice(pairSymbol);
      
      if (finalOrder) {
        const executed = [OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED].includes(finalOrder.status);
        const hashCount = finalOrder.oneInchOrderHashes?.length || 0;
        
        console.log(`📊 Monitor [${attempts + 1}/${maxAttempts}]: ${finalOrder.status}, triggers=${finalOrder.triggerCount}, hashes=${hashCount}, price=$${currentPriceData?.mid?.toFixed(2) || 'N/A'}`);
        
        if (executed) {
          console.log(`🎉 Order executed: ${finalOrder.status}`);
          return { order: finalOrder, priceData: currentPriceData, executed: true };
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      attempts++;
    }
    
    return { order: finalOrder, priceData: priceCache.getPrice(pairSymbol), executed: false };
  }

  /**
   * Verify order state with comprehensive checks
   */
  static verifyOrderExecution(
    order: any,
    expectations: {
      minTriggers?: number;
      hasHashes?: boolean;
      validStatuses?: string[];
    } = {}
  ): { success: boolean; summary: string } {
    const { OrderStatus } = require("../common/types");
    
    const {
      minTriggers = 1,
      hasHashes = true,
      validStatuses = [OrderStatus.ACTIVE, OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED]
    } = expectations;
    
    const checks = {
      hasOrder: !!order,
      triggerCount: order?.triggerCount >= minTriggers,
      hasHashes: !hasHashes || (order?.oneInchOrderHashes?.length > 0),
      validStatus: validStatuses.includes(order?.status)
    };
    
    const success = Object.values(checks).every(Boolean);
    const summary = `${order?.id?.slice(0, 8)}... - Status: ${order?.status}, Triggers: ${order?.triggerCount}, Hashes: ${order?.oneInchOrderHashes?.length || 0}`;
    
    return { success, summary };
  }

  /**
   * Cleanup E2E test resources
   */
  static async cleanup(orderRegistry?: any): Promise<void> {
    // Note: Don't stop orderRegistry - it's a shared service that should keep running
    
    try {
      const { priceCache } = await import("../back/services/priceCache");
      await priceCache.disconnect();
    } catch (error) {
      // Ignore cleanup errors
    }
    
    console.log(`🧹 E2E cleanup completed`);
  }
}
