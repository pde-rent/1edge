import { getConfig } from "@back/services/config";
import {
  addressToSymbol as commonAddressToSymbol,
  symbolToAddress as commonSymbolToAddress,
  getSymbolFromAssets as commonGetSymbolFromAssets,
  getAssetSymbol as commonGetAssetSymbol,
} from "@common/utils";

/**
 * Utility functions for converting between asset addresses and symbols
 * using the centralized token mapping configuration
 *
 * These are convenience wrappers that automatically get the config
 * and call the consolidated utilities from common/utils
 */

/**
 * Convert asset address to token symbol
 */
export function addressToSymbol(address: string, chainId: number = 1): string {
  const config = getConfig();
  return commonAddressToSymbol(address, config.tokenMapping, chainId);
}

/**
 * Convert token symbol to asset address
 */
export function symbolToAddress(
  symbol: string,
  chainId: number = 1,
): string | undefined {
  const config = getConfig();
  return commonSymbolToAddress(symbol, config.tokenMapping, chainId);
}

/**
 * Create price feed symbol from maker and taker asset addresses
 */
export function getSymbolFromAssets(
  makerAsset: string,
  takerAsset: string,
  chainId: number = 1,
): `${string}:${string}:${string}` {
  const config = getConfig();
  return commonGetSymbolFromAssets(
    makerAsset,
    takerAsset,
    config.tokenMapping,
    chainId,
  );
}

/**
 * Get display symbol for logging purposes
 */
export function getAssetSymbol(
  assetAddress: string,
  chainId: number = 1,
): string {
  const config = getConfig();
  return commonGetAssetSymbol(assetAddress, config.tokenMapping, chainId);
}
