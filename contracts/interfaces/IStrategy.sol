// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../vendored/1inch/interfaces/IOrderMixin.sol";
import "./IDelegateSafe.sol";

interface IStrategy {
    function computeStrategyOrders(bytes memory) external returns (IDelegateSafe.CreateOrderParams[] memory);
    function calculateFee(uint256 amount) external view returns (uint256);
    function treasury() external view returns (address);
}
