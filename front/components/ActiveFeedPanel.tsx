// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries, BarSeries, LineSeries } from 'lightweight-charts';
import { fetcher } from '../utils/fetcher';
import { useWebSocket } from '../utils/useWebSocket';
// Use path aliases
import { API_URL, THEME } from '@common/constants';
import type { TickerFeed, ApiResponse } from '@common/types';
import { Typography, Box, Chip, TableCell, ToggleButtonGroup, ToggleButton } from '@mui/material';
import PanelHeader from './common/PanelHeader';
import { useTheme } from '@mui/material/styles';
import { roundSig } from '@common/utils';
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
  const [chartData, setChartData] = useState(null);
  const [realtimePrice, setRealtimePrice] = useState(null);

  const { data: apiResponse, error } = useSWR<ApiResponse<TickerFeed>>(
    feedId ? `/api/feeds/${feedId}` : null,
    fetcher,
    { refreshInterval: 5000 } // Reduced frequency since we use WebSocket for real-time
  );

  // WebSocket connection for real-time price updates
  const { subscribe, unsubscribe, isConnected } = useWebSocket('ws://localhost:40007/ws', {
    onMessage: (message) => {
      if (message.type === 'price_update' && message.symbol === feedId) {
        setRealtimePrice(message.data);
      }
    },
    onConnect: () => {
      console.log('Connected to 1edge WebSocket');
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    }
  });

  // Subscribe to price updates when feedId changes
  useEffect(() => {
    if (feedId && isConnected) {
      subscribe([feedId]);
      return () => {
        unsubscribe([feedId]);
      };
    }
  }, [feedId, isConnected, subscribe, unsubscribe]);

  // Parse and format API data
  useEffect(() => {
    if (apiResponse?.success && apiResponse.data && apiResponse.data.history && apiResponse.data.history.ts) {
      const rawData = apiResponse.data.history;

      const formattedData = rawData.ts.map((timestamp, index) => {
        // Improved timestamp handling
        let time = timestamp;

        // Convert to number if it's a string
        if (typeof time === 'string') {
          time = parseInt(time, 10);
        }

        // If timestamp is in milliseconds (13 digits), convert to seconds (10 digits)
        if (time > 1000000000000) {
          time = Math.floor(time / 1000);
        }

        // Get current time in seconds
        const now = Math.floor(Date.now() / 1000);

        // If timestamp is in the future or unreasonably old (before 2010), adjust it
        if (time > now || time < 1262304000) { // 1262304000 = Jan 1, 2010
          // Use current time minus offset based on index
          time = now - (index * 60); // 60-second intervals
        }

        return {
          time,
          open: rawData.o[index],
          high: rawData.h[index],
          low: rawData.l[index],
          close: rawData.c[index],
          value: rawData.c[index], // Used for line chart
        };
      });

      // Sort by time to ensure proper ordering
      formattedData.sort((a, b) => (a.time as number) - (b.time as number));

      setChartData(formattedData);
    }
  }, [apiResponse]);

  // Create chart when container is ready
  useEffect(() => {
    if (feedId && chartContainerRef.current && !chartRef.current) {
      const container = chartContainerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight || 300;

      const chart = createChart(container, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: THEME.text.primary,
          fontFamily: 'inherit',
          fontSize: 16,
          attributionLogo: false, // Remove TradingView watermark
        },
        grid: { vertLines: { color: THEME.grey[600] }, horzLines: { color: THEME.grey[600] } },
        timeScale: { borderColor: THEME.grey[500], timeVisible: true, secondsVisible: true, rightOffset: 0, fixRightEdge: true },
        autoSize: true, // Enable auto-sizing
        localization: {
          priceFormatter: price => roundSig(price, 6).toLocaleString(undefined),
        },
        crosshair: {
          vertLine: {
            labelBackgroundColor: theme.palette.background.paper,
            labelBorderColor: theme.palette.background.paper,
            labelTextColor: theme.palette.text.primary,
          },
          horzLine: {
            labelBackgroundColor: theme.palette.background.paper,
            labelBorderColor: theme.palette.background.paper,
            labelTextColor: theme.palette.text.primary,
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
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [feedId, theme.palette.background.paper]);

  // Update chart series when chart type changes
  useEffect(() => {
    const chart = chartRef.current;
    if (chart && chartType) {
      // Remove existing series if any
      if (seriesRef.current) {
        chart.removeSeries(seriesRef.current);
        seriesRef.current = null;
      }

      // Add appropriate series based on chart type
      if (chartType === 'candles') {
        seriesRef.current = chart.addSeries(CandlestickSeries, {
          upColor: THEME.primary,
          downColor: THEME.secondary,
          borderDownColor: THEME.secondary,
          borderUpColor: THEME.primary,
          wickDownColor: THEME.secondary,
          wickUpColor: THEME.primary,
        });
      } else if (chartType === 'bars') {
        seriesRef.current = chart.addSeries(BarSeries, {
          upColor: THEME.primary,
          downColor: THEME.secondary,
          thinBars: false,
        });
      } else if (chartType === 'line') {
        seriesRef.current = chart.addSeries(LineSeries, {
          color: THEME.primary,
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          lastValueVisible: true,
        });
      }

      // Add data to the new series if available
      if (chartData && seriesRef.current) {
        if (chartType === 'line') {
          // For line chart, we need to transform the data to include just time and value
          const lineData = chartData.map(item => ({
            time: item.time,
            value: item.close
          }));
          seriesRef.current.setData(lineData);
        } else {
          // For candles and bars, we use the full OHLC data
          seriesRef.current.setData(chartData);
        }

        // Fit content after series change
        chart.timeScale().fitContent();
      }
    }
  }, [chartType, chartData]);

  // Resize the chart when the container size changes
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const resizeChart = () => {
      const chart = chartRef.current;
      if (!chart || !chartContainerRef.current) return;

      const container = chartContainerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width > 0 && height > 0) {
        // reapply desired font size on resize since labels are drawn on canvas
        chart.applyOptions({ layout: { fontSize: 16 } });
        chart.resize(width, height);
        chart.timeScale().fitContent();
      }
    };

    // Initial sizing
    resizeChart();

    const resizeObserver = new ResizeObserver(() => {
      resizeChart();
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [feedId]); // Re-run when feedId changes

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
    ? realtimePrice.mid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : (apiResponse?.success && apiResponse.data?.last?.mid
      ? apiResponse.data.last.mid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '-');

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
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                fontSize: '1.1rem'
              }}
            >
              {latestPrice}
            </Typography>
          </Box>

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
        </Box>
      )}

      <Box
        ref={chartContainerRef}
        sx={{
          flexGrow: 1,
          width: '100%',
          height: feedId ? 'calc(100% - 40px)' : '100%', // Adjust height to account for header only
          minHeight: '150px',
        }}
      >
        {feedId && error && (
          <Typography color="error" sx={{ px: 2 }}>
            Error loading chart: {error.message}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
