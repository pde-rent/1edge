// @ts-nocheck
"use client";
import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  ChevronDown,
  TrendingUp,
  BarChart3,
  Grid3X3,
  Clock,
  Info,
  Repeat,
  Activity,
  Target,
  Zap,
  DollarSign,
  Settings,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PanelWrapper } from "../common/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TWAPForm from "./components/TWAPForm";
import RangeForm, { getDefaultExpiry } from "./components/RangeForm";
import IcebergForm from "./components/IcebergForm";
import DCAForm from "./components/DSAForm";
import GridMarketMakingForm from "./components/GridMarketMakingForm";
import MomentumReversalForm from "./components/MomentumReversalForm";
import RangeBreakoutForm from "./components/RangeBreakoutForm";
import { toast } from "sonner";
import StopLimitForm from "./components/StopLimitForm";
import ChaseLimitForm from "./components/ChaseLimitForm";
import { useOrderStore } from "@/stores/orderStore";

export interface FormData {
  // TWAP fields
  startDate: string;
  endDate: string;
  interval: string;
  maxPrice: string;
  // Legacy fields (you can remove these if not needed)

  // Range fields
  startPrice: string;
  endPrice: string;
  stepPct: string;
  expiry: string;
  steps: string;

  tpPct: string;
  singleSide: boolean;
  stepMultiplier: string;
  rsiPeriod: string;
  rsimaPeriod: string;
  slPct: string;
  adxPeriod: string;
  adxmaPeriod: string;
  emaPeriod: string;
  stopPrice: string;
  limitPrice: string;
  distancePct: string;

  twapDuration: string;
  twapInterval: string;
  minBuyPrice: string;
  maxSellPrice: string;
  totalSize: string;
  hiddenSize: string;
  dcaAmount: string;
  dcaFrequency: string;
  gridLower: string;
  gridUpper: string;
  gridLevels: string;
  rsiThreshold: string;
  stopLoss: string;
  takeProfit: string;
  breakoutThreshold: string;
  fastEMA: string;
  slowEMA: string;
  amount?: string;
  fromCoin: string;
  toCoin: string;
}

export interface OrderType {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
}

export interface Coin {
  symbol: string;
  name: string;
  icon: string;
}

