import type { Order } from "@common/types";
import { OrderType } from "@common/types";
import { priceCache } from "@back/services/priceCache";
import { logger } from "@back/utils/logger";
import { registerOrderWatcher, BaseOrderWatcher } from "./base";
import { getSymbolFromAssets } from "@back/utils/assetMapping";

class StopLimitWatcher extends BaseOrderWatcher {
  async shouldTrigger(order: Order): Promise<boolean> {
    if (!order.params || !('stopPrice' in order.params)) {
      return false;
    }

    const priceData = priceCache.getPrice(getSymbolFromAssets(order.makerAsset, order.takerAsset));
    if (!priceData?.last?.mid) {
      const symbol = getSymbolFromAssets(order.makerAsset, order.takerAsset);
      logger.debug(`No price data for ${symbol}`);
      return false;
    }

    const currentPrice = priceData.last.mid;
    return currentPrice >= order.params.stopPrice;
  }

  async trigger(order: Order, makerAmount: string, takerAmount: string): Promise<void> {
    if (!order.params || !('limitPrice' in order.params)) {
      throw new Error("Invalid stop-limit order params");
    }

    logger.info(`Triggering stop-limit order ${order.id} with ${makerAmount} tokens at limit price ${order.params.limitPrice}`);
    
    // Call parent trigger method to handle 1inch integration
    await super.trigger(order, makerAmount, takerAmount);
  }

}

// Register watcher - mock mode will be set by OrderRegistry
registerOrderWatcher(OrderType.STOP_LIMIT, new StopLimitWatcher(true)); // Default to mock mode
