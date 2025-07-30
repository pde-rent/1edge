import type { Order, RangeOrderParams } from "@common/types";
import { OrderType } from "@common/types";
import { logger } from "@back/utils/logger";
import { registerOrderWatcher, BaseOrderWatcher } from "./base";
import { priceCache } from "@back/services/priceCache";
import { getSymbolFromAssets, getAssetSymbol } from "@back/utils/assetMapping";

class RangeOrderWatcher extends BaseOrderWatcher {
  async shouldTrigger(order: Order): Promise<boolean> {
    const params = order.params as RangeOrderParams;
    if (!params) {
      return false;
    }

    // Get current price
    const symbol = getSymbolFromAssets(order.makerAsset, order.takerAsset);
    const priceData = priceCache.getPrice(symbol);
    if (!priceData?.last?.mid) {
      logger.debug(`No price data for ${symbol}`);
      return false;
    }

    const currentPrice = priceData.last.mid;
    
    // Calculate how many steps we should have completed by now
    const totalSteps = this.calculateTotalSteps(params);
    
    // Check if we've completed all steps
    if ((order.triggerCount || 0) >= totalSteps) {
      return false; // Stop after completing all steps
    }

    // Check if we've reached expiry
    if (params.expiry) {
      const expiryTime = order.createdAt + (params.expiry * 24 * 60 * 60 * 1000); // Days to ms
      if (Date.now() >= expiryTime) {
        return false; // Stop triggering after expiry
      }
    }

    // For first trigger, check if price is within range
    if (!order.nextTriggerValue) {
      // Determine if this is an upside or downside range order
      const isUpside = params.endPrice > params.startPrice;
      
      if (isUpside) {
        // Upside scaling: trigger when price is above start price
        return currentPrice >= params.startPrice;
      } else {
        // Downside scaling: trigger when price is below start price
        return currentPrice <= params.startPrice;
      }
    }

    // For subsequent triggers, check if price has moved enough to trigger next step
    const nextTriggerPrice = Number(order.nextTriggerValue);
    const isUpside = params.endPrice > params.startPrice;
    
    if (isUpside) {
      // For upside scaling, trigger when price reaches or exceeds the next level
      return currentPrice >= nextTriggerPrice;
    } else {
      // For downside scaling, trigger when price reaches or falls below the next level
      return currentPrice <= nextTriggerPrice;
    }
  }

  async trigger(order: Order, makerAmount: string, takerAmount: string): Promise<void> {
    const params = order.params as RangeOrderParams;
    if (!params) {
      throw new Error("Invalid Range order params");
    }

    // Check if we're within the expiry window
    if (params.expiry) {
      const expiryTime = order.createdAt + (params.expiry * 24 * 60 * 60 * 1000);
      if (Date.now() >= expiryTime) {
        throw new Error("Range order execution outside expiry window");
      }
    }

    // Get current price for validation
    const symbol = getSymbolFromAssets(order.makerAsset, order.takerAsset);
    const priceData = priceCache.getPrice(symbol);
    const currentPrice = priceData?.last?.mid || 0;

    // Calculate step information for logging
    const totalSteps = this.calculateTotalSteps(params);
    const currentStep = order.triggerCount + 1;
    const isUpside = params.endPrice > params.startPrice;

    // Get asset symbol for logging
    const assetSymbol = getAssetSymbol(order.makerAsset);
    logger.info(`Triggering Range order step ${currentStep}/${totalSteps} for ${makerAmount} ${assetSymbol} at price ${currentPrice} (${isUpside ? 'scaling-in upside' : 'scaling-in downside'})`);

    // Call parent trigger method to handle 1inch integration
    await super.trigger(order, makerAmount, takerAmount);
  }

  updateNextTrigger(order: Order): void {
    const params = order.params as RangeOrderParams;
    if (!params) {
      return;
    }

    const isUpside = params.endPrice > params.startPrice;
    const currentStep = order.triggerCount || 0;
    const totalSteps = this.calculateTotalSteps(params);

    // Don't set next trigger if we've completed all steps
    if (currentStep >= totalSteps) {
      order.nextTriggerValue = undefined;
      return;
    }

    // Calculate the next trigger price
    // Each step moves by stepPct in the direction of endPrice
    const priceRange = Math.abs(params.endPrice - params.startPrice);
    const stepSize = priceRange * (params.stepPct / 100);
    
    let nextTriggerPrice: number;
    
    if (isUpside) {
      // For upside scaling, next trigger is stepPct higher than the last
      nextTriggerPrice = params.startPrice + (stepSize * (currentStep + 1));
      
      // Don't go beyond end price
      if (nextTriggerPrice > params.endPrice) {
        order.nextTriggerValue = undefined; // No more triggers
        return;
      }
    } else {
      // For downside scaling, next trigger is stepPct lower than the last
      nextTriggerPrice = params.startPrice - (stepSize * (currentStep + 1));
      
      // Don't go beyond end price
      if (nextTriggerPrice < params.endPrice) {
        order.nextTriggerValue = undefined; // No more triggers
        return;
      }
    }

    order.nextTriggerValue = nextTriggerPrice;
  }

  private calculateTotalSteps(params: RangeOrderParams): number {
    // Calculate total number of steps based on price range and step percentage
    const priceRange = Math.abs(params.endPrice - params.startPrice);
    const stepSize = priceRange * (params.stepPct / 100);
    return Math.ceil(priceRange / stepSize);
  }
}

// Register watcher - mock mode will be set by OrderRegistry
registerOrderWatcher(OrderType.RANGE, new RangeOrderWatcher(true)); // Default to mock mode