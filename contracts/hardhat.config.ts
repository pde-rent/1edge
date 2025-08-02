import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Load default config from root 1edge.config.json
const defaultConfigPath = path.join(__dirname, "../1edge.config.json");
const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, "utf8"));

// Extract network configurations
const networks = defaultConfig.networks;

// Build Hardhat network configuration
const hardhatNetworks: any = {
  hardhat: {
    chainId: 31337,
    gas: "auto",
    gasPrice: 20000000000, // 20 gwei
    gasMultiplier: 2,
    mining: {
      auto: true,
      interval: 0,
    },
    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
      path: "m/44'/60'/0'/0",
      initialIndex: 0,
      count: 20,
      accountsBalance: "10000000000000000000000", // 10,000 ETH per account
    },
  },
};

// RPC URL environment variable mappings
const rpcEnvMapping: { [key: string]: string } = {
  "1": "ETH_RPC_URL",
  "137": "POLYGON_RPC_URL",
  "56": "BSC_RPC_URL",
  "42161": "ARBITRUM_RPC_URL",
  "10": "OPTIMISM_RPC_URL",
  "43114": "AVALANCHE_RPC_URL",
  "8453": "BASE_RPC_URL",
};

// Add all networks from config
Object.entries(networks).forEach(([chainId, network]: [string, any]) => {
  const networkName = network.name.toLowerCase().replace(/\s+/g, "");

  // Use environment variable RPC URL if available, otherwise use config
  const envVar = rpcEnvMapping[chainId];
  const rpcUrl = (envVar && process.env[envVar]) || network.rpcUrl;

  hardhatNetworks[networkName] = {
    url: rpcUrl,
    chainId: network.chainId,
    accounts: process.env.KEEPER_PK ? [process.env.KEEPER_PK] : [],
  };
});

// Special handling for localhost
hardhatNetworks.localhost = {
  url: "http://127.0.0.1:8545",
  chainId: 31337,
};

// Network to Etherscan API mapping
export const ETHERSCAN_NETWORKS: Record<number, string> = {
  1: "mainnet",
  10: "optimism",
  56: "bsc",
  137: "polygon",
  8453: "base",
  42161: "arbitrumOne",
  43114: "avalanche",
};

// Generate etherscan API key config
const etherscanApiKeys: Record<string, string> = {};
Object.values(ETHERSCAN_NETWORKS).forEach((networkName) => {
  etherscanApiKeys[networkName] = process.env.ETHERSCAN_API_KEY || "";
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1, // Optimize for deployment cost over runtime gas
      },
      viaIR: true,
    },
  },
  networks: hardhatNetworks,
  paths: {
    sources: "./src",
    tests: "./tests",
  },
  // Set default network for tests
  defaultNetwork: "hardhat",
  // Etherscan verification configuration
  etherscan: {
    apiKey: etherscanApiKeys,
  },
};

export default config;
