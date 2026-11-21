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
///       --rpc-url "$MAROO_RPC_URL" --account <keystore 이름> --broadcast
///   키는 `cast wallet import <이름> --interactive`로 넣은 keystore(--account)나 --interactive로 받는다.
///   --private-key는 쓰지 않는다 (키가 프로세스 목록과 셸 기록에 보인다).
///   가스 한도는 고정하지 않는다 (forge 추정값. 마루는 가스 한도의 절반을 무조건 과금, maroo-facts 4)
///
/// 실제 테스트넷 배포는 호재 님 승인 뒤에만 한다.
///
/// 지금의 실제 배포 경로는 `pnpm contracts:deploy:testnet`(infra/scripts/deploy-orders.ts)이다. 그 스크립트가
/// 구현 배포(viem), PCL 프록시(`deployPclProxy`, UUPS, initialize를 같은 트랜잭션에서), 프록시 확인, 정책
/// (`changeContractPolicies`, 전체 교체), 정책 재조회 검증, 배포 기록 채우기까지 모두 한다 (확인, 2026-11-20
/// 테스트넷 실제 실행. chain-and-pcl.md "배포"). 정책 admin은 `deployPclProxy` 호출자가 배포와 동시에 된다
/// (확인, F-20). 정책 값은 packages/shared policy.ts, 적용과 대조는 `pnpm policy:apply`.
///
/// 이 forge 스크립트는 그중 1단계(구현 컨트랙트 배포)와 배포 기록 틀(proxy, deployBlock, policyHash는 0,
/// 0은 "아직 안 함")만 한다. 프록시, 정책, 기록 채우기는 하지 않는다. 쓸 일은 forge 방식으로 구현만 따로 올릴
/// 때와 이 스크립트의 테스트(체인 ID 대조, 기록 덮어쓰기 거절)다. 이 스크립트가 남긴 기록을 TS 스크립트가
/// 이어 쓰지 않으므로, 둘을 섞어 쓰지 않는다 (같은 체인 ID와 프로필의 기록 파일이 이미 있으면 멈춘다).
/// 목 가게 등록(registerMerchant)은 가게 payout 키가 직접 해야 해서(D-08 E-2) 여기서 하지 않는다
/// (infra/scripts/register-merchants.ts).
contract Deploy is Script {
    error ChainIdMismatch(uint256 expected, uint256 actual);
    error UnknownProfile(string profile);
    error DeploymentExists(string path);

    /// 배포 기록 폴더 (contracts/ 기준). foundry.toml fs_permissions가 이 폴더만 쓰기 허용한다.
    string internal constant DEPLOYMENTS_DIR = "/../packages/shared/src/config/deployments/";

    function run() external returns (address) {
        return deploy(vm.envUint("CHAIN_ID"), vm.envOr("POLICY_PROFILE", string("default")));
    }

    /// run()의 본체. 환경변수를 읽지 않아서 테스트가 병렬로 불러도 서로 섞이지 않는다.
    function deploy(uint256 expectedChainId, string memory profile) public returns (address implementation) {
        checkTarget(expectedChainId, block.chainid, profile);

        string memory path = deploymentPath(block.chainid, profile);
        // 이미 기록이 있으면 덮어쓰지 않는다. 운영 중인 프록시 주소를 잃지 않게 한다.
        if (vm.exists(path)) revert DeploymentExists(path);

        vm.startBroadcast();
        implementation = address(new SikyeoyongOrders());
        vm.stopBroadcast();

        // --broadcast일 때만 기록한다. 연습 실행(dry run)이 체인에 없는 주소를 기록하지 않게.
        // forge는 실행을 먼저 흉내 낸 뒤 보내므로 기록이 전송보다 앞선다. 전송이 실패하면 사람이 기록 파일을 지운다
        // (스크립트는 지우지 않는다). 후속: 주소에 코드가 있는지(extcodesize) 확인한 뒤에만 기록하는 단계.
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
