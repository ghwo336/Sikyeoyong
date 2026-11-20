// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";

/// 배포 스크립트의 확인 단계, 기록 가드, 기록 모양. 환경변수는 run() 한 테스트만 쓴다 (병렬 실행에서 섞이지 않게).
/// 나머지는 run()의 본체 deploy()를 부른다. 실제 --broadcast 기록은 anvil에서 손으로 확인했다.
contract DeployScriptTest is Test {
    Deploy internal script;

    function setUp() public {
        script = new Deploy();
    }

    function test_CheckTarget_AcceptsMatchingChainAndProfiles() public view {
        script.checkTarget(7, 7, "default");
        script.checkTarget(7, 7, "demo");
    }

    function test_CheckTarget_ChainIdMismatchReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Deploy.ChainIdMismatch.selector, uint256(7), uint256(8)));
        script.checkTarget(7, 8, "default");
    }

    function test_CheckTarget_UnknownProfileReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Deploy.UnknownProfile.selector, "prod"));
        script.checkTarget(7, 7, "prod");
        vm.expectRevert(abi.encodeWithSelector(Deploy.UnknownProfile.selector, ""));
        script.checkTarget(7, 7, "");
    }

    function test_RunWithWrongChainIdSendsNothing() public {
        vm.setEnv("CHAIN_ID", vm.toString(block.chainid + 1));
        vm.setEnv("POLICY_PROFILE", "default");
        vm.expectRevert(abi.encodeWithSelector(Deploy.ChainIdMismatch.selector, block.chainid + 1, block.chainid));
        script.run();
    }

    /// 이미 기록이 있으면 덮어쓰지 않는다. 다른 데서 쓰지 않는 체인 ID로 격리한다 (테스트는 병렬로 돈다).
    function test_RunRefusesExistingDeployment() public {
        vm.chainId(999_001);
        string memory path = script.deploymentPath(999_001, "default");
        vm.writeFile(path, ""); // 지난 실패가 남긴 파일이 있어도 덮어쓴다

        vm.expectRevert(abi.encodeWithSelector(Deploy.DeploymentExists.selector, path));
        script.deploy(999_001, "default");

        vm.removeFile(path);
    }

    /// --broadcast가 아니면(여기서는 forge test 문맥) 배포 기록을 쓰지 않는다.
    function test_RunWithoutBroadcastWritesNothing() public {
        vm.chainId(999_002);
        string memory path = script.deploymentPath(999_002, "demo");
        assertFalse(vm.exists(path));

        address implementation = script.deploy(999_002, "demo");

        bool written = vm.exists(path);
        if (written) vm.removeFile(path); // 실패해도 파일을 남기지 않는다
        assertFalse(written);
        assertGt(implementation.code.length, 0);
    }

    function test_DeploymentPath() public view {
        string memory path = script.deploymentPath(42, "demo");
        assertEq(path, string.concat(vm.projectRoot(), "/../packages/shared/src/config/deployments/42.demo.json"));
    }

    function test_DeploymentJsonShape() public {
        address impl = address(0x1234);
        string memory json = script.deploymentJson(42, "demo", impl);
        assertEq(vm.parseJsonUint(json, ".chainId"), 42);
        assertEq(vm.parseJsonString(json, ".profile"), "demo");
        assertEq(vm.parseJsonAddress(json, ".implementation"), impl);
        assertEq(vm.parseJsonAddress(json, ".proxy"), address(0));
        assertEq(vm.parseJsonUint(json, ".deployBlock"), 0);
        assertEq(vm.parseJsonBytes32(json, ".policyHash"), bytes32(0));
    }
}
