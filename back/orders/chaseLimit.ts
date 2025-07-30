import type { Order } from "@common/types";
import { OrderType } from "@common/types";
import { priceCache } from "@back/services/priceCache";
import { logger } from "@back/utils/logger";
import { registerOrderHandler, type OrderHandler } from "./base";

class ChaseLimitHandler implements OrderHandler {
  async shouldTrigger(order: Order): Promise<boolean> {
    if (!order.params || !('distancePct' in order.params)) {
      return false;
    }

    const priceData = priceCache.getPrice(this.getSymbolFromPair(order.pair));
    if (!priceData?.last?.mid) {
      return false;
    }

    const currentPrice = priceData.last.mid;
    const targetPrice = order.triggerPrice || currentPrice;
    const drift = Math.abs(currentPrice - targetPrice) / targetPrice;
    
    return drift >= (order.params.distancePct / 100);
  }

  async execute(order: Order): Promise<void> {
    if (!order.params || !('distancePct' in order.params)) {
      throw new Error("Invalid chase-limit order params");
    }

    const priceData = priceCache.getPrice(this.getSymbolFromPair(order.pair));
    if (!priceData?.last?.mid) {
      throw new Error("No price data available");
    }

    const currentPrice = priceData.last.mid;
    const limitPrice = currentPrice * (1 - order.params.distancePct / 100);
    
    logger.info(`Executing chase-limit order ${order.id} at price ${limitPrice}`);
    
    // Cancel previous order if exists
    if (order.oneInchOrderHashes?.length) {
      // TODO: Cancel previous 1inch order
    }
    
    // Create new limit order at adjusted price
    order.triggerPrice = currentPrice;
  }

  private getSymbolFromPair(pair: string): string {
    const cleanPair = pair.replace('/', '');
    return `agg:spot:${cleanPair}`;
  }
}

// Register handler
registerOrderHandler(OrderType.CHASE_LIMIT, new ChaseLimitHandler());