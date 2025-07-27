const hre = require('hardhat');
const { ethers, network, tracer } = hre;
const { expect, time, constants, getPermit2, permit2Contract } = require('@1inch/solidity-utils');
const { fillWithMakingAmount, unwrapWethTaker, buildMakerTraits, buildMakerTraitsRFQ, buildOrder, signOrder, buildOrderData, buildTakerTraits } = require('./helpers/orderUtils');
const { getPermit, withTarget } = require('./helpers/eip712');
const { joinStaticCalls, ether, findTrace, countAllItems, withTrace } = require('./helpers/utils');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { deploySwapTokens, deployArbitraryPredicate } = require('./helpers/fixtures');
const { parseUnits } = require('ethers');

describe('LimitOrderProtocol', function () {
    let taker, maker, resolver, hacker;

    before(async function () {
        // Skip deployer
        [, taker, maker, resolver, hacker] = await ethers.getSigners();
    });

    async function deployContractsAndInit () {
        const { dai, weth, swap, chainId } = await deploySwapTokens();
        const tokens = { dai, weth };
        const contracts = { swap };

        await dai.mint(maker, ether('1000000'));
        await dai.mint(taker, ether('1000000'));
        await weth.connect(taker).deposit({ value: ether('100') });
        await weth.connect(maker).deposit({ value: ether('100') });
        await dai.connect(taker).approve(swap, ether('1000000'));
        await dai.connect(maker).approve(swap, ether('1000000'));
        await weth.connect(taker).approve(swap, ether('100'));
        await weth.connect(maker).approve(swap, ether('100'));

        const permit = {};
        // Taker permit
        permit.order = buildOrder({
            makerAsset: await dai.getAddress(),
            takerAsset: await weth.getAddress(),
            makingAmount: 1,
            takingAmount: 1,
            maker: maker.address,
        });
        const { r, yParityAndS: vs } = ethers.Signature.from(await signOrder(permit.order, chainId, await swap.getAddress(), maker));
        permit.signature = { r, vs };

        return { tokens, contracts, chainId, permit };
    };

    it('Taker Permit: DAI => WETH, no allowance', async function () {
        const {
            tokens: { dai, weth }, contracts: { swap }, chainId, permit: { order, signature: { r, vs } },
        } = await loadFixture(deployContractsAndInit);

        const permit = await getPermit(taker.address, taker, weth, '1', chainId, await swap.getAddress(), '1');
        const takerTraits = buildTakerTraits({
            threshold: 1n,
            makingAmount: true,
        });

        await weth.connect(taker).approve(swap, '0');
        const fillTx = swap.permitAndCall(
            ethers.solidityPacked(
                ['address', 'bytes'],
                [await weth.getAddress(), permit],
            ),
            swap.interface.encodeFunctionData('fillOrderArgs', [
                order, r, vs, 1, takerTraits.traits, takerTraits.args,
            ]),
        );
        await expect(fillTx).to.changeTokenBalances(dai, [taker, maker], [1, -1]);
        await expect(fillTx).to.changeTokenBalances(weth, [taker, maker], [-1, 1]);
    })
});
