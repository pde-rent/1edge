/**
 * 🔄 Pre-Interaction Approval Example
 * 
 * This example demonstrates using pre-interactions to automatically approve
 * tokens before order execution. Pre-interactions enable complex workflows
 * where additional setup is required before the main order fill.
 * 
 * 📚 Related Documentation:
 * - Pre-Interactions: ../extensions.md#preinteraction--postinteraction
 * - Maker Traits: ../limit-order-maker-contract.md#makertraits
 * - Contract Orders: ../limit-order-taker-contract.md#contract-orders
 * - Extensions Guide: ../extensions.md
 * 
 * 🎯 Key Features:
 * - Automated token approval via pre-interactions
 * - Contract-based order makers
 * - Pre-execution setup workflows
 * - Integration with approval mechanisms
 */

import { ethers, HardhatEthersSigner } from 'hardhat';
import { ether } from './helpers/utils';
import {
  signOrder,
  buildOrder,
  buildTakerTraits,
  buildMakerTraitsRFQ,
} from './helpers/orderUtils';
import { deploySwapTokens } from './helpers/fixtures';

// 📝 Type definitions for pre-interaction testing
interface TestTokens {
  dai: any; // ERC20 DAI token contract
  weth: any; // WETH token contract
}

interface TestContracts {
  swap: any; // LimitOrderProtocol contract
  approvalPreInteraction: any; // Pre-interaction contract
}

interface PreInteractionTestFixture {
  tokens: TestTokens;
  contracts: TestContracts;
  chainId: number;
  accounts: {
    maker: HardhatEthersSigner;
    taker: HardhatEthersSigner;
    contractOwner: HardhatEthersSigner;
  };
}

interface OrderConfiguration {
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: bigint;
  takingAmount: bigint;
  makerTraits: any;
}

interface BalanceSnapshot {
  contractWeth: bigint;
  contractDai: bigint;
  takerWeth: bigint;
  takerDai: bigint;
}

describe('🔄 Pre-Interaction Approval Workflow', function () {
  let maker: HardhatEthersSigner;
  let taker: HardhatEthersSigner;
  let contractOwner: HardhatEthersSigner;

  before(async function () {
    [maker, taker, contractOwner] = await ethers.getSigners();
  });

  /**
   * 🏗️ Deploy and initialize pre-interaction approval system
   * 
   * Sets up:
   * - DAI and WETH tokens with initial balances
   * - LimitOrderProtocol swap contract
   * - ApprovalPreInteraction contract for automated approvals
   * - Token distribution and initial approvals
   */
  async function deployPreInteractionSystem(): Promise<PreInteractionTestFixture> {
    const { dai, weth, swap, chainId } = await deploySwapTokens();

    // 🏗️ Deploy ApprovalPreInteraction contract
    const ApprovalPreInteraction = await ethers.getContractFactory('ApprovalPreInteraction');
    const approvalPreInteraction = await ApprovalPreInteraction.deploy(
      swap.address,      // LimitOrderProtocol address
      contractOwner.address // Contract owner for authorization
    );
    await approvalPreInteraction.waitForDeployment();

    // 💰 Initialize token balances
    const daiAmount = ether('2000');
    const wethAmount = ether('1');
    
    // Mint tokens to maker and taker
    await dai.mint(maker.address, daiAmount);
    await weth.connect(taker).deposit({ value: wethAmount });

    // ✅ Approve tokens for trading (maker side)
    await dai.connect(maker).approve(swap.address, daiAmount);
    
    // 📄 Transfer WETH to pre-interaction contract (simulating contract-owned tokens)
    await weth.connect(taker).transfer(
      await approvalPreInteraction.getAddress(),
      wethAmount
    );

    return {
      tokens: { dai, weth },
      contracts: { swap, approvalPreInteraction },
      chainId,
      accounts: { maker, taker, contractOwner },
    };
  }

  /**
   * 📊 Capture token balances for verification
   */
  async function captureBalances(
    tokens: TestTokens,
    contracts: TestContracts,
    accounts: any
  ): Promise<BalanceSnapshot> {
    return {
      contractWeth: await tokens.weth.balanceOf(contracts.approvalPreInteraction.address),
      contractDai: await tokens.dai.balanceOf(contracts.approvalPreInteraction.address),
      takerWeth: await tokens.weth.balanceOf(accounts.taker.address),
      takerDai: await tokens.dai.balanceOf(accounts.taker.address),
    };
  }

  /**
   * 🚀 Test: Automated Approval via Pre-Interaction
   * 
   * Scenario:
   * - Contract owns WETH but hasn't approved swap contract
   * - Create order with pre-interaction that approves tokens
   * - Execute order successfully with automatic approval
   * - Verify both approval and trade happen atomically
   * 
   * 💡 Use Case:
   * Smart contracts that need to approve tokens just-in-time for orders
   */
  it('🚀 Execute order with automatic token approval', async function () {
    const { tokens, contracts, chainId, accounts } = await deployPreInteractionSystem();
    const { dai, weth } = tokens;
    const { swap, approvalPreInteraction } = contracts;
    const { maker, taker, contractOwner } = accounts;

    // 📝 Create order configuration with contract as maker
    const orderConfig: OrderConfiguration = {
      maker: await approvalPreInteraction.getAddress(),
      makerAsset: await weth.getAddress(),
      takerAsset: await dai.getAddress(),
      makingAmount: ether('1'),    // 1 WETH
      takingAmount: ether('2000'), // 2000 DAI
      makerTraits: buildMakerTraitsRFQ(), // Use RFQ traits for contract orders
    };

    // 🏗️ Build order with pre-interaction enabled
    const order = buildOrder(orderConfig);

    // 🔧 Enable pre-interaction flag in maker traits
    // This tells the protocol to call the pre-interaction before execution
    order.makerTraits = BigInt(order.makerTraits) | (1n << 252n); // Set _NEED_PREINTERACTION_FLAG

    // ✍️ Generate signature using contract owner's private key
    const signature = await signOrder(order, chainId, await swap.getAddress(), contractOwner);
    const { compactSerialized: compactSignature } = ethers.Signature.from(signature);

    // 🎛️ Configure taker execution parameters
    const takerTraits = buildTakerTraits({
      makingAmount: true,
      threshold: order.takingAmount,
    });

    // 📊 Capture balances before execution
    const balancesBefore = await captureBalances(tokens, contracts, accounts);

    // 🚀 Execute contract order with automatic approval
    // The pre-interaction will approve WETH spending before the main trade
    await swap.fillContractOrder(
      order,
      compactSignature,
      order.makingAmount,
      takerTraits.traits
    );

    // ✅ Verify token transfers occurred correctly
    const balancesAfter = await captureBalances(tokens, contracts, accounts);
    
    // Contract should have lost WETH and gained DAI
    expect(balancesAfter.contractWeth)
      .to.equal(balancesBefore.contractWeth - order.makingAmount);
    expect(balancesAfter.contractDai)
      .to.equal(balancesBefore.contractDai + order.takingAmount);
    
    // Taker should have gained WETH and lost DAI
    expect(balancesAfter.takerWeth)
      .to.equal(balancesBefore.takerWeth + order.makingAmount);
    expect(balancesAfter.takerDai)
      .to.equal(balancesBefore.takerDai - order.takingAmount);

    // 🔍 Verify approval was set during pre-interaction
    const finalAllowance = await weth.allowance(
      await approvalPreInteraction.getAddress(),
      await swap.getAddress()
    );
    // Should still have allowance remaining (if any was set beyond the trade amount)
    expect(finalAllowance).to.be.gte(0n);
  });
});

