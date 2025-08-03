// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  CandlestickSeries,
  BarSeries,
  LineSeries,
} from "lightweight-charts";
import { fetcher } from "../utils/fetcher";
import { useWebSocketContext } from "../contexts/WebSocketContext";
import { API_URL, THEME } from "@common/constants";
import type { TickerFeed, ApiResponse } from "@common/types";
import { roundSig, parseFeedSymbol } from "@common/utils";
import { Badge } from "@/components/ui/badge";
import { PanelWrapper } from "./common/Panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, BarChart3, Activity, ChevronDown } from "lucide-react";
import StatusIndicator from "./StatusIndicator";
import AuthComponent from "./AuthComponent";

// Custom candlestick icon component
function CandlestickIcon({ className }: { className?: string }) {
  return (
    <img
      src="/candles.svg"
      alt="Candles"
      className={className}
      style={{
        filter:
          "brightness(0) saturate(100%) invert(92%) sepia(4%) saturate(1033%) hue-rotate(169deg) brightness(78%) contrast(85%)",
      }}
    />
  );
}

const CHART_TYPE_OPTIONS = [
  { value: "candles", label: "Candles", icon: CandlestickIcon },
  { value: "bars", label: "Bars", icon: BarChart3 },
  { value: "line", label: "Line", icon: TrendingUp },
];

// Timeframe options
const TIMEFRAME_OPTIONS = [
  { value: "5", label: "5s" },
  { value: "20", label: "20s" },
  { value: "60", label: "1m" },
  { value: "300", label: "5m" },
  { value: "1800", label: "30m" },
];

interface ActiveFeedPanelProps {
  feedId: string | null;
  onFeedSelect: (feedId: string) => void;
}

// Note: parseFeedSymbol is now imported from @common/utils

/**
 * Renders a tag badge for a feed symbol.
 * @param children - The tag content.
 */
function FeedTag({ children }: { children: React.ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="text-xs font-medium uppercase h-5 px-2 bg-primary/20 border-primary/25 text-primary hover:bg-primary/30 transition-all duration-300"
    >
      {children}
    </Badge>
  );
}

/**
 * ActiveFeedPanel displays a chart and info for a selected feed.
 * @param feedId - The feed symbol to display.
 */
