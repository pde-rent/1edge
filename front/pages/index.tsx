// @ts-nocheck
import { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import ActiveFeedPanel from '../components/ActiveFeedPanel';
import OrderBookPanel from '../components/OrderBookPanel';
import StatusPanel from '../components/StatusPanel';
import PositionsPanel from '../components/PositionsPanel';
import useSWR from 'swr';
import { fetcher } from '../utils/fetcher';
import type { ApiResponse } from '@common/types';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { GRID_CONFIG } from '@common/constants';

import Head from 'next/head';
import CreateOrderForm from '@/components/Form/CreateOrderForm';

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * Home page for the trading bot dashboard.
 * Displays the main grid layout and all major panels.
 */
export default function Home() {
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

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

  const [breakpoint, setBreakpoint] = useState<'lg' | 'md' | 'sm' | 'xs' | 'xxs'>('lg');
  const handleBreakpoint = (newBreakpoint: string) => setBreakpoint(newBreakpoint as any);
  const totalRows = GRID_CONFIG.totalRowsMap[breakpoint] || GRID_CONFIG.totalRowsMap.lg;
  const rowHeight = mounted && windowHeight > 0
    ? (windowHeight - 2 * GRID_CONFIG.containerPadding[1] - (totalRows - 1) * GRID_CONFIG.margin[1]) / totalRows
    : 20;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent RGL from rendering on server to avoid layout mismatch
  if (!mounted) {
    return null;
  }

  return (
    <>
      <Head>
        {/* Custom CSS for static grid layout */}
        <style type="text/css">{`
          /* Make grid items fill available space */
          .react-grid-layout {
            width: 100% !important;
            height: 100vh;
            background-color: #0c0808;
          }

          /* Hide all resize handles for static layout */
          .react-resizable-handle {
            display: none !important;
          }

          /* Ensure grid items are positioned correctly */
          .react-grid-item {
            position: relative;
            cursor: default;
          }
        `}</style>
      </Head>
      <ResponsiveGridLayout
        className="layout"
        layouts={GRID_CONFIG.initialLayouts}
        onBreakpointChange={handleBreakpoint}
        isDraggable={false}
        isResizable={false}
        breakpoints={GRID_CONFIG.breakpoints}
        cols={GRID_CONFIG.columns}
        margin={GRID_CONFIG.margin}
        containerPadding={GRID_CONFIG.containerPadding}
        rowHeight={rowHeight}
        autoSize={true}
        verticalCompact={true}
        compactType="vertical"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <div key="activeFeed" className="h-full w-full overflow-hidden">
          <div className="h-full w-full overflow-hidden flex flex-col">
            <ActiveFeedPanel feedId={selectedFeed} onFeedSelect={setSelectedFeed} />
          </div>
        </div>
        <div key="config" className="h-full w-full overflow-hidden">
          <CreateOrderForm />
        </div>
        <div key="services" className="h-full w-full overflow-hidden">
          <OrderBookPanel selectedFeed={selectedFeed} />
        </div>
        <div key="positions" className="h-full w-full overflow-hidden">
          <div className="h-full w-full overflow-hidden flex flex-col">
            <PositionsPanel />
          </div>
        </div>
      </ResponsiveGridLayout>
    </>
  );
}