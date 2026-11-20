---
node: leaf
parent: _index.md
children: []
---

# 결제 (apps/api/src/modules/payment)

## 책임
- 주문 결제 실행: 에이전트가 `SikyeoyongOrders.placeOrder`를 직접 sender로 부르게 한다.
- 에이전트 생성과 8004 등록 대기, `TransferLimit` 메타데이터 기록(생성 직후, 레벨 변경 시).
- **즉시 충전(모드 P)**: 주문 직전에 에이전트 지갑의 float를 채운다. 회수(drain), 동결·해제.
- 체인 결과를 정규화된 에러 코드로 바꿔 돌려준다.

## 책임 아님
- 주문 내용·금액 계산 (orders 모듈. 금액은 메뉴 가격으로 서버가 계산)
- 정책 설정 (`chain-and-pcl.md`의 정책 적용 스크립트)

## 의존과 인터페이스 경계
인터페이스 전문은 tech-spec "3.4 PaymentProvider". 요지:
```ts
interface PaymentProvider {
  readonly path: 'A' | 'B' | 'C';
  createAgent(input): Promise<AgentWallet>;                 // 생성 + 8004 등록 대기
  setTransferLimit(agent, amount: bigint): Promise<Hex>;    // 8004 setMetadata("TransferLimit")
  fund(agent, amount: bigint): Promise<Hex>;                // 소유자 쪽 → 에이전트 지갑 (즉시 충전)
  drain(agent): Promise<Hex[]>;                             // 에이전트 지갑 → 소유자
  freeze(agent): Promise<Hex[]>;                            // MAWS freeze + 컨트랙트 setAgentPaused
  unfreeze(agent): Promise<Hex[]>;
  preflight(req: PayRequest): Promise<...>;
  pay(req: PayRequest): Promise<PayResult>;                 // placeOrder{value}
}
```
구현체는 경로별로 하나씩 (`pathA`, `pathB`, `pathC`, 테스트용 mock). 선택은 `PAYMENT_PATH` 환경 변수. 타입은 `packages/shared/src/payment`. 다른 모듈은 `modules/payment/payment.service.ts`의 `PAYMENT_PROVIDER` 토큰으로만 받는다 (llm은 payment를 import하지 못한다, 린트 경계).
- 부화(user-flow 4)는 `modules/agents/agent-setup.service.ts`: `createAgent`(지갑과 8004 등록) 뒤 `setTransferLimit`(레벨 건당 한도)를 기록하고 `agent_limit_history`와 ACTIVE를 한 트랜잭션으로 남긴다. 단계는 `agents.setup_step`(wallet, identity, limit, done, failed, 마이그레이션 0003). 실패하면 PENDING에 failed로 멈추고 `POST /agents/me/setup/retry`가 멈춘 자리부터 다시 한다. 아직: 본인 인증(D-16) 확인 뒤에만 부화, 프로세스가 죽었을 때 PENDING 이어 하기.
- `PAYMENT_PATH=mock`: `MockPaymentProvider`는 메모리 안의 흉내 체인이다 (개발·테스트 전용, production 설정은 거절). 지갑 잔액, TransferLimit, 30일 고정 창(첫 주문부터, (추론)), 동결, orderRef 한 번만을 흉내 내고, 막는 사유와 에러 코드는 아래 revert 매핑과 같다. 프로세스를 다시 띄우면 흉내 체인이 비어 TransferLimit이 없어지는데, 이것은 실제 `CHAIN_AGENT_LIMIT_UNSET` 복구 경로(재기록 후 1회 재시도)를 그대로 탄다. 경로 A, B, C는 컨트랙트와 체인 작업 때 붙이며, 그 전에는 모든 호출이 `INTERNAL`로 실패한다 (결제하지 않음).

