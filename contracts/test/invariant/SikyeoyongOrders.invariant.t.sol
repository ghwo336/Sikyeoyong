// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SikyeoyongOrders} from "../../src/SikyeoyongOrders.sol";
import {OrdersFixture} from "../helpers/OrdersFixture.sol";
import {OrdersHandler} from "./OrdersHandler.sol";

/// 불변식 1, 3, 4, 6, 7 (docs/wiki/components/contracts.md "불변식").
abstract contract OrdersInvariantBase is OrdersFixture {
    OrdersHandler internal handler;
    address[] internal actors;
    uint256 internal initialTotal;
    uint256 internal constant START = 500_000 ether;
    address internal agent3 = makeAddr("agent3");

    function _setUpHandler(bool vaultMode_) internal {
        orders = _deploy(operator, upgrader, vaultMode_);
        address payout3 = makeAddr("payout3");

        vm.startPrank(operator);
        orders.bindAgent(agent);
        orders.bindAgent(agent2);
        vm.stopPrank();
        _registerActive(payout);
        _registerActive(payout2);
        vm.prank(payout3);
        orders.registerMerchant(KYB_UID, ""); // Pending으로 시작

        address[] memory agents_ = new address[](3);
        agents_[0] = agent;
        agents_[1] = agent2;
        agents_[2] = agent3; // 묶이지 않음
        address[] memory payouts_ = new address[](3);
        payouts_[0] = payout;
        payouts_[1] = payout2;
        payouts_[2] = payout3;
        handler = new OrdersHandler(orders, operator, agents_, payouts_, stranger);

        actors = [operator, agent, agent2, agent3, payout, payout2, payout3, stranger];
        for (uint256 i; i < actors.length; i++) {
            vm.deal(actors[i], START);
        }
        initialTotal = START * actors.length;
        targetContract(address(handler));
    }

    /// 불변식 1: 돈은 정해진 배우와 컨트랙트 사이에서만 움직인다. 밖으로 새는 돈이 없다.
    function invariant_NoMoneyLeavesKnownActors() public view {
        uint256 sum = address(orders).balance;
        for (uint256 i; i < actors.length; i++) {
            sum += actors[i].balance;
        }
        assertEq(sum, initialTotal);
    }

    /// 불변식 7: 환불은 에이전트 지갑을 다시 채우지 않는다. 낯선 사람은 아무것도 받지 않는다.
    function invariant_AgentsAndStrangerNeverReceive() public view {
        assertLe(agent.balance, START);
        assertLe(agent2.balance, START);
        assertEq(stranger.balance, START);
    }

    /// 불변식 3: 같은 orderRef는 한 번만 결제된다.
    function invariant_EachRefPaidAtMostOnce() public view {
        for (uint256 i; i < handler.refCount(); i++) {
            assertLe(handler.placedCount(handler.refs(i)), 1);
        }
    }
}

contract OrdersInvariantModeP is OrdersInvariantBase {
    function setUp() public {
        _setUpHandler(false);
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = OrdersHandler.placeOrder.selector;
        selectors[1] = OrdersHandler.refund.selector;
        selectors[2] = OrdersHandler.setPaused.selector;
        selectors[3] = OrdersHandler.setMerchantStatus.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// 불변식 4 (모드 P): 컨트랙트는 돈을 보관하지 않는다.
    function invariant_ModePHoldsNothing() public view {
        assertEq(address(orders).balance, 0);
    }
}

contract OrdersInvariantModeV is OrdersInvariantBase {
    function setUp() public {
        _setUpHandler(true);
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = OrdersHandler.placeOrderFromVault.selector;
        selectors[1] = OrdersHandler.deposit.selector;
        selectors[2] = OrdersHandler.withdraw.selector;
        selectors[3] = OrdersHandler.refund.selector;
        selectors[4] = OrdersHandler.setPaused.selector;
        selectors[5] = OrdersHandler.setMerchantStatus.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// 불변식 4 (모드 V): 선불 합계 = 컨트랙트 잔액. 불변식 6: 회수는 소유자에게만 (위 낯선 사람 검사와 보존).
    function invariant_VaultSumEqualsBalance() public view {
        uint256 sum = orders.vaultBalance(agent) + orders.vaultBalance(agent2) + orders.vaultBalance(agent3);
        assertEq(sum, address(orders).balance);
    }
}
