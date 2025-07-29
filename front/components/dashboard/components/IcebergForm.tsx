import { Controller } from "react-hook-form";
import InputField from "./InputField";

const IcebergForm = ({ control, errors }:any) => (
  <div className="space-y-6">
    <InputField label="Total Order Size" error={errors.totalSize}>
      <Controller
        name="totalSize"
        control={control}
        rules={{ required: 'Total size is required' }}
        render={({ field }) => (
          <input
            {...field}
            type="number"
            step="0.01"
            className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
            placeholder="10.0"
          />
        )}
      />
    </InputField>
    
    <InputField label="Hidden Size per Order" error={errors.hiddenSize}>
      <Controller
        name="hiddenSize"
        control={control}
        rules={{ required: 'Hidden size is required' }}
        render={({ field }) => (
          <input
            {...field}
            type="number"
            step="0.01"
            className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
            placeholder="1.0"
          />
        )}
      />
    </InputField>
  </div>
);
export default IcebergForm;