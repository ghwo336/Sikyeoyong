// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SikyeoyongOrders} from "../src/SikyeoyongOrders.sol";
import {OrdersFixture} from "./helpers/OrdersFixture.sol";
import {RejectingReceiver, Reentrant} from "./helpers/Actors.sol";

/// 모드 P(기본) 단위 테스트. 기대값은 손으로 적는다.
contract SikyeoyongOrdersTest is OrdersFixture {
    function setUp() public {
        _standardSetup(false);
    }

    // ---------------------------------------------------------------- 초기화와 업그레이드

    function test_Initialize_SetsRolesAndModeP() public view {
        assertEq(orders.operator(), operator);
        assertEq(orders.owner(), upgrader);
        assertFalse(orders.vaultMode());
        // 가게 하나를 등록했으니 다음 번호는 2
        assertEq(orders.nextMerchantId(), 2);
        assertEq(merchantId, 1);
    }

    function test_Initialize_SecondCallReverts() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        orders.initialize(stranger, stranger, true);
    }

    function test_Initialize_ImplementationIsLocked() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        implementation.initialize(stranger, stranger, false);
    }

    function test_Initialize_ZeroOperatorReverts() public {
        vm.expectRevert(SikyeoyongOrders.ZeroAddress.selector);
        _deploy(address(0), upgrader, false);
    }

    function test_Initialize_ZeroOwnerReverts() public {
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableInvalidOwner.selector, address(0)));
        _deploy(operator, address(0), false);
    }

    function test_Upgrade_OnlyOwner() public {
        SikyeoyongOrders next = new SikyeoyongOrders();

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, operator));
        orders.upgradeToAndCall(address(next), "");

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, stranger));
        orders.upgradeToAndCall(address(next), "");
    }

    function test_Upgrade_ByOwnerKeepsState() public {
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);

        SikyeoyongOrders next = new SikyeoyongOrders();
        vm.prank(upgrader);
        orders.upgradeToAndCall(address(next), "");

        bytes32 implSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        assertEq(address(uint160(uint256(vm.load(address(orders), implSlot)))), address(next));
        assertEq(orders.operator(), operator);
        assertEq(orders.agentOwner(agent), operator);
        (address a, uint64 m, uint128 amt,, SikyeoyongOrders.OrderStatus st) = _order(REF);
        assertEq(a, agent);
        assertEq(m, 1);
        assertEq(amt, 45_000 ether);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.Paid));
        // 업그레이드 뒤에도 같은 orderRef는 막힌다
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.OrderExists.selector, REF));
        orders.placeOrder{value: PRICE}(merchantId, REF);
    }

    // ---------------------------------------------------------------- 가게

    function test_RegisterMerchant_PendingWithEvent() public {
        vm.expectEmit(true, true, false, true, address(orders));
        emit SikyeoyongOrders.MerchantRegistered(2, payout2, KYB_UID, "ipfs://two");
        vm.prank(payout2);
        uint64 id = orders.registerMerchant(KYB_UID, "ipfs://two");

        assertEq(id, 2);
        (address p, bytes32 uid, SikyeoyongOrders.MerchantStatus st, string memory uri) = orders.merchants(2);
        assertEq(p, payout2);
        assertEq(uid, KYB_UID);
        assertEq(uint8(st), uint8(SikyeoyongOrders.MerchantStatus.Pending));
        assertEq(uri, "ipfs://two");
        assertEq(orders.merchantIdByPayout(payout2), 2);
        assertEq(orders.nextMerchantId(), 3);
    }

    function test_RegisterMerchant_SamePayoutTwiceReverts() public {
        vm.prank(payout);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.PayoutAlreadyRegistered.selector, payout));
        orders.registerMerchant(KYB_UID, "again");
    }

    function test_SetMerchantStatus_OnlyOperator() public {
        address[3] memory notOperator = [upgrader, payout, stranger];
        for (uint256 i; i < notOperator.length; i++) {
            vm.prank(notOperator[i]);
            vm.expectRevert(SikyeoyongOrders.NotOperator.selector);
            orders.setMerchantStatus(merchantId, SikyeoyongOrders.MerchantStatus.Suspended);
        }
        assertEq(uint8(_merchantStatus(merchantId)), uint8(SikyeoyongOrders.MerchantStatus.Active));
    }

    function test_SetMerchantStatus_EmitsAndChanges() public {
        vm.expectEmit(true, false, false, true, address(orders));
        emit SikyeoyongOrders.MerchantStatusChanged(merchantId, SikyeoyongOrders.MerchantStatus.Suspended);
        vm.prank(operator);
        orders.setMerchantStatus(merchantId, SikyeoyongOrders.MerchantStatus.Suspended);
        assertEq(uint8(_merchantStatus(merchantId)), uint8(SikyeoyongOrders.MerchantStatus.Suspended));
    }

    function test_SetMerchantStatus_UnknownMerchantReverts() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.MerchantNotFound.selector, uint64(7)));
        orders.setMerchantStatus(7, SikyeoyongOrders.MerchantStatus.Active);

        // 0번은 어떤 가게도 받지 않는다. payout 0인 가게를 Active로 만들 수 없다.
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.MerchantNotFound.selector, uint64(0)));
        orders.setMerchantStatus(0, SikyeoyongOrders.MerchantStatus.Active);
    }

    function test_SetMerchantStatus_NoneReverts() public {
        vm.prank(operator);
        vm.expectRevert(SikyeoyongOrders.InvalidMerchantStatus.selector);
        orders.setMerchantStatus(merchantId, SikyeoyongOrders.MerchantStatus.None);
    }

    // ---------------------------------------------------------------- 에이전트

    function test_BindAgent_OnlyOperator() public {
        address[3] memory notOperator = [upgrader, agent2, stranger];
        for (uint256 i; i < notOperator.length; i++) {
            vm.prank(notOperator[i]);
            vm.expectRevert(SikyeoyongOrders.NotOperator.selector);
            orders.bindAgent(agent2);
        }
        assertEq(orders.agentOwner(agent2), address(0));
    }

    function test_BindAgent_EmitsAndRecordsOwner() public {
        vm.expectEmit(true, true, false, true, address(orders));
        emit SikyeoyongOrders.AgentBound(agent2, operator);
        vm.prank(operator);
        orders.bindAgent(agent2);
        assertEq(orders.agentOwner(agent2), operator);

        // 같은 주인이 다시 묶는 것은 그대로 (서버 재시도)
        vm.prank(operator);
        orders.bindAgent(agent2);
        assertEq(orders.agentOwner(agent2), operator);
    }

    function test_BindAgent_ZeroReverts() public {
        vm.prank(operator);
        vm.expectRevert(SikyeoyongOrders.ZeroAddress.selector);
        orders.bindAgent(address(0));
    }

    function test_BindAgent_BoundToOtherOwnerReverts() public {
        // 운영자가 바뀐 뒤(업그레이드로) 새 운영자가 남의 에이전트를 가져가지 못한다.
        // 운영자 교체 함수가 없어서 저장소를 직접 바꿔 흉내 낸다 (operator는 슬롯 0의 하위 20바이트).
        bytes32 slot0 = vm.load(address(orders), bytes32(uint256(0)));
        bytes32 cleared = slot0 & ~bytes32(uint256(type(uint160).max));
        vm.store(address(orders), bytes32(uint256(0)), cleared | bytes32(uint256(uint160(stranger))));
        assertEq(orders.operator(), stranger);

        vm.prank(stranger);
        vm.expectRevert(SikyeoyongOrders.NotAgentOwner.selector);
        orders.bindAgent(agent);
        assertEq(orders.agentOwner(agent), operator);
    }

    function test_SetAgentPaused_OnlyOwner() public {
        address[3] memory notOwner = [agent, upgrader, stranger];
        for (uint256 i; i < notOwner.length; i++) {
            vm.prank(notOwner[i]);
            vm.expectRevert(SikyeoyongOrders.NotAgentOwner.selector);
            orders.setAgentPaused(agent, true);
        }
        // 묶이지 않은 에이전트는 아무도 멈출 수 없다
        vm.prank(operator);
        vm.expectRevert(SikyeoyongOrders.NotAgentOwner.selector);
        orders.setAgentPaused(agent2, true);
    }

    function test_SetAgentPaused_EmitsAndToggles() public {
        vm.expectEmit(true, false, false, true, address(orders));
        emit SikyeoyongOrders.AgentPaused(agent, true);
        vm.prank(operator);
        orders.setAgentPaused(agent, true);
        assertTrue(orders.agentPaused(agent));

        vm.expectEmit(true, false, false, true, address(orders));
        emit SikyeoyongOrders.AgentPaused(agent, false);
        vm.prank(operator);
        orders.setAgentPaused(agent, false);
        assertFalse(orders.agentPaused(agent));
    }

    // ---------------------------------------------------------------- placeOrder

    function test_PlaceOrder_PaysMerchantAndRecords() public {
        vm.warp(1_800_000_000);
        uint256 agentBefore = agent.balance;
        uint256 payoutBefore = payout.balance;

        vm.expectEmit(true, true, true, true, address(orders));
        emit SikyeoyongOrders.OrderPlaced(REF, agent, 1, 45_000 ether);
        vm.prank(agent);
        orders.placeOrder{value: 45_000 ether}(merchantId, REF);

        assertEq(agentBefore - agent.balance, 45_000 ether);
        assertEq(payout.balance - payoutBefore, 45_000 ether);
        assertEq(address(orders).balance, 0); // 모드 P는 보관하지 않는다
        (address a, uint64 m, uint128 amt, uint64 at, SikyeoyongOrders.OrderStatus st) = _order(REF);
        assertEq(a, agent);
        assertEq(m, 1);
        assertEq(amt, 45_000 ether);
        assertEq(at, 1_800_000_000);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.Paid));
    }

    function test_PlaceOrder_SameOrderRefReverts() public {
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);
        uint256 payoutAfterFirst = payout.balance;

        // 같은 금액, 다른 금액, 다른 가게 모두 막힌다 (D-19: 재시도는 같은 orderRef로만, 두 번 결제 없음)
        uint64 other = _registerActive(payout2);
        vm.startPrank(agent);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.OrderExists.selector, REF));
        orders.placeOrder{value: PRICE}(merchantId, REF);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.OrderExists.selector, REF));
        orders.placeOrder{value: 1 ether}(merchantId, REF);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.OrderExists.selector, REF));
        orders.placeOrder{value: PRICE}(other, REF);
        vm.stopPrank();

        assertEq(payout.balance, payoutAfterFirst);
        assertEq(payout2.balance, 0);
    }

    function test_PlaceOrder_SameOrderRefFromOtherAgentReverts() public {
        vm.prank(operator);
        orders.bindAgent(agent2);
        vm.deal(agent2, PRICE);
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);

        vm.prank(agent2);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.OrderExists.selector, REF));
        orders.placeOrder{value: PRICE}(merchantId, REF);
    }

    function test_PlaceOrder_SameOrderRefAfterRefundReverts() public {
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);
        vm.prank(payout);
        orders.refund{value: PRICE}(REF);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.OrderExists.selector, REF));
        orders.placeOrder{value: PRICE}(merchantId, REF);
    }

    function test_PlaceOrder_PendingMerchantReverts() public {
        vm.prank(payout2);
        uint64 pending = orders.registerMerchant(KYB_UID, "");
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.MerchantNotActive.selector, pending));
        orders.placeOrder{value: PRICE}(pending, REF);
    }

    function test_PlaceOrder_SuspendedMerchantReverts() public {
        vm.prank(operator);
        orders.setMerchantStatus(merchantId, SikyeoyongOrders.MerchantStatus.Suspended);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.MerchantNotActive.selector, merchantId));
        orders.placeOrder{value: PRICE}(merchantId, REF);

        // 다시 활성화하면 같은 orderRef로 결제된다 (실패한 시도는 기록을 남기지 않는다)
        vm.prank(operator);
        orders.setMerchantStatus(merchantId, SikyeoyongOrders.MerchantStatus.Active);
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);
        (,,,, SikyeoyongOrders.OrderStatus st) = _order(REF);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.Paid));
    }

    function test_PlaceOrder_UnknownMerchantReverts() public {
        vm.startPrank(agent);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.MerchantNotActive.selector, uint64(0)));
        orders.placeOrder{value: PRICE}(0, REF);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.MerchantNotActive.selector, uint64(99)));
        orders.placeOrder{value: PRICE}(99, REF);
        vm.stopPrank();
    }

    function test_PlaceOrder_ZeroValueReverts() public {
        vm.prank(agent);
        vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.placeOrder{value: 0}(merchantId, REF);
    }

    function test_PlaceOrder_AboveUint128Reverts() public {
        uint256 tooMuch = uint256(type(uint128).max) + 1;
        vm.deal(agent, tooMuch);
        vm.prank(agent);
        vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.placeOrder{value: tooMuch}(merchantId, REF);
    }

    function test_PlaceOrder_Uint128MaxPasses() public {
        uint256 max = type(uint128).max;
        vm.deal(agent, max);
        uint256 payoutBefore = payout.balance;
        vm.prank(agent);
        orders.placeOrder{value: max}(merchantId, REF);
        assertEq(payout.balance - payoutBefore, max);
        (,, uint128 amt,,) = _order(REF);
        assertEq(amt, type(uint128).max);
    }

    function test_PlaceOrder_UnboundAgentReverts() public {
        vm.deal(agent2, PRICE);
        vm.prank(agent2);
        vm.expectRevert(SikyeoyongOrders.AgentNotBound.selector);
        orders.placeOrder{value: PRICE}(merchantId, REF);

        // 운영자도 에이전트가 아니면 직접 주문할 수 없다 (대리 호출 없음, 불변식 2)
        vm.prank(operator);
        vm.expectRevert(SikyeoyongOrders.AgentNotBound.selector);
        orders.placeOrder{value: PRICE}(merchantId, REF);
    }

    function test_PlaceOrder_PausedAgentReverts() public {
        vm.prank(operator);
        orders.setAgentPaused(agent, true);
        vm.prank(agent);
        vm.expectRevert(SikyeoyongOrders.AgentIsPaused.selector);
        orders.placeOrder{value: PRICE}(merchantId, REF);

        vm.prank(operator);
        orders.setAgentPaused(agent, false);
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);
        assertEq(address(orders).balance, 0);
    }

    function test_PlaceOrder_PayoutRejectsRevertsWithoutRecord() public {
        RejectingReceiver bad = new RejectingReceiver();
        uint64 badId = bad.register(orders);
        vm.prank(operator);
        orders.setMerchantStatus(badId, SikyeoyongOrders.MerchantStatus.Active);

        uint256 agentBefore = agent.balance;
        vm.prank(agent);
        vm.expectRevert(SikyeoyongOrders.TransferFailed.selector);
        orders.placeOrder{value: PRICE}(badId, REF);

        assertEq(agent.balance, agentBefore);
        (,,,, SikyeoyongOrders.OrderStatus st) = _order(REF);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.None)); // 다시 시도할 수 있다
    }

    function test_PlaceOrder_VaultFunctionsRevertInModeP() public {
        vm.startPrank(agent);
        vm.expectRevert(SikyeoyongOrders.WrongMode.selector);
        orders.placeOrderFromVault(merchantId, PRICE, REF);
        vm.expectRevert(SikyeoyongOrders.WrongMode.selector);
        orders.deposit{value: PRICE}(agent);
        vm.stopPrank();
    }

    function test_PlaceOrder_PlainTransferRejected() public {
        // receive, fallback이 없어 그냥 보낸 돈은 되돌아간다 (모드 P는 보관하지 않는다)
        vm.prank(agent);
        (bool ok,) = address(orders).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(address(orders).balance, 0);
    }

    // ---------------------------------------------------------------- refund

    function test_Refund_ByMerchantGoesToOwner() public {
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);
        uint256 agentBefore = agent.balance;
        uint256 ownerBefore = operator.balance;
        uint256 payoutBefore = payout.balance;

        vm.expectEmit(true, true, false, true, address(orders));
        emit SikyeoyongOrders.Refunded(REF, operator, 45_000 ether);
        vm.prank(payout);
        orders.refund{value: 45_000 ether}(REF);

        assertEq(operator.balance - ownerBefore, 45_000 ether); // 소유자에게
        assertEq(agent.balance, agentBefore); // 에이전트 지갑은 다시 채우지 않는다
        assertEq(payoutBefore - payout.balance, 45_000 ether);
        assertEq(address(orders).balance, 0);
        (,,,, SikyeoyongOrders.OrderStatus st) = _order(REF);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.Refunded));
    }

    function test_Refund_ByOperator() public {
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);
        vm.expectEmit(true, true, false, true, address(orders));
        emit SikyeoyongOrders.Refunded(REF, operator, 45_000 ether);
        vm.prank(operator);
        orders.refund{value: PRICE}(REF);
        (,,,, SikyeoyongOrders.OrderStatus st) = _order(REF);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.Refunded));
    }

    function test_Refund_StrangerOrOtherMerchantReverts() public {
        _registerActive(payout2);
        vm.deal(payout2, PRICE);
        vm.deal(stranger, PRICE);
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);

        address[4] memory notAllowed = [stranger, payout2, agent, upgrader];
        vm.deal(upgrader, PRICE);
        for (uint256 i; i < notAllowed.length; i++) {
            vm.prank(notAllowed[i]);
            vm.expectRevert(SikyeoyongOrders.NotOperator.selector);
            orders.refund{value: PRICE}(REF);
        }
    }

    function test_Refund_WrongValueReverts() public {
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);
        vm.startPrank(payout);
        vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.refund{value: PRICE - 1}(REF);
        vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.refund{value: PRICE + 1}(REF);
        vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.refund{value: 0}(REF);
        vm.stopPrank();
    }

    function test_Refund_UnpaidOrTwiceReverts() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.OrderNotPaid.selector, REF));
        orders.refund{value: PRICE}(REF);

        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);
        vm.prank(payout);
        orders.refund{value: PRICE}(REF);

        vm.prank(payout);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.OrderNotPaid.selector, REF));
        orders.refund{value: PRICE}(REF);
    }

    function test_Refund_WorksWhenMerchantSuspended() public {
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(merchantId, REF);
        vm.prank(operator);
        orders.setMerchantStatus(merchantId, SikyeoyongOrders.MerchantStatus.Suspended);

        uint256 ownerBefore = operator.balance;
        vm.prank(payout);
        orders.refund{value: PRICE}(REF);
        assertEq(operator.balance - ownerBefore, 45_000 ether);
    }

    function test_Refund_OwnerRejectsReverts() public {
        RejectingReceiver badOwner = new RejectingReceiver();
        orders = _deploy(address(badOwner), upgrader, false);
        vm.prank(address(badOwner));
        orders.bindAgent(agent);
        vm.prank(payout);
        uint64 id = orders.registerMerchant(KYB_UID, "");
        vm.prank(address(badOwner));
        orders.setMerchantStatus(id, SikyeoyongOrders.MerchantStatus.Active);
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(id, REF);

        vm.prank(payout);
        vm.expectRevert(SikyeoyongOrders.TransferFailed.selector);
        orders.refund{value: PRICE}(REF);
        (,,,, SikyeoyongOrders.OrderStatus st) = _order(REF);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.Paid));
    }

    // ---------------------------------------------------------------- 재진입

    function _reentrantMerchant(uint8 mode, bool bubble) internal returns (Reentrant r, uint64 id) {
        r = new Reentrant();
        r.configure(orders, mode, bubble, mode == 1 ? REF : REF2, 0, address(0));
        id = r.register();
        vm.prank(operator);
        orders.setMerchantStatus(id, SikyeoyongOrders.MerchantStatus.Active);
        r.configure(orders, mode, bubble, mode == 1 ? REF : REF2, id, address(0));
    }

    function test_Reentrancy_PayoutRefundDuringPayment() public {
        (Reentrant r, uint64 id) = _reentrantMerchant(1, false);
        uint256 ownerBefore = operator.balance;

        vm.prank(agent);
        orders.placeOrder{value: PRICE}(id, REF);

        assertTrue(r.attempted());
        assertFalse(r.reentered());
        assertEq(r.lastError(), abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector));
        assertEq(address(r).balance, 45_000 ether);
        assertEq(operator.balance, ownerBefore);
        (,,,, SikyeoyongOrders.OrderStatus st) = _order(REF);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.Paid));
    }

    function test_Reentrancy_PayoutPlaceOrderDuringPayment() public {
        (Reentrant r, uint64 id) = _reentrantMerchant(2, false);
        // 악성 가게가 스스로 에이전트로도 묶여 있어도 지급 중에는 다시 주문할 수 없다
        vm.prank(operator);
        orders.bindAgent(address(r));

        vm.prank(agent);
        orders.placeOrder{value: PRICE}(id, REF);

        assertFalse(r.reentered());
        assertEq(r.lastError(), abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector));
        (,,,, SikyeoyongOrders.OrderStatus st) = _order(REF2);
        assertEq(uint8(st), uint8(SikyeoyongOrders.OrderStatus.None));
    }

    function test_Reentrancy_BubbledFailureRevertsPayment() public {
        (, uint64 id) = _reentrantMerchant(1, true);
        uint256 agentBefore = agent.balance;
        vm.prank(agent);
        vm.expectRevert(SikyeoyongOrders.TransferFailed.selector);
        orders.placeOrder{value: PRICE}(id, REF);
        assertEq(agent.balance, agentBefore);
    }

    function test_Reentrancy_OwnerReentersRefund() public {
        Reentrant r = new Reentrant();
        orders = _deploy(address(r), upgrader, false);
        r.configure(orders, 1, false, REF, 0, address(0));
        r.bindAgent(agent);
        vm.prank(payout);
        uint64 id = orders.registerMerchant(KYB_UID, "");
        r.setMerchantStatus(id, SikyeoyongOrders.MerchantStatus.Active);
        vm.prank(agent);
        orders.placeOrder{value: PRICE}(id, REF);

        vm.prank(payout);
        orders.refund{value: PRICE}(REF);

        assertFalse(r.reentered());
        assertEq(r.lastError(), abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector));
        assertEq(address(r).balance, 45_000 ether);
    }

    // ---------------------------------------------------------------- 퍼즈

    /// 금액 경계: 1 이상 uint128 최대까지는 그대로 가게로 간다 (tech-spec 5.8).
    function testFuzz_PlaceOrder_PaysExactAmount(uint256 amount, bytes32 ref) public {
        amount = bound(amount, 1, type(uint128).max);
        vm.deal(agent, amount);
        uint256 payoutBefore = payout.balance;

        vm.prank(agent);
        orders.placeOrder{value: amount}(merchantId, ref);

        assertEq(payout.balance - payoutBefore, amount);
        assertEq(agent.balance, 0);
        assertEq(address(orders).balance, 0);
        (,, uint128 amt,,) = _order(ref);
        assertEq(amt, amount);
    }

    function testFuzz_PlaceOrder_AboveUint128Reverts(uint256 amount) public {
        amount = bound(amount, uint256(type(uint128).max) + 1, type(uint256).max);
        vm.deal(agent, amount);
        vm.prank(agent);
        vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.placeOrder{value: amount}(merchantId, REF);
    }

    function testFuzz_PlaceOrder_RefOnlyOnce(bytes32 ref, uint256 first, uint256 second) public {
        first = bound(first, 1, 1_000_000 ether);
        second = bound(second, 1, 1_000_000 ether);
        vm.deal(agent, first + second);
        vm.prank(agent);
        orders.placeOrder{value: first}(merchantId, ref);
        uint256 payoutAfter = payout.balance;

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SikyeoyongOrders.OrderExists.selector, ref));
        orders.placeOrder{value: second}(merchantId, ref);
        assertEq(payout.balance, payoutAfter);
    }

    function testFuzz_Refund_OnlyExactAmount(uint256 amount, uint256 sent) public {
        amount = bound(amount, 1, 1_000_000 ether);
        sent = bound(sent, 0, 2_000_000 ether);
        vm.deal(agent, amount);
        vm.prank(agent);
        orders.placeOrder{value: amount}(merchantId, REF);

        vm.deal(payout, sent);
        vm.prank(payout);
        if (sent != amount) vm.expectRevert(SikyeoyongOrders.BadAmount.selector);
        orders.refund{value: sent}(REF);
        assertEq(address(orders).balance, 0);
    }
}
