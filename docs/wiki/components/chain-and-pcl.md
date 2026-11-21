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
- 설정 파일: `packages/shared/src/config/chain.ts` (네트워크별), `packages/shared/src/config/policy.ts` (정책값, 프로필), `packages/shared/src/config/deployments/<chainId>.<profile>.json` (배포 주소, `deployments.ts`가 검증하고 `deployments-data.ts`가 등록).
- 배포 도구: `infra/` (`@sikyeoyong/infra`, `infra/scripts/deploy-orders.ts`, `apply-policy.ts`. Node 22.18 이상에서 TS를 직접 실행).
- 프리컴파일: PCL `0x1000000000000000000000000000000000000005`, Agent `0x100000000000000000000000000000000000000A`, IdentityRegistry `0x8004000000000000000000000000000000000001` (확인), SchemaRegistry `0x1000000000000000000000000000000000000006` (미확인, tech-spec 7.2에만 있음). 이것도 설정 파일에 둔다.
- 읽기 클라이언트는 viem. 서버만 체인을 읽는다.
- 다른 모듈은 `modules/chain/chain.service.ts`의 `ChainReader`(`CHAIN_READER` 토큰)로만 체인 값을 받는다. 지금은 `periodicVolume`(30일 사용량과 resetAt 초)만 있다. `PAYMENT_PATH=B`이면 실제 체인에서 읽는다(`modules/chain/onchain-chain-reader.ts`, 아래 "30일 사용량 읽기"). `PAYMENT_PATH=mock`이면 목 결제의 창(`mockPeriodicVolume`, 결제하면 차고 기간이 끝나면 비워짐)을, 그 밖의 개발 경로는 빈 창(0, null)을 읽고, production은 진짜 viem 읽기가 붙기 전까지 INTERNAL로 실패한다 (지어낸 체인 값을 보이지 않게). `contractPeriodicVolume` 반환 모양은 (미확인). 같은 모듈의 `ORDER_EVENTS` 토큰(`order-events.ts`)은 프록시의 `OrderPlaced` 로그를 구간으로 읽어 주는 포트이고, 읽은 로그를 주문에 반영하는 쪽은 orders의 `OrderIndexer`다(`payment.md`). 경로 B에서만 값이 있고 목 경로와 프록시 없는 개발 설정은 `null`.

## 배포 (확인, 2026-11-20 테스트넷 실제 실행)
`pnpm contracts:deploy:testnet --profile <default|demo>`는 `infra/scripts/deploy-orders.ts`를 `OPERATOR_KEY`(환경에서만, 출력하지 않음)로 돌린다. `--force` 없이는 `deployments/<chainId>.<profile>.json`이 있으면 멈춘다. `--max-spend <OKRW>`(기본 300)를 넘길 쓰기는 보내기 전에 멈춘다.
1. `forge build`, 구현 컨트랙트 배포 (viem `deployContract`).
2. `deployPclProxy({ kind: UUPS, logic, initializer })`. initializer는 `initialize(operator, owner, false)`이고 배포 트랜잭션에서 원자적으로 실행된다. 프록시는 `PclProxyDeployed` 이벤트에서 읽는다.
3. 확인: `pclProxy(proxy)`(kind 2, admin = 운영자), `isPclProxy`, `owner()`, `operator()`.
4. `changeContractPolicies`: `placeOrder(uint64,bytes32)` 하나에 And(`policy.agentOkrwTransferLimit()`, `policy.periodicVolume`). 값은 `policy.ts` 프로필. default는 `registerMerchant(bytes32,string)`에 `policy.eas`를 더한다(`KYB_SCHEMA_UID` 필요, Q-07). demo는 EAS 없음 (D-33).
5. `contractPolicies`를 다시 읽어 요청과 같은지 대조하고, 풀어 쓴 요약과 `policyHash`를 배포 기록에 넣는다.
쓰기마다 먼저 eth_call과 estimateGas로 시뮬레이션한다. 실패하면 멈추고 자동 재시도하지 않는다. `pnpm policy:apply --profile <p>`는 현재 정책을 읽어 `policy.ts`와 비교하고 다르면 전체를 다시 쓴다. 체인에 우리가 관리하지 않는 셀렉터가 있으면 지워지므로 멈춘다. `--check`는 비교만 하고 다르면 종료 코드 1이다.

