import { Controller } from "react-hook-form";
import InputField from "./InputField";

const TrendFollowingForm = ({ control, errors }:any) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4">
      <InputField label="Fast EMA Period" error={errors.fastEMA}>
        <Controller
          name="fastEMA"
          control={control}
          rules={{ required: 'Fast EMA is required' }}
          render={({ field }) => (
            <input
              {...field}
              type="number"
              min="1"
              className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
              placeholder="12"
            />
          )}
        />
      </InputField>
      
      <InputField label="Slow EMA Period" error={errors.slowEMA}>
        <Controller
          name="slowEMA"
          control={control}
          rules={{ required: 'Slow EMA is required' }}
          render={({ field }) => (
            <input
              {...field}
              type="number"
              min="1"
              className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
              placeholder="26"
            />
          )}
        />
      </InputField>
    </div>
  </div>
);
export default TrendFollowingForm;