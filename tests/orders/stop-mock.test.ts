#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { OrderType, OrderStatus } from "@common/types";
import type { StopLimitParams } from "@common/types";
import { getOrder } from "@back/services/storage";
import {
  createTestSuite,
  OrderFactory,
  DynamicPriceMock,
  mockPriceCache,
  TestScenarios,
  expectOrderState,
  logOrderState,
  TEST_TIMEOUTS,
  TestContext
} from "../utils";

// Test configuration
const INITIAL_ETH_PRICE = 3800; // Start below stop price
const STOP_PRICE = 4000; // Stop price trigger
const LIMIT_PRICE = 4100; // Limit price for execution

describe("Stop Limit Order Lifecycle Test", () => {
    let context: TestContext;
    const testSuite = createTestSuite();

    beforeAll(async () => {
        context = await testSuite.setup();
    });

    afterAll(async () => {
        await testSuite.teardown(context);
    });

    test("Stop Limit order triggers when price reaches stop price", async () => {
        // Setup dynamic price mock
        const priceMock = new DynamicPriceMock(INITIAL_ETH_PRICE);
        mockPriceCache(priceMock);

        const stopLimitParams: StopLimitParams = {
            amount: "1.0",
            stopPrice: STOP_PRICE,
            limitPrice: LIMIT_PRICE,
            expiry: 1 // 1 day
        };

        // Create order using factory
        const order = await OrderFactory.stop(context.testWallet, stopLimitParams, INITIAL_ETH_PRICE);

        // Create order and verify initial state (not triggered yet - price below stop price)
        await TestScenarios.createStoreOrder(context.orderRegistry, order);
        
        let updatedOrder = await getOrder(order.id);
        console.log(`Initial order trigger count: ${updatedOrder!.triggerCount}, status: ${updatedOrder!.status}, current price: ${INITIAL_ETH_PRICE}, stop price: ${STOP_PRICE}`);
        expect(updatedOrder!.triggerCount).toBe(0);

        // Simulate price movement above stop price
        const triggerPrice = STOP_PRICE + 50; // Move price above stop price
        console.log(`Price moved from ${INITIAL_ETH_PRICE} to ${triggerPrice} (above stop price ${STOP_PRICE})`);

        // Test price movement trigger
        updatedOrder = await TestScenarios.priceTrigger(priceMock, order.id, triggerPrice, TEST_TIMEOUTS.MEDIUM);
        logOrderState(updatedOrder, "After price movement");

        // Order should have triggered
        expectOrderState(updatedOrder, {
            triggerCount: 'greater-than-zero',
            status: OrderStatus.ACTIVE,
            type: OrderType.STOP_LIMIT
        });

    }, 20000);

});