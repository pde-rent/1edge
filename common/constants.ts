
/** API server port number */
export const API_PORT = Number(process.env.API_PORT) || 40005;

/** Next.js server port number */
export const NEXT_PORT = Number(process.env.NEXT_PORT) || 40006;

/** API server hostname */
export const API_HOST = process.env.API_HOST || "localhost";

/** Service ports configuration */
export const SERVICE_PORTS = {
  API: Number(process.env.API_PORT) || 40005,
  WEBSOCKET: Number(process.env.WEBSOCKET_PORT) || 40007,
  COLLECTOR: Number(process.env.COLLECTOR_PORT) || 40008,
  ORDER_REGISTRY: Number(process.env.ORDER_REGISTRY_PORT) || 40009,
  STATUS_CHECKER: Number(process.env.STATUS_CHECKER_PORT) || 40011,
} as const;

/** Native pub/sub server port for internal messaging */
export const INTRACO_PORT = Number(process.env.INTRACO_PORT) || 40042;

/** Next.js server hostname */
export const NEXT_HOST = process.env.NEXT_HOST || "localhost";

/** Full API server URL */
export const API_URL = process.env.API_URL || `http://${API_HOST}:${API_PORT}`;

/** Full Next.js server URL */
export const NEXT_URL =
  process.env.NEXT_URL || `http://${NEXT_HOST}:${NEXT_PORT}`;

