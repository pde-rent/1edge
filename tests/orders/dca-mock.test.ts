#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { OrderType, OrderStatus } from "@common/types";
import type { DCAParams } from "@common/types";
import { getOrder } from "@back/services/storage";
import {
  createTestSuite,
  OrderFactory,
  mockPriceCache,
  TestScenarios,
  wait,
  expectOrderState,
  logOrderState,
  TEST_PRICES,
  TestContext
} from "../utils";

// Test configuration - simplified for DCA
const INTERVAL_SECONDS = 8; // 8 seconds between executions (converted from days)
const TOTAL_DURATION = 20; // 20 seconds total (2-3 executions)
const ETH_PRICE = 3500;

describe("DCA Strategy Lifecycle Test", () => {
  let context: TestContext;
  const testSuite = createTestSuite();

  beforeAll(async () => {
    // Mock price cache
    mockPriceCache({ price: ETH_PRICE });

    // Setup test context
    context = await testSuite.setup();
  });

  afterAll(async () => {
    await testSuite.teardown(context);
  });

  test("DCA executes multiple intervals", async () => {
    const now = Date.now();

    const dcaParams: DCAParams = {
      amount: "0.5",
      startDate: now,
      interval: INTERVAL_SECONDS / (24 * 60 * 60), // Convert seconds to days for the parameter
      maxPrice: ETH_PRICE + 200 // Allow execution
    };

    // Create DCA order using factory
    const order = await OrderFactory.dca(context.testWallet, dcaParams, ETH_PRICE);

    console.log(`DCA order created with ${INTERVAL_SECONDS}s intervals`);

    // Create order and wait for multiple executions
    await TestScenarios.createStoreOrder(context.orderRegistry, order);

    // Wait long enough for multiple executions
    await wait((TOTAL_DURATION + 3) * 1000);

    const finalOrder = await getOrder(order.id);
    logOrderState(finalOrder, "Final DCA");

    // Verify DCA functionality
    expectOrderState(finalOrder, {
      triggerCount: 'greater-than-zero',
      status: OrderStatus.ACTIVE,
      type: OrderType.DCA
    });

    expect(finalOrder!.triggerCount).toBeGreaterThan(1); // Should have executed multiple times
  }, 30000);

});
