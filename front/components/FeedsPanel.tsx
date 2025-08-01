// @ts-nocheck
import useSWR from 'swr';
import { fetcher } from '../utils/fetcher';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PanelWrapper } from './common/Panel';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { roundSig, formatPrice } from '../lib/utils';
import { Layers, TrendingUp, Loader2, Wifi } from 'lucide-react';

/**
 * Renders a tag badge for a feed symbol with dark theme and green accents.
 * @param children - The tag content.
 */
function FeedTag({ children }: { children: React.ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="ml-1 text-xs px-1.5 py-0 h-4 font-semibold uppercase bg-primary/10 border-primary/50 text-primary hover:bg-primary/20"
    >
      {children}
    </Badge>
  );
}

interface ParsedSymbol {
  main: string;
  tags: string[];
}

/**
 * Parses a feed symbol into its main part and tags.
 * @param symbol - The feed symbol string.
 * @returns An object with main and tags properties.
 */
function parseFeedSymbol(symbol: string): ParsedSymbol {
  if (!symbol) return { main: 'N/A', tags: [] };
  const parts = symbol.split(':');
  if (parts.length === 3) {
    // e.g., agg:spot:BTCUSD -> main: BTCUSD, tags: [agg, spot]
    return { main: parts[2], tags: [parts[0], parts[1]] };
  }
  if (parts.length === 2) {
    // e.g., binance:BTCUSDT -> main: BTCUSDT, tags: [binance]
    return { main: parts[1], tags: [parts[0]] };
  }
  if (parts.length === 1 && parts[0].includes('-')){
    // e.g. BTC-USD -> main: BTC-USD, tags: [] (could be from coinbase, treat as main)
    return { main: parts[0], tags: [] };
  }
  // Default fallback if parsing fails or format is unexpected
  return { main: symbol, tags: [] };
}

/**
 * Formats the mid value for display, using scientific notation for small values.
 * @param value - The mid value to format.
 * @returns The formatted string.
 */
function formatMidValue(value: number | undefined): string {
  if (value === undefined || value === null) return '-';
  return formatPrice(value);
}

/**
 * FeedsPanel displays a list of available feeds with spread and mid values.
 * @param onSelect - Callback when a feed is selected.
 * @param selectedFeedId - The currently selected feed ID.
 */
