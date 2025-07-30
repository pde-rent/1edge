// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {DelegateSafe} from "../../DelegateSafe.sol";
import {TWAPStrategy} from "../../strategy/TWAPStrategy.sol";
import "../../vendored/1inch/interfaces/IOrderMixin.sol";
import "../../vendored/1inch/interfaces/IOrderRegistrator.sol";

contract TWAPStrategyTest is Test {
    IOrderMixin limitOrderProtocol = IOrderMixin(0x111111125421cA6dc452d289314280a0f8842A65);
    // address orderRegistrator = makeAddr("1inch:OrderRegistrator");

    TWAPStrategy public twapStrategy;
    DelegateSafe public delegateSafe;

    function setUp() public {
        delegateSafe = new DelegateSafe(limitOrderProtocol);
        twapStrategy = new TWAPStrategy(limitOrderProtocol, delegateSafe);
    }

    function testComputeTWAPOrder() public {}
}
