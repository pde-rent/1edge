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
   * Submit the order when triggered (creates 1inch limit order)
   */
  submit(order: Order): Promise<void>;

  /**
   * Update order state after submission (for recurring orders)
   */
  updateNextTrigger?(order: Order): void;

  /**
   * Calculate the specific amount to submit for this order type
   * Each order type should override this method
   */
  calculateSubmissionAmount(order: Order): string;
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
  abstract calculateSubmissionAmount(order: Order): string;
  abstract updateNextTrigger?(order: Order): void;

  /**
   * Submit order to 1inch or log in mock mode
   */
  async submit(order: Order): Promise<void> {
    const submissionAmount = this.calculateSubmissionAmount(order);

    if (this.mockMode) {
      logger.info(`[MOCK] Would submit 1inch limit order: ${submissionAmount} tokens from ${order.makerAsset} -> ${order.takerAsset}`);
      return;
    }

    try {
      // Calculate the taking amount based on submission amount ratio
      const originalMaking = parseFloat(order.makingAmount);
      const submissionMaking = parseFloat(submissionAmount);
      const ratio = submissionMaking / originalMaking;
      const submissionTaking = (parseFloat(order.takingAmount) * ratio).toString();

      // Create 1inch LimitOrder
      const limitOrder = new LimitOrder({
        salt: BigInt(order.salt || this.generateSalt()),
        maker: new Address(order.maker),
        receiver: order.receiver ? new Address(order.receiver) : new Address(order.maker),
        makerAsset: new Address(order.makerAsset),
        takerAsset: new Address(order.takerAsset),
        makingAmount: BigInt(ethers.parseUnits(submissionAmount, 18).toString()),
        takingAmount: BigInt(ethers.parseUnits(submissionTaking, 6).toString()),
      });

      // Get order hash for tracking
      const orderHash = limitOrder.getOrderHash(this.chainId);

      // In production, this would be signed by the user's wallet and submitted to 1inch
      logger.info(`Created 1inch limit order: ${submissionAmount} tokens at calculated price`);
      logger.debug(`Order hash: ${orderHash}`);

      // Store the order hash for tracking
      if (!order.oneInchOrderHashes) {
        order.oneInchOrderHashes = [];
      }
      order.oneInchOrderHashes.push(orderHash);

    } catch (error) {
      logger.error(`Failed to submit 1inch limit order: ${error}`);
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
