// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./deps/interfaces/IOrderMixin.sol";
import "./deps/interfaces/IPostInteraction.sol";
import "./deps/libraries/AddressLib.sol";

/// @title DelegateSafe
/// @dev A minimal escrow contract that holds user funds and facilitates the creation of 1inch limit orders 
///      through approved keepers.
contract DelegateSafe is IERC1271, Ownable, IPostInteraction {
    using AddressLib for Address;
    using MakerTraitsLib for MakerTraits;

    mapping(address keepers => bool) public approvedKeeper;
    mapping(bytes32 orderId => uint256 amountCommitted) public amountCommitted;
    mapping(bytes32 orderId => address) public orderCreator;
    mapping(bytes32 orderId => bool) isSignedOrder;

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
    ///      to track the amount committed by the `orderCreator`, ensure `Order.makerTraits`
    ///      has post-interactions enabled. this allows the contract to determine how much to refund
    ///      in the event of order cancellation before order execution or during partial fills.
    ///      additionally, for this contract to execute the order, it must be set as the `Order.Maker`.
    function createUserOrder(CreateOrderParams[] calldata params) external onlyApprovedKeeper {
        for (uint256 i = 0; i < params.length; i++) {
            address makerAsset = params[i].order.makerAsset.get();
            // pull the funds from the user to this contract.
            _pullFunds(IERC20(makerAsset), params[i].orderCreator, params[i].order.makingAmount);
            // compute order hash
            bytes32 orderId = LIMIT_ORDER_PROTOCOL.hashOrder(params[i].order);

            amountCommitted[orderId] = params[i].order.makingAmount;
            orderCreator[orderId] = params[i].orderCreator;
            isSignedOrder[orderId] = true;

            // if this contract has not interacted with the maker asset before, approve it to spend the maximum amount.
            if (IERC20(makerAsset).allowance(address(this), address(LIMIT_ORDER_PROTOCOL)) == 0) {
                _maxApproveToken(makerAsset);
            }

            emit OrderCreated(orderId, params[i].order, params[i].orderCreator);
        }
    }

    // cancels order and refunds the remaining committed funds to the `orderCreator`.
    function cancelOrder(IOrderMixin.Order calldata order) external onlyApprovedKeeper {
        bytes32 orderId = LIMIT_ORDER_PROTOCOL.hashOrder(order);
        uint256 amtCommitted = amountCommitted[orderId]; // reset committed amount

        amountCommitted[orderId] = 0;
        LIMIT_ORDER_PROTOCOL.cancelOrder(order.makerTraits, orderId);

        if (amtCommitted > 0) {
            // refund the committed funds to the user, if any.
            _pushFunds(IERC20(order.makerAsset.get()), orderCreator[orderId], amtCommitted);
        }

        emit OrderCancelled(orderId, order);
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

    /// MAKER INTERACTIONS
    function postInteraction(
        IOrderMixin.Order calldata,
        bytes calldata,
        bytes32 orderHash,
        address,
        uint256 makingAmount,
        uint256,
        uint256,
        bytes calldata
    ) external override onlyLimitOrderProtocol {
        amountCommitted[orderHash] -= makingAmount;
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
