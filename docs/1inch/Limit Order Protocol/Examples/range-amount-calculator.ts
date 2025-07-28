/**
 * 📊 Range Amount Calculator Example
 * 
 * This example demonstrates advanced amount calculation strategies using
 * range-based pricing and dynamic amount computation in the 1inch Limit Order Protocol.
 * 
 * 📚 Related Documentation:
 * - Dynamic Pricing: ../extensions.md#makingamountdata--takingamountdata
 * - Amount Calculations: ../limit-order-maker-contract.md#amount-calculation-methods
 * - Extensions Guide: ../extensions.md
 * - Maker Contract: ../limit-order-maker-contract.md
 * 
 * 🎯 Key Features:
 * - Range-based amount calculations
 * - Dynamic pricing based on external factors
 * - Proportional fill calculations
 * - Advanced mathematical order strategies
 */

import { expect } from '@1inch/solidity-utils';
import { ethers, HardhatEthersSigner } from 'hardhat';
import { deploySwapTokens } from './helpers/fixtures';
import { ether } from './helpers/utils';
import {
  buildOrder,
  signOrder,
  buildTakerTraits,
  buildMakerTraits,
  calcTakingAmount,
  calcMakingAmount,
} from './helpers/orderUtils';

// 📝 Type definitions for range calculator testing
interface TestTokens {
  dai: any; // ERC20 DAI token contract
  weth: any; // WETH token contract
  usdc: any; // USDC token contract
}

interface TestContracts {
  swap: any; // LimitOrderProtocol contract
  rangeCalculator: any; // Range amount calculator contract
}

interface RangeCalculatorFixture {
  tokens: TestTokens;
  contracts: TestContracts;
  chainId: number;
  accounts: {
    maker: HardhatEthersSigner;
    taker: HardhatEthersSigner;
  };
}

interface PriceRange {
  minPrice: bigint;
  maxPrice: bigint;
  currentPrice: bigint;
}

interface AmountCalculation {
  baseAmount: bigint;
  calculatedAmount: bigint;
  priceRatio: bigint;
}