/** UI Theme configuration - single source of truth for application styling */
export const THEME = {
  /** Primary brand color */
  primary: "#00B8D4", // Bright Cyan
  /** Secondary brand color */
  secondary: "#F0B90B", // Orange
  /** Warning state color */
  warning: "#FF8C00", // Warning orange
  /** Background color palette */
  background: {
    /** Main application background */
    main: "#000000", // Pure black background
    /** Card and panel backgrounds */
    paper: "#0a0a0a", // Very dark background
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
    primary: "#ffffff", // Pure white text
    /** Secondary text color */
    secondary: "#a0a0a0", // Muted grey text
  },
  /** Error state color */
  error: "#F6465D", // Error red
  /** Success state color */
  success: "#0ECB81", // Success green
  /** Border color */
  border: "#00B8D4", // Bright Cyan
  /** Primary color variants for consistency */
  primaryVariants: {
    /** Standard primary */
    default: "#00B8D4",
    /** Darkened primary for borders - 50% opacity for better visibility */
    dark: "#00B8D480", // 50% opacity
    /** Light transparent for backgrounds */
    light10: "#00B8D41A", // 10% opacity
    /** Medium transparent for hover states */
    light20: "#00B8D433", // 20% opacity
    /** Strong transparent for active states */
    light30: "#00B8D44D", // 30% opacity
  },
  /** Chart colors */
  chart: {
    /** Candlestick up color */
    upColor: "#10b981", // emerald-500
    /** Candlestick down color */
    downColor: "#ef4444", // red-500
    /** Grid line color */
    gridColor: "#334155", // slate-700
    /** Text color for charts */
    textColor: "#e2e8f0", // slate-200
    /** Border color for chart elements */
    borderColor: "#64748b", // slate-500
    /** Background for chart labels */
    labelBg: "#1e293b", // slate-800
    /** Volume indicator color */
    volumeColor: "#14b8a6", // teal-500
  },
  /** Status indicator colors */
  status: {
    /** Online/active status */
    online: "#22c55e", // green-500
    /** Offline/inactive status */  
    offline: "#ef4444", // red-500
    /** Warning status */
    warning: "#f59e0b", // amber-500
  },
  /** Scrollbar colors */
  scrollbar: {
    /** Track background */
    track: "#0a0a0a",
    /** Thumb color */
    thumb: "#22d3ee40", // cyan-300 with 40% opacity
    /** Thumb hover color */
    thumbHover: "#22d3ee60", // cyan-300 with 60% opacity
    /** Thumb active color */
    thumbActive: "#22d3ee80", // cyan-300 with 80% opacity
    /** Full opacity scrollbar color */
    full: "#22d3ee", // cyan-300
  },
  /** Mermaid diagram colors */
  mermaid: {
    /** Primary color for diagrams */
    primaryColor: "#22c55e",
    /** Primary text color */
    primaryTextColor: "#ffffff",
    /** Primary border color */
    primaryBorderColor: "#22c55e",
    /** Line color */
    lineColor: "#6b7280",
    /** Section background color */
    sectionBkgColor: "#1a1a1a",
    /** Alternative section background */
    altSectionBkgColor: "#0a0a0a",
    /** Grid color */
    gridColor: "#374151",
    /** Secondary color */
    secondaryColor: "#374151",
    /** Tertiary color */
    tertiaryColor: "#4b5563",
  },
  /** Code syntax highlighting colors */
  syntax: {
    /** Comments */
    comment: "#6b7280",
    /** Default text */
    default: "#e5e7eb",
    /** Keywords */
    keyword: "#00B8D4",
    /** Strings */
    string: "#10b981",
    /** Functions */
    function: "#fbbf24",
    /** Operators */
    operator: "#f87171",
    /** Numbers */
    number: "#fbbf24",
    /** Variables */
    variable: "#a78bfa",
    /** Types */
    type: "#00B8D4",
    /** Properties */
    property: "#10b981",
    /** Punctuation */
    punctuation: "#9ca3af",
    /** Tags */
    tag: "#00B8D4",
    /** Attributes */
    attribute: "#f87171",
  },
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
    // Core theme colors
    "--primary-color": THEME.primary,
    "--primary-dark": THEME.primaryVariants.dark,
    "--primary-light-10": THEME.primaryVariants.light10,
    "--primary-light-20": THEME.primaryVariants.light20,
    "--primary-light-30": THEME.primaryVariants.light30,
    "--secondary-color": THEME.secondary,
    "--background-main": THEME.background.main,
    "--background-secondary": THEME.background.paper,
    "--text-primary": THEME.text.primary,
    "--text-secondary": THEME.text.secondary,
    "--error-color": THEME.error,
    "--success-color": THEME.success,
    "--border-color": THEME.border,
    
    // Chart colors
    "--chart-up-color": THEME.chart.upColor,
    "--chart-down-color": THEME.chart.downColor,
    "--chart-grid-color": THEME.chart.gridColor,
    "--chart-text-color": THEME.chart.textColor,
    "--chart-border-color": THEME.chart.borderColor,
    "--chart-label-bg": THEME.chart.labelBg,
    "--chart-volume-color": THEME.chart.volumeColor,
    
    // Status colors
    "--status-online": THEME.status.online,
    "--status-offline": THEME.status.offline,
    "--status-warning": THEME.status.warning,
    
    // Scrollbar colors
    "--scrollbar-track": THEME.scrollbar.track,
    "--scrollbar-thumb": THEME.scrollbar.thumb,
    "--scrollbar-thumb-hover": THEME.scrollbar.thumbHover,
    "--scrollbar-thumb-active": THEME.scrollbar.thumbActive,
    "--scrollbar-full": THEME.scrollbar.full,
    
    // Mermaid colors
    "--mermaid-primary": THEME.mermaid.primaryColor,
    "--mermaid-primary-text": THEME.mermaid.primaryTextColor,
    "--mermaid-primary-border": THEME.mermaid.primaryBorderColor,
    "--mermaid-line": THEME.mermaid.lineColor,
    "--mermaid-section-bg": THEME.mermaid.sectionBkgColor,
    "--mermaid-alt-section-bg": THEME.mermaid.altSectionBkgColor,
    "--mermaid-grid": THEME.mermaid.gridColor,
    "--mermaid-secondary": THEME.mermaid.secondaryColor,
    "--mermaid-tertiary": THEME.mermaid.tertiaryColor,
    
    // Syntax highlighting colors
    "--syntax-comment": THEME.syntax.comment,
    "--syntax-default": THEME.syntax.default,
    "--syntax-keyword": THEME.syntax.keyword,
    "--syntax-string": THEME.syntax.string,
    "--syntax-function": THEME.syntax.function,
    "--syntax-operator": THEME.syntax.operator,
    "--syntax-number": THEME.syntax.number,
    "--syntax-variable": THEME.syntax.variable,
    "--syntax-type": THEME.syntax.type,
    "--syntax-property": THEME.syntax.property,
    "--syntax-punctuation": THEME.syntax.punctuation,
    "--syntax-tag": THEME.syntax.tag,
    "--syntax-attribute": THEME.syntax.attribute,
    
    // Shadows and effects
    "--shadow-light": THEME.shadow.light,
    "--shadow-medium": THEME.shadow.medium,
    "--shadow-dark": THEME.shadow.dark,
    
    // Typography
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
    
    // Shadcn/UI variables for proper theming
    "--background": THEME.background.main,
    "--foreground": THEME.text.primary,
    "--card": THEME.background.paper,
    "--card-foreground": THEME.text.primary,
    "--popover": THEME.background.paper,
    "--popover-foreground": THEME.text.primary,
    "--primary": THEME.primary,
    "--primary-foreground": THEME.background.main,
    "--secondary": THEME.background.paper,
    "--secondary-foreground": THEME.text.primary,
    "--muted": THEME.background.paper,
    "--muted-foreground": THEME.text.secondary,
    "--accent": THEME.background.overlay10,
    "--accent-foreground": THEME.text.primary,
    "--destructive": THEME.error,
    "--destructive-foreground": THEME.text.primary,
    "--border": THEME.border,
    "--input": THEME.border,
    "--ring": THEME.primary,
    
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
  margin: [0, 0] as [number, number],
  /** Container padding */
  containerPadding: [0, 0] as [number, number],
  /** Resize handle positions */
  resizeHandles: ["se", "sw", "ne", "nw"] as Array<"se" | "sw" | "ne" | "nw">,
  /** Total rows per breakpoint */
  totalRowsMap: {
    lg: 32,
    md: 40,
    sm: 72,
    xs: 80,
    xxs: 100
  },
  initialLayouts: {
    lg: [
      // Top row: Expanded chart and narrower order book
      { i: "activeFeed", x: 0, y: 0, w: 7, h: 20, static: true, minW: 6, minH: 12 },
      { i: "services", x: 7, y: 0, w: 2, h: 20, static: true, minW: 2, minH: 20 },
      { i: "config", x: 9, y: 0, w: 3, h: 32, static: true, minW: 3, minH: 20 },
      // Bottom row: Positions panel spans under both chart and orderbook
      { i: "positions", x: 0, y: 20, w: 9, h: 12, static: true, minW: 9, minH: 8 },
    ], md: [
      // Top row: Expanded chart and narrower order book
      { i: "activeFeed", x: 0, y: 0, w: 6, h: 16, static: true, minW: 5, minH: 10 },
      { i: "services", x: 6, y: 0, w: 2, h: 16, static: true, minW: 2, minH: 16 },
      { i: "config", x: 8, y: 0, w: 2, h: 28, static: true, minW: 2, minH: 20 },
      // Bottom row: Positions panel spans under both chart and orderbook
      { i: "positions", x: 0, y: 16, w: 8, h: 12, static: true, minW: 8, minH: 8 },
    ],

    sm: [
      // Mobile/small screen - vertical stack
      { i: "activeFeed", x: 0, y: 0, w: 6, h: 16, static: true, minW: 6, minH: 12 },
      { i: "services", x: 0, y: 16, w: 6, h: 16, static: true, minW: 6, minH: 12 },
      { i: "positions", x: 0, y: 32, w: 6, h: 12, static: true, minW: 6, minH: 8 },
      { i: "config", x: 0, y: 44, w: 6, h: 16, static: true, minW: 6, minH: 12 },
    ],
  } as Record<string, any[]>,
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
