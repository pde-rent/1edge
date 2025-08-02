import { OrderType } from "@common/types";
import type { Order, ChaseLimitParams } from "@common/types";
import { logger } from "@back/utils/logger";
import { PriceBasedOrderWatcher, registerOrderWatcher } from "./base";

/**
 * Chase Limit order watcher
 * Tracks price movements and adjusts limit price to chase the market
 */
class ChaseLimitOrderWatcher extends PriceBasedOrderWatcher {
  async shouldTrigger(order: Order): Promise<boolean> {
    const params = this.validateParams<ChaseLimitParams>(order);
    if (!params) return false;

    // Check expiry
    if (this.isExpired(order, params.expiry)) {
      logger.debug(`Chase limit order ${order.id} expired`);
      return false;
    }

    // Get current price
    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) return false;

    // Check max price constraint
    if (params.maxPrice && priceInfo.price > params.maxPrice) {
      logger.debug(
        `Chase limit order ${order.id} - price ${priceInfo.price} exceeds max ${params.maxPrice}`,
      );
      return false;
    }

    // Get current trigger price or use current price
    const currentTriggerPrice = order.nextTriggerValue || priceInfo.price;

    // Calculate distance threshold
    const distanceThreshold = this.calculatePercentage(
      currentTriggerPrice,
      params.distancePct,
    );

    // Check if price has moved beyond the distance threshold
    const priceDifference = Math.abs(priceInfo.price - currentTriggerPrice);
    const shouldChase = priceDifference >= distanceThreshold;

    if (shouldChase) {
      logger.debug(
        `Chase limit triggered: price moved from ${currentTriggerPrice} to ${priceInfo.price} (${params.distancePct}% threshold)`,
      );
    }

    return shouldChase;
  }

  async trigger(
    order: Order,
    makingAmount: string,
    takingAmount: string,
  ): Promise<void> {
    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) throw new Error("Failed to get price info");

    // Update trigger price to current market price
    order.nextTriggerValue = priceInfo.price;

    // Log execution
    this.logExecution({
      order,
      currentPrice: priceInfo.price,
      symbol: priceInfo.symbol,
      triggerAmount: makingAmount,
    });

    // Execute the order
    await super.trigger(order, makingAmount, takingAmount);
  }

  updateNextTrigger(order: Order): void {
    // Chase limit orders update nextTriggerValue in the trigger method
    // No additional updates needed here
  }
}

// Register the watcher
registerOrderWatcher(OrderType.CHASE_LIMIT, new ChaseLimitOrderWatcher());
