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
      className="ml-2 text-xs font-medium uppercase h-5 px-2 bg-emerald-500/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20 transition-all duration-300"
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
        textColor: '#e2e8f0', // slate-200
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: 12,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#334155' }, // slate-700
        horzLines: { color: '#334155' } // slate-700
      },
      timeScale: {
        borderColor: '#64748b', // slate-500
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
          labelBackgroundColor: '#1e293b', // slate-800
        },
        horzLine: {
          labelBackgroundColor: '#1e293b', // slate-800
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
        upColor: '#10b981', // emerald-500
        downColor: '#ef4444', // red-500
        borderDownColor: '#ef4444',
        borderUpColor: '#10b981',
        wickDownColor: '#ef4444',
        wickUpColor: '#10b981',
      });
    } else if (chartType === 'bars') {
      newSeries = chart.addSeries(BarSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        thinBars: false,
      });
    } else {
      newSeries = chart.addSeries(LineSeries, {
        color: '#14b8a6', // teal-500
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
      <div className="p-1 rounded-2xl bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-cyan-500/20 shadow-2xl border border-teal-500 h-full">
        <div className="p-1 rounded-2xl bg-slate-800/30 backdrop-blur-sm h-full">
          <div className="h-full bg-black/80 backdrop-blur-xl border-slate-700/50 rounded-2xl shadow-2xl flex flex-col">
            <div className="flex-1 flex justify-center items-center">
              <div className="text-center">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 rounded-full blur-xl"></div>
                  <Activity className="w-12 h-12 text-teal-400 mx-auto relative z-10" />
                </div>
                <p className="text-slate-200 font-medium">No feed selected</p>
                <p className="text-xs text-slate-400 mt-1">
                  Select a feed to view chart data
                </p>
              </div>
            </div>
          </div>
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
    <div className="p-1 rounded-2xl bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-cyan-500/20 shadow-2xl border border-teal-500 h-full">
      <div className="p-1 rounded-2xl bg-slate-800/30 backdrop-blur-sm h-full">
        <div className="h-full bg-black/80 backdrop-blur-xl border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Enhanced Header with Logo and Feed Selector */}
          <div className="px-4 py-3 flex-shrink-0 border-b border-teal-500/20 bg-gradient-to-r from-black/95 via-slate-950/90 to-black/95 backdrop-blur-md relative">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent"></div>
            
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
                    className="px-3 py-2 bg-black/70 backdrop-blur-sm border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400/50 appearance-none cursor-pointer pr-10 min-w-[180px] shadow-inner transition-all duration-300 hover:bg-black/80"
                  >
                    <option value="" disabled>Select a feed</option>
                    {feedsResponse?.success && feedsResponse.data?.map((feed: any) => (
                      <option key={feed.symbol} value={feed.symbol} className="bg-slate-900">
                        {parseFeedSymbol(feed.symbol).main}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
                </div>
              </div>

              {/* Right: Connection Status and Controls */}
              <div className="flex items-center gap-3">
                {/* Connection indicator */}
                <div className="flex items-center gap-2">
                  <Wifi className={`w-4 h-4 ${isConnected ? 'text-teal-400' : 'text-slate-500'}`} />
                  <span className={`text-xs font-medium ${isConnected ? 'text-teal-400' : 'text-slate-500'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                  {isConnected && <div className="w-1 h-1 rounded-full bg-teal-400 shadow-lg shadow-teal-400/50"></div>}
                </div>

                {/* Chart Type Selector */}
                <ToggleGroup
                  type="single"
                  value={chartType}
                  onValueChange={(value) => {
                    if (value) setChartType(value as 'candles' | 'bars' | 'line');
                  }}
                  className="bg-black/60 backdrop-blur-sm border border-slate-700/50 rounded-lg p-1 shadow-inner"
                >
                  <ToggleGroupItem
                    value="candles"
                    aria-label="candlestick chart"
                    className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-teal-600/20 data-[state=on]:to-emerald-600/20 data-[state=on]:border-teal-400/50 data-[state=on]:text-teal-200 hover:bg-slate-800/60 text-slate-400 px-2 py-1 border-0 transition-all duration-300"
                  >
                    <Activity className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="bars"
                    aria-label="bar chart"
                    className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-teal-600/20 data-[state=on]:to-emerald-600/20 data-[state=on]:border-teal-400/50 data-[state=on]:text-teal-200 hover:bg-slate-800/60 text-slate-400 px-2 py-1 border-0 transition-all duration-300"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="line"
                    aria-label="line chart"
                    className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-teal-600/20 data-[state=on]:to-emerald-600/20 data-[state=on]:border-teal-400/50 data-[state=on]:text-teal-200 hover:bg-slate-800/60 text-slate-400 px-2 py-1 border-0 transition-all duration-300"
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
                  className="bg-black/60 backdrop-blur-sm border border-slate-700/50 rounded-lg p-1 shadow-inner"
                >
                  <ToggleGroupItem
                    value="5"
                    className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-teal-600/20 data-[state=on]:to-emerald-600/20 data-[state=on]:border-teal-400/50 data-[state=on]:text-teal-200 hover:bg-slate-800/60 text-slate-400 px-3 py-1 text-xs font-medium border-0 transition-all duration-300"
                  >
                    5s
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="20"
                    className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-teal-600/20 data-[state=on]:to-emerald-600/20 data-[state=on]:border-teal-400/50 data-[state=on]:text-teal-200 hover:bg-slate-800/60 text-slate-400 px-3 py-1 text-xs font-medium border-0 transition-all duration-300"
                  >
                    20s
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="60"
                    className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-teal-600/20 data-[state=on]:to-emerald-600/20 data-[state=on]:border-teal-400/50 data-[state=on]:text-teal-200 hover:bg-slate-800/60 text-slate-400 px-3 py-1 text-xs font-medium border-0 transition-all duration-300"
                  >
                    1m
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="300"
                    className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-teal-600/20 data-[state=on]:to-emerald-600/20 data-[state=on]:border-teal-400/50 data-[state=on]:text-teal-200 hover:bg-slate-800/60 text-slate-400 px-3 py-1 text-xs font-medium border-0 transition-all duration-300"
                  >
                    5m
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="1800"
                    className="data-[state=on]:bg-gradient-to-r data-[state=on]:from-teal-600/20 data-[state=on]:to-emerald-600/20 data-[state=on]:border-teal-400/50 data-[state=on]:text-teal-200 hover:bg-slate-800/60 text-slate-400 px-3 py-1 text-xs font-medium border-0 transition-all duration-300"
                  >
                    30m
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {/* Feed Info Bar */}
            {feedId && (
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center flex-wrap gap-3">
                  <h2 className="font-semibold text-lg text-white font-mono flex items-center gap-2">
                    {parsedSymbol.main}
                    <div className="w-1 h-1 rounded-full bg-teal-400"></div>
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
                      <span className="text-slate-400">Velocity:</span>
                      <span className="text-emerald-400 font-semibold">{indexMetrics.velocity}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">Spread:</span>
                      <span className="text-orange-400 font-semibold">{indexMetrics.dispersion}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">Vol:</span>
                      <span className="text-emerald-400 font-semibold">{indexMetrics.vbid}/{indexMetrics.vask}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={`flex-grow w-full relative ${feedId ? 'h-[calc(100%-64px)]' : 'h-full'} min-h-[150px] bg-gradient-to-b from-black/95 via-slate-950/90 to-black/95 backdrop-blur-xl`}>
            <div
              ref={chartContainerRef}
              className="w-full min-h-[400px] h-full bg-gradient-to-b from-black/60 via-slate-950/40 to-black/60 backdrop-blur-sm"
            >
              {feedId && error && (
                <div className="p-4">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50 backdrop-blur-sm">
                    <p className="text-red-400 text-sm flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-red-400"></div>
                      Error loading chart: {error.message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}