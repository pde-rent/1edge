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
        className={`w-full flex items-center justify-between gap-3 p-3 bg-gradient-to-br from-primary/30 to-background/30 border border-primary/40 rounded-xl text-primary-foreground backdrop-blur-sm shadow-lg shadow-primary/20 transition-all hover:border-primary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-1">
          {selectedCoinData ? (
            <>
              <div className="w-8 h-8 square overflow-hidden bg-white/10 flex items-center justify-center border border-primary/40 backdrop-blur-sm shadow-lg">
                <img 
                  src={selectedCoinData.image} 
                  alt={selectedCoinData.name}
                  className="w-6 h-6"
                />
                <span className="text-sm font-bold text-primary-foreground hidden">
                  {selectedCoinData.symbol.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-primary-foreground">{selectedCoinData.symbol.toUpperCase()}</div>
                <div className="text-xs text-primary/80">{selectedCoinData.name}</div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 bg-gradient-to-br from-primary/20 via-primary/15 to-primary/20 square flex items-center justify-center border border-primary/40 backdrop-blur-sm">
                <span className="text-sm font-bold text-primary">#</span>
              </div>
              <span className="text-primary text-sm">{placeholder}</span>
            </div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-primary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute top-full left-0 right-0 mt-2 bg-gradient-to-br from-gray-900/98 via-background/95 to-gray-800/98 backdrop-blur-xl rounded-xl border-2 border-primary/50 shadow-2xl shadow-primary/40 z-50 max-h-60 overflow-y-auto ring-1 ring-primary/20">
            {coins.map((coin:any) => (
              <button
                key={coin.id}
                type="button"
                onClick={() => {
                  onSelect(coin.id);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-gradient-to-r hover:from-primary/40 hover:to-primary/30 transition-all duration-200 first:rounded-t-xl last:rounded-b-xl border-b border-gray-700/50 last:border-b-0 hover:border-primary/30"
              >
                <div className="w-8 h-8 square overflow-hidden bg-gray-800/60 flex items-center justify-center border border-primary/40 backdrop-blur-sm shadow-lg shadow-primary/30">
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
                      <div className="text-xs text-primary/80">{coin.name}</div>
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