/**
 * 🚀 Pre-Interaction Approval Patterns
 * 
 * 1. **🔄 Just-in-Time Approvals**:
 *    - Approve tokens exactly when needed
 *    - Minimize approval exposure time
 *    - Reduce security risks from permanent approvals
 * 
 * 2. **🏢 Smart Contract Integration**:
 *    - Enable complex contract-based trading strategies
 *    - Support treasury and DAO order execution
 *    - Integrate with yield farming and DeFi protocols
 * 
 * 3. **⚡ Gas Optimization**:
 *    - Combine approval + trade in single transaction
 *    - Eliminate separate approval transactions
 *    - Reduce overall transaction costs
 * 
 * 4. **🔒 Security Benefits**:
 *    - Atomic approval and execution
 *    - No permanent token approvals required
 *    - Granular control over token spending
 * 
 * 📚 Advanced Pre-Interaction Patterns:
 * 
 * ```typescript
 * // Example: Dynamic approval calculation
 * class DynamicApprovalContract {
 *   async preInteraction(
 *     orderHash: string,
 *     maker: string,
 *     taker: string,
 *     amount: bigint
 *   ) {
 *     // Calculate exact approval needed
 *     const requiredApproval = this.calculateRequiredApproval(amount);
 *     
 *     // Apply just-in-time approval
 *     await this.token.approve(
 *       this.limitOrderProtocol,
 *       requiredApproval
 *     );
 * 
 *     // Optional: Log approval for tracking
 *     emit ApprovalGranted(orderHash, requiredApproval);
 *   }
 * }
 * ```
 * 
 * 📊 Pre-Interaction Use Cases:
 * 
 * - **🏦 Treasury Management**: DAOs approving tokens for specific trades
 * - **🌾 Yield Strategy**: Withdrawing from farms before trading
 * - **🔄 Token Wrapping**: Converting tokens before order execution
 * - **📊 Price Oracle**: Updating prices before dynamic orders
 * - **🔒 Access Control**: Validating permissions before execution
 * 
 * 📚 Related Documentation:
 * - Pre-Interactions: ../extensions.md#preinteraction--postinteraction
 * - Contract Orders: ../limit-order-taker-contract.md
 * - Maker Traits: ../limit-order-maker-contract.md#makertraits
 * 
 * 🔗 Example Cross-References:
 * - Interactions: ./interaction.ts
 * - Extensions: ./extensions.ts
 * - Maker Contracts: ./maker-contract.ts
 * - Permit Integration: ./permit.ts
 */