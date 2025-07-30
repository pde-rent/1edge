// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { roundSig } from "@common/utils";
import { TrendingUp, BarChart3 } from "lucide-react";

/**
 * PositionsPanel displays a table of strategy positions across the platform.
 * Currently shows a placeholder until real positions are available.
 */
export default function PositionsPanel() {
  const [strategies, setStrategies] = useState([]);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const response = await fetch("http://localhost:40005/strategies");
        if (response.ok) {
          const data = await response.json();
          setStrategies(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch strategies:", error);
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
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  /**
   * Formats the size value for display.
   * @param value - The size value.
   * @returns The formatted string.
   */
  const formatSize = (value) => {
    if (value === undefined || value === null) return "-";
    return roundSig(value, 5).toLocaleString();
  };

  /**
   * Formats the entry value for display, using scientific notation for small values.
   * @param value - The entry value.
   * @returns The formatted string.
   */
  const formatEntry = (value) => {
    if (value === undefined || value === null) return "-";

    // Use scientific notation for values less than 0.001
    if (Math.abs(value) < 0.001 && value !== 0) {
      return roundSig(value, 6).toExponential();
    }

    return roundSig(value, 6).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  };

  /**
   * Formats the PnL value for display.
   * @param value - The PnL value.
   * @returns The formatted string.
   */
  const formatPnL = (value) => {
    if (value === undefined || value === null) return "-";
    return roundSig(value, 6).toLocaleString();
  };

  /**
   * Gets the badge variant and styling for the type chip based on order type.
   * @param type - The order type.
   * @returns The badge styling object.
   */
  const getTypeBadgeStyle = (type) => {
    if (!type)
      return {
        variant: "outline",
        className: "bg-black/60 border-slate-600/50 text-slate-300",
      };

    const buyTypes = ["buy", "buy_limit", "buy_stop"];
    const shortTypes = ["short", "short_limit", "short_stop"];

    if (buyTypes.includes(type.toLowerCase())) {
      return {
        variant: "outline",
        className:
          "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20",
      };
    }
    if (shortTypes.includes(type.toLowerCase())) {
      return {
        variant: "outline",
        className:
          "bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20",
      };
    }

    return {
      variant: "outline",
      className: "bg-black/60 border-slate-600/50 text-slate-300",
    };
  };

  /**
   * Gets the PnL text color based on value.
   * @param value - The PnL value.
   * @returns The color class string.
   */
  const getPnLColor = (value) => {
    if (value === undefined || value === null || value === 0)
      return "text-slate-400";
    return value > 0 ? "text-emerald-400" : "text-red-400";
  };

  return (
    <div className="p-1 rounded-2xl bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-cyan-500/20 shadow-2xl border border-teal-500 h-full">
      <div className="p-1 rounded-2xl bg-slate-800/30 backdrop-blur-sm h-full">
        <Card className="h-full bg-black/80 backdrop-blur-xl border-slate-700/50 overflow-hidden flex flex-col p-0 gap-0 rounded-2xl shadow-2xl">
          {/* Header */}
          <CardHeader className="pb-0 border-b border-teal-500/20 bg-gradient-to-r from-black/95 via-slate-950/90 to-black/95 backdrop-blur-md flex-shrink-0 relative">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent"></div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 mt-4">
                <BarChart3 className="w-4 h-4 text-teal-400" />
                <h2 className="text-lg font-bold text-teal-600">Positions</h2>
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-teal-400 shadow-lg shadow-teal-400/50" />
                <span className="text-xs font-medium text-teal-200 uppercase tracking-wide">
                  {strategies.length > 0
                    ? `${strategies.length} Active`
                    : "No Active"}
                </span>
              </div>
            </div>

            {/* Subtitle */}
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Monitoring aggregated strategy positions across platform.
              Positions can be ordered, open, or closed.
            </p>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col bg-gradient-to-b from-black/95 via-slate-950/90 to-black/95 backdrop-blur-xl">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-teal-500/20 bg-black/60 backdrop-blur-sm flex-shrink-0 text-xs font-medium text-teal-200 uppercase tracking-wide relative">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-emerald-500/5 to-cyan-500/5"></div>
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent"></div>

              <div className="col-span-3 relative z-10 flex items-center gap-2">
                Name
                <div className="w-1 h-1 rounded-full bg-teal-400"></div>
              </div>
              <div className="col-span-2 relative z-10">Type</div>
              <div className="col-span-2 relative z-10">Status</div>
              <div className="col-span-2 text-right relative z-10">Started</div>
              <div className="col-span-3 text-right relative z-10">
                Last Update
              </div>
            </div>

            {/* Table Body - Scrollable */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-black/95 via-slate-950/90 to-black/95">
              {strategies.length > 0 ? (
                strategies.map((strategy, index) => {
                  return (
                    <div
                      key={strategy.id}
                      className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-black/60 backdrop-blur-sm transition-all duration-300 border-b border-slate-800/30 relative group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                      <div className="col-span-3 flex items-center relative z-10">
                        <span className="text-sm text-white truncate font-medium">
                          {strategy.name}
                        </span>
                      </div>

                      <div className="col-span-2 flex items-center relative z-10">
                        <span className="text-sm text-slate-200 truncate font-mono">
                          {strategy.type}
                        </span>
                      </div>

                      <div className="col-span-2 flex items-center relative z-10">
                        <Badge
                          variant={
                            strategy.status === "Running"
                              ? "default"
                              : "outline"
                          }
                          className={`text-xs h-5 px-2 ${
                            strategy.status === "Running"
                              ? "bg-gradient-to-r from-teal-600/20 to-emerald-600/20 border-teal-400/50 text-teal-200"
                              : "bg-black/60 border-slate-600/50 text-slate-300"
                          }`}
                        >
                          {strategy.status}
                        </Badge>
                      </div>

                      <div className="col-span-2 flex items-center justify-end relative z-10">
                        <span className="text-xs font-mono text-slate-300 tabular-nums">
                          {formatTimestamp(strategy.startedAt)}
                        </span>
                      </div>

                      <div className="col-span-3 flex items-center justify-end relative z-10">
                        <span className="text-xs font-mono text-slate-300 tabular-nums">
                          {formatTimestamp(strategy.updatedAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex-1 flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="relative mb-4">
                      <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 rounded-full blur-xl"></div>
                      <BarChart3 className="w-12 h-12 text-teal-400 mx-auto relative z-10" />
                    </div>
                    <p className="text-slate-200 font-medium">
                      No positions available
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Positions will appear here when strategies are active
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-teal-500/20 bg-gradient-to-r from-black/95 via-slate-950/90 to-black/95 backdrop-blur-md flex-shrink-0 relative">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent"></div>

              <div className="flex items-center justify-between text-xs text-slate-300 relative z-10">
                <span className="font-mono flex items-center gap-2">
                  {strategies.length} position
                  {strategies.length !== 1 ? "s" : ""} shown
                  <div className="w-1 h-1 rounded-full bg-emerald-400"></div>
                </span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500/80 shadow-lg shadow-emerald-500/50"></div>
                    <span className="font-mono text-emerald-300">Long</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500/80 shadow-lg shadow-red-500/50"></div>
                    <span className="font-mono text-red-300">Short</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
