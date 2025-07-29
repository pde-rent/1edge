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
import TWAPForm from './components/TWAPForm';
import RangeForm from './components/RangeForm';
import IcebergForm from './components/IcebergForm';
import DCAForm from './components/DSAForm';
import GridMarketMakingForm from './components/GridMarketMakingForm';
import MomentumReversalForm from './components/MomentumReversalForm';
import RangeBreakoutForm from './components/RangeBreakoutForm';
import TrendFollowingForm from './components/TrendFollowingStrategyForm';
import TokenSelector from './components/TokenSelector';
import CoinPairSelector from './components/CoinsPairSelector';
import GlassButton from './components/GlassButton';

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
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [fromCoin, setFromCoin] = useState<string>('ETH');
  const [toCoin, setToCoin] = useState<string>('USDC');
  
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
      fromCoin: 'ETH',
      toCoin: 'USDC'
    }
  });

  React.useEffect(() => {
    setValue('fromCoin', fromCoin);
    setValue('toCoin', toCoin);
  }, [fromCoin, toCoin, setValue]);
    
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
    
  const handleFromCoinChange = (coin: string) => {
    setFromCoin(coin);
  };

  const handleToCoinChange = (coin: string) => {
    setToCoin(coin);
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

  const onSubmit = (data: FormData) => {
    console.log('Form submitted:', { 
      orderCategory, 
      orderType, 
      selectedToken,
      ...data 
    });
  };

  return (
    <div className="max-w-3l mx-auto relative z-10">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        
        {/* 2x2 Grid Layout for Main Sections */}
        <div className="grid grid-cols-2 gap-3">
          
          {/* Top Left: Coin Pair Selector */}
          <div className="bg-gradient-to-br from-emerald-900/20 via-green-800/10 to-emerald-700/20 backdrop-blur-xl rounded-lg p-3 border border-emerald-500/20 shadow-lg">
            <h4 className="text-xs font-medium text-emerald-50 mb-2 flex items-center">
              <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></span>
              Trading Pair
            </h4>
            <div className="relative z-50">
              <CoinPairSelector
                fromCoin={fromCoin}
                toCoin={toCoin}
                onFromCoinChange={(coin: any) => handleFromCoinChange(coin)}
                onToCoinChange={(coin: any) => handleToCoinChange(coin)}
              />
            </div>
          </div>

          {/* Top Right: Category & Type Selection */}
          <div className="bg-gradient-to-br from-emerald-900/20 via-green-800/10 to-emerald-700/20 backdrop-blur-xl rounded-lg p-3 border border-emerald-500/20 shadow-lg">
            <h4 className="text-xs font-medium text-emerald-50 mb-2 flex items-center">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
              Type & Category
            </h4>
            
            {/* Category Toggle */}
            <div className="flex rounded-md bg-emerald-900/30 p-0.5 mb-2">
              <button
                type="button"
                onClick={() => {
                  setOrderCategory('Order');
                  setOrderType('TWAP');
                }}
                className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-all ${
                  orderCategory === 'Order'
                    ? 'bg-emerald-500/30 text-emerald-50'
                    : 'text-emerald-300 hover:text-emerald-200'
                }`}
              >
                <DollarSign className="w-3 h-3 inline mr-1" />
                Orders
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderCategory('Strategy');
                  setOrderType('DCA');
                }}
                className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-all ${
                  orderCategory === 'Strategy'
                    ? 'bg-emerald-500/30 text-emerald-50'
                    : 'text-emerald-300 hover:text-emerald-200'
                }`}
              >
                <TrendingUp className="w-3 h-3 inline mr-1" />
                Strategies
              </button>
            </div>

            {/* Type Selection Dropdown */}
            <div className="relative">
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="w-full px-2 py-1.5 bg-emerald-800/30 border border-emerald-700/40 rounded text-emerald-50 text-xs focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 appearance-none cursor-pointer"
              >
                {orderTypes[orderCategory].map((type) => (
                  <option key={type.id} value={type.id} className="bg-emerald-900">
                    {type.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-emerald-300 pointer-events-none" />
            </div>
          </div>

          {/* Bottom Left: Configuration */}
          <div className="bg-gradient-to-br from-emerald-900/20 via-green-800/10 to-emerald-700/20 backdrop-blur-xl rounded-lg p-3 border border-emerald-500/20 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-emerald-50 flex items-center">
                <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                Config
              </h4>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-emerald-300 hover:text-emerald-200 transition-colors"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
            <div className={showAdvanced ? 'block' : 'max-h-20 overflow-hidden'}>
              <div className="text-xs">
                {renderForm()}
              </div>
            </div>
            {!showAdvanced && (
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="text-xs text-emerald-400 hover:text-emerald-300 mt-1"
              >
                Show options...
              </button>
            )}
          </div>

          {/* Bottom Right: Budget */}
          <div className="bg-gradient-to-br from-emerald-900/20 via-green-800/10 to-emerald-700/20 backdrop-blur-xl rounded-lg p-3 border border-emerald-500/20 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-emerald-50 flex items-center">
                <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                Budget
              </h4>
              <Info className="w-3 h-3 text-emerald-300" />
            </div>
            
            <div className="space-y-2">
              <div className="text-xs">
                <TokenSelector
                  selectedToken={selectedToken}
                  onTokenSelect={setSelectedToken}
                  tokens={['ETH', 'USDC']}
                />
              </div>
              
              {selectedToken && (
                <Controller
                  name="budgetAmount"
                  control={control}
                  rules={{ required: 'Budget amount is required' }}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      step="0.01"
                      className="w-full px-2 py-1.5 bg-emerald-800/30 border border-emerald-700/40 rounded text-emerald-50 placeholder-emerald-300 text-xs focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                      placeholder={`Amount (${selectedToken})`}
                    />
                  )}
                />
              )}
            </div>
          </div>
        </div>

        {/* Submit Button - Full Width Below Grid */}
        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-emerald-700 to-emerald-900 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium text-sm rounded-lg transition-all transform hover:scale-[1.01] shadow-lg"
        >
          Create {orderTypes[orderCategory].find(t => t.id === orderType)?.name} {orderCategory}
        </button>
        
        {/* Compact Info Footer */}
        <div className="bg-emerald-500/10 rounded-lg p-2 border border-emerald-400/20">
          <div className="flex items-center gap-2">
            <Info className="w-3 h-3 text-emerald-300 flex-shrink-0" />
            <div className="text-xs text-emerald-200">
              {orderCategory === 'Order' 
                ? 'Executed based on market conditions and parameters'
                : 'Runs continuously with automated strategy execution'
              }
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateOrderForm;