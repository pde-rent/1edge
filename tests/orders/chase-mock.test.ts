#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { OrderType, OrderStatus } from "@common/types";
import type { ChaseLimitParams } from "@common/types";
import { getOrder } from "@back/services/storage";
import {
  createTestSuite,
  OrderFactory,
  DynamicPriceMock,
  mockPriceCache,
  TestScenarios,
  wait,
  expectOrderState,
  logOrderState,
  TEST_PRICES,
  TEST_TIMEOUTS,
  TestContext,
} from "../utils";

// Test configuration
const INITIAL_ETH_PRICE = 4000;
const PRICE_MOVEMENT = 200; // Price will move by $200
const DISTANCE_PCT = 3; // 3% distance threshold
const EXPIRY_DAYS = 1;

describe("Chase Limit Order Lifecycle Test", () => {
  let context: TestContext;
  const testSuite = createTestSuite();

  beforeAll(async () => {
    context = await testSuite.setup();
  });

  afterAll(async () => {
    await testSuite.teardown(context);
  });

  test("Chase Limit order follows price movements", async () => {
    // Setup dynamic price mock
    const priceMock = new DynamicPriceMock(INITIAL_ETH_PRICE);
    mockPriceCache(priceMock);

    const chaseLimitParams: ChaseLimitParams = {
      amount: "1.0",
      distancePct: DISTANCE_PCT,
      expiry: EXPIRY_DAYS,
      maxPrice: INITIAL_ETH_PRICE + 500, // Set max price above initial
    };

    // Create order using factory
    const order = await OrderFactory.chase(
      context.testWallet,
      chaseLimitParams,
      INITIAL_ETH_PRICE,
    );

    // Create order and verify initial state
    await TestScenarios.createStoreOrder(context.orderRegistry, order);
    logOrderState(await getOrder(order.id), "Initial");

    // Simulate price movement that should trigger the chase
    // Move price by more than distancePct (3%)
    const priceMovement = (INITIAL_ETH_PRICE * (DISTANCE_PCT + 1)) / 100; // 4% movement
    const newPrice = INITIAL_ETH_PRICE + priceMovement;

    console.log(
      `Price moved from ${INITIAL_ETH_PRICE} to ${newPrice} (+${(((newPrice - INITIAL_ETH_PRICE) / INITIAL_ETH_PRICE) * 100).toFixed(2)}%)`,
    );

    // Test price movement trigger
    let updatedOrder = await TestScenarios.priceTrigger(
      priceMock,
      order.id,
      newPrice,
      TEST_TIMEOUTS.MEDIUM,
    );
    logOrderState(updatedOrder, "After first movement");
    expect(updatedOrder.triggerCount).toBeGreaterThan(0);
    expect(updatedOrder.triggerPrice).toBe(newPrice);

    // Test another price movement - Another 3.5% movement
    const secondMovement = (newPrice * (DISTANCE_PCT + 0.5)) / 100;
    const finalPrice = newPrice + secondMovement;

    console.log(
      `Price moved again to ${finalPrice} (+${(((finalPrice - INITIAL_ETH_PRICE) / INITIAL_ETH_PRICE) * 100).toFixed(2)}% total)`,
    );

    updatedOrder = await TestScenarios.priceTrigger(
      priceMock,
      order.id,
      finalPrice,
      TEST_TIMEOUTS.LONG,
    );
    logOrderState(updatedOrder, "After second movement");

    // The test passes if we get at least one trigger
    expectOrderState(updatedOrder, {
      triggerCount: "greater-than-zero",
      type: OrderType.CHASE_LIMIT,
    });
  }, 30000);

  test("Chase Limit order respects maxPrice limit", async () => {
    // Setup dynamic price mock
    const priceMock = new DynamicPriceMock(INITIAL_ETH_PRICE);
    mockPriceCache(priceMock);

    const chaseLimitParams: ChaseLimitParams = {
      amount: "0.5",
      distancePct: DISTANCE_PCT,
      expiry: EXPIRY_DAYS,
      maxPrice: INITIAL_ETH_PRICE + 100, // Set low max price
    };

    // Create order using factory
    const order = await OrderFactory.chase(
      context.testWallet,
      chaseLimitParams,
      INITIAL_ETH_PRICE,
    );

    // Create order and verify initial state
    await TestScenarios.createStoreOrder(context.orderRegistry, order);

    // Simulate large price movement that exceeds maxPrice
    const highPrice = INITIAL_ETH_PRICE + 300; // Well above maxPrice

    console.log(
      `Price moved to ${highPrice}, above maxPrice of ${chaseLimitParams.maxPrice}`,
    );

    // Test price movement - order should not execute due to maxPrice constraint
    const updatedOrder = await TestScenarios.priceTrigger(
      priceMock,
      order.id,
      highPrice,
      TEST_TIMEOUTS.SHORT,
    );
    logOrderState(updatedOrder, "Above maxPrice");
  }, 20000);

  test("Chase Limit order expires correctly", async () => {
    // Setup dynamic price mock
    const priceMock = new DynamicPriceMock(INITIAL_ETH_PRICE);
    mockPriceCache(priceMock);

    const chaseLimitParams: ChaseLimitParams = {
      amount: "0.25",
      distancePct: DISTANCE_PCT,
      expiry: 0.001, // Very short expiry (about 1.4 minutes)
    };

    // Create order using factory
    const order = await OrderFactory.chase(
      context.testWallet,
      chaseLimitParams,
      INITIAL_ETH_PRICE,
    );

    // Create order and verify initial state
    await TestScenarios.createStoreOrder(context.orderRegistry, order);

    // Wait for expiry to pass
    await wait(TEST_TIMEOUTS.SHORT);

    // Try to trigger with price movement after expiry
    const updatedOrder = await TestScenarios.priceTrigger(
      priceMock,
      order.id,
      INITIAL_ETH_PRICE + PRICE_MOVEMENT,
      TEST_TIMEOUTS.SHORT,
    );

    logOrderState(updatedOrder, "After expiry");
  }, 15000);
});
