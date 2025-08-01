import { BigNumberish, ZeroAddress, parseEther, keccak256, toUtf8Bytes } from "ethers";
import { IOrderMixin } from "../typechain-types";

export function buildMockOrder(overrides: Partial<IOrderMixin.OrderStruct> = {}): IOrderMixin.OrderStruct {
  return {
    salt: 0,
    maker: ZeroAddress,
    receiver: ZeroAddress,
    makerAsset: ZeroAddress,
    takerAsset: ZeroAddress,
    makingAmount: parseEther("1"),
    takingAmount: parseEther("1"),
    makerTraits: 1n << 252n,
    ...overrides,
  };
}


