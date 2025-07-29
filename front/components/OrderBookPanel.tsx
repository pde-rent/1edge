// @ts-nocheck
import { Paper, Typography, Box, Table, TableHead, TableRow, TableCell, TableBody, Chip, CircularProgress, ToggleButtonGroup, ToggleButton, TableContainer } from '@mui/material';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher } from '../utils/fetcher';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import PanelHeader from './common/PanelHeader';
import { THEME } from '@common/constants';
import { roundSig } from '@common/utils';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { useTheme } from '@mui/material/styles';
import type { ReconstructedOrderbook, OrderbookLevel } from '@common/types';

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
  isRemainder?: boolean; // For 10th level that encompasses all remaining depth
}

/**
 * OrderBookPanel displays the reconstructed orderbook from 1inch limit orders
 * Shows bid/ask levels with prices, amounts, and order counts
 * Refreshes every minute to show current market state
 */
// TODO: Get token addresses from backend config API instead of hardcoding
// For now, keep this minimal mapping until we implement dynamic config fetching
const TOKEN_ADDRESSES = {
  'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  'ETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Same as WETH
  'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  'BTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // Same as WBTC
  'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'USD': '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Default to USDT
  '1INCH': '0x111111111117dC0aa78b770fA6A738034120C302',
  'AAVE': '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
};

