# 마루 사실 확인 기록 (시켜용 설계 전제)

확인일: 2026-11-18. 출처는 docs.maroo.io. 표시 규칙: (확인) 문서에 있음, (추론) 문서에서 해석함, (미확인) 문서에 없음.

## 1. MAWS (Maroo Agent Wallet Stack)

| 항목 | 내용 | 상태 | 출처 |
| --- | --- | --- | --- |
| 도구 | MCP 도구 19개. agent 11개(create, detail, list, balance, owner_balance, fund, drain, freeze, unfreeze, revoke, set_gas_source), policy 3개(get, set, preflight), transfer 5개(send, initiate, pending, accept, cancel) | 확인 | /apis/maws |
| 에이전트 생성 | `agent.create` 후 PENDING, 온체인 등록까지 1~3분 뒤 ACTIVE | 확인 | /apis/maws |
| 지갑 | 에이전트마다 WaaS가 AA 지갑을 만들고 키를 관리. 도구에 개인키를 넘기지 않음 | 확인 | /concepts/agents/maws-architecture-overview |
| 전송 | `transfer.send`는 에이전트가 주소로 OKRW를 보냄. 서버에서 정책 검사 후 WaaS가 서명 | 확인 | /apis/maws |
| 컨트랙트 함수 호출 | MCP `transfer.send` 입력은 `agentId`, `to`, `amount`(OKRW 소수 문자열), `clientToken`뿐이고 calldata(`data`) 칸이 없다. MCP로는 컨트랙트 함수를 부를 수 없다. WaaS API 자체가 calldata를 받는지는 문서에 없다 | MCP 확인 (2026-11-20, 도구 스키마, 결정 D-25), WaaS 미확인 | m-aws MCP 도구 스키마 |
| MCP 정책 강제 | `transfer.send` 설명: "this MCP server (m-aws) checks the agent's on-chain policy (spending limit + allowed targets); WaaS does not enforce that policy itself". 서명 서비스는 정책을 강제하지 않는다 | 확인 (2026-11-20, 도구 설명) | m-aws MCP 도구 설명 |
| 정책 필드 | `spendingLimit`(건당, 0=무제한, 단위 aokrw), `allowedTargets`(빈 배열이면 모든 주소 허용), `status` | 확인 | /concepts/agents/agent-policy-semantics |
| 소유자 주소 | `allowedTargets`와 무관하게 항상 허용. 단 `spendingLimit`은 적용 | 확인 | agent-policy-semantics |
| 강제 위치 | `spendingLimit`, `allowedTargets`, `status`는 MAWS(오프체인)만 강제. 체인은 읽지 않음. 에이전트 키로 MAWS 밖에서 보내면 MAWS 규칙은 적용되지 않음 | 확인 | /concepts/agents/two-layer-policy-model |
| 문서 불일치 | agent-policy-semantics는 "오프체인 검사를 우회해도 합의 단계에서 차단"이라고 쓰고, two-layer-policy-model은 "MAWS 규칙은 MAWS만 강제"라고 씀. 데브렐 문서 보강 대상 | 확인 | 두 페이지 |
| freeze/revoke | FROZEN은 전송·정책 변경 불가, REVOKED는 영구. 온체인 강제는 아님(status는 MAWS 규칙) | 확인 | /apis/maws, two-layer |
| drain | 에이전트 잔액을 소유자 기본 지갑으로 회수. spendingLimit 초과 시 나눠 보냄 | 확인 | /apis/maws |
| 소유권 이전 | `transfer.initiate` 즉시 FROZEN, 24시간 안에 수락 없으면 만료 | 확인 | /apis/maws |
| 가스 | PAYMASTER(기본, WaaS가 가스 후원, 에이전트 OKRW 미사용), SELF, OWNER(실험, 현재 SELF처럼 동작) | 확인 | /concepts/agents/gas-source-modes |
| 테스트넷 페이마스터 | 테스트넷에서 PAYMASTER가 동작하는지 문서에 없음 | 미확인 | gas-source-modes |
| 로그인 | 소셜 OAuth: Kakao, Google, Naver, Apple. 헤드리스는 OPAQUE 이메일 | 확인 | /guides/agents/guide-authenticating-maws |
| 자격 증명 | `~/.maroo/credentials.json`에 저장, MCP 서버가 자동 갱신 | 확인 | guide-authenticating-maws |
| 컨테이너 | `WAAS_AUTH_TOKEN`으로 대화형 로그인 없이 Docker·CI 배포 가이드 있음 | 확인 | /guides/agents |
| 멀티테넌트 | 서버 하나가 여러 사용자의 MAWS 계정을 다루는 방법 문서에 없음 | **미확인** | guide-authenticating-maws |

## 2. ERC-8004 IdentityRegistry

- preinstall 주소 `0x8004000000000000000000000000000000000001`. 테스트넷은 v0.4.0 업그레이드(블록 6,372,905)로 설치. (확인, /concepts/agents)
- 등록, 에이전트 URI, 메타데이터, 에이전트 지갑은 ERC-8004 v1 ABI. attest/revoke 함수 없음. (확인)
- Agent 프리컴파일 `0x100000000000000000000000000000000000000A`: 읽기 전용, `getParams()`, `getAgentIds(wallet, pageRequest)`. (확인)
- MAWS 정책 값은 IdentityRegistry 메타데이터로 저장. (확인)

## 3. PCL

### 3.1 템플릿 (확인, /concepts/compliance)
| 템플릿 | 역할 | 비고 |
| --- | --- | --- |
| `VOLUME_POLICY` | 건당 금액 한도 (denom별 최소·최대) | 누적 없음 |
| `PERIODIC_VOLUME_POLICY` | 기간별 누적 한도 | (scope, sender, denom)별 누적. 전역·컨트랙트 범위 모두 |
| `EAS_POLICY` | 유효한 EAS attestation 보유 여부 | |
| `AGENT_OKRW_TRANSFER_LIMIT_POLICY` | 에이전트 단일 전송 상한 | 상한은 8004 메타데이터 `TransferLimit`에서 읽음 |
| `ALLOW_LIST_POLICY` | 허용 목록 (From/To/Both) | 컨트랙트 범위 전용. **테스트넷(v0.11.1) 미등록** |
| `DENY_LIST_POLICY` | 거절 목록 | 전역·컨트랙트 범위 |
| `LOGICAL_POLICY` | AND/OR 조합 | 조합 자식에는 selector 불가로 보임 |
| `FOR_EACH_POLICY` | 자식 정책을 호출자의 에이전트 소유자 집합마다 적용 | |
| `OKRW_EAS_TRANSFER_LIMIT_POLICY`, `OKRW_EAS_PERIODIC_VOLUME_LIMIT_POLICY` | 제거됨 | 쓰면 `UnknownPolicyType` revert |

- 실제 등록된 템플릿은 런타임에 `IPcl.policyTemplate(templateId)`로 확인. PCL 프리컴파일 `0x1000000000000000000000000000000000000005`.

### 3.2 PERIODIC_VOLUME_POLICY (확인, pcl-template-periodic-volume-policy)
- struct: `(string[] tokens, (uint256 maxAmount, uint64 resetPeriodSeconds)[] limits)`. 토큰 예 `"atokrw"`.
- 주기는 초 단위만. 30일 = 2,592,000초. 문서 예시에 "핫 지갑 30일당 10M OKRW".
- `block.timestamp >= resetAt`이면 0으로 리셋하고 resetAt 진행 (고정 주기로 추론). 달력 월 리셋 아님.
- 초과 시 `ExceededPeriodicVolume(uint256 maxLimit, uint256 value, uint256 resetAt)`.
- 조회: `globalPeriodicVolume(user, asset)`, `contractPeriodicVolume(contract, user, selector, asset)`.
- 인증 사용자 면제: `EAS_POLICY`와 Or로 묶는 `LOGICAL_POLICY`가 일반적 구성.

