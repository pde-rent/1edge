// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { roundSig } from '@common/utils';
import { TrendingUp, BarChart3 } from 'lucide-react';

/**
 * PositionsPanel displays a table of strategy positions across the platform.
 * Currently shows a placeholder until real positions are available.
 */
export default function PositionsPanel() {
  const [strategies, setStrategies] = useState([]);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const response = await fetch('http://localhost:40005/strategies');
        if (response.ok) {
          const data = await response.json();
          setStrategies(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch strategies:', error);
      }
    };

    fetchStrategies();
    const interval = setInterval(fetchStrategies, 5000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Formats a timestamp for display.
   * @param timestamp - The timestamp to format.
   * @returns The formatted time string.
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  /**
   * Formats the size value for display.
   * @param value - The size value.
   * @returns The formatted string.
   */
  const formatSize = (value) => {
    if (value === undefined || value === null) return '-';
    return roundSig(value, 5).toLocaleString();
  };

  /**
   * Formats the entry value for display, using scientific notation for small values.
   * @param value - The entry value.
   * @returns The formatted string.
   */
  const formatEntry = (value) => {
    if (value === undefined || value === null) return '-';

    // Use scientific notation for values less than 0.001
    if (Math.abs(value) < 0.001 && value !== 0) {
      return roundSig(value, 6).toExponential();
    }

    return roundSig(value, 6).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    });
  };

  /**
   * Formats the PnL value for display.
   * @param value - The PnL value.
   * @returns The formatted string.
   */
  const formatPnL = (value) => {
    if (value === undefined || value === null) return '-';
    return roundSig(value, 6).toLocaleString();
  };

  /**
   * Gets the badge variant and styling for the type chip based on order type.
   * @param type - The order type.
   * @returns The badge styling object.
   */
  const getTypeBadgeStyle = (type) => {
    if (!type) return { variant: 'outline', className: 'bg-gray-800/50 border-gray-600 text-gray-300' };

    const buyTypes = ['buy', 'buy_limit', 'buy_stop'];
    const shortTypes = ['short', 'short_limit', 'short_stop'];

    if (buyTypes.includes(type.toLowerCase())) {
      return {
        variant: 'outline',
        className: 'bg-green-500/10 border-green-500/50 text-green-400 hover:bg-green-500/20'
      };
    }
    if (shortTypes.includes(type.toLowerCase())) {
      return {
        variant: 'outline',
        className: 'bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20'
      };
    }

    return { variant: 'outline', className: 'bg-gray-800/50 border-gray-600 text-gray-300' };
  };

  /**
   * Gets the PnL text color based on value.
   * @param value - The PnL value.
   * @returns The color class string.
   */
  const getPnLColor = (value) => {
    if (value === undefined || value === null || value === 0) return 'text-gray-400';
    return value > 0 ? 'text-green-400' : 'text-red-400';
  };

  return (
    <Card className="h-full bg-gray-950 border-gray-800 overflow-hidden flex flex-col p-0 gap-0">
      {/* Header */}
      <CardHeader className="pb-0 border-b border-gray-800 bg-gray-900/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 mt-4">
            <BarChart3 className="w-4 h-4 text-green-400" />
            <h2 className="text-lg font-semibold text-gray-100">Positions</h2>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              No Active
            </span>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
          Monitoring aggregated strategy positions across platform. Positions can be ordered, open, or closed.
        </p>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-gray-800 bg-gray-900/40 flex-shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide">
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Started</div>
          <div className="col-span-3 text-right">Last Update</div>
        </div>

        {/* Table Body - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-gray-950">
          {strategies.length > 0 ? (
            strategies.map((strategy) => {
              return (
                <div
                  key={strategy.id}
                  className="grid grid-cols-12 gap-2 px-3 py-2 hover:bg-gray-800/30 transition-colors duration-200 border-b border-gray-900/50"
                >
                  <div className="col-span-3 flex items-center">
                    <span className="text-sm text-gray-200 truncate font-medium">
                      {strategy.name}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center">
                    <span className="text-sm text-gray-300 truncate font-mono">
                      {strategy.type}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center">
                    <Badge
                      variant={strategy.status === 'Running' ? 'default' : 'outline'}
                      className={`text-xs h-5 px-2`}
                    >
                      {strategy.status}
                    </Badge>
                  </div>

                  <div className="col-span-2 flex items-center justify-end">
                    <span className="text-xs font-mono text-gray-400 tabular-nums">
                      {formatTimestamp(strategy.startedAt)}
                    </span>
                  </div>

                  <div className="col-span-3 flex items-center justify-end">
                    <span className="text-xs font-mono text-gray-400 tabular-nums">
                      {formatTimestamp(strategy.updatedAt)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No positions available</p>
                <p className="text-xs text-gray-600 mt-1">
                  Positions will appear here when strategies are active
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-gray-800 bg-gray-900/40 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-mono">
              {strategies.length} position{strategies.length !== 1 ? 's' : ''} shown
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500/60" />
                <span className="font-mono">Long</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500/60" />
                <span className="font-mono">Short</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}