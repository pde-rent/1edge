// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../deps/interfaces/IOrderMixin.sol";
import "../deps/libraries/MakerTraitsLib.sol";

contract MockLimitOrderProtocol is IOrderMixin {
    using MakerTraitsLib for MakerTraits;

    uint256 private constant _ORDER_DOES_NOT_EXIST = 0;
    uint256 private constant _ORDER_FILLED = 1;

    mapping(bytes32 => uint256) private _remaining;
    mapping(address => mapping(uint256 => uint256)) private _bitInvalidator;

    function hashOrder(Order calldata order) external pure returns (bytes32) {
        return keccak256(abi.encode(order));
    }

    function cancelOrder(MakerTraits /* makerTraits */, bytes32 orderHash) external {
        _remaining[orderHash] = _ORDER_FILLED;
    }

    function cancelOrders(MakerTraits[] calldata /* makerTraits */, bytes32[] calldata orderHashes) external {
        for (uint256 i = 0; i < orderHashes.length; i++) {
            _remaining[orderHashes[i]] = _ORDER_FILLED;
        }
    }

    function bitsInvalidateForOrder(MakerTraits makerTraits, uint256 additionalMask) external {
        // Mock implementation
    }

    function bitInvalidatorForOrder(address maker, uint256 slot) external view returns (uint256 result) {
        return _bitInvalidator[maker][slot];
    }

    function remainingInvalidatorForOrder(address /* maker */, bytes32 orderHash) external view returns (uint256 remaining) {
        return _remaining[orderHash] == _ORDER_FILLED ? 1 : type(uint256).max;
    }

    function rawRemainingInvalidatorForOrder(address /* maker */, bytes32 orderHash) external view returns (uint256 remaining) {
        return _remaining[orderHash];
    }

    function simulate(address target, bytes calldata data) external {
        // Mock implementation
    }

    function fillOrder(Order calldata /* order */, bytes32 /* r */, bytes32 /* vs */, uint256 /* amount */, TakerTraits /* takerTraits */) external payable returns (uint256, uint256, bytes32) {
        revert("Not implemented");
    }

    function fillOrderArgs(Order calldata /* order */, bytes32 /* r */, bytes32 /* vs */, uint256 /* amount */, TakerTraits /* takerTraits */, bytes calldata /* args */) external payable returns (uint256, uint256, bytes32) {
        revert("Not implemented");
    }

    function fillContractOrder(Order calldata /* order */, bytes calldata /* signature */, uint256 /* amount */, TakerTraits /* takerTraits */) external pure returns (uint256, uint256, bytes32) {
        revert("Not implemented");
    }

    function fillContractOrderArgs(Order calldata /* order */, bytes calldata /* signature */, uint256 /* amount */, TakerTraits /* takerTraits */, bytes calldata /* args */) external pure returns (uint256, uint256, bytes32) {
        revert("Not implemented");
    }
}
