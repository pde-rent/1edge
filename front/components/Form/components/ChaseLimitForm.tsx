import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Navigation, Percent, Calendar, TrendingUp, DollarSign } from "lucide-react";

const ChaseLimitForm = ({ control, errors }: any) => {
  const spotPrice = 3750;

  const calculatePriceFromSpot = (percentage: number) => {
    return (spotPrice * (1 + percentage / 100)).toFixed(2);
  };

  const getDefaultExpiry = () => {
    const date = new Date();
    date.setDate(date.getDate() + 10);
    return date.toISOString().slice(0, 16);
  };

  const distanceOptions = [
    { value: "0.1", label: "0.1%", description: "Very tight chase" },
    { value: "0.25", label: "0.25%", description: "Tight chase" },
    { value: "0.5", label: "0.5%", description: "Standard chase" },
    { value: "1.0", label: "1.0%", description: "Moderate chase" },
    { value: "2.0", label: "2.0%", description: "Wide chase" },
    { value: "5.0", label: "5.0%", description: "Very wide chase" },
  ];

  return (
    <div className="space-y-6">
          <div className="space-y-2">
  <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
    <DollarSign className="w-4 h-4" />
    Amount (USD)
    <div className="w-1 h-1 bg-teal-400"></div>
  </Label>
  <Controller
    name="amount"
    control={control}
    rules={{
      required: "Amount is required",
      min: { value: 0.01, message: "Must be greater than $0" },
    }}
    render={({ field }) => (
      <div className="relative">
        <Input
          {...field}
          type="number"
          step="0.01"
          className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
          placeholder="Enter total amount"
        />
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
      </div>
    )}
  />
  {errors.size && (
    <span className="text-xs text-red-400 flex items-center gap-1">
      <div className="w-1 h-1 bg-red-400"></div>
      {errors.size.message}
    </span>
  )}
</div>
      {/* Distance Percentage */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <Percent className="w-4 h-4" />
          Chase Distance
          <div className="w-1 h-1 bg-teal-400"></div>
        </Label>
        <Controller
          name="distancePct"
          control={control}
          rules={{ required: "Distance percentage is required" }}
          defaultValue="0.5" // 0.5%
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select chase distance" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {distanceOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white hover:bg-teal-900/30 focus:bg-teal-900/40 hover:text-teal-100 focus:text-teal-100 cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start gap-2 items-center w-full min-w-[280px]">
                      <span className="text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="text-xs text-teal-400 font-medium">
                        {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.distancePct && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.distancePct.message}
          </span>
        )}
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <div className="w-1 h-1 bg-slate-500"></div>
          Distance to maintain behind the best bid/ask
        </div>
      </div>

      {/* Max Price */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Max Price (USD)
          <div className="w-1 h-1 bg-teal-400"></div>
        </Label>
        <Controller
          name="maxPrice"
          control={control}
          rules={{
            required: "Max price is required",
            min: { value: 0.01, message: "Must be greater than $0" },
          }}
          defaultValue={calculatePriceFromSpot(-0.5)} // spot - 0.5%
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="number"
                step="0.01"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
                placeholder={calculatePriceFromSpot(-0.5)}
              />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-slate-400">
                USD
              </div>
            </div>
          )}
        />
        {errors.maxPrice && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.maxPrice.message}
          </span>
        )}
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <div className="w-1 h-1 bg-slate-500"></div>
          Maximum price willing to pay while chasing
        </div>
      </div>

      {/* Expiry Date */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Expiry Date
          <div className="w-1 h-1 bg-teal-400"></div>
        </Label>
        <Controller
          name="expiry"
          control={control}
          rules={{ required: "Expiry date is required" }}
          defaultValue={getDefaultExpiry()}
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="datetime-local"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
              />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
            </div>
          )}
        />
        {errors.expiry && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.expiry.message}
          </span>
        )}
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <div className="w-1 h-1 bg-slate-500"></div>
          Order automatically cancels after this date
        </div>
      </div>

      {/* Chase Limit Summary */}
      <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-teal-500/20 shadow-inner relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 via-emerald-500/5 to-cyan-500/5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-teal-400"></div>
            <div className="text-xs font-medium text-teal-300 flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              Chase Limit Order Summary
            </div>
          </div>
          <div className="text-sm text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Order Type:</span>
              <span className="text-teal-400">Chase Limit Order</span>
            </div>
            <div className="flex justify-between">
              <span>Behavior:</span>
              <span className="text-emerald-400">Follows market movements</span>
            </div>
            <div className="flex justify-between">
              <span>Price Protection:</span>
              <span className="text-cyan-400">Limited by max price</span>
            </div>
            <div className="flex justify-between">
              <span>Best For:</span>
              <span className="text-purple-400">Volatile markets</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChaseLimitForm;
