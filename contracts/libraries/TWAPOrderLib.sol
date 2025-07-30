// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/IStrategy.sol";
import "../interfaces/IDelegateSafe.sol";
import "../vendored/1inch/interfaces/IOrderMixin.sol";
import "../vendored/1inch/libraries/MakerTraitsLib.sol";

struct TWAPOrder {
    bytes32 nonce;
    address receiver;
    uint256 startTime;
    uint256 intervals;
    uint256 numIntervals;
    uint256 makingAmount;
    address makerAsset;
    address takerAsset;
}

using TWAPOrderLib for TWAPOrder global;

library TWAPOrderLib {
    /// forgefmt: disable-next-item
    bytes32 internal constant TWAP_ORDER_TYPEHASH = keccak256(
        "TWAPOrder("
            "bytes32 nonce,"
            "address receiver,"
            "uint256 startTime,"
            "uint256 intervals,"
            "uint256 numIntervals,"
            "uint256 makingAmount,"
            "uint256 makerAsset,"
            "uint256 takerAsset"
        ")"
    );

    function toStructHash(TWAPOrder memory twapOrder) internal pure returns (bytes32) {
        return keccak256(abi.encode(TWAP_ORDER_TYPEHASH, twapOrder));
    }

    function encodeMakerTraits(TWAPOrder memory twapOrder, address maker)
        internal
        view
        returns (MakerTraits makerTraits, bytes memory extension)
    {
        makerTraits = MakerTraits.wrap(1 << 251);
    }

    function to1InchOrder(TWAPOrder memory twapOrder, address maker, uint256 takingAmount)
        internal
        view
        returns (IOrderMixin.Order memory order, bytes memory extension)
    {
        MakerTraits makerTraits;
        // convert TWAPOrder to IOrderMixin.Order
        (makerTraits, extension) = twapOrder.encodeMakerTraits(maker);
        order = IOrderMixin.Order({
            salt: 0,
            // addresses set with no flag.
            maker: Address.wrap(uint256(uint160(maker))),
            receiver: Address.wrap(uint256(uint160(twapOrder.receiver))),
            makerAsset: Address.wrap(uint256(uint160(twapOrder.makerAsset))),
            takerAsset: Address.wrap(uint256(uint160(twapOrder.takerAsset))),
            makingAmount: twapOrder.makingAmount,
            takingAmount: takingAmount, // Placeholder, should be calculated based on the strategy logic
            makerTraits: makerTraits
        });
    }
}
