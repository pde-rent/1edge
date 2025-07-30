/**
 * 📝 Comprehensive Limit Order Examples
 *
 * This example demonstrates the core functionality of creating, signing, and executing
 * limit orders using the 1inch Limit Order Protocol SDK.
 *
 * 📚 Related Documentation:
 * - Order Creation Guide: ../Limit Order SDK/integration.md
 * - SDK Installation: ../Limit Order SDK/install.md
 * - Maker Contract: ../limit-order-maker-contract.md
 * - Taker Contract: ../limit-order-taker-contract.md
 *
 * 🎯 Key Features:
 * - Standard limit order creation and execution
 * - EIP-712 signature generation and validation
 * - Maker traits configuration
 * - Taker traits and threshold management
 * - Gas-optimized order filling patterns
 */

import { expect } from "@1inch/solidity-utils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, HardhatEthersSigner } from "hardhat";
import { deploySwapTokens } from "./helpers/fixtures";
import { ether } from "./helpers/utils";
import {
  signOrder,
  buildOrder,
  buildMakerTraits,
  buildTakerTraits,
} from "./helpers/orderUtils";

// 📝 Type definitions for limit order testing
interface TestTokens {
  dai: any; // ERC20 DAI token contract
  weth: any; // WETH token contract
}

interface TestContracts {
  swap: any; // LimitOrderProtocol contract
}

interface LimitOrderTestFixture {
  tokens: TestTokens;
  contracts: TestContracts;
  chainId: number;
  accounts: {
    maker: HardhatEthersSigner;
    taker: HardhatEthersSigner;
  };
}

interface OrderParamsuration {
  makerAsset: string;
  takerAsset: string;
  makingAmount: bigint;
  takingAmount: bigint;
  maker: string;
  makerTraits?: any;
}

interface BalanceSnapshot {
  makerDai: bigint;
  takerDai: bigint;
  makerWeth: bigint;
  takerWeth: bigint;
}

