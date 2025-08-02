import { OrderType } from "@common/types";
import type { Order, StopLimitParams } from "@common/types";
import { logger } from "@back/utils/logger";
import { PriceBasedOrderWatcher, registerOrderWatcher } from "./base";

/**
 * Stop Limit order watcher
 * Triggers when price reaches a specified stop level
 */
class StopLimitOrderWatcher extends PriceBasedOrderWatcher {
  constructor() {
    super(true); // Always use mock mode for stop orders
  }

  async shouldTrigger(order: Order): Promise<boolean> {
    const params = this.validateParams<StopLimitParams>(order);
    if (!params) return false;

    // Check expiry
    if (this.isExpired(order, params.expiry)) {
      logger.debug(`Stop limit order ${order.id} expired`);
      return false;
    }

    // Get current price
    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) return false;

    // Check if price has reached stop price
    const hasReachedStop = this.checkPriceThreshold(
      priceInfo.price,
      params.stopPrice,
      "above",
    );

    if (hasReachedStop) {
      logger.debug(
        `Stop limit triggered: price ${priceInfo.price} reached stop ${params.stopPrice}`,
      );
    }

    return hasReachedStop;
  }

  async trigger(
    order: Order,
    makerAmount: string,
    takerAmount: string,
  ): Promise<void> {
    const params = this.validateParams<StopLimitParams>(order);
    if (!params) throw new Error("Invalid stop limit parameters");

    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) throw new Error("Failed to get price info");

    // Log execution
    this.logExecution({
      order,
      currentPrice: priceInfo.price,
      symbol: priceInfo.symbol,
      triggerAmount: makerAmount,
    });

    logger.info(
      `Stop limit order converting to limit order at price ${params.limitPrice}`,
    );

    // Execute the order
    await super.trigger(order, makerAmount, takerAmount);
  }

  updateNextTrigger(order: Order): void {
    // Stop limit orders are one-time triggers
    // No additional updates needed
  }
}

// Register the watcher
registerOrderWatcher(OrderType.STOP_LIMIT, new StopLimitOrderWatcher());
