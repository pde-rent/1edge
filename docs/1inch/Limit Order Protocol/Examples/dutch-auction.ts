/**
 * 🔥 Dutch Auction Implementation Example
 *
 * This example demonstrates how to create Dutch auction orders using the 1inch Limit Order Protocol.
 * Dutch auctions start at a high price and gradually decrease over time until filled.
 *
 * 📚 Related Documentation:
 * - Dutch Auction Calculator: ../extensions.md#dutch-auction-calculator
 * - Making Amount Data: ../extensions.md#makingamountdata
 * - Taking Amount Data: ../extensions.md#takingamountdata
 *
 * 🎯 Key Features:
 * - Time-based price decay
 * - Proportional amount calculations
 * - Configurable start/end prices
 * - Automatic price updates based on elapsed time
 */

import { expect, time, assertRoughlyEqualValues } from "@1inch/solidity-utils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, HardhatEthersSigner } from "hardhat";
import { ether } from "./helpers/utils";
import { deploySwapTokens } from "./helpers/fixtures";
import { buildOrder, signOrder, buildTakerTraits } from "./helpers/orderUtils";

// 📝 Type definitions for better type safety
interface TestTokens {
  dai: any; // ERC20 token contract
  weth: any; // WETH token contract
}

interface TestContracts {
  swap: any; // LimitOrderProtocol contract
  dutchAuctionCalculator: any; // Dutch auction calculator contract
}

interface TestFixture {
  tokens: TestTokens;
  contracts: TestContracts;
  chainId: number;
  order: any; // Order struct
  signature: string;
  timestamp: bigint;
  balances: {
    makerDaiBefore: bigint;
    takerDaiBefore: bigint;
    makerWethBefore: bigint;
    takerWethBefore: bigint;
  };
}

