// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/IStrategy.sol";
import "../interfaces/IDelegateSafe.sol";
import "../libraries/TWAPOrderLib.sol";
import "../vendored/1inch/interfaces/IOrderMixin.sol";

// Simple TWAP Strategy.
contract MockStrategy is IStrategy {
    Address maker;
    Address receiver;
    Address makerAsset;
    Address takerAsset;
    uint256 makingAmount;
    uint256 takingAmount;

    address orderCreator;
    address orderReciever;

    constructor(
        address _maker,
        address _receiver,
        address _makerAsset,
        address _takerAsset,
        uint256 _makingAmount,
        uint256 _takingAmount,
        address _orderCreator,
        address _orderReciever
    ) {
        maker = Address.wrap(uint256(uint160(_maker)));
        receiver = Address.wrap(uint256(uint160(_receiver)));
        makerAsset = Address.wrap(uint256(uint160(_makerAsset)));
        takerAsset = Address.wrap(uint256(uint160(_takerAsset)));
        makingAmount = _makingAmount;
        takingAmount = _takingAmount;
        orderCreator = _orderCreator;
        orderReciever = _orderReciever;
    }

    function computeStrategyOrders(bytes memory)
        public
        override
        returns (IDelegateSafe.CreateOrderParams[] memory delegateOrders)
    {
        // Mock implementation for testing purposes.
        // In a real scenario, this would decode the orderData and create orders accordingly.
        delegateOrders = new IDelegateSafe.CreateOrderParams[](1);

        delegateOrders[0] = IDelegateSafe.CreateOrderParams({
            order: IOrderMixin.Order({
                salt: 0,
                makerAsset: makerAsset,
                takerAsset: takerAsset,
                makingAmount: makingAmount,
                takingAmount: makingAmount,
                maker: maker,
                receiver: maker,
                makerTraits: MakerTraits.wrap(1 << 251)
            }),
            extension: "",
            orderCreator: orderCreator,
            receiver: orderReciever
        });
        return delegateOrders;
    }

    function getMockOrder() external view returns (IOrderMixin.Order memory order) {
        order = IOrderMixin.Order({
            salt: 0,
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            makingAmount: makingAmount,
            takingAmount: takingAmount,
            maker: maker,
            receiver: maker,
            makerTraits: MakerTraits.wrap(1 << 251)
        });
    }

    function calculateFee(uint256 amount) external view returns (uint256) {
        return 0;
    }

    function treasury() external view returns (address) {
        return address(this);
    }
}
