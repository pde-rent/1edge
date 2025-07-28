/**
 * 🎭 Order Interactions & Recursive Matching Example
 * 
 * This comprehensive example demonstrates advanced interaction patterns in the
 * 1inch Limit Order Protocol, including recursive order matching, hash validation,
 * and order ID management.
 * 
 * 📚 Related Documentation:
 * - Interactions Overview: ../extensions.md#preinteraction--postinteraction
 * - Order Building: ../limit-order-maker-contract.md
 * - Taker Traits: ../limit-order-taker-contract.md
 * - Extensions Guide: ../extensions.md
 * 
 * 🎯 Key Features:
 * - Recursive order matching for complex strategies
 * - Hash-based order validation
 * - Order ID invalidation mechanisms
 * - Multi-order execution patterns
 */

import { expect } from '@1inch/solidity-utils';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers, HardhatEthersSigner } from 'hardhat';
import { deploySwapTokens } from './helpers/fixtures';
import { ether } from './helpers/utils';
import {
  signOrder,
  buildOrder,
  buildMakerTraits,
  buildTakerTraits,
} from './helpers/orderUtils';

// 📝 Type definitions for interaction testing
interface TestTokens {
  dai: any; // ERC20 DAI token contract
  weth: any; // WETH token contract
}

interface TestContracts {
  swap: any; // LimitOrderProtocol contract
  matcher?: any; // RecursiveMatcher contract
  hashChecker?: any; // HashChecker contract
  orderIdInvalidator?: any; // OrderIdInvalidator contract
}

interface BaseTestFixture {
  tokens: TestTokens;
  contracts: TestContracts;
  chainId: number;
}

interface BalanceSnapshot {
  makerWeth: bigint;
  takerWeth: bigint;
  makerDai: bigint;
  takerDai: bigint;
}

