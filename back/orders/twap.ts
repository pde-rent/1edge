import { OrderType } from "@common/types";
import type { Order, TWAPParams } from "@common/types";
import { logger } from "@back/utils/logger";
import {
  TimeBasedOrderWatcher,
  registerOrderWatcher,
  MS_PER_HOUR,
} from "./base";

/**
 * Time-Weighted Average Price (TWAP) order watcher
 * Executes trades evenly over a specified time period
 */
class TWAPOrderWatcher extends TimeBasedOrderWatcher {
  constructor() {
    super(true); // Always use mock mode for TWAP
  }

  async shouldTrigger(order: Order): Promise<boolean> {
    const params = this.validateParams<TWAPParams>(order);
    if (!params) return false;

    // Check if we have a valid next trigger time
    if (!order.nextTriggerValue || typeof order.nextTriggerValue !== "number") {
      return false;
    }

    // Check duration limit
    const elapsedTime = Date.now() - order.createdAt;
    const durationMs = params.duration * MS_PER_HOUR;

    if (elapsedTime >= durationMs) {
      logger.debug(`TWAP order ${order.id} completed - duration reached`);
      return false;
    }

    // Check max price constraint
    if (this.exceedsMaxPrice(order, params.maxPrice)) {
      logger.debug(
        `TWAP order ${order.id} skipped - price exceeds max price ${params.maxPrice}`,
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
    const params = this.validateParams<TWAPParams>(order);
    if (!params) throw new Error("Invalid TWAP parameters");

    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) throw new Error("Failed to get price info");

    // Calculate progress
    const elapsedTime = Date.now() - order.createdAt;
    const durationMs = params.duration * MS_PER_HOUR;
    const progress = (elapsedTime / durationMs) * 100;

    logger.info(`TWAP execution at ${progress.toFixed(1)}% of duration`);

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
    const params = this.validateParams<TWAPParams>(order);
    if (!params) return;

    // Calculate interval based on remaining time and slices
    const remainingSlices = params.slices - (order.triggerCount || 0) - 1;
    if (remainingSlices <= 0) {
      logger.debug(
        `TWAP order ${order.id} completed all ${params.slices} slices`,
      );
      return;
    }

    const elapsedTime = Date.now() - order.createdAt;
    const durationMs = params.duration * MS_PER_HOUR;
    const remainingTime = durationMs - elapsedTime;
    const intervalMs = remainingTime / remainingSlices;

    const lastTriggerTime = (order.nextTriggerValue as number) || Date.now();
    order.nextTriggerValue = this.getNextTriggerTime(
      lastTriggerTime,
      intervalMs,
    );

    logger.debug(
      `TWAP order ${order.id} next trigger in ${(intervalMs / 1000).toFixed(0)}s`,
    );
  }

  /**
   * Get the amount to execute for the current slice
   */
  getTriggerAmount(order: Order): string {
    const params = this.validateParams<TWAPParams>(order);
    if (!params) return "0";

    const sliceAmount = parseFloat(params.amount) / params.slices;
    return sliceAmount.toFixed(8);
  }
}

// Register the watcher
registerOrderWatcher(OrderType.TWAP, new TWAPOrderWatcher());
