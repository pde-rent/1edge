import { readFileSync } from "fs";
import { join } from "path";
import type { Config, DeepPartial } from "@common/types";
import { mergeDeep } from "@common/utils";
import { logger } from "@back/utils/logger";

class ConfigService {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    try {
      // Load default config
      const defaultConfigPath = join(process.cwd(), "back/default-config.json");
      const defaultConfig = JSON.parse(
        readFileSync(defaultConfigPath, "utf-8")
      ) as Config;

      // Try to load user config
      let userConfig: DeepPartial<Config> = {};
      try {
        const userConfigPath = join(process.cwd(), "config.json");
        userConfig = JSON.parse(
          readFileSync(userConfigPath, "utf-8")
        ) as DeepPartial<Config>;
        logger.info("Loaded user configuration");
      } catch {
        logger.info("No user configuration found, using defaults");
      }

      // Merge configs
      const config = mergeDeep(defaultConfig, userConfig as Partial<Config>);

      // Apply environment variable overrides
      this.applyEnvironmentOverrides(config);

      logger.info("Configuration loaded successfully");
      return config;
    } catch (error) {
      logger.error("Failed to load configuration:", error);
      throw error;
    }
  }

  private applyEnvironmentOverrides(config: Config) {
    // API port
    if (process.env.API_PORT) {
      config.services.apiServer.port = parseInt(process.env.API_PORT);
    }

    // Database path
    if (process.env.DB_PATH) {
      config.storage.dbPath = process.env.DB_PATH;
    }

    // Network RPC URLs
    if (process.env.ETH_RPC_URL) {
      if (config.services.keeper.networks[1]) {
        config.services.keeper.networks[1].rpcUrl = process.env.ETH_RPC_URL;
      }
    }

    if (process.env.POLYGON_RPC_URL) {
      if (config.services.keeper.networks[137]) {
        config.services.keeper.networks[137].rpcUrl = process.env.POLYGON_RPC_URL;
      }
    }

    // Keeper private key
    if (process.env.KEEPER_PK) {
      config.services.keeper.privateKey = process.env.KEEPER_PK;
    }

    // 1inch API key
    if (process.env.ONE_INCH_API_KEY) {
      // This will be used by the orderbook service
    }
  }

  get(): Config {
    return this.config;
  }

  getService<K extends keyof Config["services"]>(
    service: K
  ): Config["services"][K] {
    return this.config.services[service];
  }

  getStorage(): Config["storage"] {
    return this.config.storage;
  }

  async reload(): Promise<void> {
    logger.info("Reloading configuration...");
    this.config = this.loadConfig();
  }

  // Helper methods for common access patterns
  getNetworkConfig(chainId: number) {
    return this.config.services.keeper.networks[chainId];
  }

  getTickerConfig(symbol: string) {
    return this.config.services.collector.tickers[symbol as `${string}:${string}:${string}`];
  }

  getStrategyConfig(id: string) {
    return this.config.services.orderExecutor.strategies[id];
  }
}

// Export singleton instance
const configService = new ConfigService();

export const getConfig = () => configService.get();
export const getServiceConfig = <K extends keyof Config["services"]>(service: K) =>
  configService.getService(service);
export const getStorageConfig = () => configService.getStorage();
export const reloadConfig = () => configService.reload();
export const getNetworkConfig = (chainId: number) => configService.getNetworkConfig(chainId);
export const getTickerConfig = (symbol: string) => configService.getTickerConfig(symbol);
export const getStrategyConfig = (id: string) => configService.getStrategyConfig(id);

export default configService;
