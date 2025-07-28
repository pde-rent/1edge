/**
 * 🔑 EIP-2612 Permit Integration Example
 * 
 * This example demonstrates gasless token approvals using EIP-2612 permits
 * in conjunction with 1inch Limit Order Protocol orders. Permits allow users
 * to approve token spending without a separate transaction.
 * 
 * 📚 Related Documentation:
 * - Permit Integration: ../limit-order-maker-contract.md#permit-support
 * - Gasless Transactions: ../Limit Order SDK/install.md#gasless-approvals
 * - Taker Traits: ../limit-order-taker-contract.md
 * - SDK Integration: ../Limit Order SDK/integration.md
 * 
 * 🎯 Key Features:
 * - EIP-2612 permit-based token approvals
 * - Gasless approval workflows
 * - Combined permit + order execution
 * - Improved user experience for DeFi interactions
 */

import { expect, permit2Contract, getPermit2 } from '@1inch/solidity-utils';
import { ethers, HardhatEthersSigner } from 'hardhat';
import {
  fillWithMakingAmount,
  unwrapWethTaker,
  buildMakerTraits,
  buildMakerTraitsRFQ,
  buildOrder,
  signOrder,
  buildOrderData,
  buildTakerTraits,
} from './helpers/orderUtils';
import { getPermit, withTarget } from './helpers/eip712';
import { joinStaticCalls, ether, findTrace, countAllItems, withTrace } from './helpers/utils';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { deploySwapTokens, deployArbitraryPredicate } from './helpers/fixtures';
import { parseUnits } from 'ethers';

// 📝 Type definitions for permit testing
interface TestTokens {
  dai: any; // ERC20 DAI token contract
  weth: any; // WETH token contract
}

interface TestContracts {
  swap: any; // LimitOrderProtocol contract
}

interface PermitTestFixture {
  tokens: TestTokens;
  contracts: TestContracts;
  chainId: number;
  accounts: {
    maker: HardhatEthersSigner;
    taker: HardhatEthersSigner;
  };
  permitOrder: {
    order: any;
    signature: {
      r: string;
      vs: string;
    };
  };
}

interface PermitData {
  owner: string;
  spender: string;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}

