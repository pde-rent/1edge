#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { ethers } from "ethers";
import { generateOrderId } from "@common/utils";
import { OrderType, OrderStatus } from "@common/types";
import type { Order, TwapParams } from "@common/types";
import { getConfig } from "@back/services/config";
import { initStorage, getOrder } from "@back/services/storage";
import { orderRegistry } from "@back/services/orderRegistry";

// Test configuration - simplified
const INTERVAL_SECONDS = 10; // 10 seconds between executions
const TOTAL_DURATION = 25; // 25 seconds total (2-3 executions)
const ETH_PRICE = 4000;

describe("TWAP Order Lifecycle Test", () => {
  let testWallet: ethers.Wallet;

  beforeAll(async () => {
    initStorage(getConfig().storage);
    testWallet = ethers.Wallet.createRandom();
    
    // Mock price cache
    mock.module("@back/services/priceCache", () => ({
      priceCache: {
        getPrice: () => ({
          last: { mid: ETH_PRICE }
        })
      }
    }));
    
    await orderRegistry.start();
  });

  afterAll(async () => {
    await orderRegistry.stop();
  });

  test("TWAP executes multiple intervals", async () => {
    const orderId = generateOrderId(testWallet.address);
    const now = Date.now();
    
    const twapParams: TwapParams = {
      amount: "1.0",
      startDate: now,
      endDate: now + TOTAL_DURATION * 1000,
      interval: INTERVAL_SECONDS * 1000,
      maxPrice: ETH_PRICE + 100
    };
    
    const order: Order = {
      id: orderId,
      type: OrderType.TWAP,
      size: twapParams.amount,
      maker: testWallet.address,
      makerAsset: getConfig().tokenMapping.WETH["1"],
      takerAsset: getConfig().tokenMapping.USDT["1"],
      makingAmount: ethers.parseEther(twapParams.amount).toString(),
      takingAmount: ethers.parseUnits((parseFloat(twapParams.amount) * ETH_PRICE).toString(), 6).toString(),
      params: twapParams,
      createdAt: now,
      remainingSize: twapParams.amount,
      triggerCount: 0,
      nextTriggerValue: now,
      signature: await testWallet.signMessage(JSON.stringify({
        type: OrderType.TWAP,
        size: twapParams.amount,
        params: twapParams,
        maker: testWallet.address,
        makerAsset: getConfig().tokenMapping.WETH["1"],
        takerAsset: getConfig().tokenMapping.USDT["1"],
      })),
      userSignedPayload: "test",
      status: OrderStatus.PENDING,
      oneInchOrderHashes: []
    } as Order;
    
    // Create order and wait for multiple executions
    await orderRegistry.createOrder(order);
    
    // Wait long enough for multiple executions
    await new Promise(resolve => setTimeout(resolve, (TOTAL_DURATION + 5) * 1000));
    
    const finalOrder = await getOrder(orderId);
    expect(finalOrder).toBeDefined();
    expect(finalOrder!.triggerCount).toBeGreaterThan(1); // Should have executed multiple times
    expect(finalOrder!.status).toBe(OrderStatus.COMPLETED);
  }, 60000);

});