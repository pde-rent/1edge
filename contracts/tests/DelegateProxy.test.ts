import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther, ZeroAddress } from "ethers";
import { Signer } from "ethers";
import {
  DelegateProxy,
  ERC20Mock,
  MockLimitOrderProtocol,
} from "../typechain-types";
import { buildMockOrder } from "./MockOrder";

describe("DelegateProxy", function () {
  let owner: Signer; // Also acts as keeper
  let user: Signer;
  let alice: Signer;
  let delegateProxy: DelegateProxy;
  let weth: ERC20Mock;
  let inch: ERC20Mock;
  let _1inch: MockLimitOrderProtocol;

  beforeEach(async function () {
    [owner, user, alice] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    weth = await ERC20Mock.deploy("Wrapped Ether", "WETH");
    inch = await ERC20Mock.deploy("1inch", "1INCH");

    // Mint tokens
    await weth.mint(await user.getAddress(), parseEther("10"));
    await inch.mint(await alice.getAddress(), parseEther("10"));

    // Deploy mock limit order protocol
    const MockLimitOrderProtocol = await ethers.getContractFactory(
      "MockLimitOrderProtocol",
    );
    _1inch = await MockLimitOrderProtocol.deploy();

    // Deploy DelegateProxy with owner as deployer
    const DelegateProxy = await ethers.getContractFactory("DelegateProxy");
    delegateProxy =
      await DelegateProxy.connect(owner).deploy(_1inch);

    // Owner (keeper) approves themselves
    await delegateProxy
      .connect(owner)
      .setKeeper(await owner.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should set deployer as owner", async function () {
      expect(await delegateProxy.owner()).to.equal(await owner.getAddress());
    });

    it("Should set keeper correctly", async function () {
      expect(await delegateProxy.keepers(await owner.getAddress())).to.be
        .true;
    });
  });

  describe("Create User Order", function () {
    it("Should not allow unauthorized caller to create order", async function () {
      const order = buildMockOrder({
        maker: await delegateProxy.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: parseEther("1"),
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
      });

      await expect(
        delegateProxy
          .connect(user)
          .create1inchOrder(order, await user.getAddress()),
      ).to.be.revertedWithCustomError(delegateProxy, "Unauthorized");
    });

    it("Should allow keeper to create user order", async function () {
      const wethAmount = parseEther("1");
      await weth
        .connect(user)
        .approve(await delegateProxy.getAddress(), wethAmount);

      const order = buildMockOrder({
        maker: await delegateProxy.getAddress(),
        receiver: await user.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: wethAmount,
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
        makerTraits: 1n << 252n, // Enable pre-interaction
      });

      await expect(
        delegateProxy
          .connect(owner)
          .create1inchOrder(order, await user.getAddress()),
      ).to.emit(delegateProxy, "OrderCreated");
    });

    it("Should reject order with wrong maker", async function () {
      const order = buildMockOrder({
        maker: await user.getAddress(), // Wrong maker
        makerAsset: await weth.getAddress(),
        makingAmount: parseEther("1"),
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
      });

      await expect(
        delegateProxy
          .connect(owner)
          .create1inchOrder(order, await user.getAddress()),
      ).to.be.revertedWithCustomError(delegateProxy, "InvalidOrder");
    });

    it("Should reject mismatched array lengths", async function () {
      const order = buildMockOrder({
        maker: await delegateProxy.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: parseEther("1"),
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
      });

      await expect(
        delegateProxy.connect(owner).create1inchOrderBatch([order], []),
      ).to.be.revertedWithCustomError(delegateProxy, "InvalidOrder");
    });
  });

  describe("Cancel Order", function () {
    it("Should only allow keeper to cancel order", async function () {
      const order = buildMockOrder({
        maker: await delegateProxy.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: parseEther("1"),
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
      });

      await expect(
        delegateProxy.connect(user).cancel1inchOrder(order),
      ).to.be.revertedWithCustomError(delegateProxy, "Unauthorized");
    });
  });

  describe("Order Data Query", function () {
    it("Should return correct order data", async function () {
      const wethAmount = parseEther("2");
      await weth
        .connect(user)
        .approve(await delegateProxy.getAddress(), wethAmount);

      const order = buildMockOrder({
        maker: await delegateProxy.getAddress(),
        receiver: await user.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: wethAmount,
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("2"),
        makerTraits: 1n << 252n, // Enable pre-interaction
      });

      await delegateProxy
        .connect(owner)
        .create1inchOrder(order, await user.getAddress());

      // Get order hash from the mock protocol
      const orderHash = await _1inch.hashOrder(order);

      const orderData = await delegateProxy.getOrderData([orderHash]);
      expect(orderData[0].maker).to.equal(await user.getAddress());
      expect(orderData[0].remainingAmount).to.equal(wethAmount);
      expect(orderData[0].signed).to.be.true;
    });
  });

  describe("Keeper Management", function () {
    it("Should allow owner to add keeper", async function () {
      const newKeeper = alice;
      await delegateProxy
        .connect(owner)
        .setKeeper(await newKeeper.getAddress(), true);
      expect(await delegateProxy.keepers(await newKeeper.getAddress()))
        .to.be.true;
    });

    it("Should allow owner to remove keeper", async function () {
      await delegateProxy
        .connect(owner)
        .setKeeper(await owner.getAddress(), false);
      expect(await delegateProxy.keepers(await owner.getAddress())).to.be
        .false;
    });

    it("Should not allow non-owner to manage keepers", async function () {
      await expect(
        delegateProxy.connect(user).setKeeper(await alice.getAddress(), true),
      ).to.be.revertedWithCustomError(
        delegateProxy,
        "Unauthorized",
      );
    });
  });

  describe("Cancel Order", function () {
    it("Should successfully cancel order", async function () {
      const wethAmount = parseEther("1");
      await weth
        .connect(user)
        .approve(await delegateProxy.getAddress(), wethAmount);

      const order = buildMockOrder({
        maker: await delegateProxy.getAddress(),
        receiver: await user.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: wethAmount,
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
        makerTraits: 1n << 252n,
      });

      // Create order first
      await delegateProxy
        .connect(owner)
        .create1inchOrder(order, await user.getAddress());

      // Cancel order
      await expect(
        delegateProxy.connect(owner).cancel1inchOrder(order)
      ).to.emit(delegateProxy, "OrderCancelled");
    });

    it("Should successfully cancel multiple orders in batch", async function () {
      const wethAmount = parseEther("1");
      await weth
        .connect(user)
        .approve(await delegateProxy.getAddress(), parseEther("3"));

      // Create 3 orders
      const orders = [];
      const makers = [];
      for (let i = 0; i < 3; i++) {
        orders.push(buildMockOrder({
          maker: await delegateProxy.getAddress(),
          receiver: await user.getAddress(),
          makerAsset: await weth.getAddress(),
          makingAmount: wethAmount,
          takerAsset: await inch.getAddress(),
          takingAmount: parseEther("1"),
          makerTraits: 1n << 252n,
          salt: BigInt(i), // Different salt for each order
        }));
        makers.push(await user.getAddress());
      }

      // Create orders first
      await delegateProxy
        .connect(owner)
        .create1inchOrderBatch(orders, makers);

      // Cancel all orders in batch - should emit 3 OrderCancelled events
      await expect(
        delegateProxy.connect(owner).cancel1inchOrderBatch(orders)
      ).to.emit(delegateProxy, "OrderCancelled").and.to.emit(delegateProxy, "OrderCancelled").and.to.emit(delegateProxy, "OrderCancelled");
    });
  });

  describe("Signature Validation", function () {
    it("Should validate signatures for created orders", async function () {
      const wethAmount = parseEther("1");
      await weth
        .connect(user)
        .approve(await delegateProxy.getAddress(), wethAmount);

      const order = buildMockOrder({
        maker: await delegateProxy.getAddress(),
        receiver: await user.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: wethAmount,
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
        makerTraits: 1n << 252n,
      });

      await delegateProxy
        .connect(owner)
        .create1inchOrder(order, await user.getAddress());

      const orderHash = await _1inch.hashOrder(order);
      const result = await delegateProxy.isValidSignature(orderHash, "0x");
      expect(result).to.equal("0x1626ba7e"); // EIP-1271 magic value
    });

    it("Should reject signatures for non-existent orders", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      const result = await delegateProxy.isValidSignature(fakeHash, "0x");
      expect(result).to.equal("0xffffffff"); // Invalid signature
    });
  });

  describe("Interaction Hooks", function () {
    it("Should only allow protocol to call preInteraction", async function () {
      const order = buildMockOrder({
        maker: await delegateProxy.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: parseEther("1"),
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
      });

      const orderHash = ethers.keccak256(ethers.toUtf8Bytes("test"));

      await expect(
        delegateProxy
          .connect(user)
          .preInteraction(order, "0x", orderHash, ZeroAddress, parseEther("1"), 0, 0, "0x")
      ).to.be.revertedWithCustomError(delegateProxy, "Unauthorized");
    });

    it("Should only allow protocol to call postInteraction", async function () {
      const order = buildMockOrder({
        maker: await delegateProxy.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: parseEther("1"),
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
      });

      const orderHash = ethers.keccak256(ethers.toUtf8Bytes("test"));

      await expect(
        delegateProxy
          .connect(user)
          .postInteraction(order, "0x", orderHash, ZeroAddress, 0, 0, 0, "0x")
      ).to.be.revertedWithCustomError(delegateProxy, "Unauthorized");
    });
  });

  describe("Rescue Function", function () {
    const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    it("Should rescue stuck ETH", async function () {
      // Send ETH to the contract
      const ethAmount = parseEther("1");
      await owner.sendTransaction({
        to: await delegateProxy.getAddress(),
        value: ethAmount,
      });

      const ownerBalanceBefore = await ethers.provider.getBalance(await owner.getAddress());

      await expect(
        delegateProxy.connect(owner).rescue(ETH_ADDRESS)
      ).to.changeEtherBalance(owner, ethAmount);
    });

    it("Should rescue stuck ERC20 tokens", async function () {
      // Send tokens to the contract
      const tokenAmount = parseEther("5");
      await weth.connect(user).transfer(await delegateProxy.getAddress(), tokenAmount);

      const ownerBalanceBefore = await weth.balanceOf(await owner.getAddress());

      await delegateProxy.connect(owner).rescue(await weth.getAddress());

      const ownerBalanceAfter = await weth.balanceOf(await owner.getAddress());
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(tokenAmount);
    });

    it("Should revert when rescuing zero ETH balance", async function () {
      await expect(
        delegateProxy.connect(owner).rescue(ETH_ADDRESS)
      ).to.be.revertedWithCustomError(delegateProxy, "InsufficientBalance");
    });

    it("Should revert when rescuing zero token balance", async function () {
      await expect(
        delegateProxy.connect(owner).rescue(await weth.getAddress())
      ).to.be.revertedWithCustomError(delegateProxy, "InsufficientBalance");
    });

    it("Should only allow owner to rescue", async function () {
      // Send ETH to the contract
      await owner.sendTransaction({
        to: await delegateProxy.getAddress(),
        value: parseEther("1"),
      });

      await expect(
        delegateProxy.connect(user).rescue(ETH_ADDRESS)
      ).to.be.revertedWithCustomError(delegateProxy, "Unauthorized");
    });
  });

  describe("Gas Optimization Verification", function () {
    it("Should use minimal gas for batch order creation", async function () {
      const orders = [];
      const makers = [];

      // Create 5 orders
      for (let i = 0; i < 5; i++) {
        orders.push(
          buildMockOrder({
            maker: await delegateProxy.getAddress(),
            makerAsset: await weth.getAddress(),
            makingAmount: parseEther("1"),
            takerAsset: await inch.getAddress(),
            takingAmount: parseEther("1"),
            salt: BigInt(i), // Different salt for each order
          }),
        );
        makers.push(await user.getAddress());
      }

      const tx = await delegateProxy
        .connect(owner)
        .create1inchOrderBatch(orders, makers);
      const receipt = await tx.wait();

      // Verify gas usage is reasonable for batch operation
      console.log(`Gas used for 5 orders: ${receipt!.gasUsed.toString()}`);
      expect(receipt!.gasUsed).to.be.lessThan(600000n); // Should be well under 600k gas
    });
  });

  describe("Integration Flow Tests", function () {
    it("Should execute complete order lifecycle", async function () {
      // Create comprehensive order
      const wethAmount = parseEther("10");
      const inchAmount = parseEther("1000");
      
      await weth.connect(user).approve(await delegateProxy.getAddress(), wethAmount);

      const order = buildMockOrder({
        maker: await delegateProxy.getAddress(),
        receiver: await user.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: wethAmount,
        takerAsset: await inch.getAddress(),
        takingAmount: inchAmount,
        makerTraits: (1n << 252n) | (1n << 251n), // Enable pre and post interaction
        salt: BigInt(Date.now()),
      });

      // 1. Create order
      await delegateProxy
        .connect(owner)
        .create1inchOrder(order, await user.getAddress());

      const orderHash = await _1inch.hashOrder(order);

      // 2. Verify order data
      const orderData = await delegateProxy.getOrderData([orderHash]);
      expect(orderData[0].maker).to.equal(await user.getAddress());
      expect(orderData[0].remainingAmount).to.equal(wethAmount);
      expect(orderData[0].signed).to.be.true;

      // 3. Verify EIP-1271 signature validation
      const isValid = await delegateProxy.isValidSignature(orderHash, "0x");
      expect(isValid).to.equal("0x1626ba7e");

      // 4. Simulate partial fill via postInteraction
      const protocolAddress = await _1inch.getAddress();
      await ethers.provider.send("hardhat_impersonateAccount", [protocolAddress]);
      await ethers.provider.send("hardhat_setBalance", [protocolAddress, "0x1000000000000000000"]);
      const protocolSigner = await ethers.getSigner(protocolAddress);

      const halfAmount = wethAmount / 2n;
      await delegateProxy.connect(protocolSigner).postInteraction(
        order,
        "0x",
        orderHash,
        await user.getAddress(),
        halfAmount,
        inchAmount / 2n,
        halfAmount,
        "0x"
      );

      // Verify partial fill
      const updatedData = await delegateProxy.getOrderData([orderHash]);
      expect(updatedData[0].remainingAmount).to.equal(halfAmount);

      // 5. Complete the fill
      await delegateProxy.connect(protocolSigner).postInteraction(
        order,
        "0x",
        orderHash,
        await user.getAddress(),
        0n,
        0n,
        0n,
        "0x"
      );

      await ethers.provider.send("hardhat_stopImpersonatingAccount", [protocolAddress]);

      // Verify order cleanup
      const finalData = await delegateProxy.getOrderData([orderHash]);
      expect(finalData[0].remainingAmount).to.equal(0n);
      expect(finalData[0].maker).to.equal(ethers.ZeroAddress);
    });

    it("Should handle batch operations efficiently", async function () {
      const orders = [];
      const makers = [];
      const orderCount = 3;
      
      await weth.connect(user).approve(await delegateProxy.getAddress(), parseEther("3"));

      // Create multiple orders
      for (let i = 0; i < orderCount; i++) {
        orders.push(buildMockOrder({
          maker: await delegateProxy.getAddress(),
          receiver: await user.getAddress(),
          makerAsset: await weth.getAddress(),
          makingAmount: parseEther("1"),
          takerAsset: await inch.getAddress(),
          takingAmount: parseEther("100"),
          salt: BigInt(i),
        }));
        makers.push(await user.getAddress());
      }

      // Batch create
      await delegateProxy.connect(owner).create1inchOrderBatch(orders, makers);

      // Verify all orders were created
      const orderHashes = await Promise.all(
        orders.map(order => _1inch.hashOrder(order))
      );
      const orderData = await delegateProxy.getOrderData(orderHashes);
      
      for (let i = 0; i < orderCount; i++) {
        expect(orderData[i].maker).to.equal(await user.getAddress());
        expect(orderData[i].signed).to.be.true;
      }

      // Batch cancel
      await delegateProxy.connect(owner).cancel1inchOrderBatch(orders);

      // Verify all orders were cancelled
      const finalData = await delegateProxy.getOrderData(orderHashes);
      for (let i = 0; i < orderCount; i++) {
        expect(finalData[i].maker).to.equal(ethers.ZeroAddress);
        expect(finalData[i].signed).to.be.false;
      }
    });
  });
});
