// Import types for 1inch integration - keeping for future use
// import type { LimitOrderV4Struct } from "@1inch/limit-order-sdk";

export enum InstrumentType {
  SPOT = "spot",
  FUTURES = "futures",
  OPTIONS = "options",
}

/**
 * Status of a service.
 */
export enum ServiceStatus {
  UP = "UP",
  DOWN = "DOWN",
  UNKNOWN = "UNKNOWN",
}

/**
 * A service.
 */
export interface Service {
  id: string;
  name: string;
  path?: string;
  status?: ServiceStatus;
  latencyMs?: number;
  pingUrl?: string;
  checkedAt?: number;
}

// List of back-end services to start and monitor
export const services: Service[] = [
  { id: "collector", name: "Collector", path: "back/services/collector.ts" },
  { id: "api", name: "API Server", path: "back/services/apiServer.ts" },
  {
    id: "websocket",
    name: "WebSocket Server",
    path: "back/services/websocketServer.ts",
  },
  {
    id: "order-executor",
    name: "Order Executor",
    path: "back/services/orderExecutor.ts",
  },
  { id: "keeper", name: "Keeper", path: "back/services/keeper.ts" },
  {
    id: "status-checker",
    name: "Status Checker",
    path: "back/services/statusChecker.ts",
  },
];

export type ServiceId = (typeof services)[number]["id"];

/**
 * Symbol for a market instrument.
 * "<exchange>:<instrumentType>:<instrumentId>"
 * @example
 * "binance:spot:BTCUSDT"
 * "coinbase:spot:BTC-USD"
 */
export type Symbol = `${string}:${string}:${string}`;

/**
 * Network configuration for 1inch
 */
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  limitOrderContract: string;
  settlementContract?: string;
  nativeSymbol: string;
  blockExplorer: string;
}

/**
 * Represents a 1inch limit order
 */
export interface LimitOrderParams {
  makerAsset: string; // Token address
  takerAsset: string; // Token address
  makingAmount: string; // Amount of maker asset
  takingAmount: string; // Amount of taker asset
  maker: string; // Maker address
  receiver?: string; // Optional receiver address
  salt?: string; // Order salt for uniqueness
  offsets?: string; // Encoded offsets
  interactions?: string; // Encoded interactions
  expiry?: number; // Expiration timestamp
}

/**
 * Extended order information with metadata
 */
export interface Order extends LimitOrderParams {
  id: string; // Internal order ID
  orderHash?: string; // On-chain order hash
  signature?: string; // Order signature
  type: OrderType;
  status: OrderStatus;
  strategyId?: string; // Associated strategy
  triggerPrice?: number; // Price trigger for execution
  createdAt: number;
  executedAt?: number;
  cancelledAt?: number;
  filledAmount?: string;
  remainingAmount?: string;
  txHash?: string; // Transaction hash if executed
}

/**
 * 1inch Limit Order structure from API
 */
export interface OneInchOrder {
  orderHash: string;
  createDateTime: string;
  remainingMakerAmount: string;
  makerBalance: string;
  makerAllowance: string;
  data: {
    makerAsset: string;
    takerAsset: string;
    salt: string;
    receiver?: string;
    makingAmount: string;
    takingAmount: string;
    maker: string;
    extension?: string;
    makerTraits?: string;
  };
  makerRate: string;
  takerRate: string;
  isMakerContract: boolean;
  orderInvalidReason: string | null;
  signature: string;
}

/**
 * Reconstructed orderbook structure
 */
export interface OrderbookLevel {
  price: string;
  amount: string;
  total: string;
  count: number;
  orders: OneInchOrder[];
}

export interface ReconstructedOrderbook {
  chain: number;
  makerAsset: string;
  takerAsset: string;
  bids: OrderbookLevel[]; // Orders sorted by makerRate (descending)
  asks: OrderbookLevel[]; // Orders sorted by takerRate (ascending)
  timestamp: number;
  summary: {
    totalBidOrders: number;
    totalAskOrders: number;
    bestBid: string | null;
    bestAsk: string | null;
    spread: string | null;
    spotPrice?: number | null;
  };
}

export enum OrderType {
  // Basic limit orders
  LIMIT = "LIMIT",
  // Advanced order types
  TWAP = "TWAP", // Time-weighted average price
  RANGE = "RANGE", // Range orders (grid)
  ICEBERG = "ICEBERG", // Hidden size orders
  // Strategy-based orders
  NAIVE_REVERSION = "NAIVE_REVERSION",
  MOMENTUM_REVERSION = "MOMENTUM_REVERSION",
  TREND_FOLLOWING = "TREND_FOLLOWING",
  // Control orders
  CANCEL = "CANCEL",
  CANCEL_ALL = "CANCEL_ALL",
}

