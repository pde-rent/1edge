// @ts-nocheck
import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "../utils/fetcher";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { roundSig } from "@common/utils";
import type { OneInchOrderBook, OrderbookLevel } from "@common/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PanelWrapper } from "./common/Panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Plus } from "lucide-react";
import { useOrderStore } from "@/stores/orderStore";
import { THEME } from "@common/constants";

// Step size options for order aggregation
const STEP_OPTIONS = [
  { value: "0.01", label: "0.01%" },
  { value: "0.25", label: "0.25%" },
  { value: "0.5", label: "0.5%" },
  { value: "1.0", label: "1%" },
];

interface AggregatedLevel {
  price: number;
  amount: number;
  total: number;
  count: number;
  isRemainder?: boolean;
}

// TODO: Get token addresses from backend config API instead of hardcoding
const TOKEN_ADDRESSES = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  BTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USD: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "1INCH": "0x111111111117dC0aa78b770fA6A738034120C302",
  AAVE: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
};

const getTokenSymbolFromAddress = (address: string): string => {
  const reverseMapping = Object.entries(TOKEN_ADDRESSES).find(
    ([symbol, addr]) => addr.toLowerCase() === address.toLowerCase(),
  );
  return reverseMapping ? reverseMapping[0] : address.slice(0, 6);
};

// Parse feed symbol to extract token pair
const parseFeedSymbol = (
  feedSymbol: string | null,
): { base: string; quote: string } | null => {
  if (!feedSymbol) return null;

  const parts = feedSymbol.split(":");
  let pairSymbol = parts[parts.length - 1];

  const quoteAssets = ["USDT", "USDC", "USD", "WETH", "ETH", "WBTC", "BTC"];

  for (const quote of quoteAssets) {
    if (pairSymbol.endsWith(quote)) {
      const base = pairSymbol.slice(0, -quote.length);
      if (base.length > 0) {
        return { base, quote };
      }
    }
  }

  return null;
};

// Enhanced number formatting with ellipses for large numbers
const formatNumberWithEllipses = (
  value: string | number,
  maxLength: number = 10,
): string => {
  try {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (num === 0) return "0";

    // Handle very small numbers
    if (Math.abs(num) < 0.0001) {
      return num.toExponential(2);
    }

    // Format the number with appropriate precision
    let formatted: string;
    if (Math.abs(num) >= 1000000) {
      formatted = (num / 1000000).toFixed(2) + "M";
    } else if (Math.abs(num) >= 1000) {
      formatted = (num / 1000).toFixed(2) + "K";
    } else {
      formatted = roundSig(num, 4).toString();
    }

    // Add ellipses if too long
    if (formatted.length > maxLength) {
      return formatted.substring(0, maxLength - 1) + "…";
    }

    return formatted;
  } catch {
    return "0";
  }
};

const formatAmount = (amount: string | number) =>
  formatNumberWithEllipses(amount, 8);

const formatPrice = (price: string | number) => {
  try {
    const num = typeof price === "number" ? price : parseFloat(price);
    if (num < 0.001) {
      return num.toExponential(3);
    }
    return formatNumberWithEllipses(roundSig(num, 6), 10);
  } catch {
    return "0";
  }
};