### 3.3 AGENT_OKRW_TRANSFER_LIMIT_POLICY (확인, pcl-template-agent-okrw-transfer-limit-policy)
- 에이전트 지갑이 시작한 단일 전송의 OKRW 금액 상한.
- 전역 범위: 에이전트가 직접 sender이거나 프록시 훅이 에이전트를 principal로 넘길 때. 컨트랙트 범위: 직접 sender 귀속만.
- 설정: 에이전트 소유자가 IdentityRegistry `setMetadata`로 키 `"TransferLimit"`, 값 `abi.encode(uint256)` 정확히 32바이트, 단위 atokrw.
- 메타데이터가 비었거나 32바이트가 아니면 `AgentTransferLimitMetadataInvalid(reason)`로 revert. **정책을 건 컨트랙트에서 메타데이터 없는 에이전트는 실패한다는 뜻 (추론). 에이전트 생성 직후 반드시 기록.**
- 실행 전 call value 검사, 실행 후 트랜잭션이 만든 OKRW 전송 각각 검사. 초과 시 `ExceededAgentTransferLimit(maxLimit, value)`.
- **테스트넷 전역 정책은 TransferLimit를 검사하지 않음.** (확인, maws-architecture-overview) → 시켜용은 주문 컨트랙트 범위에 직접 건다.

### 3.4 전역 KYC 한도 (확인, two-layer-policy-model)
- EAS attestation(KYC) 없는 발신자: 건당 2,000,000 OKRW, UTC 하루 10,000,000 OKRW.
- 에이전트 지갑 전송은 소유자의 하루 누적에 더해진다. 두 한도를 모두 풀려면 소유자 attestation 필요. 지갑 자체 attestation만 있으면 건당 한도만 풀림.
- 즉 **에이전트를 여러 개 만들어도 하루 누적은 소유자 단위로 합산** (전역 KYC 한도에 한해).

### 3.5 PCL 프록시 (확인, pcl-proxy-hook)
- `deployPclProxy`: Transparent, UUPS, Beacon, Diamond. 구현과 1:1.
- 프록시가 실행 전 `preCall`, 실행 후 `postCall` 호출. 실패한 호출은 정책 평가 생략.
- 훅 호출자는 등록된 PCL 프록시 또는 `PclParams.entrypoints`의 신뢰 엔트리포인트만. EOA, 7702 위임 EOA, 임의 컨트랙트는 `Unauthorized`.
- 정책은 직접 호출자가 아니라 principal(최종 사용자) 기준으로 평가.
- 신뢰 엔트리포인트는 제네시스 파라미터, 거버넌스로만 변경.
- 테스트넷 실제 값 (확인, 2026-11-20 PCL 프리컴파일 `getParams()` 조회): entrypoints = `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`, `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`, `0x433709009B8330FDa32311DF1C2AFA402eD8D009`(파우치 EntryPoint v9). policyAdmin `0x58eC1E718ff15e5f34591747D47ADf5BccDA804F`. 앞의 둘이 v0.6, v0.8 표준 EntryPoint인 것은 (추론). open-questions Q-39.

### 3.6 정책 관리 (확인, pcl-policy-admin)
- 전역 정책 관리자 `IPcl.policyAdmin()` 단일 주소. 4개 메서드만: registerPolicyTemplate, removePolicyTemplate, setGlobalPolicies, removeGlobalPolicies.
- 컨트랙트 범위 정책은 "적절한 호출자"가 `changeContractPolicies`로 관리, `contractPolicies`로 조회. 인자와 권한 상세는 pcl-contract-admin-binding 문서 확인 필요. (부분 미확인)
- 주소 리스트: `createAddressList` 누구나, 호출자가 리스트 admin. `updateAddressList` 등은 리스트 admin만.
- 정책 관리자도 컨트랙트 범위 정책을 우회하지 못함.

