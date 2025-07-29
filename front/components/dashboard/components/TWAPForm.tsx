import { Controller } from "react-hook-form";
import InputField from "./InputField";

const TWAPForm = ({ control, errors }:any) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4">
      <InputField label="Total Duration (min)" error={errors.twapDuration}>
        <Controller
          name="twapDuration"
          control={control}
          rules={{ required: 'Duration is required', min: { value: 1, message: 'Must be at least 1 minute' } }}
          render={({ field }) => (
            <input
              {...field}
              type="number"
              className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
              placeholder="60"
            />
          )}
        />
      </InputField>
      
      <InputField label="Execution Interval (min)" error={errors.twapInterval}>
        <Controller
          name="twapInterval"
          control={control}
          rules={{ required: 'Interval is required', min: { value: 1, message: 'Must be at least 1 minute' } }}
          render={({ field }) => (
            <input
              {...field}
              type="number"
              className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
              placeholder="5"
            />
          )}
        />
      </InputField>
    </div>
    
    <div className="bg-gradient-to-br from-emerald-800/20 to-emerald-900/20 backdrop-blur-xl rounded-xl p-4 border border-emerald-700/30 shadow-lg shadow-emerald-900/20">
      <div className="text-xs text-emerald-300 mb-1">Execution Summary</div>
      <div className="text-sm text-emerald-100">
        Automated execution every interval over total duration
      </div>
    </div>
  </div>
);

export default TWAPForm;