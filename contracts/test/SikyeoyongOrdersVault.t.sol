// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SikyeoyongOrders} from "../src/SikyeoyongOrders.sol";
import {OrdersFixture} from "./helpers/OrdersFixture.sol";
import {Reentrant} from "./helpers/Actors.sol";

/// 모드 V(선불) 단위 테스트. 모드 V는 스파이크 S10 확인 뒤에만 배포한다 (D-06).
contract SikyeoyongOrdersVaultTest is OrdersFixture {
    function setUp() public {
        _standardSetup(true);
    }

    function _deposit(uint256 amount) internal {
        vm.prank(operator);
        orders.deposit{value: amount}(agent);
    }

    function test_Vault_ModeFlag() public view {
        assertTrue(orders.vaultMode());
    }

    function test_Vault_PlaceOrderRevertsInModeV() public {
        vm.prank(agent);
        vm.expectRevert(SikyeoyongOrders.WrongMode.selector);
        orders.placeOrder{value: PRICE}(merchantId, REF);
    }

    function test_Vault_DepositEmitsAndCredits() public {
        vm.expectEmit(true, true, false, true, address(orders));
        emit SikyeoyongOrders.Deposited(agent, operator, 100_000 ether);
        _deposit(100_000 ether);
        assertEq(orders.vaultBalance(agent), 100_000 ether);
        assertEq(address(orders).balance, 100_000 ether);

        // 누구나 넣을 수 있다 (보통 소유자)
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        orders.deposit{value: 1 ether}(agent);
        assertEq(orders.vaultBalance(agent), 100_001 ether);
    }

    function test_Vault_DepositUnboundOrZeroReverts() public {
        vm.startPrank(operator);
        vm.expectRevert(SikyeoyongOrders.AgentNotBound.selector);
        orders.deposit{value: 1 ether}(agent2);
        vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.deposit{value: 0}(agent);
        vm.stopPrank();
    }

    function test_Vault_PlaceOrderFromVaultPaysMerchant() public {
        _deposit(100_000 ether);
        uint256 payoutBefore = payout.balance;
        uint256 agentBefore = agent.balance;

        vm.expectEmit(true, true, true, true, address(orders));
        emit SikyeoyongOrders.OrderPlaced(REF, agent, 1, 45_000 ether);
        vm.prank(agent);
        orders.placeOrderFromVault(merchantId, 45_000 ether, REF);

        assertEq(payout.balance - payoutBefore, 45_000 ether);
        assertEq(agent.balance, agentBefore); // 에이전트 지갑은 쓰지 않는다
        assertEq(orders.vaultBalance(agent), 55_000 ether);
        assertEq(address(orders).balance, 55_000 ether);
        (address a,, uint128 amt,, SikyeoyongOrders.OrderStatus st) = _order(REF);
        assertEq(a, agent);
        assertEq(amt, 45_000 ether);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.Paid));
    }

    function test_Vault_SameOrderRefReverts() public {
        _deposit(100_000 ether);
        vm.startPrank(agent);
        orders.placeOrderFromVault(merchantId, 10_000 ether, REF);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.OrderExists.selector, REF));
        orders.placeOrderFromVault(merchantId, 10_000 ether, REF);
        vm.stopPrank();
        assertEq(orders.vaultBalance(agent), 90_000 ether);
    }

    function test_Vault_InsufficientOrZeroReverts() public {
        _deposit(10_000 ether);
        vm.startPrank(agent);
        vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.placeOrderFromVault(merchantId, 10_000 ether + 1, REF);
        vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.placeOrderFromVault(merchantId, 0, REF);
        vm.stopPrank();
    }

    function test_Vault_ChecksMatchModeP() public {
        _deposit(100_000 ether);
        vm.prank(agent2);
        vm.expectRevert(SikyeoyongOrders.AgentNotBound.selector);
        orders.placeOrderFromVault(merchantId, 1 ether, REF);

        vm.prank(operator);
        orders.setAgentPaused(agent, true);
        vm.prank(agent);
        vm.expectRevert(SikyeoyongOrders.AgentIsPaused.selector);
        orders.placeOrderFromVault(merchantId, 1 ether, REF);
        vm.prank(operator);
        orders.setAgentPaused(agent, false);

        vm.prank(operator);
        orders.setMerchantStatus(merchantId, SikyeoyongOrders.MerchantStatus.Suspended);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.MerchantNotActive.selector, merchantId));
        orders.placeOrderFromVault(merchantId, 1 ether, REF);
    }

    function test_Vault_WithdrawToOwnerOnly() public {
        _deposit(100_000 ether);
        uint256 ownerBefore = operator.balance;

        vm.expectEmit(true, true, false, true, address(orders));
        emit SikyeoyongOrders.Withdrawn(agent, operator, 30_000 ether);
        vm.prank(operator);
        orders.withdraw(agent, 30_000 ether);

        assertEq(operator.balance - ownerBefore, 30_000 ether);
        assertEq(orders.vaultBalance(agent), 70_000 ether);
        assertEq(address(orders).balance, 70_000 ether);
    }

    function test_Vault_WithdrawNotOwnerReverts() public {
        _deposit(100_000 ether);
        address[3] memory notOwner = [agent, payout, stranger];
        for (uint256 i; i < notOwner.length; i++) {
            vm.prank(notOwner[i]);
            vm.expectRevert(SikyeoyongOrders.NotAgentOwner.selector);
            orders.withdraw(agent, 1 ether);
        }
    }

    function test_Vault_WithdrawTooMuchOrZeroReverts() public {
        _deposit(10_000 ether);
        vm.startPrank(operator);
        vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.withdraw(agent, 10_000 ether + 1);
        vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.withdraw(agent, 0);
        vm.stopPrank();
    }

    function test_Vault_WithdrawWhilePaused() public {
        _deposit(10_000 ether);
        vm.startPrank(operator);
        orders.setAgentPaused(agent, true);
        orders.withdraw(agent, 10_000 ether);
        vm.stopPrank();
        assertEq(orders.vaultBalance(agent), 0);
        assertEq(address(orders).balance, 0);
    }

    function test_Vault_RefundGoesToOwnerNotVault() public {
        _deposit(100_000 ether);
        vm.prank(agent);
        orders.placeOrderFromVault(merchantId, 45_000 ether, REF);
        uint256 ownerBefore = operator.balance;

        vm.prank(payout);
        orders.refund{value: 45_000 ether}(REF);

        assertEq(operator.balance - ownerBefore, 45_000 ether);
        assertEq(orders.vaultBalance(agent), 55_000 ether);
        assertEq(address(orders).balance, 55_000 ether);
    }

    function test_Vault_ReentrantOwnerWithdraw() public {
        Reentrant r = new Reentrant();
        orders = _deploy(address(r), upgrader, true);
        r.configure(orders, 3, false, bytes32(0), 0, agent);
        r.bindAgent(agent);
        vm.deal(address(r), 0);
        vm.deal(stranger, 10_000 ether);
        vm.prank(stranger);
        orders.deposit{value: 10_000 ether}(agent);

        r.withdraw(agent, 4_000 ether);

        assertFalse(r.reentered());
        assertEq(r.lastError(), abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector));
        assertEq(address(r).balance, 4_000 ether);
        assertEq(orders.vaultBalance(agent), 6_000 ether);
        assertEq(address(orders).balance, 6_000 ether);
    }

    /// 악성 가게를 Active로 두고 선불 100,000 OKRW를 넣는다.
    function _reentrantVaultMerchant(uint8 mode, bool bubble) internal returns (Reentrant r, uint64 id) {
        r = new Reentrant();
        r.configure(orders, mode, bubble, REF, 0, agent);
        id = r.register();
        vm.prank(operator);
        orders.setMerchantStatus(id, SikyeoyongOrders.MerchantStatus.Active);
        _deposit(100_000 ether);
    }

    function test_Vault_Reentrancy_PayoutRefundDuringPayment() public {
        (Reentrant r, uint64 id) = _reentrantVaultMerchant(1, false);
        uint256 ownerBefore = operator.balance;

        vm.prank(agent);
        orders.placeOrderFromVault(id, 45_000 ether, REF);

        assertTrue(r.attempted());
        assertFalse(r.reentered());
        assertEq(r.lastError(), abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector));
        assertEq(operator.balance, ownerBefore); // 지급 중 환불이 소유자에게 가지 않았다
        assertEq(address(r).balance, 45_000 ether);
        assertEq(orders.vaultBalance(agent), 55_000 ether);
        assertEq(address(orders).balance, 55_000 ether);
        (,,,, SikyeoyongOrders.OrderStatus st) = _order(REF);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.Paid));
    }

    function test_Vault_Reentrancy_BubbledFailureRevertsEverything() public {
        (Reentrant r, uint64 id) = _reentrantVaultMerchant(1, true);

        vm.prank(agent);
        vm.expectRevert(SikyeoyongOrders.TransferFailed.selector);
        orders.placeOrderFromVault(id, 45_000 ether, REF);

        assertEq(address(r).balance, 0);
        assertEq(orders.vaultBalance(agent), 100_000 ether);
        assertEq(address(orders).balance, 100_000 ether);
        (address a,, uint128 amt,, SikyeoyongOrders.OrderStatus st) = _order(REF);
        assertEq(a, address(0));
        assertEq(amt, 0);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.None));
    }

    function test_Vault_Reentrancy_PayoutDepositDuringPayment() public {
        (Reentrant r, uint64 id) = _reentrantVaultMerchant(4, false);

        vm.prank(agent);
        orders.placeOrderFromVault(id, 45_000 ether, REF);

        assertFalse(r.reentered());
        assertEq(r.lastError(), abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector));
        assertEq(address(r).balance, 45_000 ether);
        assertEq(orders.vaultBalance(agent), 55_000 ether); // 지급 중에 다시 채워지지 않았다
        assertEq(address(orders).balance, 55_000 ether);
    }

    function testFuzz_Vault_BalanceMatches(uint256 dep, uint256 spend, uint256 out) public {
        dep = bound(dep, 1, 1_000_000 ether);
        spend = bound(spend, 1, dep);
        out = bound(out, 0, dep - spend);
        _deposit(dep);
        vm.prank(agent);
        orders.placeOrderFromVault(merchantId, spend, REF);
        if (out > 0) {
            vm.prank(operator);
            orders.withdraw(agent, out);
        }
        assertEq(orders.vaultBalance(agent), dep - spend - out);
        assertEq(address(orders).balance, dep - spend - out);
    }
}
