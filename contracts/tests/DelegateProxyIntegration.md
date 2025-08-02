# DelegateProxy Integration Test Specification

> **Real Integration Tests**: This document outlines how to implement proper integration tests using the deployed DelegateProxy contract on Base mainnet with actual 1inch SDK integration.

## Overview

The current `DelegateProxyIntegration.test.ts` contains mock-based tests that simulate the integration flow. For **true integration testing**, we need to test against:

1. **Deployed DelegateProxy contract** on Base mainnet
2. **Real 1inch Limit Order Protocol** on Base
3. **Actual 1inch SDK** for order submission
4. **Real ERC20 tokens** (WETH, USDC, etc.)

## Test Environment Setup

### Prerequisites

```bash
# Install 1inch SDK
bun add @1inch/limit-order-protocol-sdk

# Environment variables
INTEGRATION_TEST_RPC_URL=https://mainnet.base.org
DEPLOYED_DELEGATE_PROXY=0x... # Actual deployed contract address
TEST_PRIVATE_KEY=0x... # Test account with funds
BASE_CHAIN_ID=8453
```

### Required Contracts (Base Mainnet)

```typescript
const CONTRACTS = {
  DELEGATE_PROXY: "0x...", // Our deployed contract
  LIMIT_ORDER_PROTOCOL: "0x...", // 1inch LOP on Base
  WETH: "0x4200000000000000000000000000000000000006", // Base WETH
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
};
```

## Integration Test Implementation

### Test Structure

```typescript
describe("DelegateProxy Integration Tests (Base Mainnet)", function () {
  let provider: ethers.Provider;
  let wallet: ethers.Wallet;
  let delegateProxy: DelegateProxy;
  let limitOrderSDK: LimitOrderProtocolSDK;
  
  before(async function () {
    // Setup real network connection
    provider = new ethers.JsonRpcProvider(process.env.INTEGRATION_TEST_RPC_URL);
    wallet = new ethers.Wallet(process.env.TEST_PRIVATE_KEY!, provider);
    
    // Connect to deployed contracts
    delegateProxy = DelegateProxy__factory.connect(
      CONTRACTS.DELEGATE_PROXY,
      wallet
    );
    
    // Initialize 1inch SDK
    limitOrderSDK = new LimitOrderProtocolSDK(
      BASE_CHAIN_ID,
      provider
    );
  });
```

### Test Cases

#### 1. End-to-End Order Flow

```typescript
it("Should execute complete order flow with 1inch SDK", async function () {
  // 1. Create order using 1inch SDK
  const order = limitOrderSDK.buildLimitOrder({
    makerAsset: CONTRACTS.WETH,
    takerAsset: CONTRACTS.USDC,
    makingAmount: ethers.parseEther("0.1"), // 0.1 WETH
    takingAmount: ethers.parseUnits("250", 6), // 250 USDC
    maker: CONTRACTS.DELEGATE_PROXY, // Our proxy as maker
    receiver: wallet.address,
    // Enable pre/post interaction
    makerTraits: (1n << 252n) | (1n << 251n),
  });

  // 2. Create order via DelegateProxy
  await delegateProxy.create1inchOrder(order, wallet.address);

  // 3. Submit to 1inch API
  const signature = await delegateProxy.getInterface().encodeFunctionResult(
    "isValidSignature",
    ["0x1626ba7e"]
  );

  const submitResponse = await fetch("https://api.1inch.dev/orderbook/v4.0/8453/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...order,
      signature,
    }),
  });

  expect(submitResponse.ok).to.be.true;

  // 4. Monitor order status
  const orderHash = limitOrderSDK.getOrderHash(order);
  const orderData = await delegateProxy.getOrderData([orderHash]);
  expect(orderData[0].signed).to.be.true;
});
```

#### 2. Partial Fill Handling

```typescript
it("Should handle partial fills from real market", async function () {
  // Create large order that's likely to be partially filled
  const order = limitOrderSDK.buildLimitOrder({
    makerAsset: CONTRACTS.WETH,
    takerAsset: CONTRACTS.USDC,
    makingAmount: ethers.parseEther("10"), // Large order
    takingAmount: ethers.parseUnits("25000", 6),
    maker: CONTRACTS.DELEGATE_PROXY,
    receiver: wallet.address,
    makerTraits: (1n << 252n) | (1n << 251n),
  });

  await delegateProxy.create1inchOrder(order, wallet.address);

  // Submit to 1inch
  // ... order submission logic

  // Monitor for partial fills
  const orderHash = limitOrderSDK.getOrderHash(order);
  
  // Poll for changes (in real test, use event listening)
  let previousAmount = ethers.parseEther("10");
  const pollForFill = async () => {
    const data = await delegateProxy.getOrderData([orderHash]);
    if (data[0].remainingAmount < previousAmount) {
      console.log(`Partial fill detected: ${ethers.formatEther(data[0].remainingAmount)} remaining`);
      return true;
    }
    return false;
  };

  // Wait for fill or timeout
  await waitForCondition(pollForFill, 300000); // 5 min timeout
});
```

