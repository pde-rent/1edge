// @ts-nocheck
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher } from '../utils/fetcher';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { roundSig } from '@common/utils';
import type { ReconstructedOrderbook, OrderbookLevel } from '@common/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Loader2, RefreshCw } from 'lucide-react';

// Step size options for order aggregation
const STEP_OPTIONS = [
  { value: 0.01, label: '0.01%' },
  { value: 0.25, label: '0.25%' },
  { value: 0.5, label: '0.5%' },
  { value: 1.0, label: '1%' }
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
  'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'ETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  'BTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'USD': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  '1INCH': '0x111111111117dC0aa78b770fA6A738034120C302',
  'AAVE': '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
};

// Parse feed symbol to extract token pair
const parseFeedSymbol = (feedSymbol: string | null): { base: string; quote: string } | null => {
  if (!feedSymbol) return null;

  const parts = feedSymbol.split(':');
  let pairSymbol = parts[parts.length - 1];

  const quoteAssets = ['USDT', 'USDC', 'USD', 'WETH', 'ETH', 'WBTC', 'BTC'];

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
const formatNumberWithEllipses = (value: string | number, maxLength: number = 10): string => {
  try {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num === 0) return '0';
    
    // Handle very small numbers
    if (Math.abs(num) < 0.0001) {
      return num.toExponential(2);
    }
    
    // Format the number with appropriate precision
    let formatted: string;
    if (Math.abs(num) >= 1000000) {
      formatted = (num / 1000000).toFixed(2) + 'M';
    } else if (Math.abs(num) >= 1000) {
      formatted = (num / 1000).toFixed(2) + 'K';
    } else {
      formatted = roundSig(num, 4).toString();
    }
    
    // Add ellipses if too long
    if (formatted.length > maxLength) {
      return formatted.substring(0, maxLength - 1) + '…';
    }
    
    return formatted;
  } catch {
    return '0';
  }
};

const formatAmount = (amount: string) => formatNumberWithEllipses(amount, 8);

const formatPrice = (price: string) => {
  try {
    const num = parseFloat(price);
    if (num < 0.001) {
      return num.toExponential(3);
    }
    return formatNumberWithEllipses(roundSig(num, 6), 10);
  } catch {
    return '0';
  }
};

