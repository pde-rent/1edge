// @ts-nocheck
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher } from '../utils/fetcher';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { roundSig } from '@common/utils';
import type { ReconstructedOrderbook, OrderbookLevel } from '@common/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PanelWrapper } from './common/Panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';

// Step size options for order aggregation
const STEP_OPTIONS = [
  { value: '0.01', label: '0.01%' },
  { value: '0.25', label: '0.25%' },
  { value: '0.5', label: '0.5%' },
  { value: '1.0', label: '1%' }
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

const formatAmount = (amount: string | number) => formatNumberWithEllipses(amount, 8);

const formatPrice = (price: string | number) => {
  try {
    const num = typeof price === 'number' ? price : parseFloat(price);
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
  const [stepSize, setStepSize] = useState('0.5');
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
    // Calculate depth percentage for backdrop visualization
    const depthPercentage = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0;

    return (
      <div
        key={level.price}
        className={cn(
          "grid grid-cols-3 gap-2 py-1 px-3 hover:bg-black/30 transition-all duration-300 relative cursor-pointer border-l-2 overflow-hidden",
          isBid
            ? "border-l-emerald-500/70 hover:border-l-emerald-400 hover:bg-emerald-900/20"
            : "border-l-red-500/70 hover:border-l-red-400 hover:bg-red-900/20"
        )}
      >
        {/* Enhanced depth visualization backdrop with gradient fading */}
        <div
          className={cn(
            "absolute inset-0 transition-all duration-300",
            isBid 
              ? "bg-gradient-to-l from-emerald-500/20 via-emerald-500/15 to-emerald-500/5" 
              : "bg-gradient-to-l from-red-500/20 via-red-500/15 to-red-500/5"
          )}
          style={{
            width: `${depthPercentage}%`,
            right: 0,
            left: 'auto'
          }}
        />
        
        {/* Additional subtle background layer for depth emphasis */}
        <div
          className={cn(
            "absolute inset-0 opacity-60 transition-all duration-300",
            isBid ? "bg-emerald-500/8" : "bg-red-500/8"
          )}
          style={{
            width: `${Math.min(depthPercentage * 1.3, 100)}%`,
            right: 0,
            left: 'auto',
            background: isBid 
              ? `linear-gradient(to left, rgba(16, 185, 129, ${0.12 * (depthPercentage / 100)}), rgba(16, 185, 129, 0.01))`
              : `linear-gradient(to left, rgba(239, 68, 68, ${0.12 * (depthPercentage / 100)}), rgba(239, 68, 68, 0.01))`
          }}
        />

        {/* Price column */}
        <span className={cn(
          "font-mono text-sm tabular-nums text-left relative z-10",
          isBid ? "text-emerald-200" : "text-red-200"
        )}>
          {level.isRemainder ? `${formatPrice(level.price)}+` : formatPrice(level.price)}
        </span>

        {/* Amount column with darker background to indicate order count */}
        <span className={cn(
          "font-mono text-sm tabular-nums text-right px-2 py-0.5 relative z-10",
          level.count > 1 ? "bg-slate-800/60 rounded-sm" : "",
          isBid ? "text-slate-200" : "text-slate-200"
        )}>
          {formatAmount(level.amount)}
        </span>

        {/* Total column */}
        <span className="font-mono text-sm text-slate-300 tabular-nums text-right relative z-10">
          {formatAmount(level.total)}
        </span>
      </div>
    );
  };

  // Loading state
  if (!orderbookResponse && !error) {
    return (
      <PanelWrapper>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-teal-400">
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
              <div className="text-red-300 font-medium">Error: {orderbookResponse.error}</div>
            </CardContent>
      </PanelWrapper>
    );
  }

  const orderbook: ReconstructedOrderbook = orderbookResponse.data;
  const lastUpdated = new Date(orderbook.timestamp).toLocaleTimeString();
  const spotPrice = realtimeSpotPrice || orderbook.summary.spotPrice || null;

  // Filter invalid orders based on current market price
  const filterInvalidOrders = (
    bids: OrderbookLevel[],
    asks: OrderbookLevel[],
    currentMidPrice: number | null
  ): { validBids: OrderbookLevel[]; validAsks: OrderbookLevel[] } => {
    if (bids.length === 0 || asks.length === 0 || !currentMidPrice) {
      return { validBids: bids, validAsks: asks };
    }

    // Filter out invalid orders using current market price:
    // - Bids above current mid price (unrealistic)
    // - Asks below current mid price (unrealistic)
    const validBids = bids.filter(bid => {
      const price = typeof bid.price === 'number' ? bid.price : parseFloat(bid.price);
      return price <= currentMidPrice; // Bids must be at or below current market price
    });

    const validAsks = asks.filter(ask => {
      const price = typeof ask.price === 'number' ? ask.price : parseFloat(ask.price);
      return price >= currentMidPrice; // Asks must be at or above current market price
    });

    return { validBids, validAsks };
  };

  const aggregateOrders = (levels: OrderbookLevel[], isBid: boolean, stepPercent: number, referencePrice: number | null = null): AggregatedLevel[] => {
    if (!levels.length) return [];

    if (!referencePrice) {
      const aggregated = new Map<string, AggregatedLevel>();

      levels.forEach(level => {
        const priceKey = level.price.toString();
        const price = typeof level.price === 'number' ? level.price : parseFloat(level.price);
        const amount = typeof level.amount === 'number' ? level.amount : parseFloat(level.amount);
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
      const price = typeof level.price === 'number' ? level.price : parseFloat(level.price);
      const amount = typeof level.amount === 'number' ? level.amount : parseFloat(level.amount);
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

  // Filter invalid orders from the orderbook using current market price
  const { validBids, validAsks } = filterInvalidOrders(orderbook.bids, orderbook.asks, spotPrice);
  const aggregatedBids = aggregateOrders(validBids, true, parseFloat(stepSize), spotPrice);
  const aggregatedAsks = aggregateOrders(validAsks, false, parseFloat(stepSize), spotPrice);

  // Calculate max totals for depth visualization
  const maxBidTotal = Math.max(...aggregatedBids.map(b => b.total), 0);
  const maxAskTotal = Math.max(...aggregatedAsks.map(a => a.total), 0);
  const maxTotal = Math.max(maxBidTotal, maxAskTotal);

  return (
    <PanelWrapper>
      {/* Header */}
      <CardHeader className="border-b border-teal-500/20 bg-gradient-to-r from-black/95 via-slate-950/90 to-black/95 backdrop-blur-xl flex-shrink-0 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-teal-600">Order Book</h2>
          <Select value={stepSize} onValueChange={setStepSize}>
            <SelectTrigger className="w-[80px] bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400/50 transition-all duration-300 hover:bg-black/80">
              <SelectValue>
                {STEP_OPTIONS.find(opt => opt.value === stepSize)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
              {STEP_OPTIONS.map((option) => (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                  className="text-white hover:bg-teal-900/30 focus:bg-teal-900/40 hover:text-teal-100 focus:text-teal-100 cursor-pointer transition-all duration-200"
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
        <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-teal-500/20 bg-black/40 flex-shrink-0">
          <div className="text-xs font-medium text-teal-200 uppercase tracking-wide">Price</div>
          <div className="text-xs font-medium text-teal-200 uppercase tracking-wide text-right">Size ({parsedFeed?.quote || 'USDT'})</div>
          <div className="text-xs font-medium text-teal-200 uppercase tracking-wide text-right">Total</div>
        </div>

            {/* Orderbook Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
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
                  <div>
                    {aggregatedAsks.slice().reverse().map(level => renderLevel(level, false, maxTotal))}
                  </div>

                  {/* Spread row - emphasized */}
                  {aggregatedAsks.length > 0 && aggregatedBids.length > 0 && (
                    (() => {
                      // Get the best ask (lowest ask price) and best bid (highest bid price)
                      const bestAsk = aggregatedAsks[0].price;  // First ask (lowest)
                      const bestBid = aggregatedBids[0].price;  // First bid (highest)

                      // Calculate spread - should be positive now with filtered data
                      const absoluteSpread = bestAsk - bestBid;
                      const midPrice = (bestAsk + bestBid) / 2;
                      const relativeSpread = midPrice > 0 ? (absoluteSpread / midPrice) * 100 : 0;

                      // Show warning if spread is negative (shouldn't happen with filtered data)
                      if (absoluteSpread < 0) {
                        return (
                          <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-gradient-to-r from-red-900/80 via-red-800/60 to-red-900/80 border-y border-red-500/40 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-orange-500/10 to-red-500/5"></div>
                            <span className="text-sm text-red-300 font-mono font-semibold relative z-10">Spread</span>
                            <span className="text-sm text-red-200 font-mono text-right relative z-10">Invalid</span>
                            <span className="text-sm text-red-100 font-mono text-right font-semibold relative z-10">
                              {relativeSpread.toFixed(2)}%
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-gradient-to-r from-slate-900/80 via-slate-800/60 to-slate-900/80 border-y border-teal-500/40 relative overflow-hidden">
                          {/* Subtle glow effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-yellow-500/10 to-teal-500/5"></div>

                          <span className="text-sm text-yellow-300 font-mono font-semibold relative z-10">Spread</span>
                          <span className="text-sm text-yellow-200 font-mono text-right relative z-10">
                            {formatPrice(absoluteSpread)}
                          </span>
                          <span className="text-sm text-yellow-100 font-mono text-right font-semibold relative z-10">
                            {relativeSpread.toFixed(2)}%
                          </span>
                        </div>
                      );
                    })()
                  )}

                  {/* Bids (buys) */}
                  <div>
                    {aggregatedBids.map(level => renderLevel(level, true, maxTotal))}
                  </div>
                </div>
              )}
            </div>

        {/* Footer Status Bar */}
        <div className="px-3 py-2 border-t border-teal-500/20 bg-black/40 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono">
              Chain {orderbook.chain} • Updated {lastUpdated}
            </span>
            <div className="flex items-center gap-2">
              {isValidating && <RefreshCw className="w-3 h-3 animate-spin text-teal-400" />}
              <span className="font-mono">
                60s refresh • Step: {stepSize}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </PanelWrapper>
  );
}
