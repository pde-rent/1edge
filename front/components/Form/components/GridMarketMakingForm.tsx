import { Controller } from "react-hook-form";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  TrendingDown,
  TrendingUp,
  Percent,
  ArrowUpDown,
  Target,
  Grid3X3,
} from "lucide-react";

const GridMarketMakingForm = ({ control, errors }: any) => {
  const [singleSide, setSingleSide] = useState(false);

  const spotPrice = 3750;
  const calculatePriceFromSpot = (percentage: number) => {
    return (spotPrice * (1 + percentage / 100)).toFixed(2);
  };

  const stepOptions = [
    { value: "0.1", label: "0.1%", description: "Tight grid", orders: "~10" },
    { value: "0.3", label: "0.3%", description: "Standard", orders: "~5" },
    { value: "0.5", label: "0.5%", description: "Wide grid", orders: "~3" },
    { value: "1.0", label: "1.0%", description: "Very wide", orders: "~2" },
  ];

  const multiplierOptions = [
    { value: "1.0", label: "1.0x", description: "Constant size" },
    { value: "1.1", label: "1.1x", description: "Gradual increase" },
    { value: "1.2", label: "1.2x", description: "Moderate increase" },
    { value: "1.5", label: "1.5x", description: "Aggressive increase" },
    { value: "2.0", label: "2.0x", description: "Double each level" },
  ];

  const takeProfitOptions = [
    { value: "0.5", label: "0.5%", description: "Conservative" },
    { value: "1.0", label: "1.0%", description: "Balanced" },
    { value: "2.0", label: "2.0%", description: "Aggressive" },
    { value: "5.0", label: "5.0%", description: "Very aggressive" },
  ];

  return (
    <div className="space-y-6">
      {/* Start Price */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <TrendingDown className="w-4 h-4" />
          Start Price (Lower Bound)
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="startPrice"
          control={control}
          rules={{
            required: "Start price is required",
            min: { value: 0.01, message: "Must be greater than $0" },
          }}
          defaultValue={calculatePriceFromSpot(-0.5)} // spot - 0.5%
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="number"
                step="0.01"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
                placeholder={calculatePriceFromSpot(-0.5)}
              />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-slate-400">
                USD
              </div>
            </div>
          )}
        />
        {errors.startPrice && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.startPrice.message}
          </span>
        )}
      </div>

      {/* End Price */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          End Price (Upper Bound)
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="endPrice"
          control={control}
          rules={{
            required: "End price is required",
            min: { value: 0.01, message: "Must be greater than $0" },
          }}
          defaultValue={calculatePriceFromSpot(-2)} // spot - 2%
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="number"
                step="0.01"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
                placeholder={calculatePriceFromSpot(-2)}
              />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-slate-400">
                USD
              </div>
            </div>
          )}
        />
        {errors.endPrice && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.endPrice.message}
          </span>
        )}
      </div>

      {/* Step Percentage */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <Percent className="w-4 h-4" />
          Step Percentage
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="stepPct"
          control={control}
          rules={{ required: "Step percentage is required" }}
          defaultValue="0.3"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select step percentage" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {stepOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white hover:bg-primary/30 focus:bg-primary/40 hover:text-primary-foreground focus:text-primary-foreground cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start items-center gap-2 w-full min-w-[280px]">
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">
                          {option.label}
                        </span>
                      </div>
                      <span className="text-xs text-primary font-medium">
                        {option.orders} orders
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.stepPct && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.stepPct.message}
          </span>
        )}
      </div>

      {/* Step Multiplier */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4" />
          Step Multiplier
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="stepMultiplier"
          control={control}
          rules={{ required: "Step multiplier is required" }}
          defaultValue="1.0"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select multiplier" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {multiplierOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white hover:bg-primary/30 focus:bg-primary/40 hover:text-primary-foreground focus:text-primary-foreground cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start gap-2 items-center w-full min-w-[280px]">
                      <span className="text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="text-xs text-primary font-medium">
                        {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.stepMultiplier && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.stepMultiplier.message}
          </span>
        )}
      </div>

      {/* Single Side Toggle */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <Grid3X3 className="w-4 h-4" />
          Single Side Mode
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="singleSide"
          control={control}
          defaultValue={true}
          render={({ field }) => (
            <div
              className="flex items-center justify-between p-3 bg-black/20 backdrop-blur-sm rounded-lg border border-slate-600/30 cursor-pointer transition-all duration-300 hover:bg-black/30"
              onClick={() => {
                const newValue = !field.value;
                field.onChange(newValue);
                setSingleSide(newValue);
              }}
            >
              <div className="flex flex-col">
                <span className="text-sm text-white font-medium">
                  {field.value ? "Single Side Trading" : "Both Sides Trading"}
                </span>
                <span className="text-xs text-slate-400">
                  {field.value
                    ? "Only place orders on one side of current price"
                    : "Place buy and sell orders around current price"}
                </span>
              </div>

              {/* Custom Toggle Switch */}
              <div
                className={`relative w-12 h-6 square transition-all duration-300 ${
                  field.value
                    ? "bg-gradient-to-r from-primary to-primary"
                    : "bg-slate-600"
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white square shadow-lg transition-transform duration-300 ${
                    field.value ? "translate-x-6" : "translate-x-0"
                  }`}
                ></div>
              </div>
            </div>
          )}
        />
      </div>

      {/* Take Profit Percentage */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <Target className="w-4 h-4" />
          Take Profit Percentage
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="tpPct"
          control={control}
          rules={{
            min: { value: 0.1, message: "Must be at least 0.1%" },
          }}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select take profit percentage" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {takeProfitOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white hover:bg-primary/30 focus:bg-primary/40 hover:text-primary-foreground focus:text-primary-foreground cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start gap-2 items-center w-full min-w-[280px]">
                      <span className="text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="text-xs text-primary font-medium">
                        {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.tpPct && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.tpPct.message}
          </span>
        )}
      </div>

      {/* Grid Summary */}
      <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-primary/20 shadow-inner relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 via-primary/5 to-primary/5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-primary"></div>
            <div className="text-xs font-medium text-primary flex items-center gap-1">
              <Grid3X3 className="w-3 h-3" />
              Grid Market Making Summary
            </div>
          </div>
          <div className="text-sm text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Strategy:</span>
              <span className="text-primary">Automated Market Making</span>
            </div>
            <div className="flex justify-between">
              <span>Execution:</span>
              <span className="text-primary">
                {singleSide ? "Single side" : "Both sides"} grid
              </span>
            </div>
            <div className="flex justify-between">
              <span>Profit Method:</span>
              <span className="text-primary">Buy low, sell high</span>
            </div>
            <div className="flex justify-between">
              <span>Risk Level:</span>
              <span className="text-purple-400">Medium to High</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GridMarketMakingForm;