export default function ActiveFeedPanel({
  feedId,
  onFeedSelect,
}: ActiveFeedPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const [chartType, setChartType] = useState<"candles" | "bars" | "line">(
    "candles",
  );
  const [realtimePrice, setRealtimePrice] = useState(null);
  const [timeframe, setTimeframe] = useState("60"); // Default 1 minute as string for ToggleGroup
  const tickBufferRef = useRef({}); // Store ticks per candle period
  const [isChartReady, setIsChartReady] = useState(false);

  const { data: apiResponse, error } = useSWR<ApiResponse<TickerFeed>>(
    feedId ? `/api/feeds/${feedId}` : null,
    fetcher,
    { refreshInterval: 5000 },
  );

  const { data: historyResponse, error: historyError, isLoading: isLoadingHistory } = useSWR<
    ApiResponse<TickerFeed>
  >(feedId ? `/api/feeds/history/${feedId}` : null, fetcher);

  // Fetch all feeds for the dropdown
  const { data: feedsResponse } = useSWR<ApiResponse<any[]>>(
    "/api/feeds",
    fetcher,
  );

  const { subscribe, unsubscribe, isConnected } = useWebSocketContext();

  // Set default feed if none selected
  useEffect(() => {
    if (
      feedsResponse?.success &&
      feedsResponse.data &&
      feedsResponse.data.length > 0 &&
      !feedId
    ) {
      // Look for BTCUSDC first
      const btcFeed = feedsResponse.data.find(
        (feed) => feed.symbol && feed.symbol.includes("BTCUSDC"),
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
        if (message.type === "price_update" && message.symbol === feedId) {
          const priceData = message.data;
          setRealtimePrice(priceData);

          if (priceData.mid && seriesRef.current) {
            const currentTime = Math.floor(Date.now() / 1000);
            const timeframeSeconds = parseInt(timeframe);
            const candleTime =
              Math.floor(currentTime / timeframeSeconds) * timeframeSeconds;

            if (!tickBufferRef.current[candleTime]) {
              const lastCandle =
                tickBufferRef.current[Object.keys(tickBufferRef.current).pop()];
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

            // Store the current visible range and logical range before updating
            const timeScale = chartRef.current && chartRef.current.timeScale ? chartRef.current.timeScale() : null;
            const currentRange = timeScale ? timeScale.getVisibleRange() : null;
            const logicalRange = timeScale ? timeScale.getVisibleLogicalRange() : null;
            
            if (chartType === "line") {
              seriesRef.current.update({
                time: currentTime,
                value: priceData.mid,
              });
            } else {
              seriesRef.current.update({
                time: candleTime,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
              });
            }
            
            // Restore the visible range to prevent auto-scrolling
            // Use logical range if available as it's more stable
            if (timeScale) {
              if (logicalRange) {
                timeScale.setVisibleLogicalRange(logicalRange);
              } else if (currentRange) {
                timeScale.setVisibleRange(currentRange);
              }
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
  }, [feedId, isConnected, chartType, timeframe]);

  // Chart creation - only create once when container is ready
  useEffect(() => {
    if (!chartContainerRef.current || chartRef.current) return;

    const container = chartContainerRef.current;

    console.log("🔨 Creating chart");

    try {
      const chart = createChart(container, {
        width: container.clientWidth || 800,
        height: container.clientHeight || 400,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: THEME.chart.textColor,
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
          fontSize: 12,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: THEME.chart.gridColor },
          horzLines: { color: THEME.chart.gridColor },
        },
        timeScale: {
          borderColor: THEME.chart.borderColor,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 0,
          visible: true,
          tickMarkFormatter: (time) => {
            const date = new Date(time * 1000);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            
            if (diffHours < 24) {
              // Show time for recent data
              return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
            } else {
              // Show date for older data
              return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              });
            }
          },
        },
        leftPriceScale: {
          visible: false,
        },
        rightPriceScale: {
          width: 65,
          borderColor: THEME.chart.borderColor,
          visible: true,
          minimumWidth: 0,
          scaleMargins: {
            top: 0,
            bottom: 0,
          },
        },
        autoSize: true,
        localization: {
          priceFormatter: (price) =>
            roundSig
              ? roundSig(price, 6).toLocaleString(undefined)
              : price.toFixed(6),
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
          color: "rgba(51, 65, 85, 0.3)",
          text: "1edge",
          fontSize: 18,
          horzAlign: "right",
          vertAlign: "bottom",
        },
      });

      // Apply time scale options after chart creation for better compatibility
      chart.timeScale().applyOptions({
        rightOffset: 10, // Add space on the right to allow dragging into future
        fixLeftEdge: false, // Allow panning left
        fixRightEdge: false, // Allow panning right into future
        lockVisibleTimeRangeOnResize: true, // Keep the same time range when resizing
        shiftVisibleRangeOnNewBar: false, // Prevent auto-scrolling on new data
      });

      chartRef.current = chart;
      console.log("✅ Chart created successfully");
    } catch (error) {
      console.error("Error creating chart:", error);
    }

    return () => {
      // Don't destroy chart on feedId change, only on unmount
      if (!feedId) {
        if (chartRef.current) {
          try {
            console.log("🗑️ Destroying chart");
            // Clear series reference first
            if (seriesRef.current) {
              seriesRef.current = null;
            }
            // Remove chart
            chartRef.current.remove();
          } catch (error) {
            console.warn("Error disposing chart:", error);
          } finally {
            chartRef.current = null;
            setIsChartReady(false);
          }
        }
      }
    };
  }, [THEME, roundSig, feedId]);

  // Series creation and historical data loading
  useEffect(() => {
    const chart = chartRef.current;
    console.log("📊 Series effect triggered:", {
      hasChart: !!chart,
      feedId,
      chartType,
      historyResponse: !!historyResponse,
      historyData: historyResponse?.data?.history ? "has data" : "no data"
    });
    
    if (!chart || !feedId) {
      return;
    }

    // Reset ready state when feedId or chartType changes
    setIsChartReady(false);

    // Remove old series safely
    if (seriesRef.current && chart) {
      try {
        // Try to remove the series, handling various potential errors
        if (typeof chart.removeSeries === 'function') {
          chart.removeSeries(seriesRef.current);
        }
      } catch (error) {
        console.warn("Could not remove series (chart may have been disposed):", error);
      } finally {
        // Always clear the reference
        seriesRef.current = null;
      }
    }

    // Create new series with proper colors
    let newSeries;
    try {
      if (chartType === "candles") {
        newSeries = chart.addSeries(CandlestickSeries, {
          upColor: THEME.chart.upColor,
          downColor: THEME.chart.downColor,
          borderDownColor: THEME.chart.downColor,
          borderUpColor: THEME.chart.upColor,
          wickDownColor: THEME.chart.downColor,
          wickUpColor: THEME.chart.upColor,
        });
      } else if (chartType === "bars") {
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
    } catch (error) {
      return;
    }

    // Load historical data
    if (historyResponse?.success && historyResponse.data?.history) {
      const rawData = historyResponse.data.history;

      console.log("📊 Historical data received:", {
        symbol: feedId,
        tsLength: rawData.ts?.length || 0,
        oLength: rawData.o?.length || 0,
        sampleData: rawData.ts?.slice(0, 3), // First 3 timestamps
        firstCandle: {
          ts: rawData.ts?.[0],
          o: rawData.o?.[0],
          h: rawData.h?.[0],
          l: rawData.l?.[0],
          c: rawData.c?.[0],
        }
      });

      // Validate that we have data
      if (!rawData.ts || !rawData.o || !rawData.h || !rawData.l || !rawData.c) {
        console.error("Invalid history data structure:", rawData);
        return;
      }

      if (rawData.ts.length === 0) {
        console.warn("No historical data available");
        return;
      }

      try {
        const now = Math.floor(Date.now() / 1000);
        const threeHoursAgo = now - (3 * 60 * 60); // 3 hours in seconds
        
        const formattedData = rawData.ts
          .map((timestamp, index) => {
            let time = timestamp;
            if (typeof time === "string") time = parseInt(time, 10);
            if (time > 1000000000000) time = Math.floor(time / 1000);

            if (time > now || time < 1262304000) {
              time = now - (rawData.ts.length - index) * 60;
            }

            return {
              time,
              open: rawData.o[index] || 0,
              high: rawData.h[index] || 0,
              low: rawData.l[index] || 0,
              close: rawData.c[index] || 0,
              value: rawData.c[index] || 0,
            };
          })
          .filter(
            (item) =>
              item.open > 0 && 
              item.high > 0 && 
              item.low > 0 && 
              item.close > 0
          )
          .sort((a, b) => a.time - b.time);
        
        // Store all data for panning, but only show last 3 hours initially
        const allFormattedData = formattedData;
        const visibleData = formattedData.filter(item => item.time >= threeHoursAgo);

        console.log("📈 Formatted data:", {
          totalLength: allFormattedData.length,
          visibleLength: visibleData.length,
          firstCandle: allFormattedData[0],
          lastCandle: allFormattedData[allFormattedData.length - 1],
        });

        if (allFormattedData.length > 0) {
          // Set all data (for panning history)
          if (chartType === "line") {
            const lineData = allFormattedData.map((item) => ({
              time: item.time,
              value: item.close,
            }));
            newSeries.setData(lineData);
            console.log("📊 Line data set successfully:", lineData.length, "points");
          } else {
            newSeries.setData(allFormattedData);
            console.log("📊 OHLC data set successfully:", allFormattedData.length, "candles");
          }
          
          // Set visible range to last 3 hours
          if (visibleData.length > 0) {
            const from = visibleData[0].time;
            const to = visibleData[visibleData.length - 1].time + (15 * 60); // Add 15 minutes padding to the right
            chart.timeScale().setVisibleRange({ from, to });
          }
          
          // Now that both chart and data are ready
          console.log("✅ Chart is ready with data");
          setIsChartReady(true);
        } else {
          console.warn("❌ No valid candles after formatting");
          // Even if no data, mark as ready so chart can render empty
          setIsChartReady(true);
        }
      } catch (error) {
        console.error("Error formatting historical data:", error);
      }
    } else {
      console.log("No history response or data:", {
        hasResponse: !!historyResponse,
        success: historyResponse?.success,
        hasData: !!historyResponse?.data,
        hasHistory: !!historyResponse?.data?.history,
        historyError,
        isLoadingHistory,
      });
      
      // If we're still loading, don't mark as ready yet
      if (isLoadingHistory) {
        console.log("⏳ Still loading history data...");
        return;
      }
      
      // If we have a chart but no history data, still mark as ready
      // This handles cases where the API call fails or returns no data
      if (chart && seriesRef.current) {
        console.log("⚠️ No history data, but marking chart as ready");
        setIsChartReady(true);
      }
    }
  }, [feedId, chartType, historyResponse, historyError, isLoadingHistory]);

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
  }, [isChartReady]);

  if (!feedId) {
    return (
      <PanelWrapper>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 flex-shrink-0 bg-background/95 backdrop-blur-md relative h-[60px] flex items-center justify-between">
            {/* Left: Logo and Token Pair Selector */}
            <div className="flex items-center gap-8">
              <img
                src="/logo.svg"
                alt="1edge"
                className="h-[36px] w-[90px] object-contain brightness-110 contrast-125"
              />

              {/* Token Pair Selector with Icons */}
              <Select value={feedId || ""} onValueChange={onFeedSelect}>
                <SelectTrigger className="flex items-center gap-3 px-4 py-2 !bg-slate-800 !text-primary !border-0 shadow-sm hover:!bg-slate-700 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 rounded-xl w-auto cursor-pointer font-semibold">
                  <SelectValue>
                    <span className="text-slate-400">Select Token Pair</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-black/95 backdrop-blur-xl border-primary/25 shadow-2xl max-h-60 overflow-y-auto">
                  {feedsResponse?.success &&
                    feedsResponse.data?.map((feed: any) => {
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
                                className="w-5 h-5 rounded-full border border-primary/15"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                              <img
                                src={`/${feedParsed.quote.toLowerCase()}.svg`}
                                alt={feedParsed.quote}
                                className="w-5 h-5 rounded-full border border-primary/15 -ml-2"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            </div>
                            <span className="font-mono font-semibold">
                              {feedParsed.base}/{feedParsed.quote}
                            </span>
                            {feedParsed.tags
                              .filter((tag) => tag !== "agg")
                              .map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs h-4 px-1 bg-primary/20 border-primary/25 text-primary"
                                >
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

            <div className="flex-1" />

            {/* Right: Chart Type and Timeframe */}
            <div className="flex items-center gap-3">
              {/* Chart Type Selector */}
              <Select
                value={chartType}
                onValueChange={(value) =>
                  setChartType(value as "candles" | "bars" | "line")
                }
              >
                <SelectTrigger
                  size="sm"
                  className="w-[120px] bg-black/70 backdrop-blur-sm border-primary/25 text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 hover:bg-black/80"
                >
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const option = CHART_TYPE_OPTIONS.find(
                          (opt) => opt.value === chartType,
                        );
                        const IconComponent = option?.icon;
                        return (
                          <>
                            {IconComponent && (
                              <IconComponent className="w-5 h-5" />
                            )}
                            <span className="hidden sm:inline">
                              {option?.label}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-black/95 backdrop-blur-xl border-primary/25 shadow-2xl">
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
                <SelectTrigger
                  size="sm"
                  className="w-[80px] bg-black/70 backdrop-blur-sm border-primary/25 text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 hover:bg-black/80"
                >
                  <SelectValue>
                    {
                      TIMEFRAME_OPTIONS.find((opt) => opt.value === timeframe)
                        ?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-black/95 backdrop-blur-xl border-primary/25 shadow-2xl">
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
        </div>
      </PanelWrapper>
    );
  }

  // Parse feed symbol for display
  const parsedSymbol = feedId
    ? parseFeedSymbol(feedId)
    : { main: "", tags: [], base: "", quote: "" };
  const latestPrice = realtimePrice?.mid
    ? roundSig
      ? roundSig(realtimePrice.mid, 6).toLocaleString()
      : realtimePrice.mid.toFixed(6)
    : apiResponse?.success && apiResponse.data?.last?.mid
      ? roundSig
        ? roundSig(apiResponse.data.last.mid, 6).toLocaleString()
        : apiResponse.data.last.mid.toFixed(6)
      : "-";

  // Display enhanced index data if available
  const indexMetrics = realtimePrice
    ? {
        velocity: realtimePrice.velocity
          ? roundSig
            ? roundSig(realtimePrice.velocity, 2).toLocaleString()
            : realtimePrice.velocity.toFixed(2)
          : "0",
        dispersion: realtimePrice.dispersion
          ? `${roundSig ? roundSig(realtimePrice.dispersion, 2).toLocaleString() : realtimePrice.dispersion.toFixed(2)}%`
          : "0%",
        vbid: realtimePrice.vbid
          ? roundSig
            ? roundSig(realtimePrice.vbid, 2).toLocaleString()
            : realtimePrice.vbid.toFixed(2)
          : "0",
        vask: realtimePrice.vask
          ? roundSig
            ? roundSig(realtimePrice.vask, 2).toLocaleString()
            : realtimePrice.vask.toFixed(2)
          : "0",
      }
    : null;

  return (
    <PanelWrapper>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 flex-shrink-0 relative h-[60px] flex items-center justify-between">
          {/* Left: Logo and Token Pair Selector */}
          <div className="flex items-center gap-2">
            <img
              src="/logo.svg"
              alt="1edge"
              className="h-[36px] w-[90px] object-contain brightness-110 contrast-125"
            />

            {/* Token Pair Selector with Icons */}
            <Select value={feedId || ""} onValueChange={onFeedSelect}>
              <SelectTrigger className="flex items-center gap-3 px-4 py-2 !bg-slate-800 !text-primary !border-0 shadow-sm hover:!bg-slate-700 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 rounded-xl w-auto cursor-pointer font-semibold">
                <SelectValue>
                  {feedId ? (
                    <div className="flex items-center gap-2">
                      {/* Overlapping Token Icons */}
                      <div className="flex items-center relative">
                        <img
                          src={`/${parsedSymbol.base.toLowerCase()}.svg`}
                          alt={parsedSymbol.base}
                          className="w-6 h-6 rounded-full border border-primary/15"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <img
                          src={`/${parsedSymbol.quote.toLowerCase()}.svg`}
                          alt={parsedSymbol.quote}
                          className="w-6 h-6 rounded-full border border-primary/15 -ml-2"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                      {/* Big Symbol */}
                      <div className="flex items-center gap-2">
                        <span className="text-md font-normal font-mono text-foreground">
                          {parsedSymbol.base}/{parsedSymbol.quote}
                        </span>
                        {/* Tags */}
                        {parsedSymbol.tags
                          .filter((tag) => tag !== "agg")
                          .map((tag) => (
                            <FeedTag key={tag}>{tag}</FeedTag>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400">Select Token Pair</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-primary/25 shadow-2xl max-h-60 overflow-y-auto">
                {feedsResponse?.success &&
                  feedsResponse.data?.map((feed: any) => {
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
                              className="w-5 h-5 rounded-full border border-primary/15"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <img
                              src={`/${feedParsed.quote.toLowerCase()}.svg`}
                              alt={feedParsed.quote}
                              className="w-5 h-5 rounded-full border border-primary/15 -ml-2"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                          <span className="font-mono font-semibold">
                            {feedParsed.base}/{feedParsed.quote}
                          </span>
                          {feedParsed.tags
                            .filter((tag) => tag !== "agg")
                            .map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs h-4 px-1 bg-primary/20 border-primary/25 text-primary"
                              >
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
              <span className="text-xl font-mono font-bold text-primary">
                {latestPrice}
              </span>
            </div>
          )}

          {/* Right: Chart Type and Timeframe */}
          <div className="flex items-center gap-3">
            {/* Chart Type Selector */}
            <Select
              value={chartType}
              onValueChange={(value) =>
                setChartType(value as "candles" | "bars" | "line")
              }
            >
              <SelectTrigger
                size="sm"
                className="w-[120px] bg-black/70 backdrop-blur-sm border-primary/25 text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 hover:bg-black/80"
              >
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const option = CHART_TYPE_OPTIONS.find(
                        (opt) => opt.value === chartType,
                      );
                      const IconComponent = option?.icon;
                      return (
                        <>
                          {IconComponent && (
                            <IconComponent className="w-5 h-5" />
                          )}
                          <span className="hidden sm:inline">
                            {option?.label}
                          </span>
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
              <SelectTrigger
                size="sm"
                className="w-[80px] bg-black/70 backdrop-blur-sm border-primary/25 text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 hover:bg-black/80"
              >
                <SelectValue>
                  {
                    TIMEFRAME_OPTIONS.find((opt) => opt.value === timeframe)
                      ?.label
                  }
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

        {/* Chart Container */}
        <div className="flex-1 w-full relative">
          <div
            ref={chartContainerRef}
            className="w-full h-full"
            style={{ minHeight: "400px", borderRadius: "0" }}
          >
            {feedId && (error || historyError) && (
              <div className="p-4">
                <div className="p-3 bg-red-500/10 border border-red-500/50 backdrop-blur-sm">
                  <p className="text-red-400 text-sm flex items-center gap-2">
                    <div className="w-1 h-1 bg-red-400"></div>
                    Error loading chart:{" "}
                    {error?.message || historyError?.message}
                  </p>
                </div>
              </div>
            )}

            {(!isChartReady || isLoadingHistory) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                <div className="text-slate-400 text-sm">
                  {isLoadingHistory ? "Loading historical data..." : "Initializing chart..."}
                </div>
              </div>
            )}
          </div>

          {/* Stats Overlay - Top Left */}
          {feedId && (
            <div className="absolute top-2 left-2 z-10 space-y-1 text-xs font-mono bg-black/50 backdrop-blur-sm rounded px-2 py-1">
              {/* OHLC Values */}
              <div className="flex items-center gap-4">
                <span className="text-slate-400">
                  O:{" "}
                  <span className="text-slate-300">
                    {realtimePrice?.open
                      ? roundSig
                        ? roundSig(realtimePrice.open, 6).toLocaleString()
                        : realtimePrice.open.toFixed(6)
                      : "-"}
                  </span>
                </span>
                <span className="text-slate-400">
                  H:{" "}
                  <span className="text-slate-300">
                    {realtimePrice?.high
                      ? roundSig
                        ? roundSig(realtimePrice.high, 6).toLocaleString()
                        : realtimePrice.high.toFixed(6)
                      : "-"}
                  </span>
                </span>
                <span className="text-slate-400">
                  L:{" "}
                  <span className="text-slate-300">
                    {realtimePrice?.low
                      ? roundSig
                        ? roundSig(realtimePrice.low, 6).toLocaleString()
                        : realtimePrice.low.toFixed(6)
                      : "-"}
                  </span>
                </span>
                <span className="text-slate-400">
                  C:{" "}
                  <span className="text-slate-300">
                    {realtimePrice?.close
                      ? roundSig
                        ? roundSig(realtimePrice.close, 6).toLocaleString()
                        : realtimePrice.close.toFixed(6)
                      : "-"}
                  </span>
                </span>
              </div>
              {/* Velocity and Spread */}
              {indexMetrics && (
                <div className="flex items-center gap-4">
                  <span className="text-slate-400">
                    Velocity:{" "}
                    <span className="text-slate-300">
                      {indexMetrics.velocity}
                    </span>
                  </span>
                  <span className="text-slate-400">
                    Spread:{" "}
                    <span className="text-yellow-500">
                      {indexMetrics.dispersion}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Status indicator positioned at bottom right */}
          <div className="absolute bottom-4 right-4 z-10">
            <StatusIndicator />
          </div>
        </div>
      </div>
    </PanelWrapper>
  );
}
