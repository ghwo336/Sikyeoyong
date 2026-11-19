---
node: leaf
parent: _index.md
children: []
---

# 체인과 PCL (packages/shared/src/config, apps/api/src/modules/chain)

## 책임
- 체인 설정(체인 ID, RPC, 탐색기, 컨트랙트 주소, 프리컴파일 주소)을 한곳에서 관리.
- `SikyeoyongOrders`에 걸 컨트랙트 범위 PCL 정책을 정의하고 적용 (`pnpm policy:apply`).
- 체인 읽기와 인덱서: 누적값, 이벤트, attestation, 8004 메타데이터 (tech-spec "3.9 체인 읽기와 인덱서").
- revert 데이터를 해석해 정규화된 에러 코드로 매핑 (tech-spec "3.6 에러 코드와 드래곤 대사").

## 책임 아님
- 결제 실행 (`payment.md`)
- 전역 정책 변경 (우리는 권한 없음. 정책 관리자 단일 주소만, 확인)

## 의존과 인터페이스 경계
- 설정 파일: `packages/shared/src/config/chain.ts` (네트워크별), `packages/shared/src/config/policy.ts` (정책값, 프로필), `packages/shared/src/config/deployments/<chainId>.<profile>.json` (배포 주소).
- 프리컴파일: PCL `0x1000000000000000000000000000000000000005`, Agent `0x100000000000000000000000000000000000000A`, IdentityRegistry `0x8004000000000000000000000000000000000001` (확인). 이것도 설정 파일에 둔다.
- 읽기 클라이언트는 viem. 서버만 체인을 읽는다.

## 정책이 언제 막는가 (D-02 표현 규칙, 확인)
| 정책 | 평가 시점 | 거절되면 |
| --- | --- | --- |
| 전역 정책 (KYC 한도) | RPC 제출 시점 | 브로드캐스트 안 됨. 가스 없음, 블록에 없음 |
| 컨트랙트 범위 정책 (TransferLimit, 30일 누적, EAS) | 프록시 경유 실행 중 | revert. 트랜잭션은 블록에 남고 가스 과금 |

