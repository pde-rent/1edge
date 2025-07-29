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
  AlertTriangle,
  Repeat,
  Activity,
  Target,
  Zap,
  DollarSign,
  TrendingDown
} from 'lucide-react';
import TokenSelector from './components/TokenSelector';
import TWAPForm from './components/TWAPForm';
import RangeForm from './components/RangeForm';
import IcebergForm from './components/IcebergForm';
import DCAForm from './components/DCAForm';
import GridMarketMakingForm from './components/GridMarketMakinForm';
import MomentumReversalForm from './components/MomentumReversalForm';
import RangeBreakoutForm from './components/RangeBreakoutForm';
import TrendFollowingForm from './components/TrendFollowingStrategyForm';
import GlassButton from './components/GlassButton';
import InputField from './components/InputField';
import CoinPairSelector from './components/CoinsPairSelector';

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
  const [orderCategory, setOrderCategory] =useState<'Order' | 'Strategy'>('Order');
  const [orderType, setOrderType] = useState<string>('TWAP');
  const [selectedToken, setSelectedToken] = useState<string>('');
   const [fromCoin, setFromCoin] = useState<string>(
'ETH'
  );
  const [toCoin, setToCoin] = useState<string>(
    'USDC'
  );
  const { control, handleSubmit, formState: { errors }, watch,setValue } = useForm<FormData>({
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
    
  const orderTypes:Record<'Order' | 'Strategy', OrderType[]> = {
    Order: [
      { id: 'TWAP', name: 'TWAP', icon: Clock, description: 'Time-weighted average price' },
      { id: 'Range', name: 'Range Orders', icon: BarChart3, description: 'Liquidity position' },
      { id: 'Iceberg', name: 'Iceberg', icon: Target, description: 'Hidden order execution' }
    ],
    Strategy: [
      { id: 'DCA', name: 'DCA', icon: Repeat, description: 'Dollar cost averaging' },
      { id: 'GridMarketMaking', name: 'Grid Market Making', icon: Grid3X3, description: 'Automated market making' },
      { id: 'MomentumReversal', name: 'Momentum Reversal', icon: Activity, description: 'RSI-based reversal' },
      { id: 'RangeBreakout', name: 'Range Breakout', icon: Zap, description: 'ADX/Trendline breakouts' },
      { id: 'TrendFollowing', name: 'Trend Following', icon: TrendingUp, description: 'EMA crossover strategy' }
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
      <div className="max-w-4xl mx-auto relative z-10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                 
        <div className="relative z-50">
          <CoinPairSelector
            fromCoin={fromCoin}
            toCoin={toCoin}
            onFromCoinChange={(coin:any)=>handleFromCoinChange(coin)}
            onToCoinChange={(coin:any)=>handleToCoinChange(coin)}
          />
        </div>
 
              {/* Order Category Selection */}
              
          <div className="bg-gradient-to-br from-emerald-900/20 via-green-800/10 to-emerald-700/20 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10 relative z-10">
            <h3 className="text-lg font-semibold mb-4 text-emerald-50">Category</h3>
            <div className="grid grid-cols-2 gap-3">
              <GlassButton
                active={orderCategory === 'Order'}
                onClick={() => {
                  setOrderCategory('Order');
                  setOrderType('TWAP');
                }}
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-medium">Orders</span>
                </div>
              </GlassButton>
              
              <GlassButton
                active={orderCategory === 'Strategy'}
                onClick={() => {
                  setOrderCategory('Strategy');
                  setOrderType('DCA');
                }}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-medium">Strategies</span>
                </div>
              </GlassButton>
                  </div>
                 
          </div>

          {/* Order Type Selection */}
          <div className="bg-gradient-to-br from-emerald-900/20 via-green-800/10 to-emerald-700/20 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10 relative z-10">
            <h3 className="text-lg font-semibold mb-4 text-emerald-50">
              {orderCategory === 'Order' ? 'Order Type' : 'Strategy Type'}
            </h3>
            <div className="grid  gap-4 grid-cols-2 grid-cols-3 ">
              {orderTypes[orderCategory].map((type) => {
                const IconComponent = type.icon;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setOrderType(type.id)}
                    className={`p-2 rounded-xl border backdrop-blur-sm transition-all transform hover:scale-[1.02] shadow-lg ${
                      orderType === type.id
                        ? 'bg-gradient-to-br from-emerald-500/30 via-green-400/25 to-emerald-600/30 hover:from-emerald-500/40 hover:via-green-400/35 hover:to-emerald-600/40 text-emerald-50 border border-emerald-400/40 hover:border-emerald-300/60 shadow-emerald-500/25 hover:shadow-emerald-400/30'
                        : 'bg-gradient-to-br from-emerald-900/10 via-green-800/5 to-emerald-700/10 hover:from-emerald-800/20 hover:via-green-700/15 hover:to-emerald-600/20 text-emerald-200 border border-emerald-600/20 hover:border-emerald-500/30 shadow-emerald-900/20'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2 text-center">
                      <IconComponent className="w-6 h-6" />
                      <div>
                        <div className="font-medium text-sm">{type.name}</div>
                        <div className="text-xs opacity-70 leading-tight">{type.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Order/Strategy Form */}
          <div className="bg-gradient-to-br from-emerald-900/20 via-green-800/10 to-emerald-700/20 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10 relative z-10">
            <h3 className="text-lg font-semibold mb-4 text-emerald-50">Configuration</h3>
            {renderForm()}
          </div>

          {/* Budget Section */}
          <div className="bg-gradient-to-br from-emerald-900/20 via-green-800/10 to-emerald-700/20 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-emerald-50">Budget</h3>
              <Info className="w-4 h-4 text-emerald-300" />
            </div>
            <p className="text-sm text-emerald-200 mb-4">Select token for budget allocation</p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-emerald-200">
                <span className="bg-gradient-to-br from-emerald-700/50 to-emerald-800/50 rounded px-2 py-1 text-xs backdrop-blur-sm border border-emerald-600/30">1</span>
                <span>Select Token</span>
              </div>
              
              <TokenSelector
                selectedToken={selectedToken}
                onTokenSelect={setSelectedToken}
                tokens={['ETH', 'USDC']}
              />
              
              {selectedToken && (
                <div className="mt-4">
                  <InputField label={`Amount (${selectedToken})`}>
                    <Controller
                      name="budgetAmount"
                      control={control}
                      rules={{ required: 'Budget amount is required' }}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          step="0.01"
                          className="w-full px-3 py-3 bg-gradient-to-br from-emerald-800/30 to-emerald-900/30 border border-emerald-700/40 rounded-xl text-emerald-50 placeholder-emerald-300 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm shadow-lg shadow-emerald-900/20"
                          placeholder={`Enter ${selectedToken} amount`}
                        />
                      )}
                    />
                  </InputField>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-br from-emerald-500 via-green-400 to-emerald-600 hover:from-emerald-600 hover:via-green-500 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] shadow-2xl hover:shadow-emerald-500/40 backdrop-blur-sm border border-emerald-400/30"
          >
            Create {orderTypes[orderCategory].find(t => t.id === orderType)?.name} {orderCategory}
          </button>
          
          {/* Additional Info */}
          <div className="bg-gradient-to-br from-emerald-500/15 via-green-400/10 to-emerald-600/15 backdrop-blur-xl rounded-2xl p-4 border border-emerald-400/30 shadow-2xl shadow-emerald-500/10 relative z-10">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-emerald-300 mt-0.5" />
              <div className="text-sm text-emerald-100">
                <div className="font-medium mb-1">
                  {orderCategory === 'Order' ? 'Order Execution' : 'Strategy Automation'}
                </div>
                <div className="text-emerald-200/80">
                  {orderCategory === 'Order' 
                    ? 'Orders are executed based on market conditions and your specified parameters.'
                    : 'Strategies run continuously and adapt to market conditions automatically.'
                  }
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
  );
};

export default CreateOrderForm;