import type { Order, TwapParams } from "@common/types";
import { OrderType } from "@common/types";
import { logger } from "@back/utils/logger";
import { registerOrderWatcher, BaseOrderWatcher } from "./base";
import { priceCache } from "@back/services/priceCache";
import { getSymbolFromAssets, getAssetSymbol } from "@back/utils/assetMapping";

class TWAPWatcher extends BaseOrderWatcher {
  async shouldTrigger(order: Order): Promise<boolean> {
    const params = order.params as TwapParams;
    if (!params) {
      return false;
    }

    const now = Date.now();

    // Calculate total intervals
    const totalDuration = params.endDate - params.startDate;
    const intervalMs = params.interval; // Already in milliseconds
    const totalIntervals = Math.ceil(totalDuration / intervalMs);

    // Only stop the watcher if we've truly completed all intervals OR reached end date
    if (now >= params.endDate) {
      return false; // Stop triggering after end date
    }

    if ((order.triggerCount || 0) >= totalIntervals) {
      return false; // Stop after completing all intervals
    }


    // If we haven't completed all intervals and haven't reached end date,
    // check if it's time to trigger the next execution
    if (!order.nextTriggerValue) {
      // First trigger - check if we've reached start date
      const shouldStart = now >= params.startDate;
      return shouldStart;
    }

    // For subsequent triggers, check if enough time has passed
    const shouldTriggerNow = now >= Number(order.nextTriggerValue);
    return shouldTriggerNow;
  }

  calculateSubmissionAmount(order: Order): string {
    const params = order.params as TwapParams;
    if (!params) {
      throw new Error("Invalid TWAP order params");
    }

    // Calculate total intervals and amount per interval
    const totalDuration = params.endDate - params.startDate;
    const intervalMs = params.interval;
    const totalIntervals = Math.ceil(totalDuration / intervalMs);
    const amountPerInterval = parseFloat(params.amount) / totalIntervals;

    return amountPerInterval.toString();
  }

  async submit(order: Order): Promise<void> {
    const params = order.params as TwapParams;
    if (!params) {
      throw new Error("Invalid TWAP order params");
    }

    // Check if we're within the execution window
    const now = Date.now();
    if (now < params.startDate || now >= params.endDate) {
      throw new Error("TWAP execution outside time window");
    }

    // Check price constraint if specified
    if (params.maxPrice) {
      const symbol = getSymbolFromAssets(order.makerAsset, order.takerAsset);
      const priceData = priceCache.getPrice(symbol);
      if (priceData?.last?.mid && priceData.last.mid > params.maxPrice) {
        logger.info(`TWAP execution skipped: price ${priceData.last.mid} exceeds max ${params.maxPrice}`);
        return;
      }
    }

    // Calculate interval information for logging
    const totalDuration = params.endDate - params.startDate;
    const intervalMs = params.interval;
    const totalIntervals = Math.ceil(totalDuration / intervalMs);
    const currentInterval = order.triggerCount + 1;
    const amountPerInterval = this.calculateSubmissionAmount(order);

    // Get asset symbol for logging
    const assetSymbol = getAssetSymbol(order.makerAsset);
    logger.info(`Submitting TWAP slice ${currentInterval}/${totalIntervals} for ${amountPerInterval} ${assetSymbol}`);

    // Call parent submit method to handle 1inch integration
    await super.submit(order);
  }

  updateNextTrigger(order: Order): void {
    const params = order.params as TwapParams;
    if (!params) {
      return;
    }

    const intervalMs = params.interval;
    const now = Date.now();

    // Set next trigger time
    const nextTrigger = now + intervalMs;

    // Don't set next trigger beyond end date
    if (nextTrigger >= params.endDate) {
      order.nextTriggerValue = undefined; // No more triggers
    } else {
      order.nextTriggerValue = nextTrigger;
    }
  }

}

// Register watcher - mock mode will be set by OrderRegistry
registerOrderWatcher(OrderType.TWAP, new TWAPWatcher(true)); // Default to mock mode
