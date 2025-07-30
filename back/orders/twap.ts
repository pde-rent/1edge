import type { Order, TwapParams } from "@common/types";
import { OrderType } from "@common/types";
import { logger } from "@back/utils/logger";
import { registerOrderWatcher, type OrderWatcher } from "./base";
import { priceCache } from "@back/services/priceCache";

class TWAPHandler implements OrderWatcher {
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

  async execute(order: Order): Promise<void> {
    const params = order.params as TwapParams;
    if (!params) {
      throw new Error("Invalid TWAP order params");
    }

    // Calculate how many intervals should have occurred by now
    const now = Date.now();
    const totalDuration = params.endDate - params.startDate;
    const intervalMs = params.interval; // Already in milliseconds
    const totalIntervals = Math.ceil(totalDuration / intervalMs);

    // Check if we're within the execution window
    if (now < params.startDate || now >= params.endDate) {
      throw new Error("TWAP execution outside time window");
    }

    // Check price constraint if specified
    if (params.maxPrice) {
      const symbol = this.getSymbolFromAssets(order.makerAsset, order.takerAsset);
      const priceData = priceCache.getPrice(symbol);
      if (priceData?.last?.mid && priceData.last.mid > params.maxPrice) {
        logger.info(`TWAP execution skipped: price ${priceData.last.mid} exceeds max ${params.maxPrice}`);
        return;
      }
    }

    const currentInterval = order.triggerCount + 1;
    const amountPerInterval = parseFloat(params.amount) / totalIntervals;

    // Get asset symbol for logging (simplified)
    const assetSymbol = this.getAssetSymbol(order.makerAsset);
    logger.info(`Executing TWAP slice ${currentInterval}/${totalIntervals} for ${amountPerInterval} ${assetSymbol}`);

    // In production, this would create a 1inch limit order
    // For testing, we just log the execution
    logger.debug(`Would create 1inch order: ${amountPerInterval} at limit price (spot - 0.05%)`);
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

  private getSymbolFromAssets(makerAsset: string, takerAsset: string): string {
    // Simple mapping for common assets - in production this would be more sophisticated
    const assetMap: Record<string, string> = {
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "ETH", // WETH
      "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT", // USDT
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC", // USDC
    };

    const makerSymbol = assetMap[makerAsset] || "UNKNOWN";
    const takerSymbol = assetMap[takerAsset] || "UNKNOWN";

    return `agg:spot:${makerSymbol}${takerSymbol}`;
  }

  private getAssetSymbol(assetAddress: string): string {
    // Simple mapping for logging - in production this would query token metadata
    const assetMap: Record<string, string> = {
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "WETH",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT",
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC",
    };

    return assetMap[assetAddress] || "UNKNOWN";
  }
}

// Register handler
registerOrderWatcher(OrderType.TWAP, new TWAPHandler());
