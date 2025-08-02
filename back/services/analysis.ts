import type { TickerAnalysis, TickerOHLCV } from "@common/types";
import { INDICATOR_DEFAULTS } from "@common/constants";
import * as ti from "technicalindicators";

/**
 * Analyze OHLCV data and calculate technical indicators
 */
export function analyse(ohlcv: TickerOHLCV): TickerAnalysis {
  const { ts, h, l, c, v } = ohlcv;

  if (c.length === 0) {
    return { ts: [] };
  }

  const analysis: TickerAnalysis = {
    ts: ts,
  };

  // Calculate percentage change
  analysis.pct = calculatePercentChange(c);

  // Calculate Rate of Change (ROC)
  analysis.roc = calculateROC(c, 12);

  // Calculate volatility (standard deviation of returns)
  analysis.vol = calculateVolatility(c, 20);

  // Calculate ATR (Average True Range)
  analysis.atr = calculateATR(h, l, c, 14);

  // Calculate ADX
  analysis.adx = calculateADX(h, l, c, 14);

  // Calculate EMA
  analysis.ema = calculateEMA(c, INDICATOR_DEFAULTS.EMA.shortPeriod);

  // Calculate RSI
  analysis.rsi = calculateRSI(c, INDICATOR_DEFAULTS.RSI.period);

  // Calculate momentum
  analysis.mom = calculateMomentum(c, 12);

  // Calculate MACD
  analysis.macd = calculateMACD(
    c,
    INDICATOR_DEFAULTS.MACD.fastPeriod,
    INDICATOR_DEFAULTS.MACD.slowPeriod,
    INDICATOR_DEFAULTS.MACD.signalPeriod,
  );

  // Calculate Bollinger Bands
  analysis.bb = calculateBollingerBands(
    c,
    INDICATOR_DEFAULTS.BB.period,
    INDICATOR_DEFAULTS.BB.stdDev,
  );

  // Calculate SMA
  analysis.sma = calculateSMA(c, INDICATOR_DEFAULTS.SMA.shortPeriod);

  // Volume analysis
  analysis.volume = v;

  return analysis;
}

/**
 * Calculate percentage change
 */
function calculatePercentChange(prices: number[]): number[] {
  const result: number[] = [0]; // First value has no change

  for (let i = 1; i < prices.length; i++) {
    const change = ((prices[i] - prices[i - 1]) / prices[i - 1]) * 100;
    result.push(isNaN(change) ? 0 : change);
  }

  return result;
}

/**
 * Calculate Rate of Change
 */
function calculateROC(prices: number[], period: number): number[] {
  const roc = ti.ROC.calculate({
    values: prices,
    period: period,
  });

  // Pad with NaN for missing values
  const padding = Array.from({ length: period }, () => NaN);
  return [...padding, ...roc];
}

/**
 * Calculate volatility (standard deviation of returns)
 */
function calculateVolatility(prices: number[], period: number): number[] {
  const returns = calculatePercentChange(prices);
  const volatility: number[] = [];

  for (let i = 0; i < returns.length; i++) {
    if (i < period - 1) {
      volatility.push(NaN);
    } else {
      const slice = returns.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const variance =
        slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
      volatility.push(Math.sqrt(variance));
    }
  }

  return volatility;
}

/**
 * Calculate Average True Range
 */
function calculateATR(
  high: number[],
  low: number[],
  close: number[],
  period: number,
): number[] {
  const atr = ti.ATR.calculate({
    high: high,
    low: low,
    close: close,
    period: period,
  });

  // Pad with NaN for missing values
  const padding = Array.from({ length: period }, () => NaN);
  return [...padding, ...atr];
}

/**
 * Calculate ADX
 */
function calculateADX(
  high: number[],
  low: number[],
  close: number[],
  period: number,
): number[] {
  const adx = ti.ADX.calculate({
    high: high,
    low: low,
    close: close,
    period: period,
  });

  // Pad with NaN for missing values
  const padding = Array.from({ length: period * 2 - 1 }, () => NaN);
  return [...padding, ...adx.map((r: any) => r.adx)];
}

/**
 * Calculate Exponential Moving Average
 */
function calculateEMA(prices: number[], period: number): number[] {
  const ema = ti.EMA.calculate({
    values: prices,
    period: period,
  });

  // Pad with NaN for missing values
  const padding = Array.from({ length: period - 1 }, () => NaN);
  return [...padding, ...ema];
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices: number[], period: number): number[] {
  const sma = ti.SMA.calculate({
    values: prices,
    period: period,
  });

  // Pad with NaN for missing values
  const padding = Array.from({ length: period - 1 }, () => NaN);
  return [...padding, ...sma];
}

