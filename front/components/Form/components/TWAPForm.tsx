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
import { Calendar, Clock, DollarSign, TrendingUp } from "lucide-react";
import OrderDirectionToggle from "./OrderDirectionToggle";

const TWAPForm = ({ control, errors }: any) => {
  const now = new Date();
  const oneMonthFromNow = new Date();
  oneMonthFromNow.setMonth(now.getMonth() + 1);

  const formatDateForInput = (date: Date) => {
    return date.toISOString().slice(0, 16);
  };

  const intervalOptions = [
    { value: "1", label: "1 hour", orders: "~720" },
    { value: "4", label: "4 hours", orders: "~180" },
    { value: "12", label: "12 hours", orders: "~60" },
    { value: "24", label: "1 day", orders: "~30" },
    { value: "48", label: "2 days", orders: "~15" },
    { value: "72", label: "3 days", orders: "~10" },
    { value: "168", label: "1 week", orders: "~4" },
  ];

  return (
    <div className="space-y-6">
      {/* Buy/Sell Toggle */}
      <OrderDirectionToggle control={control} />

      <div className="space-y-2">
  <Label className="text-sm font-medium text-primary">
    Amount (USD)
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
          className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:border-teal-400/50 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none pr-10"
          placeholder="Enter total amount"
        />
        <DollarSign className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
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
      {/* Start Date */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary">
          Start Date
        </Label>
        <Controller
          name="startDate"
          control={control}
          rules={{ required: "Start date is required" }}
          defaultValue={formatDateForInput(now)}
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="datetime-local"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/25 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none pr-10"
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
            </div>
          )}
        />
        {errors.startDate && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.startDate.message}
          </span>
        )}
      </div>

      {/* End Date */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary">
          End Date
        </Label>
        <Controller
          name="endDate"
          control={control}
          rules={{ required: "End date is required" }}
          defaultValue={formatDateForInput(oneMonthFromNow)}
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="datetime-local"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/25 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none pr-10"
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
            </div>
          )}
        />
        {errors.endDate && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.endDate.message}
          </span>
        )}
      </div>

      {/* Execution Interval */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary">
          Execution Interval
        </Label>
        <Controller
          name="interval"
          control={control}
          rules={{ required: "Interval is required" }}
          defaultValue="24"
          render={({ field }) => (
            <div className="relative">
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/25 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-primary/25 shadow-2xl">
                {intervalOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white hover:bg-primary/30 focus:bg-primary/40 hover:text-primary-foreground focus:text-primary-foreground cursor-pointer transition-all duration-200"
                  >
                    <div className="flex justify-between items-center w-full">
                      <span>{option.label}</span>
                      <span className="text-xs text-primary ml-2">
                        {option.orders} orders
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
              </Select>
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
            </div>
          )}
        />
        {errors.interval && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.interval.message}
          </span>
        )}
      </div>

      {/* Max Price */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-primary">
          Max Price (USD)
        </Label>
        <Controller
          name="maxPrice"
          control={control}
          rules={{
            required: "Max price is required",
            min: { value: 0.01, message: "Must be greater than $0" },
          }}
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                type="number"
                step="0.01"
                className="w-full bg-black/70 backdrop-blur-sm border-slate-600/50 text-white placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/25 shadow-inner transition-all duration-300 hover:bg-black/80 focus:outline-none pr-10"
                placeholder="No limit"
              />
              <TrendingUp className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>
            </div>
          )}
        />
        {errors.maxPrice && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <div className="w-1 h-1 bg-red-400"></div>
            {errors.maxPrice.message}
          </span>
        )}
      </div>

      {/* Execution Summary */}
      <div className="bg-primary/10 backdrop-blur-sm rounded-lg p-4 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs font-medium text-primary">
              TWAP Execution Summary
            </div>
          </div>
          <div className="text-sm text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Strategy:</span>
              <span className="text-primary">Time-Weighted Average Price</span>
            </div>
            <div className="flex justify-between">
              <span>Execution:</span>
              <span className="text-primary">
                Automated recurring orders
              </span>
            </div>
            <div className="flex justify-between">
              <span>Frequency:</span>
              <span className="text-cyan-400">Every selected interval</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TWAPForm;
