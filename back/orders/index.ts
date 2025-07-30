// Export base handler functionality
export { getOrderWatcher, registerOrderWatcher, type OrderWatcher } from "./base";

// Import all order watchers to register them
import "./stopLimit";
import "./chaseLimit";
import "./twap";
import "./dca";
// TODO: Add more watchers as needed:
// import "./range";
// import "./iceberg";
// import "./gridTrading";
// import "./momentumReversal";
// import "./rangeBreakout";
