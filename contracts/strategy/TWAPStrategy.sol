// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/IStrategy.sol";
import "../interfaces/IDelegateSafe.sol";
import "../libraries/TWAPOrderLib.sol";
import "../vendored/1inch/interfaces/IOrderMixin.sol";

// Simple TWAP Strategy.
contract TWAPStrategy is EIP712, IStrategy {
    // need to track orders created by strategy in delegate contract to see if they were executed or cancelled.
    // if they were cancelled, cancel the strategy order.
    IDelegateSafe private immutable DELEGATE_SAFE;
    IOrderMixin private immutable LIMIT_ORDER_PROTOCOL;

    // mapping(bytes32 twapOrderId => TWAPOrder) public twapOrders;
    mapping(bytes32 twapOrderId => IOrderMixin.Order[]) public twapSubOrders;
    mapping(bytes32 twapOrderId => address) public twapCreator;
    mapping(bytes32 twapOrderId => bool) public twapOrderExecuted;

    // ERRORS
    error InvalidSignature();
    error InvalidTWAPOrder();
    error OrderAlreadyExecutedOrCancelled();
    error CallerNotOrderCreator();
    error CallerNotDelegateSafe();

    // EVENTS
    event TWAPOrderCancelled(bytes32 indexed twapOrderId);

    modifier onlyDelegateSafe() {
        if (msg.sender != address(DELEGATE_SAFE)) {
            revert CallerNotDelegateSafe();
        }
        _;
    }

    constructor(IOrderMixin _limitOrderProtocol, IDelegateSafe delegateSafe) EIP712("TWAP Strategy", "1") {
        DELEGATE_SAFE = delegateSafe;
        LIMIT_ORDER_PROTOCOL = _limitOrderProtocol;
    }

    function computeStrategyOrders(bytes memory orderData)
        public
        override
        onlyDelegateSafe
        returns (IDelegateSafe.CreateOrderParams[] memory delegateOrders)
    {
        (TWAPOrder memory twapOrder, uint256 takingAmount, bytes memory signature) =
            abi.decode(orderData, (TWAPOrder, uint256, bytes));

        bytes32 orderHash = _hashTypedDataV4(twapOrder.toStructHash());

        if (twapOrderExecuted[orderHash]) {
            revert OrderAlreadyExecutedOrCancelled();
        }

        // this strategy only supports orders that are signed by eoas.
        address orderCreator = ECDSA.recover(orderHash, signature);
        if (orderCreator == address(0)) revert InvalidSignature();
        twapCreator[orderHash] = orderCreator;

        validateTWAPOrder(orderHash, twapOrder);

        (IOrderMixin.Order memory order, bytes memory extension) =
            twapOrder.to1InchOrder(address(DELEGATE_SAFE), takingAmount);

        twapSubOrders[orderHash].push(order);

        delegateOrders = new IDelegateSafe.CreateOrderParams[](1);
        delegateOrders[0] = IDelegateSafe.CreateOrderParams({
            order: order,
            extension: extension,
            orderCreator: orderCreator,
            receiver: twapOrder.receiver
        });
    }

    function validateTWAPOrder(bytes32 twapOrderId, TWAPOrder memory twapOrder) internal {
        uint256 currentInterval = twapSubOrders[twapOrderId].length;
        bool isValidOrder = true;
        isValidOrder = isValidOrder && twapOrder.intervals > 0;
        isValidOrder = isValidOrder && twapOrder.numIntervals > 0;
        // need a way to enforce that the order is not executed before the start time.
        // but with the current implementation, we might need to submit the order before the start time.
        // potential solution is to use a predicate.
        // isValidOrder &&= twapOrder.startTime + (currentInterval * twapOrder.intervals) > block.timestamp;
        // isValidOrder &&= (twapOrder.startTime + twapOrder.intervals) > block.timestamp;
        if (!isValidOrder) {
            revert InvalidTWAPOrder();
        }
        if (currentInterval == twapOrder.numIntervals) {
            twapOrderExecuted[twapOrderId] = true;
        }
    }

    function cancelTWAPOrder(bytes32 twapOrderId) external {
        if (twapCreator[twapOrderId] != msg.sender) {
            revert CallerNotOrderCreator();
        }
        // ensure the order is active and not executed or cancelled.
        uint256 subOrderLength = twapSubOrders[twapOrderId].length;
        if (!(subOrderLength > 0)) {
            revert InvalidTWAPOrder();
        }
        if (twapOrderExecuted[twapOrderId]) {
            revert OrderAlreadyExecutedOrCancelled();
        }
        // cancel all sub-orders, or atleast the latest one if it has not been executed.
        IOrderMixin.Order memory orderToCancel = twapSubOrders[twapOrderId][subOrderLength - 1];
        if (DELEGATE_SAFE.isActiveOrder(orderToCancel)) {
            DELEGATE_SAFE.cancelOrder(orderToCancel);
        }

        twapOrderExecuted[twapOrderId] = true;
        emit TWAPOrderCancelled(twapOrderId);
    }

    function calculateFee(uint256 takingAmount) external view override returns (uint256) {
        return 0;
    }

    function treasury() external view override returns (address) {
        return address(this);
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getMockOrder() external view returns (IOrderMixin.Order memory) {}
}
