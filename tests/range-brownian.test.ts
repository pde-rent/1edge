#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { ethers } from "ethers";
import { generateOrderId } from "@common/utils";
import { OrderType, OrderStatus } from "@common/types";
import type { Order, RangeOrderParams } from "@common/types";
import { getConfig } from "@back/services/config";
import { initStorage, getOrder } from "@back/services/storage";
import { createOrderRegistry } from "@back/services/orderRegistry";

// Test configuration - Range order scaling down
const INITIAL_PRICE = 4000;    // Starting at $4000
const START_PRICE = 3980;      // Start buying when price hits $3980 (closer to start)
const END_PRICE = 3800;        // Continue until $3800 (closer range)
const STEP_PCT = 2.0;          // 2% steps = $79.60 per step (fewer steps)
const TEST_DURATION = 30;     // 30 seconds test duration
const PRICE_UPDATE_INTERVAL = 1; // Update price every 1 second

/**
 * Simple Brownian Motion (Random Walk) price generator
 * Simulates realistic price movements with drift and volatility
 */
class BrownianMotionPriceGenerator {
  private currentPrice: number;
  private drift: number;      // Trend component (per update)
  private volatility: number; // Random component (per update)
  private dt: number;         // Time step
  
  constructor(initialPrice: number, annualDrift: number = -0.05, annualVolatility: number = 0.3) {
    this.currentPrice = initialPrice;
    // Convert annual parameters to per-update 
    this.dt = PRICE_UPDATE_INTERVAL / (365 * 24 * 3600); // Fraction of year per update
    this.drift = annualDrift * this.dt;
    this.volatility = annualVolatility * Math.sqrt(this.dt);
  }
  
  nextPrice(): number {
    // Geometric Brownian Motion: dS = S * (μ*dt + σ*sqrt(dt)*Z)
    // Where Z is standard normal random variable
    const randomShock = this.normalRandom();
    
    // Add a stronger bearish bias for testing purposes
    const bearishBias = -0.001; // Additional -0.1% per update
    const priceChange = this.currentPrice * (this.drift + bearishBias + this.volatility * randomShock);
    
    this.currentPrice += priceChange;
    
    // Ensure price doesn't go negative
    this.currentPrice = Math.max(this.currentPrice, 100);
    
    return this.currentPrice;
  }
  
  getCurrentPrice(): number {
    return this.currentPrice;
  }
  
