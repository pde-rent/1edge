import type { Order } from "@common/types";
import { OrderType } from "@common/types";
import { logger } from "@back/utils/logger";
import { registerOrderHandler, type OrderHandler } from "./base";

class TWAPHandler implements OrderHandler {
  async shouldTrigger(order: Order): Promise<boolean> {
    if (!order.nextTriggerValue) {
      return false;
    }
    
    return Date.now() >= Number(order.nextTriggerValue);
  }

  async execute(order: Order): Promise<void> {
    if (!order.params || !('totalAmount' in order.params)) {
      throw new Error("Invalid TWAP order params");
    }

    const { totalAmount, intervalCount } = order.params;
    const amountPerInterval = BigInt(totalAmount) / BigInt(intervalCount);
    
    logger.info(`Executing TWAP slice ${order.triggerCount + 1}/${intervalCount} for ${amountPerInterval.toString()}`);
    
    // Create market order for this interval's amount
  }

  updateNextTrigger(order: Order): void {
    if (!order.params || !('timeWindow' in order.params)) {
      return;
    }

    const { timeWindow, intervalCount } = order.params;
    const intervalMs = (timeWindow / intervalCount) * 1000;
    order.nextTriggerValue = Date.now() + intervalMs;
  }
}

// Register handler
registerOrderHandler(OrderType.TWAP, new TWAPHandler());