describe('🎭 Advanced Order Interactions', function () {
  let maker: HardhatEthersSigner;
  let taker: HardhatEthersSigner;
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  before(async function () {
    [maker, taker] = await ethers.getSigners();
  });

  /**
   * 🏗️ Initialize base contracts and token setup
   * 
   * Sets up the foundational infrastructure:
   * - DAI and WETH tokens with initial balances
   * - LimitOrderProtocol swap contract
   * - Token approvals for trading
   */
  async function initBaseContracts(): Promise<BaseTestFixture> {
    const { dai, weth, swap, chainId } = await deploySwapTokens();

    // 💰 Initialize substantial token balances for testing
    const daiAmount = ether('100');
    const wethAmount = ether('1');

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
    };
  }

  /**
   * 📊 Capture current token balances for comparison
   */
  async function captureBalances(tokens: TestTokens): Promise<BalanceSnapshot> {
    return {
      makerWeth: await tokens.weth.balanceOf(maker.address),
      takerWeth: await tokens.weth.balanceOf(taker.address),
      makerDai: await tokens.dai.balanceOf(maker.address),
      takerDai: await tokens.dai.balanceOf(taker.address),
    };
  }

  describe('🔄 Recursive Order Matching', function () {
    /**
     * 🎯 Initialize RecursiveMatcher for advanced order combinations
     */
    async function initRecursiveMatcher() {
      const baseFixture = await initBaseContracts();

      const RecursiveMatcher = await ethers.getContractFactory('RecursiveMatcher');
      const matcher = await RecursiveMatcher.deploy();
      await matcher.waitForDeployment();

      return {
        ...baseFixture,
        contracts: { ...baseFixture.contracts, matcher },
      };
    }

    /**
     * ↔️ Test: Opposite Direction Recursive Swap
     * 
     * Scenario:
     * - Create two complementary orders (DAI→WETH and WETH→DAI)
     * - Use recursive matcher to execute both simultaneously
     * - Verify tokens are exchanged correctly between parties
     * 
     * 💡 Use Case:
     * Atomic swaps between two parties with exact opposite needs
     */
    it('↔️ Execute opposite direction recursive swap', async function () {
      const { tokens, contracts, chainId } = await loadFixture(initRecursiveMatcher);
      const { dai, weth } = tokens;
      const { swap, matcher } = contracts;

      // 📝 Create primary order: DAI → WETH
      const primaryOrder = buildOrder({
        makerAsset: await dai.getAddress(),
        takerAsset: await weth.getAddress(),
        makingAmount: ether('100'), // 100 DAI
        takingAmount: ether('0.1'), // 0.1 WETH
        maker: maker.address,
      });

      // 📝 Create complementary order: WETH → DAI
      const backOrder = buildOrder({
        makerAsset: await weth.getAddress(),
        takerAsset: await dai.getAddress(),
        makingAmount: ether('0.1'), // 0.1 WETH
        takingAmount: ether('100'), // 100 DAI
        maker: taker.address,
      });

      // ✍️ Sign both orders
      const primarySignature = await signOrder(primaryOrder, chainId, await swap.getAddress(), maker);
      const backSignature = await signOrder(backOrder, chainId, await swap.getAddress(), taker);

      // 🔧 Prepare matching parameters for recursive execution
      const matchingParams = (await matcher.getAddress()) + '01' + abiCoder.encode(
        ['address[]', 'bytes[]'],
        [
          [await weth.getAddress(), await dai.getAddress()],
          [
            weth.interface.encodeFunctionData('approve', [await swap.getAddress(), ether('0.1')]),
            dai.interface.encodeFunctionData('approve', [await swap.getAddress(), ether('100')]),
          ],
        ],
      ).substring(2);

      // 🎭 Build interaction for nested order execution
      const { r: backOrderR, yParityAndS: backOrderVs } = ethers.Signature.from(backSignature);
      const takerTraits = buildTakerTraits({
        interaction: matchingParams,
        makingAmount: true,
        threshold: ether('100'),
      });
      
      const nestedInteraction = (await matcher.getAddress()) + '00' + swap.interface.encodeFunctionData('fillOrderArgs', [
        backOrder,
        backOrderR,
        backOrderVs,
        ether('0.1'),
        takerTraits.traits,
        takerTraits.args,
      ]).substring(10);

      // 📊 Capture balances before execution
      const balancesBefore = await captureBalances(tokens);

      // 🚀 Execute recursive matching
      const { r, yParityAndS: vs } = ethers.Signature.from(primarySignature);
      const matcherTraits = buildTakerTraits({
        interaction: nestedInteraction,
        makingAmount: true,
        threshold: ether('0.1'),
      });
      
      await matcher.matchOrders(
        await swap.getAddress(),
        primaryOrder,
        r,
        vs,
        ether('100'),
        matcherTraits.traits,
        matcherTraits.args
      );

      // ✅ Verify successful token exchange
      expect(await weth.balanceOf(maker.address))
        .to.equal(balancesBefore.makerWeth + ether('0.1'));
      expect(await weth.balanceOf(taker.address))
        .to.equal(balancesBefore.takerWeth - ether('0.1'));
      expect(await dai.balanceOf(maker.address))
        .to.equal(balancesBefore.makerDai - ether('100'));
      expect(await dai.balanceOf(taker.address))
        .to.equal(balancesBefore.takerDai + ether('100'));
    });

    /**
     * ➡️ Test: Unidirectional Recursive Swap
     * 
     * Scenario:
     * - Execute multiple orders in the same direction
     * - Use additional WETH input to fill larger combined order
     * - Demonstrate complex multi-order strategies
     * 
     * 💡 Use Case:
     * Aggregating liquidity from multiple smaller orders
     */
    it('➡️ Execute unidirectional recursive swap', async function () {
      const { tokens, contracts, chainId } = await loadFixture(initRecursiveMatcher);
      const { dai, weth } = tokens;
      const { swap, matcher } = contracts;

      // 📝 Create first order: 10 DAI → 0.01 WETH
      const firstOrder = buildOrder({
        makerAsset: await dai.getAddress(),
        takerAsset: await weth.getAddress(),
        makingAmount: ether('10'),
        takingAmount: ether('0.01'),
        maker: taker.address,
        makerTraits: buildMakerTraits({ nonce: 0 }),
      });

      // 📝 Create second order: 15 DAI → 0.015 WETH
      const secondOrder = buildOrder({
        makerAsset: await dai.getAddress(),
        takerAsset: await weth.getAddress(),
        makingAmount: ether('15'),
        takingAmount: ether('0.015'),
        maker: taker.address,
        makerTraits: buildMakerTraits({ nonce: 0 }),
      });

      // ✍️ Sign orders
      const firstSignature = await signOrder(firstOrder, chainId, await swap.getAddress(), taker);
      const secondSignature = await signOrder(secondOrder, chainId, await swap.getAddress(), taker);

      // 🔧 Build complex matching interaction
      const matchingParams = (await matcher.getAddress()) + '01' + abiCoder.encode(
        ['address[]', 'bytes[]'],
        [
          [
            await weth.getAddress(),
            await weth.getAddress(),
            await dai.getAddress(),
          ],
          [
            weth.interface.encodeFunctionData('transferFrom', [maker.address, await matcher.getAddress(), ether('0.025')]),
            weth.interface.encodeFunctionData('approve', [await swap.getAddress(), ether('0.025')]),
            dai.interface.encodeFunctionData('transfer', [maker.address, ether('25')]),
          ],
        ],
      ).substring(2);

      // 🎭 Build nested execution
      const { r: secondOrderR, yParityAndS: secondOrderVs } = ethers.Signature.from(secondSignature);
      const takerTraits = buildTakerTraits({
        interaction: matchingParams,
        makingAmount: true,
        threshold: ether('0.015'),
      });
      
      const nestedInteraction = (await matcher.getAddress()) + '00' + swap.interface.encodeFunctionData('fillOrderArgs', [
        secondOrder,
        secondOrderR,
        secondOrderVs,
        ether('15'),
        takerTraits.traits,
        takerTraits.args,
      ]).substring(10);

      // 📊 Capture initial balances
      const balancesBefore = await captureBalances(tokens);

      // ✅ Approve additional WETH for complex strategy
      await weth.connect(maker).approve(matcher.address, ether('0.025'));
      
      // 🚀 Execute unidirectional recursive matching
      const { r, yParityAndS: vs } = ethers.Signature.from(firstSignature);
      const matcherTraits = buildTakerTraits({
        interaction: nestedInteraction,
        makingAmount: true,
        threshold: ether('0.01'),
      });
      
      await matcher.matchOrders(
        await swap.getAddress(),
        firstOrder,
        r,
        vs,
        ether('10'),
        matcherTraits.traits,
        matcherTraits.args
      );

      // ✅ Verify complex strategy execution
      expect(await weth.balanceOf(maker.address))
        .to.equal(balancesBefore.makerWeth - ether('0.025'));
      expect(await weth.balanceOf(taker.address))
        .to.equal(balancesBefore.takerWeth + ether('0.025'));
      expect(await dai.balanceOf(maker.address))
        .to.equal(balancesBefore.makerDai + ether('25'));
      expect(await dai.balanceOf(taker.address))
        .to.equal(balancesBefore.takerDai - ether('25'));
    });
  });

  describe('🔍 Hash-Based Order Validation', function () {
    /**
     * 🏗️ Initialize HashChecker for order validation
     */
    async function initHashChecker() {
      const baseFixture = await initBaseContracts();
      
      const [owner] = await ethers.getSigners();
      const HashChecker = await ethers.getContractFactory('HashChecker');
      const hashChecker = await HashChecker.deploy(baseFixture.contracts.swap, owner);
      await hashChecker.waitForDeployment();

      return {
        ...baseFixture,
        contracts: { ...baseFixture.contracts, hashChecker },
      };
    }

    /**
     * ✅ Test: Successful Hash Validation and Fill
     * 
     * Scenario:
     * - Create order with hash validation pre-interaction
     * - Whitelist the order hash
     * - Execute order successfully with validation
     * 
     * 💡 Use Case:
     * Restricted order execution with explicit approval required
     */
    it('✅ Execute order with valid hash check', async function () {
      const { tokens, contracts, chainId } = await loadFixture(initHashChecker);
      const { dai, weth } = tokens;
      const { swap, hashChecker } = contracts;

      // 📝 Create order with hash validation
      const order = buildOrder(
        {
          makerAsset: await dai.getAddress(),
          takerAsset: await weth.getAddress(),
          makingAmount: ether('100'),
          takingAmount: ether('0.1'),
          maker: taker.address,
          makerTraits: buildMakerTraits(),
        },
        {
          preInteraction: await hashChecker.getAddress(), // Hash validation before execution
        },
      );
      
      const signature = await signOrder(order, chainId, await swap.getAddress(), taker);

      // 📊 Capture balances before execution
      const balancesBefore = await captureBalances(tokens);

      // ✅ Whitelist the order hash for execution
      await hashChecker.setHashOrderStatus(order, true);

      // 🚀 Execute order with hash validation
      const { r, yParityAndS: vs } = ethers.Signature.from(signature);
      const takerTraits = buildTakerTraits({
        threshold: ether('0.1'),
        makingAmount: true,
        extension: order.extension,
      });
      
      await swap.fillOrderArgs(order, r, vs, ether('100'), takerTraits.traits, takerTraits.args);

      // ✅ Verify successful execution
      expect(await dai.balanceOf(taker.address))
        .to.equal(balancesBefore.takerDai - ether('100'));
      expect(await dai.balanceOf(maker.address))
        .to.equal(balancesBefore.makerDai + ether('100'));
      expect(await weth.balanceOf(taker.address))
        .to.equal(balancesBefore.takerWeth + ether('0.1'));
      expect(await weth.balanceOf(maker.address))
        .to.equal(balancesBefore.makerWeth - ether('0.1'));
    });

    /**
     * ❌ Test: Hash Validation Failure
     * 
     * Scenario:
     * - Create order with hash validation but don't whitelist
     * - Attempt to execute order
     * - Verify transaction reverts with correct error
     * 
     * 💡 Use Case:
     * Security mechanism to prevent unauthorized order execution
     */
    it('❌ Reject order with invalid hash check', async function () {
      const { tokens, contracts, chainId } = await loadFixture(initHashChecker);
      const { dai, weth } = tokens;
      const { swap, hashChecker } = contracts;

      // 📝 Create order with hash validation (but don't whitelist)
      const order = buildOrder(
        {
          makerAsset: await dai.getAddress(),
          takerAsset: await weth.getAddress(),
          makingAmount: ether('100'),
          takingAmount: ether('0.1'),
          maker: taker.address,
          makerTraits: buildMakerTraits(),
        },
        {
          preInteraction: await hashChecker.getAddress(),
        },
      );

      const signature = await signOrder(order, chainId, await swap.getAddress(), taker);

      // 🚫 Attempt execution without whitelisting (should fail)
      const { r, yParityAndS: vs } = ethers.Signature.from(signature);
      const takerTraits = buildTakerTraits({
        threshold: ether('0.1'),
        makingAmount: true,
        extension: order.extension,
      });
      
      await expect(
        swap.fillOrderArgs(order, r, vs, ether('100'), takerTraits.traits, takerTraits.args)
      ).to.be.revertedWithCustomError(hashChecker, 'IncorrectOrderHash');
    });
  });

  describe('🆔 Order ID Validation & Management', function () {
    /**
     * 🏗️ Initialize OrderIdInvalidator for order tracking
     */
    async function initOrderIdInvalidator() {
      const baseFixture = await initBaseContracts();
      
      const OrderIdInvalidator = await ethers.getContractFactory('OrderIdInvalidator');
      const orderIdInvalidator = await OrderIdInvalidator.deploy(baseFixture.contracts.swap);
      await orderIdInvalidator.waitForDeployment();

      return {
        ...baseFixture,
        contracts: { ...baseFixture.contracts, orderIdInvalidator },
      };
    }

    /**
     * 🔄 Test: Multiple Partial Fills with Same Order ID
     * 
     * Scenario:
     * - Create order allowing multiple fills with specific order ID
     * - Execute two separate partial fills
     * - Verify both fills succeed and track the same order ID
     * 
     * 💡 Use Case:
     * Market maker orders that can be filled multiple times
     */
    it('🔄 Execute multiple partial fills with order ID tracking', async function () {
      const { tokens, contracts, chainId } = await loadFixture(initOrderIdInvalidator);
      const { dai, weth } = tokens;
      const { swap, orderIdInvalidator } = contracts;

      const orderId = 13341n; // Unique order identifier

      // 📝 Create order with multiple fills enabled and order ID tracking
      const order = buildOrder(
        {
          makerAsset: await dai.getAddress(),
          takerAsset: await weth.getAddress(),
          makingAmount: ether('100'),
          takingAmount: ether('0.1'),
          maker: maker.address,
          makerTraits: buildMakerTraits({ allowMultipleFills: true }),
        },
        {
          preInteraction: (await orderIdInvalidator.getAddress()) + orderId.toString(16).padStart(8, '0'),
        },
      );
      
      const signature = await signOrder(order, chainId, await swap.getAddress(), maker);

      // 📊 Capture initial balances
      const balancesBefore = await captureBalances(tokens);

      // 🚀 Execute first partial fill (50%)
      const { r, yParityAndS: vs } = ethers.Signature.from(signature);
      const firstFillTraits = buildTakerTraits({
        threshold: ether('0.1'),
        makingAmount: true,
        extension: order.extension,
      });
      
      await swap.connect(taker).fillOrderArgs(
        order,
        r,
        vs,
        ether('50'), // Fill 50 DAI
        firstFillTraits.traits,
        firstFillTraits.args
      );

      // ✅ Verify first fill
      expect(await weth.balanceOf(maker.address))
        .to.equal(balancesBefore.makerWeth + ether('0.05'));
      expect(await weth.balanceOf(taker.address))
        .to.equal(balancesBefore.takerWeth - ether('0.05'));
      expect(await dai.balanceOf(maker.address))
        .to.equal(balancesBefore.makerDai - ether('50'));
      expect(await dai.balanceOf(taker.address))
        .to.equal(balancesBefore.takerDai + ether('50'));

      // 🚀 Execute second partial fill (remaining 50%)
      const secondFillTraits = buildTakerTraits({
        threshold: ether('0.1'),
        makingAmount: true,
        extension: order.extension,
      });
      
      await swap.connect(taker).fillOrderArgs(
        order,
        r,
        vs,
        ether('50'), // Fill remaining 50 DAI
        secondFillTraits.traits,
        secondFillTraits.args
      );

      // ✅ Verify complete order execution
      expect(await weth.balanceOf(maker.address))
        .to.equal(balancesBefore.makerWeth + ether('0.1'));
      expect(await weth.balanceOf(taker.address))
        .to.equal(balancesBefore.takerWeth - ether('0.1'));
      expect(await dai.balanceOf(maker.address))
        .to.equal(balancesBefore.makerDai - ether('100'));
      expect(await dai.balanceOf(taker.address))
        .to.equal(balancesBefore.takerDai + ether('100'));
    });

    /**
     * 🚫 Test: Order ID Collision Prevention
     * 
     * Scenario:
     * - Create two different orders with same order ID
     * - Execute first order successfully
     * - Attempt to execute second order with same ID
     * - Verify second order is rejected
     * 
     * 💡 Use Case:
     * Preventing order replay attacks and ensuring order uniqueness
     */
    it('🚫 Prevent execution of different order with same ID', async function () {
      const { tokens, contracts, chainId } = await loadFixture(initOrderIdInvalidator);
      const { dai, weth } = tokens;
      const { swap, orderIdInvalidator } = contracts;

      const orderId = 13341n;
      const preInteraction = (await orderIdInvalidator.getAddress()) + orderId.toString(16).padStart(8, '0');

      // 📝 Create first order with specific ID
      const firstOrder = buildOrder(
        {
          makerAsset: await dai.getAddress(),
          takerAsset: await weth.getAddress(),
          makingAmount: ether('100'),
          takingAmount: ether('0.1'),
          maker: maker.address,
          makerTraits: buildMakerTraits(),
        },
        {
          preInteraction,
        },
      );

      // 📝 Create second order with same ID but different parameters
      const secondOrder = buildOrder(
        {
          makerAsset: await dai.getAddress(),
          takerAsset: await weth.getAddress(),
          makingAmount: ether('50'), // Different amount
          takingAmount: ether('0.05'),
          maker: maker.address,
          makerTraits: buildMakerTraits(),
        },
        {
          preInteraction, // Same order ID
        },
      );

      // ✍️ Sign both orders
      const firstSignature = await signOrder(firstOrder, chainId, await swap.getAddress(), maker);
      const secondSignature = await signOrder(secondOrder, chainId, await swap.getAddress(), maker);

      // 📊 Capture balances
      const balancesBefore = await captureBalances(tokens);

      // 🚀 Execute first order successfully
      const { r, yParityAndS: vs } = ethers.Signature.from(firstSignature);
      const firstTraits = buildTakerTraits({
        threshold: ether('0.1'),
        makingAmount: true,
        extension: firstOrder.extension,
      });
      
      await swap.connect(taker).fillOrderArgs(
        firstOrder,
        r,
        vs,
        ether('50'), // Partial fill
        firstTraits.traits,
        firstTraits.args
      );

      // ✅ Verify first order execution
      expect(await weth.balanceOf(maker.address))
        .to.equal(balancesBefore.makerWeth + ether('0.05'));
      expect(await dai.balanceOf(maker.address))
        .to.equal(balancesBefore.makerDai - ether('50'));

      // 🚫 Attempt to execute second order with same ID (should fail)
      const { r: r2, yParityAndS: vs2 } = ethers.Signature.from(secondSignature);
      const secondTraits = buildTakerTraits({
        threshold: ether('0.1'),
        makingAmount: true,
        extension: secondOrder.extension,
      });
      
      await expect(
        swap.connect(taker).fillOrderArgs(
          secondOrder,
          r2,
          vs2,
          ether('50'),
          secondTraits.traits,
          secondTraits.args
        )
      ).to.be.revertedWithCustomError(orderIdInvalidator, 'InvalidOrderHash');
    });
  });
});

/**
 * 🚀 Advanced Interaction Patterns Summary
 * 
 * 1. **🔄 Recursive Matching**:
 *    - Enables complex multi-order strategies
 *    - Perfect for arbitrage and liquidity aggregation
 *    - Requires careful gas management
 * 
 * 2. **🔍 Hash Validation**:
 *    - Provides additional security layer
 *    - Useful for restricted or private orders
 *    - Enables conditional order execution
 * 
 * 3. **🆔 Order ID Management**:
 *    - Prevents replay attacks
 *    - Enables sophisticated order tracking
 *    - Essential for market maker strategies
 * 
 * 📚 Related Documentation:
 * - Extension System: ../extensions.md
 * - Order Creation: ../limit-order-maker-contract.md
 * - Order Execution: ../limit-order-taker-contract.md
 * 
 * 🔗 Example Cross-References:
 * - Dutch Auctions: ./dutch-auction.ts
 * - Extensions: ./extensions.ts
 * - Limit Orders: ./limit-order.ts
 */