import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, TrendingDown, Calendar, DollarSign } from "lucide-react";

const StopLimitForm = ({ control, errors }: any) => {
  // Mock spot price - in real app this would come from an API
  const spotPrice = 3750; // Current ETH price
  
  // Calculate default prices based on spot
  const calculatePriceFromSpot = (percentage: number) => {
    return (spotPrice * (1 + percentage / 100)).toFixed(2);
  };

  // Calculate default expiry (10 days from now)
  const getDefaultExpiry = () => {
    const date = new Date();
    date.setDate(date.getDate() + 10);
    return date.toISOString().slice(0, 16);
  };

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
      {/* Stop Price */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Stop Price (Trigger)
          <div className="w-1 h-1 bg-teal-400"></div>
        </Label>
        <Controller
          name="stopPrice"
          control={control}
          rules={{ 
            required: 'Stop price is required',
            min: { value: 0.01, message: 'Must be greater than $0' }
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
        {errors.stopPrice && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.stopPrice.message}
          </span>
        )}
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <div className="w-1 h-1 bg-slate-500"></div>
          Order triggers when market price reaches this level
        </div>
      </div>

      {/* Limit Price */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <TrendingDown className="w-4 h-4" />
          Limit Price (Execution)
          <div className="w-1 h-1 bg-teal-400"></div>
        </Label>
        <Controller
          name="limitPrice"
          control={control}
          rules={{ 
            required: 'Limit price is required',
            min: { value: 0.01, message: 'Must be greater than $0' }
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
        {errors.limitPrice && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.limitPrice.message}
          </span>
        )}
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <div className="w-1 h-1 bg-slate-500"></div>
          Maximum price you're willing to pay when triggered
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
          rules={{ required: 'Expiry date is required' }}
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
      
      {/* Stop Limit Summary */}
      <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-teal-500/20 shadow-inner relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 via-emerald-500/5 to-cyan-500/5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-teal-400"></div>
            <div className="text-xs font-medium text-teal-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Stop Limit Order Summary
            </div>
          </div>
          <div className="text-sm text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Order Type:</span>
              <span className="text-teal-400">Stop Limit Order</span>
            </div>
            <div className="flex justify-between">
              <span>Execution:</span>
              <span className="text-emerald-400">Triggered at stop price</span>
            </div>
            <div className="flex justify-between">
              <span>Price Control:</span>
              <span className="text-cyan-400">Limited by limit price</span>
            </div>
            <div className="flex justify-between">
              <span>Use Case:</span>
              <span className="text-purple-400">Risk management & entries</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StopLimitForm;