import type { Order } from "@common/types";
import { logger } from "@back/utils/logger";

/**
 * Base interface for all order handlers
 * Each order type implements this interface
 */
export interface OrderHandler {
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
 * Registry of order handlers by type
 */
export const orderHandlers = new Map<string, OrderHandler>();

/**
 * Register an order handler
 */
export function registerOrderHandler(type: string, handler: OrderHandler): void {
  orderHandlers.set(type, handler);
  logger.debug(`Registered handler for order type: ${type}`);
}

/**
 * Get handler for order type
 */
export function getOrderHandler(type: string): OrderHandler | undefined {
  return orderHandlers.get(type);
}