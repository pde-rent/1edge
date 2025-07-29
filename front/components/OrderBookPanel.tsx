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

  const formatAmount = (amount: string) => {
    try {
      const num = parseFloat(amount);
      if (num === 0) return '0';
      if (num < 0.0001) {
        return num.toExponential(2);
      }
      return roundSig(num, 4);
    } catch {
      return '0';
    }
  };

  const formatPrice = (price: string) => {
    try {
      const num = parseFloat(price);
      if (num < 0.001) {
        return num.toExponential(3);
      }
      return roundSig(num, 6);
    } catch {
      return '0';
    }
  };

  const renderLevel = (level: AggregatedLevel, isBid: boolean) => (
    <div 
      key={level.price}
      className={cn(
        "grid grid-cols-4 gap-2 py-1.5 px-3 hover:bg-gray-800/40 transition-colors duration-150 border-l-2 relative group",
        isBid 
          ? "border-l-green-500/60 hover:border-l-green-400" 
          : "border-l-red-500/60 hover:border-l-red-400"
      )}
    >
      {/* Price background fill */}
      <div 
        className={cn(
          "absolute inset-y-0 right-0 opacity-10 transition-opacity group-hover:opacity-20",
          isBid ? "bg-green-500" : "bg-red-500"
        )}
        style={{ width: `${Math.min(level.total / Math.max(...(isBid ? [level.total] : [level.total])) * 100, 100)}%` }}
      />
      
      <div className="flex items-center gap-1.5 relative z-10">
        {isBid ? (
          <TrendingUp className="w-3 h-3 text-green-400 flex-shrink-0" />
        ) : (
          <TrendingDown className="w-3 h-3 text-red-400 flex-shrink-0" />
        )}
        <span className={cn(
          "font-mono text-sm font-medium tabular-nums",
          isBid ? "text-green-300" : "text-red-300"
        )}>
          {level.isRemainder ? `${formatPrice(level.price.toString())}+` : formatPrice(level.price.toString())}
        </span>
      </div>
      
      <span className="font-mono text-sm text-gray-300 tabular-nums relative z-10">
        {formatAmount(level.amount.toString())}
      </span>
      
      <span className="font-mono text-sm text-gray-400 tabular-nums relative z-10">
        {formatAmount(level.total.toString())}
      </span>
      
      <div className="flex justify-end relative z-10">
        <span className={cn(
          "text-xs px-1.5 py-0.5 rounded font-mono tabular-nums min-w-[28px] text-center",
          "bg-gray-700/60 text-gray-300 border border-gray-600/50"
        )}>
          {level.count}
        </span>
      </div>
    </div>
  );

  // Loading state
  if (!orderbookResponse && !error) {
    return (
      <Card className="h-full bg-gray-950 border-gray-800">
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold text-gray-100">Order Book</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading orderbook...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="h-full bg-gray-950 border-gray-800">
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold text-gray-100">Order Book</h2>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded bg-red-950/20 border border-red-800/30">
            <div className="text-red-300 font-medium mb-2">Error loading orderbook: {error.message}</div>
            <div className="text-gray-400 text-sm">
              Make sure the API server is running and the 1inch API key is configured.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // API error state
  if (orderbookResponse && !orderbookResponse.success) {
    return (
      <Card className="h-full bg-gray-950 border-gray-800">
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold text-gray-100">Order Book</h2>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded bg-red-950/20 border border-red-800/30">
            <div className="text-red-300 font-medium">Error: {orderbookResponse.error}</div>
          </div>
        </CardContent>
      </Card>
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

  return (
    <Card className="h-full bg-gray-950 border-gray-800 overflow-hidden flex flex-col p-0 gap-0">
      {/* Header */}
      <CardHeader className="border-b border-gray-800 bg-gray-900/50 flex-shrink-0">
        <div className="flex items-center justify-between mt-5 pb-0">
          <h2 className="text-lg font-semibold text-gray-100">Order Book</h2>
          <div className="flex items-center gap-1 p-1 rounded bg-gray-800/60 border border-gray-700/50">
            {STEP_OPTIONS.map(option => (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                className={cn(
                  "text-xs px-2 py-1 h-6 rounded font-medium transition-colors",
                  stepSize === option.value 
                    ? "bg-green-600 hover:bg-green-500 text-white" 
                    : "text-gray-300 hover:text-gray-100 hover:bg-gray-700"
                )}
                onClick={() => setStepSize(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        {/* Summary Header - Compact */}
        <div className="px-3 py-2 border-b border-gray-800 bg-gray-900/30 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span className="font-mono">Chain {orderbook.chain} • {lastUpdated}</span>
            {isValidating && <RefreshCw className="w-3 h-3 animate-spin text-green-400" />}
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Bids:</span>
              <Badge className="bg-green-500/20 text-green-300 border-green-400/30 text-xs px-1.5 py-0 h-5">
                {orderbook.summary.totalBidOrders}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Asks:</span>
              <Badge className="bg-red-500/20 text-red-300 border-red-400/30 text-xs px-1.5 py-0 h-5">
                {orderbook.summary.totalAskOrders}
              </Badge>
            </div>
            {orderbook.summary.spread && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Spread:</span>
                <span className="font-mono text-gray-300 font-medium">
                  {orderbook.summary.spread}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Table Header - Compact */}
        <div className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900/40 flex-shrink-0">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Price</div>
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Amount</div>
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total</div>
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Orders</div>
        </div>

        {/* Orderbook Content - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-gray-950">
          {aggregatedBids.length === 0 && aggregatedAsks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-gray-400 font-medium mb-2">No active orders found</div>
              <div className="text-sm text-gray-500">
                Try a different chain or check if there are active orders on 1inch
              </div>
            </div>
          ) : (
            <div>
              {/* Asks (sells) in reverse order */}
              <div className="border-b border-gray-800/50">
                {aggregatedAsks.slice().reverse().map(level => renderLevel(level, false))}
              </div>
              
              {/* Spot price and spread indicator - Compact */}
              {spotPrice && (
                <div className="px-3 py-2 bg-gray-900/60 border-b border-gray-800/50 flex-shrink-0">
                  <div className="flex items-center justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-medium">Spot:</span>
                      <span className="font-mono font-semibold text-yellow-300">
                        {formatPrice(spotPrice.toString())}
                      </span>
                    </div>
                    {orderbook.summary.bestBid && orderbook.summary.bestAsk && orderbook.summary.spread && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-medium">Spread:</span>
                        <span className="font-mono text-gray-300 font-medium">
                          {orderbook.summary.spread}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Bids (buys) */}
              <div>
                {aggregatedBids.map(level => renderLevel(level, true))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Compact */}
        <div className="px-3 py-2 border-t border-gray-800 bg-gray-900/40 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-mono">Top 15 levels per side</span>
            <span className="font-mono">
              60s refresh • RT filter: {realtimeSpotPrice ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}