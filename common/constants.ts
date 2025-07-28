import type { NetworkConfig } from "./types";

/** API server port number */
export const API_PORT = Number(process.env.API_PORT) || 40005;

/** Next.js server port number */
export const NEXT_PORT = Number(process.env.NEXT_PORT) || 40006;

/** API server hostname */
export const API_HOST = process.env.API_HOST || "localhost";

/** Service ports configuration */
export const SERVICE_PORTS = {
  API: 40005,
  WEBSOCKET: 40007,
  COLLECTOR: 40008,
  ORDER_EXECUTOR: 40009,
  KEEPER: 40010,
  STATUS_CHECKER: 40011,
} as const;

/** Next.js server hostname */
export const NEXT_HOST = process.env.NEXT_HOST || "localhost";

/** Full API server URL */
export const API_URL = process.env.API_URL || `http://${API_HOST}:${API_PORT}`;

/** Full Next.js server URL */
export const NEXT_URL = process.env.NEXT_URL || `http://${NEXT_HOST}:${NEXT_PORT}`;

/** UI Theme configuration - single source of truth for application styling */
export const THEME = {
  /** Primary brand color */
  primary: "#0FF", // Cyan
  /** Secondary brand color */
  secondary: "#F0B90B", // Orange
  /** Warning state color */
  warning: "#FF8C00", // Warning orange
  /** Background color palette */
  background: {
    /** Main application background */
    main: "#1C1C1C", // Main background
    /** Card and panel backgrounds */
    paper: "#282828", // Card/panel background
    /** 5% white overlay */
    overlay05: "#FFFFFF0D", // 5% white overlay
    /** 10% white overlay */
    overlay10: "#FFFFFF1A", // 10% white overlay
    /** 30% white overlay */
    overlay30: "#FFFFFF4D", // 30% white overlay
    /** 70% black overlay */
    overlayDark: "#000000B3", // 70% black overlay
  },
  /** Grey color palette */
  grey: {
    /** Grid line color */
    600: "#444444", // Grid line color
    /** Mid grey background */
    500: "#555555", // Mid grey background
    /** Secondary grey */
    400: "#888888", // Secondary grey
  },
  /** Text color palette */
  text: {
    /** Primary text color */
    primary: "#f0f0f0",
    /** Secondary text color */
    secondary: "#a0a0a0",
  },
  /** Error state color */
  error: "#F6465D", // Error red
  /** Success state color */
  success: "#0ECB81", // Success green (same as secondary)
  /** Border color */
  border: "#333333",
  /** Shadow configuration */
  shadow: {
    /** Light shadow */
    light: "rgba(0, 0, 0, 0.1)",
    /** Medium shadow */
    medium: "rgba(0, 0, 0, 0.2)",
    /** Dark shadow */
    dark: "rgba(0, 0, 0, 0.3)",
  },
  /** Font configuration */
  font: {
    /** Primary font family */
    family: '"Inter Variable", system-ui, sans-serif',
    /** Monospace font family */
    mono: "Menlo, Monaco, Consolas, monospace",
    /** Font size configuration */
    size: {
      /** Extra small text */
      xs: "0.75rem",
      /** Small text */
      sm: "0.875rem",
      /** Base text size */
      base: "1rem",
      /** Large text */
      lg: "1.125rem",
      /** Extra large text */
      xl: "1.25rem",
    },
    /** Font weight configuration */
    weight: {
      /** Normal font weight */
      normal: 400,
      /** Medium font weight */
      medium: 500,
      /** Bold font weight */
      bold: 700,
    },
  },
  /** Border radius */
  radius: "0.5rem",
};

/**
 * Synchronizes theme constants with CSS variables.
 * This function should only be called on the client side.
 */
function setCSSVars(vars: Record<string, string | number>) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value.toString());
  });
}

export function syncThemeWithCSSVars() {
  if (typeof window === "undefined") return;

  setCSSVars({
    "--primary-color": THEME.primary,
    "--secondary-color": THEME.secondary,
    "--background-main": THEME.background.main,
    "--background-secondary": THEME.background.paper,
    "--text-primary": THEME.text.primary,
    "--text-secondary": THEME.text.secondary,
    "--error-color": THEME.error,
    "--success-color": THEME.success,
    "--border-color": THEME.border,
    "--shadow-light": THEME.shadow.light,
    "--shadow-medium": THEME.shadow.medium,
    "--shadow-dark": THEME.shadow.dark,
    "--font-family": THEME.font.family,
    "--font-size-xs": THEME.font.size.xs,
    "--font-size-sm": THEME.font.size.sm,
    "--font-size-base": THEME.font.size.base,
    "--font-size-lg": THEME.font.size.lg,
    "--font-size-xl": THEME.font.size.xl,
    "--font-weight-normal": THEME.font.weight.normal,
    "--font-weight-medium": THEME.font.weight.medium,
    "--font-weight-bold": THEME.font.weight.bold,
    "--radius": THEME.radius,
    // MUI specific variables
    "--mui-tooltip-bg": THEME.background.paper,
    "--mui-shadow-opacity": "0.3",
    "--mui-shadow": "0px 4px 6px rgba(0,0,0,var(--mui-shadow-opacity))",
  });
}