export enum OrderStatus {
  PENDING = "PENDING", // Created but not submitted
  SUBMITTED = "SUBMITTED", // Submitted to orderbook
  ACTIVE = "ACTIVE", // Active in orderbook
  PARTIALLY_FILLED = "PARTIALLY_FILLED",
  FILLED = "FILLED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED",
}

/**
 * TWAP order configuration
 */
export interface TwapConfig {
  totalAmount: string;
  timeWindow: number; // Duration in seconds
  intervalCount: number;
  priceLimit?: string;
}

/**
 * Range order configuration
 */
export interface RangeOrderConfig {
  baseAsset: string;
  quoteAsset: string;
  priceRange: [number, number]; // [minPrice, maxPrice]
  gridLevels: number;
  amountPerLevel: string;
  side: "BUY" | "SELL" | "BOTH";
}

/**
 * Iceberg order configuration
 */
export interface IcebergConfig {
  totalAmount: string;
  visibleAmount: string;
  priceLimit: string;
  refreshThreshold: number; // Percentage before refresh
}

/**
 * Market making strategy configuration
 */
export interface MarketMakingConfig {
  spread: number; // Percentage spread from mid price
  depth: number; // Number of orders on each side
  skew?: number; // Bias towards one side
  rebalanceThreshold?: number; // When to rebalance
}

/**
 * Technical indicator configuration
 */
export interface TechnicalIndicatorConfig {
  type: "RSI" | "MA" | "EMA" | "MACD" | "BB"; // Bollinger Bands
  period: number;
  params?: Record<string, any>;
}

/**
 * Strategy trigger conditions
 */
export interface TriggerCondition {
  type: "PRICE" | "TIME" | "VOLUME" | "INDICATOR";
  operator: "GT" | "LT" | "EQ" | "GTE" | "LTE";
  value: number | string;
  indicator?: TechnicalIndicatorConfig;
}

/**
 * Risk management configuration
 */
export interface RiskConfig {
  maxPositionSize: string; // Max size per position
  maxTotalExposure: string; // Max total exposure
  stopLoss?: number; // Stop loss percentage
  takeProfit?: number; // Take profit percentage
  maxDrawdown?: number; // Maximum drawdown allowed
}

/**
 * Strategy configuration
 */
export interface StrategyConfig {
  id: string;
  name: string;
  type: OrderType;
  symbols: Symbol[]; // Price feeds to monitor
  network: number; // Chain ID
  enabled: boolean;
  // Order specific configs
  twapConfig?: TwapConfig;
  rangeConfig?: RangeOrderConfig;
  icebergConfig?: IcebergConfig;
  marketMakingConfig?: MarketMakingConfig;
  // Triggers and conditions
  triggers?: TriggerCondition[];
  // Risk management
  riskConfig?: RiskConfig;
  // Additional parameters
  params?: Record<string, any>;
}

/** Status of a feed */
export enum FeedStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ERROR = "error",
}

/** Time frames */
export enum TimeFrame {
  S5 = 5,
  S15 = 15,
  S30 = 30,
  M1 = 60,
  M5 = 300,
  M15 = 900,
  M30 = 1800,
  H1 = 3600,
  H4 = 14400,
  H6 = 21600,
  H12 = 43200,
  D1 = 86400,
}

/** Configuration for a source feed */
export interface FeedConfig {
  id: string;
  name: string;
  exchange: string;
  apiKey?: string;
  ttl: number; // Cache TTL in seconds
}

/** Configuration for a ticker feed */
export interface TickerConfig extends FeedConfig {
  tf: TimeFrame;
  lookback: number;
  weight?: number;
}

/** Ticker data point */
export interface TickerTick {
  bid: number;
  ask: number;
  mid: number;
  last: number;
  volume?: number;
  timestamp: number;
}

/** OHLCV candle data */
export interface TickerOHLCV {
  ts: number[]; // Timestamps
  o: number[]; // Open prices
  h: number[]; // High prices
  l: number[]; // Low prices
  c: number[]; // Close prices
  v: number[]; // Volumes
}

