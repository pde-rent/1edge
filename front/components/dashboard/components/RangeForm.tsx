import { Controller } from "react-hook-form";
import InputField from "./InputField";
import { useState } from "react";
import GlassButton from "./GlassButton";

const RangeForm = ({ control, errors }:any) => {
  const [priceRange, setPriceRange] = useState('±1%');
  const [feeTier, setFeeTier] = useState('0.05%');
  
  const priceRanges = ['±0.5%', '±1%', '±5%', '±10%', 'Full Range'];
  const feeTiers = ['0.01%', '0.05%', '0.1%', '0.5%'];

  return (
    <div className="space-y-6">
      <div>
        <InputField label="Set Price Range (USDC per 1 ETH)" info>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <InputField label="Min Buy Price" error={errors.minBuyPrice}>
              <Controller
                name="minBuyPrice"
                control={control}
                rules={{ required: 'Min price is required' }}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
                    placeholder="3739.17"
                  />
                )}
              />
            </InputField>
            
            <InputField label="Max Sell Price" error={errors.maxSellPrice}>
              <Controller
                name="maxSellPrice"
                control={control}
                rules={{ required: 'Max price is required' }}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-3 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg"
                    placeholder="3814.71"
                  />
                )}
              />
            </InputField>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            {priceRanges.map((range) => (
              <GlassButton
                    key={range}
                active={priceRange === range}
                onClick={() => setPriceRange(range)}
              >
                {range}
              </GlassButton>
            ))}
          </div>
        </InputField>
      </div>

      <InputField label="Set Fee Tier" info>
        <div className="grid grid-cols-2 gap-2">
          {feeTiers.map((tier) => (
            <GlassButton
              key={tier}
              active={feeTier === tier}
              onClick={() => setFeeTier(tier)}
            >
              {tier}
            </GlassButton>
          ))}
        </div>
      </InputField>
    </div>
  );
};

export default RangeForm;