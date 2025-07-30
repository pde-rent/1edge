#!/usr/bin/env bun

import { logger } from "@back/utils/logger";
import { getConfig } from "./config";
import { getCachedTokenDecimals, cacheTokenDecimals } from "./storage";
import { priceCache } from "./priceCache";
import type {
  OneInchOrder,
  OrderbookLevel,
  OneInchOrderBook,
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
  ): Promise<OneInchOrderBook> {
    const startTime = Date.now();

    try {
      // Fetch token decimals for proper scaling - no hardcoded defaults
      let makerAssetDecimals: number;
      let takerAssetDecimals: number;

      if (makerAsset && takerAsset) {
        try {
          [makerAssetDecimals, takerAssetDecimals] = await Promise.all([
            this.fetchTokenDecimals(chain, makerAsset),
            this.fetchTokenDecimals(chain, takerAsset),
          ]);
          logger.info(`Token decimals: maker(${makerAsset.slice(0,6)})=${makerAssetDecimals}, taker(${takerAsset.slice(0,6)})=${takerAssetDecimals}`);
        } catch (error) {
          logger.error(`Failed to fetch token decimals: ${error}`);
          throw new Error(`Cannot proceed without token decimals for ${makerAsset}/${takerAsset}`);
        }
      }

      // Fetch spot price for filtering (if available)
      let spotPrice: number | null = null;
      if (makerAsset && takerAsset) {
        try {
          spotPrice = await this.fetchSpotPriceFromCollector(chain, makerAsset, takerAsset, makerAssetDecimals, takerAssetDecimals);
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

      // Separate orders into bids and asks (no scaling needed here)
      const result = this.separateBidsAndAsksWithSpotPrice(allOrders, makerAsset, takerAsset, spotPrice);
      const bidOrders = result.bidOrders;
      const askOrders = result.askOrders;

      // Debug: Log first few raw rates to understand the data
      if (bidOrders.length > 0) {
        logger.info(`First 3 raw bid rates: ${bidOrders.slice(0, 3).map(o => o.makerRate).join(', ')}`);
        logger.info(`First bid order details: maker=${bidOrders[0].data.makerAsset}, taker=${bidOrders[0].data.takerAsset}, makingAmount=${bidOrders[0].remainingMakerAmount}`);
      }
      if (askOrders.length > 0) {
        logger.info(`First 3 raw ask rates: ${askOrders.slice(0, 3).map(o => o.makerRate).join(', ')}`);
        logger.info(`First ask order details: maker=${askOrders[0].data.makerAsset}, taker=${askOrders[0].data.takerAsset}, makingAmount=${askOrders[0].remainingMakerAmount}`);
      }

      // Process orders into orderbook levels with proper decimal scaling
      logger.info(`Processing orders: ${bidOrders.length} bids, ${askOrders.length} asks`);

      // Process orders into levels with proper decimals
      // For bids: makerAsset=USDT, takerAsset=ETH
      // For asks: makerAsset=ETH, takerAsset=USDT
      const bids = this.processOrdersToLevels(bidOrders, "makerRate", true, makerAssetDecimals, takerAssetDecimals, true); // Descending for bids
      const asks = this.processOrdersToLevels(askOrders, "makerRate", false, makerAssetDecimals, takerAssetDecimals, false); // Ascending for asks

      const orderbook: OneInchOrderBook = {
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
        const bidPrice = orderbook.summary.bestBid;
        const askPrice = orderbook.summary.bestAsk;
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
   * Processes raw orders into aggregated price levels with proper decimal scaling
   */
  private processOrdersToLevels(
    orders: OneInchOrder[],
    rateField: "makerRate" | "takerRate",
    descending: boolean,
    makerAssetDecimals: number,
    takerAssetDecimals: number,
    isBid: boolean,
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

    for (const [rawPrice, ordersAtLevel] of priceMap) {
      const rawPriceFloat = parseFloat(rawPrice);

      // Convert raw rate to proper price based on bid/ask and decimals
      let actualPrice: number;

      if (isBid) {
        // Bid: makerAsset is quote (USDT), takerAsset is base (WETH)
        // makerRate represents scaled WETH per USDT, so we need to invert it
        // Price should be USDT per WETH
        const wethPerUsdt = rawPriceFloat / (Math.pow(10, makerAssetDecimals) / Math.pow(10, takerAssetDecimals));
        actualPrice = 1 / wethPerUsdt;
      } else {
        // Ask: makerAsset is base (WETH), takerAsset is quote (USDT)
        // makerRate needs scaling: multiply by 10^(makerDecimals - takerDecimals)
        actualPrice = rawPriceFloat * Math.pow(10, makerAssetDecimals - takerAssetDecimals);
      }

      // Calculate total amount at this level in quote asset (USDT) denomination
      const totalAmountScaled = ordersAtLevel.reduce((sum, order) => {
        if (isBid) {
          // Bid: makerAsset is quote (USDT), takerAsset is base (WETH)
          // Use makerAmount (USDT) directly - but makerAssetDecimals here refers to USDT decimals = 6
          const rawMakingAmount = parseFloat(order.remainingMakerAmount || "0");
          const scaledMakingAmount = rawMakingAmount / Math.pow(10, takerAssetDecimals); // Use takerAssetDecimals (USDT = 6)
          return sum + scaledMakingAmount;
        } else {
          // Ask: makerAsset is base (WETH), takerAsset is quote (USDT)
          // Convert ETH to USDT using actualPrice (since remainingTakerAmount might not be available)
          const rawMakingAmount = parseFloat(order.remainingMakerAmount || "0");
          const scaledMakingAmount = rawMakingAmount / Math.pow(10, makerAssetDecimals); // Use makerAssetDecimals (ETH = 18)
          const usdtEquivalent = scaledMakingAmount * actualPrice;
          return sum + usdtEquivalent;
        }
      }, 0);

      levels.push({
        price: actualPrice,
        amount: totalAmountScaled,
        total: 0, // Will be calculated later
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
      cumulativeTotal += level.amount;
      level.total = cumulativeTotal;
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
      cumulativeTotal += level.amount;
      level.total = cumulativeTotal;
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
  ): Promise<OneInchOrderBook> {
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
  ): Promise<OneInchOrderBook> {
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

      // No fallback values - must fetch from blockchain or cache
      throw new Error(`Unable to fetch decimals for token ${tokenAddress} on chain ${chainId}: ${error}`);
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
