const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("CustodialStrategyExecutor", function () {
  let owner, keeper, user, anotherUser, oneInchRouter;
  let strategyExecutor, weth, wbtc, inch;

  beforeEach(async function () {
    [owner, keeper, user, anotherUser, oneInchRouter] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    weth = await ERC20Mock.deploy("Wrapped Ether", "WETH");
    wbtc = await ERC20Mock.deploy("Wrapped BTC", "WBTC");
    inch = await ERC20Mock.deploy("1inch", "1INCH");

    // Deploy StrategyExecutor
    const StrategyExecutor = await ethers.getContractFactory("StrategyExecutor");
    strategyExecutor = await StrategyExecutor.deploy();

    // Set the keeper
    await strategyExecutor.setKeeper(keeper.address);

    // Mint some tokens to the user
    await weth.mint(user.address, ethers.utils.parseEther("10"));
    await wbtc.mint(user.address, ethers.utils.parseUnits("1", 8));
    await inch.mint(user.address, ethers.utils.parseEther("1000"));

    // User approves the StrategyExecutor to spend their tokens for deposits
    await weth.connect(user).approve(strategyExecutor.address, ethers.constants.MaxUint256);
    await wbtc.connect(user).approve(strategyExecutor.address, ethers.constants.MaxUint256);
    await inch.connect(user).approve(strategyExecutor.address, ethers.constants.MaxUint256);
  });

  describe("Deposits and Withdrawals", function () {
    it("Should allow a user to deposit tokens", async function () {
      const depositAmount = ethers.utils.parseEther("1");
      await strategyExecutor.connect(user).deposit(weth.address, depositAmount);

      expect(await strategyExecutor.balances(user.address, weth.address)).to.equal(depositAmount);
      expect(await weth.balanceOf(user.address)).to.equal(ethers.utils.parseEther("9"));
      expect(await weth.balanceOf(strategyExecutor.address)).to.equal(depositAmount);
    });

    it("Should allow a user to withdraw their tokens", async function () {
      const depositAmount = ethers.utils.parseEther("1");
      await strategyExecutor.connect(user).deposit(weth.address, depositAmount);

      const withdrawAmount = ethers.utils.parseEther("0.5");
      await strategyExecutor.connect(user).withdraw(weth.address, withdrawAmount);

      expect(await strategyExecutor.balances(user.address, weth.address)).to.equal(ethers.utils.parseEther("0.5"));
      expect(await weth.balanceOf(user.address)).to.equal(ethers.utils.parseEther("9.5"));
      expect(await weth.balanceOf(strategyExecutor.address)).to.equal(ethers.utils.parseEther("0.5"));
    });

    it("Should not allow a user to withdraw more than they have deposited", async function () {
      const depositAmount = ethers.utils.parseEther("1");
      await strategyExecutor.connect(user).deposit(weth.address, depositAmount);

      const withdrawAmount = ethers.utils.parseEther("1.1");
      await expect(strategyExecutor.connect(user).withdraw(weth.address, withdrawAmount)).to.be.revertedWith(
        "StrategyExecutor: Insufficient balance"
      );
    });
  });

  describe("EIP-1271 Signature Validation", function () {
    it("Should correctly validate a signature from the keeper", async function () {
      const message = "This is a test message";
      const messageHash = ethers.utils.id(message);
      const signature = await keeper.signMessage(ethers.utils.arrayify(messageHash));

      const EIP1271_MAGIC_VALUE = "0x1626ba7e";
      expect(await strategyExecutor.isValidSignature(messageHash, signature)).to.equal(EIP1271_MAGIC_VALUE);
    });

    it("Should not validate a signature from a non-keeper", async function () {
      const message = "This is a test message";
      const messageHash = ethers.utils.id(message);
      const signature = await anotherUser.signMessage(ethers.utils.arrayify(messageHash));

      expect(await strategyExecutor.isValidSignature(messageHash, signature)).to.not.equal("0x1626ba7e");
    });
  });

  describe("Keeper Approvals", function () {
    it("Should allow the keeper to approve the 1inch router to spend tokens", async function () {
        const approveAmount = ethers.utils.parseEther("1");
        await strategyExecutor.connect(keeper).approve(weth.address, oneInchRouter.address, approveAmount);

        const allowance = await weth.allowance(strategyExecutor.address, oneInchRouter.address);
        expect(allowance).to.equal(approveAmount);
    });

    it("Should not allow a non-keeper to approve the 1inch router", async function () {
        const approveAmount = ethers.utils.parseEther("1");
        await expect(strategyExecutor.connect(anotherUser).approve(weth.address, oneInchRouter.address, approveAmount))
            .to.be.revertedWith("StrategyExecutor: Caller is not the keeper");
    });
  });
});
