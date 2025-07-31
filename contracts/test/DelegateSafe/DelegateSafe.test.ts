import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { parseEther, ZeroAddress } from "ethers";
import { Signer } from "ethers";
import { DelegateSafe, ERC20Mock, LimitOrderProtocol } from "../../typechain-types";
import { buildMockOrder } from "../MockOrder";

describe("DelegateSafe", function () {

  let delegateOwner: Signer;
  let bobTheCreator: Signer;
  let approvedKeeper: Signer;
  let alice: Signer;
  let delegateSafe: DelegateSafe;
  let weth: ERC20Mock;
  let wbtc: ERC20Mock;
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

    // Deploy Delegate Safe
    const DelegateSafe = await ethers.getContractFactory("DelegateSafe");
    delegateSafe = await DelegateSafe.deploy(limitOrderProtocol);
  })

  describe("Create User Order", function () {
    it("Should not allow unapproved keeper to create user order", async function () {
      await expect(
        delegateSafe.connect(approvedKeeper).createUserOrder([{
          order: buildMockOrder(), 
          orderCreator: bobTheCreator.getAddress() 
        }])
      ).to.be.revertedWithCustomError(delegateSafe, "CallerNotApprovedKeeper");
    });

    it("Should allow only approved keeper to create user order", async function () {
      await delegateSafe.connect(delegateOwner).approveKeeper(approvedKeeper.getAddress());
      let wethAmount = parseEther("1");
      await weth.connect(bobTheCreator).approve(delegateSafe.getAddress(), wethAmount);
      await delegateSafe.connect(approvedKeeper).createUserOrder([{
        order: buildMockOrder({
          makerAsset: await weth.getAddress(),
          makingAmount: wethAmount,
          takerAsset: await inch.getAddress(),
          takingAmount: parseEther("1"),
        }), 
        orderCreator: bobTheCreator.getAddress() 
      }])
    });

    it("Should ensure DelegateSafe has enough allowance to execute order", async function () {
      await delegateSafe.connect(delegateOwner).approveKeeper(await approvedKeeper.getAddress());
      const wethAmount = parseEther("1");
      await expect(
        delegateSafe.connect(approvedKeeper).createUserOrder([{
          order: buildMockOrder({
            makerAsset: await weth.getAddress(),
            makingAmount: wethAmount,
            takerAsset: await inch.getAddress(),
            takingAmount: parseEther("1"),
          }),
          orderCreator: await bobTheCreator.getAddress()
        }])
      ).to.be.revertedWithCustomError(weth, "ERC20InsufficientAllowance");

      await weth.connect(bobTheCreator).approve(delegateSafe.getAddress(), wethAmount);

      await delegateSafe.connect(approvedKeeper).createUserOrder([{
        order: buildMockOrder({
          makerAsset: await weth.getAddress(),
          makingAmount: wethAmount,
          takerAsset: await inch.getAddress(),
          takingAmount: parseEther("1"),
        }),
        orderCreator: await bobTheCreator.getAddress()
      }])

    });
  });

  describe("Fill User Order", function () {
    it("Should fill", async function () {
      await delegateSafe.connect(delegateOwner).approveKeeper(await approvedKeeper.getAddress());
      const wethAmount = parseEther("1");
      await weth.connect(bobTheCreator).approve(delegateSafe.getAddress(), wethAmount);
      const oneInchOrder = buildMockOrder({
        maker: await delegateSafe.getAddress(),
        receiver: await bobTheCreator.getAddress(),
        makerAsset: await weth.getAddress(),
        makingAmount: wethAmount,
        takerAsset: await inch.getAddress(),
        takingAmount: parseEther("1"),
      });

      let bobTheCreator_initial_weth_bal = await weth.balanceOf(bobTheCreator);
      let alice_initial_weth_bal = await weth.balanceOf(alice);

      assert.equal(bobTheCreator_initial_weth_bal, parseEther("10"));
      assert.equal(alice_initial_weth_bal, parseEther("0"));

      let bobTheCreator_initial_inch_bal = await inch.balanceOf(bobTheCreator);
      let alice_initial_inch_bal = await inch.balanceOf(alice);

      assert.equal(bobTheCreator_initial_inch_bal, parseEther("0"));
      assert.equal(alice_initial_inch_bal, parseEther("10"));
      console.log(await inch.balanceOf(alice));

      await delegateSafe.connect(approvedKeeper).createUserOrder([{
        order: oneInchOrder,
        orderCreator: await bobTheCreator.getAddress()
      }]);
      const inchAmount = parseEther("1")
      // await inch.mint(alice.getAddress(), inchAmount);
      await inch.connect(alice).approve(limitOrderProtocol, inchAmount);
      await limitOrderProtocol.connect(alice).fillContractOrder(oneInchOrder, "0x", inchAmount, 0);
      
      bobTheCreator_initial_weth_bal = await weth.balanceOf(bobTheCreator);
      alice_initial_weth_bal = await weth.balanceOf(alice);

      assert.equal(bobTheCreator_initial_weth_bal, parseEther("9"));
      assert.equal(alice_initial_weth_bal, parseEther("1"));

      bobTheCreator_initial_inch_bal = await inch.balanceOf(bobTheCreator);
      alice_initial_inch_bal = await inch.balanceOf(alice);
      console.log(await inch.balanceOf(alice));

      assert.equal(bobTheCreator_initial_inch_bal, parseEther("1"));
      assert.equal(alice_initial_inch_bal, parseEther("9"));
    });

    it("Should not fill after cancel", async function () {
      await delegateSafe.connect(delegateOwner).approveKeeper(await approvedKeeper.getAddress());
      const wethAmount = parseEther("1");
      await weth.connect(bobTheCreator).approve(delegateSafe.getAddress(), wethAmount);
      const oneInchOrder = buildMockOrder({
          maker: await delegateSafe.getAddress(),
          receiver: await bobTheCreator.getAddress(),
          makerAsset: await weth.getAddress(),
          makingAmount: wethAmount,
          takerAsset: await inch.getAddress(),
          takingAmount: parseEther("1"),
        });

      await delegateSafe.connect(approvedKeeper).createUserOrder([{
        order: oneInchOrder,
        orderCreator: await bobTheCreator.getAddress()
      }]);
      
      await delegateSafe.connect(approvedKeeper).cancelOrder(oneInchOrder);
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
        await delegateSafe.connect(delegateOwner).approveKeeper(await approvedKeeper.getAddress());
        const wethAmount = parseEther("1");
        await weth.connect(bobTheCreator).approve(delegateSafe.getAddress(), wethAmount);
        const oneInchOrder = buildMockOrder({
            maker: await delegateSafe.getAddress(),
            receiver: await bobTheCreator.getAddress(),
            makerAsset: await weth.getAddress(),
            makingAmount: wethAmount,
            takerAsset: await inch.getAddress(),
            takingAmount: parseEther("1"),
          });
        await delegateSafe.connect(approvedKeeper).createUserOrder([{
          order: oneInchOrder,
          orderCreator: await bobTheCreator.getAddress()
        }]);
        await expect(
          delegateSafe.connect(alice).cancelOrder(oneInchOrder)
        ).to.be.revertedWithCustomError(delegateSafe,"CallerNotApprovedKeeper" )
      });
    });

});
