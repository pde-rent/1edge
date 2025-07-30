import { getConfig } from "@back/services/config";

/**
 * Utility functions for converting between asset addresses and symbols
 * using the centralized token mapping configuration
 */

/**
 * Convert asset address to token symbol
 */
export function addressToSymbol(address: string, chainId: number = 1): string {
  const config = getConfig();
  const lowercaseAddress = address.toLowerCase();

  for (const [symbol, chains] of Object.entries(config.tokenMapping)) {
    const chainAddress = chains[chainId.toString()];
    if (chainAddress && chainAddress.toLowerCase() === lowercaseAddress) {
      return symbol;
    }
  }

  return "UNKNOWN";
}

/**
 * Convert token symbol to asset address
 */
export function symbolToAddress(symbol: string, chainId: number = 1): string | undefined {
  const config = getConfig();
  const tokenMapping = config.tokenMapping[symbol];

  if (!tokenMapping) {
    return undefined;
  }

  return tokenMapping[chainId.toString()];
}

/**
 * Create price feed symbol from maker and taker asset addresses
 */
export function getSymbolFromAssets(makerAsset: string, takerAsset: string, chainId: number = 1): string {
  const makerSymbol = addressToSymbol(makerAsset, chainId);
  const takerSymbol = addressToSymbol(takerAsset, chainId);

  return `agg:spot:${makerSymbol}${takerSymbol}`;
}

/**
 * Get display symbol for logging purposes
 */
export function getAssetSymbol(assetAddress: string, chainId: number = 1): string {
  return addressToSymbol(assetAddress, chainId);
}
