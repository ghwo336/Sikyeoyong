// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {SikyeoyongOrders} from "../src/SikyeoyongOrders.sol";

/// @notice SikyeoyongOrders 구현 컨트랙트 배포 (tech-spec 5.5 1단계, 5.9 1단계).
///
/// 체인 ID, RPC, 주소를 코드에 적지 않는다 (CLAUDE.md 2). 모두 환경변수와 명령 인자로 받는다.
///   CHAIN_ID        기대하는 체인 ID. 연결된 RPC의 체인 ID와 다르면 아무것도 보내지 않고 멈춘다
///                   (테스트넷 체인 ID는 바뀔 예정, maroo-facts 4)
///   POLICY_PROFILE  default | demo (D-12). 배포 기록 파일 이름에 쓴다
///   RPC와 서명 키는 명령 인자로 (저장소 루트에서):
///     forge script contracts/script/Deploy.s.sol:Deploy --root contracts \
///       --rpc-url "$MAROO_RPC_URL" --private-key "$OPERATOR_KEY" --broadcast
///   가스 한도는 고정하지 않는다 (forge 추정값. 마루는 가스 한도의 절반을 무조건 과금, maroo-facts 4)
///
/// 실제 테스트넷 배포는 호재 님 승인 뒤에만 한다. `pnpm contracts:deploy:testnet`은 준비 확인만 한다.
///
/// 전체 배포 순서 (contracts.md "배포 순서", chain-and-pcl.md). 이 스크립트는 1과 6의 앞부분만 한다.
///   1. 구현 컨트랙트 배포 (이 스크립트)
///   2. PCL 프리컴파일 `deployPclProxy(kind = UUPS)`로 프록시 배포 (확인: 프록시 종류 Transparent, UUPS,
///      Beacon, Diamond). kind 열거값, 구현 주소를 넘기는 방법, 초기화 데이터를 넘기는 방법은 (미확인, Q-13).
///      PCL 프록시가 OZ UUPSUpgradeable의 proxiableUUID 검사와 맞는지도 (미확인, Q-13).
///   3. 프록시를 거쳐 initialize(operator, owner, vaultMode = false). 2와 3 사이에 남이 먼저 initialize하지
///      못하게 2에서 초기화 데이터를 같이 넘기는 방법이 있으면 그것을 쓴다 (미확인, Q-13)
///   4. IPcl.pclProxy(proxy)로 {kind, admin, proxy} 확인 (확인)
///   5. 같은 운영자 키로 즉시 changeContractPolicies 첫 호출. 처음 부른 주소가 정책 admin이 되고 한 번만
///      정해진다 (확인). 전체 교체 방식이라 정책 전체를 한 번에 넣는다 (확인):
///      placeOrder(uint64,bytes32) LOGICAL_POLICY(And: AGENT_OKRW_TRANSFER_LIMIT_POLICY, PERIODIC_VOLUME_POLICY),
///      registerMerchant(bytes32,string) EAS_POLICY. 빈 셀렉터 정책은 걸지 않는다.
///      PolicySet, LogicalPolicy의 Solidity 타입과 enum 값은 (미확인, Q-13). 값은 packages/shared policy.ts.
///   6. contractPolicies 재조회로 검증하고, 프록시 주소와 배포 블록, 정책 해시를 배포 기록에 채운다
/// 2부터 6은 infra/scripts/deploy-orders.ts(viem, 아직 없음) 몫이다 (tech-spec 5.9). 이 스크립트가 남긴
/// 기록의 proxy, deployBlock, policyHash는 0이고, 0은 "아직 안 함"이다.
/// 목 가게 등록(registerMerchant)은 가게 payout 키가 직접 해야 해서(D-08 E-2) 여기서 하지 않는다.
contract Deploy is Script {
    error ChainIdMismatch(uint256 expected, uint256 actual);
    error UnknownProfile(string profile);
    error DeploymentExists(string path);

    /// 배포 기록 폴더 (contracts/ 기준). foundry.toml fs_permissions가 이 폴더만 쓰기 허용한다.
    string internal constant DEPLOYMENTS_DIR = "/../packages/shared/src/config/deployments/";

    function run() external returns (address implementation) {
        uint256 expectedChainId = vm.envUint("CHAIN_ID");
        string memory profile = vm.envOr("POLICY_PROFILE", string("default"));
        checkTarget(expectedChainId, block.chainid, profile);

        string memory path = deploymentPath(block.chainid, profile);
        // 이미 기록이 있으면 덮어쓰지 않는다. 운영 중인 프록시 주소를 잃지 않게 한다.
        if (vm.exists(path)) revert DeploymentExists(path);

        vm.startBroadcast();
        implementation = address(new SikyeoyongOrders());
        vm.stopBroadcast();

        // --broadcast일 때만 기록한다. 연습 실행(dry run)이 체인에 없는 주소를 기록하지 않게.
        // forge는 실행을 먼저 흉내 낸 뒤 보내므로 기록이 전송보다 앞선다. 전송이 실패하면 기록 파일을 지운다.
        if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast) || vm.isContext(VmSafe.ForgeContext.ScriptResume)) {
            vm.writeJson(deploymentJson(block.chainid, profile, implementation), path);
        }
    }

    /// 체인 ID와 프로필을 확인한다. 틀리면 아무것도 보내기 전에 멈춘다.
    function checkTarget(uint256 expectedChainId, uint256 actualChainId, string memory profile) public pure {
        if (expectedChainId != actualChainId) revert ChainIdMismatch(expectedChainId, actualChainId);
        bytes32 p = keccak256(bytes(profile));
        if (p != keccak256("default") && p != keccak256("demo")) revert UnknownProfile(profile);
    }

    /// packages/shared/src/config/deployments/<chainId>.<profile>.json
    function deploymentPath(uint256 chainId, string memory profile) public view returns (string memory) {
        return string.concat(vm.projectRoot(), DEPLOYMENTS_DIR, vm.toString(chainId), ".", profile, ".json");
    }

    /// 배포 기록 모양 (contracts.md "배포 기록"). proxy, deployBlock, policyHash는 2~6단계가 채운다.
    function deploymentJson(uint256 chainId, string memory profile, address implementation)
        public
        returns (string memory)
    {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", chainId);
        vm.serializeString(key, "profile", profile);
        vm.serializeAddress(key, "implementation", implementation);
        vm.serializeAddress(key, "proxy", address(0));
        vm.serializeUint(key, "deployBlock", 0);
        return vm.serializeBytes32(key, "policyHash", bytes32(0));
    }
}
