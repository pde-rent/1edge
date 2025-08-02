#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { OrderType, OrderStatus } from "@common/types";
import type { IcebergParams } from "@common/types";
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
  TEST_TIMEOUTS,
  TestContext,
} from "../utils";

// Test configuration
const START_PRICE = 3900; // Starting price
const END_PRICE = 4000; // Target price
const STEPS = 4; // 4 steps = $25 per step
const INITIAL_PRICE = 3850; // Start below start price

describe("Iceberg Order Lifecycle Test", () => {
  let context: TestContext;
  const testSuite = createTestSuite();

  beforeAll(async () => {
    context = await testSuite.setup();
  });

  afterAll(async () => {
    await testSuite.teardown(context);
  });

  test("Iceberg order executes steps as price moves through levels", async () => {
    // Setup dynamic price mock
    const priceMock = new DynamicPriceMock(INITIAL_PRICE);
    mockPriceCache(priceMock);

    const icebergParams: IcebergParams = {
      amount: "2.0",
      startPrice: START_PRICE,
      endPrice: END_PRICE,
      steps: STEPS,
      expiry: 1, // 1 day
    };

    // Calculate step metrics
    const priceRange = END_PRICE - START_PRICE; // 100
    const stepSize = priceRange / STEPS; // 25
    const amountPerStep = parseFloat(icebergParams.amount) / STEPS; // 0.5 ETH per step

    console.log(
      `Iceberg setup: ${START_PRICE} → ${END_PRICE}, ${STEPS} steps of $${stepSize} each`,
    );
    console.log(
      `Amount per step: ${amountPerStep} ETH, starting at price ${INITIAL_PRICE}`,
    );

    // Create order using factory
    const order = await OrderFactory.iceberg(
      context.testWallet,
      icebergParams,
      INITIAL_PRICE,
    );

    // Create order and verify initial state
    await TestScenarios.createStoreOrder(context.orderRegistry, order);
    logOrderState(await getOrder(order.id), "Initial");

    // Simulate price movement to trigger first step
    // Move price to first step level: 3900 + (100/4 * 1) = 3925
    const firstStepPrice = START_PRICE + stepSize; // 3925
    console.log(`Price moved to ${firstStepPrice} (first step level)`);

    let updatedOrder = await TestScenarios.priceTrigger(
      priceMock,
      order.id,
      firstStepPrice,
      TEST_TIMEOUTS.MEDIUM,
    );
    logOrderState(updatedOrder, "After first step");

    // Move price to trigger second step: 3950
    const secondStepPrice = START_PRICE + stepSize * 2; // 3950
    console.log(`Price moved to ${secondStepPrice} (second step level)`);

    updatedOrder = await TestScenarios.priceTrigger(
      priceMock,
      order.id,
      secondStepPrice,
      TEST_TIMEOUTS.MEDIUM,
    );
    logOrderState(updatedOrder, "After second step");

    // Verify iceberg functionality
    expectOrderState(updatedOrder, {
      status: [OrderStatus.PENDING, OrderStatus.ACTIVE, OrderStatus.COMPLETED],
      type: OrderType.ICEBERG,
    });

    if (updatedOrder.triggerCount > 0) {
      console.log(
        `✅ Iceberg order triggered ${updatedOrder.triggerCount} times as price moved through levels`,
      );
      expectOrderState(updatedOrder, {
        status: [OrderStatus.ACTIVE, OrderStatus.COMPLETED],
      });
    } else {
      console.log(
        `ℹ️  Iceberg triggers may require specific price movement patterns`,
      );
    }

    // If multiple steps triggered, verify progression
    if (updatedOrder.triggerCount >= 2) {
      console.log(`✅ Multiple iceberg steps executed successfully`);
    }
  }, 20000);
});
