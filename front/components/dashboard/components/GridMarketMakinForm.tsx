import { Controller } from "react-hook-form";
import InputField from "./InputField";
import GlassButton from "./GlassButton";
import { useState } from "react";

const GridMarketMakingForm = ({ control, errors }:any) => {
  const [strategyType, setStrategyType] = useState('constant');

  return (
    <div className="space-y-6">
      <InputField label="Strategy Type">
        <div className="grid grid-cols-2 gap-3">
          <GlassButton
            active={strategyType === 'constant'}
            onClick={() => setStrategyType('constant')}
          >
            Constant
          </GlassButton>
          <GlassButton
            active={strategyType === 'martingale'}
            onClick={() => setStrategyType('martingale')}
          >
            Martingale
          </GlassButton>
        </div>
      </InputField>
      
      <div className="grid grid-cols-2 gap-4">
        <InputField label="Lower Bound" error={errors.gridLower}>
          <Controller
            name="gridLower"
            control={control}
            rules={{ required: 'Lower bound is required' }}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
                placeholder="3500.00"
              />
            )}
          />
        </InputField>
        
        <InputField label="Upper Bound" error={errors.gridUpper}>
          <Controller
            name="gridUpper"
            control={control}
            rules={{ required: 'Upper bound is required' }}
            render={({ field }) => (
              <input
                {...field}
                type="number"
                step="0.01"
                className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
                placeholder="4000.00"
              />
            )}
          />
        </InputField>
      </div>
      
      <InputField label="Grid Levels" error={errors.gridLevels}>
        <Controller
          name="gridLevels"
          control={control}
          rules={{ required: 'Grid levels required', min: { value: 3, message: 'Minimum 3 levels' } }}
          render={({ field }) => (
            <input
              {...field}
              type="number"
              min="3"
              max="50"
              className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
              placeholder="10"
            />
          )}
        />
      </InputField>
    </div>
  );
};
export default GridMarketMakingForm;