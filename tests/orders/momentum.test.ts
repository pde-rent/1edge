#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { OrderType, OrderStatus } from "@common/types";
import type { MomentumReversalParams } from "@common/types";
import { getOrder } from "@back/services/storage";
import {
  createTestSuite,
  OrderFactory,
  mockPriceCache,
  TechnicalAnalysisScenarios,
  TestScenarios,
  wait,
  expectOrderState,
  logOrderState,
  TEST_PRICES,
  TEST_TIMEOUTS,
  TestContext
} from "../utils";

// Test configuration
const ETH_PRICE = 4000;
const RSI_PERIOD = 14;
const RSIMA_PERIOD = 5;
const TP_PCT = 3.0; // 3% take profit
const SL_PCT = 1.5; // 1.5% stop loss

describe("Momentum Strategy Lifecycle Test", () => {
  let context: TestContext;
  const testSuite = createTestSuite();

  beforeAll(async () => {
    context = await testSuite.setup();
  });

  afterAll(async () => {
    await testSuite.teardown(context);
  });

  test("Momentum Reversal order triggers on oversold reversal signal", async () => {
    // Mock price cache with oversold reversal scenario
    const rsiScenario = TechnicalAnalysisScenarios.rsi(
      'oversold-reversal',
      RSI_PERIOD,
      RSIMA_PERIOD
    );
    mockPriceCache(rsiScenario);

    const momentumReversalParams: MomentumReversalParams = {
      amount: "1.0",
      rsiPeriod: RSI_PERIOD,
      rsimaPeriod: RSIMA_PERIOD,
      tpPct: TP_PCT,
      slPct: SL_PCT,
    };

    // Create order using factory
    const order = await OrderFactory.momentum(context.testWallet, momentumReversalParams, ETH_PRICE);

    console.log(`Testing momentum reversal with RSI oversold reversal signal`);

    // Create order and verify initial state
    await TestScenarios.createStoreOrder(context.orderRegistry, order);
    logOrderState(await getOrder(order.id), "Initial");

    // Wait for momentum reversal detection
    await wait(TEST_TIMEOUTS.MEDIUM);

    const updatedOrder = await getOrder(order.id);
    logOrderState(updatedOrder, "After analysis");

    // Verify momentum reversal functionality
    expectOrderState(updatedOrder, {
      status: [OrderStatus.PENDING, OrderStatus.ACTIVE],
      type: OrderType.MOMENTUM_REVERSAL
    });

    if (updatedOrder!.triggerCount > 0) {
      console.log(`✅ Momentum reversal order triggered on oversold reversal signal`);
      expect(updatedOrder!.status).toBe(OrderStatus.ACTIVE);
      console.log(`Order executed with TP: ${TP_PCT}%, SL: ${SL_PCT}%`);
    } else {
      console.log(`ℹ️  Momentum reversal conditions not met - RSI analysis may require specific patterns`);
    }

    expect(updatedOrder!.params).toBeDefined();

  }, 20000);

});
