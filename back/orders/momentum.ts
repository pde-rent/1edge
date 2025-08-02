import { OrderType } from "@common/types";
import type { Order, MomentumReversalParams } from "@common/types";
import { logger } from "@back/utils/logger";
import {
  PriceBasedOrderWatcher,
  registerOrderWatcher,
  RSI_OVERSOLD,
  RSI_OVERBOUGHT,
} from "./base";

/**
 * Momentum Reversal order watcher
 * Triggers on RSI-based momentum reversal signals
 */
class MomentumReversalOrderWatcher extends PriceBasedOrderWatcher {
  async shouldTrigger(order: Order): Promise<boolean> {
    const params = this.validateParams<MomentumReversalParams>(order);
    if (!params) return false;

    // Get price info with analysis data
    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo?.priceData?.analysis?.rsi) {
      logger.debug(
        `No RSI data available for momentum reversal order ${order.id}`,
      );
      return false;
    }

    const rsiData = priceInfo.priceData.analysis.rsi;

    // Need enough data for RSI and its moving average
    const requiredDataPoints = params.rsiPeriod + params.rsimaPeriod;
    if (rsiData.length < requiredDataPoints) {
      logger.debug(
        `Insufficient RSI data: ${rsiData.length} < ${requiredDataPoints}`,
      );
      return false;
    }

    // Get current RSI
    const currentRSI = rsiData[rsiData.length - 1];

    // Calculate RSI moving average
    const rsiMAStart = rsiData.length - params.rsimaPeriod;
    const recentRSIValues = rsiData.slice(rsiMAStart);
    const rsiMA =
      recentRSIValues.reduce((sum, val) => sum + val, 0) / params.rsimaPeriod;

    // Check for reversal conditions
    const isOversoldReversal = currentRSI < RSI_OVERSOLD && currentRSI > rsiMA;
    const isOverboughtReversal =
      currentRSI > RSI_OVERBOUGHT && currentRSI < rsiMA;

    if (isOversoldReversal || isOverboughtReversal) {
      const reversalType = isOversoldReversal ? "oversold" : "overbought";
      logger.info(
        `Momentum reversal detected: ${reversalType} condition (RSI: ${currentRSI}, MA: ${rsiMA})`,
      );
      return true;
    }

    return false;
  }

  async trigger(
    order: Order,
    makerAmount: string,
    takerAmount: string,
  ): Promise<void> {
    const params = this.validateParams<MomentumReversalParams>(order);
    if (!params) throw new Error("Invalid momentum reversal parameters");

    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) throw new Error("Failed to get price info");

    // Store entry price for TP/SL calculation
    order.triggerPrice = priceInfo.price;

    // Calculate take profit and stop loss levels
    const tpLevel = priceInfo.price * (1 + params.tpPct / 100);
    const slLevel = priceInfo.price * (1 - params.slPct / 100);

    logger.info(
      `Momentum reversal entry at ${priceInfo.price}, TP: ${tpLevel}, SL: ${slLevel}`,
    );

    // Log execution
    this.logExecution({
      order,
      currentPrice: priceInfo.price,
      symbol: priceInfo.symbol,
      triggerAmount: makerAmount,
    });

    // Execute the order
    await super.trigger(order, makerAmount, takerAmount);
  }

  updateNextTrigger(order: Order): void {
    // Momentum reversal orders are one-time triggers
    // TP/SL management would be handled separately
  }
}

// Register the watcher
registerOrderWatcher(
  OrderType.MOMENTUM_REVERSAL,
  new MomentumReversalOrderWatcher(),
);
