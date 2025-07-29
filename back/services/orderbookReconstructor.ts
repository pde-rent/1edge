#!/usr/bin/env bun

import { logger } from "@back/utils/logger";
import { getConfig } from "./config";
import { getCachedTokenDecimals, cacheTokenDecimals } from "./storage";
import { priceCache } from "./priceCache";
import type {
  OneInchOrder,
  OrderbookLevel,
  ReconstructedOrderbook,
  TokenMapping,
} from "@common/types";

/**
 * Service for reconstructing orderbooks from 1inch API data
 * Fetches orders sorted by makerRate and takerRate to build bid/ask levels
 */
export class OrderbookReconstructor {
  private readonly apiUrl = "https://api.1inch.dev/orderbook/v4.0";
  private readonly priceApiUrl = "https://api.1inch.dev/price/v1.1";
  private readonly apiKey: string;
  private tokenMapping: TokenMapping;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ONE_INCH_API_KEY || "T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu";
    this.tokenMapping = getConfig().tokenMapping;
    
    if (!this.apiKey) {
      logger.warn("No 1inch API key provided - some features may be limited");
    } else {
      logger.info("1inch API key configured successfully");
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
    limit: number = 1000,
  ): Promise<ReconstructedOrderbook> {
    const startTime = Date.now();

    try {
      // Fetch token decimals for proper scaling first
      let baseDecimals = 18;
      let quoteDecimals = 18;
      
      if (makerAsset && takerAsset) {
        // Hardcode known decimals for testing
        if (makerAsset.toLowerCase() === "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599") {
          baseDecimals = 8; // WBTC
        } else if (makerAsset.toLowerCase() === "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2") {
          baseDecimals = 18; // WETH
        }
        
        if (takerAsset.toLowerCase() === "0xdac17f958d2ee523a2206206994597c13d831ec7") {
          quoteDecimals = 6; // USDT
        }
        
        logger.info(`Token decimals: ${makerAsset.slice(0,6)}=${baseDecimals}, ${takerAsset.slice(0,6)}=${quoteDecimals}`);
        
        // TODO: Later fetch from RPC
        // try {
        //   [baseDecimals, quoteDecimals] = await Promise.all([
        //     this.fetchTokenDecimals(chain, makerAsset),
        //     this.fetchTokenDecimals(chain, takerAsset),
        //   ]);
        // } catch (error) {
        //   logger.error(`Failed to fetch token decimals: ${error}`);
        // }
      }
      
      // Fetch spot price for filtering (if available) - must happen after we know decimals
      let spotPrice: number | null = null;
      if (makerAsset && takerAsset) {
        try {
          spotPrice = await this.fetchSpotPriceFromCollector(chain, makerAsset, takerAsset, baseDecimals, quoteDecimals);
          if (spotPrice !== null) {
            logger.info(`Using collector spot price for filtering: ${spotPrice}`);
          }
        } catch (error) {
          logger.warn(`Failed to fetch spot price from collector: ${error}`);
        }
      }

      // Fetch all orders for the trading pair using enhanced approach
      const allOrders = await this.fetchAllOrdersForPair(chain, makerAsset, takerAsset, limit);
      
      if (allOrders.length === 0) {
        logger.warn(`No orders found for ${makerAsset}/${takerAsset} on chain ${chain}`);
      }
      
      // Separate orders into bids and asks with spot price filtering
      let bidOrders: OneInchOrder[] = [];
      let askOrders: OneInchOrder[] = [];
      
      // Use enhanced method with spot price filtering
      const result = this.separateBidsAndAsksWithSpotPrice(allOrders, makerAsset, takerAsset, spotPrice);
      bidOrders = result.bidOrders;
      askOrders = result.askOrders;
      
      // Apply decimal scaling to the rates only - we'll handle amounts during processing
      if (baseDecimals !== 18 || quoteDecimals !== 18) {
        const scaleFactor = Math.pow(10, baseDecimals - quoteDecimals);
        logger.info(`Applying scale factor: ${scaleFactor} (${baseDecimals}-${quoteDecimals} decimals)`);
        
        // Scale rates only - don't modify amounts yet
        askOrders.forEach(order => {
          const originalRate = parseFloat(order.makerRate);
          const scaledRate = originalRate * scaleFactor;
          order.makerRate = scaledRate.toString();
          logger.debug(`ASK rate scaled: ${originalRate} -> ${scaledRate}`);
        });
        
        bidOrders.forEach(order => {
          const originalRate = parseFloat(order.makerRate);
          const scaledRate = originalRate * scaleFactor;
          order.makerRate = scaledRate.toString();
          logger.debug(`BID rate scaled: ${originalRate} -> ${scaledRate}`);
        });
      }
      
      // Process orders into orderbook levels
      logger.info(`Processing orders: ${bidOrders.length} bids, ${askOrders.length} asks`);
      
      const bids = this.processOrdersToLevels(bidOrders, "makerRate", true, quoteDecimals); // Descending for bids
      const asks = this.processOrdersToLevels(askOrders, "makerRate", false, baseDecimals); // Ascending for asks

      const orderbook: ReconstructedOrderbook = {
        chain,
        makerAsset: makerAsset || "ALL",
        takerAsset: takerAsset || "ALL",
        bids,
        asks,
        timestamp: Date.now(),
        summary: {
          totalBidOrders: bidOrders.length,
          totalAskOrders: askOrders.length,
          bestBid: bids.length > 0 ? bids[0].price : null,
          bestAsk: asks.length > 0 ? asks[0].price : null,
          spread: null,
          spotPrice: spotPrice,
        },
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
      logger.info(
        `Reconstructed orderbook for ${chain}:${makerAsset}/${takerAsset} in ${duration}ms`,
      );
      logger.info(`Found ${bids.length} bid levels, ${asks.length} ask levels`);

      return orderbook;
    } catch (error) {
      logger.error(`Failed to reconstruct orderbook: ${error}`);
      throw error;
    }
  }

  /**
   * Fetches spot price from the collector API for filtering orders
   * @param chain - Chain ID
   * @param baseAsset - Base asset contract address
   * @param quoteAsset - Quote asset contract address
   * @param baseDecimals - Base asset decimals
   * @param quoteDecimals - Quote asset decimals
   * @returns Spot price as number, or null if unavailable
   */
  private async fetchSpotPriceFromCollector(
    chain: number,
    baseAsset: string,
    quoteAsset: string,
    baseDecimals: number,
    quoteDecimals: number
  ): Promise<number | null> {
    try {
      // Map addresses to symbols for collector lookup
      const baseSymbol = this.getSymbolFromAddress(baseAsset, chain);
      const quoteSymbol = this.getSymbolFromAddress(quoteAsset, chain);
      
      logger.info(`Mapping addresses to symbols: ${baseAsset} -> ${baseSymbol}, ${quoteAsset} -> ${quoteSymbol}`);
      
      if (!baseSymbol || !quoteSymbol) {
        logger.warn(`Cannot map addresses to symbols: ${baseAsset} -> ${baseSymbol}, ${quoteAsset} -> ${quoteSymbol}`);
        return null;
      }
      
      // Map symbols to feed format (WETH -> ETH, WBTC -> BTC for feeds)
      const feedBaseSymbol = baseSymbol === 'WETH' ? 'ETH' : (baseSymbol === 'WBTC' ? 'BTC' : baseSymbol);
      const feedQuoteSymbol = quoteSymbol === 'WETH' ? 'ETH' : (quoteSymbol === 'WBTC' ? 'BTC' : quoteSymbol);
      
      // Construct feed symbol based on config ticker format
      const pairSymbol = `${feedBaseSymbol}${feedQuoteSymbol}`;
      const feedSymbol = `agg:spot:${pairSymbol}`;
      
      logger.info(`Constructed feed symbol: ${feedSymbol}`);
      
      // Debug: List all available symbols in priceCache
      const allPrices = priceCache.getAllPrices();
      const availableSymbols = Object.keys(allPrices);
      logger.info(`Available symbols in priceCache: ${JSON.stringify(availableSymbols)}`);
      
      // Get price from priceCache (using same pattern as frontend WebSocket subscriber)
      const priceData = priceCache.getPrice(feedSymbol);
      
      logger.info(`Looking for price data for ${feedSymbol}, found: ${priceData ? 'YES' : 'NO'}`);
      if (priceData) {
        logger.info(`Price data structure: ${JSON.stringify(priceData, null, 2)}`);
      }
      
      if (!priceData || !priceData.last?.mid) {
        logger.debug(`No mid price available in cache for ${feedSymbol}`);
        return null;
      }
      
      const midPrice = priceData.last.mid;
      logger.info(`Retrieved spot price from cache for ${feedSymbol}: ${midPrice}`);
      
      return midPrice;
    } catch (error) {
      logger.error(`Error fetching spot price from cache: ${error}`);
      return null;
    }
  }

  /**
   * Maps token address to symbol for collector lookup using config
   */
  private getSymbolFromAddress(address: string, chain: number = 1): string | null {
    const addr = address.toLowerCase();
    const chainStr = chain.toString();
    
    // Search through token mapping from config
    for (const [symbol, chainAddresses] of Object.entries(this.tokenMapping)) {
      const configAddress = chainAddresses[chainStr];
      if (configAddress && configAddress.toLowerCase() === addr) {
        return symbol;
      }
    }
    
    return null;
  }

  /**
   * Fetches the current spot price for a trading pair using 1inch Spot Price API
   * @param chain - Chain ID
   * @param baseAsset - Base asset contract address
   * @param quoteAsset - Quote asset contract address (for price denomination)
   * @returns Spot price as number, or null if unavailable
   */
  private async fetchSpotPrice(
    chain: number,
    baseAsset: string,
    quoteAsset?: string
  ): Promise<number | null> {
    try {
      // For now, get price in USD as we don't have direct pair pricing
      const url = `${this.priceApiUrl}/${chain}/${baseAsset}`;
      
      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "1edge-orderbook-reconstructor/1.0",
      };

      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      logger.debug(`Fetching spot price: ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        logger.warn(`Failed to fetch spot price: HTTP ${response.status}`);
        return null;
      }

      const priceData = await response.json();
      const price = parseFloat(priceData[baseAsset.toLowerCase()]);
      
      if (isNaN(price) || price <= 0) {
        logger.warn(`Invalid spot price received: ${price}`);
        return null;
      }

      logger.info(`Fetched spot price for ${baseAsset}: ${price} USD`);
      return price;
    } catch (error) {
      logger.error(`Error fetching spot price: ${error}`);
      return null;
    }
  }

  /**
   * Fetches all orders for a trading pair from 1inch API with enhanced dual-sort approach
   * Gets 2000 orders sorted by makerRate and 2000 sorted by takerRate for maximum depth
   */
  private async fetchAllOrdersForPair(
    chain: number,
    baseAsset?: string,
    quoteAsset?: string,
    limit: number = 1000,
  ): Promise<OneInchOrder[]> {
    if (!baseAsset || !quoteAsset) {
      throw new Error("Both baseAsset and quoteAsset are required");
    }

    // Fetch orders in both directions with different sorting
    const [direction1Orders, direction2Orders] = await Promise.all([
      // Get orders where baseAsset is maker, quoteAsset is taker (potential asks)
      this.fetchOrdersDirectly(chain, baseAsset, quoteAsset, "makerRate", 2000),
      // Get orders where quoteAsset is maker, baseAsset is taker (potential bids)
      this.fetchOrdersDirectly(chain, quoteAsset, baseAsset, "takerRate", 2000),
    ]);

    // Combine and deduplicate orders
    const orderMap = new Map<string, OneInchOrder>();
    
    [...direction1Orders, ...direction2Orders].forEach(order => {
      orderMap.set(order.orderHash, order);
    });

    const allOrders = Array.from(orderMap.values());
    logger.info(`Fetched ${allOrders.length} unique orders from ${direction1Orders.length + direction2Orders.length} total`);
    
    return allOrders;
  }

  /**
   * Fetches orders directly from 1inch API with specific parameters
   */
  private async fetchOrdersDirectly(
    chain: number,
    makerAsset: string,
    takerAsset: string,
    sortBy: "makerRate" | "takerRate",
    limit: number,
  ): Promise<OneInchOrder[]> {
    const url = `${this.apiUrl}/${chain}/all`;
    const queryParams = new URLSearchParams({
      page: "1",  
      limit: Math.min(limit, 1000).toString(),
      statuses: "1", // Only valid orders
      sortBy,
      makerAsset,
      takerAsset,
    });

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "1edge-orderbook-reconstructor/1.0",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      logger.debug(`Fetching orders: ${url}?${queryParams.toString()}`);

      const response = await fetch(`${url}?${queryParams.toString()}`, {
        method: "GET", 
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const orders: OneInchOrder[] = await response.json();

      // Filter out invalid orders
      const validOrders = orders.filter(
        (order) =>
          order.orderInvalidReason === null &&
          order.remainingMakerAmount !== "0" &&
          parseFloat(order.makerRate) > 0 &&
          parseFloat(order.takerRate) > 0,
      );

      logger.debug(`Fetched ${orders.length} orders (${makerAsset.slice(0,6)}→${takerAsset.slice(0,6)}, sortBy: ${sortBy}), ${validOrders.length} valid`);
      return validOrders;
    } catch (error) {
      logger.error(`Failed to fetch orders from 1inch API: ${error}`);
      throw error;
    }
  }

  /**
   * Separates orders into bids and asks with spot price filtering for clean separation
   */
  private separateBidsAndAsksWithSpotPrice(
    orders: OneInchOrder[],
    baseAsset: string,
    quoteAsset: string,
    spotPrice: number | null,
  ): { bidOrders: OneInchOrder[]; askOrders: OneInchOrder[] } {
    const bidOrders: OneInchOrder[] = [];
    const askOrders: OneInchOrder[] = [];

    const baseAssetLower = baseAsset.toLowerCase();
    const quoteAssetLower = quoteAsset.toLowerCase();

    for (const order of orders) {
      const makerAsset = order.data.makerAsset.toLowerCase();
      const takerAsset = order.data.takerAsset.toLowerCase();

      if (makerAsset === baseAssetLower && takerAsset === quoteAssetLower) {
        askOrders.push(order);
      } else if (makerAsset === quoteAssetLower && takerAsset === baseAssetLower) {
        bidOrders.push(order);
      }
    }

    return { bidOrders, askOrders };
  }


  /**
   * Processes raw orders into aggregated price levels
   */
  private processOrdersToLevels(
    orders: OneInchOrder[],
    rateField: "makerRate" | "takerRate",
    descending: boolean,
    decimals: number = 18,
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
    
    for (const [price, ordersAtLevel] of priceMap) {
      const priceFloat = parseFloat(price);
      const isBid = descending;

      // Calculate total amount at this level
      // Scale the raw amounts by decimals
      const totalAmountInMakerAsset = ordersAtLevel.reduce((sum, order) => {
        const rawAmount = parseFloat(order.remainingMakerAmount || "0");
        const scaledAmount = rawAmount / Math.pow(10, decimals);
        return sum + scaledAmount;
      }, 0);

      // For display, we want amounts in quote asset (USD value)
      // For asks: amount is in base asset, multiply by price to get quote value
      // For bids: amount is already in quote asset
      const totalAmountInQuoteAsset = isBid
        ? totalAmountInMakerAsset
        : totalAmountInMakerAsset * priceFloat;

      levels.push({
        price,
        amount: totalAmountInQuoteAsset.toString(),
        total: "0", // Will be calculated later
        count: ordersAtLevel.length,
        orders: ordersAtLevel,
      });
    }

    // Sort levels by price
    levels.sort((a, b) => {
      const priceA = parseFloat(a.price);
      const priceB = parseFloat(b.price);
      return descending ? priceB - priceA : priceA - priceB;
    });

    // Recalculate running totals after sorting
    let cumulativeTotal = 0;
    for (const level of levels) {
      cumulativeTotal += parseFloat(level.amount);
      level.total = cumulativeTotal.toString();
    }

    return levels;
  }

  /**
   * Processes raw orders into aggregated price levels using inverted takerRate
   * Used for asks where we want to show the price in terms of makerAsset/takerAsset
   */
  private processOrdersToLevelsInverted(
    orders: OneInchOrder[],
    descending: boolean,
  ): OrderbookLevel[] {
    if (orders.length === 0) return [];

    // Group orders by inverted price (1/takerRate)
    const priceMap = new Map<string, OneInchOrder[]>();

    for (const order of orders) {
      const takerRate = parseFloat(order.takerRate);
      if (takerRate <= 0) continue;
      
      // Invert the takerRate to get consistent pricing
      const invertedPrice = (1 / takerRate).toString();
      
      if (!priceMap.has(invertedPrice)) {
        priceMap.set(invertedPrice, []);
      }
      priceMap.get(invertedPrice)!.push(order);
    }

    // Convert to levels and sort
    const levels: OrderbookLevel[] = [];

    for (const [price, ordersAtLevel] of priceMap) {
      // Calculate total amount at this level
      const totalAmount = ordersAtLevel.reduce((sum, order) => {
        return sum + parseFloat(order.remainingMakerAmount || "0");
      }, 0);

      levels.push({
        price,
        amount: totalAmount.toString(),
        total: "0", // will be set later
        count: ordersAtLevel.length,
        orders: ordersAtLevel,
      });
    }

    // Sort levels by price
    levels.sort((a, b) => {
      const priceA = parseFloat(a.price);
      const priceB = parseFloat(b.price);
      return descending ? priceB - priceA : priceA - priceB;
    });

    // Recalculate running totals after sorting
    let cumulativeTotal = 0;
    for (const level of levels) {
      cumulativeTotal += parseFloat(level.amount);
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
    limit: number = 1000,
  ): Promise<ReconstructedOrderbook> {
    return this.reconstructOrderbook(chain, baseAsset, quoteAsset, limit);
  }


  /**
   * Parse a trading pair symbol like "BTCUSDT" into base and quote tokens
   * @param pairSymbol - Trading pair symbol (e.g., "BTCUSDT", "ETHUSDC")
   * @returns Object with base and quote token symbols
   */
  private parseTradingPair(pairSymbol: string): { base: string; quote: string } | null {
    // Remove common prefixes/suffixes if they exist
    const cleanSymbol = pairSymbol.replace(/^agg:spot:/, '');
    
    // Common quote assets (in order of priority for matching)
    const quoteAssets = ['USDT', 'USDC', 'WETH', 'WBTC', 'ETH', 'BTC'];
    
    for (const quote of quoteAssets) {
      if (cleanSymbol.endsWith(quote)) {
        const base = cleanSymbol.slice(0, -quote.length);
        if (base.length > 0) {
          return { base, quote };
        }
      }
    }
    
    logger.warn(`Unable to parse trading pair: ${pairSymbol}`);
    return null;
  }

  /**
   * Resolve token symbol to contract address for a specific chain
   * @param symbol - Token symbol (e.g., "WBTC", "USDT")
   * @param chain - Chain ID
   * @returns Contract address or null if not found
   */
  private resolveTokenAddress(symbol: string, chain: number): string | null {
    const chainStr = chain.toString();
    const tokenConfig = this.tokenMapping[symbol];
    
    if (!tokenConfig) {
      logger.warn(`Token mapping not found for symbol: ${symbol}`);
      return null;
    }
    
    const address = tokenConfig[chainStr];
    if (!address) {
      logger.warn(`Token address not found for ${symbol} on chain ${chain}`);
      return null;
    }
    
    return address;
  }

  /**
   * Get orderbook for a trading pair using symbol names (e.g., "BTCUSDT")
   * @param pairSymbol - Trading pair symbol
   * @param chain - Chain ID (default: 1 for Ethereum)
   * @param limit - Number of orders per side
   * @returns Reconstructed orderbook
   */
  async getOrderbookForSymbol(
    pairSymbol: string,
    chain: number = 1,
    limit: number = 500,
  ): Promise<ReconstructedOrderbook> {
    const parsed = this.parseTradingPair(pairSymbol);
    if (!parsed) {
      throw new Error(`Invalid trading pair symbol: ${pairSymbol}`);
    }

    const { base, quote } = parsed;
    
    // Resolve token addresses
    const baseAddress = this.resolveTokenAddress(base, chain);
    const quoteAddress = this.resolveTokenAddress(quote, chain);
    
    if (!baseAddress || !quoteAddress) {
      throw new Error(
        `Unable to resolve token addresses for ${base}/${quote} on chain ${chain}`
      );
    }

    logger.info(
      `Resolving orderbook for ${pairSymbol} -> ${base}(${baseAddress})/${quote}(${quoteAddress}) on chain ${chain}`
    );

    return this.reconstructOrderbook(chain, baseAddress, quoteAddress, limit);
  }

  /**
   * Get available tokens for a specific chain
   * @param chain - Chain ID
   * @returns Array of available token symbols on that chain
   */
  getAvailableTokens(chain: number): string[] {
    const chainStr = chain.toString();
    return Object.keys(this.tokenMapping).filter(
      symbol => this.tokenMapping[symbol][chainStr]
    );
  }

  /**
   * Get all supported chains
   * @returns Array of supported chain IDs
   */
  getSupportedChains(): number[] {
    const chainSet = new Set<number>();
    
    Object.values(this.tokenMapping).forEach(tokenConfig => {
      Object.keys(tokenConfig).forEach(chainStr => {
        chainSet.add(parseInt(chainStr));
      });
    });
    
    return Array.from(chainSet).sort((a, b) => a - b);
  }

  /**
   * Fetches token decimals via RPC call
   */
  private async fetchTokenDecimals(chainId: number, tokenAddress: string): Promise<number> {
    // Check cache first
    const cached = await getCachedTokenDecimals(chainId, tokenAddress);
    if (cached !== null) {
      return cached;
    }

    // Get RPC URL from keeper config (reuse existing network config)
    const config = getConfig();
    const networkConfig = config.services?.keeper?.networks?.[chainId];
    if (!networkConfig?.rpcUrl) {
      throw new Error(`No RPC URL configured for chain ${chainId}`);
    }

    const rpcUrl = networkConfig.rpcUrl;
    
    // ERC20 decimals() function selector: 0x313ce567
    const data = "0x313ce567";
    
    const payload = {
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          to: tokenAddress,
          data: data,
        },
        "latest"
      ],
      id: 1,
    };

    try {
      logger.debug(`Fetching decimals for ${tokenAddress} on chain ${chainId}`);
      
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`RPC error: ${result.error.message}`);
      }

      // Parse the hex result to get decimals
      const decimals = parseInt(result.result, 16);
      
      if (isNaN(decimals) || decimals < 0 || decimals > 18) {
        throw new Error(`Invalid decimals value: ${decimals}`);
      }

      // Cache the result
      await cacheTokenDecimals(chainId, tokenAddress, decimals);
      
      logger.debug(`Fetched decimals for ${tokenAddress}: ${decimals}`);
      return decimals;
    } catch (error) {
      logger.error(`Failed to fetch decimals for ${tokenAddress}: ${error}`);
      
      // Fallback to common values
      const fallbackDecimals = tokenAddress.toLowerCase() === "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599" ? 8 : 18;
      logger.warn(`Using fallback decimals for ${tokenAddress}: ${fallbackDecimals}`);
      
      await cacheTokenDecimals(chainId, tokenAddress, fallbackDecimals, 3600); // Cache for 1 hour
      return fallbackDecimals;
    }
  }

  /**
   * Scales raw amount using token decimals
   */
  private scaleAmount(rawAmount: string, decimals: number): number {
    const amount = parseFloat(rawAmount);
    const divisor = 10 ** decimals;
    return amount / divisor;
  }

  /**
   * Scales rate between two tokens using their decimals
   */
  private scaleRate(rawRate: string, baseDecimals: number, quoteDecimals: number): number {
    const rate = parseFloat(rawRate);
    // Rate scaling: rate * (10^baseDecimals) / (10^quoteDecimals)
    const scaleFactor = Math.pow(10, baseDecimals - quoteDecimals);
    return rate * scaleFactor;
  }
}

// Export singleton instance
export const orderbookReconstructor = new OrderbookReconstructor();