## 경로 (D-05, 1단계는 B로 확정 D-24)
| 경로 | 조건 | PCL 적용 | 가스 |
| --- | --- | --- | --- |
| A (기본안) | MAWS가 컨트랙트 함수 호출(calldata) 지원 (미확인, Q-01) | 에이전트가 직접 sender. 컨트랙트 범위 정책 전부. 단 AA(EntryPoint 경유)에서 sender 귀속은 미확인 (Q-12, S12) | PAYMASTER (테스트넷 미확인, Q-03) |
| B (A 불가 시 1순위) | 서버가 에이전트 EOA 키를 암호화 저장(`AGENT_KEY_ENCRYPTION_KEY`, 2단계 KMS), 8004에 등록 | A와 같음 | 에이전트 지갑의 OKRW |
| C (최후) | `transfer.send`로 컨트랙트에 송금 + 서버가 등록한 intent와 매칭 | 셀렉터 없는 호출의 정책 적용 미확인 | PAYMASTER |
| mock | 단위 테스트, 앱 개발 | 없음 | 없음 |

경로를 바꿔도 `PaymentProvider` 위쪽 코드(orders, llm)는 바뀌지 않아야 한다. 영수증 규칙 계산만 `provider.path`를 읽는다.

## 모드 P와 float (D-06, 확인된 이유)
- 컨트랙트 범위 `AGENT_OKRW_TRANSFER_LIMIT_POLICY`는 직접 sender 귀속만 하고 실행 전 call value를 검사한다. 그래서 돈은 에이전트가 `msg.value`로 직접 낸다 (모드 P).
- 에이전트 지갑에는 **float = 레벨 건당 한도 × `AGENT_FLOAT_MULTIPLIER`(기본 2)** 만 둔다. 경로 B와 SELF 가스면 가스 몫을 더한다.
- 주문 직전 잔액이 주문 금액보다 적으면 서버가 소유자 쪽에서 `fund`로 채운다 (Just-in-time). 채우는 금액은 float 상한을 넘지 않는다.
- 결과: AI나 유출된 키가 직접 송금으로 빼돌릴 수 있는 최대치는 float다. 이게 데모 장면 7의 정직한 문장이다 (E-5).
- 모드 V(선불)는 스파이크 S10에서 "컨트랙트가 내보낸 지급도 에이전트 한도로 집계된다"가 확인될 때만 쓴다.

## 반드시 지킬 규칙 (MUST)
- **금액은 `bigint` aokrw.** 변환은 `packages/shared`의 함수만.
- **orderRef 멱등성**: `orderRef`(bytes32)는 서버가 주문 생성 시 한 번 만든다(DB 주문 ID의 keccak). 같은 orderRef로는 체인에서 한 번만 결제된다 (`OrderExists`). 재시도는 같은 orderRef로만.
- **자동 재시도 금지**: 서버는 결제를 스스로 다시 보내지 않는다. 타임아웃이나 네트워크 오류는 `submitting`으로 두고 결론이 날 때까지 결제하지 않는다. 결론이 나서 재시도 가능한 `failed`가 된 주문만, 사람이 confirm을 다시 눌렀을 때 체인 조회 뒤 같은 orderRef로 다시 시도한다 (아래 "confirm 상태 규칙"). 예외: `CHAIN_AGENT_LIMIT_UNSET`은 TransferLimit 재기록 후 같은 요청 안에서 1회.
- **TransferLimit 먼저**: 에이전트를 만들면 주문 가능 상태로 표시하기 전에 `TransferLimit`을 기록한다. 없으면 정책을 건 컨트랙트에서 `AgentTransferLimitMetadataInvalid`로 실패한다 (확인된 동작에서 추론).
- **즉시 충전은 서버 코드만**: `fund`는 LLM 도구가 아니다. 주문 서비스가 결제 직전에 부르거나, 사용자가 버튼으로 부른다.
- **가스 한도 고정 금지**: 추정값을 쓴다. 가스 한도의 절반은 무조건 과금된다 (확인). 컨트랙트 범위 정책에 막힌 트랜잭션도 가스가 과금된다 (확인).
- **에러 정규화**: revert 이름을 `packages/shared` 에러 코드로 바꾼다. 매핑 표는 `chain-and-pcl.md`.
- 경로 A에서 MAWS `allowedTargets`는 주문 컨트랙트 주소 하나로 고정한다 (D-13). 소유자 주소는 MAWS가 항상 허용한다.
- 모든 체인 트랜잭션 해시를 `wallet_txs`, `orders`에 저장하고 탐색기 링크를 만들 수 있게 한다.

