import { Controller } from "react-hook-form";
import { useState, useEffect } from "react";
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
import { DollarSign, TrendingUp, TrendingDown, Calendar, Percent } from "lucide-react";
 export const getDefaultExpiry = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 16);
  };
const RangeForm = ({ control, errors, watch }: any) => {
  const [priceRange, setPriceRange] = useState('±2%');
  const priceRangeOptions = [
    { value: '±0.5%', label: '±0.5%', orders: '~10' },
    { value: '±1%', label: '±1%', orders: '~8' },
    { value: '±2%', label: '±2%', orders: '~5' },
    { value: '±5%', label: '±5%', orders: '~3' },
    { value: '±10%', label: '±10%', orders: '~2' },
  ];

  const stepOptions = [
    { value: '0.1', label: '0.1%', description: 'Tight spread' },
    { value: '0.3', label: '0.3%', description: 'Standard' },
    { value: '0.5', label: '0.5%', description: 'Wide spread' },
    { value: '1.0', label: '1.0%', description: 'Very wide' },
  ];



  // Auto-fill prices when range changes
  const handleRangeChange = (range: string) => {
    setPriceRange(range);
    const percentage = parseFloat(range.replace('±', '').replace('%', ''));
    // You can auto-update the form values here if needed
  };

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
            required: 'Start price is required',
            min: { value: 0.01, message: 'Must be greater than $0' }
          }}
          defaultValue={0.00} 
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="number"
                step="0.01"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
                placeholder={'0.00'}
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
            required: 'End price is required',
            min: { value: 0.01, message: 'Must be greater than $0' }
          }}
          defaultValue={0.00} // spot - 2%
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="number"
                step="0.01"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
                placeholder={'0.00'}
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

      {/* Quick Range Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <Percent className="w-4 h-4" />
          Quick Range Selection
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <div className="grid grid-cols-5 gap-2">
          {priceRangeOptions.map((option) => (
            <div
              key={option.value}
              onClick={() => handleRangeChange(option.value)}
              className={`relative cursor-pointer transition-all duration-300 transform hover:scale-[1.02] ${
                priceRange === option.value
                  ? 'scale-[1.02]'
                  : 'hover:scale-[1.01]'
              }`}
            >
              {/* Background with gradient and glow effect */}
              <div className={`relative p-3 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
                priceRange === option.value
                  ? 'bg-gradient-to-br from-primary/80 via-primary/70 to-primary/80 border-primary/50 shadow-lg shadow-primary/25'
                  : 'bg-black/60 border-slate-600/40 hover:bg-black/80 hover:border-slate-500/60'
              }`}>
                
                {/* Selection indicator */}
                {priceRange === option.value && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-primary square shadow-lg"></div>
                )}
                
                {/* Content */}
                <div className="flex flex-col items-center space-y-1">
                  <div className={`text-sm font-semibold transition-colors duration-300 ${
                    priceRange === option.value
                      ? 'text-white'
                      : 'text-slate-200'
                  }`}>
                    {option.label}
                  </div>
                  
                </div>
                
                {/* Hover effect overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 via-primary/5 to-primary/5 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </div>
          ))}
        </div>
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
          rules={{ required: 'Step percentage is required' }}
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
                    className="text-white hover:bg-primary/30 focus:bg-primary/40 hover:text-primary-foreground focus:text-primary-foreground cursor-pointer transition-all duration-200"
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
        {errors.stepPct && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.stepPct.message}
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
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
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
      
      {/* Range Summary */}
      <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-primary/20 shadow-inner relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 via-primary/5 to-primary/5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-primary"></div>
            <div className="text-xs font-medium text-primary">Range Strategy Summary</div>
          </div>
          <div className="text-sm text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Strategy:</span>
              <span className="text-primary">Liquidity Range Position</span>
            </div>
            <div className="flex justify-between">
              <span>Execution:</span>
              <span className="text-primary">Automated market making</span>
            </div>
            <div className="flex justify-between">
              <span>Price Range:</span>
              <span className="text-primary">{priceRange} from current price</span>
            </div>
            <div className="flex justify-between">
              <span>Orders:</span>
              <span className="text-purple-400">~{priceRangeOptions.find(opt => opt.value === priceRange)?.orders || '5'} levels</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RangeForm;