/**
 * Calculate Relative Strength Index
 */
function calculateRSI(prices: number[], period: number): number[] {
  const rsi = ti.RSI.calculate({
    values: prices,
    period: period,
  });

  // Pad with NaN for missing values
  const padding = Array.from({ length: period }, () => NaN);
  return [...padding, ...rsi];
}

/**
 * Calculate Momentum
 */
function calculateMomentum(prices: number[], period: number): number[] {
  const momentum: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      momentum.push(NaN);
    } else {
      momentum.push(prices[i] - prices[i - period]);
    }
  }

  return momentum;
}

/**
 * Calculate MACD
 */
function calculateMACD(
  prices: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): { macd: number[]; signal: number[]; histogram: number[] } {
  const macdResult = ti.MACD.calculate({
    values: prices,
    fastPeriod: fastPeriod,
    slowPeriod: slowPeriod,
    signalPeriod: signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  // Extract arrays and pad
  const padding = Array.from({ length: slowPeriod - 1 }, () => NaN);
  const macd = [...padding, ...macdResult.map((r: any) => r.MACD || NaN)];
  const signal = [...padding, ...macdResult.map((r: any) => r.signal || NaN)];
  const histogram = [
    ...padding,
    ...macdResult.map((r: any) => r.histogram || NaN),
  ];

  return { macd, signal, histogram };
}

/**
 * Calculate Bollinger Bands
 */
function calculateBollingerBands(
  prices: number[],
  period: number,
  stdDev: number,
): { upper: number[]; middle: number[]; lower: number[] } {
  const bb = ti.BollingerBands.calculate({
    period: period,
    values: prices,
    stdDev: stdDev,
  });

  // Extract arrays and pad
  const padding = Array.from({ length: period - 1 }, () => NaN);
  const upper = [...padding, ...bb.map((r: any) => r.upper)];
  const middle = [...padding, ...bb.map((r: any) => r.middle)];
  const lower = [...padding, ...bb.map((r: any) => r.lower)];

  return { upper, middle, lower };
}

/**
 * Check for bullish divergence
 */
export function checkBullishDivergence(
  prices: number[],
  indicator: number[],
): boolean {
  if (prices.length < 4 || indicator.length < 4) return false;

  const len = prices.length;

  // Look for lower lows in price but higher lows in indicator
  const priceLow1 = Math.min(...prices.slice(len - 4, len - 2));
  const priceLow2 = Math.min(...prices.slice(len - 2));
  const indicatorLow1 = Math.min(...indicator.slice(len - 4, len - 2));
  const indicatorLow2 = Math.min(...indicator.slice(len - 2));

  return priceLow2 < priceLow1 && indicatorLow2 > indicatorLow1;
}

/**
 * Check for bearish divergence
 */
export function checkBearishDivergence(
  prices: number[],
  indicator: number[],
): boolean {
  if (prices.length < 4 || indicator.length < 4) return false;

  const len = prices.length;

  // Look for higher highs in price but lower highs in indicator
  const priceHigh1 = Math.max(...prices.slice(len - 4, len - 2));
  const priceHigh2 = Math.max(...prices.slice(len - 2));
  const indicatorHigh1 = Math.max(...indicator.slice(len - 4, len - 2));
  const indicatorHigh2 = Math.max(...indicator.slice(len - 2));

  return priceHigh2 > priceHigh1 && indicatorHigh2 < indicatorHigh1;
}

/**
 * Get current indicator values
 */
export function getCurrentIndicators(analysis: TickerAnalysis): {
  rsi?: number;
  ema?: number;
  sma?: number;
  momentum?: number;
  atr?: number;
  bb?: { upper: number; middle: number; lower: number };
  macd?: { macd: number; signal: number; histogram: number };
} {
  const last = (arr?: number[]) => {
    if (!arr || arr.length === 0) return undefined;
    const val = arr[arr.length - 1];
    return isNaN(val) ? undefined : val;
  };

  return {
    rsi: last(analysis.rsi),
    ema: last(analysis.ema),
    sma: last(analysis.sma),
    momentum: last(analysis.mom),
    atr: last(analysis.atr),
    bb: analysis.bb
      ? {
          upper: last(analysis.bb.upper) || 0,
          middle: last(analysis.bb.middle) || 0,
          lower: last(analysis.bb.lower) || 0,
        }
      : undefined,
    macd: analysis.macd
      ? {
          macd: last(analysis.macd.macd) || 0,
          signal: last(analysis.macd.signal) || 0,
          histogram: last(analysis.macd.histogram) || 0,
        }
      : undefined,
  };
}
