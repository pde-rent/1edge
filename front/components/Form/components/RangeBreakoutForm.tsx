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
import { Zap, BarChart3, Clock, TrendingUp, Target, Shield } from "lucide-react";

const RangeBreakoutForm = ({ control, errors }: any) => {
  const adxPeriodOptions = [
    { value: '6', label: '6 hours', description: 'Very sensitive' },
    { value: '12', label: '12 hours', description: 'Standard' },
    { value: '24', label: '24 hours', description: 'Balanced' },
    { value: '48', label: '48 hours', description: 'Less sensitive' },
    { value: '72', label: '72 hours', description: 'Conservative' },
  ];

  const adxmaPeriodOptions = [
    { value: '6', label: '6 hours', description: 'Quick smoothing' },
    { value: '12', label: '12 hours', description: 'Standard smoothing' },
    { value: '24', label: '24 hours', description: 'Smooth signals' },
    { value: '48', label: '48 hours', description: 'Very smooth' },
  ];

  const emaPeriodOptions = [
    { value: '6', label: '6 hours', description: 'Fast response' },
    { value: '12', label: '12 hours', description: 'Standard response' },
    { value: '24', label: '24 hours', description: 'Balanced response' },
    { value: '48', label: '48 hours', description: 'Slow response' },
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
      
      {/* ADX Period */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          ADX Period
          <div className="w-1 h-1 rounded-full bg-teal-400"></div>
        </Label>
        <Controller
          name="adxPeriod"
          control={control}
          rules={{ required: 'ADX period is required' }}
          defaultValue="12" // 12 hours
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select ADX period" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {adxPeriodOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="text-white hover:bg-teal-900/30 focus:bg-teal-900/40 hover:text-teal-100 focus:text-teal-100 cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start gap-2 items-center w-full min-w-[280px]">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-teal-400 font-medium">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.adxPeriod && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-red-400"></div>
            {errors.adxPeriod.message}
          </span>
        )}
      </div>

      {/* ADX MA Period */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          ADX MA Period
          <div className="w-1 h-1 rounded-full bg-teal-400"></div>
        </Label>
        <Controller
          name="adxmaPeriod"
          control={control}
          rules={{ required: 'ADX MA period is required' }}
          defaultValue="12" // 12 hours
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select ADX MA period" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {adxmaPeriodOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="text-white hover:bg-teal-900/30 focus:bg-teal-900/40 hover:text-teal-100 focus:text-teal-100 cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start gap-2 items-center w-full min-w-[280px]">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-teal-400 font-medium">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.adxmaPeriod && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-red-400"></div>
            {errors.adxmaPeriod.message}
          </span>
        )}
      </div>

      {/* EMA Period */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          EMA Period
          <div className="w-1 h-1 rounded-full bg-teal-400"></div>
        </Label>
        <Controller
          name="emaPeriod"
          control={control}
          rules={{ required: 'EMA period is required' }}
          defaultValue="12" // 12 hours
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select EMA period" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {emaPeriodOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="text-white hover:bg-teal-900/30 focus:bg-teal-900/40 hover:text-teal-100 focus:text-teal-100 cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start gap-2 items-center w-full min-w-[280px]">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-teal-400 font-medium">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.emaPeriod && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-red-400"></div>
            {errors.emaPeriod.message}
          </span>
        )}
      </div>

      {/* Take Profit Percentage */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Take Profit Percentage
          <div className="w-1 h-1 rounded-full bg-teal-400"></div>
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
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select take profit percentage" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {takeProfitOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="text-white hover:bg-teal-900/30 focus:bg-teal-900/40 hover:text-teal-100 focus:text-teal-100 cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start gap-2 items-center w-full min-w-[280px]">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-teal-400 font-medium">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.tpPct && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-red-400"></div>
            {errors.tpPct.message}
          </span>
        )}
      </div>

      {/* Stop Loss Percentage */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Stop Loss Percentage
          <div className="w-1 h-1 rounded-full bg-teal-400"></div>
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
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select stop loss percentage" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {stopLossOptions.map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value}
                    className="text-white hover:bg-teal-900/30 focus:bg-teal-900/40 hover:text-teal-100 focus:text-teal-100 cursor-pointer transition-all duration-200 py-3"
                  >
                    <div className="flex justify-start gap-2 items-center w-full min-w-[280px]">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-teal-400 font-medium">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.slPct && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-red-400"></div>
            {errors.slPct.message}
          </span>
        )}
      </div>
      
      {/* Range Breakout Summary */}
      <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-teal-500/20 shadow-inner relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 via-emerald-500/5 to-cyan-500/5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-teal-400"></div>
            <div className="text-xs font-medium text-teal-300 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Range Breakout Summary
            </div>
          </div>
          <div className="text-sm text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Strategy:</span>
              <span className="text-teal-400">ADX-EMA Breakout Detection</span>
            </div>
            <div className="flex justify-between">
              <span>Signal Type:</span>
              <span className="text-emerald-400">Range breakout confirmation</span>
            </div>
            <div className="flex justify-between">
              <span>Risk Management:</span>
              <span className="text-cyan-400">Stop loss & take profit</span>
            </div>
            <div className="flex justify-between">
              <span>Best Market:</span>
              <span className="text-purple-400">Strong trending conditions</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RangeBreakoutForm;