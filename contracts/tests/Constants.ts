import * as fs from "fs";
import * as path from "path";

// Load default config
const defaultConfigPath = path.join(__dirname, "../../1edge.config.json");
const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, "utf8"));

// Get limit order protocol address for Ethereum mainnet (chainId: 1)
export const AGGREGATOR_V6 =
  defaultConfig.networks[1].aggregatorV6;
