// Export base handler functionality
export { 
  getOrderWatcher, 
  registerOrderWatcher, 
  type OrderWatcher,
  BaseOrderWatcher,
  TimeBasedOrderWatcher,
  PriceBasedOrderWatcher,
  SteppedOrderWatcher,
  type PriceInfo,
  type OrderExecutionContext,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  RSI_OVERSOLD,
  RSI_OVERBOUGHT
} from "./base";

// Import all order watchers to register them
import "./stop";
import "./chase";
import "./twap";
import "./range";
import "./dca";
import "./iceberg";
import "./grid";
import "./momentum";
import "./breakout";