배포 기록은 `packages/shared/src/config/deployments/<chainId>.<profile>.json`이고 `deployments-data.ts`에 import 한 줄을 더해 등록한다. API는 `resolveOrdersContract(DEPLOYMENTS, chainId, profile, ORDERS_CONTRACT)`로 읽고 `ORDERS_CONTRACT` 환경변수가 있으면 그 값이 이긴다.

| 항목 | 테스트넷 demo 프로필 (2026-11-20) |
| --- | --- |
| 구현 | `0xf3091258a7ecee5a1b71577a573690bcdf8914e6`, 블록 23814924, tx `0x7f148a42...bae323` |
| 프록시 (`ORDERS_CONTRACT`) | `0x36713c60A8b4E54b56997553aD4b8b16d7C02Db8`, 블록 23814926, tx `0x6d31a8de...527f8a` |
| 정책 | `placeOrder` And(건당 한도, 60,000 OKRW / 3,600초), 블록 23814928, tx `0xf7682258...767636` |
| 운영자, owner, 정책 admin | `0xBb71B672BC33745283842ce701F5b0FC28d023d3` (지금은 같은 주소, 2단계에 분리) |
| 가스 | 합계 22.16 tOKRW |

전체 tx 해시는 배포 기록 JSON에 있다. 정책 admin은 `deployPclProxy` 호출자로 배포와 동시에 정해진다 (아래 규칙, F-20).

## 에이전트 연결과 30일 사용량 읽기 (확인, 2026-11-21 테스트넷 실제 실행)
- **8004 연결**: 운영자가 `register()`로 에이전트 id를 얻으면 그 시점의 지갑은 운영자다. 에이전트 EOA를 지갑으로 바꾸는 `setAgentWallet(agentId, newWallet, deadline, signature)`를 소유자(운영자)가 보내고, 서명은 `newWallet`(에이전트 키)이 `AgentWalletSet(agentId, newWallet, owner, deadline)`(EIP-712, 도메인 `ERC8004IdentityRegistry` v1)으로 한다. 연결 뒤 `getAgentWallet(agentId)`는 에이전트 주소, Agent 프리컴파일 `getAgentIds(에이전트 주소)`는 그 id, `getAgentIds(운영자)`에는 그 id가 없다. TransferLimit은 이 연결 뒤에 `AGENT_OKRW_TRANSFER_LIMIT_POLICY`가 읽었다 (한도 10,000 OKRW에서 9,000 통과, 500으로 낮춘 뒤 1,000은 `ExceededAgentTransferLimit`, 한도 값 500 OKRW가 revert 인자에 실렸다).
- **30일 사용량**: `contractPeriodicVolume(proxy, 에이전트 주소, 0x62dac134, "atokrw", 주기 초, false)`가 `{ amount, maxAmount, resetPeriodSeconds, resetAt }[]`를 돌려준다. 에이전트 지갑에 9,000 OKRW가 세졌고 운영자 주소는 0이었다 (사용량은 직접 sender 기준). 아직 센 것이 없을 때의 응답(빈 배열인지 0 값인지)은 구분해 보지 않았다. 코드는 둘 다 "창 없음"(`resetAt` null)으로 읽는다 (추론).
- **주기 시작 (Q-05)**: 3,600초 주기에서 `resetAt`이 첫 주문 시각 + 주기가 아니라 **주기의 배수(유닉스 시각 기준)로 맞춰진 경계**였다. 첫 실행: 주문 블록 시각 1795189972, `resetAt` 1795190400(= 3600 x 498664). 목 체인(`MockPaymentProvider`)과 웹 목 클라이언트도 이 규칙(창 시작 = floor(now/주기) x 주기, 리셋 = 시작 + 주기)으로 맞췄다. 확인은 3,600초뿐이고 30일 주기는 (추론)이다. 둘째 실행: 주문 1795190481, `resetAt` 1795194000(= 3600 x 498665). 30일(2,592,000초)도 같은 방식이면 창은 달력 월도 첫 주문도 아닌 1970-01-01부터 2,592,000초씩 끊은 구간이다 (추론, 3,600초만 시험).

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
| `registerMerchant(bytes32,string)` | `EAS_POLICY` (default 프로필만. demo는 정책 없음, D-33) | KYB 스키마 UID | demo: EAS 없이 payout 지갑이 `kybUid=0x0`으로 호출해 통과했다 (확인, 2026-11-21, 테스트넷 46곳 등록, `merchants.md`). default: sender(=가게 payout) 검사. attestation은 `indexAttestation`으로 인덱싱돼야 인정 (확인). 스키마와 attester는 Q-07 |
| 전역 | KYC 한도 | 건당 2,000,000, 하루 10,000,000 OKRW | 이미 적용됨. 에이전트 전송은 소유자 하루 누적에 합산 (확인) |
| 2단계 | `ALLOW_LIST_POLICY` | 에이전트 송금처 = 주문 컨트랙트 | 테스트넷 v0.11.1 미등록 (확인). 등록되면 추가 |