describe("📝 Limit Order Protocol Integration", function () {
  let maker: HardhatEthersSigner;
  let taker: HardhatEthersSigner;
  let resolver: HardhatEthersSigner;

  before(async function () {
    // Skip deployer account, use subsequent accounts for testing
    [, maker, taker, resolver] = await ethers.getSigners();
  });

  /**
   * 🏗️ Deploy contracts and initialize testing environment
   *
   * Sets up:
   * - DAI and WETH test tokens with substantial balances
   * - LimitOrderProtocol swap contract
   * - Token approvals for seamless trading
   * - Account configuration for different roles
   */
  async function deployAndInitialize(): Promise<LimitOrderTestFixture> {
    const { dai, weth, swap, chainId } = await deploySwapTokens();

    // 💰 Mint substantial balances for comprehensive testing
    const daiAmount = ether("1000000"); // 1M DAI
    const wethAmount = ether("100"); // 100 WETH

    // 🏭 Distribute tokens to test accounts
    await dai.mint(maker.address, daiAmount);
    await dai.mint(taker.address, daiAmount);
    await weth.connect(maker).deposit({ value: wethAmount });
    await weth.connect(taker).deposit({ value: wethAmount });

    // ✅ Approve tokens for trading
    await dai.connect(maker).approve(swap.address, daiAmount);
    await dai.connect(taker).approve(swap.address, daiAmount);
    await weth.connect(maker).approve(swap.address, wethAmount);
    await weth.connect(taker).approve(swap.address, wethAmount);

    return {
      tokens: { dai, weth },
      contracts: { swap },
      chainId,
      accounts: { maker, taker },
    };
  }

  /**
   * 📊 Capture current token balances for verification
   */
  async function captureBalances(tokens: TestTokens): Promise<BalanceSnapshot> {
    return {
      makerDai: await tokens.dai.balanceOf(maker.address),
      takerDai: await tokens.dai.balanceOf(taker.address),
      makerWeth: await tokens.weth.balanceOf(maker.address),
      takerWeth: await tokens.weth.balanceOf(taker.address),
    };
  }

  /**
   * 🎯 Test: Basic Limit Order Creation and Execution
   *
   * Scenario:
   * - Maker creates order to sell 100 DAI for 0.1 WETH
   * - Taker fills the entire order
   * - Verify tokens are exchanged correctly
   *
   * 💡 Use Case:
   * Standard peer-to-peer token exchange at predetermined price
   */
  it("🎯 Execute basic limit order (DAI → WETH)", async function () {
    const { tokens, contracts, chainId } =
      await loadFixture(deployAndInitialize);
    const { dai, weth } = tokens;
    const { swap } = contracts;

    // 📝 Define order parameters
    const orderConfig: OrderParamsuration = {
      makerAsset: await dai.getAddress(),
      takerAsset: await weth.getAddress(),
      makingAmount: ether("100"), // Maker offers 100 DAI
      takingAmount: ether("0.1"), // Wants 0.1 WETH in return
      maker: maker.address,
    };

    // 🏗️ Build the limit order
    const order = buildOrder(orderConfig);

    // ✍️ Generate EIP-712 signature
    const signature = await signOrder(
      order,
      chainId,
      await swap.getAddress(),
      maker,
    );

    // 📊 Capture balances before execution
    const balancesBefore = await captureBalances(tokens);

    // 🎛️ Configure taker execution parameters
    const { r, yParityAndS: vs } = ethers.Signature.from(signature);
    const takerTraits = buildTakerTraits({
      threshold: orderConfig.takingAmount, // Maximum price taker will pay
      makingAmount: true, // Use making amount mode
    });

    // 🚀 Execute the order fill
    await swap.connect(taker).fillOrderArgs(
      order,
      r,
      vs,
      orderConfig.makingAmount, // Fill entire making amount
      takerTraits.traits,
      takerTraits.args,
    );

    // ✅ Verify token transfers
    expect(await dai.balanceOf(maker.address)).to.equal(
      balancesBefore.makerDai - orderConfig.makingAmount,
    );
    expect(await dai.balanceOf(taker.address)).to.equal(
      balancesBefore.takerDai + orderConfig.makingAmount,
    );
    expect(await weth.balanceOf(maker.address)).to.equal(
      balancesBefore.makerWeth + orderConfig.takingAmount,
    );
    expect(await weth.balanceOf(taker.address)).to.equal(
      balancesBefore.takerWeth - orderConfig.takingAmount,
    );
  });

  /**
   * 🔄 Test: Partial Order Fill
   *
   * Scenario:
   * - Maker creates order for 200 DAI → 0.2 WETH
   * - Taker fills only 50% of the order (100 DAI → 0.1 WETH)
   * - Verify proportional amounts are transferred
   *
   * 💡 Use Case:
   * Large orders that can be filled incrementally by multiple takers
   */
  it("🔄 Execute partial limit order fill", async function () {
    const { tokens, contracts, chainId } =
      await loadFixture(deployAndInitialize);
    const { dai, weth } = tokens;
    const { swap } = contracts;

    // 📝 Create larger order for partial filling
    const orderConfig: OrderParamsuration = {
      makerAsset: await dai.getAddress(),
      takerAsset: await weth.getAddress(),
      makingAmount: ether("200"), // Total: 200 DAI
      takingAmount: ether("0.2"), // Total: 0.2 WETH
      maker: maker.address,
      makerTraits: buildMakerTraits(), // Allow partial fills (default)
    };

    const order = buildOrder(orderConfig);
    const signature = await signOrder(
      order,
      chainId,
      await swap.getAddress(),
      maker,
    );
    const balancesBefore = await captureBalances(tokens);

    // 🎯 Fill exactly 50% of the order
    const partialFillAmount = orderConfig.makingAmount / 2n; // 100 DAI
    const expectedTakingAmount = orderConfig.takingAmount / 2n; // 0.1 WETH

    const { r, yParityAndS: vs } = ethers.Signature.from(signature);
    const takerTraits = buildTakerTraits({
      threshold: expectedTakingAmount,
      makingAmount: true,
    });

    await swap
      .connect(taker)
      .fillOrderArgs(
        order,
        r,
        vs,
        partialFillAmount,
        takerTraits.traits,
        takerTraits.args,
      );

    // ✅ Verify proportional transfers
    expect(await dai.balanceOf(maker.address)).to.equal(
      balancesBefore.makerDai - partialFillAmount,
    );
    expect(await dai.balanceOf(taker.address)).to.equal(
      balancesBefore.takerDai + partialFillAmount,
    );
    expect(await weth.balanceOf(maker.address)).to.equal(
      balancesBefore.makerWeth + expectedTakingAmount,
    );
    expect(await weth.balanceOf(taker.address)).to.equal(
      balancesBefore.takerWeth - expectedTakingAmount,
    );
  });

  /**
   * 🔁 Test: Multiple Fills of Same Order
   *
   * Scenario:
   * - Maker creates order allowing multiple fills
   * - Execute two separate fills of the same order
   * - Verify both fills succeed and track cumulative amounts
   *
   * 💡 Use Case:
   * Market maker orders that remain active after partial fills
   */
  it("🔁 Execute multiple fills of the same order", async function () {
    const { tokens, contracts, chainId } =
      await loadFixture(deployAndInitialize);
    const { dai, weth } = tokens;
    const { swap } = contracts;

    // 📝 Create order with multiple fills enabled
    const orderConfig: OrderParamsuration = {
      makerAsset: await dai.getAddress(),
      takerAsset: await weth.getAddress(),
      makingAmount: ether("300"),
      takingAmount: ether("0.3"),
      maker: maker.address,
      makerTraits: buildMakerTraits({
        allowMultipleFills: true, // Enable multiple fills
        nonce: 42, // Specific nonce for tracking
      }),
    };

    const order = buildOrder(orderConfig);
    const signature = await signOrder(
      order,
      chainId,
      await swap.getAddress(),
      maker,
    );
    const initialBalances = await captureBalances(tokens);

    const { r, yParityAndS: vs } = ethers.Signature.from(signature);

    // 🚀 First fill: 100 DAI
    const firstFillAmount = ether("100");
    const firstExpectedTaking = ether("0.1");

    const firstTraits = buildTakerTraits({
      threshold: firstExpectedTaking,
      makingAmount: true,
    });

    await swap
      .connect(taker)
      .fillOrderArgs(
        order,
        r,
        vs,
        firstFillAmount,
        firstTraits.traits,
        firstTraits.args,
      );

    // 📊 Check balances after first fill
    const balancesAfterFirst = await captureBalances(tokens);

    expect(balancesAfterFirst.makerDai).to.equal(
      initialBalances.makerDai - firstFillAmount,
    );
    expect(balancesAfterFirst.makerWeth).to.equal(
      initialBalances.makerWeth + firstExpectedTaking,
    );

    // 🚀 Second fill: 150 DAI
    const secondFillAmount = ether("150");
    const secondExpectedTaking = ether("0.15");

    const secondTraits = buildTakerTraits({
      threshold: secondExpectedTaking,
      makingAmount: true,
    });

    await swap
      .connect(taker)
      .fillOrderArgs(
        order,
        r,
        vs,
        secondFillAmount,
        secondTraits.traits,
        secondTraits.args,
      );

    // ✅ Verify cumulative results
    const finalBalances = await captureBalances(tokens);
    const totalMakingFilled = firstFillAmount + secondFillAmount;
    const totalTakingFilled = firstExpectedTaking + secondExpectedTaking;

    expect(finalBalances.makerDai).to.equal(
      initialBalances.makerDai - totalMakingFilled,
    );
    expect(finalBalances.takerDai).to.equal(
      initialBalances.takerDai + totalMakingFilled,
    );
    expect(finalBalances.makerWeth).to.equal(
      initialBalances.makerWeth + totalTakingFilled,
    );
    expect(finalBalances.takerWeth).to.equal(
      initialBalances.takerWeth - totalTakingFilled,
    );
  });

  /**
   * ⏰ Test: Order with Expiration
   *
   * Scenario:
   * - Create order with near-future expiration
   * - Execute order before expiration (should succeed)
   * - Demonstrate time-based order management
   *
   * 💡 Use Case:
   * Time-sensitive trading strategies and risk management
   */
  it("⏰ Execute order with expiration constraint", async function () {
    const { tokens, contracts, chainId } =
      await loadFixture(deployAndInitialize);
    const { dai, weth } = tokens;
    const { swap } = contracts;

    // ⏰ Set expiration for 1 hour from now
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = currentTime + 3600; // 1 hour

    const orderConfig: OrderParamsuration = {
      makerAsset: await dai.getAddress(),
      takerAsset: await weth.getAddress(),
      makingAmount: ether("100"),
      takingAmount: ether("0.1"),
      maker: maker.address,
      makerTraits: buildMakerTraits({
        expiration: BigInt(expirationTime),
        nonce: 123,
      }),
    };

    const order = buildOrder(orderConfig);
    const signature = await signOrder(
      order,
      chainId,
      await swap.getAddress(),
      maker,
    );
    const balancesBefore = await captureBalances(tokens);

    // 🚀 Execute order before expiration
    const { r, yParityAndS: vs } = ethers.Signature.from(signature);
    const takerTraits = buildTakerTraits({
      threshold: orderConfig.takingAmount,
      makingAmount: true,
    });

    await swap
      .connect(taker)
      .fillOrderArgs(
        order,
        r,
        vs,
        orderConfig.makingAmount,
        takerTraits.traits,
        takerTraits.args,
      );

    // ✅ Verify successful execution before expiration
    expect(await dai.balanceOf(maker.address)).to.equal(
      balancesBefore.makerDai - orderConfig.makingAmount,
    );
    expect(await weth.balanceOf(maker.address)).to.equal(
      balancesBefore.makerWeth + orderConfig.takingAmount,
    );
  });

  /**
   * 🔒 Test: Private Order (Restricted Taker)
   *
   * Scenario:
   * - Create order restricted to specific taker address
   * - Authorized taker fills order successfully
   * - Demonstrate access control mechanisms
   *
   * 💡 Use Case:
   * OTC trades, institutional orders, or partnership-specific exchanges
   */
  it("🔒 Execute private order with restricted taker", async function () {
    const { tokens, contracts, chainId } =
      await loadFixture(deployAndInitialize);
    const { dai, weth } = tokens;
    const { swap } = contracts;

    // 🎯 Create order restricted to specific taker
    const authorizedTaker = resolver.address; // Use resolver as authorized taker

    const orderConfig: OrderParamsuration = {
      makerAsset: await dai.getAddress(),
      takerAsset: await weth.getAddress(),
      makingAmount: ether("100"),
      takingAmount: ether("0.1"),
      maker: maker.address,
      makerTraits: buildMakerTraits({
        allowedSender: authorizedTaker, // Restrict to specific address
        nonce: 456,
      }),
    };

    const order = buildOrder(orderConfig);
    const signature = await signOrder(
      order,
      chainId,
      await swap.getAddress(),
      maker,
    );

    // 💰 Give resolver some WETH for the trade
    await weth.connect(resolver).deposit({ value: ether("1") });
    await weth.connect(resolver).approve(swap.address, ether("1"));

    const balancesBefore = {
      makerDai: await dai.balanceOf(maker.address),
      resolverDai: await dai.balanceOf(resolver.address),
      makerWeth: await weth.balanceOf(maker.address),
      resolverWeth: await weth.balanceOf(resolver.address),
    };

    // 🚀 Execute order with authorized taker
    const { r, yParityAndS: vs } = ethers.Signature.from(signature);
    const takerTraits = buildTakerTraits({
      threshold: orderConfig.takingAmount,
      makingAmount: true,
    });

    await swap
      .connect(resolver)
      .fillOrderArgs(
        order,
        r,
        vs,
        orderConfig.makingAmount,
        takerTraits.traits,
        takerTraits.args,
      );

    // ✅ Verify authorized execution
    expect(await dai.balanceOf(maker.address)).to.equal(
      balancesBefore.makerDai - orderConfig.makingAmount,
    );
    expect(await dai.balanceOf(resolver.address)).to.equal(
      balancesBefore.resolverDai + orderConfig.makingAmount,
    );
    expect(await weth.balanceOf(maker.address)).to.equal(
      balancesBefore.makerWeth + orderConfig.takingAmount,
    );
    expect(await weth.balanceOf(resolver.address)).to.equal(
      balancesBefore.resolverWeth - orderConfig.takingAmount,
    );
  });

  /**
   * 🚫 Test: All-or-Nothing Order
   *
   * Scenario:
   * - Create order that disables partial fills
   * - Attempt partial fill (should succeed as full amount)
   * - Demonstrate fill mode restrictions
   *
   * 💡 Use Case:
   * Orders that must be executed completely or not at all
   */
  it("🚫 Execute all-or-nothing order (no partial fills)", async function () {
    const { tokens, contracts, chainId } =
      await loadFixture(deployAndInitialize);
    const { dai, weth } = tokens;
    const { swap } = contracts;

    // 📝 Create order with partial fills disabled
    const orderConfig: OrderParamsuration = {
      makerAsset: await dai.getAddress(),
      takerAsset: await weth.getAddress(),
      makingAmount: ether("100"),
      takingAmount: ether("0.1"),
      maker: maker.address,
      makerTraits: buildMakerTraits({
        disablePartialFills: true, // All-or-nothing
        nonce: 789,
      }),
    };

    const order = buildOrder(orderConfig);
    const signature = await signOrder(
      order,
      chainId,
      await swap.getAddress(),
      maker,
    );
    const balancesBefore = await captureBalances(tokens);

    // 🚀 Execute full order (partial fills disabled, so must fill completely)
    const { r, yParityAndS: vs } = ethers.Signature.from(signature);
    const takerTraits = buildTakerTraits({
      threshold: orderConfig.takingAmount,
      makingAmount: true,
    });

    await swap.connect(taker).fillOrderArgs(
      order,
      r,
      vs,
      orderConfig.makingAmount, // Must fill entire amount
      takerTraits.traits,
      takerTraits.args,
    );

    // ✅ Verify complete execution
    expect(await dai.balanceOf(maker.address)).to.equal(
      balancesBefore.makerDai - orderConfig.makingAmount,
    );
    expect(await dai.balanceOf(taker.address)).to.equal(
      balancesBefore.takerDai + orderConfig.makingAmount,
    );
    expect(await weth.balanceOf(maker.address)).to.equal(
      balancesBefore.makerWeth + orderConfig.takingAmount,
    );
    expect(await weth.balanceOf(taker.address)).to.equal(
      balancesBefore.takerWeth - orderConfig.takingAmount,
    );
  });
});

