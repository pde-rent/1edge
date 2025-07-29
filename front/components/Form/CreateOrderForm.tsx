// @ts-nocheck
'use client'
import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  ChevronDown,
  TrendingUp,
  BarChart3,
  Grid3X3,
  Clock,
  Info,
  Repeat,
  Activity,
  Target,
  Zap,
  DollarSign,
  Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import TWAPForm from './components/TWAPForm';
import RangeForm from './components/RangeForm';
import IcebergForm from './components/IcebergForm';
import DCAForm from './components/DSAForm';
import GridMarketMakingForm from './components/GridMarketMakingForm';
import MomentumReversalForm from './components/MomentumReversalForm';
import RangeBreakoutForm from './components/RangeBreakoutForm';
import TrendFollowingForm from './components/TrendFollowingStrategyForm';

export interface FormData {
  twapDuration: string;
  twapInterval: string;
  minBuyPrice: string;
  maxSellPrice: string;
  totalSize: string;
  hiddenSize: string;
  dcaAmount: string;
  dcaFrequency: string;
  gridLower: string;
  gridUpper: string;
  gridLevels: string;
  rsiThreshold: string;
  stopLoss: string;
  takeProfit: string;
  breakoutThreshold: string;
  fastEMA: string;
  slowEMA: string;
  budgetAmount?: string;
  fromCoin: string;
  toCoin: string;
}

export interface OrderType {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
}

export interface Coin {
  symbol: string;
  name: string;
  icon: string;
}

const CreateOrderForm = () => {
  const [orderCategory, setOrderCategory] = useState<'Order' | 'Strategy'>('Order');
  const [orderType, setOrderType] = useState<string>('TWAP');

  const { control, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormData>({
    defaultValues: {
      twapDuration: '60',
      twapInterval: '5',
      minBuyPrice: '3739.17',
      maxSellPrice: '3814.71',
      totalSize: '',
      hiddenSize: '',
      dcaAmount: '',
      dcaFrequency: '',
      gridLower: '',
      gridUpper: '',
      gridLevels: '10',
      rsiThreshold: '30',
      stopLoss: '',
      takeProfit: '',
      breakoutThreshold: '25',
      fastEMA: '12',
      slowEMA: '26',
      budgetAmount: '',
      fromCoin: 'ETH',
      toCoin: 'USDC'
    }
  });

  const orderTypes: Record<'Order' | 'Strategy', OrderType[]> = {
    Order: [
      { id: 'TWAP', name: 'TWAP', icon: Clock, description: 'Time-weighted average price' },
      { id: 'Range', name: 'Range', icon: BarChart3, description: 'Liquidity position' },
      { id: 'Iceberg', name: 'Iceberg', icon: Target, description: 'Hidden execution' }
    ],
    Strategy: [
      { id: 'DCA', name: 'DCA', icon: Repeat, description: 'Dollar cost averaging' },
      { id: 'GridMarketMaking', name: 'Grid', icon: Grid3X3, description: 'Market making' },
      { id: 'MomentumReversal', name: 'Momentum', icon: Activity, description: 'RSI reversal' },
      { id: 'RangeBreakout', name: 'Breakout', icon: Zap, description: 'Range breakouts' },
      { id: 'TrendFollowing', name: 'Trend', icon: TrendingUp, description: 'EMA strategy' }
    ]
  };

  const renderForm = () => {
    switch (orderType) {
      case 'TWAP':
        return <TWAPForm control={control} errors={errors} />;
      case 'Range':
        return <RangeForm control={control} errors={errors} watch={watch} />;
      case 'Iceberg':
        return <IcebergForm control={control} errors={errors} />;
      case 'DCA':
        return <DCAForm control={control} errors={errors} />;
      case 'GridMarketMaking':
        return <GridMarketMakingForm control={control} errors={errors} />;
      case 'MomentumReversal':
        return <MomentumReversalForm control={control} errors={errors} />;
      case 'RangeBreakout':
        return <RangeBreakoutForm control={control} errors={errors} />;
      case 'TrendFollowing':
        return <TrendFollowingForm control={control} errors={errors} />;
      default:
        return null;
    }
  };

  const onSubmit = async (data: FormData) => {
    const strategy = {
      id: new Date().toISOString(),
      name: orderType,
      type: orderType,
      status: 'Running',
      network: 1,
      enabled: true,
      config: JSON.stringify(data),
    };

    try {
      const response = await fetch('/api/strategies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(strategy),
      });

      if (response.ok) {
        console.log('Strategy saved successfully');
      } else {
        console.error('Failed to save strategy');
      }
    } catch (error) {
      console.error('An error occurred while saving the strategy:', error);
    }
  };

  return (
    <Card className="h-full bg-gray-950 border-gray-800 overflow-hidden flex flex-col p-0 gap-0">
      {/* Header */}
      <CardHeader className="border-b border-gray-800 bg-gray-900/50 flex-shrink-0 pb-3">
        <h2 className="text-lg font-semibold text-gray-100">Create Order</h2>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">

          {/* Order Configuration - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* Order Type & Category Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-gray-300">Type & Parameters</span>
              </div>

              {/* Category Toggle */}
              <div className="flex rounded-md bg-gray-800/60 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setOrderCategory('Order');
                    setOrderType('TWAP');
                  }}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all ${orderCategory === 'Order'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
                    }`}
                >
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Orders
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderCategory('Strategy');
                    setOrderType('DCA');
                  }}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all ${orderCategory === 'Strategy'
                      ? 'bg-green-600 text-white'
                      : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
                    }`}
                >
                  <TrendingUp className="w-4 h-4 inline mr-2" />
                  Strategies
                </button>
              </div>

              {/* Type Selection Dropdown */}
              <div className="relative">
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded text-gray-100 text-sm focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50 appearance-none cursor-pointer"
                >
                  {orderTypes[orderCategory].map((type) => (
                    <option key={type.id} value={type.id} className="bg-gray-900">
                      {type.name} - {type.description}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Size in USD */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Size (USD)</label>
              <Controller
                name="budgetAmount"
                control={control}
                rules={{ required: 'Size is required' }}
                render={({ field }) => (
                  <input
                    {...field}
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded text-gray-100 placeholder-gray-400 text-sm focus:ring-1 focus:ring-green-500/50 focus:border-green-500/50"
                    placeholder="Enter amount in USD"
                  />
                )}
              />
              {errors.budgetAmount && (
                <span className="text-xs text-red-400">{errors.budgetAmount.message}</span>
              )}
            </div>

            {/* Dynamic Form Fields Based on Order Type */}
            <div className="space-y-3">
              <div className="border-t border-gray-800 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-300">
                    {orderTypes[orderCategory].find(t => t.id === orderType)?.name} Parameters
                  </span>
                </div>
                <div className="space-y-3">
                  {renderForm()}
                </div>
              </div>
            </div>
          </div>

          {/* Footer with Submit Button */}
          <div className="border-t border-gray-800 bg-gray-900/40 p-4 flex-shrink-0">
            <button
              type="submit"
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-medium text-sm rounded-lg transition-all transform hover:scale-[1.01] shadow-lg"
            >
              Create {orderTypes[orderCategory].find(t => t.id === orderType)?.name} {orderCategory}
            </button>

            {/* Info Footer */}
            <div className="mt-3 p-2 rounded bg-gray-800/30 border border-gray-700/30">
              <div className="flex items-center gap-2">
                <Info className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <div className="text-xs text-gray-400">
                  {orderCategory === 'Order'
                    ? 'Executed based on market conditions and parameters'
                    : 'Runs continuously with automated strategy execution'
                  }
                </div>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateOrderForm;