// @ts-nocheck
const TokenSelector = ({ selectedToken, onTokenSelect, tokens = ['ETH', 'USDC'] }: any) => {
  const tokenIcons:any = {
    ETH: { bg: 'bg-gradient-to-r from-purple-500/20 to-purple-600/20', border: 'border-purple-400/30', symbol: 'Ξ' },
    USDC: { bg: 'bg-gradient-to-r from-primary/20 to-primary/20', border: 'border-primary/30', symbol: '$' },
    BTC: { bg: 'bg-gradient-to-r from-orange-500/20 to-orange-600/20', border: 'border-orange-400/30', symbol: '₿' },
    USDT: { bg: 'bg-gradient-to-r from-primary/20 to-primary/20', border: 'border-primary/30', symbol: '₮' }
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
                ? `${config.bg} hover:from-primary/30 hover:to-primary/30 text-primary ${config.border} hover:border-primary/50`
                : 'bg-gradient-to-r from-gray-800/40 to-gray-900/40 hover:from-gray-700/50 hover:to-gray-800/50 text-gray-300 border border-gray-600/30 hover:border-gray-500/50'
            }`}
          >
            <div className={`w-8 h-8 square flex items-center justify-center ${
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