describe("🔥 Dutch Auction Orders", function () {
  let maker: HardhatEthersSigner;
  let taker: HardhatEthersSigner;

  before(async function () {
    [maker, taker] = await ethers.getSigners();
  });

  /**
   * 🏗️ Deploy contracts and create Dutch auction order
   *
   * Sets up:
   * - DAI and WETH test tokens with initial balances
   * - LimitOrderProtocol swap contract
   * - DutchAuctionCalculator for price decay logic
   * - Dutch auction order with 24-hour duration
   *
   * 💡 Price Structure:
   * - Start Price: 0.1 WETH per 100 DAI (expensive)
   * - End Price: 0.05 WETH per 100 DAI (cheaper)
   * - Duration: 86400 seconds (24 hours)
   */
  async function deployAndBuildDutchAuctionOrder(): Promise<TestFixture> {
    const { dai, weth, swap, chainId } = await deploySwapTokens();

    // 💰 Initialize token balances
    const initialDaiAmount = ether("100");
    const initialWethAmount = ether("1");

    await dai.mint(maker.address, initialDaiAmount);
    await dai.mint(taker.address, initialDaiAmount);
    await weth.connect(maker).deposit({ value: initialWethAmount });
    await weth.connect(taker).deposit({ value: initialWethAmount });

    // ✅ Approve tokens for trading
    await dai.connect(maker).approve(swap.address, initialDaiAmount);
    await dai.connect(taker).approve(swap.address, initialDaiAmount);
    await weth.connect(maker).approve(swap.address, initialWethAmount);
    await weth.connect(taker).approve(swap.address, initialWethAmount);

    // 🏗️ Deploy Dutch Auction Calculator
    const DutchAuctionCalculator = await ethers.getContractFactory(
      "DutchAuctionCalculator",
    );
    const dutchAuctionCalculator = await DutchAuctionCalculator.deploy();
    await dutchAuctionCalculator.waitForDeployment();

    // ⏰ Set auction time parameters
    const currentTimestamp = BigInt(await time.latest());
    const auctionDuration = 86400n; // 24 hours in seconds
    const endTimestamp = currentTimestamp + auctionDuration;

    // 📦 Pack start and end timestamps into single uint256
    const startEndTimestamps = (currentTimestamp << 128n) | endTimestamp;

    // 💵 Define price parameters
    const makingAmount = ether("100"); // 100 DAI
    const startPrice = ether("0.1"); // 0.1 WETH (expensive)
    const endPrice = ether("0.05"); // 0.05 WETH (cheaper)

    // 📝 Create Dutch auction order
    const order = buildOrder(
      {
        makerAsset: await dai.getAddress(),
        takerAsset: await weth.getAddress(),
        makingAmount,
        takingAmount: startPrice, // Initial taking amount (will be calculated dynamically)
        maker: maker.address,
      },
      {
        // 📊 Dynamic making amount calculation
        makingAmountData: ethers.solidityPacked(
          ["address", "uint256", "uint256", "uint256"],
          [
            await dutchAuctionCalculator.getAddress(),
            startEndTimestamps.toString(),
            startPrice,
            endPrice,
          ],
        ),
        // 📈 Dynamic taking amount calculation
        takingAmountData: ethers.solidityPacked(
          ["address", "uint256", "uint256", "uint256"],
          [
            await dutchAuctionCalculator.getAddress(),
            startEndTimestamps.toString(),
            startPrice,
            endPrice,
          ],
        ),
      },
    );

    // ✍️ Sign the order
    const signature = await signOrder(
      order,
      chainId,
      await swap.getAddress(),
      maker,
    );

    // 📊 Record initial balances for comparison
    const balances = {
      makerDaiBefore: await dai.balanceOf(maker.address),
      takerDaiBefore: await dai.balanceOf(taker.address),
      makerWethBefore: await weth.balanceOf(maker.address),
      takerWethBefore: await weth.balanceOf(taker.address),
    };

    return {
      tokens: { dai, weth },
      contracts: { swap, dutchAuctionCalculator },
      chainId,
      order,
      signature,
      timestamp: currentTimestamp,
      balances,
    };
  }

  /**
   * 🔄 Test: Partial fill at 50% auction time
   *
   * Scenario:
   * - Wait until 50% of auction time has passed (12 hours)
   * - Fill 100 DAI (full making amount)
   * - Expected price: 0.075 WETH (halfway between start and end)
   *
   * 📐 Price Calculation:
   * price = startPrice - (elapsed / duration) * (startPrice - endPrice)
   * price = 0.1 - (0.5) * (0.1 - 0.05) = 0.075 WETH
   */
  it("🎯 Fill with making amount at 50% auction progress", async function () {
    const { tokens, contracts, order, signature, timestamp, balances } =
      await loadFixture(deployAndBuildDutchAuctionOrder);

    // ⏰ Advance time to 50% of auction duration
    const halfAuctionTime = 43200n; // 12 hours
    await time.increaseTo(timestamp + halfAuctionTime);

    // 📝 Prepare transaction parameters
    const { r, yParityAndS: vs } = ethers.Signature.from(signature);
    const makingAmount = ether("100"); // Fill entire making amount
    const expectedTakingAmount = ether("0.075"); // Expected price at 50% time

    const takerTraits = buildTakerTraits({
      makingAmount: true, // Use making amount mode
      extension: order.extension,
      threshold: expectedTakingAmount,
    });

    // 🚀 Execute the fill
    await contracts.swap
      .connect(taker)
      .fillOrderArgs(
        order,
        r,
        vs,
        makingAmount,
        takerTraits.traits,
        takerTraits.args,
      );

    // ✅ Verify token transfers
    expect(await tokens.dai.balanceOf(maker.address)).to.equal(
      balances.makerDaiBefore - makingAmount,
    );
    expect(await tokens.dai.balanceOf(taker.address)).to.equal(
      balances.takerDaiBefore + makingAmount,
    );

    // 📊 Verify WETH transfers (with small tolerance for precision)
    assertRoughlyEqualValues(
      await tokens.weth.balanceOf(maker.address),
      balances.makerWethBefore + expectedTakingAmount,
      1e-6,
    );
    assertRoughlyEqualValues(
      await tokens.weth.balanceOf(taker.address),
      balances.takerWethBefore - expectedTakingAmount,
      1e-6,
    );
  });

  /**
   * 🔄 Test: Fill with taking amount at 50% auction time
   *
   * Scenario:
   * - Wait until 50% of auction time has passed
   * - Specify exact taking amount (0.075 WETH)
   * - System calculates proportional making amount (100 DAI)
   */
  it("🎯 Fill with taking amount at 50% auction progress", async function () {
    const { tokens, contracts, order, signature, timestamp, balances } =
      await loadFixture(deployAndBuildDutchAuctionOrder);

    // ⏰ Advance time to 50% of auction duration
    await time.increaseTo(timestamp + 43200n);

    const { r, yParityAndS: vs } = ethers.Signature.from(signature);
    const takingAmount = ether("0.075"); // Specify exact taking amount
    const expectedMakingAmount = ether("100"); // Expected proportional making amount

    const takerTraits = buildTakerTraits({
      extension: order.extension,
      threshold: expectedMakingAmount,
    });

    // 🚀 Execute the fill
    await contracts.swap
      .connect(taker)
      .fillOrderArgs(
        order,
        r,
        vs,
        takingAmount,
        takerTraits.traits,
        takerTraits.args,
      );

    // ✅ Verify transfers
    expect(await tokens.dai.balanceOf(maker.address)).to.equal(
      balances.makerDaiBefore - expectedMakingAmount,
    );
    expect(await tokens.dai.balanceOf(taker.address)).to.equal(
      balances.takerDaiBefore + expectedMakingAmount,
    );

    assertRoughlyEqualValues(
      await tokens.weth.balanceOf(maker.address),
      balances.makerWethBefore + takingAmount,
      1e-6,
    );
    assertRoughlyEqualValues(
      await tokens.weth.balanceOf(taker.address),
      balances.takerWethBefore - takingAmount,
      1e-6,
    );
  });

  /**
   * 🔄 Test: Fill at auction start (0% time passed)
   *
   * Scenario:
   * - Fill immediately at auction start
   * - Price should be at maximum (start price)
   * - Expected price: 0.1 WETH for 100 DAI
   */
  it("🎯 Fill at auction start (maximum price)", async function () {
    const { tokens, contracts, order, signature, balances } = await loadFixture(
      deployAndBuildDutchAuctionOrder,
    );

    const { r, yParityAndS: vs } = ethers.Signature.from(signature);
    const makingAmount = ether("100");
    const startPrice = ether("0.1"); // Maximum price

    const takerTraits = buildTakerTraits({
      makingAmount: true,
      extension: order.extension,
      threshold: startPrice,
    });

    // 🚀 Execute at start price
    await contracts.swap
      .connect(taker)
      .fillOrderArgs(
        order,
        r,
        vs,
        makingAmount,
        takerTraits.traits,
        takerTraits.args,
      );

    // ✅ Verify transfers at start price
    expect(await tokens.dai.balanceOf(maker.address)).to.equal(
      balances.makerDaiBefore - makingAmount,
    );
    expect(await tokens.dai.balanceOf(taker.address)).to.equal(
      balances.takerDaiBefore + makingAmount,
    );

    assertRoughlyEqualValues(
      await tokens.weth.balanceOf(maker.address),
      balances.makerWethBefore + startPrice,
      1e-6,
    );
    assertRoughlyEqualValues(
      await tokens.weth.balanceOf(taker.address),
      balances.takerWethBefore - startPrice,
      1e-6,
    );
  });

  /**
   * 🔄 Test: Fill after auction end (100%+ time passed)
   *
   * Scenario:
   * - Wait until after auction end (>24 hours)
   * - Price should be at minimum (end price)
   * - Expected price: 0.05 WETH for 100 DAI
   */
  it("🎯 Fill after auction end (minimum price)", async function () {
    const { tokens, contracts, order, signature, timestamp, balances } =
      await loadFixture(deployAndBuildDutchAuctionOrder);

    // ⏰ Advance time beyond auction end
    await time.increaseTo(timestamp + 86500n); // >24 hours

    const { r, yParityAndS: vs } = ethers.Signature.from(signature);
    const makingAmount = ether("100");
    const endPrice = ether("0.05"); // Minimum price

    const takerTraits = buildTakerTraits({
      makingAmount: true,
      extension: order.extension,
      threshold: endPrice,
    });

    // 🚀 Execute at end price
    await contracts.swap
      .connect(taker)
      .fillOrderArgs(
        order,
        r,
        vs,
        makingAmount,
        takerTraits.traits,
        takerTraits.args,
      );

    // ✅ Verify transfers at end price
    expect(await tokens.dai.balanceOf(maker.address)).to.equal(
      balances.makerDaiBefore - makingAmount,
    );
    expect(await tokens.dai.balanceOf(taker.address)).to.equal(
      balances.takerDaiBefore + makingAmount,
    );

    assertRoughlyEqualValues(
      await tokens.weth.balanceOf(maker.address),
      balances.makerWethBefore + endPrice,
      1e-6,
    );
    assertRoughlyEqualValues(
      await tokens.weth.balanceOf(taker.address),
      balances.takerWethBefore - endPrice,
      1e-6,
    );
  });
});

/**
 * 📚 Additional Resources:
 *
 * - 📖 Dutch Auction Documentation: ../extensions.md#dutch-auction-calculator
 * - 🏗️ Order Building Guide: ../limit-order-maker-contract.md
 * - 🎛️ Maker Traits Configuration: ../limit-order-maker-contract.md#makertraits
 * - ⚡ Taker Traits Configuration: ../limit-order-taker-contract.md
 *
 * 💡 Key Concepts:
 * - Time-based price decay creates urgency for takers
 * - Dutch auctions are ideal for price discovery
 * - Suitable for NFT sales, token launches, and liquidations
 * - Can be combined with other extensions for complex strategies
 */