describe('🔑 EIP-2612 Permit Integration', function () {
  let maker: HardhatEthersSigner;
  let taker: HardhatEthersSigner;
  let resolver: HardhatEthersSigner;

  before(async function () {
    // Skip deployer account
    [, maker, taker, resolver] = await ethers.getSigners();
  });

  /**
   * 🏗️ Deploy contracts and prepare permit testing environment
   * 
   * Sets up:
   * - DAI and WETH tokens with EIP-2612 permit support
   * - LimitOrderProtocol swap contract
   * - Initial token balances and approvals
   * - Pre-signed permit order for testing
   */
  async function deployAndInitializePermitSystem(): Promise<PermitTestFixture> {
    const { dai, weth, swap, chainId } = await deploySwapTokens();
    
    // 💰 Initialize substantial token balances
    const daiAmount = ether('1000000');
    const wethAmount = ether('100');
    
    await dai.mint(maker.address, daiAmount);
    await dai.mint(taker.address, daiAmount);
    await weth.connect(maker).deposit({ value: wethAmount });
    await weth.connect(taker).deposit({ value: wethAmount });
    
    // ✅ Standard approvals for maker (taker will use permit)
    await dai.connect(maker).approve(swap.address, daiAmount);
    await dai.connect(taker).approve(swap.address, daiAmount);
    await weth.connect(maker).approve(swap.address, wethAmount);
    // Note: taker WETH approval will be done via permit

    // 📝 Create a sample order for permit testing
    const permitOrder = buildOrder({
      makerAsset: await dai.getAddress(),
      takerAsset: await weth.getAddress(),
      makingAmount: 1,
      takingAmount: 1,
      maker: maker.address,
    });
    
    // ✍️ Pre-sign the order
    const orderSignature = await signOrder(permitOrder, chainId, await swap.getAddress(), maker);
    const { r, yParityAndS: vs } = ethers.Signature.from(orderSignature);

    return {
      tokens: { dai, weth },
      contracts: { swap },
      chainId,
      accounts: { maker, taker },
      permitOrder: {
        order: permitOrder,
        signature: { r, vs },
      },
    };
  }

  /**
   * 🔑 Test: Gasless Token Approval with Permit
   * 
   * Scenario:
   * - Taker has no WETH allowance for swap contract
   * - Generate EIP-2612 permit for WETH approval
   * - Execute order fill with permit in single transaction
   * - Verify tokens are exchanged without prior approval transaction
   * 
   * 💡 Use Case:
   * Improved UX by eliminating separate approval transactions
   */
  it('🔑 Execute order with gasless WETH permit approval', async function () {
    const {
      tokens: { dai, weth },
      contracts: { swap },
      chainId,
      permitOrder: { order, signature: { r, vs } },
    } = await loadFixture(deployAndInitializePermitSystem);

    // 🗺️ Generate EIP-2612 permit for taker's WETH
    const permitAmount = '1'; // Permit 1 wei WETH
    const permitNonce = '1';  // Permit nonce
    
    const permit = await getPermit(
      taker.address,    // Token owner
      taker,            // Signer
      weth,             // Token contract
      permitAmount,     // Amount to approve
      chainId,          // Chain ID
      await swap.getAddress(), // Spender (swap contract)
      permitNonce       // Permit nonce
    );

    // 🎛️ Configure taker traits for execution
    const takerTraits = buildTakerTraits({
      threshold: 1n,
      makingAmount: true,
    });

    // 🚫 Remove any existing WETH allowance to test permit
    await weth.connect(taker).approve(swap.address, '0');
    
    // 📊 Capture balances before execution
    const balancesBefore = {
      takerDai: await dai.balanceOf(taker.address),
      makerDai: await dai.balanceOf(maker.address),
      takerWeth: await weth.balanceOf(taker.address),
      makerWeth: await weth.balanceOf(maker.address),
    };

    // 🚀 Execute permit + order fill in single transaction
    const permitAndFillTx = swap.permitAndCall(
      // 📰 Pack permit data
      ethers.solidityPacked(
        ['address', 'bytes'],
        [await weth.getAddress(), permit]
      ),
      // 💼 Encode order fill call
      swap.interface.encodeFunctionData('fillOrderArgs', [
        order,
        r,
        vs,
        1, // Fill amount
        takerTraits.traits,
        takerTraits.args,
      ])
    );

    // ✅ Verify atomic permit + fill execution
    await expect(permitAndFillTx)
      .to.changeTokenBalances(dai, [taker, maker], [1, -1]);
    await expect(permitAndFillTx)
      .to.changeTokenBalances(weth, [taker, maker], [-1, 1]);
  });

  /**
   * 🔄 Test: Multiple Permit Operations
   * 
   * Scenario:
   * - Execute multiple permit-based operations
   * - Demonstrate permit nonce management
   * - Verify each permit is single-use
   * 
   * 💡 Use Case:
   * Complex trading strategies requiring multiple approvals
   */
  it('🔄 Execute multiple permits with proper nonce management', async function () {
    const {
      tokens: { dai, weth },
      contracts: { swap },
      chainId,
    } = await loadFixture(deployAndInitializePermitSystem);

    // 📝 Create multiple orders for testing
    const firstOrder = buildOrder({
      makerAsset: await dai.getAddress(),
      takerAsset: await weth.getAddress(),
      makingAmount: ether('10'),
      takingAmount: ether('0.01'),
      maker: maker.address,
    });

    const secondOrder = buildOrder({
      makerAsset: await dai.getAddress(),
      takerAsset: await weth.getAddress(),
      makingAmount: ether('20'),
      takingAmount: ether('0.02'),
      maker: maker.address,
    });

    // ✍️ Sign both orders
    const firstSig = await signOrder(firstOrder, chainId, await swap.getAddress(), maker);
    const secondSig = await signOrder(secondOrder, chainId, await swap.getAddress(), maker);
    
    const { r: r1, yParityAndS: vs1 } = ethers.Signature.from(firstSig);
    const { r: r2, yParityAndS: vs2 } = ethers.Signature.from(secondSig);

    // 🚫 Clear WETH allowances to force permit usage
    await weth.connect(taker).approve(swap.address, '0');

    // 📊 Get initial permit nonce for taker
    const initialNonce = await weth.nonces(taker.address);

    // 🔑 Generate first permit
    const firstPermit = await getPermit(
      taker.address,
      taker,
      weth,
      ether('0.01').toString(), // Exact amount for first order
      chainId,
      await swap.getAddress(),
      (initialNonce + 1n).toString() // Next nonce
    );

    // 🚀 Execute first order with permit
    const firstTraits = buildTakerTraits({
      threshold: ether('0.01'),
      makingAmount: true,
    });

    await swap.permitAndCall(
      ethers.solidityPacked(
        ['address', 'bytes'],
        [await weth.getAddress(), firstPermit]
      ),
      swap.interface.encodeFunctionData('fillOrderArgs', [
        firstOrder,
        r1,
        vs1,
        ether('10'),
        firstTraits.traits,
        firstTraits.args,
      ])
    );

    // 🔑 Generate second permit with incremented nonce
    const secondPermit = await getPermit(
      taker.address,
      taker,
      weth,
      ether('0.02').toString(), // Amount for second order
      chainId,
      await swap.getAddress(),
      (initialNonce + 2n).toString() // Incremented nonce
    );

    // 🚀 Execute second order with new permit
    const secondTraits = buildTakerTraits({
      threshold: ether('0.02'),
      makingAmount: true,
    });

    const secondTx = swap.permitAndCall(
      ethers.solidityPacked(
        ['address', 'bytes'],
        [await weth.getAddress(), secondPermit]
      ),
      swap.interface.encodeFunctionData('fillOrderArgs', [
        secondOrder,
        r2,
        vs2,
        ether('20'),
        secondTraits.traits,
        secondTraits.args,
      ])
    );

    // ✅ Verify second transaction executes successfully
    await expect(secondTx)
      .to.changeTokenBalances(dai, [taker, maker], [ether('20'), -ether('20')]);
    await expect(secondTx)
      .to.changeTokenBalances(weth, [taker, maker], [-ether('0.02'), ether('0.02')]);

    // ✅ Verify nonce was incremented properly
    const finalNonce = await weth.nonces(taker.address);
    expect(finalNonce).to.equal(initialNonce + 2n);
  });

  /**
   * ⏰ Test: Permit with Expiration
   * 
   * Scenario:
   * - Create permit with future expiration
   * - Execute order before expiration (should succeed)
   * - Demonstrate time-based permit security
   * 
   * 💡 Use Case:
   * Time-limited approvals for enhanced security
   */
  it('⏰ Execute permit with expiration constraint', async function () {
    const {
      tokens: { dai, weth },
      contracts: { swap },
      chainId,
      permitOrder: { order, signature: { r, vs } },
    } = await loadFixture(deployAndInitializePermitSystem);

    // ⏰ Set permit expiration for 1 hour from now
    const currentTime = Math.floor(Date.now() / 1000);
    const permitExpiration = currentTime + 3600; // 1 hour

    // 🔑 Generate time-limited permit
    const timedPermit = await getPermit(
      taker.address,
      taker,
      weth,
      '1',
      chainId,
      await swap.getAddress(),
      '1',
      permitExpiration // Custom expiration
    );

    const takerTraits = buildTakerTraits({
      threshold: 1n,
      makingAmount: true,
    });

    // 🚫 Clear allowance to force permit usage
    await weth.connect(taker).approve(swap.address, '0');

    // 🚀 Execute before expiration (should succeed)
    const timedPermitTx = swap.permitAndCall(
      ethers.solidityPacked(
        ['address', 'bytes'],
        [await weth.getAddress(), timedPermit]
      ),
      swap.interface.encodeFunctionData('fillOrderArgs', [
        order,
        r,
        vs,
        1,
        takerTraits.traits,
        takerTraits.args,
      ])
    );

    // ✅ Verify successful execution before expiration
    await expect(timedPermitTx)
      .to.changeTokenBalances(dai, [taker, maker], [1, -1]);
    await expect(timedPermitTx)
      .to.changeTokenBalances(weth, [taker, maker], [-1, 1]);
  });
});

