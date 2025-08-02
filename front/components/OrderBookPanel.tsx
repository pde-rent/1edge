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
import { getTokenAddress, getTokenSymbol } from "../config/generated";
import { useAccount } from "wagmi";
import { API_ENDPOINTS } from "../config/api";

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

// Helper to normalize token symbols for display (strip W prefix for wrapped tokens)
const normalizeTokenSymbol = (symbol: string): string => {
  if ((symbol === 'WETH' || symbol === 'WBTC') && symbol.startsWith('W')) {
    return symbol.slice(1);
  }
  return symbol;
};

// Parse feed symbol to extract token pair
const parseFeedSymbol = (
  feedSymbol: string | null,
): { base: string; quote: string } | null => {
  if (!feedSymbol) return null;

  // Handle formats like "agg:spot:ETHUSDT", "spot:ETHUSDT", or just "ETHUSDT"
  const parts = feedSymbol.split(":");
  const pair = parts[parts.length - 1];

  // Extract base and quote from pair (e.g., "ETHUSDT" -> "ETH", "USDT")
  // Common patterns:
  // - ETHUSDT, BTCUSDT, etc.
  // - ETHUSD, BTCUSD, etc.
  const quoteTokens = ["USDT", "USDC", "USD", "DAI", "EUR", "GBP"];
  for (const quote of quoteTokens) {
    if (pair.endsWith(quote)) {
      const base = pair.slice(0, -quote.length);
      return { base, quote };
    }
  }

  // Default: assume last 3-4 chars are quote
  if (pair.length > 6) {
    return { base: pair.slice(0, 3), quote: pair.slice(3) };
  }

  return null;
};

// Function to aggregate levels based on price steps
const aggregateLevels = (
  levels: OrderbookLevel[],
  stepPct: number,
  midPrice: number,
  maxLevels: number = 20,
): AggregatedLevel[] => {
  if (!levels || levels.length === 0) return [];

  const stepSize = (midPrice * stepPct) / 100;
  const aggregated = new Map<number, AggregatedLevel>();

  levels.forEach((level) => {
    const price = parseFloat(level.price);
    const amount = parseFloat(level.volume);
    const bucketPrice = Math.floor(price / stepSize) * stepSize;

    if (aggregated.has(bucketPrice)) {
      const existing = aggregated.get(bucketPrice)!;
      existing.amount += amount;
      existing.count += 1;
    } else {
      aggregated.set(bucketPrice, {
        price: bucketPrice,
        amount: amount,
        total: 0,
        count: 1,
      });
    }
  });

  // Sort and calculate cumulative totals
  const sorted = Array.from(aggregated.values()).sort(
    (a, b) => a.price - b.price,
  );

  let cumulative = 0;
  sorted.forEach((level) => {
    cumulative += level.amount;
    level.total = cumulative;
  });

  // Limit to maxLevels, but include a remainder if there are more
  if (sorted.length > maxLevels) {
    const displayed = sorted.slice(0, maxLevels - 1);
    const remainder = sorted.slice(maxLevels - 1);

    const remainderLevel: AggregatedLevel = {
      price: remainder[0].price,
      amount: remainder.reduce((sum, l) => sum + l.amount, 0),
      total: sorted[sorted.length - 1].total,
      count: remainder.reduce((sum, l) => sum + l.count, 0),
      isRemainder: true,
    };

    return [...displayed, remainderLevel];
  }

  return sorted;
};

const formatAmount = (amount: number | string): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  try {
    return roundSig(num.toString(), 5);
  } catch {
    return "0";
  }
};