const CreateOrderForm = () => {
  const [orderCategory, setOrderCategory] = useState<"Order" | "Strategy">(
    "Order",
  );
  const [orderType, setOrderType] = useState<string>("TWAP");

  // Zustand store integration
  const { orderDefaults, clearOrderDefaults, orderSettings, setOrderFormOpen } =
    useOrderStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<FormData>({
    defaultValues: {
      // TWAP defaults
      startDate: new Date().toISOString().slice(0, 16),
      endDate: (() => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        return date.toISOString().slice(0, 16);
      })(),
      interval: "24",
      maxPrice: "",
      startPrice: "",
      endPrice: "",
      stepPct: "0.3",
      expiry: getDefaultExpiry(),
      steps: "",

      tpPct: "",
      singleSide: true,
      stepMultiplier: "1.0",
      rsiPeriod: "",
      rsimaPeriod: "",
      slPct: "",
      adxPeriod: "",
      adxmaPeriod: "",
      emaPeriod: "",
      stopPrice: "",
      limitPrice: "",
      distancePct: "",

      twapDuration: "60",
      twapInterval: "5",
      minBuyPrice: "3739.17",
      maxSellPrice: "3814.71",
      totalSize: "",
      hiddenSize: "",
      dcaAmount: "",
      dcaFrequency: "",
      gridLower: "",
      gridUpper: "",
      gridLevels: "10",
      rsiThreshold: "30",
      stopLoss: "",
      takeProfit: "",
      breakoutThreshold: "25",
      fastEMA: "12",
      slowEMA: "26",
      amount: "",
      fromCoin: "ETH",
      toCoin: "USDC",
    },
  });

  // Replace the existing useEffect in your CreateOrderForm component

  useEffect(() => {
    if (orderDefaults) {
      // Set the order type from orderbook click
      if (orderDefaults.orderType) {
        setOrderType(orderDefaults.orderType);

        // Set the category based on order type
        const orderTypes = {
          Order: ["TWAP", "Range", "Iceberg", "StopLimit", "ChaseLimit"],
          Strategy: [
            "DCA",
            "GridMarketMaking",
            "MomentumReversal",
            "RangeBreakout",
            "TrendFollowing",
          ],
        };

        const category = orderTypes.Order.includes(orderDefaults.orderType)
          ? "Order"
          : "Strategy";
        setOrderCategory(category);
      }

      // Pre-fill form values from orderbook click
      const updates: Partial<FormData> = {};

      // Common price fields
      if (orderDefaults.price) {
        updates.maxPrice = orderDefaults.price;
        updates.stopPrice = orderDefaults.price;
        updates.limitPrice = orderDefaults.price;
      }

      // Iceberg specific fields
      if (orderDefaults.startPrice) {
        updates.startPrice = orderDefaults.startPrice;
      }

      if (orderDefaults.endPrice) {
        updates.endPrice = orderDefaults.endPrice;
      }

      if (orderDefaults.steps) {
        updates.steps = orderDefaults.steps;
      }

      if (orderDefaults.expiry) {
        updates.expiry = orderDefaults.expiry;
      }

      // Other order type fields
      if (orderDefaults.distancePct) {
        updates.distancePct = orderDefaults.distancePct;
      }

      if (orderDefaults.startDate) {
        updates.startDate = orderDefaults.startDate;
      }

      if (orderDefaults.endDate) {
        updates.endDate = orderDefaults.endDate;
      }

      if (orderDefaults.interval) {
        updates.interval = orderDefaults.interval;
      }

      if (orderDefaults.stepPct) {
        updates.stepPct = orderDefaults.stepPct;
      }

      // Coin pair
      if (orderDefaults.fromCoin) {
        updates.fromCoin = orderDefaults.fromCoin;
      }

      if (orderDefaults.toCoin) {
        updates.toCoin = orderDefaults.toCoin;
      }

      if (orderDefaults.amount) {
        updates.amount = orderDefaults.amount;
      }

      // Apply updates to form
      Object.entries(updates).forEach(([key, value]) => {
        setValue(key as keyof FormData, value);
      });

      // Show notification
      toast.success(
        `Pre-filled  ${orderDefaults.orderType} order at $${orderDefaults.price}`,
        {
          action: {
            label: "Clear",
            onClick: () => clearOrderDefaults(),
          },
        },
      );
    }
  }, [orderDefaults, setValue, clearOrderDefaults]);

  const orderTypes: Record<"Order" | "Strategy", OrderType[]> = {
    Order: [
      {
        id: "TWAP",
        name: "TWAP",
        icon: Clock,
        description: "Time-weighted average price",
      },
      {
        id: "Range",
        name: "Range",
        icon: BarChart3,
        description: "Liquidity position",
      },
      {
        id: "Iceberg",
        name: "Iceberg",
        icon: Target,
        description: "Hidden execution",
      },
      {
        id: "StopLimit",
        name: "Stop Limit",
        icon: Settings,
        description: "Stop loss with limit",
      },
      {
        id: "ChaseLimit",
        name: "Chase Limit",
        icon: TrendingUp,
        description: "Dynamic limit chasing",
      },
    ],
    Strategy: [
      {
        id: "DCA",
        name: "DCA",
        icon: Repeat,
        description: "Dollar cost averaging",
      },
      {
        id: "GridMarketMaking",
        name: "Grid",
        icon: Grid3X3,
        description: "Market making",
      },
      {
        id: "MomentumReversal",
        name: "Momentum",
        icon: Activity,
        description: "RSI reversal",
      },
      {
        id: "RangeBreakout",
        name: "Breakout",
        icon: Zap,
        description: "Range breakouts",
      },
      {
        id: "TrendFollowing",
        name: "Trend",
        icon: TrendingUp,
        description: "EMA strategy",
      },
    ],
  };

  const renderForm = () => {
    switch (orderType) {
      case "TWAP":
        return <TWAPForm control={control} errors={errors} />;
      case "Range":
        return <RangeForm control={control} errors={errors} watch={watch} />;
      case "Iceberg":
        return <IcebergForm control={control} errors={errors} />;
      case "DCA":
        return <DCAForm control={control} errors={errors} />;
      case "GridMarketMaking":
        return <GridMarketMakingForm control={control} errors={errors} />;
      case "MomentumReversal":
        return <MomentumReversalForm control={control} errors={errors} />;
      case "RangeBreakout":
        return <RangeBreakoutForm control={control} errors={errors} />;
      case "StopLimit":
        return <StopLimitForm control={control} errors={errors} />;
      case "ChaseLimit":
        return <ChaseLimitForm control={control} errors={errors} />;
      default:
        return null;
    }
  };

  const onSubmit = async (data: FormData) => {
    // Define which fields belong to each order type
    const getRelevantParams = (orderType: string, formData: FormData) => {
      switch (orderType) {
        case "TWAP":
          return {
            amount: formData.amount,
            startDate: formData.startDate,
            endDate: formData.endDate,
            interval: formData.interval,
            maxPrice: formData.maxPrice,
          };

        case "Range":
          return {
            amount: formData.amount,
            startPrice: formData.startPrice,
            endPrice: formData.endPrice,
            stepPct: formData.stepPct,
            expiry: formData.expiry,
          };

        case "Iceberg":
          return {
            amount: formData.amount,
            startPrice: formData.startPrice,
            endPrice: formData.endPrice,
            steps: formData.steps,
            expiry: formData.expiry,
          };

        case "DCA":
          return {
            amount: formData.amount,
            interval: formData.interval,
            maxPrice: formData.maxPrice,
            startDate: formData.startDate,
          };

        case "GridMarketMaking":
          return {
            amount: formData.amount,
            startPrice: formData.startPrice,
            endPrice: formData.endPrice,
            stepPct: formData.stepPct,
            stepMultiplier: formData.stepMultiplier,
            singleSide: formData.singleSide,
            tpPct: formData.tpPct,
          };

        case "MomentumReversal":
          return {
            amount: formData.amount,
            rsiPeriod: formData.rsiPeriod,
            rsimaPeriod: formData.rsimaPeriod,
            slPct: formData.slPct,
            tpPct: formData.tpPct,
          };

        case "RangeBreakout":
          return {
            amount: formData.amount,
            adxPeriod: formData.adxPeriod,
            adxmaPeriod: formData.adxmaPeriod,
            emaPeriod: formData.emaPeriod,
            slPct: formData.slPct,
            tpPct: formData.tpPct,
          };
        case "StopLimit":
          return {
            amount: formData.amount,
            stopPrice: formData.stopPrice,
            limitPrice: formData.limitPrice,
            expiry: formData.expiry,
          };
        case "ChaseLimit":
          return {
            amount: formData.amount,
            distancePct: formData.distancePct,
            expiry: formData.expiry,
            maxPrice: formData.maxPrice,
          };

        default:
          return {
            amount: formData.amount,
          };
      }
    };

    const relevantParams = getRelevantParams(orderType, data);

    const strategy = {
      id: new Date().toISOString(),
      name: orderType,
      type: orderType,
      config: relevantParams,
      // Include orderbook context if available
      context: orderDefaults
        ? {
            triggeredFromOrderbook: true,
            originalPrice: orderDefaults.price,
            isBuy: orderDefaults.isBuy,
            timestamp: orderDefaults.timestamp,
          }
        : null,
    };

    try {
      const response = await fetch("http://localhost:40005/strategies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(strategy),
      });

      if (response.ok) {
        toast.success("Strategy saved successfully");
        console.log("Strategy saved successfully");
        console.log("Submitted params:", relevantParams); // Debug log

        // Clear orderbook defaults after successful submission
        clearOrderDefaults();

        // Optionally reset form
        // reset();
      } else {
        toast.error("Failed to save strategy");
        console.error("Failed to save strategy");
      }
    } catch (error) {
      toast.error("An error occurred while saving the strategy");
      console.error("An error occurred while saving the strategy:", error);
    }
  };

  const handleClearOrderbookData = () => {
    clearOrderDefaults();
    toast.success("Cleared orderbook data");
  };

  return (
    <PanelWrapper>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold pl-4 pt-3 relative z-10 text-teal-600">
          Create Order
        </h2>

        {/* Show indicator if order was triggered from orderbook */}
        {orderDefaults && (
          <div className="flex items-center gap-2 pr-4 pt-3">
            <div className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full border border-yellow-500/30">
              From Orderbook
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearOrderbookData}
              className="text-slate-400 hover:text-white p-1 h-auto"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col bg-gradient-to-b from-black/95 via-slate-950/90 to-black/95 backdrop-blur-xl">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="h-full flex flex-col"
        >
          {/* Order Configuration - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Order Type & Category Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-teal-200">
                  Type & Parameters
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-teal-500/30 to-transparent"></div>
              </div>

              {/* Category Toggle */}
              <div className="flex bg-black/60 backdrop-blur-sm p-1 border border-slate-700/50">
                <Button
                  type="button"
                  onClick={() => {
                    setOrderCategory("Order");
                    setOrderType("TWAP");
                  }}
                  variant={orderCategory === "Order" ? "default" : "ghost"}
                  className={`flex-1 py-2 px-3 text-sm font-medium transition-all duration-300 ${
                    orderCategory === "Order"
                      ? "bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 text-white shadow-lg shadow-teal-500/25 border border-teal-300/30 hover:from-teal-500 hover:via-emerald-500 hover:to-cyan-500"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60 backdrop-blur-sm"
                  }`}
                >
                  Orders
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setOrderCategory("Strategy");
                    setOrderType("DCA");
                  }}
                  variant={orderCategory === "Strategy" ? "default" : "ghost"}
                  className={`flex-1 py-2 px-3 text-sm font-medium transition-all duration-300 ${
                    orderCategory === "Strategy"
                      ? "bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 text-white shadow-lg shadow-teal-500/25 border border-teal-400/30 hover:from-teal-500 hover:via-emerald-500 hover:to-cyan-500"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60 backdrop-blur-sm"
                  }`}
                >
                  Strategies
                </Button>
              </div>

              {/* Type Selection using shadcn Select */}
              <div className="relative">
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80">
                    <SelectValue placeholder="Select order type" />
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {orderTypes[orderCategory].map((type) => {
                      const IconComponent = type.icon;
                      return (
                        <SelectItem
                          key={type.id}
                          value={type.id}
                          className="text-white hover:bg-slate-800 focus:bg-slate-800"
                        >
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-4 h-4" />
                            <span>
                              {type.name} - {type.description}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Size in USD */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-teal-200 flex items-center gap-2">
                Size (USD)
                <div className="w-1 h-1 bg-teal-400"></div>
              </label>
              <Controller
                name="amount"
                control={control}
                rules={{ required: "Size is required" }}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="number"
                    step="0.01"
                    className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400/50 transition-all duration-300 hover:bg-black/80"
                    placeholder="Enter amount in USD"
                  />
                )}
              />
              {errors.amount && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <div className="w-1 h-1 bg-red-400"></div>
                  {errors.amount.message}
                </span>
              )}
            </div>

            {/* Dynamic Form Fields Based on Order Type */}
            <div className="space-y-3">
              <div className="border-t border-teal-500/20 pt-3 relative">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent"></div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-teal-100 flex items-center gap-2">
                    {
                      orderTypes[orderCategory].find((t) => t.id === orderType)
                        ?.name
                    }{" "}
                    Parameters
                    <div className="w-1 h-1 bg-emerald-400"></div>
                  </span>
                </div>

                {renderForm()}
              </div>
            </div>
          </div>

          {/* Footer with Submit Button */}
          <div className="border-t border-teal-500/20 bg-gradient-to-r from-black/95 via-slate-950/90 to-black/95 backdrop-blur-md p-4 flex-shrink-0 relative">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent"></div>

            <Button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 hover:from-teal-500 hover:via-emerald-500 hover:to-cyan-500 text-white font-medium text-sm transition-all duration-300 transform hover:scale-[1.02] border border-teal-400/30 backdrop-blur-sm relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative z-10">
                Create{" "}
                {
                  orderTypes[orderCategory].find((t) => t.id === orderType)
                    ?.name
                }{" "}
                {orderCategory}
              </span>
            </Button>

            {/* Info Footer */}
            <div className="mt-3 p-3 bg-black/40 backdrop-blur-sm border border-slate-600/30 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-emerald-500/5 to-cyan-500/5"></div>
              <div className="flex items-center gap-2 relative z-10">
                <Info className="w-3 h-3 text-teal-400 flex-shrink-0" />
                <div className="text-xs text-slate-300">
                  {orderCategory === "Order"
                    ? "Executed based on market conditions and parameters"
                    : "Runs continuously with automated strategy execution"}
                </div>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </PanelWrapper>
  );
};

export default CreateOrderForm;