  // Box-Muller transform to generate standard normal random variable
  private normalRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

describe("Range Order with Brownian Motion Test", () => {
  let testWallet: ethers.Wallet;
  let orderRegistry: any;
  let priceGenerator: BrownianMotionPriceGenerator;
  let priceUpdateTimer: Timer;
  let mockPriceCache: any;

  beforeAll(async () => {
    initStorage(getConfig().storage);
    testWallet = ethers.Wallet.createRandom();
    
    // Initialize Brownian motion price generator
    priceGenerator = new BrownianMotionPriceGenerator(
      INITIAL_PRICE,
      -0.5,   // -50% annual drift (very bearish for scaling-in test)
      3.0     // 300% annual volatility (extreme volatility to ensure movement)
    );
    
    // Mock price cache with dynamic price updates
    mockPriceCache = {
      getPrice: () => ({
        last: { mid: priceGenerator.getCurrentPrice() }
      })
    };
    
    mock.module("@back/services/priceCache", () => ({
      priceCache: mockPriceCache
    }));
    
    // Create order registry in mock mode
    orderRegistry = createOrderRegistry(true);
    await orderRegistry.start();
    
    // Start price simulation - update every PRICE_UPDATE_INTERVAL seconds
    priceUpdateTimer = setInterval(() => {
      const newPrice = priceGenerator.nextPrice();
      console.log(`[PRICE UPDATE] New price: $${newPrice.toFixed(2)}`);
    }, PRICE_UPDATE_INTERVAL * 1000);
  });

  afterAll(async () => {
    if (priceUpdateTimer) {
      clearInterval(priceUpdateTimer);
    }
    await orderRegistry.stop();
  });

  test("Range order executes multiple steps as price moves down via Brownian motion", async () => {
    const orderId = generateOrderId(testWallet.address);
    const now = Date.now();
    
    const rangeParams: RangeOrderParams = {
      amount: "2.0",        // 2 ETH total
      startPrice: START_PRICE,
      endPrice: END_PRICE,
      stepPct: STEP_PCT,
      expiry: 1             // 1 day expiry
    };
    
    // Calculate expected number of steps
    const priceRange = Math.abs(rangeParams.endPrice - rangeParams.startPrice);
    const stepSize = priceRange * (rangeParams.stepPct / 100);
    const expectedSteps = Math.ceil(priceRange / stepSize);
    const amountPerStep = parseFloat(rangeParams.amount) / expectedSteps;
    
    console.log(`[TEST SETUP] Range: $${START_PRICE} → $${END_PRICE}`);
    console.log(`[TEST SETUP] Expected ${expectedSteps} steps of ${amountPerStep.toFixed(4)} ETH each`);
    console.log(`[TEST SETUP] Starting price: $${priceGenerator.getCurrentPrice().toFixed(2)}`);
    
    const order: Order = {
      id: orderId,
      type: OrderType.RANGE,
      size: rangeParams.amount,
      maker: testWallet.address,
      makerAsset: getConfig().tokenMapping.WETH["1"],
      takerAsset: getConfig().tokenMapping.USDT["1"],
      makingAmount: ethers.parseEther(rangeParams.amount).toString(),
      takingAmount: ethers.parseUnits((parseFloat(rangeParams.amount) * INITIAL_PRICE).toString(), 6).toString(),
      params: rangeParams,
      createdAt: now,
      remainingSize: rangeParams.amount,
      triggerCount: 0,
      nextTriggerValue: START_PRICE,
      signature: await testWallet.signMessage(JSON.stringify({
        type: OrderType.RANGE,
        size: rangeParams.amount,
        params: rangeParams,
        maker: testWallet.address,
        makerAsset: getConfig().tokenMapping.WETH["1"],
        takerAsset: getConfig().tokenMapping.USDT["1"],
      })),
      userSignedPayload: "test",
      status: OrderStatus.PENDING,
      oneInchOrderHashes: []
    } as Order;
    
    // Create order
    await orderRegistry.createOrder(order);
    console.log(`[ORDER CREATED] Range order ${orderId} created`);
    
    // Wait for price to move and trigger executions
    console.log(`[SIMULATION] Running Brownian motion for ${TEST_DURATION} seconds...`);
    await new Promise(resolve => setTimeout(resolve, TEST_DURATION * 1000));
    
    // Check final results
    const finalOrder = await getOrder(orderId);
    expect(finalOrder).toBeDefined();
    
    const finalPrice = priceGenerator.getCurrentPrice();
    console.log(`[RESULTS] Final price: $${finalPrice.toFixed(2)}`);
    console.log(`[RESULTS] Triggers executed: ${finalOrder!.triggerCount}`);
    console.log(`[RESULTS] Order status: ${finalOrder!.status}`);
    
    // Verify order executed at least once if price moved into range
    if (finalPrice <= START_PRICE || finalOrder!.triggerCount > 0) {
      expect(finalOrder!.triggerCount).toBeGreaterThan(0);
      console.log(`[SUCCESS] Range order triggered ${finalOrder!.triggerCount} times as expected`);
    } else {
      console.log(`[INFO] Price never reached start price $${START_PRICE}, no triggers expected`);
    }
    
    // If price moved significantly down, expect multiple triggers
    if (finalPrice <= START_PRICE - (stepSize * 2)) {
      expect(finalOrder!.triggerCount).toBeGreaterThan(1);
      console.log(`[SUCCESS] Multiple triggers as price moved down significantly`);
    }
    
    // Verify order completes if all steps executed or reaches end price
    if (finalOrder!.triggerCount >= expectedSteps || finalPrice <= END_PRICE) {
      expect(finalOrder!.status).toBe(OrderStatus.COMPLETED);
      console.log(`[SUCCESS] Order completed as expected`);
    }
    
  }, 90000); // 90 second timeout

});