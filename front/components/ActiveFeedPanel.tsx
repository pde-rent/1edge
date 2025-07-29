// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries, BarSeries, LineSeries } from 'lightweight-charts';
import { fetcher } from '../utils/fetcher';
import { useWebSocketContext } from '../contexts/WebSocketContext';
// Use path aliases
import { API_URL, THEME } from '@common/constants';
import type { TickerFeed, ApiResponse } from '@common/types';
import { Typography, Box, Chip, TableCell, ToggleButtonGroup, ToggleButton } from '@mui/material';
import PanelHeader from './common/PanelHeader';
import { useTheme } from '@mui/material/styles';
import { roundSig } from '@common/utils';
// import { formatPrice } from '../lib/utils';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';

interface ActiveFeedPanelProps {
  feedId: string | null;
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
  if (parts.length === 1 && parts[0].includes('-')){
    // e.g. BTC-USD -> main: BTC-USD, tags: [] (could be from coinbase, treat as main)
    return { main: parts[0], tags: [] };
  }
  // Default fallback if parsing fails or format is unexpected
  return { main: symbol, tags: [] };
}

/**
 * Renders a tag chip for a feed symbol.
 * @param children - The tag content.
 */
function FeedTag({ children }: { children: React.ReactNode }) {
  return (
    <Chip
      label={children}
      size="small"
      variant="outlined"
      sx={{
        ml: 0.5,
        textTransform: 'uppercase',
        fontWeight: 500,
        fontSize: '0.8rem',
        height: '20px'
      }}
    />
  );
}

/**
 * ActiveFeedPanel displays a chart and info for a selected feed.
 * @param feedId - The feed symbol to display.
 */
