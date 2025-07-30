import type { Order } from "@common/types";
import { OrderType } from "@common/types";
import { priceCache } from "@back/services/priceCache";
import { logger } from "@back/utils/logger";
import { registerOrderWatcher, type OrderWatcher } from "./base";

class StopLimitHandler implements OrderWatcher {
  async shouldTrigger(order: Order): Promise<boolean> {
    if (!order.params || !('stopPrice' in order.params)) {
      return false;
    }

    const priceData = priceCache.getPrice(this.getSymbolFromAssets(order.makerAsset, order.takerAsset));
    if (!priceData?.last?.mid) {
      const symbol = this.getSymbolFromAssets(order.makerAsset, order.takerAsset);
      logger.debug(`No price data for ${symbol}`);
      return false;
    }

    const currentPrice = priceData.last.mid;
    return currentPrice >= order.params.stopPrice;
  }

  async execute(order: Order): Promise<void> {
    if (!order.params || !('limitPrice' in order.params)) {
      throw new Error("Invalid stop-limit order params");
    }

    logger.info(`Executing stop-limit order ${order.id} at limit price ${order.params.limitPrice}`);
    // 1inch SDK integration will create limit order at specified price
  }

  private getSymbolFromAssets(makerAsset: string, takerAsset: string): string {
    // Simple mapping for common assets - in production this would be more sophisticated
    const assetMap: Record<string, string> = {
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "ETH", // WETH
      "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT", // USDT
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC", // USDC
    };
    
    const makerSymbol = assetMap[makerAsset] || "UNKNOWN";
    const takerSymbol = assetMap[takerAsset] || "UNKNOWN";
    
    return `agg:spot:${makerSymbol}${takerSymbol}`;
  }
}

// Register handler
registerOrderWatcher(OrderType.STOP_LIMIT, new StopLimitHandler());
