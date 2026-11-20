// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SikyeoyongOrders} from "../../src/SikyeoyongOrders.sol";

/// 불변식 테스트 핸들러. 정해진 배우들(에이전트, 가게, 운영자, 낯선 사람)만 움직인다.
/// orderRef는 몇 개로 줄여서 같은 orderRef 재사용이 자주 일어나게 한다.
contract OrdersHandler is Test {
    SikyeoyongOrders public orders;
    address public operator;
    address[] public agents; // 0, 1: 묶임. 2: 안 묶임
    address[] public payouts; // 가게 1, 2, 3의 payout
    address public stranger;
    bytes32[] public refs;

    mapping(bytes32 => uint256) public placedCount;
    uint256 public refundCount;

    constructor(
        SikyeoyongOrders orders_,
        address operator_,
        address[] memory agents_,
        address[] memory payouts_,
        address stranger_
    ) {
        orders = orders_;
        operator = operator_;
        agents = agents_;
        payouts = payouts_;
        stranger = stranger_;
        for (uint256 i; i < 6; i++) {
            refs.push(keccak256(abi.encode("ref", i)));
        }
    }

    function refCount() external view returns (uint256) {
        return refs.length;
    }

    function agentCount() external view returns (uint256) {
        return agents.length;
    }

    function payoutCount() external view returns (uint256) {
        return payouts.length;
    }

    function placeOrder(uint256 agentSeed, uint256 merchantSeed, uint256 refSeed, uint256 amount) external {
        address a = agents[agentSeed % agents.length];
        uint64 id = uint64(merchantSeed % (payouts.length + 1)); // 0은 없는 가게
        bytes32 r = refs[refSeed % refs.length];
        amount = bound(amount, 0, a.balance);
        vm.prank(a);
        try orders.placeOrder{value: amount}(id, r) {
            placedCount[r]++;
        } catch {}
    }

    function placeOrderFromVault(uint256 agentSeed, uint256 merchantSeed, uint256 refSeed, uint256 amount) external {
        address a = agents[agentSeed % agents.length];
        uint64 id = uint64(merchantSeed % (payouts.length + 1));
        bytes32 r = refs[refSeed % refs.length];
        amount = bound(amount, 0, 200_000 ether);
        vm.prank(a);
        try orders.placeOrderFromVault(id, amount, r) {
            placedCount[r]++;
        } catch {}
    }

    function deposit(uint256 agentSeed, uint256 amount) external {
        address a = agents[agentSeed % agents.length];
        amount = bound(amount, 0, operator.balance);
        vm.prank(operator);
        try orders.deposit{value: amount}(a) {} catch {}
    }

    function withdraw(uint256 agentSeed, uint256 amount, bool asOwner) external {
        address a = agents[agentSeed % agents.length];
        amount = bound(amount, 0, 200_000 ether);
        vm.prank(asOwner ? operator : stranger);
        try orders.withdraw(a, amount) {} catch {}
    }

    function refund(uint256 refSeed, uint256 who) external {
        bytes32 r = refs[refSeed % refs.length];
        (, uint64 merchantId, uint128 amount,,) = orders.orders(r);
        (address payout,,,) = orders.merchants(merchantId);
        address sender = who % 3 == 0 ? operator : who % 3 == 1 ? payout : stranger;
        if (sender == address(0) || sender.balance < amount) return;
        vm.prank(sender);
        try orders.refund{value: amount}(r) {
            refundCount++;
        } catch {}
    }

    function setPaused(uint256 agentSeed, bool paused) external {
        address a = agents[agentSeed % agents.length];
        vm.prank(operator);
        try orders.setAgentPaused(a, paused) {} catch {}
    }

    function setMerchantStatus(uint256 merchantSeed, uint8 status) external {
        uint64 id = uint64(merchantSeed % (payouts.length + 1));
        vm.prank(operator);
        try orders.setMerchantStatus(id, SikyeoyongOrders.MerchantStatus(status % 4)) {} catch {}
    }
}
