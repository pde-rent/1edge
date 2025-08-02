// ChartOverlays.tsx - Corrected version without ITimeLine
import React, { useEffect, useRef } from 'react';
import { IChartApi, IPriceLine, LineStyle, PriceLineOptions, Time, SeriesMarker } from 'lightweight-charts';

interface ChartOverlaysProps {
  chart: IChartApi | null;
  series: any; // The main series for adding markers
  orderType: string;
  formData: any;
  isVisible: boolean;
}

interface OverlayState {
  priceLines: IPriceLine[];
  timeOverlays: HTMLElement[];
  markers: SeriesMarker<Time>[];
}

export function ChartOverlays({ chart, series, orderType, formData, isVisible }: ChartOverlaysProps) {
  const overlayStateRef = useRef<OverlayState>({
    priceLines: [],
    timeOverlays: [],
    markers: []
  });

  // Clear all overlays
  const clearOverlays = () => {
    const state = overlayStateRef.current;
    
    // Remove price lines
    state.priceLines.forEach(line => {
      try {
        chart?.removePriceLine(line);
      } catch (e) {
        console.warn('Error removing price line:', e);
      }
    });
    
    // Remove DOM overlay elements
    state.timeOverlays.forEach(element => {
      try {
        element.remove();
      } catch (e) {
        console.warn('Error removing time overlay:', e);
      }
    });
    
    // Clear markers from series
    if (series && state.markers.length > 0) {
      try {
        series.setMarkers([]);
      } catch (e) {
        console.warn('Error clearing markers:', e);
      }
    }
    
    // Reset state
    state.priceLines = [];
    state.timeOverlays = [];
    state.markers = [];
  };

  // Create price line with optional emphasis
  const createPriceLine = (price: number, options: Partial<PriceLineOptions>, emphasized = false): IPriceLine | null => {
    if (!chart || !price || price <= 0) return null;

    const defaultOptions: PriceLineOptions = {
      price,
      color: emphasized ? '#10B981' : '#6B7280',
      lineWidth: emphasized ? 3 : 1,
      lineStyle: emphasized ? LineStyle.Solid : LineStyle.Dashed,
      axisLabelVisible: true,
      title: options.title || `${price.toFixed(6)}`,
      ...options
    };

    try {
      const priceLine = chart.addPriceLine(defaultOptions);
      overlayStateRef.current.priceLines.push(priceLine);
      return priceLine;
    } catch (e) {
      console.error('Error creating price line:', e);
      return null;
    }
  };

  // Create time overlay using DOM positioning
  const createTimeOverlay = (time: number, label: string, emphasized = false): void => {
    if (!chart) return;

    try {
      const chartContainer = chart.chartElement();
      if (!chartContainer) return;

      // Get position relative to the chart
      const timeScale = chart.timeScale();
      const coordinate = timeScale.timeToCoordinate(time as Time);
      
      if (coordinate === null) return;

      // Create container for the time overlay
      const overlayContainer = document.createElement('div');
      overlayContainer.style.cssText = `
        position: absolute;
        left: ${coordinate}px;
        top: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 5;
      `;

      // Create vertical line
      const line = document.createElement('div');
      line.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        bottom: 20px;
        width: ${emphasized ? '2px' : '1px'};
        background: ${emphasized ? '#3B82F6' : 'transparent'};
        ${emphasized ? '' : 'border-left: 1px dashed #6B7280;'}
        opacity: ${emphasized ? '0.8' : '0.6'};
      `;

      // Create label
      const labelEl = document.createElement('div');
      labelEl.style.cssText = `
        position: absolute;
        left: 4px;
        top: 8px;
        background: rgba(0, 0, 0, 0.8);
        color: ${emphasized ? '#3B82F6' : '#9CA3AF'};
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-family: monospace;
        white-space: nowrap;
        border: 1px solid ${emphasized ? '#3B82F6' : '#6B7280'};
        max-width: 80px;
        text-overflow: ellipsis;
        overflow: hidden;
      `;
      labelEl.textContent = label;

      overlayContainer.appendChild(line);
      overlayContainer.appendChild(labelEl);
      chartContainer.appendChild(overlayContainer);

      overlayStateRef.current.timeOverlays.push(overlayContainer);
    } catch (e) {
      console.error('Error creating time overlay:', e);
    }
  };

  // Add series marker for time points
  const addTimeMarker = (time: number, label: string, emphasized = false): void => {
    if (!series) return;

    const marker: SeriesMarker<Time> = {
      time: time as Time,
      position: 'inBar',
      color: emphasized ? '#3B82F6' : '#6B7280',
      shape: 'arrowDown',
      text: label,
      size: emphasized ? 2 : 1,
    };

    overlayStateRef.current.markers.push(marker);
  };

  // Update series with all markers
  const updateMarkers = () => {
    if (!series || overlayStateRef.current.markers.length === 0) return;

    try {
      series.setMarkers(overlayStateRef.current.markers);
    } catch (e) {
      console.error('Error setting markers:', e);
    }
  };

  // Generate fibonacci-like levels between start and end price
  const generateRangeLevels = (startPrice: number, endPrice: number): number[] => {
    const levels = [];
    const diff = endPrice - startPrice;
    const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    
    fibLevels.forEach(ratio => {
      levels.push(startPrice + (diff * ratio));
    });
    
    return levels;
  };

  // Generate time intervals for TWAP execution
  const generateTwapTimeIntervals = (startTime: number, endTime: number, intervalMinutes = 15): number[] => {
    const intervals = [];
    const intervalSeconds = intervalMinutes * 60;
    
    for (let time = startTime; time <= endTime; time += intervalSeconds) {
      intervals.push(time);
    }
    
    if (intervals[intervals.length - 1] !== endTime) {
      intervals.push(endTime);
    }
    
    return intervals;
  };

  // Create overlays based on order type and form data
  const createOverlays = () => {
    if (!chart || !isVisible || !orderType || !formData) {
      return;
    }

    clearOverlays();

    try {
      switch (orderType) {
        case 'Range':
        case 'Iceberg':
        case 'GridMarketMaking':
          createRangeOverlays();
          break;
        case 'TWAP':
        case 'DCA':
          createTwapOverlays();
          break;
        case 'StopLimit':
          createStopLimitOverlays();
          break;
        case 'ChaseLimit':
          createChaseLimitOverlays();
          break;
        default:
          break;
      }
      
      // Update markers after creating overlays
      updateMarkers();
    } catch (e) {
      console.error('Error creating overlays:', e);
    }
  };

  // Range/Iceberg/Grid overlays
  const createRangeOverlays = () => {
    const startPrice = parseFloat(formData.startPrice);
    const endPrice = parseFloat(formData.endPrice);
    const expiry = formData.expiry;

    if (startPrice && endPrice && startPrice !== endPrice) {
      const levels = generateRangeLevels(startPrice, endPrice);
      
      levels.forEach((price, index) => {
        const isEmphasized = index === 0 || index === levels.length - 1;
        const title = index === 0 ? 'Start Price' : 
                     index === levels.length - 1 ? 'End Price' : 
                     `Level ${index}`;
        
        createPriceLine(price, { title }, isEmphasized);
      });
    } else if (startPrice) {
      createPriceLine(startPrice, { title: 'Start Price' }, true);
    } else if (endPrice) {
      createPriceLine(endPrice, { title: 'End Price' }, true);
    }

    if (expiry) {
      const expiryTime = parseExpiryToTimestamp(expiry);
      if (expiryTime) {
        createTimeOverlay(expiryTime, 'Expiry', true);
        addTimeMarker(expiryTime, 'Exp', true);
      }
    }
  };

  // TWAP/DCA overlays
  const createTwapOverlays = () => {
    const maxPrice = parseFloat(formData.maxPrice);
    const startDate = formData.startDate;
    const endDate = formData.endDate;
    const interval = parseInt(formData.interval) || 15;

    if (maxPrice) {
      createPriceLine(maxPrice, { 
        title: 'Max Price',
        color: '#EF4444'
      }, true);
    }

    if (startDate && endDate) {
      const startTime = new Date(startDate).getTime() / 1000;
      const endTime = new Date(endDate).getTime() / 1000;
      
      if (startTime < endTime) {
        const intervals = generateTwapTimeIntervals(startTime, endTime, interval);
        
        intervals.forEach((time, index) => {
          const isEmphasized = index === 0 || index === intervals.length - 1;
          const label = index === 0 ? 'Start' : 
                       index === intervals.length - 1 ? 'End' : 
                       `T${index}`;
          
          createTimeOverlay(time, label, isEmphasized);
          addTimeMarker(time, label, isEmphasized);
        });
      }
    } else if (startDate) {
      const startTime = new Date(startDate).getTime() / 1000;
      createTimeOverlay(startTime, 'Start', true);
      addTimeMarker(startTime, 'Start', true);
    }
  };

  // Stop Limit overlays
  const createStopLimitOverlays = () => {
    const stopPrice = parseFloat(formData.stopPrice);
    const limitPrice = parseFloat(formData.limitPrice);
    const expiry = formData.expiry;

    if (stopPrice) {
      createPriceLine(stopPrice, { 
        title: 'Stop Price',
        color: '#EF4444'
      }, true);
    }

    if (limitPrice) {
      createPriceLine(limitPrice, { 
        title: 'Limit Price',
        color: '#10B981'
      }, true);
    }

    if (expiry) {
      const expiryTime = parseExpiryToTimestamp(expiry);
      if (expiryTime) {
        createTimeOverlay(expiryTime, 'Expiry', true);
        addTimeMarker(expiryTime, 'Exp', true);
      }
    }
  };

  // Chase Limit overlays
  const createChaseLimitOverlays = () => {
    const maxPrice = parseFloat(formData.maxPrice);
    const expiry = formData.expiry;

    if (maxPrice) {
      createPriceLine(maxPrice, { 
        title: 'Max Chase Price',
        color: '#F59E0B'
      }, true);
    }

    if (expiry) {
      const expiryTime = parseExpiryToTimestamp(expiry);
      if (expiryTime) {
        createTimeOverlay(expiryTime, 'Expiry', true);
        addTimeMarker(expiryTime, 'Exp', true);
      }
    }
  };

  // Helper function to parse expiry to timestamp
  const parseExpiryToTimestamp = (expiry: string): number | null => {
    if (!expiry) return null;
    
    const daysFromNow = parseInt(expiry);
    if (!isNaN(daysFromNow)) {
      return Math.floor(Date.now() / 1000) + (daysFromNow * 24 * 60 * 60);
    }
    
    const date = new Date(expiry);
    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000);
    }
    
    return null;
  };

  // Handle chart updates and repositioning
  const handleChartUpdate = () => {
    if (!isVisible) return;
    
    // Clear and recreate time overlays to reposition them
    overlayStateRef.current.timeOverlays.forEach(el => el.remove());
    overlayStateRef.current.timeOverlays = [];
    
    // Recreate overlays with updated positioning
    setTimeout(() => {
      if (isVisible) {
        createOverlays();
      }
    }, 50);
  };

  // Effect to create/update overlays
  useEffect(() => {
    if (!isVisible) {
      clearOverlays();
      return;
    }

    createOverlays();
    
    // Subscribe to chart updates for repositioning
    if (chart) {
      chart.timeScale().subscribeVisibleTimeRangeChange(handleChartUpdate);
    }
    
    return () => {
      clearOverlays();
      if (chart) {
        try {
          chart.timeScale().unsubscribeVisibleTimeRangeChange(handleChartUpdate);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [chart, series, orderType, formData, isVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearOverlays();
  }, []);

  return null;
}