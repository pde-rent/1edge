// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./deps/interfaces/IOrderMixin.sol";
import "./deps/interfaces/IPreInteraction.sol";
import "./deps/libraries/AddressLib.sol";
import "hardhat/console.sol";

/// @title DelegateProxy
/// @dev A minimal contract that facilitates creation of 1inch limit orders through
///      approved keepers.
contract DelegateProxy is IERC1271, Ownable, IPreInteraction {
    using AddressLib for Address;
    // using MakerTraitsLib for MakerTraits;

    mapping(address keepers => bool) internal approvedKeeper;
    mapping(bytes32 orderId => bool) internal isSignedOrder;
    mapping(bytes32 orderId => address) internal orderCreator;
    mapping(bytes32 orderId => uint256) internal remainingMakerAmount;

    IOrderMixin private immutable LIMIT_ORDER_PROTOCOL;

    struct CreateOrderParams {
        IOrderMixin.Order order;
        address orderCreator;
    }

    // Errors
    error CallerNotApprovedKeeper();
    error CallerNotLimitOrderProtocol();
    error KeeperNotApproved(address);
    error KeeperAlreadyApproved(address);

    // Events
    event KeeperApproved(address keeper);
    event KeeperRevoked(address keeper);
    event OrderCreated(bytes32 indexed orderId, IOrderMixin.Order order, address orderCreator);
    event OrderCancelled(bytes32 indexed orderId, IOrderMixin.Order order);

    modifier onlyApprovedKeeper() {
        // check if the caller is an approved keeper
        if (!approvedKeeper[msg.sender]) {
            revert CallerNotApprovedKeeper();
        }
        _;
    }

    modifier onlyLimitOrderProtocol() {
        if (msg.sender != address(LIMIT_ORDER_PROTOCOL)) {
            revert CallerNotLimitOrderProtocol();
        }
        _;
    }

    constructor(IOrderMixin _limitOrderProtocol) Ownable(msg.sender) {
        LIMIT_ORDER_PROTOCOL = _limitOrderProtocol;
    }

    /// @notice create/sign user order.
    /// @dev signs the 1inch order and pulls funds from the `orderCreator` to facilitate order execution.
    ///      to pull the maker amount from the `orderCreator` JIT, ensure `Order.MakerTraits` has
    ///      pre-interactions enabled.
    ///      additionally, for this contract to execute the order, it must be set as the `Order.Maker`.
    function createUserOrder(CreateOrderParams[] calldata params) external onlyApprovedKeeper {
        for (uint256 i = 0; i < params.length; i++) {
            address makerAsset = params[i].order.makerAsset.get();

            // compute order hash
            bytes32 orderId = LIMIT_ORDER_PROTOCOL.hashOrder(params[i].order);
            address creator = params[i].orderCreator;
            orderCreator[orderId] = creator;
            isSignedOrder[orderId] = true;
            remainingMakerAmount[orderId] = params[i].order.makingAmount;

            // if this contract has not interacted with the maker asset before, approve it to spend the maximum amount.
            // order can bypass pre-interaction hook and withdraw funds from this contract since it has max approval
            // for tokens. but this contract is not expected to hold any funds.
            if (IERC20(makerAsset).allowance(address(this), address(LIMIT_ORDER_PROTOCOL)) == 0) {
                _maxApproveToken(makerAsset);
            }

            emit OrderCreated(orderId, params[i].order, params[i].orderCreator);
        }
    }

    // cancels order.
    function cancelOrder(IOrderMixin.Order calldata order) external onlyApprovedKeeper {
        bytes32 orderId = LIMIT_ORDER_PROTOCOL.hashOrder(order);

        LIMIT_ORDER_PROTOCOL.cancelOrder(order.makerTraits, orderId);

        emit OrderCancelled(orderId, order);
    }

    // transfer funds from `sender` to this contract.
    function _pullFunds(IERC20 token, address sender, uint256 amount) internal {
        // ensure the user has approved this contract to spend their tokens
        SafeERC20.safeTransferFrom(token, sender, address(this), amount);
    }

    // transfer funds to `receiver`.
    function _pushFunds(IERC20 token, address receiver, uint256 amount) internal {
        // ensure the contract has enough balance to transfer
        SafeERC20.safeTransfer(token, receiver, amount);
    }

    struct OrderData {
        address _orderCreator;
        uint256 _remainingMakerAmount;
    }

    function getOrderData(bytes32[] calldata orderIds) public view returns (OrderData[] memory orderData) {
        for (uint256 i = 0; i < 0; i++) {
            orderData[i] = OrderData({
                _orderCreator: orderCreator[orderIds[i]],
                _remainingMakerAmount: remainingMakerAmount[orderIds[i]]
            });
        }
    }

    /// MAKER INTERACTIONS
    function preInteraction(
        IOrderMixin.Order calldata,
        bytes calldata,
        bytes32 orderHash,
        address,
        uint256 makingAmount,
        uint256,
        uint256 remainingMakingAmount,
        bytes calldata
    ) external override onlyLimitOrderProtocol {
        remainingMakerAmount[orderHash] -= makingAmount;
        // pull funds from user.
        _pullFunds(IERC20(order.makerAsset.get()), orderCreator[orderHash], makingAmount);
    }

    /// EIP-1271 IMPLEMENTATION
    function isValidSignature(bytes32 hash, bytes memory) external view override returns (bytes4 magicValue) {
        if (isSignedOrder[hash]) {
            return 0x1626ba7e; // eip-1271 magic value for "isValidSignature"
        }
        return 0xffffffff;
    }

    /// APPROVALS & REVOKATIONS
    function maxApproveToken(address token) internal onlyOwner {
        _maxApproveToken(token);
    }

    function _maxApproveToken(address token) internal {
        IERC20(token).approve(address(LIMIT_ORDER_PROTOCOL), type(uint256).max);
    }

    /// PERMISSIONS
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
