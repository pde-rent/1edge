import { OrderType } from "@common/types";
import type { Order, IcebergParams } from "@common/types";
import { logger } from "@back/utils/logger";
import { SteppedOrderWatcher, registerOrderWatcher } from "./base";

/**
 * Iceberg order watcher
 * Executes large orders in smaller chunks at different price levels
 */
class IcebergOrderWatcher extends SteppedOrderWatcher {
  async shouldTrigger(order: Order): Promise<boolean> {
    const params = this.validateParams<IcebergParams>(order);
    if (!params) return false;

    // Check expiry
    if (this.isExpired(order, params.expiry)) {
      logger.debug(`Iceberg order ${order.id} expired`);
      return false;
    }

    // Get current price
    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) return false;

    const currentStep = this.getCurrentStep(order);
    
    // Check if all steps completed
    if (currentStep >= params.steps) {
      logger.debug(`Iceberg order ${order.id} completed all ${params.steps} steps`);
      return false;
    }

    // Calculate target price for current step
    const priceRange = params.endPrice - params.startPrice;
    const pricePerStep = priceRange / params.steps;
    const targetPrice = params.startPrice + (pricePerStep * (currentStep + 1));

    // Check if current price has reached the target level
    const hasReachedLevel = priceInfo.price >= targetPrice;

    if (hasReachedLevel) {
      logger.debug(`Iceberg step ${currentStep + 1}/${params.steps} triggered at price ${priceInfo.price} (target: ${targetPrice})`);
    }

    return hasReachedLevel;
  }

  async trigger(order: Order, makerAmount: string, takerAmount: string): Promise<void> {
    const params = this.validateParams<IcebergParams>(order);
    if (!params) throw new Error("Invalid iceberg parameters");

    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) throw new Error("Failed to get price info");

    const currentStep = this.getCurrentStep(order);

    // Log execution
    this.logExecution({
      order,
      currentPrice: priceInfo.price,
      symbol: priceInfo.symbol,
      step: currentStep + 1,
      totalSteps: params.steps,
      triggerAmount: makerAmount
    });

    // Execute the order
    await super.trigger(order, makerAmount, takerAmount);
  }

  updateNextTrigger(order: Order): void {
    // Iceberg orders track progress through triggerCount
    // No additional state updates needed
  }

  /**
   * Get the amount to execute for the current step
   */
  getTriggerAmount(order: Order): string {
    const params = this.validateParams<IcebergParams>(order);
    if (!params) return "0";

    const currentStep = this.getCurrentStep(order);
    return this.calculateStepAmount(params.amount, params.steps, currentStep);
  }
}

// Register the watcher
registerOrderWatcher(OrderType.ICEBERG, new IcebergOrderWatcher());