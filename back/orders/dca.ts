import type { Order } from "@common/types";
import { OrderType } from "@common/types";
import { logger } from "@back/utils/logger";
import { registerOrderHandler, type OrderHandler } from "./base";

class DCAHandler implements OrderHandler {
  async shouldTrigger(order: Order): Promise<boolean> {
    if (!order.nextTriggerValue) {
      return false;
    }
    
    return Date.now() >= Number(order.nextTriggerValue);
  }

  async execute(order: Order): Promise<void> {
    if (!order.params || !('amount' in order.params)) {
      throw new Error("Invalid DCA order params");
    }

    logger.info(`Executing DCA order ${order.id} for amount ${order.params.amount}`);
    
    // Create chase-limit order close to market price
    const priceOffset = 0.005; // 0.5% below market
    // TODO: Create 1inch order with chase behavior
  }

  updateNextTrigger(order: Order): void {
    if (!order.params || !('interval' in order.params)) {
      return;
    }

    // interval is in days, convert to ms
    const intervalMs = order.params.interval * 24 * 60 * 60 * 1000;
    order.nextTriggerValue = Date.now() + intervalMs;
  }
}

// Register handler
registerOrderHandler(OrderType.DCA, new DCAHandler());