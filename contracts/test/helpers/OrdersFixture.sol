// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SikyeoyongOrders} from "../../src/SikyeoyongOrders.sol";

/// 테스트 공통 준비. 테스트넷은 PCL 프록시(deployPclProxy, UUPS) 뒤에 배포하지만 anvil에는 PCL이 없어
/// 같은 ERC-1967 UUPS 모양인 OZ ERC1967Proxy 뒤에 둔다. PCL 정책 동작은 여기서 재현하지 않는다 (testing.md).
abstract contract OrdersFixture is Test {
    // 금액은 aokrw. 10,000 OKRW = 10_000 ether (tech-spec 5.4).
    uint256 internal constant PRICE = 45_000 ether;

    SikyeoyongOrders internal orders;
    SikyeoyongOrders internal implementation;

    address internal operator = makeAddr("operator");
    address internal upgrader = makeAddr("upgrader");
    address internal agent = makeAddr("agent");
    address internal agent2 = makeAddr("agent2");
    address internal payout = makeAddr("payout");
    address internal payout2 = makeAddr("payout2");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant KYB_UID = keccak256("kyb-1");
    bytes32 internal constant REF = keccak256("order-1");
    bytes32 internal constant REF2 = keccak256("order-2");

    uint64 internal merchantId;

    function _deploy(address operator_, address owner_, bool vaultMode_) internal returns (SikyeoyongOrders) {
        implementation = new SikyeoyongOrders();
        bytes memory init = abi.encodeCall(SikyeoyongOrders.initialize, (operator_, owner_, vaultMode_));
        return SikyeoyongOrders(payable(address(new ERC1967Proxy(address(implementation), init))));
    }

    /// 운영자가 에이전트를 묶고, 가게 하나를 등록해 활성화한다.
    function _standardSetup(bool vaultMode_) internal {
        orders = _deploy(operator, upgrader, vaultMode_);
        vm.prank(operator);
        orders.bindAgent(agent);
        merchantId = _registerActive(payout);
        vm.deal(agent, 1_000_000 ether);
        vm.deal(operator, 1_000_000 ether);
        vm.deal(payout, 1_000_000 ether);
    }

    function _registerActive(address payout_) internal returns (uint64 id) {
        vm.prank(payout_);
        id = orders.registerMerchant(KYB_UID, "ipfs://merchant");
        vm.prank(operator);
        orders.setMerchantStatus(id, SikyeoyongOrders.MerchantStatus.Active);
    }

    function _order(bytes32 ref)
        internal
        view
        returns (address agent_, uint64 merchantId_, uint128 amount_, uint64 createdAt_, SikyeoyongOrders.OrderStatus st)
    {
        return orders.orders(ref);
    }

    function _merchantStatus(uint64 id) internal view returns (SikyeoyongOrders.MerchantStatus st) {
        (,, st,) = orders.merchants(id);
    }
}
