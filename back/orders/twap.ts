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

    // Initialize nextTriggerValue if not set (for new orders)
    if (!order.nextTriggerValue || typeof order.nextTriggerValue !== "number") {
      order.nextTriggerValue = params.startDate;
      logger.debug(`TWAP order ${order.id} initialized, starting at ${params.startDate}`);
    }

    // Check if start time has passed
    if (now < params.startDate) {
      logger.info(`TWAP order ${order.id} start time not reached yet. Now: ${now}, Start: ${params.startDate}`);
      return false;
    }

    // For one-off TWAP (startDate == endDate), trigger immediately when start time reached
    if (params.startDate === params.endDate) {
      // If already triggered, no more triggers
      if (order.triggerCount > 0) {
        logger.debug(`TWAP order ${order.id} one-off already triggered (triggerCount: ${order.triggerCount})`);
        return false;
      }
      
      // Check max price constraint
      if (this.exceedsMaxPrice(order, params.maxPrice)) {
        logger.info(
          `TWAP order ${order.id} skipped - price exceeds max price ${params.maxPrice}`,
        );
        return false;
      }
      
      // Trigger if start time reached and not yet triggered
      const shouldTrigger = now >= params.startDate;
      logger.info(`TWAP order ${order.id} one-off trigger check: now=${now}, startDate=${params.startDate}, shouldTrigger=${shouldTrigger}`);
      return shouldTrigger;
    }

    // For multi-interval TWAP, check if end time has passed
    if (now >= params.endDate) {
      logger.info(`TWAP order ${order.id} multi-interval period ended. Now: ${now}, End: ${params.endDate}`);
      return false;
    }

    // Check max price constraint
    if (this.exceedsMaxPrice(order, params.maxPrice)) {
      logger.info(
        `TWAP order ${order.id} skipped - price exceeds max price ${params.maxPrice}`,
      );
      return false;
    }

    // Check if it's time for next interval trigger
    const shouldTrigger = now >= order.nextTriggerValue;
    logger.info(`TWAP order ${order.id} multi-interval trigger check: now=${now}, nextTrigger=${order.nextTriggerValue}, shouldTrigger=${shouldTrigger}`);
    
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

    // For one-off TWAP (startDate == endDate), no next trigger after execution
    if (params.startDate === params.endDate) {
      order.nextTriggerValue = null;
      logger.debug(`TWAP order ${order.id} is one-off execution - no next trigger`);
      return;
    }

    // For multi-interval TWAP, calculate next trigger
    const intervalMs = params.interval;
    if (intervalMs <= 0) {
      logger.debug(`TWAP order ${order.id} has no interval set`);
      return;
    }

    const lastTriggerTime = (order.nextTriggerValue as number) || Date.now();
    const nextTrigger = this.getNextTriggerTime(lastTriggerTime, intervalMs);
    
    // Don't schedule triggers beyond end date
    if (nextTrigger >= params.endDate) {
      order.nextTriggerValue = null;
      logger.debug(`TWAP order ${order.id} completed - no more triggers beyond end date`);
    } else {
      order.nextTriggerValue = nextTrigger;
      logger.debug(
        `TWAP order ${order.id} next trigger in ${(intervalMs / 1000).toFixed(0)}s`,
      );
    }
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
