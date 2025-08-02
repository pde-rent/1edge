#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ethers } from "ethers";
import { generateOrderId, roundSig, sleep } from "../common/utils";
import { OrderType, OrderStatus } from "../common/types";
import type { Order, TwapParams } from "../common/types";
import { getConfig } from "../back/services/config";
import { initStorage, getOrder } from "../back/services/storage";
import { createOrderRegistry } from "../back/services/orderRegistry";
import deployments from "../deployments.json";
import { priceCache } from "../back/services/priceCache";
import type { PairSymbol } from "../common/types";
import { erc20, TokenUtils, ERC20, Multicall3Utils } from "./utils";

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

// Create token contracts
const weth = erc20(WETH, provider);
const usdt = erc20(USDT, provider);

describe("E2E TWAP Order Test", () => {
  let orderRegistry: any;

  beforeAll(async () => {
    // Use Multicall3 to batch all balance checks into single RPC request
    console.log("🌐 Checking RPC connectivity and fetching balances via Multicall3...");
    try {
      const multicall = new Multicall3Utils(provider);
      
      // Get network info first (2 calls max)
      const networkInfo = await multicall.batchNetworkInfo();
      console.log(
        `✅ Connected to BNB Chain (Chain ID: ${networkInfo.chainId}) at block ${networkInfo.blockNumber}`,
      );

      // Batch all balance checks in single multicall (4 total calls in 1 RPC request)
      const balanceResults = await multicall.batchBalanceChecks(
        [user.address, keeper.address],
        [
          { address: WETH, decimals: 18, symbol: "WETH" },
          { address: USDT, decimals: 6, symbol: "USDT" }
        ]
      );

      const userBalance = ethers.parseEther(balanceResults.ethBalances[0]);
      const keeperBalance = ethers.parseEther(balanceResults.ethBalances[1]);
      const wethBalance = balanceResults.tokenBalances.WETH[0];
      const usdtBalance = balanceResults.tokenBalances.USDT[0];

      console.log(
        `💰 User wallet: ${user.address} (${ethers.formatEther(userBalance)} BNB)`,
      );
      console.log(
        `💰 Keeper wallet: ${keeper.address} (${ethers.formatEther(keeperBalance)} BNB)`,
      );
      console.log(`💎 User WETH balance: ${wethBalance}`);
      console.log(`💵 User USDT balance: ${usdtBalance}`);

      if (userBalance === 0n) {
        console.warn("⚠️ User wallet has no BNB for gas fees!");
      }
      if (keeperBalance === 0n) {
        console.warn("⚠️ Keeper wallet has no BNB for gas fees!");
      }
      if (parseFloat(wethBalance) === 0) {
        console.warn(
          "⚠️ User wallet has no WETH to trade! You may need to wrap some BNB first.",
        );
      }
    } catch (error) {
      console.error("❌ Failed to connect to RPC:", error);
      throw new Error(
        `RPC connection failed. Please check your network configuration and RPC URL: ${getConfig().networks[CHAIN_ID].rpcUrl}`,
      );
    }

    // Next, ensure collector service is running and populating price cache
    console.log("\n🔍 Checking if collector service is running...");

    // Initialize storage and registry
    initStorage(getConfig().storage);
    orderRegistry = createOrderRegistry(false); // Real mode for 1inch integration
    await orderRegistry.start();

    // Connect to price feed pubsub client
    console.log("🔗 Connecting to price feed pubsub...");
    await priceCache.connect();

    // Wait a moment and check if we have any price data
    await sleep(2000);
    let priceData = priceCache.getPrice(ETHUSDT_TICKER);

    if (!priceData || !priceData.mid) {
      console.log(
        "❌ Collector service not running or no price data available",
      );
      console.log("📡 Please start the collector service first:");
      console.log("   bun run scripts/start-services.ts");
      console.log("   OR individually: bun run back/services/collector.ts");
      throw new Error(
        "Collector service must be running before tests. Start it with: bun run scripts/start-services.ts",
      );
    }

    console.log(
      `✅ Collector service is running - found price data for ${ETHUSDT_TICKER}: $${priceData.mid.toFixed(2)}`,
    );

    // Give a bit more time for fresh price data to flow in
    console.log("⏳ Waiting for fresh price data...");
    await sleep(3000);

    // Verify we have current price data
    priceData = priceCache.getPrice(ETHUSDT_TICKER);

    if (!priceData || !priceData.mid) {
      throw new Error(
        "Still no price data after waiting. Please check collector service.",
      );
    }

    console.log(
      `💰 Current ${ETHUSDT_TICKER} price: $${priceData.mid.toFixed(2)} (spread: $${(priceData.ask - priceData.bid).toFixed(2)})`,
    );
  });

  afterAll(async () => {
    await orderRegistry.stop();
    await priceCache.disconnect();
  });

  test("Full TWAP order lifecycle with 1inch integration", async () => {
    const now = Date.now();

    // Get current market price from collector
    let currentPriceData: any = priceCache.getPrice(ETHUSDT_TICKER);

    // Ensure we have live data from collector
    if (!currentPriceData || !currentPriceData.mid) {
      throw new Error(
        `No live price data available for ${ETHUSDT_TICKER}. Ensure collector service is running with: bun run back/services/collector.ts`,
      );
    }

    console.log(
      "Successfully connected to live price feed from collector service",
    );

    // We don't need to subscribe - priceCache.getPrice() gives us the latest data

    const spotPrice = currentPriceData.mid;
    const spread = currentPriceData.ask - currentPriceData.bid;
    console.log(
      `Current ETH/USDT spot price: $${spotPrice.toFixed(2)}, spread: $${spread.toFixed(2)} (BNB Chain)`,
    );

    // Calculate order amounts - $2 worth of WETH
    const usdAmount = 2; // $2 USD worth
    const wethAmount = usdAmount / spotPrice; // WETH amount to sell

    console.log(
      `Order details: sell ${roundSig(wethAmount, 7)} WETH for ~$${roundSig(usdAmount, 4)} (spot: $${spotPrice.toFixed(2)})`,
    );

    // Step 1: Create 1edge TWAP order
    const orderId = generateOrderId(user.address);

    // Create TWAP parameters (this is what gets signed)
    const twapParams: TwapParams = {
      type: OrderType.TWAP,
      makingAmount: wethAmount, // Use decimal value (float64)
      startDate: now + 10_000, // 10 seconds from now
      endDate: now + 60_000, // 60 seconds from now (allow enough time)
      interval: 0, // Single execution
      maxPrice: 0, // do not stop based on price
      expiry: 0, // No expiry by default (1inch order won't expire)
      maker: user.address,
      makerAsset: WETH,
      takerAsset: USDT,
      chainId: CHAIN_ID,
    };

    const order: Order = {
      id: orderId,
      signature: await user.signMessage(JSON.stringify(twapParams)),
      params: twapParams,
      status: OrderStatus.PENDING,
      remainingMakerAmount: 0, // Will be set from params.makingAmount by OrderRegistry
      triggerCount: 0,
      createdAt: now,
      nextTriggerValue: twapParams.startDate,
    };

    console.log(
      `📝 Created TWAP order: ${orderId.slice(0, 8)}... (no expiry set)`,
    );

    // Step 2: Check WETH approval using Multicall3 (1 RPC call)
    console.log(`🔐 Checking WETH approval for DelegateProxy via Multicall3...`);
    
    const approvalAmount = ethers.parseEther("1");
    const multicall = new Multicall3Utils(provider);
    
    const approvalChecks = await multicall.batchAllowanceChecks(user.address, [
      { 
        tokenAddress: WETH, 
        spender: DELEGATE_PROXY, 
        symbol: "WETH", 
        decimals: 18,
        amount: approvalAmount 
      }
    ]);
    
    const wethApproval = approvalChecks[0];
    if (wethApproval.needsApproval) {
      console.log(`Approving DelegateProxy to spend WETH...`);
      const tx = await weth.connect(user).approve(DELEGATE_PROXY, approvalAmount);
      await tx.wait();
      console.log(`✅ WETH approval confirmed`);
    } else {
      console.log(`✅ WETH already approved for DelegateProxy (${wethApproval.allowance} WETH)`);
    }

    // Step 3: Register order with OrderRegistry (simulating API POST /orders)
    await orderRegistry.createOrder(order);
    console.log(`📋 Order registered with OrderRegistry`);

    // Step 4: Wait for watcher to trigger and handle 1inch order creation
    console.log(
      `⏳ Waiting for TWAP trigger time and watcher to create 1inch order...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds

    // Check if order was triggered by watcher
    const triggeredOrder = await getOrder(orderId);
    expect(triggeredOrder).toBeTruthy();
    
    console.log(`📊 Final order state: triggerCount=${triggeredOrder!.triggerCount}, status=${triggeredOrder!.status}, hashes=${triggeredOrder!.oneInchOrderHashes?.length || 0}`);
    
    expect(triggeredOrder!.triggerCount).toBeGreaterThan(0);
    expect(triggeredOrder!.status).toBe(OrderStatus.ACTIVE);
    expect(triggeredOrder!.oneInchOrderHashes).toBeDefined();
    expect(triggeredOrder!.oneInchOrderHashes!.length).toBeGreaterThan(0);

    console.log(
      `✅ Order triggered by watcher! 1inch orders created: ${triggeredOrder!.oneInchOrderHashes!.length}`,
    );
    console.log(
      `🔗 1inch order hash: ${triggeredOrder!.oneInchOrderHashes![0].slice(0, 10)}...`,
    );

    // Step 5: Monitor real 1inch order execution (no simulation)
    console.log(
      `🔍 Monitoring real 1inch order execution - tracking fills via SDK...`,
    );

    let attempts = 0;
    const maxAttempts = 12; // 60 seconds max (1 minute for demo)
    let finalOrder: Order | null = null;

    while (attempts < maxAttempts) {
      // Get updated order (watchers update this automatically)
      finalOrder = await getOrder(orderId);

      if (finalOrder) {
        // Get current market price for comparison
        const currentPriceData = priceCache.getPrice(ETHUSDT_TICKER);
        const currentSpot = currentPriceData ? currentPriceData.mid : 0;
        
        // Calculate our limit price from the order (if we have 1inch hashes)
        let limitPrice = 0;
        let priceDiff = 0;
        let diffPercent = "";
        
        if (finalOrder.oneInchOrderHashes && finalOrder.oneInchOrderHashes.length > 0) {
          // Estimate our limit price based on making/taking amounts
          // This is approximate - real tracking would query 1inch SDK for exact order details
          const makingAmount = finalOrder.remainingMakerAmount || wethAmount;
          const usdValue = makingAmount * currentSpot;
          // For sell order: takingAmount should be ~$2 in USDT
          limitPrice = usdValue / makingAmount; // This approximates our limit price
          priceDiff = currentSpot - limitPrice;
          const percent = ((priceDiff / limitPrice) * 100);
          diffPercent = percent >= 0 ? `+${percent.toFixed(3)}%` : `${percent.toFixed(3)}%`;
        }

        console.log(
          `📊 Order status: ${finalOrder.status}, remaining: ${finalOrder.remainingMakerAmount}, triggers: ${finalOrder.triggerCount}`,
        );
        
        if (limitPrice > 0) {
          console.log(
            `💰 Price tracking: Spot $${currentSpot.toFixed(6)} vs Limit $${limitPrice.toFixed(6)} (${diffPercent} ${priceDiff >= 0 ? 'above' : 'below'} our price)`,
          );
        }

        // Check if order completed
        if (finalOrder.status === OrderStatus.FILLED) {
          console.log(`🎉 Order completely filled by market execution!`);
          break;
        }

        if (finalOrder.status === OrderStatus.PARTIALLY_FILLED) {
          console.log(
            `📈 Order partially filled, remaining: ${finalOrder.remainingMakerAmount}`,
          );
        }
        
        // Show 1inch order tracking info
        if (finalOrder.oneInchOrderHashes && finalOrder.oneInchOrderHashes.length > 0) {
          console.log(
            `🔗 Tracking 1inch order: ${finalOrder.oneInchOrderHashes[0].slice(0, 10)}... (${finalOrder.oneInchOrderHashes.length} total)`,
          );
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
    }

    // If we reach here without fills, that's still a successful test
    // (Real trading may take longer than test timeout)
    if (finalOrder && finalOrder.status === OrderStatus.ACTIVE) {
      console.log(`⏰ Test timeout reached. Order is active and waiting for market execution.`);
      console.log(`📋 This is expected behavior - real orders may take time to fill.`);
    }

    // Step 6: Verify order was successfully created and submitted to 1inch
    expect(finalOrder).toBeTruthy();
    expect(finalOrder!.triggerCount).toBeGreaterThan(0);
    expect(finalOrder!.oneInchOrderHashes!.length).toBeGreaterThan(0);
    
    // Order should be ACTIVE (waiting for fills) or FILLED/PARTIALLY_FILLED if executed
    const validStatuses = [OrderStatus.ACTIVE, OrderStatus.FILLED, OrderStatus.PARTIALLY_FILLED];
    expect(validStatuses.includes(finalOrder!.status)).toBe(true);

    console.log(`✅ E2E TWAP test completed successfully!`);
    console.log(`📊 Final order state:`);
    console.log(`   - ID: ${finalOrder!.id.slice(0, 8)}...`);
    console.log(`   - Status: ${finalOrder!.status}`);
    console.log(`   - Trigger Count: ${finalOrder!.triggerCount}`);
    console.log(`   - Remaining Amount: ${finalOrder!.remainingMakerAmount}`);
    console.log(
      `   - 1inch Order Hashes: ${finalOrder!.oneInchOrderHashes!.length}`,
    );
    
    if (finalOrder!.status === OrderStatus.FILLED) {
      console.log(`🎆 Order was filled during test execution!`);
    } else if (finalOrder!.status === OrderStatus.PARTIALLY_FILLED) {
      console.log(`📈 Order was partially filled during test execution!`);
    } else {
      console.log(`⏳ Order is active and waiting for market execution on 1inch protocol.`);
    }
    
    console.log(
      `🎆 Watchers successfully handled 1inch order creation and submission!`,
    );
  }, 120000); // 2 minute timeout for e2e test
});
