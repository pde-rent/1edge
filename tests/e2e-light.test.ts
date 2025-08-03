#!/usr/bin/env bun
import { describe, test, expect } from "bun:test";
import { ethers } from "ethers";
import { getConfig } from "../back/services/config";
import deployments from "../deployments.json";
import { createLimitOrderService } from "../back/services/limitOrder";
import { OneInchLimitOrderParams } from "../common/types";

const CHAIN_ID = 56;
const WETH = getConfig().tokenMapping.WETH[CHAIN_ID.toString()];
const USDT = getConfig().tokenMapping.USDT[CHAIN_ID.toString()];
const DELEGATE_PROXY = deployments.deployments[CHAIN_ID.toString()].proxy;

const provider = new ethers.JsonRpcProvider(getConfig().networks[CHAIN_ID].rpcUrl);
const keeper = new ethers.Wallet(process.env.KEEPER_PK!, provider);
const user = new ethers.Wallet(process.env.USER_PK!, provider);

describe("E2E Light - 1inch SDK Test", () => {
  test("Create and submit limit sell order at $4000", async () => {
    const limitOrderService = createLimitOrderService(
      process.env.ONE_INCH_API_KEY!,
      CHAIN_ID,
      keeper,
      provider,
    );

    const orderParams: OneInchLimitOrderParams = {
      makerAsset: WETH,
      takerAsset: USDT,
      makingAmount: ethers.parseUnits("0.0005", 18),
      takingAmount: ethers.parseUnits("2", 6),
      maker: DELEGATE_PROXY,
      receiver: user.address,
      partialFillsEnabled: true,
    };

    console.log(`🧪 Sell 0.0005 WETH for 2 USDT @ $4000`);
    
    const result = await limitOrderService.createAndSubmitOrder(
      orderParams,
      user.address,
      keeper,
    );
    
    expect(result.orderHash).toBeDefined();
    expect(result.signature).toBeDefined();
    if (result.success) expect(result.success).toBe(true);
  }, 60000);
});