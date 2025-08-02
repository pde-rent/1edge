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
    id: "order-registry",
    name: "Order Registry",
    path: "back/services/orderRegistry.ts",
  },
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
export type PairSymbol = `${string}:${string}:${string}`;

/**
 * Network configuration for 1inch
 */
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  aggregatorV6: string;
  settlementContract?: string;
  nativeSymbol: string;
  blockExplorer: string;
}

/**
 * Represents a 1inch limit order
 */
export interface OneInchLimitOrderParams {
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
 * 1inch Limit Order structure from API
 */
export interface OneInchOrder {
  orderHash: string;
  createDateTime: string;
  remainingMakerAmount: string;
  makerBalance: string;
  makerAllowance: string;
  makerRate: string;
  takerRate: string;
  isMakerContract: boolean;
  orderInvalidReason: string | null;
  signature: string;
  data: OneInchLimitOrderParams;
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

/**
 * Base order interface with common attributes
 */
export interface BaseOrderParams {
  // Order definition
  type: OrderType;
  salt?: string; // Order salt for uniqueness
  expiry?: number; // Optional expiry (timestamp or days)

  // Optional 1inch-specific fields (for when order becomes a single 1inch order)
  receiver?: string; // Optional receiver address
  maker: string; // Maker address

  chainId?: number; // Chain ID for the order (defaults to 1 if not specified)
  makerAsset: string; // Token address for asset being sold
  takerAsset: string; // Token address for asset being bought

  // Optional amounts (may not be pre-defined for complex orders)
  makingAmount?: number; // Total amount of maker asset (if known) - float64
  takingAmount?: number; // Total amount of taker asset (if known) - float64
}

/**
 * TWAP order configuration
 * Params: makingAmount, startDate, endDate, interval, maxPrice
 */
export interface TwapParams extends BaseOrderParams {
  startDate: number; // Timestamp
  endDate: number; // Timestamp
  interval: number; // Interval in ms
  maxPrice?: number; // Maximum price per unit (float64)
}

/**
 * TWAP order alias for backward compatibility
 */
export type TWAPParams = TwapParams;

/**
 * Range order configuration
 * Params: makingAmount, startPrice, endPrice, stepPct, expiry
 */
export interface RangeOrderParams extends BaseOrderParams {
  startPrice: number; // Start price (float64)
  endPrice: number; // End price (float64)
  stepPct: number; // Step percentage (float64)
}

/**
 * Range order alias for backward compatibility
 */
export type RangeParams = RangeOrderParams;

/**
 * Iceberg order configuration
 * Params: makingAmount, startPrice, endPrice, steps, expiry
 */
export interface IcebergParams extends BaseOrderParams {
  startPrice: number; // Start price (float64)
  endPrice: number; // End price (float64)
  steps: number; // Number of steps
  amount?: number; // Amount per step (backward compatibility)
}

/**
 * Momentum Reversal Trading configuration
 */
export interface MomentumReversalParams extends BaseOrderParams {
  rsiPeriod: number;
  rsimaPeriod: number;
  tpPct: number;
  slPct: number;
}

/**
 * Breakout Trading configuration
 * Params: adxPeriod, adxmaPeriod, emaPeriod, tpPct, slPct
 */
export interface RangeBreakoutParams extends BaseOrderParams {
  adxPeriod: number;
  adxmaPeriod: number;
  emaPeriod: number;
  tpPct: number;
  slPct: number;
  adxThreshold?: number; // ADX threshold for breakout detection
  breakoutPct?: number; // Breakout percentage threshold
}

/**
 * Stop-Limit Order configuration
 */
export interface StopLimitParams extends BaseOrderParams {
  stopPrice: number; // Stop price (float64)
  limitPrice: number; // Limit price (float64)
}

/**
 * Chase-Limit Order configuration
 */
export interface ChaseLimitParams extends BaseOrderParams {
  distancePct: number; // Distance percentage (float64)
  maxPrice?: number; // Maximum price per unit (float64)
}

/**
 * Dollar-Cost Averaging configuration
 * Params: makingAmount, startDate, interval, maxPrice
 */
export interface DCAParams extends BaseOrderParams {
  startDate: number; // Timestamp
  interval: number; // Days
  maxPrice?: number; // Maximum price per unit (float64)
}

/**
 * Grid Trading configuration
 * Params: makingAmount, startPrice, endPrice, stepPct, stepMultiplier, singleSide, tpPct
 */
export interface GridTradingParams extends BaseOrderParams {
  startPrice: number; // Start price (float64)
  endPrice: number; // End price (float64)
  stepPct: number; // Step percentage (float64)
  stepMultiplier?: number; // Step multiplier (float64)
  singleSide: boolean;
  tpPct?: number; // Take profit percentage (float64)
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
  COMPLETED = "COMPLETED", // Fully completed (used for multi-part orders like TWAP)
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED",
}

/**
 * 1edge internal order - represents a high-level order that can spawn multiple 1inch orders
 * This is our internal order tracking system, separate from individual 1inch limit orders
 */
export interface Order {
  // Core identification
  id: string; // Internal order ID (hash-based)
  signature: string; // User's EVM signature for authentication

  // Order configuration params (union type based on order type)
  params?: OrderParams;

  // Order status and tracking
  status: OrderStatus;
  remainingMakerAmount: number; // Remaining unfilled amount (float64 not bigint)
  triggerCount: number; // Number of times triggered

  // Optional execution tracking
  nextTriggerValue?: number | string; // Next trigger value/condition
  createdAt: number; // Created at timestamp
  executedAt?: number;
  cancelledAt?: number;
  filledAmount?: string;
  txHash?: string; // Transaction hash if executed

  // 1inch order tracking (1edge order can manage multiple 1inch orders)
  oneInchOrderHashes?: string[]; // Array of 1inch order hashes spawned by this order

  // Missing properties for compatibility
  orderHash?: string; // Primary 1inch order hash (if applicable)
  strategyId?: string; // Strategy ID for strategy-based orders
  receiver?: string; // Receiver address (if different from maker)
  salt?: string; // Salt value for uniqueness
  expiry?: number; // Expiry timestamp
  triggerPrice?: number; // Trigger price for conditional orders
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
  symbols: PairSymbol[]; // Price feeds to monitor
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
  adx?: number[]; // Average Directional Index
}

/** Ticker feed with analysis */
export interface TickerFeed {
  id: PairSymbol;
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
  id: PairSymbol;
  name: string;
  tf: TimeFrame;
  lookback: number; // Lookback period in seconds
  sources: Record<PairSymbol, { weight: number }>;
}

/** Aggregated ticker data */
export interface AggregatedTicker extends TickerFeed {
  sources: Record<PairSymbol, TickerFeed>;
}

// Storage configuration
export interface StorageConfig {
  defaultTtl: number;
  dbPath: string;
}

// Collector service configuration
export interface CollectorConfig {
  pollIntervalMs: number;
  tickers: Record<PairSymbol, AggregatedTickerConfig>;
}

// Keeper service configuration
export interface KeeperConfig {
  pollIntervalMs: number;
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

// Root services configuration
export interface ServicesConfig {
  collector: CollectorConfig;
  keeper: KeeperConfig;
  statusChecker: StatusCheckerConfig;
  apiServer: ApiServerConfig;
  websocketServer?: { port: number };
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
  networks: { [chainId: string]: NetworkConfig };
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
  symbol: PairSymbol;
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