describe('📊 Range Amount Calculator Strategies', function () {
  let maker: HardhatEthersSigner;
  let taker: HardhatEthersSigner;

  before(async function () {
    [maker, taker] = await ethers.getSigners();
  });

  /**
   * 🏗️ Deploy range calculator system
   * 
   * Sets up:
   * - Multiple test tokens (DAI, WETH, USDC)
   * - LimitOrderProtocol swap contract
   * - RangeAmountCalculator for dynamic pricing
   * - Initial token balances and approvals
   */
  async function deployRangeCalculatorSystem(): Promise<RangeCalculatorFixture> {
    const { dai, weth, swap, chainId } = await deploySwapTokens();
    
    // 🏗️ Deploy USDC for multi-token testing
    const USDCToken = await ethers.getContractFactory('ERC20Token');
    const usdc = await USDCToken.deploy('USD Coin', 'USDC', 6); // 6 decimals
    await usdc.waitForDeployment();

    // 🏗️ Deploy Range Amount Calculator
    const RangeAmountCalculator = await ethers.getContractFactory('RangeAmountCalculator');
    const rangeCalculator = await RangeAmountCalculator.deploy();
    await rangeCalculator.waitForDeployment();

    // 💰 Initialize substantial token balances
    const daiAmount = ether('1000000');
    const wethAmount = ether('1000');
    const usdcAmount = 1000000n * 10n ** 6n; // 1M USDC with 6 decimals

    // Mint tokens to both accounts
    await dai.mint(maker.address, daiAmount);
    await dai.mint(taker.address, daiAmount);
    await weth.connect(maker).deposit({ value: wethAmount });
    await weth.connect(taker).deposit({ value: wethAmount });
    await usdc.mint(maker.address, usdcAmount);
    await usdc.mint(taker.address, usdcAmount);

    // ✅ Approve tokens for trading
    await dai.connect(maker).approve(swap.address, daiAmount);
    await dai.connect(taker).approve(swap.address, daiAmount);
    await weth.connect(maker).approve(swap.address, wethAmount);
    await weth.connect(taker).approve(swap.address, wethAmount);
    await usdc.connect(maker).approve(swap.address, usdcAmount);
    await usdc.connect(taker).approve(swap.address, usdcAmount);

    return {
      tokens: { dai, weth, usdc },
      contracts: { swap, rangeCalculator },
      chainId,
      accounts: { maker, taker },
    };
  }

  /**
   * 🧮 Test: Proportional Amount Calculations
   * 
   * Scenario:
   * - Create order with 100 DAI → 0.1 WETH
   * - Calculate proportional amounts for partial fills
   * - Verify mathematical precision in calculations
   * 
   * 💡 Use Case:
   * Ensuring accurate proportional fills for large orders
   */
  it('🧮 Calculate proportional amounts for partial fills', async function () {
    const { tokens } = await deployRangeCalculatorSystem();

    // 📐 Define base order parameters
    const orderMakerAmount = ether('100'); // 100 DAI
    const orderTakerAmount = ether('0.1');  // 0.1 WETH
    
    // 🎯 Test various partial fill scenarios
    const testCases = [
      {
        fillPercent: 25,
        swapMakerAmount: ether('25'),   // 25% of 100 DAI
        expectedTaking: ether('0.025'), // 25% of 0.1 WETH
      },
      {
        fillPercent: 50,
        swapMakerAmount: ether('50'),   // 50% of 100 DAI
        expectedTaking: ether('0.05'),  // 50% of 0.1 WETH
      },
      {
        fillPercent: 75,
        swapMakerAmount: ether('75'),   // 75% of 100 DAI
        expectedTaking: ether('0.075'), // 75% of 0.1 WETH
      },
    ];

    for (const testCase of testCases) {
      // 📊 Calculate taking amount for given making amount
      const calculatedTaking = calcTakingAmount(
        testCase.swapMakerAmount,
        orderMakerAmount,
        orderTakerAmount
      );

      // ✅ Verify calculation accuracy
      expect(calculatedTaking).to.equal(testCase.expectedTaking);

      // 🔄 Reverse calculation: making amount from taking amount
      const calculatedMaking = calcMakingAmount(
        testCase.expectedTaking,
        orderMakerAmount,
        orderTakerAmount
      );

      // ✅ Verify reverse calculation
      expect(calculatedMaking).to.equal(testCase.swapMakerAmount);
    }
  });

  /**
   * 📈 Test: Range-Based Dynamic Pricing
   * 
   * Scenario:
   * - Define price range (min: $1800, max: $2200, current: $2000)
   * - Create order with dynamic pricing based on current position in range
   * - Execute order and verify price calculation
   * 
   * 💡 Use Case:
   * Dynamic market making with price bands
   */
  it('📈 Execute order with range-based dynamic pricing', async function () {
    const { tokens, contracts, chainId } = await deployRangeCalculatorSystem();
    const { dai, weth } = tokens;
    const { swap, rangeCalculator } = contracts;

    // 📊 Define price range for ETH/USD
    const priceRange: PriceRange = {
      minPrice: ether('1800'), // $1800 minimum
      maxPrice: ether('2200'), // $2200 maximum  
      currentPrice: ether('2000'), // $2000 current
    };

    // 🧮 Calculate position in range (0-100%)
    const rangePosition = 
      ((priceRange.currentPrice - priceRange.minPrice) * 100n) / 
      (priceRange.maxPrice - priceRange.minPrice);
    
    // Position should be 50% ((2000-1800)/(2200-1800) = 200/400 = 50%)
    expect(rangePosition).to.equal(50n);

    // 📝 Create order with range-based pricing
    const baseAmount = ether('1'); // 1 WETH base
    const baseDaiValue = priceRange.currentPrice; // $2000 worth of DAI

    const order = buildOrder(
      {
        makerAsset: await weth.getAddress(),
        takerAsset: await dai.getAddress(),
        makingAmount: baseAmount,
        takingAmount: baseDaiValue,
        maker: maker.address,
      },
      {
        // 🔧 Use range calculator for dynamic pricing
        makingAmountData: ethers.solidityPacked(
          ['address', 'uint256', 'uint256', 'uint256'],
          [
            await rangeCalculator.getAddress(),
            priceRange.minPrice,
            priceRange.maxPrice,
            priceRange.currentPrice,
          ]
        ),
      }
    );

    const signature = await signOrder(order, chainId, await swap.getAddress(), maker);

    // 💰 Capture balances before execution
    const balancesBefore = {
      makerWeth: await weth.balanceOf(maker.address),
      takerWeth: await weth.balanceOf(taker.address),
      makerDai: await dai.balanceOf(maker.address),
      takerDai: await dai.balanceOf(taker.address),
    };

    // 🚀 Execute order with range-based pricing
    const { r, yParityAndS: vs } = ethers.Signature.from(signature);
    const takerTraits = buildTakerTraits({
      makingAmount: true,
      extension: order.extension,
      threshold: baseDaiValue, // Accept current price
    });

    await swap.connect(taker).fillOrderArgs(
      order,
      r,
      vs,
      baseAmount,
      takerTraits.traits,
      takerTraits.args
    );

    // ✅ Verify range-based execution
    expect(await weth.balanceOf(maker.address))
      .to.equal(balancesBefore.makerWeth - baseAmount);
    expect(await weth.balanceOf(taker.address))
      .to.equal(balancesBefore.takerWeth + baseAmount);
    expect(await dai.balanceOf(maker.address))
      .to.equal(balancesBefore.makerDai + baseDaiValue);
    expect(await dai.balanceOf(taker.address))
      .to.equal(balancesBefore.takerDai - baseDaiValue);
  });

  /**
   * 📊 Test: Multi-Token Range Calculations
   * 
   * Scenario:
   * - Create triangular arbitrage scenario (DAI → USDC → WETH)
   * - Use range calculator for each leg of the trade
   * - Verify cross-token rate calculations
   * 
   * 💡 Use Case:
   * Complex arbitrage strategies with multiple hops
   */
  it('📊 Execute multi-token range calculation strategy', async function () {
    const { tokens, contracts, chainId } = await deployRangeCalculatorSystem();
    const { dai, weth, usdc } = tokens;
    const { swap, rangeCalculator } = contracts;

    // 📐 Define exchange rates
    const daiUsdcRate = 1000000n; // 1 DAI = 1 USDC (6 decimals)
    const usdcWethRate = ether('0.0005'); // 1 USDC = 0.0005 WETH

    // 📝 Create first leg: DAI → USDC
    const firstLegAmount = ether('1000'); // 1000 DAI
    const expectedUsdcAmount = 1000n * 10n ** 6n; // 1000 USDC

    const daiUsdcOrder = buildOrder({
      makerAsset: await dai.getAddress(),
      takerAsset: await usdc.getAddress(),
      makingAmount: firstLegAmount,
      takingAmount: expectedUsdcAmount,
      maker: maker.address,
      makerTraits: buildMakerTraits({ nonce: 1 }),
    });

    // 📝 Create second leg: USDC → WETH  
    const secondLegAmount = expectedUsdcAmount;
    const expectedWethAmount = (expectedUsdcAmount * usdcWethRate) / (10n ** 6n); // Adjust for USDC decimals

    const usdcWethOrder = buildOrder({
      makerAsset: await usdc.getAddress(),
      takerAsset: await weth.getAddress(),
      makingAmount: secondLegAmount,
      takingAmount: expectedWethAmount,
      maker: maker.address,
      makerTraits: buildMakerTraits({ nonce: 2 }),
    });

    // ✍️ Sign both orders
    const firstSignature = await signOrder(daiUsdcOrder, chainId, await swap.getAddress(), maker);
    const secondSignature = await signOrder(usdcWethOrder, chainId, await swap.getAddress(), maker);

    // 💰 Capture initial balances
    const initialBalances = {
      makerDai: await dai.balanceOf(maker.address),
      makerUsdc: await usdc.balanceOf(maker.address),
      makerWeth: await weth.balanceOf(maker.address),
      takerDai: await dai.balanceOf(taker.address),
      takerUsdc: await usdc.balanceOf(taker.address),
      takerWeth: await weth.balanceOf(taker.address),
    };

    // 🚀 Execute first leg: DAI → USDC
    const { r: r1, yParityAndS: vs1 } = ethers.Signature.from(firstSignature);
    const firstTraits = buildTakerTraits({
      threshold: expectedUsdcAmount,
      makingAmount: true,
    });

    await swap.connect(taker).fillOrderArgs(
      daiUsdcOrder,
      r1,
      vs1,
      firstLegAmount,
      firstTraits.traits,
      firstTraits.args
    );

    // 🚀 Execute second leg: USDC → WETH
    const { r: r2, yParityAndS: vs2 } = ethers.Signature.from(secondSignature);
    const secondTraits = buildTakerTraits({
      threshold: expectedWethAmount,
      makingAmount: true,
    });

    await swap.connect(taker).fillOrderArgs(
      usdcWethOrder,
      r2,
      vs2,
      secondLegAmount,
      secondTraits.traits,
      secondTraits.args
    );

    // ✅ Verify complete arbitrage chain
    const finalBalances = {
      makerDai: await dai.balanceOf(maker.address),
      makerUsdc: await usdc.balanceOf(maker.address),
      makerWeth: await weth.balanceOf(maker.address),
      takerDai: await dai.balanceOf(taker.address),
      takerUsdc: await usdc.balanceOf(taker.address),
      takerWeth: await weth.balanceOf(taker.address),
    };

    // Maker should have: -DAI, -USDC, +WETH
    expect(finalBalances.makerDai).to.equal(initialBalances.makerDai - firstLegAmount);
    expect(finalBalances.makerUsdc).to.equal(initialBalances.makerUsdc - secondLegAmount);
    expect(finalBalances.makerWeth).to.equal(initialBalances.makerWeth + expectedWethAmount);

    // Taker should have: +DAI, +USDC, -WETH
    expect(finalBalances.takerDai).to.equal(initialBalances.takerDai + firstLegAmount);
    expect(finalBalances.takerUsdc).to.equal(initialBalances.takerUsdc + secondLegAmount);
    expect(finalBalances.takerWeth).to.equal(initialBalances.takerWeth - expectedWethAmount);
  });

  /**
   * 🎯 Test: Precision in Large Number Calculations
   * 
   * Scenario:
   * - Test calculations with very large amounts
   * - Verify precision is maintained in edge cases
   * - Test boundary conditions and overflow protection
   * 
   * 💡 Use Case:
   * Institutional-scale trades with high precision requirements
   */
  it('🎯 Maintain precision in large-scale calculations', async function () {
    // 📊 Test with large amounts (institutional scale)
    const largeMakerAmount = ether('1000000'); // 1M tokens
    const largeTakerAmount = ether('500000');  // 500K tokens
    
    // 🧮 Test various large partial fills
    const largeFillTests = [
      {
        description: 'Small percentage of large order',
        fillAmount: ether('1000'), // 0.1% of 1M
        expected: ether('500'),    // Proportional result
      },
      {
        description: 'Large percentage of large order', 
        fillAmount: ether('900000'), // 90% of 1M
        expected: ether('450000'),   // Proportional result
      },
      {
        description: 'Precise fractional fill',
        fillAmount: ether('333333'), // 1/3 of 1M
        expected: ether('166666.5'), // Exact 1/3 proportion
      },
    ];

    for (const test of largeFillTests) {
      // 📊 Calculate with high precision
      const calculated = calcTakingAmount(
        test.fillAmount,
        largeMakerAmount,
        largeTakerAmount
      );

      // ✅ Verify precision within acceptable tolerance
      const tolerance = ether('0.1'); // 0.1 token tolerance
      const difference = calculated > test.expected 
        ? calculated - test.expected 
        : test.expected - calculated;
      
      expect(difference).to.be.lte(tolerance);
    }
  });
});

