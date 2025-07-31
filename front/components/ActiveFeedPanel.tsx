// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries, BarSeries, LineSeries } from 'lightweight-charts';
import { fetcher } from '../utils/fetcher';
import { useWebSocketContext } from '../contexts/WebSocketContext';
// Use path aliases
import { API_URL, THEME } from '@common/constants';
import type { TickerFeed, ApiResponse } from '@common/types';
import { roundSig } from '@common/utils';
import { Badge } from '@/components/ui/badge';
import { PanelWrapper } from './common/Panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, BarChart3, Activity, ChevronDown } from 'lucide-react';
import StatusIndicator from './StatusIndicator';

// Custom candlestick icon component
function CandlestickIcon({ className }: { className?: string }) {
  return (
    <img
      src="/candles.svg"
      alt="Candles"
      className={className}
      style={{ filter: 'brightness(0) saturate(100%) invert(92%) sepia(4%) saturate(1033%) hue-rotate(169deg) brightness(78%) contrast(85%)' }}
    />
  );
}

// Chart type options
const CHART_TYPE_OPTIONS = [
  { value: 'candles', label: 'Candles', icon: CandlestickIcon },
  { value: 'bars', label: 'Bars', icon: BarChart3 },
  { value: 'line', label: 'Line', icon: TrendingUp }
];

// Timeframe options
const TIMEFRAME_OPTIONS = [
  { value: '5', label: '5s' },
  { value: '20', label: '20s' },
  { value: '60', label: '1m' },
  { value: '300', label: '5m' },
  { value: '1800', label: '30m' }
];

interface ActiveFeedPanelProps {
  feedId: string | null;
  onFeedSelect: (feedId: string) => void;
}

/**
 * Parses a feed symbol into its main part and tags.
 * @param symbol - The feed symbol string.
 * @returns An object with main and tags properties.
 */
function parseFeedSymbol(symbol: string) {
  if (!symbol) return { main: 'N/A', tags: [], base: '', quote: '' };

  const parts = symbol.split(':');
  let main: string;
  let tags: string[];

  if (parts.length === 3) {
    // e.g., agg:spot:BTCUSD -> main: BTCUSD, tags: [agg, spot]
    main = parts[2];
    tags = [parts[0], parts[1]];
  } else if (parts.length === 2) {
    // e.g., binance:BTCUSDT -> main: BTCUSDT, tags: [binance]
    main = parts[1];
    tags = [parts[0]];
  } else if (parts.length === 1 && parts[0].includes('-')) {
    // e.g. BTC-USD -> main: BTC-USD, tags: [] (could be from coinbase, treat as main)
    main = parts[0];
    tags = [];
  } else {
    // Default fallback if parsing fails or format is unexpected
    main = symbol;
    tags = [];
  }

  // Extract base and quote tokens from main symbol
  let base = '';
  let quote = '';

  if (main.includes('-')) {
    // Format: BTC-USD
    const tokenParts = main.split('-');
    base = tokenParts[0] || '';
    quote = tokenParts[1] || '';
  } else {
    // Format: BTCUSDT, ETHUSDC, etc.
    // Common quote currencies to try matching
    const commonQuotes = ['USDT', 'USDC', 'USD', 'BTC', 'ETH'];
    for (const commonQuote of commonQuotes) {
      if (main.endsWith(commonQuote)) {
        quote = commonQuote;
        base = main.slice(0, -commonQuote.length);
        break;
      }
    }

    // Fallback if no common quote found
    if (!base && !quote && main.length > 3) {
      // Assume last 3-4 chars are quote
      if (main.length > 6) {
        quote = main.slice(-4);
        base = main.slice(0, -4);
      } else {
        quote = main.slice(-3);
        base = main.slice(0, -3);
      }
    }
  }

  return { main, tags, base, quote };
}

/**
 * Renders a tag badge for a feed symbol.
 * @param children - The tag content.
 */
function FeedTag({ children }: { children: React.ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="text-xs font-medium uppercase h-5 px-2 bg-primary/20 border-primary/50 text-primary hover:bg-primary/30 transition-all duration-300"
    >
      {children}
    </Badge>
  );
}

/**
 * ActiveFeedPanel displays a chart and info for a selected feed.
 * @param feedId - The feed symbol to display.
 */
