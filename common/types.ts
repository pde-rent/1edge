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
 * Includes all fields needed for UI table display
 */
export interface Order extends LimitOrderParams {
  // Core identification
  id: string; // Internal order ID
  orderHash?: string; // On-chain order hash (may have multiple for complex orders)
  signature?: string; // User's EVM signature for authentication

  // UI Table columns
  pair: string; // Trading pair (e.g., "WETH/USDT")
  type: OrderType;
  status: OrderStatus;
  size: string; // Total order size
  remainingSize: string; // Remaining unfilled size
  createdAt: number; // Created at timestamp

  // Trigger information
  triggerType: TriggerType;
  triggerCount: number; // Number of times triggered
  nextTriggerValue?: number | string; // Next trigger value/condition

  // Order execution tracking
  strategyId?: string; // Associated strategy if any
  triggerPrice?: number; // Price trigger for execution
  executedAt?: number;
  cancelledAt?: number;
  filledAmount?: string;
  txHash?: string; // Transaction hash if executed

  // Order configuration params (union type based on order type)
  params?: OrderParams;

  // 1inch order hashes (for complex orders that spawn multiple 1inch orders)
  oneInchOrderHashes?: string[]; // Array of 1inch order hashes

  // Raw user-signed payload for verification
  userSignedPayload?: string;
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
  price: number;
  amount: number;
  total: number;
  count: number;
  orders: OneInchOrder[];
}

export interface OneInchOrderBook {
  chain: number;
  makerAsset: string;
  takerAsset: string;
  bids: OrderbookLevel[]; // Orders sorted by makerRate (descending)
  asks: OrderbookLevel[]; // Orders sorted by takerRate (ascending)
  timestamp: number;
  summary: {
    totalBidOrders: number;
    totalAskOrders: number;
    bestBid: number | null;
    bestAsk: number | null;
    spread: string | null;
    spotPrice?: number | null;
  };
}

export enum OrderType {
  // One-off Orders
  STOP_LIMIT = "STOP_LIMIT",
  CHASE_LIMIT = "CHASE_LIMIT",
  TWAP = "TWAP",
  RANGE = "RANGE",
  ICEBERG = "ICEBERG",
  // Recurring Orders
  DCA = "DCA", // Dollar-Cost Averaging
  GRID_TRADING = "GRID_TRADING",
  MOMENTUM_REVERSAL = "MOMENTUM_REVERSAL",
  RANGE_BREAKOUT = "RANGE_BREAKOUT",
  // Basic limit orders
  LIMIT = "LIMIT",
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

export enum TriggerType {
  PRICE = "PRICE", // Price-based trigger
  TIME = "TIME", // Time-based trigger
  VOLUME = "VOLUME", // Volume-based trigger
  INDICATOR = "INDICATOR", // Technical indicator trigger
  EXECUTION = "EXECUTION", // Triggered after order execution
  NONE = "NONE", // No trigger (immediate execution)
}

/**
 * TWAP order configuration
 * Params: amount, startDate, endDate, interval, maxPrice
 */
export interface TwapParams {
  amount: string;
  startDate: number; // Timestamp
  endDate: number; // Timestamp
  interval: number; // Interval in days
  maxPrice?: number;
}

/**
 * Range order configuration
 * Params: amount, startPrice, endPrice, stepPct, expiry
 */
export interface RangeOrderParams {
  amount: string;
  startPrice: number;
  endPrice: number;
  stepPct: number;
  expiry: number; // Days
}

/**
 * Iceberg order configuration
 * Params: amount, startPrice, endPrice, steps, expiry
 */
export interface IcebergParams {
  amount: string;
  startPrice: number;
  endPrice: number;
  steps: number;
  expiry: number; // Days
}

/**
 * Momentum Reversal Trading configuration
 */
export interface MomentumReversalParams {
  amount: string;
  rsiPeriod: number;
  rsimaPeriod: number;
  tpPct: number;
  slPct: number;
}

/**
 * Range Breakout Trading configuration
 * Params: adxPeriod, adxmaPeriod, emaPeriod, tpPct, slPct
 * Note: Missing amount param in docs - should be added
 */
export interface RangeBreakoutParams {
  amount: string;
  adxPeriod: number;
  adxmaPeriod: number;
  emaPeriod: number;
  tpPct: number;
  slPct: number;
}

/**
 * Stop-Limit Order configuration
 */
export interface StopLimitParams {
  amount: string;
  stopPrice: number;
  limitPrice: number;
  expiry: number; // Days
}

/**
 * Chase-Limit Order configuration
 */
export interface ChaseLimitParams {
  amount: string;
  distancePct: number;
  expiry: number; // Days
  maxPrice?: number;
}

/**
 * Dollar-Cost Averaging configuration
 * Params: amount, startDate, interval, maxPrice
 */
export interface DCAParams {
  amount: string;
  startDate: number; // Timestamp
  interval: number; // Days
  maxPrice?: number;
}

/**
 * Grid Trading configuration
 * Params: amount, startPrice, endPrice, stepPct, stepMultiplier, singleSide, tpPct
 */
export interface GridTradingParams {
  amount: string;
  startPrice: number;
  endPrice: number;
  stepPct: number;
  stepMultiplier?: number;
  singleSide: boolean;
  tpPct?: number; // Take profit percentage
}





/**
 * Order parameters union type
 */
export type OrderParams =
  | StopLimitParams
  | ChaseLimitParams
  | TwapParams
  | RangeOrderParams
  | IcebergParams
  | DCAParams
  | GridTradingParams
  | MomentumReversalParams
  | RangeBreakoutParams;

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
  // Single params attribute with union type
  params: OrderParams;
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

/** Order event for tracking */
export interface OrderEvent {
  orderId: string;
  orderHash?: string;
  status: OrderStatus; // Using OrderStatus instead of separate OrderEventType
  timestamp: number;
  txHash?: string;
  filledAmount?: string;
  remainingAmount?: string;
  gasUsed?: string;
  error?: string;
}

