import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PanelWrapper } from "./common/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OrderDetailsModal } from "./OrderDetailsModal";
import { Order, OrderStatus, OrderType } from "@common/types";
import { Settings, BarChart3, Edit2, X } from "lucide-react";
import { API_ENDPOINTS } from "../config/api";
import AuthComponent from "./AuthComponent";
import { useAccount } from "wagmi";

/**
 * OrdersPanel displays a table of orders and strategies across the platform.
 * Shows order management interface with detailed tooltips and modal views.
 */
export default function OrdersPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { address } = useAccount();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.ORDERS);
        if (response.ok) {
          const data = await response.json();
          setOrders(data.data || []);
        } else {
          // Mock data for development
          setOrders(generateMockOrders());
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error);
        // Fallback to mock data
        setOrders(generateMockOrders());
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);

    return () => clearInterval(interval);
  }, []);

  const generateMockOrders = (): Order[] => [
    {
      id: "ord_1",
      signature: "0x...",
      status: OrderStatus.ACTIVE,
      remainingMakerAmount: 750.0,
      createdAt: Date.now() - 3600000,
      triggerCount: 3,
      nextTriggerValue: "42500.0",
      params: {
        type: OrderType.TWAP,
        maker: "0x...",
        makerAsset: "0x...",
        takerAsset: "0x...",
        makingAmount: 1000,
        startDate: Date.now() - 3600000,
        endDate: Date.now() + 86400000,
        interval: 1800000,
        maxPrice: 43000,
      },
    },
    {
      id: "ord_2",
      signature: "0x...",
      status: OrderStatus.PENDING,
      remainingMakerAmount: 500.0,
      createdAt: Date.now() - 1800000,
      triggerCount: 0,
      nextTriggerValue: "41000.0",
      params: {
        type: OrderType.STOP_LIMIT,
        maker: "0x...",
        makerAsset: "0x...",
        takerAsset: "0x...",
        makingAmount: 500,
        stopPrice: 41000,
        limitPrice: 40800,
        expiry: 7,
      },
    },
    {
      id: "ord_3",
      signature: "0x...",
      status: OrderStatus.PARTIALLY_FILLED,
      remainingMakerAmount: 1200.0,
      createdAt: Date.now() - 7200000,
      triggerCount: 8,
      nextTriggerValue: "42200.0",
      params: {
        type: OrderType.GRID_TRADING,
        maker: "0x...",
        makerAsset: "0x...",
        takerAsset: "0x...",
        makingAmount: 2000,
        startPrice: 41000,
        endPrice: 44000,
        stepPct: 0.5,
        singleSide: false,
        tpPct: 2.0,
      },
    },
  ];

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatFullTimestamp = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  const formatSize = (value?: string) => {
    if (!value) return "-";
    const num = parseFloat(value);
    if (isNaN(num)) return "-";
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const getStatusBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.ACTIVE:
        return "bg-primary/20 border-primary text-primary";
      case OrderStatus.FILLED:
        return "bg-success/20 border-success text-success";
      case OrderStatus.CANCELLED:
      case OrderStatus.EXPIRED:
        return "bg-muted border-muted-foreground text-muted-foreground";
      case OrderStatus.FAILED:
        return "bg-destructive/20 border-destructive text-destructive";
      case OrderStatus.PARTIALLY_FILLED:
        return "bg-warning/20 border-warning text-warning";
      default:
        return "bg-muted border-muted-foreground text-muted-foreground";
    }
  };

  const getTypeBadgeStyle = (type: OrderType) => {
    const oneOffTypes = [
      OrderType.STOP_LIMIT,
      OrderType.CHASE_LIMIT,
      OrderType.TWAP,
      OrderType.RANGE,
      OrderType.ICEBERG,
    ];
    if (oneOffTypes.includes(type)) {
      return "bg-primary/10 border-primary/50 text-primary";
    }
    return "bg-secondary/10 border-secondary/50 text-secondary";
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handleCancel = async (orderId: string) => {
    try {
      const response = await fetch(
        API_ENDPOINTS.CANCEL_ORDER(orderId),
        {
          method: "POST",
        },
      );
      if (response.ok) {
        // Refresh orders
        const updatedOrders = orders.map((order) =>
          order.id === orderId
            ? { ...order, status: OrderStatus.CANCELLED }
            : order,
        );
        setOrders(updatedOrders);
      }
    } catch (error) {
      console.error("Failed to cancel order:", error);
    }
    setIsModalOpen(false);
  };

  const handleModify = async (orderId: string) => {
    // In a real implementation, this would open a modify dialog
    console.log("Modify order:", orderId);
    setIsModalOpen(false);
  };

  return (
    <TooltipProvider>
      <PanelWrapper>
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col bg-background backdrop-blur-xl">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-primary/50 bg-card backdrop-blur-sm flex-shrink-0 text-xs font-medium text-primary uppercase tracking-wide relative">
            <div className="absolute inset-0 bg-primary/5"></div>
            <div className="absolute inset-x-0 bottom-0 h-px bg-primary/30"></div>

            <div className="col-span-2 relative z-10 flex items-center gap-2">
              Order Id
              <div className="w-1 h-1 bg-primary"></div>
            </div>
            <div className="col-span-1 relative z-10">Type</div>
            <div className="col-span-1 relative z-10">Status</div>
            <div className="col-span-1 text-right relative z-10">Size</div>
            <div className="col-span-1 text-right relative z-10">Remaining</div>
            <div className="col-span-2 text-right relative z-10">Created</div>
            <div className="col-span-1 text-center relative z-10">Triggers</div>
            <div className="col-span-1 text-right relative z-10">Next</div>
            <div className="col-span-2 text-center relative z-10">Actions</div>
          </div>

          {/* Table Body - Scrollable */}
          <div className="flex-1 overflow-y-auto bg-background">
            {!address ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <AuthComponent variant="default" />
              </div>
            ) : orders.length > 0 ? (
              orders.map((order) => {
                return (
                  <Tooltip key={order.id}>
                    <TooltipTrigger asChild>
                      <div
                        className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-black/60 backdrop-blur-sm transition-all duration-300 border-b border-slate-800/30 relative group cursor-pointer"
                        onClick={() => handleOrderClick(order)}
                      >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        {/* ID */}
                        <div className="col-span-2 flex items-center relative z-10">
                          <span className="text-sm text-white truncate font-mono">
                            {order.id}
                          </span>
                        </div>

                        {/* Type */}
                        <div className="col-span-1 flex items-center relative z-10">
                          <Badge
                            variant="outline"
                            className={`text-xs h-5 px-2 ${getTypeBadgeStyle(order.params?.type || '')}`}
                          >
                            {order.params?.type || 'Unknown'}
                          </Badge>
                        </div>

                        {/* Status */}
                        <div className="col-span-1 flex items-center relative z-10">
                          <Badge
                            variant="outline"
                            className={`text-xs h-5 px-2 ${getStatusBadgeStyle(order.status)}`}
                          >
                            {order.status}
                          </Badge>
                        </div>

                        {/* Size */}
                        <div className="col-span-1 flex items-center justify-end relative z-10">
                          <span className="text-xs font-mono text-slate-300 tabular-nums">
                            {formatSize(order.size)}
                          </span>
                        </div>

                        {/* Remaining Size */}
                        <div className="col-span-1 flex items-center justify-end relative z-10">
                          <span className="text-xs font-mono text-slate-300 tabular-nums">
                            {formatSize(order.remainingSize)}
                          </span>
                        </div>

                        {/* Created At */}
                        <div className="col-span-2 flex items-center justify-end relative z-10">
                          <span className="text-xs font-mono text-slate-300 tabular-nums">
                            {formatTimestamp(order.createdAt)}
                          </span>
                        </div>

                        {/* Trigger Count */}
                        <div className="col-span-1 flex items-center justify-center relative z-10">
                          <span className="text-xs font-mono text-slate-300 tabular-nums">
                            {order.triggerCount}
                          </span>
                        </div>

                        {/* Next Trigger Value */}
                        <div className="col-span-1 flex items-center justify-end relative z-10">
                          <span className="text-xs font-mono text-slate-300 tabular-nums">
                            {order.nextTriggerValue || "-"}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="col-span-2 flex items-center justify-center gap-1 relative z-10">
                          {order.status === OrderStatus.ACTIVE && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 border-warning/50 text-warning hover:bg-warning/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleModify(order.id);
                                }}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancel(order.id);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm bg-black">
                      <div className="space-y-2">
                        <div className="font-semibold text-primary">
                          {order.type} Order
                        </div>
                        <div className="text-xs space-y-1">
                          <div>
                            Created: {formatFullTimestamp(order.createdAt)}
                          </div>
                          <div>
                            Progress: {formatSize(order.remainingSize)} /{" "}
                            {formatSize(order.size)} remaining
                          </div>
                          <div>Triggers: {order.triggerCount} times</div>
                          {order.nextTriggerValue && (
                            <div>Next: {order.nextTriggerValue}</div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Click for full details
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })
            ) : (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="relative mb-4">
                    <div className="absolute inset-0 bg-primary/20 blur-xl"></div>
                    <Settings className="w-12 h-12 text-primary mx-auto relative z-10" />
                  </div>
                  <p className="text-slate-200 font-medium">
                    No orders available
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Orders will appear here when created
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-primary/50 bg-background backdrop-blur-md flex-shrink-0 relative">
            <div className="absolute inset-x-0 top-0 h-px bg-primary/30"></div>

            <div className="flex items-center justify-between text-xs text-slate-300 relative z-10">
              <span className="font-mono flex items-center gap-2">
                {orders.length} order
                {orders.length !== 1 ? "s" : ""} shown
                <div className="w-1 h-1 bg-primary"></div>
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary/80"></div>
                  <span className="font-mono text-primary">Active</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-success/80"></div>
                  <span className="font-mono text-success">Filled</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-muted-foreground/80"></div>
                  <span className="font-mono text-muted-foreground">
                    Cancelled
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <OrderDetailsModal
          order={selectedOrder}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCancel={handleCancel}
          onModify={handleModify}
        />
      </PanelWrapper>
    </TooltipProvider>
  );
}