/** Grid layout configuration for responsive design */
export const GRID_CONFIG = {
  /** Breakpoint widths in pixels */
  breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
  /** Column counts per breakpoint */
  columns: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },

  /** Grid margins */
  margin: [15, 15] as [number, number],
  /** Container padding */
  containerPadding: [10, 10] as [number, number],
  /** Resize handle positions */
  resizeHandles: ["se", "sw", "ne", "nw"] as Array<"se" | "sw" | "ne" | "nw">,
  /** Total rows per breakpoint */
  totalRowsMap: { lg: 33.5, md: 50.5, sm: 76.5, xs: 76.5, xxs: 76.5 },
  /** Initial layout configurations per breakpoint */
  initialLayouts: {
    lg: [
      { i: "appInfo", x: 0, y: 0, w: 3, h: 3, static: false },
      { i: "feeds", x: 0, y: 3, w: 3, h: 12.5, minW: 2, minH: 5 },
      { i: "activeFeed", x: 3, y: 0, w: 5, h: 22, minW: 4, minH: 10 },
      { i: "config", x: 8, y: 0, w: 4, h: 22, minW: 2, minH: 10 },
      { i: "services", x: 0, y: 15.5, w: 3, h: 18, minW: 2, minH: 5 },
      { i: "positions", x: 3, y: 22, w: 9, h: 11.5, minW: 4, minH: 7 },
    ],
    md: [
      { i: "appInfo", x: 0, y: 0, w: 3, h: 3, static: false },
      { i: "feeds", x: 0, y: 3, w: 3, h: 12, minW: 2, minH: 5 },
      { i: "services", x: 0, y: 15, w: 3, h: 18, minW: 2, minH: 5 },
      { i: "activeFeed", x: 3, y: 3.5, w: 7, h: 18, minW: 4, minH: 10 },
      { i: "config", x: 3, y: 21.5, w: 7, h: 18, minW: 2, minH: 10 },
      { i: "positions", x: 0, y: 39.5, w: 10, h: 10, minW: 4, minH: 7 },
    ],
    sm: [
      { i: "appInfo", x: 0, y: 0, w: 6, h: 3, static: false },
      { i: "feeds", x: 0, y: 3, w: 6, h: 12, minW: 2, minH: 5 },
      { i: "activeFeed", x: 0, y: 15, w: 6, h: 18, minW: 3, minH: 10 },
      { i: "config", x: 0, y: 33, w: 6, h: 18, minW: 2, minH: 10 },
      { i: "services", x: 0, y: 51, w: 6, h: 18, minW: 2, minH: 5 },
      { i: "positions", x: 0, y: 69, w: 6, h: 10, minW: 3, minH: 7 },
    ],
  } as Record<string, any[]>,
};

/**
 * Supported networks for 1edge
 */
export const NETWORKS: Record<number, NetworkConfig> = {
  1: {
    chainId: 1,
    name: "Ethereum",
    rpcUrl: process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
    limitOrderContract: "0x119c71D3BbAC22029622cbaEc24854d3D32D2828", // 1inch v4
    settlementContract: "0x12e6FD1B180EbF67c3b452D4f893dC69Fcd2D652",
    nativeSymbol: "ETH",
    blockExplorer: "https://etherscan.io",
  },
  137: {
    chainId: 137,
    name: "Polygon",
    rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    limitOrderContract: "0x119c71D3BbAC22029622cbaEc24854d3D32D2828",
    settlementContract: "0x12e6FD1B180EbF67c3b452D4f893dC69Fcd2D652",
    nativeSymbol: "MATIC",
    blockExplorer: "https://polygonscan.com",
  },
  56: {
    chainId: 56,
    name: "BSC",
    rpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
    limitOrderContract: "0x119c71D3BbAC22029622cbaEc24854d3D32D2828",
    settlementContract: "0x12e6FD1B180EbF67c3b452D4f893dC69Fcd2D652",
    nativeSymbol: "BNB",
    blockExplorer: "https://bscscan.com",
  },
  42161: {
    chainId: 42161,
    name: "Arbitrum",
    rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    limitOrderContract: "0x119c71D3BbAC22029622cbaEc24854d3D32D2828",
    settlementContract: "0x12e6FD1B180EbF67c3b452D4f893dC69Fcd2D652",
    nativeSymbol: "ETH",
    blockExplorer: "https://arbiscan.io",
  },
  10: {
    chainId: 10,
    name: "Optimism",
    rpcUrl: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
    limitOrderContract: "0x119c71D3BbAC22029622cbaEc24854d3D32D2828",
    settlementContract: "0x12e6FD1B180EbF67c3b452D4f893dC69Fcd2D652",
    nativeSymbol: "ETH",
    blockExplorer: "https://optimistic.etherscan.io",
  },
  43114: {
    chainId: 43114,
    name: "Avalanche",
    rpcUrl: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
    limitOrderContract: "0x119c71D3BbAC22029622cbaEc24854d3D32D2828",
    settlementContract: "0x12e6FD1B180EbF67c3b452D4f893dC69Fcd2D652",
    nativeSymbol: "AVAX",
    blockExplorer: "https://snowtrace.io",
  },
  8453: {
    chainId: 8453,
    name: "Base",
    rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    limitOrderContract: "0x119c71D3BbAC22029622cbaEc24854d3D32D2828",
    settlementContract: "0x12e6FD1B180EbF67c3b452D4f893dC69Fcd2D652",
    nativeSymbol: "ETH",
    blockExplorer: "https://basescan.org",
  },
};