## confirm 상태 규칙 (D-19, 이 절이 원본)
결제는 `POST /api/orders/:id/confirm`에서만 일어나고, 주문 상태로 멱등하다. 같은 주문의 confirm은 몇 번이 와도 결제는 많아야 한 번이다 (경로 A, B는 `OrderExists`가 체인에서 한 번 더 보장한다. 경로 C는 Q-24). 상태 전이는 모두 조건부 UPDATE 하나(`WHERE id = ? AND status = ?`)로 해서 동시에 온 요청 중 하나만 이긴다. 진 요청은 결제하지 않고 200과 현재 주문을 받는다.

### confirm이 상태별로 하는 일
| 주문 상태 | confirm이 하는 일 | 응답 |
| --- | --- | --- |
| `quoted` | `quoted`에서 `submitting`으로 바꾼다. 이긴 요청만 사전 검사, 즉시 충전, `pay`로 간다. 결과는 아래 "실패 분류"대로 상태를 바꾼다 | 결제 결과 |
| `submitting` | 결제하지 않는다 (동시에 들어온 요청, 결과를 기다리는 중) | 200, 현재 주문 |
| `failed` 재시도 가능 | 먼저 체인에서 `OrderPlaced(orderRef)`를 조회한다. 있으면 `paid`로 맞추고 영수증을 만든다. 없으면 `failed`에서 `submitting`으로 바꾸고 **같은 orderRef로** 결제한다 (사람이 누른 재시도) | 결제 결과 또는 200, 현재 주문 |
| `failed` 재시도 불가 | 결제하지 않는다. 새 견적이 필요하다고 알린다 | 200, 현재 주문 (`error_code` 포함) |
| `pending_approval` | 결제하지 않는다. 승인 흐름이 먼저다 | 200, 현재 주문 |
| `paid`, `preparing`, `delivering`, `delivered`, `cancelled`, `refunded` | 결제하지 않는다 | 200, 현재 주문과 영수증 |

### 승인 흐름과의 관계
- 사전 검사나 체인이 승인이 필요한 사유(`SERVER_OVER_LEVEL`, `SERVER_NEW_MERCHANT`, `SERVER_BUDGET_OVER`, `CHAIN_AGENT_LIMIT`)로 막으면 주문은 `failed`가 아니라 `pending_approval`로 간다. 그래서 승인 전에 다시 눌러도 결제하지 않는다 (같은 revert와 가스 과금이 반복되지 않는다).
- `pending_approval` 전이와 `approvals` 행 생성(`order_id`로 묶음, 10분 만료)은 approvals 모듈이 내보낸 서비스 함수 하나가 같은 DB 트랜잭션에서 한다. LLM `place_order`, `request_owner_approval`, confirm 세 경로가 모두 이 함수를 쓴다. 그래서 승인 행 없이 `pending_approval`에 묶인 주문은 생기지 않는다.
- **승인된 사유는 그 주문의 confirm에서 다시 막지 않는다**: confirm 사전 검사는 그 주문(`order_id`)에 승인된 approvals 행이 있으면 그 행의 사유만큼 통과시킨다. 레벨 상향과 가게 허용은 조치 자체가 남아서 다시 걸리지 않는다. 예산 초과(`SERVER_BUDGET_OVER`)는 남는 조치가 없으므로, 승인된 행의 금액이 주문 금액과 같을 때만 예산 검사를 건너뛴다. 금액이 다르면(가격이 바뀌어 새 견적) 그 승인은 쓰지 않는다. 그래서 승인 뒤 confirm이 같은 사유로 다시 `pending_approval`에 빠지는 반복이 없다.
- 주인이 승인하면 서버는 필요한 조치(레벨 상향, 가게 허용)를 한다. 레벨 상향이면 TransferLimit 갱신 트랜잭션이 **확정된 뒤에** 주문을 `pending_approval`에서 `quoted`로 되돌리고 확인 카드를 다시 보낸다 (먼저 되돌리면 다시 revert되고 가스가 든다). `POST /api/approvals/:id/approve`는 결제하지 않는다. **결제는 다시 confirm에서만** 한다.
- 거절, 또는 만료(approvals 모듈의 주기 작업이 1분마다 `expires_at`이 지난 대기 승인을 `expired`로 바꾼다)면 묶인 주문은 재시도 불가 `failed` (`error_code`는 원래 사유).

