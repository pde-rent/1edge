#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { OrderType, OrderStatus } from "@common/types";
import type { RangeOrderParams } from "@common/types";
import { getOrder } from "@back/services/storage";
import {
  createTestSuite,
  OrderFactory,
  TestScenarios,
  OrderTestScenarios,
  DynamicPriceMock,
  mockPriceCache,
  expectOrderState,
  TestAssertions,
  TEST_CONFIGS,
  TestContext,
} from "../utils";

describe("Range Order Test", () => {
  let context: TestContext;
  const testSuite = createTestSuite();

  beforeAll(async () => {
    context = await testSuite.setup();
  });

  afterAll(async () => {
    await testSuite.teardown(context);
  });

  test("Range order executes multiple price levels", async () => {
    const config = TEST_CONFIGS.RANGE;
    const rangeParams = { ...config, expiry: 1 };

    // Create and setup range order
    const order = await OrderFactory.generic(
      context.testWallet,
      OrderType.RANGE,
      rangeParams,
      config.startPrice + 100,
    );
    order.nextTriggerValue = config.startPrice;
    await TestScenarios.createStoreOrder(context.orderRegistry, order);

    // Test price movements through range
    const priceMock = new DynamicPriceMock(config.startPrice + 100);
    mockPriceCache(priceMock);

    const results = await OrderTestScenarios.multiPriceMovements(
      priceMock,
      order.id,
      [config.startPrice - 20, config.startPrice - 60, config.endPrice + 10],
    );

    // Verify multi-level execution
    const finalOrder = results[results.length - 1];
    TestAssertions.expectTriggered(finalOrder);
    expectOrderState(finalOrder, {
      status: [OrderStatus.ACTIVE, OrderStatus.COMPLETED],
      type: OrderType.RANGE,
    });

    console.log(
      `✅ Range order triggered ${finalOrder.triggerCount} times across price levels`,
    );
  }, 30000);

  test("Range order respects step progression", async () => {
    const config = TEST_CONFIGS.RANGE;
    const rangeParams = { ...config, amount: "1.0", expiry: 1 };

    // Setup with price mock at start price (should not trigger)
    const priceMock = new DynamicPriceMock(config.startPrice);
    mockPriceCache(priceMock);

    const order = await OrderFactory.generic(
      context.testWallet,
      OrderType.RANGE,
      rangeParams,
      config.startPrice,
    );
    await TestScenarios.createStoreOrder(context.orderRegistry, order);

    // Verify no initial trigger, then trigger on price movement
    TestAssertions.expectNotTriggered(await getOrder(order.id));

    const triggeredOrder = await TestScenarios.priceTrigger(
      priceMock,
      order.id,
      config.startPrice - 50,
    );

    TestAssertions.expectTriggered(triggeredOrder, 1);
    console.log("✅ Range order correctly triggers on price entry into range");
  }, 15000);
});
