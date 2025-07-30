import type { Order, LimitOrderParams } from "@common/types";
import { logger } from "@back/utils/logger";
import { LimitOrder, LimitOrderContract, Address, Uint256 } from "@1inch/limit-order-sdk";
import { ethers } from "ethers";
import { getConfig } from "@back/services/config";

/**
 * Base interface for all order watchers
 * Each order type implements this interface
 */
export interface OrderWatcher {
  /**
   * Check if trigger conditions are met
   */
  shouldTrigger(order: Order): Promise<boolean>;

  /**
   * Trigger the order when conditions are met (creates 1inch limit order)
   * @param order The order to trigger
   * @param makerAmount The amount of maker asset to use for this trigger
   * @param takerAmount The amount of taker asset to use for this trigger
   */
  trigger(order: Order, makerAmount: string, takerAmount: string): Promise<void>;

  /**
   * Update order state after trigger (for recurring orders)
   */
  updateNextTrigger?(order: Order): void;
}

/**
 * Base order watcher class with 1inch integration
 */
export abstract class BaseOrderWatcher implements OrderWatcher {
  protected mockMode: boolean;
  protected provider: ethers.Provider;
  protected contractAddress: string;
  protected chainId: number;

  constructor(mockMode: boolean = false) {
    this.mockMode = mockMode;

    if (!mockMode) {
      const config = getConfig();
      const networkConfig = config.services.keeper.networks[1]; // Default to Ethereum

      this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      this.contractAddress = networkConfig.limitOrderContract;
      this.chainId = networkConfig.chainId;
    }
  }

  abstract shouldTrigger(order: Order): Promise<boolean>;
  abstract updateNextTrigger?(order: Order): void;

  /**
   * Trigger order with specified amounts - creates 1inch limit order or logs in mock mode
   */
  async trigger(order: Order, makerAmount: string, takerAmount: string): Promise<void> {
    if (this.mockMode) {
      logger.info(`[MOCK] Would trigger 1inch limit order: ${makerAmount} tokens from ${order.makerAsset} -> ${takerAmount} tokens of ${order.takerAsset}`);
      return;
    }

    try {
      // Create 1inch LimitOrder with the provided amounts
      const limitOrder = new LimitOrder({
        salt: BigInt(order.salt || this.generateSalt()),
        maker: new Address(order.maker),
        receiver: order.receiver ? new Address(order.receiver) : new Address(order.maker),
        makerAsset: new Address(order.makerAsset),
        takerAsset: new Address(order.takerAsset),
        makingAmount: BigInt(ethers.parseUnits(makerAmount, 18).toString()),
        takingAmount: BigInt(ethers.parseUnits(takerAmount, 6).toString()),
      });

      // Get order hash for tracking
      const orderHash = limitOrder.getOrderHash(this.chainId);

      // In production, this would be signed by the user's wallet and submitted to 1inch
      logger.info(`Created 1inch limit order: ${makerAmount} -> ${takerAmount} tokens`);
      logger.debug(`Order hash: ${orderHash}`);

      // Store the order hash for tracking
      if (!order.oneInchOrderHashes) {
        order.oneInchOrderHashes = [];
      }
      order.oneInchOrderHashes.push(orderHash);

    } catch (error) {
      logger.error(`Failed to trigger 1inch limit order: ${error}`);
      throw error;
    }
  }

  private generateSalt(): string {
    return Math.floor(Math.random() * 1000000000).toString();
  }
}

/**
 * Registry of order watchers by type
 */
export const orderHandlers = new Map<string, OrderWatcher>();

/**
 * Register an order watcher
 */
export function registerOrderWatcher(type: string, watcher: OrderWatcher): void {
  orderHandlers.set(type, watcher);
  logger.debug(`Registered watcher for order type: ${type}`);
}

/**
 * Get handler for order type
 */
export function getOrderWatcher(type: string): OrderWatcher | undefined {
  return orderHandlers.get(type);
}
