---
node: leaf
parent: _index.md
children: []
---

# 마루 핵심 사실 (요약)

원본과 출처는 `docs/_research/maroo-facts.md`. 이 문서는 자주 쓰는 숫자와 결론만 모은다. 새 사실을 알게 되면 원본에 먼저 쓰고 여기 요약을 고친다.

## 숫자와 주소
| 항목 | 값 | 상태 |
| --- | --- | --- |
| 최소 단위 | 10^18 aokrw = 1 OKRW, 테스트넷 denom `atokrw` | 확인 |
| 테스트넷 체인 ID | 450815 (변경 예정, 시점 미정) | 확인 |
| 테스트넷 Cosmos chain-id | `maroo-testnet-1` | 확인 |
| WebSocket | `wss://ws-testnet.maroo.io` | 확인 |
| RPC | `https://rpc-testnet.maroo.io` | 확인 |
| 탐색기 | `https://explorer-testnet.maroo.io` | 확인 |
| Faucet | `https://faucet.maroo.io` | 확인 |
| PCL 프리컴파일 | `0x1000000000000000000000000000000000000005` | 확인 |
| Agent 프리컴파일 | `0x100000000000000000000000000000000000000A` (읽기 전용) | 확인 |
| IdentityRegistry (8004) | `0x8004000000000000000000000000000000000001` | 확인 |
| 전역 KYC 한도 (미인증) | 건당 2,000,000, UTC 하루 10,000,000 OKRW | 확인 |
| 30일 | 2,592,000초 | 계산 |
| 단순 전송 가스 | 약 22,300, 가스 한도 절반은 무조건 과금 | 확인 |
| 에이전트 등록 | PENDING에서 ACTIVE까지 1~3분 | 확인 |
| 소유권 이전 TTL | 24시간 | 확인 |

## 결론 (설계에 쓰는 것)
1. MAWS 규칙(`spendingLimit`, `allowedTargets`, `status`)은 MAWS만 강제한다. 체인은 읽지 않는다. (확인)
2. 체인이 강제하는 에이전트 한도는 `TransferLimit` 하나. 단 **테스트넷 전역 정책은 이걸 검사하지 않는다.** 우리 컨트랙트 범위에 `AGENT_OKRW_TRANSFER_LIMIT_POLICY`를 건다. (확인)
3. 컨트랙트 범위의 `AGENT_OKRW_TRANSFER_LIMIT_POLICY`는 직접 sender 귀속만 한다. 에이전트가 직접 `placeOrder`를 불러야 한다. (확인)
4. `TransferLimit` 메타데이터가 없거나 32바이트가 아니면 `AgentTransferLimitMetadataInvalid`. 생성 직후 기록. (확인/추론)
5. `PERIODIC_VOLUME_POLICY`는 초 단위 고정 주기, (scope, sender, denom)별 누적. 달력 월 아님. (확인/추론)
6. 에이전트 전송은 소유자의 하루 누적(전역 KYC 한도)에 합산된다. (확인)
7. `ALLOW_LIST_POLICY`는 테스트넷 v0.11.1에 미등록. 수신자 직접 제한은 아직 못 한다. (확인)
8. 정책 관리자도 컨트랙트 범위 정책을 우회할 수 없다. (확인)
9. MAWS가 컨트랙트 함수를 호출할 수 있는지, 멀티테넌트가 되는지, 테스트넷 PAYMASTER가 되는지는 문서에 없다. (미확인)
10. MAWS 소셜 로그인은 Kakao, Google, Naver, Apple. 컨테이너는 `WAAS_AUTH_TOKEN`. (확인)
11. OKRW는 네이티브. 결제 함수는 `payable`. ERC-20 approve 흐름 없음. (확인)
12. 전역 정책은 RPC 제출 시점에 거절(브로드캐스트 안 됨, 가스 없음). 컨트랙트 범위 정책은 실행 중 평가되어 revert되지만 블록에 남고 가스가 과금된다. "멤풀 전 차단"은 전역 정책에만 맞는 말이다. (확인)
13. `EAS_POLICY`는 트랜잭션 sender만 검사한다. attestation은 `indexAttestation`으로 인덱싱돼야 인정된다. (확인)
14. 한 셀렉터에는 PolicySet 하나. 여러 규칙은 `LOGICAL_POLICY`로 묶고 자식에는 셀렉터를 넣지 않는다. (확인)
15. 컨트랙트 정책 admin은 처음 `changeContractPolicies`를 호출한 주소로 한 번만 정해지고, `changeContractPolicies`는 전체 교체다. (확인)
16. 선불(vault) 구조에서 컨트랙트가 내보낸 지급이 에이전트 TransferLimit로 집계되는지는 미확인. 그래서 모드 P가 기본. (미확인, S10)