// Parse feed symbol to extract token pair
const parseFeedSymbol = (feedSymbol: string | null): { base: string; quote: string } | null => {
  if (!feedSymbol) return null;
  
  // Handle formats like "agg:spot:BTCUSD", "binance:ETHUSDT", etc.
  const parts = feedSymbol.split(':');
  let pairSymbol = parts[parts.length - 1]; // Take the last part
  
  // Common quote assets (in order of priority for matching)
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
  const [selectedChain, setSelectedChain] = useState(1); // Default to Ethereum
  const [stepSize, setStepSize] = useState(0.5); // Default to 0.5%
  const [realtimeSpotPrice, setRealtimeSpotPrice] = useState<number | null>(null);
  const theme = useTheme();
  
  const { subscribe, unsubscribe, isConnected } = useWebSocketContext();
  
  // Parse selected feed to determine token pair
  const parsedFeed = parseFeedSymbol(selectedFeed);
  const defaultPair = {
    maker: TOKEN_ADDRESSES['WETH'],
    taker: TOKEN_ADDRESSES['USDT']
  };
  
  const [selectedPair, setSelectedPair] = useState<{ maker: string; taker: string }>(defaultPair);
  
  // Update selected pair when feed changes
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
  
  // Subscribe to real-time price updates for spot price filtering
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
  
  // Construct API endpoint based on selection
  const getApiEndpoint = () => {
    if (selectedPair) {
      // Use maker as base asset and taker as quote asset for proper bid/ask separation
      return `/orderbook/${selectedChain}/${selectedPair.maker}/${selectedPair.taker}?limit=100`;
    }
    return `/orderbook/${selectedChain}?limit=100`;
  };

  const { data: orderbookResponse, error, isValidating, mutate } = useSWR(
    getApiEndpoint(),
    fetcher,
    { 
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: false,
      revalidateOnReconnect: true
    }
  );

  // Format large numbers for display
  const formatAmount = (amount: string) => {
    try {
      // Amount is already scaled by the backend, just parse and format
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

  // Format price for display
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

  // Render aggregated orderbook level row
  const renderLevel = (level: AggregatedLevel, isBid: boolean) => (
    <TableRow 
      key={level.price} 
      sx={{ 
        '&:hover': { backgroundColor: THEME.background.overlay05 },
        borderLeft: isBid ? `3px solid ${THEME.primary}` : `3px solid ${THEME.secondary}`, // Cyan for bids, orange for asks
        backgroundColor: level.isRemainder ? THEME.background.overlay05 : 'transparent'
      }}
    >
      <TableCell sx={{ py: 0.5, px: 1.5, fontSize: THEME.font.size.xs }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isBid ? <TrendingUpIcon sx={{ fontSize: 12, color: THEME.primary }} /> : <TrendingDownIcon sx={{ fontSize: 12, color: THEME.secondary }} />}
          <Typography variant="caption" sx={{ color: isBid ? THEME.primary : THEME.secondary, fontFamily: THEME.font.mono }}> {/* Use theme colors and font */}
            {level.isRemainder ? `${formatPrice(level.price.toString())}+` : formatPrice(level.price.toString())}
          </Typography>
        </Box>
      </TableCell>
      <TableCell sx={{ py: 0.5, px: 1.5, fontSize: THEME.font.size.xs, fontFamily: THEME.font.mono }}>
        {formatAmount(level.amount.toString())}
      </TableCell>
      <TableCell sx={{ py: 0.5, px: 1.5, fontSize: THEME.font.size.xs, fontFamily: THEME.font.mono }}>
        {formatAmount(level.total.toString())}
      </TableCell>
      <TableCell sx={{ py: 0.5, px: 1.5, fontSize: THEME.font.size.xs }}>
        <Chip 
          label={level.count} 
          size="small" 
          sx={{ 
            fontSize: THEME.font.size.xs, 
            height: 16, 
            backgroundColor: level.isRemainder ? THEME.primary + '20' : THEME.background.overlay10,
            color: level.isRemainder ? THEME.primary : THEME.text.secondary
          }} 
        />
      </TableCell>
    </TableRow>
  );

  // Loading state
  if (!orderbookResponse && !error) {
    return (
      <Paper elevation={1} sx={{ height: '100%', width: '100%', p: 0, display: 'flex', flexDirection: 'column' }}>
        <PanelHeader 
          title="Order Book" 
          tooltip="1inch Limit Order Protocol orderbook reconstruction. Shows aggregated bid/ask levels from active limit orders. Refreshes every minute." 
        />
        <Box sx={{ p: 2, flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <CircularProgress size={24} />
          <Typography sx={{ ml: 2 }} color="text.secondary">Loading orderbook...</Typography>
        </Box>
      </Paper>
    );
  }

  // Error state
  if (error) {
    return (
      <Paper elevation={1} sx={{ height: '100%', width: '100%', p: 0, display: 'flex', flexDirection: 'column' }}>
        <PanelHeader 
          title="Order Book" 
          tooltip="1inch Limit Order Protocol orderbook reconstruction. Shows aggregated bid/ask levels from active limit orders. Refreshes every minute." 
        />
        <Box sx={{ p: 2, flex: 1 }}>
          <Typography color="error">Error loading orderbook: {error.message}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Make sure the API server is running and the 1inch API key is configured.
          </Typography>
        </Box>
      </Paper>
    );
  }

  // API error state
  if (orderbookResponse && !orderbookResponse.success) {
    return (
      <Paper elevation={1} sx={{ height: '100%', width: '100%', p: 0, display: 'flex', flexDirection: 'column' }}>
        <PanelHeader 
          title="Order Book" 
          tooltip="1inch Limit Order Protocol orderbook reconstruction. Shows aggregated bid/ask levels from active limit orders. Refreshes every minute." 
        />
        <Box sx={{ p: 2, flex: 1 }}>
          <Typography color="error">Error: {orderbookResponse.error}</Typography>
        </Box>
      </Paper>
    );
  }

  const orderbook: ReconstructedOrderbook = orderbookResponse.data;
  const lastUpdated = new Date(orderbook.timestamp).toLocaleTimeString();
  
  // Use real-time spot price for filtering, fallback to orderbook summary
  const spotPrice = realtimeSpotPrice || orderbook.summary.spotPrice || null;
  
  // Filter out invalid orders based on spot price
  const filterInvalidOrders = (levels: OrderbookLevel[], isBid: boolean, spotPrice: number | null) => {
    if (!spotPrice) return levels;
    
    return levels.filter(level => {
      const price = parseFloat(level.price);
      if (isBid) {
        return price < spotPrice; // Bids should be below spot price
      } else {
        return price > spotPrice; // Asks should be above spot price
      }
    });
  };
  
  const validBids = filterInvalidOrders(orderbook.bids, true, spotPrice);
  const validAsks = filterInvalidOrders(orderbook.asks, false, spotPrice);
  
  // Aggregate orders into percentage-based price levels
  const aggregateOrders = (levels: OrderbookLevel[], isBid: boolean, stepPercent: number, referencePrice: number): AggregatedLevel[] => {
    if (!levels.length || !referencePrice) return [];
    
    const stepDecimal = stepPercent / 100;
    const aggregated = new Map<number, AggregatedLevel>();
    
    // Process each order into appropriate step bucket
    levels.forEach(level => {
      const price = parseFloat(level.price);
      const amount = parseFloat(level.amount);
      const count = parseInt(level.count.toString());
      
      // Calculate which step bucket this price belongs to
      let bucketPrice: number;
      if (isBid) {
        // For bids, round down to nearest step below reference price
        const stepsDown = Math.floor((referencePrice - price) / (referencePrice * stepDecimal));
        bucketPrice = referencePrice - (stepsDown * referencePrice * stepDecimal);
      } else {
        // For asks, round up to nearest step above reference price
        const stepsUp = Math.ceil((price - referencePrice) / (referencePrice * stepDecimal));
        bucketPrice = referencePrice + (stepsUp * referencePrice * stepDecimal);
      }
      
      // Add to aggregated bucket
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
    
    // Convert to array and sort
    const sortedLevels = Array.from(aggregated.values()).sort((a, b) => 
      isBid ? b.price - a.price : a.price - b.price
    );
    
    // Calculate running totals
    let runningTotal = 0;
    sortedLevels.forEach(level => {
      runningTotal += level.amount;
      level.total = runningTotal;
    });
    
    // Keep top 9 levels, aggregate the rest into 10th level
    if (sortedLevels.length > 9) {
      const topNine = sortedLevels.slice(0, 9);
      const remainder = sortedLevels.slice(9);
      
      if (remainder.length > 0) {
        const remainderLevel: AggregatedLevel = {
          price: remainder[0].price, // Use first price as representative
          amount: remainder.reduce((sum, level) => sum + level.amount, 0),
          total: topNine[topNine.length - 1].total + remainder.reduce((sum, level) => sum + level.amount, 0),
          count: remainder.reduce((sum, level) => sum + level.count, 0),
          isRemainder: true
        };
        
        return [...topNine, remainderLevel];
      }
      
      return topNine;
    }
    
    return sortedLevels;
  };
  
  const aggregatedBids = aggregateOrders(validBids, true, stepSize, spotPrice || 0);
  const aggregatedAsks = aggregateOrders(validAsks, false, stepSize, spotPrice || 0);

  return (
    <Paper elevation={1} sx={{ height: '100%', width: '100%', p: 0, display: 'flex', flexDirection: 'column' }}>
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
        <Typography variant="h6" sx={{ fontSize: THEME.font.size.base, fontWeight: THEME.font.weight.medium, color: THEME.text.primary }}> {/* Match StatusPanel header styling */}
          Order Book
        </Typography>
        <ToggleButtonGroup
          value={stepSize}
          variant="outlined"
          exclusive
          onChange={(event, newStepSize) => {
            if (newStepSize !== null) {
              setStepSize(newStepSize);
            }
          }}
          aria-label="step size"
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
          {STEP_OPTIONS.map(option => (
            <ToggleButton key={option.value} value={option.value} aria-label={option.label}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      
      {/* Summary Header */}
      <Box sx={{ p: 1, borderBottom: `1px solid ${THEME.border}`, backgroundColor: THEME.background.overlay05 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ color: THEME.text.secondary }}>
            Chain {orderbook.chain} • Last updated: {lastUpdated}
          </Typography>
          {isValidating && (
            <CircularProgress size={12} sx={{ color: THEME.text.secondary }} />
          )}
        </Box>
        
        {/* Market Summary */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Bids:</Typography>
            <Chip 
              label={orderbook.summary.totalBidOrders} 
              size="small" 
              sx={{ fontSize: THEME.font.size.xs, height: 16, backgroundColor: THEME.primary + '20', color: THEME.primary }} 
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Asks:</Typography>
            <Chip 
              label={orderbook.summary.totalAskOrders} 
              size="small" 
              sx={{ fontSize: THEME.font.size.xs, height: 16, backgroundColor: THEME.secondary + '20', color: THEME.secondary }} 
            />
          </Box>
          {orderbook.summary.spread && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Spread:</Typography>
              <Typography variant="caption" sx={{ fontFamily: THEME.font.mono, color: THEME.text.primary }}>
                {orderbook.summary.spread}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Orderbook Table - match StatusPanel table styling */}
      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        {aggregatedBids.length === 0 && aggregatedAsks.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography color="text.secondary">No active orders found</Typography>
            <Typography variant="caption" color="text.secondary">
              Try a different chain or check if there are active orders on 1inch
            </Typography>
          </Box>
        ) : (
          <Table size="small" stickyHeader className="table" sx={{ width: '100%' }}> {/* Match StatusPanel table */}
            <TableHead>
              <TableRow>
                <TableCell sx={{ 
                  py: 1, px: 1.5, 
                  fontWeight: THEME.font.weight.medium,
                  fontSize: THEME.font.size.xs,
                  textTransform: 'uppercase',
                  color: THEME.text.secondary,
                  letterSpacing: '0.5px'
                }}>Price</TableCell>
                <TableCell sx={{ 
                  py: 1, px: 1.5,
                  fontWeight: THEME.font.weight.medium,
                  fontSize: THEME.font.size.xs,
                  textTransform: 'uppercase', 
                  color: THEME.text.secondary,
                  letterSpacing: '0.5px'
                }}>Amount</TableCell>
                <TableCell sx={{ 
                  py: 1, px: 1.5,
                  fontWeight: THEME.font.weight.medium,
                  fontSize: THEME.font.size.xs,
                  textTransform: 'uppercase',
                  color: THEME.text.secondary,
                  letterSpacing: '0.5px'
                }}>Total</TableCell>
                <TableCell sx={{ 
                  py: 1, px: 1.5,
                  fontWeight: THEME.font.weight.medium,
                  fontSize: THEME.font.size.xs,
                  textTransform: 'uppercase',
                  color: THEME.text.secondary,
                  letterSpacing: '0.5px'
                }}>Orders</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Show aggregated asks (sells) in reverse order */}
              {aggregatedAsks.slice().reverse().map(level => renderLevel(level, false))}
              
              {/* Spot price and spread indicator */}
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 1, textAlign: 'center', backgroundColor: THEME.background.overlay10, borderTop: `1px solid ${THEME.border}`, borderBottom: `1px solid ${THEME.border}` }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    {spotPrice && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Spot:</Typography>
                        <Typography variant="body2" sx={{ fontFamily: THEME.font.mono, color: THEME.primary, fontWeight: THEME.font.weight.bold }}>
                          {formatPrice(spotPrice.toString())}
                        </Typography>
                      </Box>
                    )}
                    {orderbook.summary.bestBid && orderbook.summary.bestAsk && orderbook.summary.spread && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Spread:</Typography>
                        <Typography variant="caption" sx={{ fontFamily: THEME.font.mono, color: THEME.text.primary }}>
                          {orderbook.summary.spread}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
              
              {/* Show aggregated bids (buys) */}
              {aggregatedBids.map(level => renderLevel(level, true))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Footer with controls */}
      <Box sx={{ p: 1, borderTop: `1px solid ${THEME.border}`, backgroundColor: THEME.background.overlay05 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: THEME.text.secondary, fontFamily: THEME.font.mono }}>
            Showing top 10 levels per side
          </Typography>
          <Typography variant="caption" sx={{ color: THEME.text.secondary, fontFamily: THEME.font.mono }}>
            Auto-refresh: 60s • Real-time filtering: {realtimeSpotPrice ? 'ON' : 'OFF'}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}