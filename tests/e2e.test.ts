#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ethers } from "ethers";
import { generateOrderId, roundSig } from "../common/utils";
import { OrderType, OrderStatus } from "../common/types";
import type { PairSymbol } from "../common/types";
import { getConfig } from "../back/services/config";
import { getOrder } from "../back/services/storage";
import deployments from "../deployments.json";
import { E2EHelpers } from "./utils";

// Constants
const CHAIN_ID = 56; // BNB Chain (BSC)
const WETH = getConfig().tokenMapping.WETH[CHAIN_ID.toString()]; // WETH on BSC
const USDT = getConfig().tokenMapping.USDT[CHAIN_ID.toString()]; // USDT on BSC
const DELEGATE_PROXY = deployments.deployments[CHAIN_ID.toString()].proxy;
const ETHUSDT_TICKER: PairSymbol = "agg:spot:ETHUSDT" as PairSymbol; // ETH/USDT price feed for BSC trading

// Setup wallets
const provider = new ethers.JsonRpcProvider(
  getConfig().networks[CHAIN_ID].rpcUrl,
);
const user = new ethers.Wallet(process.env.USER_PK!, provider);
const keeper = new ethers.Wallet(process.env.KEEPER_PK!, provider);

describe("E2E TWAP Order Test", () => {
  let orderRegistry: any;
  let setupData: { priceData: any; balances: any };

  beforeAll(async () => {
    // Single function call for complete E2E setup
    setupData = await E2EHelpers.setupE2ETest({
      chainId: CHAIN_ID,
      user,
      keeper,
      provider,
      wethAddress: WETH,
      usdtAddress: USDT,
      pairSymbol: ETHUSDT_TICKER
    });
    
    // Create orderRegistry instance for order creation (service should be running)
    const { createOrderRegistry } = await import("../back/services/orderRegistry");
    orderRegistry = createOrderRegistry(false);
  });

  afterAll(async () => {
    await E2EHelpers.cleanup(orderRegistry);
  });

  test("Full TWAP order lifecycle with 1inch integration", async () => {
    // Use current price data from setup
    const spotPrice = setupData.priceData.mid;
    const usdAmount = 2; // $2 USD worth  
    const wethAmount = usdAmount / spotPrice;
    
    console.log(`💰 Order: ${roundSig(wethAmount, 7)} WETH @ $${spotPrice.toFixed(2)} (spread: $${(setupData.priceData.ask - setupData.priceData.bid).toFixed(2)})`);

    // Step 1: Create and register TWAP order
    const orderId = generateOrderId(user.address);
    const { order } = await E2EHelpers.createAndRegisterOrder(orderRegistry, user, {
      orderId,
      wethAmount,
      spotPrice,
      wethAddress: WETH,
      usdtAddress: USDT,
      chainId: CHAIN_ID
    });

    // Step 2: Ensure WETH approval  
    await E2EHelpers.ensureApproval(WETH, DELEGATE_PROXY, user, provider);

    // Step 3: Wait for trigger and verify order creation
    console.log(`⏳ Waiting for TWAP trigger and 1inch order creation...`);
    await new Promise(resolve => setTimeout(resolve, 15000));

    const triggeredOrder = await getOrder(orderId);
    expect(triggeredOrder).toBeTruthy();
    expect(triggeredOrder!.triggerCount).toBeGreaterThan(0);
    expect(triggeredOrder!.status).toBe(OrderStatus.ACTIVE);
    expect(triggeredOrder!.oneInchOrderHashes?.length).toBeGreaterThan(0);

    console.log(`✅ Order triggered! 1inch orders: ${triggeredOrder!.oneInchOrderHashes!.length}, hash: ${triggeredOrder!.oneInchOrderHashes![0].slice(0, 10)}...`);

    // Step 4: Monitor order execution with real-time price tracking
    const { order: finalOrder, executed } = await E2EHelpers.monitorOrderExecution(
      orderId, 
      12, // maxAttempts
      5000, // intervalMs  
      ETHUSDT_TICKER
    );

    // Step 5: Verify final state
    const verification = E2EHelpers.verifyOrderExecution(finalOrder);
    expect(verification.success).toBe(true);
    
    console.log(`✅ E2E Test Complete - ${verification.summary}`);
    console.log(executed ? `🎆 Order executed during test!` : `⏳ Order active, waiting for market execution`);
  }, 120000);
});
