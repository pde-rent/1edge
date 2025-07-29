// @ts-nocheck
const TokenSelector = ({ selectedToken, onTokenSelect, tokens = ['ETH', 'USDC'] }: any) => {
  const tokenIcons:any = {
    ETH: { bg: 'bg-gradient-to-r from-purple-500/20 to-purple-600/20', border: 'border-purple-400/30', symbol: 'Ξ' },
    USDC: { bg: 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/20', border: 'border-emerald-400/30', symbol: '$' },
    BTC: { bg: 'bg-gradient-to-r from-orange-500/20 to-orange-600/20', border: 'border-orange-400/30', symbol: '₿' },
    USDT: { bg: 'bg-gradient-to-r from-teal-500/20 to-teal-600/20', border: 'border-teal-400/30', symbol: '₮' }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {tokens.map((token) => {
        const config = tokenIcons[token] || tokenIcons.ETH;
        return (
          <button
            key={token}
            type="button"
            onClick={() => onTokenSelect(token)}
            className={`flex items-center gap-3 p-4 rounded-xl backdrop-blur-sm transition-all shadow-lg ${
              selectedToken === token
                ? `${config.bg} hover:from-${token === 'ETH' ? 'purple' : token === 'USDC' ? 'emerald' : 'orange'}-500/30 hover:to-${token === 'ETH' ? 'purple' : token === 'USDC' ? 'emerald' : 'orange'}-600/30 text-${token === 'ETH' ? 'purple' : token === 'USDC' ? 'emerald' : 'orange'}-100 ${config.border} hover:border-${token === 'ETH' ? 'purple' : token === 'USDC' ? 'emerald' : 'orange'}-400/50`
                : 'bg-gradient-to-r from-gray-800/40 to-gray-900/40 hover:from-gray-700/50 hover:to-gray-800/50 text-gray-300 border border-gray-600/30 hover:border-gray-500/50'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              selectedToken === token ? config.bg : 'bg-gray-700/50'
            }`}>
              <span className="text-sm font-bold">{config.symbol}</span>
            </div>
            <span className="font-medium">{token}</span>
          </button>
        );
      })}
    </div>
  );
};
export default TokenSelector;