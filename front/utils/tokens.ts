/**
 * Token utility functions for consistent token display across the app
 */

// Generate a consistent hash from string
export const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

// Available color schemes for tokens
export const tokenColorSchemes = [
  {
    name: "blue",
    primary: "#3B82F6",
    bg: "from-blue-500/20 to-blue-600/20",
    border: "border-blue-400/30",
  },
  {
    name: "purple",
    primary: "#A855F7",
    bg: "from-purple-500/20 to-purple-600/20",
    border: "border-purple-400/30",
  },
  {
    name: "pink",
    primary: "#EC4899",
    bg: "from-pink-500/20 to-pink-600/20",
    border: "border-pink-400/30",
  },
  {
    name: "green",
    primary: "#10B981",
    bg: "from-green-500/20 to-green-600/20",
    border: "border-green-400/30",
  },
  {
    name: "orange",
    primary: "#F97316",
    bg: "from-orange-500/20 to-orange-600/20",
    border: "border-orange-400/30",
  },
  {
    name: "red",
    primary: "#EF4444",
    bg: "from-red-500/20 to-red-600/20",
    border: "border-red-400/30",
  },
  {
    name: "indigo",
    primary: "#6366F1",
    bg: "from-indigo-500/20 to-indigo-600/20",
    border: "border-indigo-400/30",
  },
  {
    name: "yellow",
    primary: "#EAB308",
    bg: "from-yellow-500/20 to-yellow-600/20",
    border: "border-yellow-400/30",
  },
  {
    name: "teal",
    primary: "#14B8A6",
    bg: "from-teal-500/20 to-teal-600/20",
    border: "border-teal-400/30",
  },
  {
    name: "cyan",
    primary: "#06B6D4",
    bg: "from-cyan-500/20 to-cyan-600/20",
    border: "border-cyan-400/30",
  },
];

// Special symbols for known tokens
export const tokenSymbols: Record<string, string> = {
  // Native & Wrapped native
  ETH: "Ξ",
  WETH: "Ξ",
  BTC: "₿",
  WBTC: "₿",
  BNB: "B",
  WBNB: "B",
  MATIC: "M",
  WMATIC: "M",
  AVAX: "A",
  WAVAX: "A",

  // Stablecoins
  USDC: "$",
  USDT: "₮",
  DAI: "◈",
  BUSD: "B$",
  TUSD: "T$",
  FRAX: "F",
  LUSD: "L$",
  USDD: "D$",
  UST: "U$",

  // Fiat representations
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  CHF: "₣",
  CAD: "C$",
  AUD: "A$",

  // DeFi tokens
  UNI: "🦄",
  SUSHI: "🍣",
  AAVE: "A",
  COMP: "C",
  CRV: "⚡",
  MKR: "M",
  SNX: "S",
  YFI: "Y",
  "1INCH": '1"',

  // Layer 2 & Other chains
  ARB: "A",
  OP: "O",
  METIS: "M",

  // Other popular tokens
  LINK: "⬡",
  LDO: "L",
  RPL: "R",
  FXS: "F",
};

/**
 * Get consistent color scheme for a token
 */
export const getTokenColorScheme = (token: string) => {
  const colorIndex = hashString(token) % tokenColorSchemes.length;
  return tokenColorSchemes[colorIndex];
};

/**
 * Get display symbol for a token
 */
export const getTokenSymbol = (token: string): string => {
  // Check if we have a special symbol
  if (tokenSymbols[token.toUpperCase()]) {
    return tokenSymbols[token.toUpperCase()];
  }

  // For short tokens (3 chars or less), use the full symbol
  if (token.length <= 3) {
    return token.toUpperCase();
  }

  // For longer tokens, use first 2 characters
  return token.slice(0, 2).toUpperCase();
};

/**
 * Get full token display info
 */
export interface TokenDisplayInfo {
  symbol: string;
  colorScheme: (typeof tokenColorSchemes)[0];
  bg: string;
  border: string;
  primary: string;
}

export const getTokenDisplayInfo = (token: string): TokenDisplayInfo => {
  const colorScheme = getTokenColorScheme(token);
  const symbol = getTokenSymbol(token);

  return {
    symbol,
    colorScheme,
    bg: `bg-gradient-to-r ${colorScheme.bg}`,
    border: colorScheme.border,
    primary: colorScheme.primary,
  };
};

/**
 * Format token amount with appropriate decimals
 */
export const formatTokenAmount = (
  amount: string | number,
  decimals: number = 18,
  displayDecimals: number = 6,
): string => {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;

  // Handle very small amounts
  if (value > 0 && value < Math.pow(10, -displayDecimals)) {
    return `<0.${"0".repeat(displayDecimals - 1)}1`;
  }

  // Format with appropriate decimals
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals,
  });
};

/**
 * Check if a token is a stablecoin
 */
export const isStablecoin = (token: string): boolean => {
  const stablecoins = [
    "USDC",
    "USDT",
    "DAI",
    "BUSD",
    "TUSD",
    "FRAX",
    "LUSD",
    "USDD",
    "UST",
  ];
  return stablecoins.includes(token.toUpperCase());
};

/**
 * Check if a token is a wrapped native token
 */
export const isWrappedNative = (token: string): boolean => {
  const wrapped = ["WETH", "WBTC", "WBNB", "WMATIC", "WAVAX"];
  return wrapped.includes(token.toUpperCase());
};