export default function OrderBookPanel({
  selectedFeed,
}: {
  selectedFeed: string | null;
}) {
  const { chain } = useAccount();
  const chainId = chain?.id || 1; // Default to Ethereum
  
  const [selectedChain, setSelectedChain] = useState(chainId);
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
    maker: getTokenAddress("WETH", chainId) || "",
    taker: getTokenAddress("USDT", chainId) || getTokenAddress("USDC", chainId) || "",
  };

  const [selectedPair, setSelectedPair] = useState<{
    maker: string;
    taker: string;
  }>(defaultPair);

  useEffect(() => {
    if (parsedFeed && parsedFeed.base && parsedFeed.quote) {
      // Map common token symbols to their proper ERC20 versions
      const baseSymbol = parsedFeed.base === 'ETH' ? 'WETH' : 
                        parsedFeed.base === 'BTC' ? 'WBTC' : 
                        parsedFeed.base;
      const quoteSymbol = parsedFeed.quote === 'USD' ? 'USDT' : parsedFeed.quote;
      
      const baseAddress = getTokenAddress(baseSymbol, chainId);
      const quoteAddress = getTokenAddress(quoteSymbol, chainId);

      if (baseAddress && quoteAddress) {
        const newPair = {
          maker: baseAddress,
          taker: quoteAddress,
        };
        setSelectedPair(newPair);

        const makerSymbol = normalizeTokenSymbol(baseSymbol);
        const takerSymbol = normalizeTokenSymbol(quoteSymbol);

        setPairInfo({
          fromCoin: makerSymbol,
          toCoin: takerSymbol,
          fromAddress: baseAddress,
          toAddress: quoteAddress,
        });
      }
    }
  }, [parsedFeed, chainId, setPairInfo]);

  // Update chain when network changes
  useEffect(() => {
    if (chain?.id) {
      setSelectedChain(chain.id);
    }
  }, [chain]);

  const {
    data: orderbookData,
    error,
    mutate,
  } = useSWR<OneInchOrderBook>(
    selectedPair.maker && selectedPair.taker
      ? API_ENDPOINTS.ORDERBOOK(selectedChain, selectedPair.maker, selectedPair.taker)
      : null,
    fetcher,
    {
      refreshInterval: 10000, // Refresh every 10 seconds
      revalidateOnFocus: false,
    },
  );

  // Subscribe to WebSocket feed for real-time price
  useEffect(() => {
    if (selectedFeed && isConnected) {
      const handlePriceUpdate = (data: any) => {
        if (data.price) {
          setRealtimeSpotPrice(data.price);
        }
      };

      subscribe(selectedFeed, handlePriceUpdate);

      return () => {
        unsubscribe(selectedFeed, handlePriceUpdate);
      };
    }
  }, [selectedFeed, isConnected, subscribe, unsubscribe]);

  const handleRefresh = () => {
    mutate();
  };

  const handleOrderClick = (level: AggregatedLevel, isBuy: boolean) => {
    const makerSymbol = normalizeTokenSymbol(getTokenSymbol(selectedPair.maker, chainId) || "Unknown");
    const takerSymbol = normalizeTokenSymbol(getTokenSymbol(selectedPair.taker, chainId) || "Unknown");

    setOrderDefaults({
      price: level.price.toString(),
      fromCoin: isBuy ? takerSymbol : makerSymbol,
      toCoin: isBuy ? makerSymbol : takerSymbol,
      size: level.amount.toString(),
      isBuy,
    });
  };

  const midPrice = realtimeSpotPrice || 
    (orderbookData?.bids?.[0] && orderbookData?.asks?.[0]
      ? (parseFloat(orderbookData.bids[0].price) + 
         parseFloat(orderbookData.asks[0].price)) / 2
      : null);

  if (error) {
    return (
      <PanelWrapper className="h-full flex items-center justify-center">
        <div className="text-gray-500">Failed to load orderbook</div>
      </PanelWrapper>
    );
  }

  if (!orderbookData && selectedPair.maker && selectedPair.taker) {
    return (
      <PanelWrapper className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </PanelWrapper>
    );
  }

  if (!selectedPair.maker || !selectedPair.taker) {
    return (
      <PanelWrapper className="h-full flex items-center justify-center">
        <div className="text-gray-500">Select a trading pair</div>
      </PanelWrapper>
    );
  }

  const stepPct = parseFloat(stepSize);
  const aggregatedBids = midPrice
    ? aggregateLevels(orderbookData?.bids || [], stepPct, midPrice).reverse()
    : [];
  const aggregatedAsks = midPrice
    ? aggregateLevels(orderbookData?.asks || [], stepPct, midPrice)
    : [];

  const maxAmount = Math.max(
    ...aggregatedBids.map((l) => l.amount),
    ...aggregatedAsks.map((l) => l.amount),
    1,
  );

  return (
    <PanelWrapper className="h-full flex flex-col">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Order Book</h2>
        <div className="flex items-center gap-2">
          <Select value={stepSize} onValueChange={setStepSize}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STEP_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refresh orderbook"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="grid grid-cols-3 text-xs text-gray-600 dark:text-gray-400 px-4 py-2 border-b">
          <div className="text-left">Price</div>
          <div className="text-right">Amount</div>
          <div className="text-right">Total</div>
        </div>

        {/* Asks (Sells) */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col-reverse">
            {aggregatedAsks.map((level, idx) => (
              <div
                key={`ask-${idx}`}
                className="group relative cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                onClick={() => handleOrderClick(level, false)}
                onMouseEnter={() => {
                  setHoveredPrice(level.price);
                  if (idx > 0) {
                    setHoveredBetween({
                      lower: aggregatedAsks[idx - 1].price,
                      upper: level.price,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredPrice(null);
                  setHoveredBetween(null);
                }}
              >
                <div className="grid grid-cols-3 text-xs px-4 py-1.5 relative z-10">
                  <div className="text-left text-red-500 font-medium">
                    {formatAmount(level.price)}
                  </div>
                  <div className="text-right">
                    {formatAmount(level.amount)}
                    {level.isRemainder && (
                      <span className="text-[10px] ml-1 text-gray-500">
                        +{level.count}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-gray-600 dark:text-gray-400">
                    {formatAmount(level.total)}
                  </div>
                </div>
                {/* Depth bar */}
                <div
                  className="absolute inset-0 bg-red-500/10"
                  style={{
                    width: `${(level.amount / maxAmount) * 100}%`,
                    right: 0,
                    left: "auto",
                  }}
                />
                {/* Add order button */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="h-3 w-3 text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mid price */}
        {midPrice && (
          <div className="border-y bg-gray-50 dark:bg-gray-900 px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Mid Price
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                realtimeSpotPrice && orderbookData
                  ? realtimeSpotPrice > midPrice
                    ? "text-green-500"
                    : realtimeSpotPrice < midPrice
                      ? "text-red-500"
                      : ""
                  : "",
              )}
            >
              {formatAmount(midPrice)}
            </span>
          </div>
        )}

        {/* Bids (Buys) */}
        <div className="flex-1 overflow-y-auto">
          {aggregatedBids.map((level, idx) => (
            <div
              key={`bid-${idx}`}
              className="group relative cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
              onClick={() => handleOrderClick(level, true)}
              onMouseEnter={() => {
                setHoveredPrice(level.price);
                if (idx < aggregatedBids.length - 1) {
                  setHoveredBetween({
                    lower: level.price,
                    upper: aggregatedBids[idx + 1].price,
                  });
                }
              }}
              onMouseLeave={() => {
                setHoveredPrice(null);
                setHoveredBetween(null);
              }}
            >
              <div className="grid grid-cols-3 text-xs px-4 py-1.5 relative z-10">
                <div className="text-left text-green-500 font-medium">
                  {formatAmount(level.price)}
                </div>
                <div className="text-right">
                  {formatAmount(level.amount)}
                  {level.isRemainder && (
                    <span className="text-[10px] ml-1 text-gray-500">
                      +{level.count}
                    </span>
                  )}
                </div>
                <div className="text-right text-gray-600 dark:text-gray-400">
                  {formatAmount(level.total)}
                </div>
              </div>
              {/* Depth bar */}
              <div
                className="absolute inset-0 bg-green-500/10"
                style={{
                  width: `${(level.amount / maxAmount) * 100}%`,
                }}
              />
              {/* Add order button */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="h-3 w-3 text-gray-600" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PanelWrapper>
  );
}