/**
 * 🚀 Range Amount Calculator Best Practices
 * 
 * 1. **🧮 Mathematical Precision**:
 *    - Use high-precision arithmetic for calculations
 *    - Account for token decimal differences
 *    - Implement proper rounding strategies
 *    - Test edge cases and boundary conditions
 * 
 * 2. **📊 Dynamic Pricing Strategies**:
 *    - Implement price range validation
 *    - Use time-weighted calculations when appropriate
 *    - Consider volatility in range definitions
 *    - Monitor price oracle reliability
 * 
 * 3. **⚡ Gas Optimization**:
 *    - Pre-calculate static values off-chain
 *    - Use efficient mathematical operations
 *    - Minimize storage reads in calculations
 *    - Batch related calculations together
 * 
 * 4. **🔒 Security Considerations**:
 *    - Validate input ranges and boundaries
 *    - Implement overflow protection
 *    - Use safe math libraries
 *    - Audit calculation logic thoroughly
 * 
 * 📚 Advanced Calculation Patterns:
 * 
 * ```typescript
 * // Example: Volatility-adjusted pricing
 * class VolatilityPricingCalculator {
 *   calculateDynamicAmount(
 *     baseAmount: bigint,
 *     volatility: bigint,
 *     timeDecay: bigint
 *   ): bigint {
 *     // Implement sophisticated pricing model
 *     const volatilityAdjustment = (baseAmount * volatility) / 10000n;
 *     const timeAdjustment = (volatilityAdjustment * timeDecay) / 3600n;
 *     
 *     return baseAmount + volatilityAdjustment - timeAdjustment;
 *   }
 * 
 *   validatePriceRange(
 *     price: bigint,
 *     minPrice: bigint,
 *     maxPrice: bigint
 *   ): boolean {
 *     return price >= minPrice && price <= maxPrice;
 *   }
 * }
 * ```
 * 
 * 📚 Related Documentation:
 * - Amount Calculations: ../limit-order-maker-contract.md#amount-calculation-methods
 * - Dynamic Pricing: ../extensions.md#makingamountdata--takingamountdata
 * - Order Building: ../limit-order-maker-contract.md
 * 
 * 🔗 Example Cross-References:
 * - Dutch Auctions: ./dutch-auction.ts
 * - Extensions: ./extensions.ts
 * - Limit Orders: ./limit-order.ts
 * - Interactions: ./interaction.ts
 */