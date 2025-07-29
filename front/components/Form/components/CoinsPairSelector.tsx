import { useEffect, useState } from "react";
import CoinDropdown from "./CoinsDropdown";

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

const mockCoins = [
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    current_price: 3750.25
  },
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    current_price: 65000.50
  },
  {
    id: 'usd-coin',
    symbol: 'usdc',
    name: 'USD Coin',
    image: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    current_price: 1.00
  },
  {
    id: 'tether',
    symbol: 'usdt',
    name: 'Tether',
    image: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
    current_price: 1.00
  },
  {
    id: 'binancecoin',
    symbol: 'bnb',
    name: 'BNB',
    image: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
    current_price: 580.25
  },
  {
    id: 'solana',
    symbol: 'sol',
    name: 'Solana',
    image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    current_price: 185.75
  },
  {
    id: 'cardano',
    symbol: 'ada',
    name: 'Cardano',
    image: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
    current_price: 0.45
  },
  {
    id: 'ripple',
    symbol: 'xrp',
    name: 'XRP',
    image: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
    current_price: 0.65
  }
];


const CoinPairSelector = ({ 
  fromCoin = '', 
  toCoin = '', 
  onFromCoinChange = (coin:string) => {}, 
  onToCoinChange = (coin:string) => {},
  useMockData = true 
}) => {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

const fetchCoins = async (useMockData = true) => {
//   if (useMockData) {
//     await new Promise(resolve => setTimeout(resolve, 1000));
//     return mockCoins;
//   }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1`,
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
      console.log(response)

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('CoinGecko API failed, falling back to mock data:', error);
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockCoins;
  }
};

  useEffect(() => {
    const loadCoins = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const coinData = await fetchCoins(useMockData);
        setCoins(coinData);
        
        if (!fromCoin && coinData.length > 0) {
          const defaultFromCoin = coinData.find((coin:any) => coin.symbol === 'eth')?.id || coinData[0].id;
          onFromCoinChange(defaultFromCoin);
        }
        if (!toCoin && coinData.length > 0) {
          const defaultToCoin = coinData.find((coin:any)  => coin.symbol === 'usdc')?.id || coinData[1].id;
          onToCoinChange(defaultToCoin);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load coins';
        setError(errorMessage);
        console.error('Error fetching coins:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCoins();
  }, [useMockData]);

  const swapCoins = (): void => {
    const temp = fromCoin;
    onFromCoinChange(toCoin);
    onToCoinChange(temp);
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-emerald-900/20 via-green-800/10 to-emerald-700/20 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <span className="ml-3 text-emerald-200">Loading coins...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-emerald-900/20 via-green-800/10 to-emerald-700/20 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
        <div className="flex items-center justify-center py-8 text-red-400">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div >
      <div className="space-y-4">
 <div className="w-full flex  flex-col items-center gap-2 sm:flex-nowrap">
  {/* FROM */}
  <div className="flex-1 min-w-full">
    <label className="block text-sm font-medium text-emerald-200 mb-2">From</label>
    <CoinDropdown
      selectedCoin={fromCoin}
      onSelect={onFromCoinChange}
      coins={coins}
      placeholder="Select coin"
    />
  </div>

  {/* Swap Button */}
  <div className=" pt-3 flex justify-center">
    <button
      type="button"
      onClick={swapCoins}
      className="p-2 bg-gradient-to-br from-emerald-500/30 via-green-400/25 to-emerald-600/30 rounded-full border border-emerald-400/40 backdrop-blur-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-400/30 transition-all transform hover:scale-110 text-emerald-50"
      title="Swap coins"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    </button>
  </div>

  {/* TO */}
  <div className="flex-1 min-w-full">
    <label className="block text-sm font-medium text-emerald-200 mb-2">To</label>
    <CoinDropdown
      selectedCoin={toCoin}
      onSelect={onToCoinChange}
      coins={coins}
      placeholder="Select coin"
    />
  </div>
</div>


        
        {/* {fromCoin && toCoin && (
          <div className="flex items-center gap-2 text-sm text-amber-100 bg-gradient-to-br from-amber-500/20 via-yellow-400/15 to-amber-600/20 p-3 rounded-xl border border-amber-400/30 backdrop-blur-sm shadow-lg shadow-amber-500/10 mt-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Rebasing and fee-on-transfer tokens are not supported.</span>
          </div>
        )} */}
      </div>
    </div>
  );
};
export default CoinPairSelector;