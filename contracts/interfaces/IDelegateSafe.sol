// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../vendored/1inch/interfaces/IOrderMixin.sol";

interface IDelegateSafe {

    struct CreateOrderParams {
        IOrderMixin.Order order;
        bytes extension;
        address orderCreator;
        address reciever;
    }
}