#### 3. Gas Cost Analysis

```typescript
it("Should measure real gas costs on Base", async function () {
  const orders = [];
  const makers = [];

  // Create batch of real orders
  for (let i = 0; i < 5; i++) {
    orders.push(limitOrderSDK.buildLimitOrder({
      makerAsset: CONTRACTS.WETH,
      takerAsset: CONTRACTS.USDC,
      makingAmount: ethers.parseEther("0.1"),
      takingAmount: ethers.parseUnits("250", 6),
      maker: CONTRACTS.DELEGATE_PROXY,
      receiver: wallet.address,
      salt: BigInt(Date.now() + i),
    }));
    makers.push(wallet.address);
  }

  // Measure batch creation gas
  const tx = await delegateProxy.create1inchOrderBatch(orders, makers);
  const receipt = await tx.wait();

  console.log(`Real Base network gas used: ${receipt!.gasUsed}`);
  console.log(`Gas price: ${tx.gasPrice} gwei`);
  console.log(`Total cost: ${ethers.formatEther(receipt!.gasUsed * tx.gasPrice!)} ETH`);

  // Verify reasonable gas usage
  expect(receipt!.gasUsed).to.be.lessThan(1000000n);
});
```

#### 4. Market Maker Integration

```typescript
it("Should integrate with real market makers", async function () {
  // Create competitive order
  const marketPrice = await get1inchQuote(CONTRACTS.WETH, CONTRACTS.USDC, "1");
  const competitivePrice = marketPrice * 0.999; // 0.1% better than market

  const order = limitOrderSDK.buildLimitOrder({
    makerAsset: CONTRACTS.WETH,
    takerAsset: CONTRACTS.USDC,
    makingAmount: ethers.parseEther("1"),
    takingAmount: ethers.parseUnits(competitivePrice.toString(), 6),
    maker: CONTRACTS.DELEGATE_PROXY,
    receiver: wallet.address,
    deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  });

  await delegateProxy.create1inchOrder(order, wallet.address);

  // Submit to 1inch orderbook
  // Monitor for execution
  // Verify pre/post interaction hooks work correctly
});
```

## Implementation Steps

### Phase 1: Setup & Basic Tests
1. **Deploy DelegateProxy** to Base mainnet (testnet first)
2. **Configure test environment** with real RPC endpoints
3. **Implement basic order creation** and submission tests
4. **Verify contract interactions** work with real 1inch protocol

### Phase 2: Advanced Integration
1. **Add market monitoring** for order fills
2. **Implement event listening** for real-time updates
3. **Test edge cases** (failed orders, expired orders, etc.)
4. **Performance testing** under real network conditions

### Phase 3: Production Validation
1. **Load testing** with multiple concurrent orders
2. **Gas optimization** validation on mainnet
3. **Error handling** for network failures
4. **Integration with 1edge backend** services

## Test Data Requirements

### Minimum Test Account Setup
- **ETH Balance**: 0.1 ETH (for gas)
- **WETH Balance**: 10 WETH (for order creation)
- **USDC Balance**: 10,000 USDC (for reverse orders)

### Test Scenarios Coverage
- ✅ **Single order creation and submission**
- ✅ **Batch order operations**
- ✅ **Partial fill handling**
- ✅ **Order cancellation**
- ✅ **Gas cost optimization**
- ✅ **Error conditions**
- ✅ **Event monitoring**
- ✅ **Real market integration**

## Continuous Integration

### Scheduled Tests
```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests
on:
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours
  workflow_dispatch:

jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Integration Tests
        env:
          BASE_RPC_URL: ${{ secrets.BASE_RPC_URL }}
          TEST_PRIVATE_KEY: ${{ secrets.TEST_PRIVATE_KEY }}
        run: |
          bun test:integration
```

### Monitoring & Alerts
- **Order fill rates** tracking
- **Gas cost** trend monitoring  
- **Failed transaction** alerting
- **Network latency** measurements

---

## Current Status: Mock Tests → Real Integration

| Component | Mock Tests | Real Integration | Status |
|-----------|------------|------------------|---------|
| Order Creation | ✅ | ❌ | **Need to implement** |
| 1inch SDK | ❌ | ❌ | **Need to implement** |
| Partial Fills | ✅ | ❌ | **Need to implement** |
| Gas Costs | ✅ | ❌ | **Need to implement** |
| Market Integration | ❌ | ❌ | **Need to implement** |

**Next Step**: Deploy DelegateProxy to Base testnet and implement the first real integration test.