export default function ActiveFeedPanel({ feedId, onFeedSelect }: ActiveFeedPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const [chartType, setChartType] = useState<'candles' | 'bars' | 'line'>('candles');
  const [realtimePrice, setRealtimePrice] = useState(null);
  const [timeframe, setTimeframe] = useState('20'); // Default 20 seconds as string for ToggleGroup
  const tickBufferRef = useRef({}); // Store ticks per candle period

  const { data: apiResponse, error } = useSWR<ApiResponse<TickerFeed>>(
    feedId ? `/api/feeds/${feedId}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: historyResponse } = useSWR<ApiResponse<TickerFeed>>(
    feedId ? `/api/feeds/history/${feedId}` : null,
    fetcher
  );

  // Fetch all feeds for the dropdown
  const { data: feedsResponse } = useSWR<ApiResponse<any[]>>('/api/feeds', fetcher);

  const { subscribe, unsubscribe, isConnected } = useWebSocketContext();

  // Set default feed if none selected
  useEffect(() => {
    if (feedsResponse?.success && feedsResponse.data && feedsResponse.data.length > 0 && !feedId) {
      // Look for BTCUSDC first
      const btcFeed = feedsResponse.data.find(feed =>
        feed.symbol && feed.symbol.includes('BTCUSDC')
      );

      if (btcFeed && btcFeed.symbol) {
        onFeedSelect(btcFeed.symbol);
      } else {
        // Fallback to first feed if BTCUSDC not found
        const firstFeed = feedsResponse.data[0];
        if (firstFeed && firstFeed.symbol) {
          onFeedSelect(firstFeed.symbol);
        }
      }
    }
  }, [feedsResponse, feedId, onFeedSelect]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (feedId && isConnected) {
      const handleMessage = (message) => {
        if (message.type === 'price_update' && message.symbol === feedId) {
          const priceData = message.data;
          setRealtimePrice(priceData);

          if (priceData.mid && seriesRef.current) {
            const currentTime = Math.floor(Date.now() / 1000);
            const timeframeSeconds = parseInt(timeframe);
            const candleTime = Math.floor(currentTime / timeframeSeconds) * timeframeSeconds;

            if (!tickBufferRef.current[candleTime]) {
              const lastCandle = tickBufferRef.current[Object.keys(tickBufferRef.current).pop()];
              tickBufferRef.current[candleTime] = {
                open: lastCandle ? lastCandle.close : priceData.mid,
                high: priceData.mid,
                low: priceData.mid,
                close: priceData.mid,
                time: candleTime,
              };
            }

            const candle = tickBufferRef.current[candleTime];
            candle.high = Math.max(candle.high, priceData.mid);
            candle.low = Math.min(candle.low, priceData.mid);
            candle.close = priceData.mid;

            if (chartType === 'line') {
              seriesRef.current.update({
                time: currentTime,
                value: priceData.mid
              });
            } else {
              seriesRef.current.update({
                time: candleTime,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close
              });
            }
          }
        }
      };

      subscribe([feedId], handleMessage);
      return () => {
        unsubscribe([feedId], handleMessage);
        tickBufferRef.current = {};
      };
    }
  }, [feedId, isConnected, subscribe, unsubscribe, chartType, timeframe]);

  // Chart creation
  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: THEME.chart.textColor,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: 12,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: THEME.chart.gridColor },
        horzLines: { color: THEME.chart.gridColor }
      },
      timeScale: {
        borderColor: THEME.chart.borderColor,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 5
      },
      autoSize: true,
      localization: {
        priceFormatter: price => roundSig(price, 6).toLocaleString(undefined),
      },
      crosshair: {
        vertLine: {
          labelBackgroundColor: THEME.chart.labelBg,
        },
        horzLine: {
          labelBackgroundColor: THEME.chart.labelBg,
        },
      },
      watermark: {
        visible: true,
        color: 'rgba(51, 65, 85, 0.3)', // slate-700 with opacity
        text: '1edge',
        fontSize: 18,
        horzAlign: 'right',
        vertAlign: 'bottom',
      },
    });
    chartRef.current = chart;

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // Series creation and historical data loading
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !feedId) return;

    // Remove old series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Create new series with proper colors
    let newSeries;
    if (chartType === 'candles') {
      newSeries = chart.addSeries(CandlestickSeries, {
        upColor: THEME.chart.upColor,
        downColor: THEME.chart.downColor,
        borderDownColor: THEME.chart.downColor,
        borderUpColor: THEME.chart.upColor,
        wickDownColor: THEME.chart.downColor,
        wickUpColor: THEME.chart.upColor,
      });
    } else if (chartType === 'bars') {
      newSeries = chart.addSeries(BarSeries, {
        upColor: THEME.chart.upColor,
        downColor: THEME.chart.downColor,
        thinBars: false,
      });
    } else {
      newSeries = chart.addSeries(LineSeries, {
        color: THEME.chart.volumeColor,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        lastValueVisible: true,
      });
    }
    seriesRef.current = newSeries;

    // Load historical data
    if (historyResponse?.success && historyResponse.data?.history?.ts) {
      const rawData = historyResponse.data.history;
      const formattedData = rawData.ts.map((timestamp, index) => {
        let time = timestamp;
        if (typeof time === 'string') time = parseInt(time, 10);
        if (time > 1000000000000) time = Math.floor(time / 1000);

        const now = Math.floor(Date.now() / 1000);
        if (time > now || time < 1262304000) {
          time = now - ((rawData.ts.length - index) * 60);
        }

        return {
          time,
          open: rawData.o[index],
          high: rawData.h[index],
          low: rawData.l[index],
          close: rawData.c[index],
          value: rawData.c[index],
        };
      }).sort((a, b) => a.time - b.time);

      if (chartType === 'line') {
        const lineData = formattedData.map(item => ({ time: item.time, value: item.close }));
        newSeries.setData(lineData);
      } else {
        newSeries.setData(formattedData);
      }
      chart.timeScale().fitContent();
    }
  }, [feedId, chartType, historyResponse]);

  // Resize handler
  useEffect(() => {
    if (!chartContainerRef.current || !chartRef.current) return;

    const resizeChart = () => {
      const chart = chartRef.current;
      if (!chart || !chartContainerRef.current) return;
      const container = chartContainerRef.current;
      chart.resize(container.clientWidth, container.clientHeight);
    };

    const resizeObserver = new ResizeObserver(resizeChart);
    resizeObserver.observe(chartContainerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  if (!feedId && !chartRef.current) {
    return (
      <PanelWrapper>
        <div className="flex-1 flex justify-center items-center">
          <div className="text-center">
            <div className="relative mb-4">
              <Activity className="w-12 h-12 text-primary mx-auto relative z-10" />
            </div>
            <p className="text-slate-200 font-medium">No feed selected</p>
            <p className="text-xs text-slate-400 mt-1">
              Select a feed to view chart data
            </p>
          </div>
        </div>
      </PanelWrapper>
    );
  }

  // Parse feed symbol for display
  const parsedSymbol = feedId ? parseFeedSymbol(feedId) : { main: '', tags: [] };
  const latestPrice = realtimePrice?.mid
    ? roundSig(realtimePrice.mid, 6).toLocaleString()
    : (apiResponse?.success && apiResponse.data?.last?.mid
      ? roundSig(apiResponse.data.last.mid, 6).toLocaleString()
      : '-');

  // Display enhanced index data if available
  const indexMetrics = realtimePrice ? {
    velocity: realtimePrice.velocity ? roundSig(realtimePrice.velocity, 2).toLocaleString() : '0',
    dispersion: realtimePrice.dispersion ? `${roundSig(realtimePrice.dispersion, 2).toLocaleString()}%` : '0%',
    vbid: realtimePrice.vbid ? roundSig(realtimePrice.vbid, 2).toLocaleString() : '0',
    vask: realtimePrice.vask ? roundSig(realtimePrice.vask, 2).toLocaleString() : '0'
  } : null;

  return (
    <PanelWrapper>
      <div className="h-full flex flex-col">
        {/* Redesigned Header - One Line */}
        <div className="px-4 py-3 flex-shrink-0 bg-background/95 backdrop-blur-md relative h-[60px] flex items-center justify-between">

          {/* Left: Logo and Token Pair Selector */}
          <div className="flex items-center gap-4">
            <img
              src="/logo.svg"
              alt="1edge"
              className="h-[36px] w-[90px] object-contain brightness-110 contrast-125"
            />

            {/* Token Pair Selector with Icons */}
            <Select value={feedId || ''} onValueChange={onFeedSelect}>
              <SelectTrigger className="flex items-center gap-3 px-4 py-3 bg-primary/20 backdrop-blur-sm rounded-lg text-foreground hover:bg-primary/30 transition-all duration-300 border-0 w-auto cursor-pointer">
                <SelectValue>
                  {feedId ? (
                    <div className="flex items-center gap-3">
                      {/* Overlapping Token Icons */}
                      <div className="flex items-center relative">
                        <img
                          src={`/${parsedSymbol.base.toLowerCase()}.svg`}
                          alt={parsedSymbol.base}
                          className="w-8 h-8 rounded-full border border-primary/30"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <img
                          src={`/${parsedSymbol.quote.toLowerCase()}.svg`}
                          alt={parsedSymbol.quote}
                          className="w-8 h-8 rounded-full border border-primary/30 -ml-3"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      </div>
                      {/* Big Symbol */}
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-normal font-mono text-foreground">
                          {parsedSymbol.base}/{parsedSymbol.quote}
                        </span>
                        {/* Tags */}
                        {parsedSymbol.tags.filter(tag => tag !== 'agg').map(tag => (
                          <FeedTag key={tag}>{tag}</FeedTag>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400">Select Token Pair</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-primary/50 shadow-2xl max-h-60 overflow-y-auto">
                {feedsResponse?.success && feedsResponse.data?.map((feed: any) => {
                  const feedParsed = parseFeedSymbol(feed.symbol);
                  return (
                    <SelectItem 
                      key={feed.symbol} 
                      value={feed.symbol}
                      className="text-white hover:bg-primary/20 focus:bg-primary/30 hover:text-white focus:text-white cursor-pointer transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center relative">
                          <img
                            src={`/${feedParsed.base.toLowerCase()}.svg`}
                            alt={feedParsed.base}
                            className="w-5 h-5 rounded-full border border-primary/30"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <img
                            src={`/${feedParsed.quote.toLowerCase()}.svg`}
                            alt={feedParsed.quote}
                            className="w-5 h-5 rounded-full border border-primary/30 -ml-2"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                        <span className="font-mono font-semibold">{feedParsed.base}/{feedParsed.quote}</span>
                        {feedParsed.tags.filter(tag => tag !== 'agg').map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs h-4 px-1 bg-primary/20 border-primary/50 text-primary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Center: Current Price */}
          {feedId && (
            <div className="flex items-center">
              <span className="text-xl font-mono font-bold text-foreground">
                {latestPrice}
              </span>
            </div>
          )}

          {/* Right: Chart Type and Timeframe */}
          <div className="flex items-center gap-3">

            {/* Chart Type Selector */}
            <Select value={chartType} onValueChange={(value) => setChartType(value as 'candles' | 'bars' | 'line')}>
              <SelectTrigger size="sm" className="w-[100px] bg-black/70 backdrop-blur-sm border-primary/50 text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 hover:bg-black/80">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const option = CHART_TYPE_OPTIONS.find(opt => opt.value === chartType);
                      const IconComponent = option?.icon;
                      return (
                        <>
                          {IconComponent && <IconComponent className="w-4 h-4" />}
                          <span className="hidden sm:inline">{option?.label}</span>
                        </>
                      );
                    })()}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-border shadow-2xl">
                {CHART_TYPE_OPTIONS.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-white hover:bg-primary/20 focus:bg-primary/30 hover:text-white focus:text-white cursor-pointer transition-all duration-200"
                    >
                      <div className="flex items-center gap-2">
                        <IconComponent className="w-4 h-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Timeframe Selector */}
            <Select
              value={timeframe}
              onValueChange={(value) => {
                setTimeframe(value);
                tickBufferRef.current = {}; // Clear buffer on timeframe change
              }}
            >
              <SelectTrigger size="sm" className="w-[70px] bg-black/70 backdrop-blur-sm border-primary/50 text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 hover:bg-black/80">
                <SelectValue>
                  {TIMEFRAME_OPTIONS.find(opt => opt.value === timeframe)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-border shadow-2xl">
                {TIMEFRAME_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white hover:bg-primary/20 focus:bg-primary/30 hover:text-white focus:text-white cursor-pointer transition-all duration-200"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className={`flex-1 w-full relative bg-background/95 backdrop-blur-xl`}>
        <div
          ref={chartContainerRef}
          className="w-full h-full bg-background/60 backdrop-blur-sm"
        >
          {feedId && error && (
            <div className="p-4">
              <div className="p-3 bg-red-500/10 border border-red-500/50 backdrop-blur-sm">
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <div className="w-1 h-1 bg-red-400"></div>
                  Error loading chart: {error.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stats Overlay - Top Left */}
        {feedId && (
          <div className="absolute top-2 left-2 z-10 space-y-1 text-xs font-mono">
            {/* OHLC Values */}
            {realtimePrice && (
              <div className="flex items-center gap-4">
                <span className="text-slate-400">O: <span className="text-slate-300">{realtimePrice.open ? roundSig(realtimePrice.open, 6).toLocaleString() : '-'}</span></span>
                <span className="text-slate-400">H: <span className="text-slate-300">{realtimePrice.high ? roundSig(realtimePrice.high, 6).toLocaleString() : '-'}</span></span>
                <span className="text-slate-400">L: <span className="text-slate-300">{realtimePrice.low ? roundSig(realtimePrice.low, 6).toLocaleString() : '-'}</span></span>
                <span className="text-slate-400">C: <span className="text-slate-300">{realtimePrice.close ? roundSig(realtimePrice.close, 6).toLocaleString() : '-'}</span></span>
              </div>
            )}
            {/* Velocity and Spread */}
            {indexMetrics && (
              <div className="flex items-center gap-4">
                <span className="text-slate-400">Velocity: <span className="text-slate-300">{indexMetrics.velocity}</span></span>
                <span className="text-slate-400">Spread: <span className="text-yellow-500">{indexMetrics.dispersion}</span></span>
              </div>
            )}
          </div>
        )}

        {/* Status indicator positioned at bottom right */}
        <div className="absolute bottom-4 right-4 z-10">
          <StatusIndicator />
        </div>
      </div>
    </PanelWrapper>
  );
}