export default function ActiveFeedPanel({ feedId }: ActiveFeedPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const theme = useTheme();
  const [chartType, setChartType] = useState<'candles' | 'bars' | 'line'>('candles');
  const [realtimePrice, setRealtimePrice] = useState(null);
  const [timeframe, setTimeframe] = useState(20); // Default 20 seconds
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

  const { subscribe, unsubscribe, isConnected } = useWebSocketContext();

  // WebSocket for real-time updates
  useEffect(() => {
    if (feedId && isConnected) {
      const handleMessage = (message) => {
        if (message.type === 'price_update' && message.symbol === feedId) {
          const priceData = message.data;
          setRealtimePrice(priceData);
          
          if (priceData.mid && seriesRef.current) {
            const currentTime = Math.floor(Date.now() / 1000);
            const candleTime = Math.floor(currentTime / timeframe) * timeframe;
            
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
          textColor: THEME.text.primary,
          fontFamily: 'inherit',
          fontSize: 16,
          attributionLogo: false,
        },
        grid: { vertLines: { color: THEME.grey[600] }, horzLines: { color: THEME.grey[600] } },
        timeScale: { borderColor: THEME.grey[500], timeVisible: true, secondsVisible: true, rightOffset: 5 },
        autoSize: true,
        localization: {
          priceFormatter: price => roundSig(price, 6).toLocaleString(undefined),
        },
        crosshair: {
          vertLine: {
            labelBackgroundColor: theme.palette.background.paper,
          },
          horzLine: {
            labelBackgroundColor: theme.palette.background.paper,
          },
        },
        watermark: {
          visible: true,
          color: THEME.background.overlay30,
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

    // Create new series
    let newSeries;
    if (chartType === 'candles') {
      newSeries = chart.addSeries(CandlestickSeries, {
        upColor: THEME.primary,
        downColor: THEME.secondary,
        borderDownColor: THEME.secondary,
        borderUpColor: THEME.primary,
        wickDownColor: THEME.secondary,
        wickUpColor: THEME.primary,
      });
    } else if (chartType === 'bars') {
      newSeries = chart.addSeries(BarSeries, {
        upColor: THEME.primary,
        downColor: THEME.secondary,
        thinBars: false,
      });
    } else {
      newSeries = chart.addSeries(LineSeries, {
        color: THEME.primary,
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
      <Box sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Box sx={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Typography color="text.secondary">
            Select a feed to view chart.
          </Typography>
        </Box>
      </Box>
    );
  }

  // Handle chart type change
  const handleChartTypeChange = (event: React.MouseEvent<HTMLElement>, newChartType: 'candles' | 'bars' | 'line') => {
    if (newChartType !== null) {
      setChartType(newChartType);
    }
  };

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
    <Box sx={{
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {feedId && (
        <Box sx={{
          px: 2,
          py: 1,
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${THEME.background.overlay10}`,
          backgroundColor: THEME.background.paper
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 500,
                fontSize: '1.1rem'
              }}
            >
              {parsedSymbol.main}
            </Typography>
            {parsedSymbol.tags.map(tag => (
              <FeedTag key={tag}>{tag}</FeedTag>
            ))}
            <Typography
              variant="body1"
              sx={{
                ml: 2,
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                fontWeight: 600
              }}
            >
              {latestPrice}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <ToggleButtonGroup
              value={chartType}
              variant="outlined"
              exclusive
              onChange={handleChartTypeChange}
              aria-label="chart type"
              size="small"
              sx={{
                border: `1px solid ${THEME.background.overlay10}`,
                borderRadius: '4px',
                overflow: 'hidden',
                '& .MuiToggleButtonGroup-grouped': {
                  border: 'none',
                  px: 1,
                  '&.Mui-selected': {
                    color: theme.palette.secondary.main,
                    backgroundColor: THEME.background.overlay05,
                  },
                }
              }}
            >
              <ToggleButton value="candles" aria-label="candlestick chart">
                <CandlestickChartIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="bars" aria-label="bar chart">
                <BarChartIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="line" aria-label="line chart">
                <ShowChartIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            
            <ToggleButtonGroup
              value={timeframe}
              variant="outlined"
              exclusive
              onChange={(event, newTimeframe) => {
                if (newTimeframe !== null) {
                  setTimeframe(newTimeframe);
                  tickBufferRef.current = {}; // Clear buffer on timeframe change
                }
              }}
              aria-label="timeframe"
              size="small"
              sx={{
                border: `1px solid ${THEME.background.overlay10}`,
                borderRadius: '4px',
                overflow: 'hidden',
                '& .MuiToggleButtonGroup-grouped': {
                  border: 'none',
                  px: 1,
                  fontSize: '0.75rem',
                  '&.Mui-selected': {
                    color: theme.palette.secondary.main,
                    backgroundColor: THEME.background.overlay05,
                  },
                }
              }}
            >
              <ToggleButton value={5} aria-label="5 seconds">5s</ToggleButton>
              <ToggleButton value={20} aria-label="20 seconds">20s</ToggleButton>
              <ToggleButton value={60} aria-label="1 minute">1m</ToggleButton>
              <ToggleButton value={300} aria-label="5 minutes">5m</ToggleButton>
              <ToggleButton value={1800} aria-label="30 minutes">30m</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      )}

      <Box
        sx={{
          flexGrow: 1,
          width: '100%',
          position: 'relative',
          height: feedId ? 'calc(100% - 40px)' : '100%', // Adjust height to account for header only
          minHeight: '150px',
        }}
      >
        <Box
          ref={chartContainerRef}
          sx={{
            width: '100%',
            minHeight: '400px',
            height: '100%',
          }}
        >
          {feedId && error && (
            <Typography color="error" sx={{ px: 2 }}>
              Error loading chart: {error.message}
            </Typography>
          )}
        </Box>
        
        {/* Floating metrics overlay */}
        {feedId && indexMetrics && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              left: 10,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              lineHeight: 1.4,
              zIndex: 1000,
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              minWidth: '120px'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <span style={{ color: '#888' }}>Vol Bid:</span>
              <span>{indexMetrics.vbid}</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <span style={{ color: '#888' }}>Vol Ask:</span>
              <span>{indexMetrics.vask}</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <span style={{ color: '#888' }}>Velocity:</span>
              <span style={{ color: '#4CAF50' }}>{indexMetrics.velocity}</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Dispersion:</span>
              <span style={{ color: '#FF9800' }}>{indexMetrics.dispersion}</span>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
