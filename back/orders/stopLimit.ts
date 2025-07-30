import type { Order } from "@common/types";
import { OrderType } from "@common/types";
import { priceCache } from "@back/services/priceCache";
import { logger } from "@back/utils/logger";
import { registerOrderHandler, type OrderHandler } from "./base";

class StopLimitHandler implements OrderHandler {
  async shouldTrigger(order: Order): Promise<boolean> {
    if (!order.params || !('stopPrice' in order.params)) {
      return false;
    }

    const priceData = priceCache.getPrice(this.getSymbolFromPair(order.pair));
    if (!priceData?.last?.mid) {
      logger.debug(`No price data for ${order.pair}`);
      return false;
    }

    const currentPrice = priceData.last.mid;
    return currentPrice >= order.params.stopPrice;
  }

  async execute(order: Order): Promise<void> {
    if (!order.params || !('limitPrice' in order.params)) {
      throw new Error("Invalid stop-limit order params");
    }

    logger.info(`Executing stop-limit order ${order.id} at limit price ${order.params.limitPrice}`);
    // 1inch SDK integration will create limit order at specified price
  }

  private getSymbolFromPair(pair: string): string {
    const cleanPair = pair.replace('/', '');
    return `agg:spot:${cleanPair}`;
  }
}

// Register handler
registerOrderHandler(OrderType.STOP_LIMIT, new StopLimitHandler());