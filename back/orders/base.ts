import type { Order } from "@common/types";
import { logger } from "@back/utils/logger";

/**
 * Base interface for all order watchers
 * Each order type implements this interface
 */
export interface OrderWatcher {
  /**
   * Check if trigger conditions are met
   */
  shouldTrigger(order: Order): Promise<boolean>;

  /**
   * Execute the order when triggered
   */
  execute(order: Order): Promise<void>;

  /**
   * Update order state after execution (for recurring orders)
   */
  updateNextTrigger?(order: Order): void;
}

/**
 * Registry of order watchers by type
 */
export const orderHandlers = new Map<string, OrderWatcher>();

/**
 * Register an order watcher
 */
export function registerOrderWatcher(type: string, watcher: OrderWatcher): void {
  orderHandlers.set(type, watcher);
  logger.debug(`Registered watcher for order type: ${type}`);
}

/**
 * Get handler for order type
 */
export function getOrderWatcher(type: string): OrderWatcher | undefined {
  return orderHandlers.get(type);
}