/**
 * 🚀 Limit Order Best Practices Summary
 *
 * 1. **📝 Order Creation**:
 *    - Use appropriate maker traits for your use case
 *    - Consider expiration times for risk management
 *    - Set reasonable price thresholds
 *
 * 2. **✍️ Signature Security**:
 *    - Always use EIP-712 for typed data signing
 *    - Verify signatures before submitting to blockchain
 *    - Store signatures securely until execution
 *
 * 3. **🎯 Execution Strategy**:
 *    - Use appropriate taker traits for gas optimization
 *    - Consider partial vs. full fills based on strategy
 *    - Monitor order status for post-execution actions
 *
 * 4. **⚡ Gas Optimization**:
 *    - Batch multiple operations when possible
 *    - Use simple orders for basic swaps
 *    - Reserve complex features for advanced strategies
 *
 * 📚 Related Documentation:
 * - SDK Integration: ../Limit Order SDK/integration.md
 * - Maker Contract: ../limit-order-maker-contract.md
 * - Taker Contract: ../limit-order-taker-contract.md
 * - Extensions: ../extensions.md
 *
 * 🔗 Example Cross-References:
 * - Dutch Auctions: ./dutch-auction.ts
 * - Interactions: ./interaction.ts
 * - Extensions: ./extensions.ts
 * - Maker Contracts: ./maker-contract.ts
 */
