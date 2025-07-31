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
import { Activity, Clock,Target, Shield } from "lucide-react";

const MomentumReversalForm = ({ control, errors }: any) => {
  const rsiPeriodOptions = [
    { value: '6', label: '6 hours', description: 'Very sensitive' },
    { value: '12', label: '12 hours', description: 'Standard' },
    { value: '24', label: '24 hours', description: 'Balanced' },
    { value: '48', label: '48 hours', description: 'Less sensitive' },
    { value: '72', label: '72 hours', description: 'Conservative' },
  ];

  const rsimaPeriodOptions = [
    { value: '6', label: '6 hours', description: 'Quick smoothing' },
    { value: '12', label: '12 hours', description: 'Standard smoothing' },
    { value: '24', label: '24 hours', description: 'Smooth signals' },
    { value: '48', label: '48 hours', description: 'Very smooth' },
  ];

  const takeProfitOptions = [
    { value: '0.5', label: '0.5%', description: 'Conservative' },
    { value: '1.0', label: '1.0%', description: 'Moderate' },
    { value: '2.0', label: '2.0%', description: 'Standard' },
    { value: '3.0', label: '3.0%', description: 'Aggressive' },
    { value: '5.0', label: '5.0%', description: 'Very aggressive' },
  ];

  const stopLossOptions = [
    { value: '0.5', label: '0.5%', description: 'Tight protection' },
    { value: '1.0', label: '1.0%', description: 'Standard protection' },
    { value: '2.0', label: '2.0%', description: 'Moderate protection' },
    { value: '3.0', label: '3.0%', description: 'Loose protection' },
    { value: '5.0', label: '5.0%', description: 'Wide protection' },
  ];

  return (
    <div className="space-y-6">
      
      {/* RSI Period */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <Activity className="w-4 h-4" />
          RSI Period
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="rsiPeriod"
          control={control}
          rules={{ required: 'RSI period is required' }}
          defaultValue="12" // 12 hours
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select RSI period" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {rsiPeriodOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="text-white hover:bg-primary/30 focus:bg-primary/40 hover:text-primary-foreground focus:text-primary-foreground cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start gap-2 items-center w-full min-w-[280px]">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-primary font-medium">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.rsiPeriod && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.rsiPeriod.message}
          </span>
        )}
      </div>

      {/* RSI MA Period */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <Clock className="w-4 h-4" />
          RSI MA Period
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="rsimaPeriod"
          control={control}
          rules={{ required: 'RSI MA period is required' }}
          defaultValue="12" // 12 hours
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select RSI MA period" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {rsimaPeriodOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="text-white hover:bg-primary/30 focus:bg-primary/40 hover:text-primary-foreground focus:text-primary-foreground cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start gap-2 items-center w-full min-w-[280px]">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-primary font-medium">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.rsimaPeriod && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.rsimaPeriod.message}
          </span>
        )}
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
            required: 'Take profit percentage is required',
            min: { value: 0.1, message: 'Must be at least 0.1%' }
          }}
          defaultValue="2.0" // 2%
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
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-primary font-medium">{option.description}</span>
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

      {/* Stop Loss Percentage */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Stop Loss Percentage
          <div className="w-1 h-1 bg-primary"></div>
        </Label>
        <Controller
          name="slPct"
          control={control}
          rules={{ 
            required: 'Stop loss percentage is required',
            min: { value: 0.1, message: 'Must be at least 0.1%' }
          }}
          defaultValue="1.0" // 1%
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select stop loss percentage" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {stopLossOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="text-white hover:bg-primary/30 focus:bg-primary/40 hover:text-primary-foreground focus:text-primary-foreground cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start gap-2 items-center w-full min-w-[280px]">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-primary font-medium">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.slPct && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.slPct.message}
          </span>
        )}
      </div>
      
      {/* Momentum Reversal Summary */}
      <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-primary/20 shadow-inner relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 via-primary/5 to-primary/5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-primary"></div>
            <div className="text-xs font-medium text-teal-300 flex items-center gap-1">
              Momentum Reversal Summary
            </div>
          </div>
          <div className="text-sm text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Strategy:</span>
              <span className="text-primary">RSI Momentum Reversal</span>
            </div>
            <div className="flex justify-between">
              <span>Signal Type:</span>
              <span className="text-emerald-400">Oversold/Overbought reversal</span>
            </div>
            <div className="flex justify-between">
              <span>Risk Management:</span>
              <span className="text-cyan-400">Stop loss & take profit</span>
            </div>
            <div className="flex justify-between">
              <span>Best Market:</span>
              <span className="text-purple-400">Range-bound conditions</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MomentumReversalForm;