export default function OrderBookPanel({ selectedFeed }: { selectedFeed: string | null }) {
  const [selectedChain, setSelectedChain] = useState(1);
  const [stepSize, setStepSize] = useState(0.5);
  const [realtimeSpotPrice, setRealtimeSpotPrice] = useState<number | null>(null);

  const { subscribe, unsubscribe, isConnected } = useWebSocketContext();

  const parsedFeed = parseFeedSymbol(selectedFeed);
  const defaultPair = {
    maker: TOKEN_ADDRESSES['WETH'],
    taker: TOKEN_ADDRESSES['USDT']
  };

  const [selectedPair, setSelectedPair] = useState<{ maker: string; taker: string }>(defaultPair);

  useEffect(() => {
    if (parsedFeed && parsedFeed.base && parsedFeed.quote) {
      const baseAddress = TOKEN_ADDRESSES[parsedFeed.base];
      const quoteAddress = TOKEN_ADDRESSES[parsedFeed.quote];

      if (baseAddress && quoteAddress) {
        setSelectedPair({
          maker: baseAddress,
          taker: quoteAddress
        });
      }
    }
  }, [selectedFeed]);

  useEffect(() => {
    if (selectedFeed && isConnected) {
      const handleMessage = (message) => {
        if (message.type === 'price_update' && message.symbol === selectedFeed) {
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

  const { data: orderbookResponse, error, isValidating, mutate } = useSWR(
    getApiEndpoint(),
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
      revalidateOnReconnect: true
    }
  );

  const renderLevel = (level: AggregatedLevel, isBid: boolean, maxTotal: number) => {
    const depthPercentage = (level.total / maxTotal) * 100;
    const opacity = 0.05 + (depthPercentage / 100) * 0.15; // Enhanced opacity range

    return (
      <div
        key={level.price}
        className={cn(
          "grid grid-cols-4 gap-2 py-2.5 px-4 hover:bg-black/40 transition-all duration-300 border-l-2 relative group cursor-pointer backdrop-blur-sm",
          isBid
            ? "border-l-emerald-500/80 hover:border-l-emerald-400"
            : "border-l-red-500/80 hover:border-l-red-400"
        )}
        style={{
          backgroundColor: isBid
            ? `rgba(16, 185, 129, ${opacity})`
            : `rgba(239, 68, 68, ${opacity})`
        }}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>

        {/* Price column with enhanced styling */}
        <div className="flex items-center gap-2 relative z-10">
          {isBid ? (
            <TrendingUp className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-400 flex-shrink-0" />
          )}
          <span className={cn(
            "font-mono text-sm font-semibold tabular-nums",
            isBid ? "text-emerald-200" : "text-red-200"
          )}>
            {level.isRemainder ? `${formatPrice(level.price.toString())}+` : formatPrice(level.price.toString())}
          </span>
        </div>

        {/* Amount column */}
        <span className="font-mono text-sm text-teal-100 tabular-nums relative z-10 font-medium">
          {formatAmount(level.amount.toString())}
        </span>

        {/* Total column with enhanced styling */}
        <div className="flex items-center relative z-10">
          <span className="font-mono text-sm text-slate-200 tabular-nums font-medium">
            {formatAmount(level.total.toString())}
          </span>
        </div>

        {/* Orders count with enhanced styling */}
        <div className="flex justify-end relative z-10">
          <span className={cn(
            "text-xs px-2 py-1 rounded-md font-mono tabular-nums min-w-[32px] text-center font-medium backdrop-blur-sm",
            isBid
              ? "bg-emerald-900/50 text-emerald-200 border border-emerald-700/40"
              : "bg-red-900/50 text-red-200 border border-red-700/40"
          )}>
            {level.count > 999 ? formatNumberWithEllipses(level.count, 4) : level.count}
          </span>
        </div>
      </div>
    );
  };

  // Loading state with themed styling
  if (!orderbookResponse && !error) {
    return (
      <div className="p-1 rounded-2xl bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-cyan-500/20 shadow-2xl border border-teal-500 h-full">
        <div className="p-1 rounded-2xl bg-slate-800/30 backdrop-blur-sm h-full">
          <Card className="h-full bg-black/80 backdrop-blur-xl border-slate-700/50 overflow-hidden flex flex-col p-0 gap-0 rounded-2xl shadow-2xl">
            <CardHeader className="pb-3">
              <h2 className="text-lg font-bold text-teal-600">Order Book</h2>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-teal-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading orderbook...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state with themed styling
  if (error) {
    return (
      <div className="p-1 rounded-2xl bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-cyan-500/20 shadow-2xl border border-teal-500 h-full">
        <div className="p-1 rounded-2xl bg-slate-800/30 backdrop-blur-sm h-full">
          <Card className="h-full bg-black/80 backdrop-blur-xl border-slate-700/50 overflow-hidden flex flex-col p-0 gap-0 rounded-2xl shadow-2xl">
            <CardHeader className="pb-3">
              <h2 className="text-lg font-bold text-teal-600">Order Book</h2>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded bg-red-950/20 border border-red-800/30">
                <div className="text-red-300 font-medium mb-2">Error loading orderbook: {error.message}</div>
                <div className="text-slate-400 text-sm">
                  Make sure the API server is running and the 1inch API key is configured.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // API error state
  if (orderbookResponse && !orderbookResponse.success) {
    return (
      <div className="p-1 rounded-2xl bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-cyan-500/20 shadow-2xl border border-teal-500 h-full">
        <div className="p-1 rounded-2xl bg-slate-800/30 backdrop-blur-sm h-full">
          <Card className="h-full bg-black/80 backdrop-blur-xl border-slate-700/50 overflow-hidden flex flex-col p-0 gap-0 rounded-2xl shadow-2xl">
            <CardHeader className="pb-3">
              <h2 className="text-lg font-bold text-teal-600">Order Book</h2>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded bg-red-950/20 border border-red-800/30">
                <div className="text-red-300 font-medium">Error: {orderbookResponse.error}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const orderbook: ReconstructedOrderbook = orderbookResponse.data;
  const lastUpdated = new Date(orderbook.timestamp).toLocaleTimeString();
  const spotPrice = realtimeSpotPrice || orderbook.summary.spotPrice || null;

  // Filter invalid orders and aggregate functions (keeping original logic)
  const filterInvalidOrders = (levels: OrderbookLevel[], isBid: boolean, spotPrice: number | null) => {
    if (!spotPrice) return levels;

    return levels.filter(level => {
      const price = parseFloat(level.price);
      if (isBid) {
        return price < spotPrice;
      } else {
        return price > spotPrice;
      }
    });
  };

  const aggregateOrders = (levels: OrderbookLevel[], isBid: boolean, stepPercent: number, referencePrice: number | null = null): AggregatedLevel[] => {
    if (!levels.length) return [];

    if (!referencePrice) {
      const aggregated = new Map<string, AggregatedLevel>();

      levels.forEach(level => {
        const priceKey = level.price;
        const price = parseFloat(level.price);
        const amount = parseFloat(level.amount);
        const count = parseInt(level.count.toString());

        if (!aggregated.has(priceKey)) {
          aggregated.set(priceKey, {
            price,
            amount: 0,
            total: 0,
            count: 0
          });
        }

        const bucket = aggregated.get(priceKey)!;
        bucket.amount += amount;
        bucket.count += count;
      });

      const sortedLevels = Array.from(aggregated.values()).sort((a, b) =>
        isBid ? b.price - a.price : a.price - b.price
      );

      let runningTotal = 0;
      sortedLevels.forEach(level => {
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
            total: topFourteen[topFourteen.length - 1].total + remainder.reduce((sum, level) => sum + level.amount, 0),
            count: remainder.reduce((sum, level) => sum + level.count, 0),
            isRemainder: true
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

    levels.forEach(level => {
      const price = parseFloat(level.price);
      const amount = parseFloat(level.amount);
      const count = parseInt(level.count.toString());

      let bucketPrice: number;
      if (isBid) {
        const stepsDown = Math.floor((referencePrice - price) / (referencePrice * stepDecimal));
        bucketPrice = referencePrice - (stepsDown * referencePrice * stepDecimal);
      } else {
        const stepsUp = Math.ceil((price - referencePrice) / (referencePrice * stepDecimal));
        bucketPrice = referencePrice + (stepsUp * referencePrice * stepDecimal);
      }

      if (!aggregated.has(bucketPrice)) {
        aggregated.set(bucketPrice, {
          price: bucketPrice,
          amount: 0,
          total: 0,
          count: 0
        });
      }

      const bucket = aggregated.get(bucketPrice)!;
      bucket.amount += amount;
      bucket.count += count;
    });

    const sortedLevels = Array.from(aggregated.values()).sort((a, b) =>
      isBid ? b.price - a.price : a.price - b.price
    );

    let runningTotal = 0;
    sortedLevels.forEach(level => {
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
          total: topFourteen[topFourteen.length - 1].total + remainder.reduce((sum, level) => sum + level.amount, 0),
          count: remainder.reduce((sum, level) => sum + level.count, 0),
          isRemainder: true
        };

        return [...topFourteen, remainderLevel];
      }

      return topFourteen;
    }

    return sortedLevels;
  };

  const validBids = filterInvalidOrders(orderbook.bids, true, spotPrice);
  const validAsks = filterInvalidOrders(orderbook.asks, false, spotPrice);
  const aggregatedBids = aggregateOrders(validBids, true, stepSize, spotPrice);
  const aggregatedAsks = aggregateOrders(validAsks, false, stepSize, spotPrice);

  // Calculate max totals for depth visualization
  const maxBidTotal = Math.max(...aggregatedBids.map(b => b.total), 0);
  const maxAskTotal = Math.max(...aggregatedAsks.map(a => a.total), 0);
  const maxTotal = Math.max(maxBidTotal, maxAskTotal);

  return (
    <div className="p-1 rounded-2xl bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-cyan-500/20 shadow-2xl border border-teal-500 h-full">
      <div className="p-1 rounded-2xl bg-slate-800/30 backdrop-blur-sm h-full">
        <Card className="h-full bg-black/80 backdrop-blur-xl border-slate-700/50 overflow-hidden flex flex-col p-0 gap-0 rounded-2xl shadow-2xl">
          {/* Header */}
          <CardHeader className="border-b border-teal-500/20 bg-gradient-to-r from-black/95 via-slate-950/90 to-black/95 backdrop-blur-xl flex-shrink-0 px-4 py-4">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent"></div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-teal-600">Order Book</h2>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-black/60 backdrop-blur-sm border border-slate-700/50 shadow-inner">
                {STEP_OPTIONS.map(option => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-xs px-2 py-1 h-6 rounded-md font-medium transition-all duration-300",
                      stepSize === option.value
                        ? "bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 hover:from-teal-500 hover:via-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-teal-500/25 border border-teal-300/30"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/60 backdrop-blur-sm"
                    )}
                    onClick={() => setStepSize(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col bg-gradient-to-b from-black/95 via-slate-950/90 to-black/95 backdrop-blur-xl">
            {/* Summary Header - Compact */}
            <div className="px-4 py-3 border-b border-teal-500/20 bg-black/40 backdrop-blur-sm flex-shrink-0 relative">
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent"></div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-mono flex items-center gap-2">
                  Chain {orderbook.chain} • {lastUpdated}
                  <div className="w-1 h-1 rounded-full bg-teal-400"></div>
                </span>
                {isValidating && <RefreshCw className="w-3 h-3 animate-spin text-teal-400" />}
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Bids:</span>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs px-1.5 py-0 h-5 backdrop-blur-sm">
                    {formatNumberWithEllipses(orderbook.summary.totalBidOrders, 5)}
                  </Badge>
                  <span className="text-slate-500 ml-2">Max Depth:</span>
                  <span className="font-mono text-emerald-300 text-xs">{formatAmount(maxBidTotal.toString())}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Asks:</span>
                  <Badge className="bg-red-500/20 text-red-300 border-red-400/30 text-xs px-1.5 py-0 h-5 backdrop-blur-sm">
                    {formatNumberWithEllipses(orderbook.summary.totalAskOrders, 5)}
                  </Badge>
                  <span className="text-slate-500 ml-2">Max Depth:</span>
                  <span className="font-mono text-red-300 text-xs">{formatAmount(maxAskTotal.toString())}</span>
                </div>
                {orderbook.summary.spread && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Spread:</span>
                    <span className="font-mono text-teal-300 font-medium">
                      {orderbook.summary.spread}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Table Header - Compact */}
            <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-teal-500/20 bg-black/40 backdrop-blur-sm flex-shrink-0 relative">
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent"></div>
              <div className="text-xs font-medium text-teal-200 uppercase tracking-wide flex items-center gap-2">
                Price • Depth
                <div className="w-1 h-1 rounded-full bg-emerald-400"></div>
              </div>
              <div className="text-xs font-medium text-teal-200 uppercase tracking-wide">Amount</div>
              <div className="text-xs font-medium text-teal-200 uppercase tracking-wide">Total</div>
              <div className="text-xs font-medium text-teal-200 uppercase tracking-wide text-right">Orders</div>
            </div>

            {/* Orderbook Content - Scrollable */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-black/95 via-slate-950/90 to-black/95 backdrop-blur-xl">
              {aggregatedBids.length === 0 && aggregatedAsks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-slate-500 mb-2">No orders available</p>
                  <p className="text-xs text-slate-600">
                    {selectedFeed ? `No data for ${selectedFeed}` : 'Select a feed to view orderbook'}
                  </p>
                </div>
              ) : (
                <div>
                  {/* Asks (sells) in reverse order */}
                  <div className="border-b border-teal-500/20">
                    {aggregatedAsks.slice().reverse().map(level => renderLevel(level, false, maxTotal))}
                  </div>

                  {/* Spot price and spread indicator - Compact */}
                  {spotPrice && (
                    <div className="px-4 py-3 bg-gradient-to-r from-black/60 via-slate-900/60 to-black/60 backdrop-blur-sm border-b border-teal-500/20 flex-shrink-0 relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-emerald-500/5 to-cyan-500/5"></div>
                      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent"></div>
                      <div className="flex items-center justify-center gap-6 text-sm relative z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">Spot:</span>
                          <span className="font-mono font-semibold text-yellow-300">
                            {formatPrice(spotPrice.toString())}
                          </span>
                        </div>
                        {orderbook.summary.bestBid && orderbook.summary.bestAsk && orderbook.summary.spread && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">Spread:</span>
                            <span className="font-mono text-teal-300 font-medium">
                              {orderbook.summary.spread}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bids (buys) */}
                  <div>
                    {aggregatedBids.map(level => renderLevel(level, true, maxTotal))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer - Compact */}
            <div className="px-4 py-3 border-t border-teal-500/20 bg-gradient-to-r from-black/95 via-slate-950/90 to-black/95 backdrop-blur-md flex-shrink-0 relative">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent"></div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono flex items-center gap-2">
                  Top 15 levels per side • Depth visualization
                  <div className="w-1 h-1 rounded-full bg-emerald-400"></div>
                </span>
                <span className="font-mono">
                  60s refresh • RT filter: {realtimeSpotPrice ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}