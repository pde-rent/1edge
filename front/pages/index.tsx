// @ts-nocheck
import { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
// import styled, { createGlobalStyle } from 'styled-components'; // REMOVED
import AppInfoPanel from '../components/AppInfoPanel';
import FeedsPanel from '../components/FeedsPanel';
import ActiveFeedPanel from '../components/ActiveFeedPanel';
// import ConfigPanel from '../components/ConfigPanel'; // Hidden from dashboard
import OrderBookPanel from '../components/OrderBookPanel';
import StatusPanel from '../components/StatusPanel';
import PositionsPanel from '../components/PositionsPanel';
import useSWR from 'swr'; // Added for fetching feeds
import { fetcher } from '../utils/fetcher'; // Added for fetching feeds
import type { ApiResponse } from '@common/types'; // Use path alias
import { Paper } from '@mui/material';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { GRID_CONFIG } from '@common/constants';

// Add custom styles to override RGL defaults
import Head from 'next/head';

const ResponsiveGridLayout = WidthProvider(Responsive);

// REMOVED GlobalStyle
// REMOVED GridItemContainer styled.div

/**
 * Home page for the trading bot dashboard.
 * Displays the main grid layout and all major panels.
 */
export default function Home() {
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [isLayoutLocked, setIsLayoutLocked] = useState(true);
  const [mounted, setMounted] = useState(false); // For preventing SSR layout issues with RGL
  // Dynamic grid sizing based on viewport height and current breakpoint
  const [windowHeight, setWindowHeight] = useState(0);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowHeight(window.innerHeight);
      const handleResize = () => setWindowHeight(window.innerHeight);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  const [breakpoint, setBreakpoint] = useState<'lg'|'md'|'sm'|'xs'|'xxs'>('lg');
  const handleBreakpoint = (newBreakpoint: string) => setBreakpoint(newBreakpoint as any);
  const totalRows = GRID_CONFIG.totalRowsMap[breakpoint] || GRID_CONFIG.totalRowsMap.lg;
  const rowHeight = mounted && windowHeight > 0
    ? (windowHeight - 2 * GRID_CONFIG.containerPadding[1] - (totalRows - 1) * GRID_CONFIG.margin[1]) / totalRows
    : 20;

  // Fetch feeds data
  const { data: feedsResponse } = useSWR<ApiResponse<any[]>>('/api/feeds', fetcher);

  // Use imported grid initial layouts
  const [currentLayouts, setCurrentLayouts] = useState(GRID_CONFIG.initialLayouts);

  // Load custom layout from localStorage if exists
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('customLayouts');
      if (saved) {
        try {
          setCurrentLayouts(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse custom layouts', e);
        }
      }
    }
  }, []);

  // Handlers for saving and loading layouts
  const handleSaveLayout = () => {
    try {
      localStorage.setItem('customLayouts', JSON.stringify(currentLayouts));
    } catch (e) {
      console.error('Failed to save custom layouts', e);
    }
  };

  const handleLoadLayout = () => {
    const saved = localStorage.getItem('customLayouts');
    if (saved) {
      try {
        setCurrentLayouts(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load custom layouts', e);
      }
    }
  };

  useEffect(() => {
    setMounted(true); // Ensure RGL calculates layout client-side
  }, []);

  useEffect(() => {
    // Set BTCUSDC as default selected feed, fallback to first feed
    // Only run when feedsResponse changes, not when selectedFeed changes
    if (feedsResponse?.success && feedsResponse.data && feedsResponse.data.length > 0 && selectedFeed === null) {
      // Look for BTCUSDC first
      const btcFeed = feedsResponse.data.find(feed => 
        feed.symbol && feed.symbol.includes('BTCUSDC')
      );
      
      if (btcFeed && btcFeed.symbol) {
        setSelectedFeed(btcFeed.symbol);
      } else {
        // Fallback to first feed if BTCUSDC not found
        const firstFeed = feedsResponse.data[0];
        if (firstFeed && firstFeed.symbol) {
          setSelectedFeed(firstFeed.symbol);
        }
      }
    }
  }, [feedsResponse]);

  const handleLayoutChange = (layout, allLayouts) => {
    // Only update if mounted to avoid SSR mismatch
    if (mounted) {
      setCurrentLayouts(allLayouts);
      // Automatically save layout changes
      try {
        localStorage.setItem('customLayouts', JSON.stringify(allLayouts));
      } catch (e) {
        console.error('Failed to auto-save layout', e);
      }
    }
  };

  const handleResetLayout = () => setCurrentLayouts(GRID_CONFIG.initialLayouts);

  // Prevent RGL from rendering on server to avoid layout mismatch
  if (!mounted) {
    return null;
  }

  // Style for the content containers
  const paperStyle = {
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };
  // Grid item container style
  const gridItemStyle = { height: '100%', width: '100%', overflow: 'hidden' };

  return (
    <>
      <Head>
        {/* Custom CSS for resizable corners and dividers */}
        <style type="text/css">{`
          /* Make grid items fill available space */
          .react-grid-layout {
            width: 100% !important;
            height: 100vh;
          }

          /* Allow resizing from all corners */
          .react-resizable-handle {
            visibility: ${isLayoutLocked ? 'hidden' : 'visible'};
          }

          /* Bottom left corner resize handle */
          .react-resizable-handle-sw {
            bottom: 0;
            left: 0;
            cursor: sw-resize;
            transform: rotate(90deg);
          }

          /* Top right corner resize handle */
          .react-resizable-handle-ne {
            top: 0;
            right: 0;
            cursor: ne-resize;
            transform: rotate(90deg);
          }

          /* Top left corner resize handle */
          .react-resizable-handle-nw {
            top: 0;
            left: 0;
            cursor: nw-resize;
            transform: rotate(180deg);
          }

          /* Adjust the standard resize handle appearance */
          .react-resizable-handle-se {
            visibility: ${isLayoutLocked ? 'hidden' : 'visible'};
          }

          /* Create draggable dividers between grid items */
          .react-grid-item {
            position: relative;
          }

          /* Horizontal divider (appears at the bottom of each item) */
          .react-grid-item::after {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 0;
            right: 0;
            height: 10px;
            cursor: ns-resize;
            z-index: 10;
            visibility: ${isLayoutLocked ? 'hidden' : 'visible'};
          }

          /* Vertical divider (appears at the right side of each item) */
          .react-grid-item::before {
            content: '';
            position: absolute;
            right: -5px;
            top: 0;
            bottom: 0;
            width: 10px;
            cursor: ew-resize;
            z-index: 10;
            visibility: ${isLayoutLocked ? 'hidden' : 'visible'};
          }

          /* Only show dividers when unlocked */
          .react-grid-item:hover::before,
          .react-grid-item:hover::after {
            background-color: rgba(15, 255, 255, 0.15);
          }

          /* When layout is locked, make sure mouse cursor is normal */
          ${isLayoutLocked ? `
            .react-grid-item::before,
            .react-grid-item::after {
              cursor: default;
              pointer-events: none;
            }
          ` : ''}
        `}</style>
      </Head>
      <ResponsiveGridLayout
        className="layout"
        layouts={currentLayouts}
        onLayoutChange={handleLayoutChange}
        onBreakpointChange={handleBreakpoint}
        isDraggable={!isLayoutLocked}
        isResizable={!isLayoutLocked}
        breakpoints={GRID_CONFIG.breakpoints}
        cols={GRID_CONFIG.columns}
        margin={GRID_CONFIG.margin}
        containerPadding={GRID_CONFIG.containerPadding}
        resizeHandles={GRID_CONFIG.resizeHandles}
        rowHeight={rowHeight} // dynamic rowHeight based on viewport
        autoSize={true} // Make sure it fills the available space
        verticalCompact={true} // Ensure layout is compact
        compactType="vertical" // Changed to vertical to make adjacent panels stack properly
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        droppingItem={{ i: 'new-item', w: 2, h: 4 }} // This helps with dragactivity
      >
        <div key="appInfo" style={gridItemStyle}>
          <AppInfoPanel
            isLocked={isLayoutLocked}
            onToggleLock={() => setIsLayoutLocked(!isLayoutLocked)}
            onResetLayout={handleResetLayout}
            onLoadLayout={handleLoadLayout}
          />
        </div>
        <div key="feeds" style={gridItemStyle}>
          <Paper sx={paperStyle} elevation={2}>
            <FeedsPanel onSelect={setSelectedFeed} />
          </Paper>
        </div>
        <div key="activeFeed" style={gridItemStyle}>
          <Paper sx={paperStyle} elevation={2}>
            <ActiveFeedPanel feedId={selectedFeed} />
          </Paper>
        </div>
        <div key="config" style={gridItemStyle}>
          <Paper sx={paperStyle} elevation={2}>
            <OrderBookPanel selectedFeed={selectedFeed} />
          </Paper>
        </div>
        <div key="services" style={gridItemStyle}>
          <Paper sx={paperStyle} elevation={2}>
            <StatusPanel />
          </Paper>
        </div>
        <div key="positions" style={gridItemStyle}>
          <Paper sx={paperStyle} elevation={2}>
            <PositionsPanel />
          </Paper>
        </div>
      </ResponsiveGridLayout>
    </>
  );
}