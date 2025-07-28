#!/usr/bin/env bun

import { logger } from '@back/utils/logger';
import type { OneInchOrder, OrderbookLevel, ReconstructedOrderbook } from '@common/types';

/**
 * Service for reconstructing orderbooks from 1inch API data
 * Fetches orders sorted by makerRate and takerRate to build bid/ask levels
 */
export class OrderbookReconstructor {
  private readonly apiUrl = 'https://api.1inch.dev/orderbook/v4.0';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ONEINCH_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('No 1inch API key provided - some features may be limited');
    }
  }

  /**
   * Reconstructs orderbook for a given asset pair
   * @param chain - Chain ID (1 = Ethereum, 137 = Polygon, etc.)
   * @param makerAsset - Maker asset contract address
   * @param takerAsset - Taker asset contract address
   * @param limit - Number of orders to fetch per side (max 1000)
   * @returns Reconstructed orderbook with bids and asks
   */
  async reconstructOrderbook(
    chain: number,
    makerAsset?: string,
    takerAsset?: string,
    limit: number = 1000
  ): Promise<ReconstructedOrderbook> {
    const startTime = Date.now();
    
    try {
      // Fetch orders sorted by both rates concurrently
      const [bidsData, asksData] = await Promise.all([
        this.fetchOrders(chain, { sortBy: 'makerRate', makerAsset, takerAsset, limit }),
        this.fetchOrders(chain, { sortBy: 'takerRate', makerAsset, takerAsset, limit })
      ]);

      // Process orders into orderbook levels
      const bids = this.processOrdersToLevels(bidsData, 'makerRate', true); // Descending for bids
      const asks = this.processOrdersToLevels(asksData, 'takerRate', false); // Ascending for asks

      const orderbook: ReconstructedOrderbook = {
        chain,
        makerAsset: makerAsset || 'ALL',
        takerAsset: takerAsset || 'ALL',
        bids,
        asks,
        timestamp: Date.now(),
        summary: {
          totalBidOrders: bidsData.length,
          totalAskOrders: asksData.length,
          bestBid: bids.length > 0 ? bids[0].price : null,
          bestAsk: asks.length > 0 ? asks[0].price : null,
          spread: null
        }
      };

      // Calculate spread if we have both bid and ask
      if (orderbook.summary.bestBid && orderbook.summary.bestAsk) {
        const bidPrice = parseFloat(orderbook.summary.bestBid);
        const askPrice = parseFloat(orderbook.summary.bestAsk);
        const spread = askPrice - bidPrice;
        const spreadPercent = (spread / bidPrice) * 100;
        orderbook.summary.spread = `${spread.toFixed(8)} (${spreadPercent.toFixed(4)}%)`;
      }

      const duration = Date.now() - startTime;
      logger.info(`Reconstructed orderbook for ${chain}:${makerAsset}/${takerAsset} in ${duration}ms`);
      logger.info(`Found ${bids.length} bid levels, ${asks.length} ask levels`);

      return orderbook;

    } catch (error) {
      logger.error(`Failed to reconstruct orderbook: ${error}`);
      throw error;
    }
  }

  /**
   * Fetches orders from 1inch API with specified parameters
   */
  private async fetchOrders(
    chain: number,
    params: {
      sortBy: 'makerRate' | 'takerRate';
      makerAsset?: string;
      takerAsset?: string;
      limit: number;
    }
  ): Promise<OneInchOrder[]> {
    const url = `${this.apiUrl}/${chain}/all`;
    
    // Build query parameters
    const queryParams = new URLSearchParams({
      page: '1',
      limit: Math.min(params.limit, 1000).toString(),
      sortBy: params.sortBy,
      statuses: '1' // Only active orders
    });

    if (params.makerAsset) {
      queryParams.append('makerAsset', params.makerAsset);
    }
    
    if (params.takerAsset) {
      queryParams.append('takerAsset', params.takerAsset);
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': '1edge-orderbook-reconstructor/1.0'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      logger.debug(`Fetching orders: ${url}?${queryParams.toString()}`);
      
      const response = await fetch(`${url}?${queryParams.toString()}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const orders: OneInchOrder[] = await response.json();
      
      // Filter out invalid orders
      const validOrders = orders.filter(order => 
        order.orderInvalidReason === null &&
        order.remainingMakerAmount !== '0' &&
        parseFloat(order.makerRate) > 0 &&
        parseFloat(order.takerRate) > 0
      );

      logger.debug(`Fetched ${orders.length} orders, ${validOrders.length} valid (sortBy: ${params.sortBy})`);
      return validOrders;

    } catch (error) {
      logger.error(`Failed to fetch orders from 1inch API: ${error}`);
      throw error;
    }
  }

  /**
   * Processes raw orders into aggregated price levels
   */
  private processOrdersToLevels(
    orders: OneInchOrder[],
    rateField: 'makerRate' | 'takerRate',
    descending: boolean
  ): OrderbookLevel[] {
    if (orders.length === 0) return [];

    // Group orders by price (rate)
    const priceMap = new Map<string, OneInchOrder[]>();
    
    for (const order of orders) {
      const price = order[rateField];
      if (!priceMap.has(price)) {
        priceMap.set(price, []);
      }
      priceMap.get(price)!.push(order);
    }

    // Convert to levels and sort
    const levels: OrderbookLevel[] = [];
    let runningTotal = 0n;

    for (const [price, ordersAtLevel] of priceMap) {
      // Calculate total amount at this level
      const totalAmount = ordersAtLevel.reduce((sum, order) => {
        return sum + BigInt(order.remainingMakerAmount);
      }, 0n);

      runningTotal += totalAmount;

      levels.push({
        price,
        amount: totalAmount.toString(),
        total: runningTotal.toString(),
        count: ordersAtLevel.length,
        orders: ordersAtLevel
      });
    }

    // Sort levels by price
    levels.sort((a, b) => {
      const priceA = parseFloat(a.price);
      const priceB = parseFloat(b.price);
      return descending ? priceB - priceA : priceA - priceB;
    });

    // Recalculate running totals after sorting
    let cumulativeTotal = 0n;
    for (const level of levels) {
      cumulativeTotal += BigInt(level.amount);
      level.total = cumulativeTotal.toString();
    }

    return levels;
  }

  /**
   * Get orderbook for specific trading pairs
   */
  async getOrderbookForPair(
    chain: number,
    baseAsset: string,
    quoteAsset: string,
    limit: number = 500
  ): Promise<ReconstructedOrderbook> {
    return this.reconstructOrderbook(chain, baseAsset, quoteAsset, limit);
  }

  /**
   * Get market overview with all active trading pairs
   */
  async getMarketOverview(chain: number, limit: number = 100): Promise<ReconstructedOrderbook> {
    return this.reconstructOrderbook(chain, undefined, undefined, limit);
  }
}

// Export singleton instance
export const orderbookReconstructor = new OrderbookReconstructor();