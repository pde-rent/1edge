// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IStrategy.sol";
import "../interfaces/IDelegateSafe.sol";
import "../vendored/1inch/interfaces/IOrderMixin.sol";

contract TWAPStrategy is IStrategy {
    // need track orders created by strategy in delegate contract to see if they were executed or cancelled.
    // if they were cancelled, cancel the strategy order.
    struct TWAPOrder {
        bytes32 nonce;
        address reciever;
        uint256 startTime;
        uint256 endTime;
        uint256 interval;
        uint256 totalAmount;
    }

    function computeStrategyOrders(bytes memory orderData)
        public
        override
        returns (IDelegateSafe.CreateOrderParams[] memory)
    {}

    function calculateFee(uint256 amount) external view override returns (uint256) {
        // Implement fee calculation logic
        return 0; // Placeholder
    }

    function treasury() external view override returns (address) {
        // Implement logic to return the treasury address
        return address(0); // Placeholder
    }
}
