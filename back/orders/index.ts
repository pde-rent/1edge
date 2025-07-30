// Export base handler functionality
export { getOrderHandler, registerOrderHandler, type OrderHandler } from "./base";

// Import all order handlers to register them
import "./stopLimit";
import "./chaseLimit";
import "./twap";
import "./dca";
// TODO: Add more handlers as needed:
// import "./range";
// import "./iceberg";
// import "./gridTrading";
// import "./momentumReversal";
// import "./rangeBreakout";