export default function OrderBookPanel({
  selectedFeed,
}: {
  selectedFeed: string | null;
}) {
  const [selectedChain, setSelectedChain] = useState(1);
  const [stepSize, setStepSize] = useState("0.5");
  const [realtimeSpotPrice, setRealtimeSpotPrice] = useState<number | null>(
    null,
  );
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);
  const [hoveredBetween, setHoveredBetween] = useState<{
    upper: number;
    lower: number;
  } | null>(null);

  const { subscribe, unsubscribe, isConnected } = useWebSocketContext();

  const { setOrderDefaults, setPairInfo } = useOrderStore();

  const parsedFeed = parseFeedSymbol(selectedFeed);
  const defaultPair = {
    maker: TOKEN_ADDRESSES["WETH"],
    taker: TOKEN_ADDRESSES["USDT"],
  };

  const [selectedPair, setSelectedPair] = useState<{
    maker: string;
    taker: string;
  }>(defaultPair);

  useEffect(() => {
    if (parsedFeed && parsedFeed.base && parsedFeed.quote) {
      const baseAddress = TOKEN_ADDRESSES[parsedFeed.base];
      const quoteAddress = TOKEN_ADDRESSES[parsedFeed.quote];

      if (baseAddress && quoteAddress) {
        const newPair = {
          maker: baseAddress,
          taker: quoteAddress,
        };

        setSelectedPair(newPair);

        const pairString = `${parsedFeed.base}/${parsedFeed.quote}`;
        setPairInfo(pairString, baseAddress, quoteAddress);
      }
    }
  }, [selectedFeed, setPairInfo]);

  useEffect(() => {
    if (selectedFeed && isConnected) {
      const handleMessage = (message) => {
        if (
          message.type === "price_update" &&
          message.symbol === selectedFeed
        ) {
          const priceData = message.data;
          if (priceData.mid) {
            setRealtimeSpotPrice(priceData.mid);
          }
        }
      };

      subscribe([selectedFeed], handleMessage);
      return () => {
        unsubscribe([selectedFeed], handleMessage);
      };
    }
  }, [selectedFeed, isConnected, subscribe, unsubscribe]);

  const getApiEndpoint = () => {
    if (selectedPair) {
      return `/orderbook/${selectedChain}/${selectedPair.maker}/${selectedPair.taker}?limit=100`;
    }
    return `/orderbook/${selectedChain}?limit=100`;
  };

  const {
    data: orderbookResponse,
    error,
    isValidating,
    mutate,
  } = useSWR(getApiEndpoint(), fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  const handleCreateOrder = (price: number, isBuy: boolean) => {
    const priceSpread = price * 0.005;
    const startPrice = isBuy ? price - priceSpread : price;
    const endPrice = isBuy ? price : price + priceSpread;

    const getDefaultExpiry = () => {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      return date.toISOString().slice(0, 16);
    };

    const makerSymbol = getTokenSymbolFromAddress(selectedPair.maker);
    const takerSymbol = getTokenSymbolFromAddress(selectedPair.taker);
    const pairString = `${makerSymbol}/${takerSymbol}`;

    const orderDefaults = {
      orderType: "Iceberg",
      price: price.toString(),
      startPrice: startPrice.toString(),
      endPrice: endPrice.toString(),
      steps: "5",
      expiry: getDefaultExpiry(),
      isBuy,
      fromCoin: parsedFeed?.base || makerSymbol,
      toCoin: parsedFeed?.quote || takerSymbol,
      timestamp: Date.now(),
      currentPair: pairString,
      makerAsset: selectedPair.maker,
      takerAsset: selectedPair.taker,
    };

    setOrderDefaults(orderDefaults);
  };

  const handleCreateMidPriceOrder = (
    upperPrice: number,
    lowerPrice: number,
  ) => {
    const midPrice = (upperPrice + lowerPrice) / 2;
    const isBuy = upperPrice > lowerPrice; // If upper is higher, we're buying

    // For mid-price orders, use a tighter spread
    const priceSpread = midPrice * 0.002; // 0.2% spread for mid-price orders
    const startPrice = isBuy ? midPrice - priceSpread : midPrice;
    const endPrice = isBuy ? midPrice : midPrice + priceSpread;

    const getDefaultExpiry = () => {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      return date.toISOString().slice(0, 16);
    };

    // Create pair string in MAKER/TAKER format
    const makerSymbol = getTokenSymbolFromAddress(selectedPair.maker);
    const takerSymbol = getTokenSymbolFromAddress(selectedPair.taker);
    const pairString = `${makerSymbol}/${takerSymbol}`;

    const orderDefaults = {
      orderType: "Iceberg",
      price: midPrice.toString(),
      startPrice: startPrice.toString(),
      endPrice: endPrice.toString(),
      steps: "5",
      expiry: getDefaultExpiry(),
      isBuy,
      fromCoin: parsedFeed?.base || makerSymbol,
      toCoin: parsedFeed?.quote || takerSymbol,
      timestamp: Date.now(),
      currentPair: pairString,
      makerAsset: selectedPair.maker,
      takerAsset: selectedPair.taker,
    };

    setOrderDefaults(orderDefaults);
  };
  const renderLevel = (
    level: AggregatedLevel,
    isBid: boolean,
    maxTotal: number,
    index: number,
    levels: AggregatedLevel[],
  ) => {
    // Calculate depth percentage for backdrop visualization
    const depthPercentage = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;
    const isHovered = hoveredPrice === level.price;

    return (
      <div key={level.price} className="relative">
        {/* Between-levels hover zone (only show between different levels) */}
        {index > 0 && (
          <div
            className="relative h-1 group cursor-pointer"
            onMouseEnter={() => {
              const prevLevel = levels[index - 1];
              setHoveredBetween({ upper: prevLevel.price, lower: level.price });
            }}
            onMouseLeave={() => setHoveredBetween(null)}
            onClick={() => {
              const prevLevel = levels[index - 1];
              handleCreateMidPriceOrder(prevLevel.price, level.price);
            }}
          >
            {hoveredBetween?.upper === levels[index - 1]?.price &&
              hoveredBetween?.lower === level.price && (
                <div className="absolute inset-0 bg-yellow-500/20 border-y border-yellow-500/40 flex items-center justify-center">
                  <div className="bg-yellow-500 text-black text-xs px-2 flex items-center gap-1 font-medium">
                    <Plus className="w-3 h-3" />
                    {formatPrice((levels[index - 1].price + level.price) / 2)}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Main level row */}
        <div
          className={cn(
            "grid grid-cols-3 gap-2 px-3 hover:bg-black/30 transition-all duration-300 relative cursor-pointer border-l-4 overflow-hidden group",
            isHovered && "ring-2 ring-yellow-400/50 bg-yellow-900/10",
          )}
          style={{
            borderLeftColor: isBid ? THEME.success + '70' : THEME.error + '70',
          }}
          onMouseEnter={() => setHoveredPrice(level.price)}
          onMouseLeave={() => setHoveredPrice(null)}
          onClick={() => handleCreateOrder(level.price, isBid)}
        >
          {/* Enhanced depth visualization backdrop with proper theme colors */}
          <div
            className="absolute inset-0 transition-all duration-500 ease-out"
            style={{
              width: `${depthPercentage}%`,
              right: 0,
              left: "auto",
              background: `linear-gradient(to left, ${isBid ? THEME.success + '30' : THEME.error + '30'}, transparent)`,
            }}
          />

          {/* Additional depth bar with stronger color */}
          <div
            className="absolute inset-0 transition-all duration-500 ease-out"
            style={{
              width: `${Math.min(depthPercentage * 0.7, 100)}%`,
              right: 0,
              left: "auto",
              backgroundColor: isBid ? THEME.success + '15' : THEME.error + '15',
            }}
          />

          {/* Depth indicator line */}
          <div
            className="absolute top-0 bottom-0 w-[2px] transition-all duration-500 ease-out"
            style={{
              right: `${100 - depthPercentage}%`,
              backgroundColor: isBid ? THEME.success : THEME.error,
              opacity: depthPercentage > 10 ? 0.6 : 0,
            }}
          />

          {/* Hover overlay with + button */}
          {isHovered && (
            <div className="absolute inset-0 bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-end pr-2 z-20">
              <div className="bg-yellow-500 text-black text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                <Plus className="w-3 h-3" />
                {isBid ? "BUY" : "SELL"}
              </div>
            </div>
          )}

          {/* Price column with theme colors */}
          <span
            className="font-mono text-sm tabular-nums text-left relative z-10 font-semibold"
            style={{
              color: isBid ? THEME.success : THEME.error,
            }}
          >
            {level.isRemainder
              ? `${formatPrice(level.price)}+`
              : formatPrice(level.price)}
          </span>

          {/* Amount column with theme colors */}
          <span
            className={cn(
              "font-mono text-sm tabular-nums text-right px-2 py-0.5 relative z-10 font-medium",
              level.count > 1 ? "bg-slate-800/60 rounded-sm" : "",
            )}
            style={{
              color: isBid ? THEME.success : THEME.error,
            }}
          >
            {formatAmount(level.amount)}
          </span>

          {/* Total column with subtle theme tint */}
          <span 
            className="font-mono text-sm tabular-nums text-right relative z-10 font-medium"
            style={{
              color: isBid ? THEME.success + '80' : THEME.error + '80',
            }}
          >
            {formatAmount(level.total)}
          </span>
        </div>
      </div>
    );
  };

  // Loading state
  if (!orderbookResponse && !error) {
    return (
      <PanelWrapper>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-primary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading orderbook...</span>
          </div>
        </CardContent>
      </PanelWrapper>
    );
  }

  // Error state
  if (error) {
    return (
      <PanelWrapper>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-red-300 font-medium">Error: {error.message}</div>
        </CardContent>
      </PanelWrapper>
    );
  }

  // API error state
  if (orderbookResponse && !orderbookResponse.success) {
    return (
      <PanelWrapper>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-red-300 font-medium">
            Error: {orderbookResponse.error}
          </div>
        </CardContent>
      </PanelWrapper>
    );
  }

  const orderbook: OneInchOrderBook = orderbookResponse.data;
  const lastUpdated = new Date(orderbook.timestamp).toLocaleTimeString();
  const spotPrice = realtimeSpotPrice || orderbook.summary.spotPrice || null;

  // Filter invalid orders based on current market price
  const filterInvalidOrders = (
    bids: OrderbookLevel[],
    asks: OrderbookLevel[],
    currentMidPrice: number | null,
  ): { validBids: OrderbookLevel[]; validAsks: OrderbookLevel[] } => {
    if (bids.length === 0 || asks.length === 0 || !currentMidPrice) {
      return { validBids: bids, validAsks: asks };
    }

    // Filter out invalid orders using current market price:
    // - Bids above current mid price (unrealistic)
    // - Asks below current mid price (unrealistic)
    const validBids = bids.filter((bid) => {
      const price =
        typeof bid.price === "number" ? bid.price : parseFloat(bid.price);
      return price <= currentMidPrice; // Bids must be at or below current market price
    });

    const validAsks = asks.filter((ask) => {
      const price =
        typeof ask.price === "number" ? ask.price : parseFloat(ask.price);
      return price >= currentMidPrice; // Asks must be at or above current market price
    });

    return { validBids, validAsks };
  };

  const aggregateOrders = (
    levels: OrderbookLevel[],
    isBid: boolean,
    stepPercent: number,
    referencePrice: number | null = null,
  ): AggregatedLevel[] => {
    if (!levels.length) return [];

    if (!referencePrice) {
      const aggregated = new Map<string, AggregatedLevel>();

      levels.forEach((level) => {
        const priceKey = level.price.toString();
        const price =
          typeof level.price === "number"
            ? level.price
            : parseFloat(level.price);
        const amount =
          typeof level.amount === "number"
            ? level.amount
            : parseFloat(level.amount);
        const count = parseInt(level.count.toString());

        if (!aggregated.has(priceKey)) {
          aggregated.set(priceKey, {
            price,
            amount: 0,
            total: 0,
            count: 0,
          });
        }

        const bucket = aggregated.get(priceKey)!;
        bucket.amount += amount;
        bucket.count += count;
      });

      const sortedLevels = Array.from(aggregated.values()).sort((a, b) =>
        isBid ? b.price - a.price : a.price - b.price,
      );

      let runningTotal = 0;
      sortedLevels.forEach((level) => {
        runningTotal += level.amount;
        level.total = runningTotal;
      });

      if (sortedLevels.length > 14) {
        const topFourteen = sortedLevels.slice(0, 14);
        const remainder = sortedLevels.slice(14);

        if (remainder.length > 0) {
          const remainderLevel: AggregatedLevel = {
            price: remainder[0].price,
            amount: remainder.reduce((sum, level) => sum + level.amount, 0),
            total:
              topFourteen[topFourteen.length - 1].total +
              remainder.reduce((sum, level) => sum + level.amount, 0),
            count: remainder.reduce((sum, level) => sum + level.count, 0),
            isRemainder: true,
          };

          return [...topFourteen, remainderLevel];
        }

        return topFourteen;
      }

      return sortedLevels;
    }

    // Percentage-based bucketing logic (keeping original implementation)
    const stepDecimal = stepPercent / 100;
    const aggregated = new Map<number, AggregatedLevel>();

    levels.forEach((level) => {
      const price =
        typeof level.price === "number" ? level.price : parseFloat(level.price);
      const amount =
        typeof level.amount === "number"
          ? level.amount
          : parseFloat(level.amount);
      const count = parseInt(level.count.toString());

      let bucketPrice: number;
      if (isBid) {
        const stepsDown = Math.floor(
          (referencePrice - price) / (referencePrice * stepDecimal),
        );
        bucketPrice = referencePrice - stepsDown * referencePrice * stepDecimal;
      } else {
        const stepsUp = Math.ceil(
          (price - referencePrice) / (referencePrice * stepDecimal),
        );
        bucketPrice = referencePrice + stepsUp * referencePrice * stepDecimal;
      }

      if (!aggregated.has(bucketPrice)) {
        aggregated.set(bucketPrice, {
          price: bucketPrice,
          amount: 0,
          total: 0,
          count: 0,
        });
      }

      const bucket = aggregated.get(bucketPrice)!;
      bucket.amount += amount;
      bucket.count += count;
    });

    const sortedLevels = Array.from(aggregated.values()).sort((a, b) =>
      isBid ? b.price - a.price : a.price - b.price,
    );

    let runningTotal = 0;
    sortedLevels.forEach((level) => {
      runningTotal += level.amount;
      level.total = runningTotal;
    });

    if (sortedLevels.length > 14) {
      const topFourteen = sortedLevels.slice(0, 14);
      const remainder = sortedLevels.slice(14);

      if (remainder.length > 0) {
        const remainderLevel: AggregatedLevel = {
          price: remainder[0].price,
          amount: remainder.reduce((sum, level) => sum + level.amount, 0),
          total:
            topFourteen[topFourteen.length - 1].total +
            remainder.reduce((sum, level) => sum + level.amount, 0),
          count: remainder.reduce((sum, level) => sum + level.count, 0),
          isRemainder: true,
        };

        return [...topFourteen, remainderLevel];
      }

      return topFourteen;
    }

    return sortedLevels;
  };

  // Filter invalid orders from the orderbook using current market price
  const { validBids, validAsks } = filterInvalidOrders(
    orderbook.bids,
    orderbook.asks,
    spotPrice,
  );
  const aggregatedBids = aggregateOrders(
    validBids,
    true,
    parseFloat(stepSize),
    spotPrice,
  );
  const aggregatedAsks = aggregateOrders(
    validAsks,
    false,
    parseFloat(stepSize),
    spotPrice,
  );

  // Calculate max totals for depth visualization
  const maxBidTotal = Math.max(...aggregatedBids.map((b) => b.total), 0);
  const maxAskTotal = Math.max(...aggregatedAsks.map((a) => a.total), 0);
  const maxTotal = Math.max(maxBidTotal, maxAskTotal);

  return (
    <PanelWrapper>
      {/* Header */}
      <CardHeader className="bg-background backdrop-blur-xl flex-shrink-0 px-4 py-3 h-[60px] flex items-center">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-lg font-bold text-primary">Order Book</h2>
          <Select value={stepSize} onValueChange={setStepSize}>
            <SelectTrigger size="sm" className="w-[70px] bg-card backdrop-blur-sm border-primary/50 text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-300 hover:bg-card/80">
              <SelectValue>
                {STEP_OPTIONS.find((opt) => opt.value === stepSize)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
              {STEP_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-foreground hover:bg-primary/20 focus:bg-primary/30 hover:text-primary focus:text-primary cursor-pointer transition-all duration-200"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        {/* Simple Table Header */}
        <div className="grid grid-cols-3 gap-2 px-3 py-1.5 border-b border-primary/50 bg-card flex-shrink-0">
          <div className="text-xs font-medium text-primary uppercase tracking-wide leading-none">
            Price
          </div>
          <div className="text-xs font-medium text-primary uppercase tracking-wide text-right leading-none">
            {parsedFeed?.quote || "USDT"}
          </div>
          <div className="text-xs font-medium text-primary uppercase tracking-wide text-right leading-none">
            Total
          </div>
        </div>

        {/* Orderbook Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {aggregatedBids.length === 0 && aggregatedAsks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-slate-500 mb-2">No orders available</p>
              <p className="text-xs text-slate-600">
                {selectedFeed
                  ? `No data for ${selectedFeed}`
                  : "Select a feed to view orderbook"}
              </p>
            </div>
          ) : (
            <div>
              {/* Asks (sells) in reverse order with section header */}
              <div className="border-b border-red-500/20 pb-1">
                {aggregatedAsks
                  .slice()
                  .reverse()
                  .map((level, index, array) =>
                    renderLevel(
                      level,
                      false,
                      maxTotal,
                      array.length - 1 - index,
                      [...array].reverse(),
                    ),
                  )}
              </div>

              {/* Spread row - emphasized */}
              {aggregatedAsks.length > 0 &&
                aggregatedBids.length > 0 &&
                (() => {
                  // Get the best ask (lowest ask price) and best bid (highest bid price)
                  const bestAsk = aggregatedAsks[0].price; // First ask (lowest)
                  const bestBid = aggregatedBids[0].price; // First bid (highest)

                  // Calculate spread - should be positive now with filtered data
                  const absoluteSpread = bestAsk - bestBid;
                  const midPrice = (bestAsk + bestBid) / 2;
                  const relativeSpread =
                    midPrice > 0 ? (absoluteSpread / midPrice) * 100 : 0;

                  // Show warning if spread is negative (shouldn't happen with filtered data)
                  if (absoluteSpread < 0) {
                    return (
                      <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-destructive/10 border-y border-destructive/40 relative overflow-hidden">
                        <span className="text-xs text-red-300 font-mono font-semibold relative z-10 leading-none">
                          Spread
                        </span>
                        <span className="text-xs text-red-200 font-mono text-right relative z-10 leading-none">
                          Invalid
                        </span>
                        <span className="text-xs text-red-100 font-mono text-right font-semibold relative z-10 leading-none">
                          {relativeSpread.toFixed(2)}%
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      className="grid grid-cols-3 gap-2 py-2 px-3 bg-primary/10 hover:bg-primary/20 border-y border-primary/50 relative overflow-hidden cursor-pointer transition-all duration-300 group"
                      onClick={() =>
                        handleCreateMidPriceOrder(bestAsk, bestBid)
                      }
                      onMouseEnter={() =>
                        setHoveredBetween({ upper: bestAsk, lower: bestBid })
                      }
                      onMouseLeave={() => setHoveredBetween(null)}
                    >
                      {/* Subtle glow effect */}

                      {/* Hover overlay for spread */}
                      {hoveredBetween?.upper === bestAsk &&
                        hoveredBetween?.lower === bestBid && (
                          <div className="absolute inset-0 bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-end pr-2 z-20">
                            <div className="bg-yellow-500 text-black text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                              <Plus className="w-3 h-3" />
                              MID
                            </div>
                          </div>
                        )}

                      <span className="text-xs font-mono font-semibold relative z-10 leading-none" style={{color: '#F0B90B'}}>
                        Spread
                      </span>
                      <span className="text-xs font-mono text-right relative z-10 leading-none" style={{color: '#F0B90B'}}>
                        {formatPrice(absoluteSpread)}
                      </span>
                      <span className="text-xs font-mono text-right font-semibold relative z-10 leading-none" style={{color: '#F0B90B'}}>
                        {relativeSpread.toFixed(2)}%
                      </span>
                    </div>
                  );
                })()}

              {/* Bids (buys) with section header */}
              <div className="border-t border-green-500/20 pt-1">
                {aggregatedBids.map((level, index) =>
                  renderLevel(level, true, maxTotal, index, aggregatedBids),
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Status Bar */}
        <div className="px-3 py-2 border-t border-primary/50 bg-card flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono">
              Chain {orderbook.chain} • Updated {lastUpdated}
            </span>
            <div className="flex items-center gap-2">
              {isValidating && (
                <RefreshCw className="w-3 h-3 animate-spin text-primary" />
              )}
              <span className="font-mono">10s refresh</span>
            </div>
          </div>
        </div>
      </CardContent>
    </PanelWrapper>
  );
}
