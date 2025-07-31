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
import RangeForm from "./components/RangeForm";
import IcebergForm from "./components/IcebergForm";
import DCAForm from "./components/DSAForm";
import GridMarketMakingForm from "./components/GridMarketMakingForm";
import MomentumReversalForm from "./components/MomentumReversalForm";
import RangeBreakoutForm from "./components/RangeBreakoutForm";
import StopLimitForm from "./components/StopLimitForm";
import ChaseLimitForm from "./components/ChaseLimitForm";
import { toast } from "sonner";
import { useOrderStore } from "@/stores/orderStore";
import {
  FormData,
  OrderType,
  getDefaultFormValues,
  getRelevantParams,
  applyOrderDefaults,
} from "./helpers";
import {
  useAccount,
  useSignMessage,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { v4 as uuidv4 } from "uuid";

// Order Type Enum to match API
export enum APIOrderType {
  // One-off Orders
  STOP_LIMIT = "STOP_LIMIT",
  CHASE_LIMIT = "CHASE_LIMIT",
  TWAP = "TWAP",
  RANGE = "RANGE",
  ICEBERG = "ICEBERG",
  // Recurring Orders
  DCA = "DCA", // Dollar-Cost Averaging
  GRID_TRADING = "GRID_TRADING",
  MOMENTUM_REVERSAL = "MOMENTUM_REVERSAL",
  RANGE_BREAKOUT = "RANGE_BREAKOUT",
}

// Map internal order types to API order types
const ORDER_TYPE_MAPPING: Record<string, APIOrderType> = {
  TWAP: APIOrderType.TWAP,
  Range: APIOrderType.RANGE,
  Iceberg: APIOrderType.ICEBERG,
  StopLimit: APIOrderType.STOP_LIMIT,
  ChaseLimit: APIOrderType.CHASE_LIMIT,
  DCA: APIOrderType.DCA,
  GridMarketMaking: APIOrderType.GRID_TRADING,
  MomentumReversal: APIOrderType.MOMENTUM_REVERSAL,
  RangeBreakout: APIOrderType.RANGE_BREAKOUT,
};

// Environment variables
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:40005";
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

// ERC20 ABI for allowance
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      {
        name: "_spender",
        type: "address",
      },
      {
        name: "_value",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

const CreateOrderForm = () => {
  const [orderCategory, setOrderCategory] = useState<"Order" | "Strategy">(
    "Order",
  );
  const [orderType, setOrderType] = useState<string>("TWAP");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  const [pendingAllowance, setPendingAllowance] = useState(false);

  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();

  const {
    orderDefaults,
    clearOrderDefaults,
    orderSettings,
    setOrderFormOpen,
    updateFormData,
    setCurrentOrderType,
    clearFormData,
    currentFormData,
    currentPair,
    makerAsset,
    takerAsset,
    setPairInfo,
  } = useOrderStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<FormData>({
    defaultValues: getDefaultFormValues(),
  });

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
      applyOrderDefaults(orderDefaults, setValue);

      // Show notification
      toast.success(
        `Pre-filled ${orderDefaults.orderType} order at $${orderDefaults.price}`,
        {
          action: {
            label: "Clear",
            onClick: () => clearOrderDefaults(),
          },
        },
      );
    }
  }, [orderDefaults, setValue, clearOrderDefaults]);

  useEffect(() => {
    setCurrentOrderType(orderType);
  }, [orderType, setCurrentOrderType]);

  useEffect(() => {
    const subscription = watch((data) => {
      // Only sync non-empty values to avoid unnecessary updates
      const filteredData = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== "" && value !== undefined && value !== null) {
          acc[key as keyof FormData] = value;
        }
        return acc;
      }, {} as Partial<FormData>);

      updateFormData(filteredData);
    });

    return () => subscription.unsubscribe();
  }, [watch, updateFormData]);

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

  const createOrderPayload = (data: FormData, relevantParams: any) => {
    const orderId = uuidv4();
    const apiOrderType = ORDER_TYPE_MAPPING[orderType];

    return {
      id: orderId,
      type: apiOrderType,
      pair: currentPair || `${data.fromCoin}/${data.toCoin}`,
      size: parseFloat(data.size),
      maker: address,
      makerAsset: makerAsset,
      takerAsset: takerAsset,
      params: relevantParams,
    };
  };

  const createAndValidateOrder = async (
    orderPayload: any,
    signature: string,
    userSignedPayload: string,
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...orderPayload,
          signature,
          userSignedPayload,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Order creation failed");
      }

      return await response.json();
    } catch (error) {
      console.error("Order creation error:", error);
      throw error;
    }
  };

  const handleAllowance = async (tokenAddress: string, amount: string) => {
    try {
      setPendingAllowance(true);
      toast.info("Please approve token allowance in your wallet...");

      const txHash = await writeContractAsync({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, BigInt(amount)],
      });

      toast.success("Allowance approved! Transaction submitted.");
      return txHash;
    } catch (error) {
      console.error("Allowance error:", error);
      toast.error("Failed to approve allowance");
      throw error;
    } finally {
      setPendingAllowance(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!address) {
      toast.error("Please connect your wallet");
      return;
    }

    setIsSubmitting(true);
    setOrderCreated(false);

    try {
      const relevantParams = getRelevantParams(orderType, data);
      const orderPayload = createOrderPayload(data, relevantParams);

      // Step 1: Sign the order payload (free signature)
      toast.info("Please sign the order...");
      const messageToSign = JSON.stringify(orderPayload);
      const signature = await signMessageAsync({
        message: messageToSign,
      });

      // Step 2: Create and validate order in one API call
      toast.info("Creating order...");
      const result = await createAndValidateOrder(
        orderPayload,
        signature,
        messageToSign,
      );

      if (result.success) {
        setOrderCreated(true);
        toast.success("Order created successfully!");

        // Step 3: Now handle allowance after successful order creation
        toast.info("Order created! Now please approve token allowance...");
        const allowanceTxHash = await handleAllowance(
          makerAsset || "0x0000000000000000000000000000000000000000",
          (parseFloat(data.size) * 1e18).toString(), // Convert to wei equivalent
        );

        toast.success("Complete! Order is now active and allowance approved.");

        // Clear orderbook defaults and form data after successful submission
        clearOrderDefaults();
        clearFormData();

        // Reset form state and form fields
        setOrderCreated(false);
        reset(); // Reset react-hook-form to default values

        console.log("Order created successfully:", result);
        console.log("Submitted params:", relevantParams);
        console.log("Pair info:", { currentPair, makerAsset, takerAsset });
        console.log("Allowance tx hash:", allowanceTxHash);
      } else {
        toast.error(result.message || "Order creation failed");
      }
    } catch (error) {
      toast.error(error.message || "Failed to submit order");
      console.error("Order submission error:", error);
      setOrderCreated(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearOrderbookData = () => {
    clearOrderDefaults();
    clearFormData();
    setOrderCreated(false);
    toast.success("Cleared orderbook data");
  };

  const getButtonText = () => {
    if (!address) return "Connect Wallet";
    if (isSubmitting) {
      if (orderCreated && pendingAllowance) {
        return "Approving Allowance...";
      }
      return "Creating Order...";
    }
    const orderTypeName = orderTypes[orderCategory].find(
      (t) => t.id === orderType,
    )?.name;
    return `Create ${orderTypeName} ${orderCategory}`;
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
                name="size"
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
              {errors.size && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <div className="w-1 h-1 bg-red-400"></div>
                  {errors.size.message}
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
              disabled={isSubmitting || !address}
              className="w-full py-3 bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 hover:from-teal-500 hover:via-emerald-500 hover:to-cyan-500 text-white font-medium text-sm transition-all duration-300 transform hover:scale-[1.02] border border-teal-400/30 backdrop-blur-sm relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative z-10">{getButtonText()}</span>
            </Button>

            {/* Info Footer */}
            <div className="mt-3 p-3 bg-black/40 backdrop-blur-sm border border-slate-600/30 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-emerald-500/5 to-cyan-500/5"></div>
              <div className="flex items-center gap-2 relative z-10">
                <Info className="w-3 h-3 text-teal-400 flex-shrink-0" />
                <div className="text-xs text-slate-300">
                  {orderCreated
                    ? "Order created successfully! Please approve allowance to activate."
                    : orderCategory === "Order"
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
