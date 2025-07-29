import { Control, Controller, FieldErrors } from "react-hook-form";
import InputField from "./InputField";


const DCAForm = ({ control, errors }:any) => (
  <div className="space-y-6">
    <InputField label="Investment Amount per Period" error={errors.dcaAmount}>
      <Controller
        name="dcaAmount"
        control={control}
        rules={{ required: 'Amount is required' }}
        render={({ field }) => (
          <input
            {...field}
            type="number"
            step="0.01"
            className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
            placeholder="100"
          />
        )}
      />
    </InputField>
    
    <InputField label="Frequency" error={errors.dcaFrequency}>
      <Controller
        name="dcaFrequency"
        control={control}
        rules={{ required: 'Frequency is required' }}
        render={({ field }) => (
          <select
            {...field}
            className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white backdrop-blur-sm shadow-lg focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
          >
            <option value="">Select frequency</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        )}
      />
    </InputField>
  </div>
);
export default DCAForm;