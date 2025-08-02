import { OrderType } from "@common/types";
import type { Order, DCAParams } from "@common/types";
import { logger } from "@back/utils/logger";
import {
  TimeBasedOrderWatcher,
  registerOrderWatcher,
  MS_PER_DAY,
} from "./base";

/**
 * Dollar Cost Averaging (DCA) order watcher
 * Executes trades at fixed time intervals
 */
class DCAOrderWatcher extends TimeBasedOrderWatcher {
  async shouldTrigger(order: Order): Promise<boolean> {
    const params = this.validateParams<DCAParams>(order);
    if (!params) return false;

    // Check if we have a valid next trigger time
    if (!order.nextTriggerValue || typeof order.nextTriggerValue !== "number") {
      return false;
    }

    // Check max price constraint
    if (this.exceedsMaxPrice(order, params.maxPrice)) {
      logger.debug(
        `DCA order ${order.id} skipped - price exceeds max price ${params.maxPrice}`,
      );
      return false;
    }

    // Check time interval
    return this.checkTimeInterval(order.nextTriggerValue, 0);
  }

  async trigger(
    order: Order,
    makerAmount: string,
    takerAmount: string,
  ): Promise<void> {
    const params = this.validateParams<DCAParams>(order);
    if (!params) throw new Error("Invalid DCA parameters");

    // Get price info for logging
    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) throw new Error("Failed to get price info");

    // Log execution
    this.logExecution({
      order,
      currentPrice: priceInfo.price,
      symbol: priceInfo.symbol,
      triggerAmount: makerAmount,
    });

    // Execute the order
    await super.trigger(order, makerAmount, takerAmount);
  }

  updateNextTrigger(order: Order): void {
    const params = this.validateParams<DCAParams>(order);
    if (!params) return;

    // Calculate next trigger time
    const intervalMs = params.interval * MS_PER_DAY;
    const lastTriggerTime = (order.nextTriggerValue as number) || Date.now();

    order.nextTriggerValue = this.getNextTriggerTime(
      lastTriggerTime,
      intervalMs,
    );

    logger.debug(
      `DCA order ${order.id} next trigger scheduled for ${new Date(order.nextTriggerValue).toISOString()}`,
    );
  }
}

// Register the watcher
registerOrderWatcher(OrderType.DCA, new DCAOrderWatcher());
