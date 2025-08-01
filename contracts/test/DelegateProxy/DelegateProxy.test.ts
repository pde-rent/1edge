import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther, ZeroAddress } from "ethers";
import { Signer } from "ethers";
import { DelegateProxy, ERC20Mock, LimitOrderProtocol } from "../../typechain-types";
import { buildMockOrder } from "../MockOrder";

describe("DelegateProxy", function () {

  let delegateOwner: Signer;
  let bobTheCreator: Signer;
  let approvedKeeper: Signer;
  let alice: Signer;
  let delegateProxy: DelegateProxy;
  let weth: ERC20Mock;
  let inch: ERC20Mock;
  let limitOrderProtocol: LimitOrderProtocol;


  beforeEach(async function () {
    [delegateOwner, bobTheCreator, approvedKeeper, alice] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    weth = await ERC20Mock.deploy("Wrapped Ether", "WETH");
    inch = await ERC20Mock.deploy("1inch", "1INCH");

    // Mint some tokens to the user
    await weth.mint(bobTheCreator.getAddress(), parseEther("10"));
    await inch.mint(alice.getAddress(), parseEther("10"));

    // limit order protocol
    const LimitOrderProtocol = await ethers.getContractFactory('LimitOrderProtocol');
    limitOrderProtocol = await LimitOrderProtocol.deploy(ZeroAddress);

    // Deploy Delegate Proxy
    const DelegateProxy = await ethers.getContractFactory("DelegateProxy");
    delegateProxy = await DelegateProxy.deploy(limitOrderProtocol);
  })

  describe("Create User Order", function () {
    it("Should not allow unapproved keeper to create user order", async function () {
      await expect(
        delegateProxy.connect(approvedKeeper).createUserOrder([{
          order: buildMockOrder(), 
          orderCreator: bobTheCreator.getAddress() 
        }])
      ).to.be.revertedWithCustomError(delegateProxy, "CallerNotApprovedKeeper");
    });

    it("Should allow only approved keeper to create user order", async function () {
      await delegateProxy.connect(delegateOwner).approveKeeper(approvedKeeper.getAddress());
      let wethAmount = parseEther("1");
      await weth.connect(bobTheCreator).approve(delegateProxy.getAddress(), wethAmount);
      await delegateProxy.connect(approvedKeeper).createUserOrder([{
        order: buildMockOrder({
          makerAsset: await weth.getAddress(),
          makingAmount: wethAmount,
          takerAsset: await inch.getAddress(),
          takingAmount: parseEther("1"),
          maker: await delegateProxy.getAddress()
        }), 
        orderCreator: bobTheCreator.getAddress() 
      }])
    });

    it("Should not create order with wrong maker", async function () {
      await delegateProxy.connect(delegateOwner).approveKeeper(await approvedKeeper.getAddress());
      const wethAmount = parseEther("1");
      await weth.connect(bobTheCreator).approve(delegateProxy.getAddress(), wethAmount);
      const oneInchOrder = buildMockOrder({
        receiver: await bobTheCreator.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: wethAmount,
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
      });

      await expect(
        delegateProxy.connect(approvedKeeper).createUserOrder([{
          order: oneInchOrder,
          orderCreator: await bobTheCreator.getAddress()
        }])
      ).to.be.revertedWithCustomError(delegateProxy, "CanNotMakeOrder");
    });
  });

  describe("Fill User Order", function () {
    it("Should fill", async function () {
      await delegateProxy.connect(delegateOwner).approveKeeper(await approvedKeeper.getAddress());
      const wethAmount = parseEther("1");
      await weth.connect(bobTheCreator).approve(delegateProxy.getAddress(), wethAmount);
      const oneInchOrder = buildMockOrder({
        maker: await delegateProxy.getAddress(),
        receiver: await bobTheCreator.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: wethAmount,
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
      });

      await delegateProxy.connect(approvedKeeper).createUserOrder([{
        order: oneInchOrder,
        orderCreator: await bobTheCreator.getAddress()
      }]);
      const inchAmount = parseEther("1")
      await inch.connect(alice).approve(limitOrderProtocol, inchAmount);
      await limitOrderProtocol.connect(alice).fillContractOrder(oneInchOrder, "0x", inchAmount, 0);
    });

    it("Should not fill after cancel", async function () {
      await delegateProxy.connect(delegateOwner).approveKeeper(await approvedKeeper.getAddress());
      const wethAmount = parseEther("1");
      await weth.connect(bobTheCreator).approve(delegateProxy.getAddress(), wethAmount);
      const oneInchOrder = buildMockOrder({
          maker: await delegateProxy.getAddress(),
          receiver: await bobTheCreator.getAddress(),
          makerAsset: await weth.getAddress(),
          makingAmount: wethAmount,
          takerAsset: await inch.getAddress(),
          takingAmount: parseEther("1"),
        });

      await delegateProxy.connect(approvedKeeper).createUserOrder([{
        order: oneInchOrder,
        orderCreator: await bobTheCreator.getAddress()
      }]);
      
      await delegateProxy.connect(approvedKeeper).cancelOrder(oneInchOrder);
      const inchAmount = parseEther("1");
      await inch.mint(alice.getAddress(), inchAmount);
      await inch.connect(alice).approve(limitOrderProtocol, inchAmount);
      await expect(
        limitOrderProtocol.connect(alice).fillContractOrder(oneInchOrder, "0x", inchAmount, BigInt(0))
      ).to.be.revertedWithCustomError(limitOrderProtocol, "BitInvalidatedOrder")
    });
  });

    describe("Cancel User Order", function () {
      it("Should only allow approved keepers cancel order", async function () {
        await delegateProxy.connect(delegateOwner).approveKeeper(await approvedKeeper.getAddress());
        const wethAmount = parseEther("1");
        await weth.connect(bobTheCreator).approve(delegateProxy.getAddress(), wethAmount);
        const oneInchOrder = buildMockOrder({
            maker: await delegateProxy.getAddress(),
            receiver: await bobTheCreator.getAddress(),
            makerAsset: await weth.getAddress(),
            makingAmount: wethAmount,
            takerAsset: await inch.getAddress(),
            takingAmount: parseEther("1"),
          });
        await delegateProxy.connect(approvedKeeper).createUserOrder([{
          order: oneInchOrder,
          orderCreator: await bobTheCreator.getAddress()
        }]);
        await expect(
          delegateProxy.connect(alice).cancelOrder(oneInchOrder)
        ).to.be.revertedWithCustomError(delegateProxy,"CallerNotApprovedKeeper" )
      });
    });

    describe("Accounting", function () {
      it("Should properly keep track of remaining maker amount", async function () {
        await delegateProxy.connect(delegateOwner).approveKeeper(await approvedKeeper.getAddress());
        const wethAmount = parseEther("2");
        await weth.connect(bobTheCreator).approve(delegateProxy.getAddress(), wethAmount);
        const oneInchOrder = buildMockOrder({
          maker: await delegateProxy.getAddress(),
          receiver: await bobTheCreator.getAddress(),
          makerAsset: await weth.getAddress(),
          makingAmount: wethAmount,
          takerAsset: await inch.getAddress(),
          takingAmount: parseEther("2"),
          makerTraits: (1n << 252n) | (1n << 254n)
        });

        await delegateProxy.connect(approvedKeeper).createUserOrder([{
          order: oneInchOrder,
          orderCreator: await bobTheCreator.getAddress()
        }]);
        const inchAmount = parseEther("1")
        await inch.connect(alice).approve(limitOrderProtocol, inchAmount);
        await limitOrderProtocol.connect(alice).fillContractOrder(oneInchOrder, "0x", inchAmount, 0);

        let orderHash = await limitOrderProtocol.hashOrder(oneInchOrder);

        let orderData = await delegateProxy.getOrderData([orderHash]);
        expect(orderData[0]._remainingMakerAmount).to.equal(parseEther("1"));

        await inch.connect(alice).approve(limitOrderProtocol, inchAmount);
        await limitOrderProtocol.connect(alice).fillContractOrder(oneInchOrder, "0x", inchAmount, 0);

        orderData = await delegateProxy.getOrderData([orderHash]);
        expect(orderData[0]._remainingMakerAmount).to.equal(0n);
      });
    });

});
