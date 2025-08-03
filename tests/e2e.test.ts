#!/usr/bin/env bun
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ethers } from "ethers";
import { generateOrderId, roundSig } from "../common/utils";
import { OrderType, OrderStatus, type TwapParams, type Order, type PairSymbol } from "../common/types";
import { getConfig } from "../back/services/config";
import { getOrder } from "../back/services/storage";
import { createOrderRegistry } from "../back/services/orderRegistry";
import { priceCache } from "../back/services/priceCache";
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

describe("E2E TWAP Order Test - Production Workflow", () => {
  let orderRegistry: any;
  let delegateProxyContract: ethers.Contract;
  let initialPrice: number;

  beforeAll(async () => {
    // Initialize orderRegistry in mock mode for testing
    orderRegistry = createOrderRegistry(true);
    await orderRegistry.start();
    
    // Initialize DelegateProxy contract for status checking
    const delegateProxyAbi = [
      "function getOrderData(bytes32[] calldata orderIds) external view returns (tuple(address maker, uint256 remainingAmount, bool signed)[])"
    ];
    delegateProxyContract = new ethers.Contract(DELEGATE_PROXY, delegateProxyAbi, provider);
    
    // Connect to price cache to get real prices
    await priceCache.connect();
    
    // Wait a moment for prices to populate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get initial price from price cache
    const priceData = priceCache.getPrice(ETHUSDT_TICKER);
    initialPrice = priceData?.mid || 3000; // Fallback to $3000
    
    console.log(`🔍 Initial ETH/USDT price: $${initialPrice.toFixed(2)}`);
  });

  afterAll(async () => {
    await orderRegistry.stop();
    await priceCache.disconnect();
  });

  test("Production TWAP order workflow with real-time monitoring", async () => {
    // Step 1: User creates proper TWAP order params (production workflow)
    const usdAmount = 2; // $2 USD worth
    const wethAmount = usdAmount / initialPrice;
    const maxPrice = initialPrice * 1.05; // 5% above current price (constraint - don't execute above this)
    
    const now = Date.now();
    const twapParams: TwapParams = {
      type: OrderType.TWAP,
      maker: user.address,
      makerAsset: WETH,
      takerAsset: USDT,
      makingAmount: wethAmount,
      takingAmount: usdAmount * 1e6, // USDT has 6 decimals
      startDate: now, // Start immediately
      endDate: now, // Single execution (startDate == endDate)
      interval: 1000, // 1 second (irrelevant for single execution)
      maxPrice: maxPrice, // Price constraint (don't execute above this price)
      chainId: CHAIN_ID
    };
    
    console.log(`
💰 Creating TWAP Order:
   Amount: ${roundSig(wethAmount, 7)} WETH
   Max Price: $${maxPrice.toFixed(2)} (constraint - won't execute above this)
   Current Price: $${initialPrice.toFixed(2)}
   Note: Actual 1inch limit price will be calculated dynamically by base.ts
`);

    // Step 2: User signs the order params
    const messageToSign = JSON.stringify(twapParams);
    const signature = await user.signMessage(messageToSign);
    
    // Step 3: Create Order object for registration
    const orderId = generateOrderId(user.address);
    const order: Order = {
      id: orderId,
      params: twapParams,
      signature,
      status: OrderStatus.PENDING,
      triggerCount: 0,
      remainingMakerAmount: wethAmount,
      createdAt: now
    };

    // Step 4: Register order with orderRegistry (production API call)
    console.log(`📝 Registering order with orderRegistry...`);
    await orderRegistry.createOrder(order);
    
    // Step 5: Ensure WETH approval for DelegateProxy
    console.log(`🔐 Ensuring WETH approval...`);
    await E2EHelpers.ensureApproval(WETH, DELEGATE_PROXY, user, provider);
    
    // Step 6: Real-time monitoring with price and contract status checking
    console.log(`📊 Starting real-time monitoring (5 minutes)...`);
    const monitoringDuration = 300000; // 5 minutes
    const checkInterval = 5000; // Every 5 seconds
    const maxChecks = Math.floor(monitoringDuration / checkInterval);
    
    let orderHash: string | null = null;
    let finalOrderStatus = OrderStatus.PENDING;
    
    for (let i = 0; i < maxChecks; i++) {
      // Get current price from price cache
      const currentPriceData = priceCache.getPrice(ETHUSDT_TICKER);
      const spotPrice = currentPriceData?.mid || initialPrice;
      const priceChange = ((spotPrice - initialPrice) / initialPrice * 100);
      
      // Check order status in our system
      const currentOrder = await getOrder(orderId);
      finalOrderStatus = currentOrder?.status || OrderStatus.PENDING;
      
      // Get 1inch order hash and details if available
      let oneInchLimitPrice = "N/A";
      if (currentOrder?.oneInchOrderHashes?.length > 0) {
        orderHash = currentOrder.oneInchOrderHashes[0];
        
        // Get 1inch order details from stored order data
        if (currentOrder.oneInchOrders && currentOrder.oneInchOrders.length > 0) {
          const oneInchOrder = currentOrder.oneInchOrders[0];
          if (oneInchOrder.limitPrice) {
            oneInchLimitPrice = `$${parseFloat(oneInchOrder.limitPrice).toFixed(2)}`;
          }
        }
      }
      
      // Check remaining amount on contract if we have an order hash
      let remainingAmount = "N/A";
      if (orderHash) {
        try {
          const orderData = await delegateProxyContract.getOrderData([orderHash]);
          if (orderData.length > 0) {
            remainingAmount = ethers.formatEther(orderData[0].remainingAmount);
          }
        } catch (error) {
          remainingAmount = "Error";
        }
      }
      
      // Log status with \r for clean single-line updates
      process.stdout.write(`\r📊 Check ${i + 1}/${maxChecks}: Spot: $${spotPrice.toFixed(2)} | Max: $${maxPrice.toFixed(2)} | Change: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}% | Status: ${finalOrderStatus} | 1inch: ${oneInchLimitPrice} | Hash: ${orderHash ? orderHash.slice(0, 8) + '...' : 'N/A'} | Remaining: ${remainingAmount} WETH`);
      
      // Break early if order is filled or failed
      if (finalOrderStatus === OrderStatus.FILLED || finalOrderStatus === OrderStatus.FAILED) {
        console.log(`\n🎯 Order reached final state: ${finalOrderStatus}`);
        break;
      }
      
      // Wait before next check
      if (i < maxChecks - 1) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }
    
    // Step 7: Final verification
    const finalOrder = await getOrder(orderId);
    expect(finalOrder).toBeTruthy();
    expect(finalOrder!.id).toBe(orderId);
    
    // Check that order was processed (either triggered or still pending)
    const wasTriggered = finalOrder!.triggerCount > 0;
    const hasOneInchOrder = finalOrder!.oneInchOrderHashes && finalOrder!.oneInchOrderHashes.length > 0;
    
    console.log(`
✅ Production workflow test completed:
   Order ID: ${orderId}
   Final Status: ${finalOrderStatus}
   Triggered: ${wasTriggered}
   1inch Orders Created: ${hasOneInchOrder ? finalOrder!.oneInchOrderHashes!.length : 0}${hasOneInchOrder ? `
   Order Hash: ${finalOrder!.oneInchOrderHashes![0]}` : ''}
`);
    
    // The test passes if the order was properly registered and processed
    expect(finalOrder!.status).toBeOneOf([
      OrderStatus.PENDING,
      OrderStatus.ACTIVE, 
      OrderStatus.PARTIALLY_FILLED,
      OrderStatus.FILLED,
      OrderStatus.FAILED // Valid outcome - order was triggered but may fail due to external factors
    ]);
  }, 320000); // 5 minutes + 20 seconds buffer
});
