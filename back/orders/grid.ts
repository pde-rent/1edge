import { OrderType } from "@common/types";
import type { Order, GridTradingParams } from "@common/types";
import { logger } from "@back/utils/logger";
import { SteppedOrderWatcher, registerOrderWatcher } from "./base";

interface GridState {
  lastLevel: number;
  buyLevels: number[];
  sellLevels: number[];
}

/**
 * Grid Trading order watcher
 * Creates buy/sell orders at predefined price levels
 */
class GridTradingOrderWatcher extends SteppedOrderWatcher {
  async shouldTrigger(order: Order): Promise<boolean> {
    const params = this.validateOrderState<GridTradingParams>(order);
    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) return false;

    const { currentLevel, inRange } = this.calculateGridMetrics(
      params,
      priceInfo.price,
    );
    if (!inRange) return false;

    const gridState = this.getGridState(order, currentLevel);
    return gridState.lastLevel !== currentLevel;
  }

  async trigger(
    order: Order,
    makingAmount: string,
    takingAmount: string,
  ): Promise<void> {
    const params = this.validateOrderState<GridTradingParams>(order);
    const priceInfo = this.getPriceInfo(order);
    if (!priceInfo) this.handleOrderError(order.id, "Failed to get price info");

    const { currentLevel, totalLevels } = this.calculateGridMetrics(
      params,
      priceInfo.price,
    );
    const gridState = this.getGridState(order, currentLevel);

    // Update state and log
    this.updateGridState(gridState, currentLevel);
    order.nextTriggerValue = JSON.stringify(gridState);

    this.logExecution({
      order,
      currentPrice: priceInfo.price,
      symbol: priceInfo.symbol,
      step: currentLevel,
      totalSteps: totalLevels,
      triggerAmount: makingAmount,
    });

    await super.trigger(order, makingAmount, takingAmount);
  }

  updateNextTrigger(order: Order): void {
    // Grid state updated in trigger method
  }

  getTriggerAmount(order: Order): string {
    const params = this.validateOrderState<GridTradingParams>(order);
    const { totalLevels } = this.calculateGridMetrics(params, 0);
    return (parseFloat(params.amount) / totalLevels).toFixed(8);
  }

  private calculateGridMetrics(
    params: GridTradingParams,
    currentPrice: number,
  ) {
    const priceRange = params.endPrice - params.startPrice;
    const stepSize = priceRange * (params.stepPct / 100);
    const currentLevel = Math.floor(
      (currentPrice - params.startPrice) / stepSize,
    );
    const totalLevels = Math.floor(priceRange / stepSize) + 1;
    const inRange =
      currentPrice >= params.startPrice && currentPrice <= params.endPrice;

    return { currentLevel, totalLevels, stepSize, inRange };
  }

  private updateGridState(gridState: GridState, currentLevel: number): void {
    const direction = currentLevel > gridState.lastLevel ? "sell" : "buy";

    if (direction === "buy") {
      gridState.buyLevels.push(currentLevel);
    } else {
      gridState.sellLevels.push(currentLevel);
    }

    gridState.lastLevel = currentLevel;
    logger.info(`Grid ${direction} order at level ${currentLevel}`);
  }

  private getGridState(order: Order, currentLevel: number): GridState {
    if (!order.nextTriggerValue) {
      return this.createInitialGridState(order, currentLevel);
    }

    try {
      return JSON.parse(order.nextTriggerValue as string);
    } catch {
      return this.createInitialGridState(order, currentLevel);
    }
  }

  private createInitialGridState(
    order: Order,
    currentLevel: number,
  ): GridState {
    const state: GridState = {
      lastLevel: currentLevel,
      buyLevels: [],
      sellLevels: [],
    };
    order.nextTriggerValue = JSON.stringify(state);
    return state;
  }
}

// Register the watcher
registerOrderWatcher(OrderType.GRID_TRADING, new GridTradingOrderWatcher());
