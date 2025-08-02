import { OrderType } from "@common/types";
import type { Order, RangeParams } from "@common/types";
import { logger } from "@back/utils/logger";
import { SteppedOrderWatcher, registerOrderWatcher } from "./base";

/**
 * Range order watcher
 * Executes orders at specific price levels within a range
 */
class RangeOrderWatcher extends SteppedOrderWatcher {
  async shouldTrigger(order: Order): Promise<boolean> {
    const params = this.validateParams<RangeParams>(order);
    if (!params) return false;

    // Check expiry
    if (this.isExpired(order, params.expiry)) {
      logger.debug(`Range order ${order.id} expired`);
      return false;
    }

    // Check if we have a valid next trigger value
    if (!order.nextTriggerValue || typeof order.nextTriggerValue !== "number") {
      return false;
    }

    // Get current price
    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) return false;

    const currentPrice = priceInfo.price;
    const targetPrice = order.nextTriggerValue;

    // Check if price has reached the target level
    const hasReachedTarget = currentPrice >= targetPrice;

    if (hasReachedTarget) {
      const currentStep = this.getCurrentStep(order);
      logger.debug(
        `Range order reached target ${targetPrice} at step ${currentStep + 1}/${params.steps}`,
      );
    }

    return hasReachedTarget;
  }

  async trigger(
    order: Order,
    makingAmount: string,
    takingAmount: string,
  ): Promise<void> {
    const params = this.validateParams<RangeParams>(order);
    if (!params) throw new Error("Invalid range parameters");

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
      triggerAmount: makingAmount,
    });

    // Execute the order
    await super.trigger(order, makingAmount, takingAmount);
  }

  updateNextTrigger(order: Order): void {
    const params = this.validateParams<RangeParams>(order);
    if (!params) return;

    const currentStep = this.getCurrentStep(order);
    const nextStep = currentStep + 1;

    // Check if all steps completed
    if (nextStep >= params.steps) {
      logger.debug(
        `Range order ${order.id} completed all ${params.steps} steps`,
      );
      order.nextTriggerValue = undefined;
      return;
    }

    // Calculate next trigger price
    const priceRange = params.endPrice - params.startPrice;
    const pricePerStep = priceRange / params.steps;
    const nextTriggerPrice = params.startPrice + pricePerStep * (nextStep + 1);

    order.nextTriggerValue = nextTriggerPrice;
    logger.debug(
      `Range order ${order.id} next trigger at price ${nextTriggerPrice} (step ${nextStep + 1}/${params.steps})`,
    );
  }

  /**
   * Get the amount to execute for the current step
   */
  getTriggerAmount(order: Order): string {
    const params = this.validateParams<RangeParams>(order);
    if (!params) return "0";

    const currentStep = this.getCurrentStep(order);
    return this.calculateStepAmount(params.amount, params.steps, currentStep);
  }
}

// Register the watcher
registerOrderWatcher(OrderType.RANGE, new RangeOrderWatcher());