그래서 문서, 화면, 데모 설명에서 "멤풀 전에 막는다"는 전역 정책에만 쓴다. 시켜용 한도는 "체인이 막는다(실행 중 되돌림)"로 쓴다. 근거: [pcl-policy-enforcement](https://docs.maroo.io/concepts/compliance/pcl-policy-enforcement).

## 적용할 정책 (D-07, D-08, D-12)
| 셀렉터 | 템플릿 | 값 | 비고 |
| --- | --- | --- | --- |
| `placeOrder(uint64,bytes32)` | `LOGICAL_POLICY` (And) | 자식 1: `AGENT_OKRW_TRANSFER_LIMIT_POLICY` (값은 8004 `TransferLimit`) / 자식 2: `PERIODIC_VOLUME_POLICY` 운영 500,000 OKRW / 2,592,000초, 데모 60,000 OKRW / 3,600초 | 한 셀렉터에 PolicySet 하나만이라 And로 묶는다. 자식에는 셀렉터를 넣지 않는다 (확인). 테스트넷 전역 정책은 TransferLimit를 검사하지 않으므로 여기에 건다 (확인) |
| `placeOrderFromVault(uint64,uint256,bytes32)` | 위와 같음 | 위와 같음 | 모드 V일 때만 |
| `registerMerchant(bytes32,string)` | `EAS_POLICY` | KYB 스키마 UID | sender(=가게 payout) 검사. attestation은 `indexAttestation`으로 인덱싱돼야 인정 (확인). 스키마와 attester는 Q-07 |
| 전역 | KYC 한도 | 건당 2,000,000, 하루 10,000,000 OKRW | 이미 적용됨. 에이전트 전송은 소유자 하루 누적에 합산 (확인) |
| 2단계 | `ALLOW_LIST_POLICY` | 에이전트 송금처 = 주문 컨트랙트 | 테스트넷 v0.11.1 미등록 (확인). 등록되면 추가 |

토큰 이름은 `"atokrw"` (테스트넷 denom, 설정값 `OKRW_DENOM`). 실제 등록된 템플릿은 적용 전에 `IPcl.policyTemplate(templateId)`로 확인한다. 제거된 `OKRW_EAS_*` 템플릿은 쓰지 않는다 (`UnknownPolicyType`). 정책 인코딩은 tech-spec "5.6 붙일 정책"의 예시를 따르되 PolicySet, LogicalPolicy의 Solidity 타입과 enum 값은 `IPcl.sol` ABI에서 가져온다 (미확인, Q-13).

## revert 매핑 (tech-spec 3.6과 같은 코드)
| revert | AppErrorCode | 사용자에게 |
| --- | --- | --- |
| `ExceededAgentTransferLimit(maxLimit, value)` | `CHAIN_AGENT_LIMIT` | 건당 한도 초과, 승인 요청(레벨 상향) |
| `ExceededPeriodicVolume(maxLimit, value, resetAt)` | `CHAIN_PERIODIC_LIMIT` | 30일 상한, `resetAt`을 Asia/Seoul로 표시 |
| `AgentTransferLimitMetadataInvalid(reason)` | `CHAIN_AGENT_LIMIT_UNSET` | 설정 미완료. 서버가 TransferLimit 재기록 후 1회 재시도, 실패 시 운영자 알림 |
| 전역 KYC 한도 거절 (에러 이름 미확인) | `CHAIN_KYC_LIMIT` | 소유자 KYC 필요 |
| `EasNoAttestationReceived`, `EasAttestationRevoked`, `EasAttestationExpired` | `CHAIN_EAS_REQUIRED` | 가게 KYB 없음 또는 만료 |
| `Unauthorized()` | `CHAIN_UNAUTHORIZED` | 권한 오류, 운영자 알림 |
| 컨트랙트 `AgentIsPaused()` | `CHAIN_AGENT_PAUSED` | 동결 상태 |
| 컨트랙트 `MerchantNotActive(id)` | `CHAIN_MERCHANT_INACTIVE` | 주문할 수 없는 가게 |
| 잔액 부족, MAWS `INSUFFICIENT_BALANCE` | `CHAIN_INSUFFICIENT_FUNDS` | 용돈(float) 부족 |
| MAWS `POLICY_REJECTED` | `MAWS_POLICY_REJECTED` | 지갑 규칙 |
| 그 밖 | `INTERNAL` | 원본은 `error.detail.chain`에 |

정확한 revert 이름은 테스트넷에서 확인 후 이 표와 tech-spec 3.6을 함께 고친다.

## 반드시 지킬 규칙 (MUST)
- 체인 ID와 주소는 설정 파일에서만 읽는다. 테스트넷 체인 ID(450815)는 바뀔 예정이다 (확인). 부팅 시 `eth_chainId`와 대조한다.
- 정책값은 `policy.ts` 한곳, 프로필(`POLICY_PROFILE=default|demo`)로 고른다. 체인에 적용된 값과 다르면 `pnpm policy:apply --check`가 실패해야 한다.
- **`changeContractPolicies`는 전체 교체다** (확인). 항상 `contractPolicies`로 현재 값을 읽고 전체 배열을 다시 만든다. 빠뜨린 항목은 조용히 지워진다.
- **정책 admin은 처음 `changeContractPolicies`를 호출한 주소로 한 번만 정해진다** (확인). 프록시 배포 직후 같은 스크립트에서 운영자 키로 첫 호출을 한다. admin 키를 잃으면 정책을 영구히 못 바꾼다.
- 정책 변경 절차: `policy.ts` 수정, PR 리뷰, `pnpm policy:apply`, `contractPolicies` 조회로 확인, worklog 기록. 앱 배포는 필요 없다 (데모 리허설 추가 장면).
- `resetAt`은 unix 초. 표시할 때 Asia/Seoul로 변환.
- preflight와 `simulateContract`는 사용자 경험용이다. 컨트랙트 범위 정책이 시뮬레이션에서 재현되는지는 미확인 (Q-14). 결과를 보장으로 다루지 않는다.
- 정책 관리자도 컨트랙트 범위 정책(VOLUME, EAS, 컨트랙트 범위 DENY)을 우회할 수 없다 (확인). 운영자 계정 테스트에서도 정책이 걸린다고 가정한다.

## 하지 말 것 (MUST NOT)
- MAWS `spendingLimit`, `allowedTargets`, `status`를 체인 보호로 설명하지 않는다. 체인은 이 값을 읽지 않는다 (확인).
- 컨트랙트 범위 한도를 "멤풀 전 차단"으로 설명하지 않는다.
- 빈 셀렉터 정책을 걸지 않는다. 전역 정책을 바꾸려 하지 않는다. 제거된 템플릿을 쓰지 않는다.

## 확장 지점
- `LOGICAL_POLICY`로 "KYC된 소유자는 30일 상한 완화" 같은 조합 (EAS Or PERIODIC).
- `FOR_EACH_POLICY`로 소유자 단위 30일 합산 (동작 미확인, Q-06).

## 테스트 기준
- 1주차 테스트넷 실험: 테스트 컨트랙트에 정책을 걸고 초과 시 revert, 가스 과금, 블록 포함을 탐색기에서 확인 (roadmap 게이트).
- revert 매핑 단위 테스트 (녹화한 revert 데이터).
- `policy:apply --check`가 불일치를 잡는다. 전체 교체로 항목이 빠지는 실수를 잡는 테스트.

## 열린 질문
- Q-04 `changeContractPolicies` 인자·권한, Q-05 30일 주기 시작 시점, Q-06 `FOR_EACH_POLICY` 소유자 합산, Q-08 체인 ID·Mock KYC 전환, Q-13 PolicySet 타입, Q-14 시뮬레이션 재현

## 관련 문서
- `docs/_research/maroo-facts.md` 3장, 4.1
- `contracts.md`, `payment.md`, `maroo/facts.md`
- `docs/tech-spec.md` "3.6 에러 코드와 드래곤 대사", "3.9 체인 읽기와 인덱서", "5.6 붙일 정책"
