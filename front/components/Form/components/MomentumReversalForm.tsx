import { Controller } from "react-hook-form";
import InputField from "./InputField";

const MomentumReversalForm = ({ control, errors }:any) => (
  <div className="space-y-6">
    <InputField label="RSI Threshold" error={errors.rsiThreshold}>
      <Controller
        name="rsiThreshold"
        control={control}
        rules={{ required: 'RSI threshold is required', min: { value: 1, message: 'Min 1' }, max: { value: 99, message: 'Max 99' } }}
        render={({ field }) => (
          <input
            {...field}
            type="number"
            min="1"
            max="99"
            className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
            placeholder="30"
          />
        )}
      />
    </InputField>
    
    <div className="grid grid-cols-2 gap-4">
      <InputField label="Stop Loss (%)" error={errors.stopLoss}>
        <Controller
          name="stopLoss"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="number"
              step="0.1"
              className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 backdrop-blur-sm shadow-lg"
              placeholder="5"
            />
          )}
        />
      </InputField>
      
      <InputField label="Take Profit (%)" error={errors.takeProfit}>
        <Controller
          name="takeProfit"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="number"
              step="0.1"
              className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
              placeholder="15"
            />
          )}
        />
      </InputField>
    </div>
  </div>
);
export default MomentumReversalForm;