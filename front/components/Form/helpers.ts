/**
 * TWAP order configuration
 * Params: amount, startDate, endDate, interval, maxPrice
 */
export interface TwapParams {
  amount: string;
  startDate: number; // Timestamp
  endDate: number; // Timestamp
  interval: number; // Interval in ms
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
 * Breakout Trading configuration
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

export interface FormData {
  // Common fields
  size: string; // Changed from amount to size
  fromCoin: string;
  toCoin: string;
  amount: string;

  // TWAP/DCA fields
  startDate: string;
  endDate: string;
  interval: string;
  maxPrice: string;

  // Range/Iceberg/Grid fields
  startPrice: string;
  endPrice: string;
  stepPct: string;
  expiry: string;
  steps: string;

  // Strategy fields
  tpPct: string;
  slPct: string;
  singleSide: boolean;
  stepMultiplier: string;
  rsiPeriod: string;
  rsimaPeriod: string;
  adxPeriod: string;
  adxmaPeriod: string;
  emaPeriod: string;

  // Stop/Chase Limit fields
  stopPrice: string;
  limitPrice: string;
  distancePct: string;
}

export interface OrderType {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
}

/**
 * Get default expiry date (30 days from now)
 */
export const getDefaultExpiry = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 16);
};

/**
 * Get default form values
 */
export const getDefaultFormValues = (): FormData => ({
  // Common fields
  size: "",
  fromCoin: "ETH",
  toCoin: "USDC",
  amount: "",

  // TWAP/DCA defaults
  startDate: new Date().toISOString().slice(0, 16),
  endDate: (() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().slice(0, 16);
  })(),
  interval: "24",
  maxPrice: "",

  // Range/Iceberg/Grid defaults
  startPrice: "",
  endPrice: "",
  stepPct: "0.3",
  expiry: getDefaultExpiry(),
  steps: "",

  // Strategy defaults
  tpPct: "",
  slPct: "",
  singleSide: true,
  stepMultiplier: "1.0",
  rsiPeriod: "",
  rsimaPeriod: "",
  adxPeriod: "",
  adxmaPeriod: "",
  emaPeriod: "",

  // Stop/Chase Limit defaults
  stopPrice: "",
  limitPrice: "",
  distancePct: "",
});

/**
 * Extract relevant parameters for each order type
 */
export const getRelevantParams = (
  orderType: string,
  formData: FormData,
): OrderParams => {
  switch (orderType) {
    case "TWAP":
      return {
        amount: formData.amount,
        startDate: new Date(formData.startDate).getTime(),
        endDate: new Date(formData.endDate).getTime(),
        interval: parseInt(formData.interval) * 60 * 60 * 1000, // Convert hours to ms
        maxPrice: formData.maxPrice ? parseFloat(formData.maxPrice) : undefined,
      } as TwapParams;

    case "Range":
      return {
        amount: formData.amount,
        startPrice: parseFloat(formData.startPrice),
        endPrice: parseFloat(formData.endPrice),
        stepPct: parseFloat(formData.stepPct),
        expiry: parseInt(formData.expiry),
      } as RangeOrderParams;

    case "Iceberg":
      return {
        amount: formData.amount,
        startPrice: parseFloat(formData.startPrice),
        endPrice: parseFloat(formData.endPrice),
        steps: parseInt(formData.steps),
        expiry: parseInt(formData.expiry),
      } as IcebergParams;

    case "DCA":
      return {
        amount: formData.amount,
        startDate: new Date(formData.startDate).getTime(),
        interval: parseInt(formData.interval), // Days
        maxPrice: formData.maxPrice ? parseFloat(formData.maxPrice) : undefined,
      } as DCAParams;

    case "GridMarketMaking":
      return {
        amount: formData.amount,
        startPrice: parseFloat(formData.startPrice),
        endPrice: parseFloat(formData.endPrice),
        stepPct: parseFloat(formData.stepPct),
        stepMultiplier: parseFloat(formData.stepMultiplier),
        singleSide: formData.singleSide,
        tpPct: formData.tpPct ? parseFloat(formData.tpPct) : undefined,
      } as GridTradingParams;

    case "MomentumReversal":
      return {
        amount: formData.amount,
        rsiPeriod: parseInt(formData.rsiPeriod),
        rsimaPeriod: parseInt(formData.rsimaPeriod),
        tpPct: parseFloat(formData.tpPct),
        slPct: parseFloat(formData.slPct),
      } as MomentumReversalParams;

    case "RangeBreakout":
      return {
        amount: formData.amount,
        adxPeriod: parseInt(formData.adxPeriod),
        adxmaPeriod: parseInt(formData.adxmaPeriod),
        emaPeriod: parseInt(formData.emaPeriod),
        tpPct: parseFloat(formData.tpPct),
        slPct: parseFloat(formData.slPct),
      } as RangeBreakoutParams;

    case "StopLimit":
      return {
        amount: formData.amount,
        stopPrice: parseFloat(formData.stopPrice),
        limitPrice: parseFloat(formData.limitPrice),
        expiry: parseInt(formData.expiry),
      } as StopLimitParams;

    case "ChaseLimit":
      return {
        amount: formData.amount,
        distancePct: parseFloat(formData.distancePct),
        expiry: parseInt(formData.expiry),
        maxPrice: formData.maxPrice ? parseFloat(formData.maxPrice) : undefined,
      } as ChaseLimitParams;

    default:
      throw new Error(`Unknown order type: ${orderType}`);
  }
};

/**
 * Apply order defaults to form data
 */
export const applyOrderDefaults = (
  orderDefaults: any,
  setValue: (key: keyof FormData, value: string | boolean) => void,
): Partial<FormData> => {
  const updates: Partial<FormData> = {};

  // Common price fields
  if (orderDefaults.price) {
    updates.maxPrice = orderDefaults.price;
    updates.stopPrice = orderDefaults.price;
    updates.limitPrice = orderDefaults.price;
  }

  // Specific field mappings
  const fieldMappings: Record<string, keyof FormData> = {
    startPrice: "startPrice",
    endPrice: "endPrice",
    steps: "steps",
    expiry: "expiry",
    distancePct: "distancePct",
    startDate: "startDate",
    endDate: "endDate",
    interval: "interval",
    stepPct: "stepPct",
    fromCoin: "fromCoin",
    toCoin: "toCoin",
    size: "size", // Changed from amount to size
  };

  Object.entries(fieldMappings).forEach(([defaultKey, formKey]) => {
    if (orderDefaults[defaultKey] !== undefined) {
      updates[formKey] = orderDefaults[defaultKey];
    }
  });

  // Apply updates to form
  Object.entries(updates).forEach(([key, value]) => {
    setValue(key as keyof FormData, value);
  });

  return updates;
};

/**
 * Create strategy object for API submission
 */
export const createStrategy = (
  orderType: string,
  relevantParams: OrderParams,
  orderDefaults?: any,
) => ({
  id: new Date().toISOString(),
  name: orderType,
  type: orderType,
  config: relevantParams,
  context: orderDefaults
    ? {
        triggeredFromOrderbook: true,
        originalPrice: orderDefaults.price,
        isBuy: orderDefaults.isBuy,
        timestamp: orderDefaults.timestamp,
      }
    : null,
});

/**
 * Submit strategy to API
 */
export const submitStrategy = async (strategy: any): Promise<boolean> => {
  try {
    const response = await fetch("http://localhost:40005/strategies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(strategy),
    });

    return response.ok;
  } catch (error) {
    console.error("An error occurred while saving the strategy:", error);
    return false;
  }
};
