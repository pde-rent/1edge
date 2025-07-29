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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TrendingUp, BarChart3, Activity, ChevronDown, Wifi } from 'lucide-react';

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
  if (parts.length === 1 && parts[0].includes('-')) {
    // e.g. BTC-USD -> main: BTC-USD, tags: [] (could be from coinbase, treat as main)
    return { main: parts[0], tags: [] };
  }
  // Default fallback if parsing fails or format is unexpected
  return { main: symbol, tags: [] };
}

/**
 * Renders a tag badge for a feed symbol.
 * @param children - The tag content.
 */
function FeedTag({ children }: { children: React.ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="ml-2 text-xs font-medium uppercase h-5 px-2 bg-green-500/10 border-green-500/50 text-green-400 hover:bg-green-500/20"
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
        textColor: '#e5e7eb', // gray-200
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: 12,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#374151' }, // gray-700
        horzLines: { color: '#374151' } // gray-700
      },
      timeScale: {
        borderColor: '#6b7280', // gray-500
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
          labelBackgroundColor: '#1f2937', // gray-800
        },
        horzLine: {
          labelBackgroundColor: '#1f2937', // gray-800
        },
      },
      watermark: {
        visible: true,
        color: 'rgba(55, 65, 81, 0.3)', // gray-700 with opacity
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
        upColor: '#22c55e', // green-500
        downColor: '#ef4444', // red-500
        borderDownColor: '#ef4444',
        borderUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        wickUpColor: '#22c55e',
      });
    } else if (chartType === 'bars') {
      newSeries = chart.addSeries(BarSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        thinBars: false,
      });
    } else {
      newSeries = chart.addSeries(LineSeries, {
        color: '#3b82f6', // blue-500
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
      <div className="h-full w-full flex flex-col bg-gray-950">
        <div className="flex-1 flex justify-center items-center">
          <p className="text-gray-400 text-sm">
            Select a feed to view chart.
          </p>
        </div>
      </div>
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
    <div className="h-full w-full flex flex-col rounded-xl bg-gray-900 border-5 border-gray-800 shadow-lg shadow-black/20 overflow-hidden">
      {/* Enhanced Header with Logo and Feed Selector */}
      <div className="px-4 py-3 flex-shrink-0 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between mb-3">
          {/* Left: Logo and Feed Selector */}
          <div className="flex items-center gap-4">
            <img
              src="/logo.svg"
              alt="1edge"
              className="h-[32px] w-[80px] object-contain brightness-110 contrast-125"
            />

            {/* Feed Selector Dropdown */}
            <div className="relative">
              <select
                value={feedId || ''}
                onChange={(e) => onFeedSelect(e.target.value)}
                className="px-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded text-gray-100 text-sm focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50 appearance-none cursor-pointer pr-10 min-w-[180px]"
              >
                <option value="" disabled>Select a feed</option>
                {feedsResponse?.success && feedsResponse.data?.map((feed: any) => (
                  <option key={feed.symbol} value={feed.symbol} className="bg-gray-900">
                    {parseFeedSymbol(feed.symbol).main}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Right: Connection Status and Controls */}
          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div className="flex items-center gap-2">
              <Wifi className={`w-4 h-4 ${isConnected ? 'text-green-400' : 'text-gray-500'}`} />
              <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Chart Type Selector */}
            <ToggleGroup
              type="single"
              value={chartType}
              onValueChange={(value) => {
                if (value) setChartType(value as 'candles' | 'bars' | 'line');
              }}
              className="bg-gray-900 border border-gray-800 rounded-md p-1"
            >
              <ToggleGroupItem
                value="candles"
                aria-label="candlestick chart"
                className="data-[state=on]:bg-green-500/20 data-[state=on]:text-green-400 hover:bg-gray-800 text-gray-400 px-2 py-1 border-0"
              >
                <Activity className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="bars"
                aria-label="bar chart"
                className="data-[state=on]:bg-green-500/20 data-[state=on]:text-green-400 hover:bg-gray-800 text-gray-400 px-2 py-1 border-0"
              >
                <BarChart3 className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="line"
                aria-label="line chart"
                className="data-[state=on]:bg-green-500/20 data-[state=on]:text-green-400 hover:bg-gray-800 text-gray-400 px-2 py-1 border-0"
              >
                <TrendingUp className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Timeframe Selector */}
            <ToggleGroup
              type="single"
              value={timeframe}
              onValueChange={(value) => {
                if (value) {
                  setTimeframe(value);
                  tickBufferRef.current = {}; // Clear buffer on timeframe change
                }
              }}
              className="bg-gray-900 border border-gray-800 rounded-md p-1"
            >
              <ToggleGroupItem
                value="5"
                className="data-[state=on]:bg-green-500/20 data-[state=on]:text-green-400 hover:bg-gray-800 text-gray-400 px-3 py-1 text-xs font-medium border-0"
              >
                5s
              </ToggleGroupItem>
              <ToggleGroupItem
                value="20"
                className="data-[state=on]:bg-green-500/20 data-[state=on]:text-green-400 hover:bg-gray-800 text-gray-400 px-3 py-1 text-xs font-medium border-0"
              >
                20s
              </ToggleGroupItem>
              <ToggleGroupItem
                value="60"
                className="data-[state=on]:bg-green-500/20 data-[state=on]:text-green-400 hover:bg-gray-800 text-gray-400 px-3 py-1 text-xs font-medium border-0"
              >
                1m
              </ToggleGroupItem>
              <ToggleGroupItem
                value="300"
                className="data-[state=on]:bg-green-500/20 data-[state=on]:text-green-400 hover:bg-gray-800 text-gray-400 px-3 py-1 text-xs font-medium border-0"
              >
                5m
              </ToggleGroupItem>
              <ToggleGroupItem
                value="1800"
                className="data-[state=on]:bg-green-500/20 data-[state=on]:text-green-400 hover:bg-gray-800 text-gray-400 px-3 py-1 text-xs font-medium border-0"
              >
                30m
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Feed Info Bar */}
        {feedId && (
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-wrap gap-3">
              <h2 className="font-semibold text-lg text-white font-mono">
                {parsedSymbol.main}
              </h2>
              {parsedSymbol.tags.map(tag => (
                <FeedTag key={tag}>{tag}</FeedTag>
              ))}
              <span className="ml-2 font-mono text-lg font-semibold text-white">
                {latestPrice}
              </span>
            </div>

            {/* Feed Metrics */}
            {indexMetrics && (
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">Velocity:</span>
                  <span className="text-green-400 font-semibold">{indexMetrics.velocity}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">Spread:</span>
                  <span className="text-orange-400 font-semibold">{indexMetrics.dispersion}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">Vol:</span>
                  <span className="text-green-400 font-semibold">{indexMetrics.vbid}/{indexMetrics.vask}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`flex-grow w-full relative ${feedId ? 'h-[calc(100%-64px)]' : 'h-full'} min-h-[150px]`}>
        <div
          ref={chartContainerRef}
          className="w-full min-h-[400px] h-full bg-gray-950"
        >
          {feedId && error && (
            <p className="text-red-400 px-4 py-2 text-sm">
              Error loading chart: {error.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}