### 실패 분류 (tech-spec 3.6의 모든 코드)
| 분류 | 코드 | 주문 상태 |
| --- | --- | --- |
| 승인 필요 | `SERVER_OVER_LEVEL`, `SERVER_NEW_MERCHANT`, `SERVER_BUDGET_OVER`, `CHAIN_AGENT_LIMIT` | `pending_approval` |
| 재시도 가능 (체인에 orderRef가 남지 않은 확정 실패. 조건이 바뀌면 같은 주문으로 결제 가능) | `CHAIN_INSUFFICIENT_FUNDS`, `CHAIN_AGENT_LIMIT_UNSET`, `MAWS_POLICY_REJECTED`, `CHAIN_PERIODIC_LIMIT`, `CHAIN_KYC_LIMIT`, `CHAIN_AGENT_PAUSED`, `SERVER_FROZEN`, `CHAIN_UNAUTHORIZED`, 제출 전에 확정된 거절로 난 `INTERNAL`(예: MAWS가 오류 코드로 답함, 외부 레이트 리밋) | `failed` (재시도 가능) |
| 재시도 불가 (이 주문은 성립하지 않음) | `CHAIN_MERCHANT_INACTIVE`, `CHAIN_EAS_REQUIRED`, `NOT_FOUND`(가게나 메뉴가 사라짐), `SERVER_PRICE_CHANGED` | `failed` (재시도 불가) |
| 결과 모름 | 제출 시작 표시 뒤에 난 `INTERNAL`, 타임아웃, 응답 없음, 네트워크 오류 (tx hash가 없어도), 분류에 없는 모든 것 | `submitting` 유지 |
| 주문과 무관 | `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`(우리 API의 레이트 리밋) | 바꾸지 않음 (전이 전에 거절) |

- 기본값은 "결과 모름"이다. 모르는 코드나 애매한 실패로 새 견적을 만들게 하지 않는다.
- 견적 유효 시간은 1단계에 없다. 대신 confirm 사전 검사가 매번 items의 현재 메뉴 가격 합을 다시 계산해서 `orders.amount`와 다르면 결제하지 않고 `SERVER_PRICE_CHANGED`(재시도 불가)로 바꾼 뒤 새 견적을 만들게 한다 (시안 user-flow "가격이 바뀌면 다시 확인"). 재시도할 때도 같은 검사를 하므로 옛 가격으로 결제되지 않는다.
- 재시도 불가 뒤 새 견적을 만들기 전에 이전 orderRef를 확인한다: 이전 제출 트랜잭션이 있었다면 그 트랜잭션이 확정(영수증 있음)되었고 `OrderPlaced(orderRef)`가 없어야 한다. 아직 확정되지 않았으면 새 견적을 막고 기다린다.

