/**
 * 🔧 Extension System Example
 *
 * This example demonstrates how to use the Extension system to parse and work with
 * custom data in 1inch Limit Order Protocol orders.
 *
 * 📚 Related Documentation:
 * - Extension Overview: ../extensions.md
 * - Extension Class: ../extensions.md#extension-class
 * - Extension Properties: ../extensions.md#extension-properties
 * - ExtensionBuilder: ../extensions.md#extensionbuilder-class
 *
 * 🎯 Key Features:
 * - Custom data parsing from order extensions
 * - Empty extension handling
 * - Extension validation and testing
 * - Modular extension building
 */

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "@1inch/solidity-utils";
import { ethers, HardhatEthersSigner } from "hardhat";
import { buildOrder } from "./helpers/orderUtils";

// 📝 Type definitions for extension testing
interface ExtensionTestFixture {
  extensionMock: any; // Mock contract for testing extensions
}

interface TestOrder {
  maker: string;
  receiver: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  extension?: string;
}

describe("🔧 Extension System Integration", function () {
  let testAddress: HardhatEthersSigner;

  before(async function () {
    [testAddress] = await ethers.getSigners();
  });

  /**
   * 🏗️ Deploy Extension Mock Contract
   *
   * Sets up a mock contract that can parse extension data from orders.
   * This simulates how real contracts would interact with order extensions.
   */
  async function deployExtensionMock(): Promise<ExtensionTestFixture> {
    const ExtensionMock = await ethers.getContractFactory("ExtensionMock");
    const extensionMock = await ExtensionMock.deploy();
    await extensionMock.waitForDeployment();

    return { extensionMock };
  }

  /**
   * 📄 Test: Empty Custom Data Parsing
   *
   * Scenario:
   * - Create order with post-interaction but no custom data
   * - Verify extension parser returns empty bytes
   * - Demonstrates default extension behavior
   *
   * 💡 Use Case:
   * Orders that use interactions but don't need custom application data
   */
  it("🔍 Parse empty custom data from extension", async function () {
    const { extensionMock } = await loadFixture(deployExtensionMock);

    // 📝 Create order with post-interaction but no custom data
    const orderConfig: TestOrder = {
      maker: testAddress.address,
      receiver: testAddress.address,
      makerAsset: testAddress.address,
      takerAsset: testAddress.address,
      makingAmount: "0",
      takingAmount: "0",
    };

    const extensionConfig = {
      postInteraction: testAddress.address, // Has post-interaction
      // No customData specified - should result in empty bytes
    };

    const order = buildOrder(orderConfig, extensionConfig);

    // 🔍 Extract custom data from extension
    const customData = await extensionMock.getCustomData(order.extension);

    // ✅ Verify empty custom data
    expect(customData).to.be.equal("0x");
  });

  /**
   * 📦 Test: Non-empty Custom Data Parsing
   *
   * Scenario:
   * - Create order with predicate and custom data
   * - Verify extension parser correctly extracts custom data
   * - Demonstrates custom data preservation through extensions
   *
   * 💡 Use Case:
   * Orders that include application-specific metadata or configuration
   */
  it("📦 Parse non-empty custom data from extension", async function () {
    const { extensionMock } = await loadFixture(deployExtensionMock);

    const orderConfig: TestOrder = {
      maker: testAddress.address,
      receiver: testAddress.address,
      makerAsset: testAddress.address,
      takerAsset: testAddress.address,
      makingAmount: "0",
      takingAmount: "0",
    };

    // 🔧 Extension with predicate and custom data
    const customPayload = "0x1234";
    const extensionConfig = {
      predicate: testAddress.address, // Conditional execution logic
      customData: customPayload, // Application-specific data
    };

    const order = buildOrder(orderConfig, extensionConfig);

    // 🔍 Extract and verify custom data
    const extractedCustomData = await extensionMock.getCustomData(
      order.extension,
    );

    // ✅ Verify custom data matches input
    expect(extractedCustomData).to.be.equal(customPayload);
  });

  /**
   * 🎯 Test: Custom Data Only Extension
   *
   * Scenario:
   * - Create order with only custom data (no other extension components)
   * - Verify parser correctly handles minimal extension
   * - Demonstrates pure custom data extensions
   *
   * 💡 Use Case:
   * Simple metadata storage without complex extension logic
   */
  it("🎯 Parse custom data when all other extension fields are empty", async function () {
    const { extensionMock } = await loadFixture(deployExtensionMock);

    const orderConfig: TestOrder = {
      maker: testAddress.address,
      receiver: testAddress.address,
      makerAsset: testAddress.address,
      takerAsset: testAddress.address,
      makingAmount: "0",
      takingAmount: "0",
    };

    // 📱 Extension with only custom data
    const customMetadata = "0x123456781234";
    const extensionConfig = {
      customData: customMetadata, // Only custom data, no other components
    };

    const order = buildOrder(orderConfig, extensionConfig);

    // 🔍 Extract custom data from minimal extension
    const extractedCustomData = await extensionMock.getCustomData(
      order.extension,
    );

    // ✅ Verify custom data integrity
    expect(extractedCustomData).to.be.equal(customMetadata);
  });
});

/**
 * 🚀 Extension System Best Practices
 *
 * 1. **📦 Data Validation**:
 *    - Always validate custom data format before using
 *    - Handle empty extensions gracefully
 *    - Use try-catch for extension parsing
 *
 * 2. **🔧 Extension Design**:
 *    - Keep custom data minimal for gas efficiency
 *    - Use structured encoding (ABI encoding) for complex data
 *    - Document custom data formats for integration
 *
 * 3. **⚡ Gas Optimization**:
 *    - Minimize extension complexity
 *    - Use Extension.isEmpty() to avoid unnecessary processing
 *    - Consider using Extension.keccak256() for data verification
 *
 * 📚 Related Examples:
 * - Dutch Auction: ./dutch-auction.ts
 * - Interactions: ./interaction.ts
 * - Limit Orders: ./limit-order.ts
 *
 * 🔗 Documentation Links:
 * - Extension Guide: ../extensions.md
 * - Order Building: ../limit-order-maker-contract.md
 * - Taker Implementation: ../limit-order-taker-contract.md
 */
