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
import { Calendar, Clock, TrendingUp, Repeat } from "lucide-react";

const DCAForm = ({ control, errors }: any) => {
  const getDefaultStartDate = () => {
    return new Date().toISOString().slice(0, 16);
  };

  const intervalOptions = [
    {
      value: "1",
      label: "1 hour",
      orders: "~720/month",
      frequency: "Very High",
    },
    { value: "4", label: "4 hours", orders: "~180/month", frequency: "High" },
    {
      value: "12",
      label: "12 hours",
      orders: "~60/month",
      frequency: "Medium",
    },
    { value: "24", label: "1 day", orders: "~30/month", frequency: "Standard" },
    { value: "168", label: "1 week", orders: "~4/month", frequency: "Low" },
    {
      value: "720",
      label: "1 month",
      orders: "~1/month",
      frequency: "Very Low",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Start Date */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Start Date
          <div className="w-1 h-1 rounded-full bg-teal-400"></div>
        </Label>
        <Controller
          name="startDate"
          control={control}
          rules={{ required: "Start date is required" }}
          defaultValue={getDefaultStartDate()}
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
        {errors.startDate && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-red-400"></div>
            {errors.startDate.message}
          </span>
        )}
      </div>

      {/* Interval */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Investment Interval
          <div className="w-1 h-1 rounded-full bg-teal-400"></div>
        </Label>
        <Controller
          name="interval"
          control={control}
          rules={{ required: "Interval is required" }}
          defaultValue="24" // 1 day
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                <SelectValue placeholder="Select investment frequency" />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"></div>
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-slate-700/50 shadow-2xl">
                {intervalOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white hover:bg-teal-900/30 focus:bg-teal-900/40 hover:text-teal-100 focus:text-teal-100 cursor-pointer transition-all duration-200"
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                      </div>
                      <span className="text-xs text-teal-400 ml-2">
                        {option.orders}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.interval && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-red-400"></div>
            {errors.interval.message}
          </span>
        )}
      </div>

      {/* Max Price */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-teal-200 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Max Price (USD)
          <div className="w-1 h-1 rounded-full bg-teal-400"></div>
        </Label>
        <Controller
          name="maxPrice"
          control={control}
          rules={{
            min: { value: 0.01, message: "Must be greater than $0" },
          }}
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="number"
                step="0.01"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none"
                placeholder="No limit (optional)"
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
            <div className="w-1 h-1 rounded-full bg-red-400"></div>
            {errors.maxPrice.message}
          </span>
        )}
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <div className="w-1 h-1 rounded-full bg-slate-500"></div>
          Leave empty to buy at any price
        </div>
      </div>

      {/* DCA Summary */}
      <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-teal-500/20 shadow-inner relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-teal-500/5 via-emerald-500/5 to-cyan-500/5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-teal-400"></div>
            <div className="text-xs font-medium text-teal-300 flex items-center gap-1">
              <Repeat className="w-3 h-3" />
              DCA Strategy Summary
            </div>
          </div>
          <div className="text-sm text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Strategy:</span>
              <span className="text-teal-400">Dollar Cost Averaging</span>
            </div>
            <div className="flex justify-between">
              <span>Execution:</span>
              <span className="text-emerald-400">Recurring automated buys</span>
            </div>
            <div className="flex justify-between">
              <span>Risk Reduction:</span>
              <span className="text-cyan-400">Smooths price volatility</span>
            </div>
            <div className="flex justify-between">
              <span>Benefit:</span>
              <span className="text-purple-400">Reduces timing risk</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DCAForm;