/**
 * 1inch API configuration
 */
export const ONEINCH_API = {
  BASE_URL: "https://limit-orders.1inch.io/v4.0",
  AUTH_HEADER: "Authorization",
  API_KEY: process.env.ONE_INCH_API_KEY || "",
};

/**
 * Default service ports
 */
export const SERVICE_PORTS = {
  API: parseInt(process.env.API_PORT || "40005"),
  FRONTEND: parseInt(process.env.NEXT_PORT || "40006"),
};

/**
 * Common token addresses (Ethereum mainnet)
 */
export const TOKENS = {
  1: {
    // Ethereum
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  },
  137: {
    // Polygon
    WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    DAI: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
  },
  56: {
    // BSC
    WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    WETH: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
  },
};

/**
 * Time constants
 */
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Order size limits
 */
export const ORDER_LIMITS = {
  MIN_ORDER_USD: 10, // Minimum order size in USD
  MAX_ORDER_USD: 1000000, // Maximum order size in USD
  MAX_SLIPPAGE_PERCENT: 5, // Maximum allowed slippage
};

/**
 * Technical indicator defaults
 */
export const INDICATOR_DEFAULTS = {
  RSI: { period: 14, overbought: 70, oversold: 30 },
  EMA: { shortPeriod: 12, longPeriod: 26 },
  SMA: { shortPeriod: 20, longPeriod: 50 },
  MACD: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  BB: { period: 20, stdDev: 2 },
};

/**
 * Strategy defaults
 */
export const STRATEGY_DEFAULTS = {
  TWAP: {
    intervalCount: 10,
    randomness: 0.1, // 10% randomness in intervals
  },
  RANGE: {
    gridLevels: 10,
    spread: 0.5, // 0.5% between levels
  },
  ICEBERG: {
    visiblePercent: 10, // Show 10% of total
    refreshThreshold: 80, // Refresh when 80% filled
  },
  MARKET_MAKING: {
    spread: 0.2, // 0.2% spread
    depth: 5, // 5 orders on each side
    rebalanceThreshold: 0.1, // Rebalance at 10% skew
  },
};

/**
 * Risk management defaults
 */
export const RISK_DEFAULTS = {
  MAX_POSITION_PERCENT: 10, // Max 10% of portfolio per position
  MAX_TOTAL_EXPOSURE_PERCENT: 50, // Max 50% total exposure
  DEFAULT_STOP_LOSS: 2, // 2% stop loss
  DEFAULT_TAKE_PROFIT: 5, // 5% take profit
  MAX_DRAWDOWN_PERCENT: 20, // Max 20% drawdown
};

/**
 * WebSocket event types
 */
export const WS_EVENTS = {
  // Price feed events
  TICKER_UPDATE: "ticker:update",
  CANDLE_UPDATE: "candle:update",
  // Order events
  ORDER_CREATED: "order:created",
  ORDER_FILLED: "order:filled",
  ORDER_CANCELLED: "order:cancelled",
  // Strategy events
  STRATEGY_STARTED: "strategy:started",
  STRATEGY_STOPPED: "strategy:stopped",
  STRATEGY_ERROR: "strategy:error",
  // System events
  SERVICE_STATUS: "service:status",
  ERROR: "error",
};

/**
 * Error codes
 */
export const ERROR_CODES = {
  // General errors
  UNKNOWN: "E000",
  INVALID_PARAMS: "E001",
  NOT_FOUND: "E002",
  UNAUTHORIZED: "E003",
  // Order errors
  INSUFFICIENT_BALANCE: "E100",
  ORDER_TOO_SMALL: "E101",
  ORDER_TOO_LARGE: "E102",
  INVALID_PRICE: "E103",
  ORDER_EXPIRED: "E104",
  // Strategy errors
  STRATEGY_NOT_FOUND: "E200",
  STRATEGY_ALREADY_RUNNING: "E201",
  INVALID_STRATEGY_CONFIG: "E202",
  // Network errors
  NETWORK_ERROR: "E300",
  RPC_ERROR: "E301",
  GAS_TOO_HIGH: "E302",
  // Market data errors
  FEED_ERROR: "E400",
  INVALID_SYMBOL: "E401",
  NO_DATA: "E402",
};
