// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "solady/src/tokens/ERC20.sol";
import "solady/src/auth/Ownable.sol";
import "solady/src/utils/ReentrancyGuard.sol";
import "./deps/interfaces/IOrderMixin.sol";
import "./deps/interfaces/IPreInteraction.sol";
import "./deps/interfaces/IPostInteraction.sol";
import "./deps/libraries/AddressLib.sol";

/// @notice ERC1271 interface for signature validation
interface IERC1271 {
  function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4 magicValue);
}

/// @title DelegateProxy
/// @dev Minimal contract for 1inch limit order creation via approved keepers
contract DelegateProxy is IERC1271, Ownable, ReentrancyGuard, IPreInteraction, IPostInteraction {
  using AddressLib for Address;

  struct OrderInfo {
    address maker;
    uint256 remainingAmount;
    bool signed;
  }

  IOrderMixin private immutable _1INCH;
  mapping(address => bool) public keepers;
  mapping(bytes32 => OrderInfo) private orders;

  error InvalidOrder();
  error InsufficientBalance();

  event OrderCreated(bytes32 indexed orderId, address indexed maker);
  event OrderCancelled(bytes32 indexed orderId);

  modifier onlyKeeper() {
    if (!keepers[msg.sender]) revert Ownable.Unauthorized();
    _;
  }

  modifier only1inch() {
    if (msg.sender != address(_1INCH)) revert Ownable.Unauthorized();
    _;
  }

  constructor(IOrderMixin _1inch) {
    _1INCH = _1inch;
    _initializeOwner(msg.sender);
  }

  /// @notice Allow contract to receive ETH
  receive() external payable {}

  /// @notice Create and sign a single 1inch order
  function create1inchOrder(
    IOrderMixin.Order calldata order,
    address maker
  ) external onlyKeeper nonReentrant {
    _createOrder(order, maker);
  }

  /// @notice Create and sign multiple 1inch orders in batch
  function create1inchOrderBatch(
    IOrderMixin.Order[] calldata _orders,
    address[] calldata makers
  ) external onlyKeeper nonReentrant {
    uint256 len = _orders.length;
    if (len != makers.length) revert InvalidOrder();

    for (uint256 i; i < len;) {
      _createOrder(_orders[i], makers[i]);
      unchecked { ++i; }
    }
  }

  /// @notice Internal order creation logic
  function _createOrder(IOrderMixin.Order calldata _1inchOrder, address maker) internal {
    if (_1inchOrder.maker.get() != address(this)) revert InvalidOrder();

    bytes32 orderId = _1INCH.hashOrder(_1inchOrder);
    orders[orderId] = OrderInfo({
      maker: maker,
      remainingAmount: _1inchOrder.makingAmount,
      signed: true
    });

    // Approve token if needed
    address token = _1inchOrder.makerAsset.get();
    if (ERC20(token).allowance(address(this), address(_1INCH)) == 0) {
      ERC20(token).approve(address(_1INCH), type(uint256).max);
    }

    emit OrderCreated(orderId, maker);
  }

  /// @notice Cancel a single order
  function cancel1inchOrder(IOrderMixin.Order calldata order) external onlyKeeper {
    _cancelOrder(order);
  }

  /// @notice Cancel multiple orders in batch
  function cancel1inchOrderBatch(IOrderMixin.Order[] calldata _orders) external onlyKeeper {
    uint256 len = _orders.length;
    for (uint256 i; i < len;) {
      _cancelOrder(_orders[i]);
      unchecked { ++i; }
    }
  }

  /// @notice Internal order cancellation logic
  function _cancelOrder(IOrderMixin.Order calldata order) internal {
    bytes32 orderId = _1INCH.hashOrder(order);
    delete orders[orderId];
    _1INCH.cancelOrder(order.makerTraits, orderId);
    emit OrderCancelled(orderId);
  }

  /// @notice Batch query order data
  function getOrderData(bytes32[] calldata orderIds) external view returns (OrderInfo[] memory) {
    uint256 len = orderIds.length;
    OrderInfo[] memory result = new OrderInfo[](len);
    for (uint256 i; i < len;) {
      result[i] = orders[orderIds[i]];
      unchecked { ++i; }
    }
    return result;
  }

  /// @notice Pre-interaction: pull funds JIT
  function preInteraction(
    IOrderMixin.Order calldata order,
    bytes calldata,
    bytes32 orderHash,
    address,
    uint256 makingAmount,
    uint256,
    uint256,
    bytes calldata
  ) external override only1inch nonReentrant {
    OrderInfo storage info = orders[orderHash];
    info.remainingAmount -= makingAmount;
    ERC20(order.makerAsset.get()).transferFrom(info.maker, address(this), makingAmount);
  }

  /// @notice Post-interaction: update remaining amount
  function postInteraction(
    IOrderMixin.Order calldata,
    bytes calldata,
    bytes32 orderHash,
    address,
    uint256,
    uint256,
    uint256 remainingMakingAmount,
    bytes calldata
  ) external override only1inch {
    if (remainingMakingAmount == 0) {
      delete orders[orderHash];
    } else {
      orders[orderHash].remainingAmount = remainingMakingAmount;
    }
  }

  /// @notice ERC1271 signature validation
  function isValidSignature(bytes32 hash, bytes memory) external view override returns (bytes4) {
    return orders[hash].signed ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
  }

  /// @notice Manage keeper permissions
  function setKeeper(address keeper, bool approved) external onlyOwner {
    keepers[keeper] = approved;
  }

  /// @notice Rescue stuck tokens or native ETH
  /// @param token Address of token to rescue (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE for native ETH)
  function rescue(address token) external onlyOwner nonReentrant {
    address to = owner();

    if (token == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
      uint256 balance = address(this).balance;
      if (balance == 0) revert InsufficientBalance();
      payable(to).transfer(balance);
    } else {
      uint256 balance = ERC20(token).balanceOf(address(this));
      if (balance == 0) revert InsufficientBalance();
      ERC20(token).transfer(to, balance);
    }
  }
}