### `submitting`을 끝내는 규칙
- 인덱서가 `OrderPlaced(orderRef)`를 보면 `paid`.
- 제출 트랜잭션의 영수증이 revert면 그 사유로 위 분류를 따른다.
- **제출 시작 표시와 순서**: 표시는 체인이나 MAWS에 무엇이든 내보내기 **전에** DB에 커밋한다.
  - 경로 B: nonce 예약 → 서명 → (`submit_tx_hash`, `submit_nonce`, `submit_started_at`)를 DB에 커밋 → 그다음 브로드캐스트.
  - 경로 A: `maws_request_id`를 만들어 `submit_started_at`과 함께 DB에 커밋 → 그다음 MAWS 호출.
  - 표시가 없는 `submitting` 주문(시작 시 재확인 포함)은 "제출 전"이다. 근거: 브로드캐스트와 MAWS 호출은 표시 커밋 뒤에만 하므로, 표시 전에 죽었다면 서명된 트랜잭션도 내보내지지 않았다. 이 경우 재시도 가능 `failed`.
  - 표시가 있으면 tx hash 유무와 상관없이 위 "결과 모름" 규칙을 따른다.
  - 저장 칸: tech-spec 4 `orders`의 `attempt`, `submit_started_at`, `submit_tx_hash`, `submit_nonce`, `maws_request_id`.
- 제출 전에 확정된 거절(MAWS나 WaaS가 오류 코드로 답함, 서명이나 브로드캐스트 전 단계 예외)은 재시도 가능 `failed`.
- 제출 시작 표시 뒤의 타임아웃, 응답 없음은 tx hash가 없어도 `submitting`으로 두고 운영자 확인으로 넘긴다. hash 없음을 "제출 안 됨"으로 보지 않는다.
- 같은 nonce가 다른 트랜잭션으로 소비된 경우는 인덱서 DB가 아니라 그 nonce를 쓴 트랜잭션의 영수증 로그를 체인에서 직접 조회해서 판단한다. `OrderPlaced(orderRef)`가 없을 때만 재시도 가능 `failed`.
- `submitting`이 `SUBMITTING_ALERT_MS`(설정값, 기본 10분) 넘게 결론이 없으면 운영자에게 알린다. 상태는 사람이 확인할 때까지 그대로 둔다 (자동으로 `failed`로 바꾸지 않는다).
- 서버가 시작할 때 `submitting`인 주문을 모두 다시 확인한다 (프로세스가 `pay` 전후에 죽은 경우).
- 사전 검사 실패는 `submitting`으로 바꾼 뒤에 나도 위 분류대로 상태를 바꾼다 (제출 전이므로 결과 모름이 아니다).

### 즉시 충전(fund)의 멱등성
- 충전 요청 ID는 (orderRef, 시도 번호)에서 만든다. 시도 번호는 사람이 confirm을 다시 눌러 결제를 시작할 때마다 하나 늘린다. 한 시도 안에서는 충전이 많아야 한 번이다.
- 충전에도 같은 순서로 제출 시작 표시를 먼저 쓴다 (tech-spec 4 `wallet_txs`의 `request_id`, `order_id`, `attempt`, `submit_started_at`, `nonce`, `maws_request_id`). 표시가 있는데 결론이 없는 충전이 있으면 다시 충전하지 않고 기다린다 (결과 모름). 잔액 계산에는 확정된 충전만 넣고, 새 충전 금액은 float 상한에서 확정 잔액과 결과 모름 충전을 뺀 만큼을 넘지 않는다. 그래서 재시도가 반복돼도 float 상한을 넘지 않는다.
- 확정된 충전 뒤 다른 주문이 잔액을 써서 `CHAIN_INSUFFICIENT_FUNDS`가 나면, 다음 시도(새 시도 번호)에서 다시 충전한다.

