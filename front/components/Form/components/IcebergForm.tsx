import { Controller } from "react-hook-form";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Calendar, Eye, EyeOff, Hash } from "lucide-react";
import OrderDirectionToggle from "./OrderDirectionToggle";

const IcebergForm = ({ control, errors }: any) => {
  const spotPrice = 3750; 
  
  const calculatePriceFromSpot = (percentage: number) => {
    return (spotPrice * (1 + percentage / 100)).toFixed(2);
  };

  
  const getDefaultExpiry = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 16);
  };

  const stepOptions = [
    { value: '5', label: '5 steps', description: 'Large chunks' },
    { value: '10', label: '10 steps', description: 'Standard' },
    { value: '20', label: '20 steps', description: 'Small chunks' },
    { value: '50', label: '50 steps', description: 'Micro chunks' },
    { value: '100', label: '100 steps', description: 'Ultra stealth' },
  ];

  return (
    <div className="space-y-6">
      {/* Buy/Sell Toggle */}
      <OrderDirectionToggle control={control} />
      
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
      {/* Start Price */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <TrendingDown className="w-4 h-4" />
          Start Price
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="startPrice"
          control={control}
          rules={{ 
            required: 'Start price is required',
            min: { value: 0.01, message: 'Must be greater than $0' }
          }}
          defaultValue={calculatePriceFromSpot(0)} // Current spot price
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="number"
                step="0.01"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/25 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
                placeholder={calculatePriceFromSpot(0)}
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
          End Price
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="endPrice"
          control={control}
          rules={{ 
            required: 'End price is required',
            min: { value: 0.01, message: 'Must be greater than $0' }
          }}
          defaultValue={calculatePriceFromSpot(-0.5)} // spot - 0.5%
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="number"
                step="0.01"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/25 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
                placeholder={calculatePriceFromSpot(-0.5)}
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

      {/* Steps */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <Hash className="w-4 h-4" />
          Execution Steps
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="steps"
          control={control}
          rules={{ required: 'Steps are required' }}
          defaultValue="10"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/25 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select number of steps" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-primary/25 shadow-2xl">
                {stepOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="text-white hover:bg-primary/20 focus:bg-primary/30 hover:text-white focus:text-white cursor-pointer transition-all duration-200"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span>{option.label}</span>
                      <span className="text-xs text-primary ml-2">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.steps && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.steps.message}
          </span>
        )}
      </div>

      {/* Expiry Date */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Expiry Date
          <div className="w-1 h-1 bg-primary"></div>
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
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/25 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
              />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
            </div>
          )}
        />
        {errors.expiry && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.expiry.message}
          </span>
        )}
      </div>
      
      {/* Iceberg Summary */}
      <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-primary/20 shadow-inner relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-primary"></div>
            <div className="text-xs font-medium text-primary flex items-center gap-1">
              <EyeOff className="w-3 h-3" />
              Iceberg Execution Summary
            </div>
          </div>
          <div className="text-sm text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Strategy:</span>
              <span className="text-primary">Hidden Order Execution</span>
            </div>
            <div className="flex justify-between">
              <span>Execution:</span>
              <span className="text-slate-300">Stealth progressive fills</span>
            </div>
            <div className="flex justify-between">
              <span>Visibility:</span>
              <span className="text-slate-300">Only small portions shown</span>
            </div>
            <div className="flex justify-between">
              <span>Market Impact:</span>
              <span className="text-slate-300">Minimized slippage</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IcebergForm;