토큰 이름은 `"atokrw"` (테스트넷 denom, 설정값 `OKRW_DENOM`). 실제 등록된 템플릿은 적용 전에 `IPcl.policyTemplate(templateId)`로 확인한다. 제거된 `OKRW_EAS_*` 템플릿은 쓰지 않는다 (`UnknownPolicyType`). 정책 인코딩은 공식 SDK `@maroo-chain/viem`의 `policy.*`와 `PolicySet`에 맡긴다. Solidity 타입과 enum 값을 직접 쓰지 않는다 (확인, Q-13 닫힘). `AGENT_OKRW_TRANSFER_LIMIT_POLICY`는 값 없는 정책이다.

## revert 매핑 (tech-spec 3.6과 같은 코드. 문구와 HTTP 상태의 원본은 `packages/shared` `APP_ERRORS`)
| revert | AppErrorCode | 사용자에게 |
| --- | --- | --- |
| `ExceededAgentTransferLimit(maxLimit, value)` | `CHAIN_AGENT_LIMIT` | 건당 한도 초과, 승인 요청(건당 한도 올리기, D-31) |
| `ExceededPeriodicVolume(maxLimit, value, resetAt)` | `CHAIN_PERIODIC_LIMIT` | 30일 상한, `resetAt`을 Asia/Seoul로 표시 |
| `AgentTransferLimitMetadataInvalid(reason)` | `CHAIN_AGENT_LIMIT_UNSET` | 설정 미완료. 서버가 TransferLimit 재기록 후 1회 재시도, 실패 시 운영자 알림 |
| 전역 KYC 한도 거절 (에러 이름 미확인) | `CHAIN_KYC_LIMIT` | 소유자 KYC 필요 |
| `EasNoAttestationReceived`, `EasAttestationRevoked`, `EasAttestationExpired` | `CHAIN_EAS_REQUIRED` | 가게 KYB 없음 또는 만료 |
| `Unauthorized()` | `CHAIN_UNAUTHORIZED` | 잠시 후 다시 시도 (서버 설정 문제), 운영자 알림 |
| `VolumeAboveMaxLimit(maxLimit, value)` (건당 `VOLUME_POLICY`의 에러) | `CHAIN_KYC_LIMIT` | 소유자 KYC 필요. 전역 KYC 한도가 이 템플릿이라고 보는 것은 (추론, Q-15) |
| 컨트랙트 `AgentNotBound()`, `BadAmount()`, `OrderExists(orderRef)`, `TransferFailed()` | `INTERNAL` | 표에 없다. 재시도 전에 `findPaid`로 확인 (D-19) |
| 컨트랙트 `AgentIsPaused()` | `CHAIN_AGENT_PAUSED` | 용이가 자고 있어요 |
| 컨트랙트 `MerchantNotActive(id)` | `CHAIN_MERCHANT_INACTIVE` | 주문할 수 없는 가게 |
| 잔액 부족, MAWS `INSUFFICIENT_BALANCE` | `CHAIN_INSUFFICIENT_FUNDS` | 용돈(float) 부족 |
| MAWS `POLICY_REJECTED` | `MAWS_POLICY_REJECTED` | 용이 규칙에 걸렸어요 |
| 그 밖 | `INTERNAL` | 잠시 후 다시 시도. 원본 revert는 `AppError.detail.chain`에 담아 서버 로그에만 (응답에는 없음) |

