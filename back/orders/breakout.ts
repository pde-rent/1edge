import { OrderType } from "@common/types";
import type { Order, RangeBreakoutParams } from "@common/types";
import { PriceBasedOrderWatcher, registerOrderWatcher } from "./base";

/**
 * Range Breakout order watcher
 * Triggers on strong trending conditions using ADX and EMA
 */
class RangeBreakoutOrderWatcher extends PriceBasedOrderWatcher {
  async shouldTrigger(order: Order): Promise<boolean> {
    const params = this.validateParams<RangeBreakoutParams>(order);
    if (!params) return false;

    const priceInfo = await this.getPriceInfo(order);
    if (!priceInfo) return false;

    const { price: currentPrice, priceData } = priceInfo;

    // Check all three conditions for breakout
    const isStrongTrend = this.checkTechnicalCondition(
      priceData,
      "adx",
      (adx) => adx > (params.adxThreshold || 25),
    );

    const isTrendStrengthening = this.checkTechnicalCondition(
      priceData,
      "adx",
      (adx) => {
        const adxValues =
          priceData.analysis.adx?.filter((v: number) => !isNaN(v)) || [];
        return this.isAboveMA(adxValues, params.adxmaPeriod);
      },
    );

    const hasBreakout = this.checkTechnicalCondition(
      priceData,
      "ema",
      (ema) => {
        const threshold = this.calculatePercentage(
          ema,
          params.breakoutPct || 2.0,
        );
        return Math.abs(currentPrice - ema) > threshold;
      },
    );

    return isStrongTrend && isTrendStrengthening && hasBreakout;
  }

  async trigger(
    order: Order,
    makingAmount: string,
    takingAmount: string,
  ): Promise<void> {
    const priceInfo = await this.getPriceInfo(order);
    if (!priceInfo) throw new Error("Failed to get price info");

    order.nextTriggerValue = priceInfo.price;

    this.logExecution({
      order,
      currentPrice: priceInfo.price,
      symbol: priceInfo.symbol,
      triggerAmount: makingAmount,
    });

    await super.trigger(order, makingAmount, takingAmount);
  }

  updateNextTrigger(order: Order): void {
    // One-time trigger
  }
}

// Register the watcher
registerOrderWatcher(OrderType.RANGE_BREAKOUT, new RangeBreakoutOrderWatcher());