/**
 * 🚀 EIP-2612 Permit Best Practices
 * 
 * 1. **🔑 Permit Security**:
 *    - Always use unique nonces for each permit
 *    - Set reasonable expiration times
 *    - Validate permit parameters before signing
 *    - Store permit data securely until use
 * 
 * 2. **⚡ Gas Optimization**:
 *    - Combine permit + action in single transaction
 *    - Use precise approval amounts when possible
 *    - Consider permit2 for advanced use cases
 *    - Batch multiple permits when applicable
 * 
 * 3. **📱 UX Improvements**:
 *    - Eliminate separate approval transactions
 *    - Provide clear permit explanations to users
 *    - Handle permit failures gracefully
 *    - Support both permit and standard approvals
 * 
 * 4. **🔄 Nonce Management**:
 *    - Track nonce state for each user
 *    - Handle nonce collisions appropriately
 *    - Implement nonce recovery mechanisms
 *    - Consider permit batching strategies
 * 
 * 📚 Advanced Permit Patterns:
 * 
 * ```typescript
 * // Example: Conditional permit execution
 * class PermitManager {
 *   async executeWithPermit(
 *     token: Contract,
 *     amount: bigint,
 *     user: Signer,
 *     action: string
 *   ) {
 *     const currentAllowance = await token.allowance(
 *       user.address,
 *       this.spenderAddress
 *     );
 * 
 *     if (currentAllowance < amount) {
 *       // Generate permit for exact shortfall
 *       const permitAmount = amount - currentAllowance;
 *       const permit = await this.generatePermit(
 *         user,
 *         token,
 *         permitAmount
 *       );
 *       
 *       return this.executeWithPermitData(permit, action);
 *     } else {
 *       // Sufficient allowance, execute directly
 *       return this.executeDirect(action);
 *     }
 *   }
 * }
 * ```
 * 
 * 📚 Related Documentation:
 * - Permit Integration: ../limit-order-maker-contract.md
 * - Gasless Workflows: ../Limit Order SDK/install.md
 * - SDK Integration: ../Limit Order SDK/integration.md
 * 
 * 🔗 Example Cross-References:
 * - Limit Orders: ./limit-order.ts
 * - Maker Contracts: ./maker-contract.ts
 * - Pre-Interactions: ./pre-interaction-approval.ts
 */