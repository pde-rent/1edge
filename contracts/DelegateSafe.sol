// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IDelegateSafe.sol";
import "./interfaces/IStrategy.sol";
import "./vendored/1inch/interfaces/IOrderMixin.sol";
import "./vendored/1inch/interfaces/IOrderRegistrator.sol";
import "./vendored/1inch/interfaces/IPostInteraction.sol";
import "./vendored/1inch/libraries/MakerTraitsLib.sol";

// Simple Escrow contract that handles user funds and tracks orders.
contract DelegateSafe is IERC1271, IDelegateSafe, IPostInteraction, Ownable {
    using AddressLib for Address;
    using MakerTraitsLib for MakerTraits;

    IOrderMixin private immutable LIMIT_ORDER_PROTOCOL;
    // IOrderRegistrator private immutable ORDER_REGISTRATOR;

    // need to have a post-call interaction that notifies us when a user's order has being executed.
    // funds are tracked per order to enable refunds in case of order cancellation.
    mapping(bytes32 orderId => OrderData) public orderData;
    mapping(address keepers => bool) public approvedKeeper;

    // Errors
    error CallerNotApprovedKeeper();
    error KeeperNotApproved(address);
    error KeeperAlreadyApproved(address);
    error CallerNotLimitOrderProtocol();
    error OrderAlreadyExecutedOrCancelled();
    error CallerNotOrderCreator();
    error InvalidMakerAddress();
    error InvalidMakerTraits();
    error InvalidOrder();

    // Events
    event KeeperApproved(address keeper);
    event KeeperRevoked(address keeper);
    event OrderCreated(bytes32 indexed orderId, IStrategy strategy, IOrderMixin.Order order);
    event OrderCancelled(bytes32 indexed orderId, IStrategy strategy);

    // need to add support for partial fills.
    struct OrderData {
        uint256 amountCommitted; // amount of funds committed to the order
        address receiver; // address that recieves order funds
        IStrategy strategy; // strategy used to compute the order fee;
        uint8 status; // status of the order (e.g., pending - 0, executed - 1, cancelled - 2)
        bool isSignedOrder; // whether the order is signed by this contract or not
    }

    modifier onlyLimitOrderProtocol() {
        if (msg.sender != address(LIMIT_ORDER_PROTOCOL)) {
            revert CallerNotLimitOrderProtocol();
        }
        _;
    }

    modifier onlyApprovedKeeper() {
        // check if the caller is an approved keeper
        if (!approvedKeeper[msg.sender]) {
            revert CallerNotApprovedKeeper();
        }
        _;
    }

    constructor(IOrderMixin _limitOrderProtocol /*, IOrderRegistrator _orderRegistrator*/ ) Ownable(msg.sender) {
        LIMIT_ORDER_PROTOCOL = _limitOrderProtocol;
        // ORDER_REGISTRATOR = _orderRegistrator;
    }

    // create user order with order registrator.
    function createUserOrder(bytes memory data) external onlyApprovedKeeper {
        (IStrategy orderStrategy, bytes memory _orderDataWithSig) = abi.decode(data, (IStrategy, bytes));
        CreateOrderParams[] memory params = orderStrategy.computeStrategyOrders(_orderDataWithSig);

        for (uint256 i = 0; i < params.length; i++) {
            _pullFunds(IERC20(params[i].order.makerAsset.get()), params[i].orderCreator, params[i].order.makingAmount);

            bytes32 orderId = LIMIT_ORDER_PROTOCOL.hashOrder(params[i].order);

            if (orderData[orderId].isSignedOrder) {
                revert InvalidOrder();
            }

            orderData[orderId] = OrderData({
                amountCommitted: params[i].order.makingAmount,
                receiver: params[i].receiver,
                strategy: orderStrategy,
                status: 0, // 0 for pending
                isSignedOrder: true
            });

            _validateOrderAndExtension(params[i].order, params[i].extension);
            // ORDER_REGISTRATOR.registerOrder(params[i].order, params[i].extension, "");
            emit OrderCreated(orderId, orderStrategy, params[i].order);
        }
    }

    // cancel order and refund the committed funds to the user.
    // in order to reduce interactions between the user and this contract, we delegate the cancellation to the strategy.
    // this allows for a single interaction to cancel multiple orders.
    function cancelOrder(IOrderMixin.Order memory order) external {
        bytes32 orderId = LIMIT_ORDER_PROTOCOL.hashOrder(order);

        OrderData memory _orderData = orderData[orderId];
        if (!_orderData.isSignedOrder) revert InvalidOrder();

        if (address(_orderData.strategy) != msg.sender) {
            revert CallerNotOrderCreator();
        }
        if (_orderData.status != 0) {
            revert OrderAlreadyExecutedOrCancelled(); // order is not pending
        }

        _updateOrderStatus(orderId, 2); // mark as cancelled
        orderData[orderId].amountCommitted = 0; // reset committed amount

        LIMIT_ORDER_PROTOCOL.cancelOrder(order.makerTraits, orderId);
        // refund the committed funds to the user
        _pushFunds(IERC20(order.makerAsset.get()), _orderData.receiver, _orderData.amountCommitted);

        emit OrderCancelled(orderId, _orderData.strategy);
    }

    function isActiveOrder(IOrderMixin.Order memory order) external view returns (bool) {
        bytes32 orderId = LIMIT_ORDER_PROTOCOL.hashOrder(order);
        return orderData[orderId].isSignedOrder && orderData[orderId].status == 0;
    }

    // note: need to ensure that this contract is not bypassed during the post-interaction call.
    function _validateOrderAndExtension(IOrderMixin.Order memory order, bytes memory extension) internal {
        // validate the order and extension data
        order.receiver = Address.wrap(uint256(uint160(address(this)))); // Ensure the receiver is this contract
        if (order.maker.get() != address(this)) {
            revert InvalidMakerAddress();
        }
        // bool validExtension = uint256(keccak256(extension)) & type(uint160).max == order.salt & type(uint160).max;
        // if (!order.makerTraits.hasExtension() || !validExtension) {
        //     revert InvalidMakerTraits();
        // }

        // ensure that this contract is called for post-interaction.
        if (!order.makerTraits.needPostInteractionCall()) {
            revert InvalidMakerTraits();
        }
        IERC20 makerAsset = IERC20(order.makerAsset.get());
        // if this contract has not interacted with the maker asset before, approve it to spend the maximum amount.
        if (makerAsset.allowance(address(this), address(LIMIT_ORDER_PROTOCOL)) == 0) {
            _maxApproveToken(makerAsset);
        }
    }

    function _updateOrderStatus(bytes32 orderId, uint8 newStatus) internal {
        orderData[orderId].status = newStatus;
    }

    // MAKER INTERACTIONS
    function postInteraction(
        IOrderMixin.Order calldata order,
        bytes calldata,
        bytes32 orderHash,
        address,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 remainingMakingAmount,
        bytes calldata
    ) external override onlyLimitOrderProtocol {
        uint256 amountLeftToFill = orderData[orderHash].amountCommitted - makingAmount;
        if (amountLeftToFill == 0) {
            _updateOrderStatus(orderHash, 1); // mark as executed
        }

        IStrategy strategy = orderData[orderHash].strategy;
        // take fee
        uint256 fee = strategy.calculateFee(takingAmount);
        uint256 amountToTransfer = takingAmount - fee;
        IERC20 takerToken = IERC20(order.takerAsset.get());
        // transfer funds to order receiver
        _pushFunds(takerToken, orderData[orderHash].receiver, amountToTransfer);
        _pushFunds(takerToken, strategy.treasury(), fee); // transfer fee to the strategy
    }

    // transfer funds from `receiver` to this contract.
    function _pullFunds(IERC20 token, address receiver, uint256 amount) internal {
        // ensure the user has approved this contract to spend their tokens
        SafeERC20.safeTransferFrom(token, receiver, address(this), amount);
    }

    // transfer funds to `receiver`.
    function _pushFunds(IERC20 token, address receiver, uint256 amount) internal {
        // ensure the contract has enough balance to transfer
        SafeERC20.safeTransfer(token, receiver, amount);
    }

    // EIP-1271 IMPLEMENTATION
    function isValidSignature(bytes32 hash, bytes memory) external view override returns (bytes4 magicValue) {
        if (orderData[hash].status == 0 && orderData[hash].isSignedOrder) {
            return 0x1626ba7e; // eip-1271 magic value for "isValidSignature"
        }
        return 0xffffffff;
    }

    // APPROVALS & REVOKATIONS
    function maxApproveToken(IERC20 token) internal onlyOwner {
        _maxApproveToken(token);
    }

    function _maxApproveToken(IERC20 token) internal {
        token.approve(address(LIMIT_ORDER_PROTOCOL), type(uint256).max);
    }

    function approveKeeper(address keeper) external onlyOwner {
        if (approvedKeeper[keeper]) {
            revert KeeperAlreadyApproved(keeper);
        }
        approvedKeeper[keeper] = true;
        emit KeeperApproved(keeper);
    }

    function revokeKeeper(address keeper) external onlyOwner {
        if (!approvedKeeper[keeper]) {
            revert KeeperNotApproved(keeper);
        }
        approvedKeeper[keeper] = false;
        emit KeeperRevoked(keeper);
    }
}