export default function FeedsPanel({ onSelect, selectedFeedId }: { onSelect: (feedId: string) => void, selectedFeedId: string | null }) {
  const { data: apiResponse, error, isValidating } = useSWR('/api/feeds', fetcher, { refreshInterval: 10000 });
  const [feedsToDisplay, setFeedsToDisplay] = useState([]);
  const [realtimePrices, setRealtimePrices] = useState(new Map());

  // WebSocket connection for real-time price updates
  const { subscribe, isConnected } = useWebSocketContext();

  // Set feeds data only - don't handle default selection here
  useEffect(() => {
    if (apiResponse?.success && apiResponse.data) {
      const fetchedFeeds = Array.isArray(apiResponse.data) ? apiResponse.data : Object.values(apiResponse.data);
      setFeedsToDisplay(fetchedFeeds);
    }
  }, [apiResponse]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (isConnected && feedsToDisplay.length > 0) {
      const symbols = feedsToDisplay.map(feed => feed.symbol).filter(Boolean);
      if (symbols.length > 0) {
        console.log('FeedsPanel subscribing to symbols:', symbols);
        const handleMessage = (message) => {
          if (message.type === 'price_update' && message.symbol) {
            setRealtimePrices(prev => new Map(prev.set(message.symbol, message.data)));
          }
        };

        subscribe(symbols, handleMessage);

        return () => {
          // Note: In a real app, you might want to unsubscribe here
          // but for feeds panel, we want to keep getting updates
        };
      }
    }
  }, [isConnected, subscribe, feedsToDisplay]);

  if (error && feedsToDisplay.length === 0)
    return (
      <PanelWrapper>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-red-400 font-medium">
            Error loading feeds: {error.message}
          </div>
        </CardContent>
      </PanelWrapper>
    );

  if (feedsToDisplay.length === 0 && isValidating)
    return (
      <PanelWrapper>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading feeds...</span>
          </div>
        </CardContent>
      </PanelWrapper>
    );

  if (feedsToDisplay.length === 0 && !isValidating && !error)
    return (
      <PanelWrapper>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-gray-500 font-medium">
            No feeds available.
          </div>
        </CardContent>
      </PanelWrapper>
    );

  if (apiResponse && !apiResponse.success && feedsToDisplay.length === 0) {
    return (
      <PanelWrapper>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-red-400 font-medium">
            Error: {apiResponse.error || 'Failed to fetch feeds'}
          </div>
        </CardContent>
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper>
      {/* Header */}
      <CardHeader className="pb-3 border-b border-gray-800 bg-gray-900/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold text-gray-100">Feeds</h2>
          </div>
          
          {/* Live indicator */}
          {isValidating && feedsToDisplay.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-primary animate-pulse" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Live
              </span>
            </div>
          )}
          
          {/* Connection status */}
          {!isValidating && (
            <div className="flex items-center gap-1.5">
              <Wifi className={cn(
                "w-3 h-3",
                isConnected ? "text-primary" : "text-gray-500"
              )} />
              <span className={cn(
                "text-xs font-medium uppercase tracking-wide",
                isConnected ? "text-primary" : "text-gray-500"
              )}>
                {isConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900/40 flex-shrink-0">
          <div className="col-span-6 text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Feed
          </div>
          <div className="col-span-3 text-xs font-medium text-gray-400 uppercase tracking-wide text-right">
            Spread
          </div>
          <div className="col-span-3 text-xs font-medium text-gray-400 uppercase tracking-wide text-right flex items-center justify-end gap-1">
            Mid
            <TrendingUp className="w-3 h-3 text-primary" />
          </div>
        </div>

        {/* Feeds List - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-gray-950">
          {feedsToDisplay.map((feed: any) => {
            const parsed = parseFeedSymbol(feed.symbol);
            const isSelected = feed.symbol === selectedFeedId;

            // Use real-time data if available, fallback to API data
            const realtimeData = realtimePrices.get(feed.symbol);
            const midPrice = realtimeData?.mid || feed.last?.mid;
            const askPrice = realtimeData?.ask || feed.last?.ask;
            const bidPrice = realtimeData?.bid || feed.last?.bid;

            // Compute absolute and relative spread, clamp negative to zero
            let spreadVal = 0;
            let absSpread: string = '0';
            let relativeSpread: string = '0%';
            if (typeof askPrice === 'number' && typeof bidPrice === 'number') {
              spreadVal = Math.max(0, askPrice - bidPrice);
              absSpread = formatPrice(spreadVal);
              if (typeof midPrice === 'number' && midPrice > 0) {
                const relativeSpreadValue = (spreadVal / midPrice) * 100;
                relativeSpread = roundSig(relativeSpreadValue, 3) + '%';
              }
            }

            return (
              <div
                key={feed.symbol}
                onClick={() => onSelect(feed.symbol)}
                title={`Select ${feed.symbol}`}
                className={cn(
                  "grid grid-cols-12 gap-2 px-3 py-2 cursor-pointer transition-all duration-200 border-l-2 hover:bg-gray-800/40",
                  isSelected 
                    ? "bg-primary/10 border-l-primary hover:bg-primary/15" 
                    : "border-l-transparent hover:border-l-gray-600"
                )}
              >
                <div className="col-span-6 flex items-center min-w-0">
                  <span className={cn(
                    "font-semibold text-sm truncate",
                    isSelected ? "text-primary" : "text-gray-200"
                  )}>
                    {parsed.main}
                  </span>
                  <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                    {parsed.tags.map(tag => <FeedTag key={tag}>{tag}</FeedTag>)}
                  </div>
                </div>
                
                <div className="col-span-3 flex flex-col items-end justify-center">
                  <span className="text-xs text-gray-400 font-medium">
                    {relativeSpread}
                  </span>
                  <span className="font-mono text-xs text-gray-300 font-semibold">
                    {absSpread}
                  </span>
                </div>
                
                <div className="col-span-3 flex items-center justify-end">
                  <span className="font-mono text-sm text-primary font-bold tabular-nums">
                    {formatMidValue(midPrice)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-gray-800 bg-gray-900/40 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-mono">
              {feedsToDisplay.length} feed{feedsToDisplay.length !== 1 ? 's' : ''} available
            </span>
            <span className="font-mono">
              10s refresh • Real-time: {isConnected ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </CardContent>
    </PanelWrapper>
  );
}