/** Technical analysis data */
export interface TickerAnalysis {
  ts: number[]; // Timestamps
  pct?: number[]; // Percentage change
  roc?: number[]; // Rate of change
  vol?: number[]; // Volatility
  rsi?: number[]; // RSI values
  ema?: number[]; // EMA values
  sma?: number[]; // SMA values
  bb?: { upper: number[]; middle: number[]; lower: number[] }; // Bollinger Bands
  macd?: { macd: number[]; signal: number[]; histogram: number[] };
  atr?: number[]; // Average True Range
  mom?: number[]; // Momentum
  volume?: number[]; // Volume analysis
}

/** Ticker feed with analysis */
export interface TickerFeed {
  id: Symbol;
  exchange: string;
  tf: TimeFrame;
  status: FeedStatus;
  last: TickerTick;
  history: TickerOHLCV;
  analysis?: TickerAnalysis;
  updatedAt: number;
}

/** Aggregated ticker configuration */
export interface AggregatedTickerConfig {
  id: Symbol;
  name: string;
  tf: TimeFrame;
  lookback: number; // Lookback period in seconds
  sources: Record<Symbol, { weight: number }>;
}

/** Aggregated ticker data */
export interface AggregatedTicker extends TickerFeed {
  sources: Record<Symbol, TickerFeed>;
}

// Storage configuration
export interface StorageConfig {
  defaultTtl: number;
  dbPath: string;
}

// Collector service configuration
export interface CollectorConfig {
  pollIntervalMs: number;
  tickers: Record<Symbol, AggregatedTickerConfig>;
}

// Keeper service configuration
export interface KeeperConfig {
  pollIntervalMs: number;
  networks: Record<number, NetworkConfig>;
  privateKey?: string; // Keeper wallet private key
  maxGasPrice?: string; // Max gas price in gwei
}

// Status checker configuration
export interface StatusCheckerConfig {
  pollIntervalMs: number;
  ttlSeconds: number;
  timeoutMs: number;
}

// API server configuration
export interface ApiServerConfig {
  port?: number;
  corsOrigins?: string[];
}

// Order executor configuration
export interface OrderExecutorConfig {
  strategies: Record<string, StrategyConfig>;
  defaultNetwork: number;
}

// Root services configuration
export interface ServicesConfig {
  collector: CollectorConfig;
  orderExecutor: OrderExecutorConfig;
  keeper: KeeperConfig;
  statusChecker: StatusCheckerConfig;
  apiServer: ApiServerConfig;
}

// Token mapping configuration - maps token symbols to contract addresses per chain
export interface TokenMapping {
  [symbol: string]: {
    [chainId: string]: string; // Chain ID to contract address mapping
  };
}

// Application configuration
export interface Config {
  storage: StorageConfig;
  services: ServicesConfig;
  tokenMapping: TokenMapping;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Deep partial utility type
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

/** Status of a strategy instance */
export enum StrategyStatus {
  Running = "Running",
  Paused = "Paused",
  Stopped = "Stopped",
}

/** Strategy instance with runtime data */
export interface Strategy extends StrategyConfig {
  status: StrategyStatus;
  startedAt?: number;
  pausedAt?: number;
  stoppedAt?: number;
  // Performance metrics
  orderCount?: number;
  filledCount?: number;
  totalVolume?: string;
  pnl?: number;
  pnlPercent?: number;
}

/** Position tracking for strategies */
export interface Position {
  id: string;
  strategyId: string;
  symbol: Symbol;
  side: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice?: number;
  size: string;
  sizeUsd: number;
  pnl?: number;
  pnlPercent?: number;
  openedAt: number;
  closedAt?: number;
}

/** Event types for order lifecycle */
export enum OrderEventType {
  CREATED = "CREATED",
  SUBMITTED = "SUBMITTED",
  FILLED = "FILLED",
  PARTIALLY_FILLED = "PARTIALLY_FILLED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED",
}

/** Order event for tracking */
export interface OrderEvent {
  orderId: string;
  orderHash?: string;
  type: OrderEventType;
  timestamp: number;
  txHash?: string;
  filledAmount?: string;
  remainingAmount?: string;
  gasUsed?: string;
  error?: string;
}

/** Session key for keeper delegation */
export interface SessionKey {
  address: string;
  privateKey: string;
  permissions: string[]; // Allowed actions
  expiry: number; // Expiration timestamp
  gasLimit?: string; // Max gas per tx
}

/** Smart account configuration */
export interface SmartAccountConfig {
  address: string;
  owner: string;
  sessionKeys: SessionKey[];
  nonce: number;
}
