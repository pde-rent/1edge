import { OrderType } from "@common/types";
import type { Order, TwapParams } from "@common/types";
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
export class TWAPOrderWatcher extends TimeBasedOrderWatcher {
  constructor(mockMode: boolean = false) {
    super(mockMode);
  }

  async shouldTrigger(order: Order): Promise<boolean> {
    const params = this.validateParams<TwapParams>(order);
    if (!params) return false;

    const now = Date.now();

    // Check if we have a valid next trigger time
    if (!order.nextTriggerValue || typeof order.nextTriggerValue !== "number") {
      logger.info(`TWAP order ${order.id} has no valid nextTriggerValue`);
      return false;
    }

    // Check if start time has passed
    if (now < params.startDate) {
      logger.info(`TWAP order ${order.id} start time not reached yet. Now: ${now}, Start: ${params.startDate}`);
      return false;
    }

    // Check if end time has passed
    if (now >= params.endDate) {
      logger.info(`TWAP order ${order.id} completed - end time reached. Now: ${now}, End: ${params.endDate}`);
      return false;
    }

    // Check max price constraint
    if (this.exceedsMaxPrice(order, params.maxPrice)) {
      logger.info(
        `TWAP order ${order.id} skipped - price exceeds max price ${params.maxPrice}`,
      );
      return false;
    }

    // Check if it's time to trigger
    const shouldTrigger = now >= order.nextTriggerValue;
    logger.info(`TWAP order ${order.id} trigger check: now=${now}, nextTrigger=${order.nextTriggerValue}, shouldTrigger=${shouldTrigger}`);
    
    return shouldTrigger;
  }

  async trigger(
    order: Order,
    makingAmount: string,
    takingAmount: string,
  ): Promise<void> {
    const params = this.validateParams<TwapParams>(order);
    if (!params) throw new Error("Invalid TWAP parameters");

    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) throw new Error("Failed to get price info");

    // Calculate progress
    const elapsedTime = Date.now() - params.startDate;
    const durationMs = params.endDate - params.startDate;
    const progress = durationMs > 0 ? (elapsedTime / durationMs) * 100 : 0;

    logger.info(`TWAP execution at ${progress.toFixed(1)}% of duration`);

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
    const params = this.validateParams<TwapParams>(order);
    if (!params) return;

    // For simple TWAP, just use the interval from params
    const intervalMs = params.interval;
    if (intervalMs <= 0) {
      logger.debug(`TWAP order ${order.id} has no interval set`);
      return;
    }

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
    const params = this.validateParams<TwapParams>(order);
    if (!params || !params.makingAmount) return "0";

    // For simple TWAP, use full amount
    return params.makingAmount.toString();
  }
}

// Register the watcher (default to non-mock mode)
registerOrderWatcher(OrderType.TWAP, new TWAPOrderWatcher(false));