정확한 revert 이름은 테스트넷에서 확인 후 이 표와 tech-spec 3.6을 함께 고친다. 코드: `apps/api/src/common/onchain/revert-decoder.ts`(`decodeChainFailure`). viem 오류의 `cause` 사슬에서 revert 바이트를 찾아 우리 컨트랙트 에러와 SDK의 `Abis.errors`로 풀고, 바이트가 없으면 노드의 "insufficient funds" 문구를 `CHAIN_INSUFFICIENT_FUNDS`로 본다 (확인: `ExceededAgentTransferLimit(5,000 OKRW 한도)`와 `AgentIsPaused`는 테스트넷에서 이 경로로 풀렸다. 나머지 이름은 ABI 단위 테스트로만).

## 반드시 지킬 규칙 (MUST)
- 체인 ID와 주소는 설정 파일에서만 읽는다. 테스트넷 체인 ID(450815)는 바뀔 예정이다 (확인). 부팅 시 `eth_chainId`와 대조하고 다르면 부팅을 멈춘다 (`modules/chain/chain-id-guard.ts`의 `ChainIdGuard`, 경로 B에 배포된 프록시가 있을 때. RPC를 못 읽으면 production은 멈추고 개발은 경고).
- 정책값은 `policy.ts` 한곳, 프로필(`POLICY_PROFILE=default|demo`)로 고른다. 체인에 적용된 값과 다르면 `pnpm policy:apply --check`가 실패해야 한다.
- **`changeContractPolicies`는 전체 교체다** (확인). 항상 `contractPolicies`로 현재 값을 읽고 전체 배열을 다시 만든다. 빠뜨린 항목은 조용히 지워진다.
- **정책 admin은 한 번만 정해진다** (확인). 문서는 첫 `changeContractPolicies` 호출자라고 하지만, 실제로는 `deployPclProxy` 호출자가 배포와 동시에 admin이 된다 (확인, 2026-11-20, F-20). 같은 운영자 키로 배포하고 정책을 건다. admin 키를 잃으면 정책을 영구히 못 바꾼다.
- 정책 변경 절차: `policy.ts` 수정, PR 리뷰, `pnpm policy:apply`, `contractPolicies` 조회로 확인, worklog 기록. 앱 배포는 필요 없다 (데모 리허설 추가 장면).
- `resetAt`은 unix 초. 표시할 때 Asia/Seoul로 변환.
- preflight와 `simulatePclProxy`는 사용자 경험용이다. 컨트랙트 범위 정책(TransferLimit)은 시뮬레이션과 `estimateGas`에서 재현된다 (확인, 2026-11-21, Q-14 닫힘). 그래도 결과를 보장으로 다루지 않는다 (시뮬레이션과 실제 실행 사이에 상태가 바뀔 수 있다).
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
- Q-04 `changeContractPolicies` 인자·권한, Q-05 30일 주기(3,600초 주기는 확인, 30일은 추론), Q-06 `FOR_EACH_POLICY` 소유자 합산, Q-08 체인 ID·Mock KYC 전환 (Q-13, Q-14는 닫힘)

## 관련 문서
- `docs/_research/maroo-facts.md` 3장, 4.1
- `contracts.md`, `payment.md`, `maroo/facts.md`
- `docs/tech-spec.md` "3.6 에러 코드와 드래곤 대사", "3.9 체인 읽기와 인덱서", "5.6 붙일 정책"
