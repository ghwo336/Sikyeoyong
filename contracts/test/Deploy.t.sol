// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";

/// 배포 스크립트의 확인 단계와 기록 모양. 파일은 쓰지 않는다 (run은 anvil에서 손으로 확인).
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
