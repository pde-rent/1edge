// @ts-nocheck
import useSWR from 'swr';
import { fetcher } from '../utils/fetcher';
import { useWebSocketContext } from '../contexts/WebSocketContext';
// import styled from 'styled-components'; // No longer needed for PanelContainer and Title
import { useState, useEffect } from 'react';
import { BaseSection } from './common/LayoutPrimitives';
import { Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper, Chip, Typography, Box } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import LayersIcon from '@mui/icons-material/Layers';
import PanelHeader from './common/PanelHeader';
import { roundSig, formatPrice } from '../lib/utils';
import InfoTooltip from './common/InfoTooltip';
import { useTheme } from '@mui/material/styles';

// const PanelContainer = styled.section` // Removed
// width: 100%;
// height: 100%;
// overflow: auto;
// display: flex;
// flex-direction: column;
// `;

// const Title = styled.h2` // Removed
// margin: 0 0 10px 0;
// font-size: 1.2rem;
// padding-bottom: 5px;
// border-bottom: 1px solid #444;
// `;

// Keep StyledTable, ErrorMessage, LoadingMessage as they are specific to FeedsList or general utility styled components
// import styled from 'styled-components'; // Keep for other styled components if any, or remove if not used elsewhere in this file

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
        fontSize: '0.7rem',
        height: '16px'
      }}
    />
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
  const theme = useTheme();
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
      <BaseSection>
        <Typography color="error">Error loading feeds: {error.message}</Typography>
      </BaseSection>
    );

  if (feedsToDisplay.length === 0 && isValidating)
    return (
      <BaseSection>
        <Typography color="text.secondary">Loading feeds...</Typography>
      </BaseSection>
    );

  if (feedsToDisplay.length === 0 && !isValidating && !error)
    return (
      <BaseSection>
        <Typography color="text.secondary">No feeds available.</Typography>
      </BaseSection>
    );

  if (apiResponse && !apiResponse.success && feedsToDisplay.length === 0) {
    return (
      <BaseSection>
        <Typography color="error">Error: {apiResponse.error || 'Failed to fetch feeds'}</Typography>
      </BaseSection>
    );
  }

  return (
    <BaseSection sx={{ p: 0 }}>
      {isValidating && feedsToDisplay.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', top: 5, right: 8 }}>
          Updating...
        </Typography>
      )}

      <TableContainer elevation={0} sx={{ maxHeight: '100%', width: '100%' }}>
        <Table
          size="small"
          stickyHeader
          className="table"
        >
          <TableHead>
            <TableRow>
              <TableCell
                align="left"
                sx={{
                  py: 1,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  width: '50%',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Feed
                  <InfoTooltip title="Collected feeds, raw or aggregated, used by strategies" placement="right" />
                </Box>
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  py: 1,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  width: '25%',
                }}
              >
                Spread
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  py: 1,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  width: '25%',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                  Mid
                  <ArrowUpwardIcon fontSize="inherit" />
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
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
                <TableRow
                  key={feed.symbol}
                  onClick={() => onSelect(feed.symbol)}
                  title={`Select ${feed.symbol}`}
                  hover
                  selected={isSelected}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: isSelected 
                      ? 'rgba(255, 140, 0, 0.15)' // Dark orange shade with transparency
                      : 'transparent',
                    borderLeft: isSelected ? '3px solid #ff8c00' : '3px solid transparent',
                    '&:hover': {
                      backgroundColor: isSelected 
                        ? 'rgba(255, 140, 0, 0.25)' 
                        : theme.palette.action.hover,
                    },
                  }}
                >
                  <TableCell align="left" sx={{ whiteSpace: 'nowrap', py: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography component="span" variant="body2">{parsed.main}</Typography>
                      {parsed.tags.map(tag => <FeedTag key={tag}>{tag}</FeedTag>)}
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Typography variant="caption" color="text.secondary">
                        {relativeSpread}
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {absSpread}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.5, textAlign: 'right' }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {formatMidValue(midPrice)}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </BaseSection>
  );
}
