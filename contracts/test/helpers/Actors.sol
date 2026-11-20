// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SikyeoyongOrders} from "../../src/SikyeoyongOrders.sol";

/// 돈을 받지 않는 주소 (지급 실패 테스트).
contract RejectingReceiver {
    function register(SikyeoyongOrders orders) external returns (uint64) {
        return orders.registerMerchant(bytes32(0), "");
    }

    receive() external payable {
        revert("no");
    }
}

/// 돈을 받는 순간 주문 컨트랙트로 다시 들어가 보는 악성 주소.
/// mode 1: refund 재진입, 2: placeOrder 재진입, 3: withdraw 재진입, 4: deposit 재진입.
/// bubble이 true면 재진입 실패를 그대로 올려 지급이 실패하게 하고, false면 삼키고 결과만 기록한다.
contract Reentrant {
    SikyeoyongOrders public orders;
    uint8 public mode;
    bool public bubble;
    bytes32 public ref;
    uint64 public merchantId;
    address public agent;

    bool public attempted;
    bool public reentered;
    bytes public lastError;

    function configure(SikyeoyongOrders orders_, uint8 mode_, bool bubble_, bytes32 ref_, uint64 merchantId_, address agent_)
        external
    {
        orders = orders_;
        mode = mode_;
        bubble = bubble_;
        ref = ref_;
        merchantId = merchantId_;
        agent = agent_;
    }

    function register() external returns (uint64) {
        return orders.registerMerchant(bytes32(0), "");
    }

    function bindAgent(address a) external {
        orders.bindAgent(a);
    }

    function setMerchantStatus(uint64 id, SikyeoyongOrders.MerchantStatus st) external {
        orders.setMerchantStatus(id, st);
    }

    function placeOrder(uint64 id, bytes32 r) external payable {
        orders.placeOrder{value: msg.value}(id, r);
    }

    function deposit(address a) external payable {
        orders.deposit{value: msg.value}(a);
    }

    function withdraw(address a, uint256 amount) external {
        orders.withdraw(a, amount);
    }

    receive() external payable {
        if (attempted) return; // 한 번만 시도
        attempted = true;
        bool ok;
        bytes memory err;
        if (mode == 1) {
            (ok, err) = address(orders).call{value: msg.value}(abi.encodeCall(SikyeoyongOrders.refund, (ref)));
        } else if (mode == 2) {
            (ok, err) =
                address(orders).call{value: msg.value}(abi.encodeCall(SikyeoyongOrders.placeOrder, (merchantId, ref)));
        } else if (mode == 3) {
            (ok, err) = address(orders).call(abi.encodeCall(SikyeoyongOrders.withdraw, (agent, msg.value)));
        } else if (mode == 4) {
            (ok, err) = address(orders).call{value: msg.value}(abi.encodeCall(SikyeoyongOrders.deposit, (agent)));
        }
        reentered = ok;
        lastError = err;
        if (!ok && bubble) {
            assembly {
                revert(add(err, 32), mload(err))
            }
        }
    }
}
