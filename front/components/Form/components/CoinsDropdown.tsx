import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';


const CoinDropdown = ({ 
  selectedCoin, 
  onSelect, 
  coins, 
  placeholder = "Select coin",
  disabled = false 
}:any) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedCoinData = coins.find((coin:any) => coin.id === selectedCoin);

  return (
    <div className="relative z-40">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-3 p-3 bg-gradient-to-br from-emerald-800/30 to-emerald-900/30 border border-emerald-700/40 rounded-xl text-emerald-50 backdrop-blur-sm shadow-lg shadow-emerald-900/20 transition-all hover:border-emerald-600/50 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-1">
          {selectedCoinData ? (
            <>
              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex items-center justify-center border border-emerald-400/40 backdrop-blur-sm shadow-lg">
                <img 
                  src={selectedCoinData.image} 
                  alt={selectedCoinData.name}
                  className="w-6 h-6"
                />
                <span className="text-sm font-bold text-emerald-50 hidden">
                  {selectedCoinData.symbol.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-emerald-50">{selectedCoinData.symbol.toUpperCase()}</div>
                <div className="text-xs text-emerald-300">{selectedCoinData.name}</div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500/20 via-green-400/15 to-emerald-600/20 rounded-full flex items-center justify-center border border-emerald-400/40 backdrop-blur-sm">
                <span className="text-sm font-bold text-emerald-300">#</span>
              </div>
              <span className="text-emerald-300 text-sm">{placeholder}</span>
            </div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-emerald-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute top-full left-0 right-0 mt-2 bg-gradient-to-br from-gray-900/98 via-emerald-900/95 to-gray-800/98 backdrop-blur-xl rounded-xl border-2 border-emerald-600/50 shadow-2xl shadow-emerald-900/40 z-50 max-h-60 overflow-y-auto ring-1 ring-emerald-500/20">
            {coins.map((coin:any) => (
              <button
                key={coin.id}
                type="button"
                onClick={() => {
                  onSelect(coin.id);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-gradient-to-r hover:from-emerald-800/40 hover:to-emerald-700/30 transition-all duration-200 first:rounded-t-xl last:rounded-b-xl border-b border-gray-700/50 last:border-b-0 hover:border-emerald-600/30"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800/60 flex items-center justify-center border border-emerald-500/40 backdrop-blur-sm shadow-lg shadow-emerald-900/30">
                  <img 
                    src={coin.image} 
                    alt={coin.name}
                    className="w-6 h-6"
                  />
                  <span className="text-sm font-bold text-gray-100 hidden">
                    {coin.symbol.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-100">{coin.symbol.toUpperCase()}</div>
                      <div className="text-xs text-emerald-400/80">{coin.name}</div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CoinDropdown;