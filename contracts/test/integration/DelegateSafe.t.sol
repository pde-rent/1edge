// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {DelegateSafe} from "../../DelegateSafe.sol";
import {MockStrategy} from "../../mocks/MockStrategy.sol";
import {ERC20Mock} from "../../mocks/ERC20Mock.sol";
import {IStrategy} from "../../interfaces/IStrategy.sol";
import "../../vendored/1inch/interfaces/IOrderMixin.sol";
import "../../vendored/1inch/interfaces/IOrderRegistrator.sol";
import "../../vendored/1inch/libraries/TakerTraitsLib.sol";

contract DelegateSafeTest is Test {
    IOrderMixin limitOrderProtocol = IOrderMixin(0x111111125421cA6dc452d289314280a0f8842A65);
    // address orderRegistrator = makeAddr("1inch:OrderRegistrator");

    DelegateSafe public delegateSafe;

    address public alice = makeAddr("Alice");
    address public bobTheCreator = makeAddr("BobTheCreator");
    address public charlie = makeAddr("Charlie");
    address public approvedKeeper = makeAddr("ApprovedKeeper");

    ERC20Mock public makerToken;
    ERC20Mock public takerToken;

    uint256 mainnetFork;
    string MAINNET_RPC_URL = vm.envString("ETH_RPC_URL");

    function setUp() public {
        mainnetFork = vm.createFork(MAINNET_RPC_URL);
        vm.selectFork(mainnetFork);

        makerToken = new ERC20Mock("Token A", "TKA");
        takerToken = new ERC20Mock("Token B", "TKB");
        delegateSafe = new DelegateSafe(limitOrderProtocol);
        deal(address(makerToken), bobTheCreator, 1000e18);
        deal(address(takerToken), address(this), 1000e18);
    }

    function testCreateOrder_Fill() public {
        vm.selectFork(mainnetFork);

        delegateSafe.approveKeeper(approvedKeeper);
        grantApproval(makerToken, bobTheCreator, address(delegateSafe), 1000e18);
        IStrategy strategy = deployMockStrategy();
        bytes memory data = abi.encode(strategy, "");

        assertEq(takerToken.balanceOf(bobTheCreator), 0);
        assertEq(makerToken.balanceOf(bobTheCreator), 1000e18);

        assertEq(makerToken.balanceOf(address(this)), 0);
        assertEq(takerToken.balanceOf(address(this)), 1000e18);

        vm.startPrank(approvedKeeper);
        delegateSafe.createUserOrder(data);
        vm.stopPrank();

        assertEq(makerToken.balanceOf(bobTheCreator), 0);

        grantApproval(takerToken, address(this), address(limitOrderProtocol), 1000e18);
        IOrderMixin.Order memory mockOrder = MockStrategy(address(strategy)).getMockOrder();
        limitOrderProtocol.fillContractOrder(mockOrder, "", 1000e18, TakerTraits.wrap(0));

        assertEq(makerToken.balanceOf(bobTheCreator), 0);
        assertEq(takerToken.balanceOf(bobTheCreator), 1000e18);

        assertEq(takerToken.balanceOf(address(this)), 0);
        assertEq(makerToken.balanceOf(address(this)), 1000e18);
    }

    function testCreateOrder_UnapprovedKeeper() public {
        vm.selectFork(mainnetFork);

        IStrategy strategy = deployMockStrategy();
        bytes memory data = abi.encode(strategy, "");

        vm.expectRevert(DelegateSafe.CallerNotApprovedKeeper.selector);
        delegateSafe.createUserOrder(data);
    }

    function testCancelOrder_CancelThenFill() public {
        vm.selectFork(mainnetFork);

        delegateSafe.approveKeeper(approvedKeeper);
        grantApproval(makerToken, bobTheCreator, address(delegateSafe), 1000e18);
        IStrategy strategy = deployMockStrategy();
        bytes memory data = abi.encode(strategy, "");

        vm.startPrank(approvedKeeper);
        delegateSafe.createUserOrder(data);
        vm.stopPrank();

        IOrderMixin.Order memory mockOrder = MockStrategy(address(strategy)).getMockOrder();

        vm.startPrank(address(strategy));
        delegateSafe.cancelOrder(mockOrder);
        vm.stopPrank();

        grantApproval(takerToken, address(this), address(limitOrderProtocol), 1000e18);
        vm.expectRevert(); // Bad signature
        limitOrderProtocol.fillContractOrder(mockOrder, "", 1000e18, TakerTraits.wrap(0));
    }

    function testCancelOrder_FillThenCancel() public {
        vm.selectFork(mainnetFork);

        delegateSafe.approveKeeper(approvedKeeper);
        grantApproval(makerToken, bobTheCreator, address(delegateSafe), 1000e18);
        IStrategy strategy = deployMockStrategy();
        bytes memory data = abi.encode(strategy, "");

        vm.startPrank(approvedKeeper);
        delegateSafe.createUserOrder(data);
        vm.stopPrank();

        IOrderMixin.Order memory mockOrder = MockStrategy(address(strategy)).getMockOrder();

        grantApproval(takerToken, address(this), address(limitOrderProtocol), 1000e18);
        limitOrderProtocol.fillContractOrder(mockOrder, "", 1000e18, TakerTraits.wrap(0));

        vm.startPrank(address(strategy));
        vm.expectRevert(DelegateSafe.OrderAlreadyExecutedOrCancelled.selector);
        delegateSafe.cancelOrder(mockOrder);
        vm.stopPrank();
    }

    function deployMockStrategy() public returns (IStrategy) {
        address mockStrategy = address(
            new MockStrategy(
                address(delegateSafe),
                alice,
                address(makerToken),
                address(takerToken),
                1000e18,
                1000e18,
                bobTheCreator,
                bobTheCreator
            )
        );
        return IStrategy(mockStrategy);
    }

    function grantApproval(ERC20Mock token, address user, address to, uint256 amount) public {
        vm.startPrank(user);
        token.approve(to, amount);
        vm.stopPrank();
    }
}
