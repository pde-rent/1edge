import { Controller } from "react-hook-form";
import GlassButton from "./GlassButton";
import InputField from "./InputField";
import { useState } from "react";

const RangeBreakoutForm = ({ control, errors }:any) => {
  const [indicator, setIndicator] = useState('ADX');

  return (
    <div className="space-y-6">
      <InputField label="Breakout Indicator">
        <div className="grid grid-cols-2 gap-3">
          <GlassButton
            active={indicator === 'ADX'}
            onClick={() => setIndicator('ADX')}
          >
            ADX
          </GlassButton>
          <GlassButton
            active={indicator === 'trendlines'}
            onClick={() => setIndicator('trendlines')}
          >
            Trendlines
          </GlassButton>
        </div>
      </InputField>
      
      <InputField label="Breakout Threshold" error={errors.breakoutThreshold}>
        <Controller
          name="breakoutThreshold"
          control={control}
          rules={{ required: 'Threshold is required' }}
          render={({ field }) => (
            <input
              {...field}
              type="number"
              step="0.1"
              className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
              placeholder="25"
            />
          )}
        />
      </InputField>
    </div>
  );
};
export default RangeBreakoutForm;