// @ts-nocheck
import { getSupportedTokens } from "../../../config/generated";
import { useNetwork } from "wagmi";
import { getTokenDisplayInfo } from "../../../utils/tokens";

const TokenSelector = ({ selectedToken, onTokenSelect, tokens }: any) => {
  const { chain } = useNetwork();
  const chainId = chain?.id || 1; // Default to Ethereum
  
  // Get supported tokens for current chain if not specified
  const availableTokens = tokens || getSupportedTokens(chainId);

  return (
    <div className="grid grid-cols-2 gap-3">
      {availableTokens.map((token) => {
        const tokenInfo = getTokenDisplayInfo(token);
        return (
          <button
            key={token}
            type="button"
            onClick={() => onTokenSelect(token)}
            className={`flex items-center gap-3 p-4 rounded-xl backdrop-blur-sm transition-all shadow-lg ${
              selectedToken === token
                ? `${tokenInfo.bg} hover:from-primary/30 hover:to-primary/30 text-primary ${tokenInfo.border} hover:border-primary/25`
                : 'bg-gradient-to-r from-gray-800/40 to-gray-900/40 hover:from-gray-700/50 hover:to-gray-800/50 text-gray-300 border border-gray-600/30 hover:border-gray-500/50'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
              selectedToken === token ? tokenInfo.bg : 'bg-gray-700/50'
            }`}>
              {tokenInfo.symbol}
            </div>
            <span className="font-medium">{token}</span>
          </button>
        );
      })}
    </div>
  );
};
export default TokenSelector;