### 경로별 중복 orderRef 보호
- 경로 A, B: `placeOrder`가 같은 orderRef의 두 번째 결제를 `OrderExists`로 되돌린다 (tech-spec 5.2 의사 코드, 컨트랙트 테스트로 확인할 것).
- 경로 C(`transfer.send` + 미리 등록한 의도): 같은 orderRef로 두 번 보냈을 때 컨트랙트 `receive()`가 두 번째를 막는지 (미확인). Q-24. **Q-24가 닫힐 때까지 경로 C에서는 `failed` 재시도를 하지 않는다** (재시도 가능 실패도 새 견적으로 보내고, 새 견적 전 이전 제출 확정 확인을 따른다).

- `CHAIN_AGENT_LIMIT_UNSET` 예외: 첫 트랜잭션의 영수증이 이 사유의 revert로 **확정된 뒤에만**, 서버가 TransferLimit을 재기록하고(확정 대기) 같은 요청 안에서 같은 orderRef로 한 번 더 보낸다. 경로 A, B만. 경로 C는 Q-24 전까지 하지 않는다.
- 409(`CONFLICT`)는 confirm 상태 때문에 쓰지 않는다. 같은 멱등 키에 다른 내용일 때만이다.

## 하지 말 것 (MUST NOT)
- 임의 주소로 보내는 함수를 어댑터에 만들지 않는다. 나가는 곳은 주문 컨트랙트, 소유자 주소(drain), 8004(메타데이터)뿐이다.
- float 상한을 넘게 충전하지 않는다.
- 실패한 주문을 작은 금액으로 쪼개 다시 보내지 않는다.
- 경로 B의 에이전트 키를 로그, DB 평문, 에러 메시지에 남기지 않는다.
- MAWS preflight 통과를 "결제 보장"으로 다루지 않는다 (오프체인, 확인).

## 확장 지점
- 다른 지갑(파우치 등)은 `PaymentProvider` 구현 추가로.
- VP 비공개 주문(2단계)은 `PrivatePaymentProvider`로 따로 두고, 감사 공개 범위를 설정으로.

## 소유자 서명 포트 (D-24)
- 소유자만 할 수 있는 일(TransferLimit 기록, `bindAgent`, `setAgentPaused` 멈춤과 해제, 회수, 충전)은 `OwnerAuthority`(가칭) 포트 하나로만 부른다. 결제 경로(A, B, C)와는 따로다.
- 구현 두 개: `CustodialOwner`(지금, 운영자 키로 서버가 서명, 수탁)와 `PouchOwner`(나중, 사용자 파우치 지갑에 서명을 요청, 비수탁). `OWNER_MODE=custodial|pouch`로 고른다.
- `PouchOwner`에서는 서버가 서명하지 못한다. 서버는 트랜잭션을 만들어 웹에 넘기고, 웹이 파우치 SDK로 사용자 재인증 후 서명한다. 그래서 소유자 일을 하는 API는 지금부터 "준비(prepare)"와 "결과 반영(confirm)" 두 단계로 나눠 둔다. custodial에서는 서버가 두 단계를 바로 이어서 한다.
- 주문, 대화, 화면 코드는 어느 구현인지 몰라야 한다.

## 테스트 기준
- 경로별 통합 테스트(테스트넷): 정상 주문, 건당 초과, 30일 초과(데모 프로필), 미등록 가게, 동결된 에이전트, 같은 orderRef 두 번.
- 즉시 충전: 잔액 부족 시 충전 후 결제, 충전액이 float 상한을 넘지 않음.
- 타임아웃 시 중복 결제 0건.
- mock 구현으로 서버·앱 단위 테스트가 체인 없이 돈다.

## 열린 질문
- Q-01 MAWS calldata 지원 (경로 결정), Q-03 테스트넷 PAYMASTER, Q-10 모드 V 집계(S10), Q-12 AA 귀속(S12)
- 경로 B 키 저장 방식 (KMS 사용 가능 여부는 서버 위치에 따라 다름, `infra.md`)

## 관련 문서
- `chain-and-pcl.md`, `contracts.md`, `security.md`
- `docs/tech-spec.md` "3.4 PaymentProvider", "9.1 에이전트 탈출"