## 4. 네트워크
- 테스트넷 RPC `https://rpc-testnet.maroo.io`, Faucet `https://faucet.maroo.io`, Explorer `https://explorer-testnet.maroo.io`, KYC `https://kyc-testnet.maroo.io`.
- 체인 ID 450815는 변경 예정. Mock KYC 전환 예정. 둘 다 시점 미정. **하드코딩 금지.**
- OKRW는 네이티브 코인. ERC-20 진입점 없음. 결제 함수는 `payable`. 최소 단위 aokrw(10^18). 테스트넷 denom `atokrw`.
- 가스 한도의 절반은 무조건 과금, 단순 전송도 약 22,300 가스. 고정 가스 금지.
- 지원하는 EVM 하드포크(Shanghai PUSH0, Cancun MCOPY와 TSTORE)는 문서에 없다 (미확인, 2026-11-20 `pcl-proxy-hook` 재확인, Q-32, F-11). 시켜용 컨트랙트는 `evm_version = paris`로 컴파일한다.
- `deployPclProxy`의 시그니처, kind 값, 초기화 데이터 전달, OZ `UUPSUpgradeable` 호환 여부는 문서에 없다 (미확인, 2026-11-20 재확인, Q-13, F-12).

## 4.1 기술 기획 조사로 추가 확인 (2026-11-18)
| 항목 | 내용 | 상태 | 출처 |
| --- | --- | --- | --- |
| 평가 단계 | 전역 정책: RPC 제출 시점에 거절되면 브로드캐스트되지 않음(가스 없음, 블록 미포함). 컨트랙트 범위 정책: 프록시 경유 실행 중 평가, 거절되면 revert되지만 블록에 포함되고 가스 과금 | 확인 | /concepts/compliance/pcl-policy-enforcement |
| EAS_POLICY 범위 | 트랜잭션 sender의 attestation만 검사 (`EasNoAttestationReceived(address sender)`) | 확인 (기술 기획 조사), 정책 강제 페이지에서는 암시 수준 | /concepts/compliance/pcl-template-eas-policy |
| 셀렉터당 정책 | 한 셀렉터에 PolicySet 하나. 같은 셀렉터 중복은 `InvalidParameter`. 여러 규칙은 `LOGICAL_POLICY`로 묶고 자식에는 셀렉터를 넣지 않음 | 확인 | pcl-policy-structure, pcl-policy-enforcement |
| 컨트랙트 정책 admin | 처음 `changeContractPolicies`를 호출한 주소가 admin, 한 번만 지정. `changeContractPolicies`는 전체 교체 | 확인 (기술 기획 조사) | pcl-contract-admin-binding |
| EAS 인덱싱 | attestation은 `indexAttestation`으로 인덱싱돼야 정책에서 인정 | 확인 (기술 기획 조사) | EAS 개념 문서 |
| 테스트넷 | Cosmos chain-id `maroo-testnet-1`, WebSocket `wss://ws-testnet.maroo.io`, denom `atokrw`, decimals 18 | 확인 | /resources/network/testnet-access |
| TransferLimit와 선불 | 컨트랙트 범위에서는 직접 sender 귀속만, 실행 전 call value 검사. 컨트랙트가 내보내는 지급이 에이전트 한도로 집계되는지는 미확인 (스파이크 S10) | 부분 확인 | pcl-template-agent-okrw-transfer-limit-policy |

## 5. 외부
- k-skill (NomaDamas/k-skill): 한국 생활 스킬 125개, 스타 7.7k, MIT(프록시는 AGPL). 결제·송금 스킬 없음. `nts-business-registration`(국세청 사업자 조회), `korea-weather`, `kakao-map` 있음.
- (참고만, D-14로 시켜용에서는 쓰지 않음) ClawOps (한국AI통신, claw-ops.com): 070 즉시 발급, 카드 등록 없음, 서울 리전, 발신·착신·문자·녹음·전사 API.
- 050 안심번호는 수신 전용 (과기정통부 설명).
- 앱스토어: 가상화폐 지갑은 조직 계정만 배포(3.1.5(i)). 서드파티 소셜 로그인을 쓰면 동등한 프라이버시 로그인 추가 필요(4.8), 보통 애플 로그인.
