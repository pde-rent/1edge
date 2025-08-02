#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { ethers } from "ethers";
import { generateOrderId } from "@common/utils";
import { OrderType, OrderStatus } from "@common/types";
import type { Order, TwapParams } from "@common/types";
import { getConfig } from "@back/services/config";
import { initStorage, getOrder } from "@back/services/storage";
import { createOrderRegistry } from "@back/services/orderRegistry";

// Test configuration - simplified
const INTERVAL_SECONDS = 10; // 10 seconds between executions
const TOTAL_DURATION = 25; // 25 seconds total (2-3 executions)

describe("TWAP Order Lifecycle Test", () => {
  let context: TestContext;
  const testSuite = createTestSuite();

  beforeAll(async () => {
    context = await testSuite.setup();

    // Mock price cache with static price
    mockPriceCache({ price: TEST_PRICES.ETH });
  });

  afterAll(async () => {
    await testSuite.teardown(context);
  });

  test("TWAP executes multiple intervals", async () => {
    const now = Date.now();

    const twapParams: TwapParams = {
      amount: "1.0",
      startDate: now,
      endDate: now + TOTAL_DURATION * 1000,
      interval: INTERVAL_SECONDS * 1000,
      maxPrice: TEST_PRICES.ETH + 100,
    };

    // Create TWAP order using factory
    const order = await OrderFactory.generic(
      context.testWallet,
      OrderType.TWAP,
      twapParams,
      TEST_PRICES.ETH,
    );
    order.nextTriggerValue = now; // Set initial trigger time

    // Create order and verify initial state
    await TestScenarios.createStoreOrder(context.orderRegistry, order);
    logOrderState(await getOrder(order.id), "Initial");

    // Wait for multiple executions
    const finalOrder = await TestScenarios.timeTrigger(
      order.id,
      (TOTAL_DURATION + 5) * 1000,
    );

    logOrderState(finalOrder, "Final");

    // Verify TWAP executed multiple times and completed
    expectOrderState(finalOrder, {
      triggerCount: "greater-than-zero",
      status: OrderStatus.COMPLETED,
      type: OrderType.TWAP,
    });

    expect(finalOrder.triggerCount).toBeGreaterThan(1); // Should have executed multiple intervals
    console.log(
      `✅ TWAP order executed ${finalOrder.triggerCount} intervals as expected`,
    );
  }, 60000);
});
