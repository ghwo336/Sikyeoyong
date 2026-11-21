---
node: leaf
parent: _index.md
children: []
---

# 결제 (apps/api/src/modules/payment)

## 책임
- 주문 결제 실행: 에이전트가 `SikyeoyongOrders.placeOrder`를 직접 sender로 부르게 한다.
- 에이전트 생성과 8004 등록 대기, `TransferLimit` 메타데이터 기록(생성 직후, 한 번에 쓸 돈 변경 시, D-31).
- **즉시 충전(모드 P)**: 주문 직전에 에이전트 지갑의 float를 채운다. 회수(drain), 동결·해제.
- 체인 결과를 정규화된 에러 코드로 바꿔 돌려준다.

## 책임 아님
- 주문 내용·금액 계산 (orders 모듈. 금액은 메뉴 가격으로 서버가 계산)
- 정책 설정 (`chain-and-pcl.md`의 정책 적용 스크립트)

## 의존과 인터페이스 경계
인터페이스 전문은 tech-spec "3.4 PaymentProvider". 요지:
```ts
interface PaymentProvider {
  readonly path: 'A' | 'B' | 'C' | 'mock';
  createAgent(input): Promise<AgentWallet>;                 // 생성 + 8004 등록 대기
  setTransferLimit(agent, amount: bigint): Promise<Hex>;    // 8004 setMetadata("TransferLimit")
  bindAgent(agent): Promise<Hex>;                           // 컨트랙트 bindAgent (소유자만, OwnerAuthority로만 부름)
  fund(agent, amount: bigint): Promise<Hex>;                // 소유자 쪽 → 에이전트 지갑 (즉시 충전)
  drain(agent): Promise<Hex[]>;                             // 에이전트 지갑 → 소유자
  freeze(agent): Promise<Hex[]>;                            // 컨트랙트 setAgentPaused (경로 A면 MAWS freeze도)
  unfreeze(agent): Promise<Hex[]>;
  preflight(req: PayRequest): Promise<{ ok: true } | { ok: false; error: DecodedChainError }>;
  pay(req: PayRequest): Promise<PayResult>;                 // placeOrder{value}
  findPaid(orderRef): Promise<{ txHash; blockNumber } | null>; // confirm 재시도 전 체인 확인 (D-19)
  receiptOf(txHash): Promise<ReceiptOutcome>;               // 기록한 제출 해시의 영수증: success, reverted(사유), unknown
  balanceOf(address): Promise<bigint>;                      // 즉시 충전 계산
}
// DecodedChainError = { code: AppErrorCode; params?: { max?, resetAt? } }
```
구현체는 경로별로 하나씩 (`pathA`, `pathB`, `pathC`, 테스트용 mock). 선택은 `PAYMENT_PATH` 환경 변수. 타입은 `packages/shared/src/payment`. 다른 모듈은 `modules/payment/payment.service.ts`의 `PAYMENT_PROVIDER` 토큰으로만 받는다 (llm은 payment를 import하지 못한다, 린트 경계).
- 부화(user-flow 4)는 `modules/agents/agent-setup.service.ts`: `createAgent`(지갑과 8004 등록) 뒤 `OWNER_AUTHORITY`로 `bind`, 이어서 `setTransferLimit`(에이전트 행의 `per_order_limit`, 만들 때 `policy.perOrderLimit.initial` 10,000원, D-31)를 기록하고 (둘 중 하나라도 사용자 서명을 기다리면 ACTIVE로 바꾸지 않는다) `agent_limit_history`와 ACTIVE를 한 트랜잭션으로 남긴다. 단계는 `agents.setup_step`(wallet, identity, limit, done, failed, 마이그레이션 0003). 실패하면 PENDING에 failed로 멈추고 `POST /agents/me/setup/retry`가 멈춘 자리부터 다시 한다. 아직: 본인 인증(D-16) 확인 뒤에만 부화, 프로세스가 죽었을 때 PENDING 이어 하기.
- `PAYMENT_PATH=mock`: `MockPaymentProvider`는 메모리 안의 흉내 체인이다 (개발·테스트 전용, production 설정은 거절). 지갑 잔액, TransferLimit, 주기 창(경계가 유닉스 시각의 주기 배수, 체인 관찰과 같음. 3,600초에서만 확인, 30일은 (추론)), 동결, orderRef 한 번만을 흉내 낸다. 거절 순서는 실제 결제가 실패하는 순서다: 제출(잔액 부족은 `CHAIN_INSUFFICIENT_FUNDS`, 아무것도 실행되지 않음) → 프록시 preCall(한도 미설정, 건당 한도, 30일 상한. 본문보다 먼저라는 것은 maroo-facts 3.5 preCall에서 (추론)) → 컨트랙트 본문, tech-spec 5.2 `placeOrder` 의사 코드 순서대로 동결(`AgentIsPaused`), `BadAmount`(0원 이하, 표에 없어 `INTERNAL`), `OrderExists`(표에 없어 `INTERNAL`). 코드는 `chain-and-pcl.md` revert 매핑과 같다. 데모 모드(`DEMO_MODE`)에서는 경로 B처럼 가스 몫(`AGENT_GAS_SHARE_OKRW`)을 충전에 더해 주머니에 남긴다 (가스는 쓰지 않음, 돌려받기를 보이기 위함). 흉내 범위 밖: 묶이지 않은 에이전트(`AgentNotBound`), 가게 활성 여부(`MerchantNotActive`), 가스. 프로세스를 다시 띄우면(nest watch 재빌드 포함) 흉내 체인은 부팅 때 DB에서 되살린다 (`mock-chain-state.repository.ts` 읽기 전용, `MockPaymentProvider.restore`, QA 5차): 지갑 주소는 agents 행, TransferLimit은 `setupStep=done`인 ACTIVE·FROZEN 에이전트의 `per_order_limit`, 멈춤은 FROZEN, 주머니 잔액은 용돈 장부(fund 빼기 refund)에서 결제된 주문 합을 뺀 값(0 미만이면 0, 근사), 30일 창과 `findPaid`는 결제된 주문(txHash 있음)에서 만든다 (창 계산은 주문 만든 시각 기준 근사). production에서는 되살리지 않는다 (mock 자체가 거절). 한계: 블록 번호와 트랜잭션 해시 순번은 새로 매겨진다. 경로 A와 C는 붙이기 전까지 모든 호출이 `INTERNAL`로 실패한다 (결제하지 않음). 경로 B는 아래 "경로 B 구현".

## 경로 (D-05, 1단계는 B로 확정 D-25)
| 경로 | 조건 | PCL 적용 | 가스 |
| --- | --- | --- | --- |
| A | MAWS가 컨트랙트 함수 호출(calldata) 지원. MCP로는 불가 (확인, D-25, spikes/S1), WaaS API 직접 호출은 (미확인, Q-01) | 에이전트가 직접 sender. 컨트랙트 범위 정책 전부. 단 AA(EntryPoint 경유)에서 sender 귀속은 미확인 (Q-12, S12) | PAYMASTER (테스트넷 미확인, Q-03) |
| B (A 불가 시 1순위) | 서버가 에이전트 EOA 키를 암호화 저장(`AGENT_KEY_ENCRYPTION_KEY`, 2단계 KMS), 8004에 등록 | A와 같음 | 에이전트 지갑의 OKRW |
| C (최후) | `transfer.send`로 컨트랙트에 송금 + 서버가 등록한 intent와 매칭 | 셀렉터 없는 호출의 정책 적용 미확인 | PAYMASTER |
| mock | 단위 테스트, 앱 개발 | 없음 | 없음 |

경로를 바꿔도 `PaymentProvider` 위쪽 코드(orders, llm)는 바뀌지 않아야 한다. 영수증 규칙 계산만 `provider.path`를 읽는다.

## 경로 B 구현 (2026-11-21, 테스트넷 실제 결제까지 확인)
`modules/payment/managed-eoa.provider.ts`의 `ManagedEoaPaymentProvider`(`PAYMENT_PATH=B`, 기본값). viem과 `@maroo-chain/viem@0.5.0`을 쓴다. 클라이언트는 `PublicPort`, `WalletPort`라는 좁은 포트로 받아 테스트에서 가짜로 바꾼다 (`managed-eoa.provider.spec.ts`, 네트워크 없음). 실제 연결은 `managed-eoa.factory.ts`(OPERATOR_KEY, `AgentKeyVault`, `resolveOrdersTarget`).

- **생성 (`createAgent`)**: 키를 `agent_keys`에 먼저 저장 → 운영자가 8004 `register()`(영수증의 `Registered` 이벤트에서 `agentId`, 받는 즉시 `agent_keys.onchain_agent_id`에 저장, 마이그레이션 0011) → 이미 `getAgentWallet(agentId)`가 에이전트 주소면 연결을 건너뛰고, 아니면 에이전트 키가 EIP-712 `AgentWalletSet(agentId, newWallet, owner, deadline)`에 서명(도메인은 레지스트리의 `eip712Domain()`, deadline은 체인 시각 + 240초) → 운영자가 `setAgentWallet(agentId, 에이전트 주소, deadline, 서명)` → `getAgentWallet(agentId)`가 에이전트 주소인지 확인. 이 연결이 있어야 `AGENT_OKRW_TRANSFER_LIMIT_POLICY`가 보낸 사람을 그 에이전트로 본다 (확인, maroo-facts 2). 각 단계는 이어 하기가 되고 두 번 해도 안전하다: 같은 agents 행으로 다시 부르면 저장된 키와 저장된 8004 id를 재사용해 `register()`를 두 번 부르지 않고(고아 id가 쌓이지 않는다), 이미 연결됐으면 `setAgentWallet`도 다시 보내지 않는다. 키는 돈이 들어 있을 수 있어 버리지 않는다.
- **`setTransferLimit`**: 운영자가 `setMetadata(agentId, "TransferLimit", abi.encode(uint256))`. **`bindAgent`, `freeze`, `unfreeze`**: 운영자가 프록시의 `bindAgent`, `setAgentPaused`(운영자가 묶은 소유자라 부를 수 있다). **`fund`**: 운영자가 에이전트 주소로 보내는 네이티브 전송, 다른 주소로는 보내지 않는다. 운영자 쓰기는 한 번에 하나, 영수증을 받은 뒤 다음 것 (한 nonce 줄, `lanes.ts`).
- **`drain`**: 에이전트 키로 (잔액 - 최악의 수수료)를 소유자(운영자)에게 보낸다. 수수료도 못 내는 잔액이면 보내지 않는다. 수수료 몫 약 1 OKRW가 남는다 (확인, 실행 기록).
- **`preflight`**: 잔액이 금액보다 적으면 `CHAIN_INSUFFICIENT_FUNDS`, 아니면 SDK `simulatePclProxy`로 에이전트를 보낸 사람으로 `placeOrder{value}`를 시뮬레이션한다. 컨트랙트 범위 정책도 시뮬레이션에서 재현된다 (확인, Q-14 닫힘). revert 이름은 `common/onchain/revert-decoder.ts`가 chain-and-pcl.md 표대로 `DecodedChainError`로 바꾼다.
- **`pay`** (`PayRequest.beforeBroadcast`): `estimateGas`(가스 한도는 추정값 그대로) → nonce(`pending`, 에이전트별 한 줄) → 서명 → **해시와 nonce를 `beforeBroadcast`로 호출자에게 넘겨 DB에 남기게 한 뒤** → `sendRawTransaction`을 한 번만 → 영수증 대기. 추정 단계에서 정책이 거절하면 서명도 전송도 없이 `{ ok: false, stage: 'preflight' }`(가스 없음). 노드가 잔액 부족으로 거절하면 `stage: 'submit'`. 영수증이 revert면 같은 호출을 그 블록에서 다시 실행해 사유를 읽고 `stage: 'execution'`과 `txHash`로 돌려준다 (실제 체인에서 revert가 영수증까지 간 경우는 아직 만들어 보지 못했다. 추정 단계가 먼저 거절한다). 그 밖의 전송 실패, 영수증 시간 초과(90초), 영수증은 성공인데 이 orderRef의 `OrderPlaced`가 없음은 **던진다**(결과 모름, confirm이 `submitting`으로 둔다). 자동 재시도는 없다.
- **`findPaid`**: 프록시의 `OrderPlaced(orderRef)` 로그를 배포 블록부터 조회.
- **가스 몫**: 경로 B는 페이마스터가 없어 에이전트 지갑이 가스를 낸다. 제공자의 `gasReserveAokrw`(`AGENT_GAS_SHARE_OKRW`, 기본 100 OKRW, 최대 1,000 OKRW로 zod가 막는다, D-25)를 confirm의 즉시 충전이 금액에 더해 채운다 (`order-confirm.service.ts` `topUp`, 장부 `fund`에도 가스 몫이 섞여 기록된다. 가스 몫을 용돈에서 뺄지는 Q-38과 함께 정한다). 실측: `placeOrder` 478,058 가스, 가스 가격 9,000 gwei에서 약 4.3 OKRW라 기본 100 OKRW는 약 20배 여유다 (확인). 가스 몫은 float(D-06)이라 크게 두지 않는다.
- **프로덕션**: `OPERATOR_KEY`, `AGENT_KEY_ENCRYPTION_KEY`, 배포된 프록시(`ORDERS_CONTRACT` 또는 배포 기록) 중 하나라도 없으면 부팅이 멈춘다. 개발과 테스트에서는 결제하지 않는 제공자(모든 호출 `INTERNAL`)로 떨어져 나머지 앱은 돈다.
- **체인 읽기**: `ChainReader`는 `contractPeriodicVolume`(`modules/chain/onchain-chain-reader.ts`, chain-and-pcl.md).
- **실제 실행** (owner-run, 실제 테스트넷 트랜잭션): `pnpm e2e:path-b -- --run`. 결과 기록은 worklog 2026-11-21.

## 영수증 (2026-11-21)
주문이 `paid`가 되는 네 전이(confirm 정산, 실패한 주문을 다시 눌렀을 때 체인에서 이미 결제된 것을 찾은 confirm 재시도, 부팅 재확인, 인덱서)는 모두 `modules/orders/order-receipts.service.ts`의 `OrderReceipts.markPaid`를 지난다. 상태 변경과 같은 UPDATE로 `orders.receipt_json`(shared `zOrderReceipt`)을 쓰고, `GET /orders/:id`가 `OrderView.receipt`로 내보낸다. 내용: 용이 신분증 번호(8004 agentId, 없으면 영수증을 쓰지 않는다), 통과한 규칙(서버 층 3개: 멈춤 아님, 내 30일 한도, 새 가게 허락. 체인 층 3개: `AGENT_OKRW_TRANSFER_LIMIT_POLICY`, `PERIODIC_VOLUME_POLICY`, 전역 KYC 한도), 탐색기 링크(shared 체인 설정. 목 체인 결제는 해시가 어느 체인에도 없으므로 `explorerUrl`을 쓰지 않는다, `OrderReceipt.explorerUrl`은 선택, QA 6차). 정책 이름은 자세히 보기 안에서만 보인다. paid가 된 주문은 서버 규칙을 통과했고 체인이 실행했으므로 목록은 통과한 것뿐이다 (추론: 승인으로 풀린 규칙도 그 승인 뒤 통과). 목 체인(`PAYMENT_PATH=mock`)은 체인 층을 "건당 한도 (흉내 체인)", "30일 한도 (흉내 체인)" 둘만 쓰고 KYC는 쓰지 않는다 (흉내 내지 않은 검사를 통과했다고 하지 않는다). 영수증을 못 만들어도(예: 신분증 번호 없음) 결제된 주문의 paid 전이는 막지 않는다. 블록 번호는 영수증 칸에 아직 없다. 웹 영수증 화면은 체인 층 규칙만 "통과한 마루 규칙"으로 보인다.

## 모드 P와 float (D-06, 확인된 이유)
- 컨트랙트 범위 `AGENT_OKRW_TRANSFER_LIMIT_POLICY`는 직접 sender 귀속만 하고 실행 전 call value를 검사한다. 그래서 돈은 에이전트가 `msg.value`로 직접 낸다 (모드 P).
- 에이전트 지갑에는 **float = 그 에이전트의 한 번에 쓸 돈 × `AGENT_FLOAT_MULTIPLIER`(기본 2)** (`floatCapAokrw(perOrderLimitAokrw, multiplier)`, D-31. 서버의 충전 코드는 아직 이 함수를 부르지 않는다) 만 둔다. 경로 B와 SELF 가스면 가스 몫을 더한다.
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
- 코드 (2026-11-20): `modules/approvals/approvals.service.ts`의 `openWithOrder(input, writeOrder)`. 주문 쓰기(새 주문 삽입 또는 `pending_approval` 전이)와 승인 행을 SQLite 트랜잭션 하나로 묶는다. 주문 쓰기가 던지거나 승인 행이 거절되면(주문당 대기 승인 하나, `approvals_pending_order_uq`) 둘 다 남지 않는다. 사유 매핑은 `approvalReasonOf`(`SERVER_OVER_LEVEL`과 `CHAIN_AGENT_LIMIT`은 `OVER_LEVEL_LIMIT`, `SERVER_NEW_MERCHANT`는 `NEW_MERCHANT`, `SERVER_BUDGET_OVER`는 `OVER_PERSONAL_BUDGET`). 의존 방향은 orders에서 approvals 한쪽뿐이다.
- 승인과 거절 API (2026-11-20): `modules/owner-approvals`(approvals와 orders를 잇는 모듈, 둘 다 서로를 모른다). 결정과 주문 효과는 `ApprovalsService.decide`의 트랜잭션 하나다: 승인 행 `pending`에서 결정으로 조건부 UPDATE(진 결정은 아무것도 쓰지 않음) → 가게 허용(`NEW_MERCHANT`만, `allowed_merchants`) → 주문 `pending_approval`에서 `quoted`(승인) 또는 재시도 불가 `failed`(거절, 만료. `error_code`는 사유의 `SERVER_*`). 승인 응답은 주문과 다시 만든 확인 카드(`quote`)다. 결제하지 않는다.
  - 예산 초과 승인은 조치가 없다. 승인된 행 자체가 허락이고, confirm이 같은 금액일 때만 건너뛴다.
  - 건당 한도 초과(`OVER_LEVEL_LIMIT`, 이름만 남은 코드)는 여기서 승인하지 않는다 (400). 한 번에 쓸 돈을 올리는 일은 TransferLimit 기록과 재인증이 필요해서 `PUT /agents/me/limits`가 맡는다 (D-28, D-31). 한도를 올린 뒤 기다리던 주문은 `POST /orders/:id/requote`(orders 모듈 `OrderRequoteService`, 2026-11-20)가 다시 견적으로 만든다: 살아 있는 `OVER_LEVEL_LIMIT` 승인이고 금액이 지금 한 번에 한도 안이면 승인을 approved로 닫고 주문을 quoted로 되돌린다(`decide`와 `reopen` 한 트랜잭션). 결제하지 않고, confirm이 규칙을 다시 본다. 같은 호출은 그 사용자의 다른 대기 주문도 같은 규칙으로 훑는다(QA 6차: 올린 한도에 이제 맞는 것만 quoted로, 아직 넘는 것과 다른 사유는 그대로).
  - 만료(10분)는 지금 읽을 때(`GET /approvals`)와 결정할 때 처리한다. 아직: 1분 주기 작업(`@nestjs/schedule` 도입), 한도 올리기와 승인 연결(`approvalId`).
- 배달 진행 흉내 (2026-11-20): 배달 정보(delivery 모듈)가 아직 없어서, 목 체인이나 데모 모드이면 `GET /orders/:id`가 결제된 주문의 단계를 시간으로 정한다(예상 도착까지의 15%까지 주문 넣음, 45%까지 만드는 중, 도착 전까지 배달 중, 그 뒤 도착, `orders/order-view.ts` `deliveryStatus`). 저장된 상태는 paid 그대로다. 운영(DEMO_MODE 꺼짐, mock 아님)에서는 저장된 상태만 보인다 (`order-delivery.spec.ts`가 조건을 지킴).
- 목 체인의 30일 사용량 (2026-11-20): `PAYMENT_PATH=mock`이면 개발용 체인 읽기(`chain/chain-reader.factory.ts`)가 목 결제의 30일 창(`mockPeriodicVolume`)을 읽어 (창 경계는 첫 주문 + 주기가 아니라 floor(now/주기) x 주기 + 주기, 2026-11-21 체인에 맞춤), 결제하면 예산 화면과 지갑 화면의 30일 줄이 찬다. 운영은 여전히 진짜 리더 전까지 거절한다.
- 즉시 충전과 주인 용돈 장부 (2026-11-20): confirm의 즉시 충전(`topUp`)이 성공하면 채운 부족분을 allowance 모듈 장부에 `fund`로 기록한다(지갑 화면 "주인님 용돈"이 줄어든다). 충전이 실패하거나 필요 없으면 기록하지 않는다. 충전은 됐는데 장부 기록이 실패하면 결제는 그대로 진행하고 서버 로그(사용자, tx)로 맞춘다(돈은 이미 움직였으므로 결제를 실패로 바꾸지 않는다). 장부가 모자랄 때 (Q-38, 2026-11-21): DEMO_MODE가 아니면 충전 전에 장부를 보류(확인과 `fund` 기록이 한 트랜잭션)하고, 덮지 못하면 `CHAIN_INSUFFICIENT_FUNDS`("용돈이 모자라용")로 거절한다(충전 호출 없음). 충전이 안 나갔으면 보류를 되돌리고, 호출이 던졌으면 돈이 나갔을 수 있어 보류를 남긴다(대사 대상). DEMO_MODE는 막지 않고 충전 성공 뒤에 기록한다.
- 용이 한 마리의 결제는 한 번에 하나 (2026-11-21): confirm의 점검, 잔액 읽기, 즉시 충전, 결제를 `AgentLock`(동결, 동결 해제, 회수와 같은 용이별 대기열) 안에서 돌린다. 다른 주문 두 건이 같은 잔액을 읽고 둘 다 충전하거나 안 하는 일, 동결이나 회수가 "동결인지 확인"과 충전 사이에 끼는 일을 막는다. 대가로 결제가 느리면 같은 용이의 동결 요청이 그 차례 뒤에 처리된다.
- 대기열에는 상한이 있다 (2026-11-21): 차례를 기다리는 시간과 차례를 쥐는 시간이 각각 120초(`AGENT_LOCK_WAIT_MS`, `AGENT_LOCK_HOLD_MS`)를 넘지 않는다. 멈춘 RPC 하나가 동결을 영원히 막지 못하게 하려는 것이다. 기다리다 시간이 다 되면 그 작업은 시작도 하지 않고 호출자가 `RATE_LIMITED`(`AgentLockTimeout`, 사유 `agent busy`)를 받는다. 쥐고 있다 시간이 다 되면 차례만 다음 사람에게 넘기고 호출자는 같은 오류를 받는다. 돌던 작업은 취소하지 않는다(나간 결제를 되돌릴 수 없다). 결제 쪽 규칙은 그대로다: 제출 시작 표시 뒤에 시간이 다 되면 주문은 기록된 `submitting`으로 남고 다시 보내지 않는다(결과 모름, D-19). 표시 전이면 아무것도 나가지 않았으므로 `failed`(재시도 가능)로 닫는다. 이때 옛 작업은 아직 돌 수 있고 사람이 다시 눌러 새 시도가 시작될 수 있으므로, 막는 것은 `submitting` 상태가 아니라 시도 번호다(2026-11-21). 누를 때마다 `orders.attempt`가 오르고(새 열 없음), 그 시도의 모든 쓰기(충전 표시와 되돌림, 제출 표시, 서명 해시, 결제 완료, 실패 정리, 승인 전환)는 같은 시도 번호일 때만 반영된다. 옛 시도는 다음 쓰기에서 멈추고 방송 전에 끝난다(충전 호출이 이미 나갔다면 그 충전은 되돌리지 않는다). 그 밖의 겹쳐 막는 장치: 체인의 orderRef 유일성(같은 orderRef는 한 번만 결제됨), 주문별 충전 표시(결과 없는 표시는 다시 충전하지 않음), 체인 멈춤. 과충전 위험은 float(D-06) 안으로 한정된다. 동결, 회수를 기다리던 사람은 `RATE_LIMITED`를 받고 다시 누르면 된다. 쥐기 상한이 지난 뒤에도 옛 작업은 돌고 있을 수 있으므로, 동결, 동결 해제, 한도 변경은 그 작업의 체인 호출과 겹칠 수 있다(서버 점검은 이미 지났을 수 있고, 동결 뒤 나간 결제는 체인 한도와 멈춤이 막는다).
- 장부 기록의 실체인 경로 전 할 일 (검증 MINOR, 2026-11-20): 지금(목 체인, 프로세스 하나)은 용이별 잠금과 잔액 차이로 이중 기록을 막는다. 실체인 경로를 붙일 때는 (1) refund와 fund 금액을 drain, fund tx의 실제 전송액(영수증이나 이벤트)으로 기록하고(가스가 차이에 섞이지 않게), (2) txHash를 refund, fund 기록의 유일 열쇠로 두어 tx는 됐는데 기록 전에 실패한 경우를 그 txHash로 맞추고, (3) drain은 체인 멈춤이 성공한 뒤에만 열어 진행 중인 결제가 차이에 섞이지 않게 한다.
- **승인된 사유는 그 주문의 confirm에서 다시 막지 않는다**: confirm 사전 검사는 그 주문(`order_id`)에 승인된 approvals 행이 있으면 그 행의 사유만큼 통과시킨다. 한 번에 쓸 돈 올리기와 가게 허용은 조치 자체가 남아서 다시 걸리지 않는다. 예산 초과(`SERVER_BUDGET_OVER`)는 남는 조치가 없으므로, 승인된 행의 금액이 주문 금액과 같을 때만 예산 검사를 건너뛴다. 금액이 다르면(가격이 바뀌어 새 견적) 그 승인은 쓰지 않는다. 그래서 승인 뒤 confirm이 같은 사유로 다시 `pending_approval`에 빠지는 반복이 없다.
- 주인이 승인하면 서버는 필요한 조치를 한다. 가게 허용과 예산 초과는 `POST /api/approvals/:id/approve`가, 한 번에 쓸 돈 올리기는 `PUT /api/agents/me/limits`가 한다(재인증과 TransferLimit 기록이 필요해서, D-21, D-28, D-31). 코드 (2026-11-20): `modules/limits/limits.service.ts`의 `setLimits`(검사, 재인증, `AgentLock`)와 `modules/agents/agent-limit.service.ts`의 `write`(체인 기록). 두 값 모두 범위와 단위(`isInRange`) 밖이면 `VALIDATION_FAILED`, 바꾼 뒤 한 번에 쓸 돈이 30일에 쓸 돈보다 크면 `VALIDATION_FAILED`(D-31, 2026-11-20, 아무것도 쓰지 않는다), 멈춘 용이의 한 번에 쓸 돈 변경은 `SERVER_FROZEN`, 부화가 안 끝났으면 `CHAIN_AGENT_LIMIT_UNSET`, 같은 값은 쓰기 없음, 올리기(둘 중 하나라도)는 `REAUTH_MODE=none`일 때만(pouch는 지갑 서명 전까지 거절), `OwnerAuthority`로 TransferLimit을 먼저 쓰고 확정된 뒤에만 `agents.per_order_limit`와 `agent_limit_history`를 한 트랜잭션으로 바꾼다. 30일에 쓸 돈은 그다음 서버에만 쓴다(이것만 바뀌면 `txHash` null). 소유자 서명이 필요하면(`signer: user`) 아무것도 바꾸지 않는다. 승인 주문을 다시 여는 일은 `POST /orders/:id/requote`(위)가 한다. TransferLimit 갱신 트랜잭션이 **확정된 뒤에** 부르므로 주문을 `pending_approval`에서 `quoted`로 되돌리고 확인 카드를 다시 보낸다 (먼저 되돌리면 다시 revert되고 가스가 든다). `POST /api/approvals/:id/approve`는 결제하지 않는다. **결제는 다시 confirm에서만** 한다.
- 거절, 또는 만료(10분. 지금은 `GET /approvals`와 결정 때 처리한다. 1분 주기 작업은 예정)면 묶인 주문은 재시도 불가 `failed` (`error_code`는 승인 사유의 서버 코드: `SERVER_OVER_LEVEL`, `SERVER_NEW_MERCHANT`, `SERVER_BUDGET_OVER`. 체인이 막은 `CHAIN_AGENT_LIMIT`로 연 승인도 `SERVER_OVER_LEVEL`로 남는다).

### confirm 코드 (2026-11-20)
- `modules/orders/order-confirm.service.ts`의 `OrderConfirmService.confirm`. 상태 전이는 모두 `OrdersRepository.transition(id, from, set)`(조건부 UPDATE 하나, 이겼는지 돌려줌)로만 한다. 실패 분류 표는 `modules/orders/failure-class.ts`(이 절의 표와 같다). 서버 규칙(30일 상한, 한 번에 쓸 돈, 처음 보는 가게, 내 30일 한도)은 견적과 confirm이 `OrderRules` 하나를 같이 쓴다.
- 이긴 요청만 이 순서로 간다: 사전 검사(부화, 멈춤, 가게, 지금 가격 다시 계산, 30일 상한, 승인 사유. 이 주문 금액 그대로 승인된 예산 초과는 건너뜀) → 부족분만 즉시 충전(`OwnerAuthority`의 `fund`, 사용자 서명을 기다리면 표시 전 `INTERNAL`로 재시도 가능 실패) → `preflight` → 제출 표시(`submit_started_at`) 커밋 → `pay`. 표시 전에 난 오류는 결제가 나가지 않았으니 재시도 가능 `failed`. 표시 뒤에는 `pay`가 **돌려준** 거절(`PayResult`)만 분류대로 상태를 바꾸고, **던진** 오류는 코드와 상관없이 `submitting` 유지(이미 나갔을 수 있다). `attempt`는 SQL에서 1 올린다(먼저 읽은 값을 쓰지 않음).
- 응답은 `{ order: OrderView }`(`zOrderResult`, `GET /orders/:id`도 같은 `OrderViews.viewFor`). 최근 주문 목록 `GET /orders`(`zOrderList`, 최대 20개, `quoted` 제외)도 `OrderViews.listFor`가 항목마다 같은 변환을 써서 목록과 상태 화면의 상태가 어긋나지 않는다. 실패면 `errorCode`, 결제되면 `txHash`가 붙는다. 도착 시각은 결제를 시작한 때(`submit_started_at`)부터 센다. 상태별 용이 대사와 표정은 `modules/orders/order-view.ts`(Done, Tracking, Arrived 시안 문구). 실패한 주문의 대사는 그 코드의 대사이고, 값(`{max}`, `{resetAt}`)이 필요한 대사는 값을 저장하지 않으므로 사람 문장(`message`)으로 대신한다.
- 경로 C는 실패 주문을 다시 결제하지 않는다 (Q-24). 가게의 `onchain_id`가 없으면(Q-34) 흉내 체인 밖에서는 `CHAIN_MERCHANT_INACTIVE`.
- 열린 주문 재사용 (2026-11-21, QA 6차): 견적(`OrderQuoteService.write`)은 규칙을 본 뒤, 같은 사용자·가게·메뉴와 수량·금액·메모의 열린 주문이 있으면 새로 만들지 않고 그 주문을 돌려준다(`orders.repository.openAt`). 승인을 기다리는 주문은 규칙이 아직 주인에게 묻고 승인이 살아 있을 때(만료 전), quoted 주문은 규칙이 이제 묻지 않고 만든 지 승인 시한(10분) 안일 때만 재사용한다. 그 밖(다른 메뉴, 만료, 규칙이 바뀜, 가격이 바뀜, 다른 사용자)은 새 주문이다. 그래서 추천 카드를 다시 눌러도 승인이 겹쳐 생기지 않는다. 같은 `clientOrderId`의 재전송은 전과 같다.
- 견적 때 한도 (2026-11-21): 주문이 견적을 만들 때 그 시점의 한 번에 쓸 돈(`per_order_limit_at_quote`)과 체인 공통 30일 상한(`period_cap_at_quote`)을 저장한다(마이그레이션 0013, aokrw 문자열, 그 전 주문은 null). 한도를 올린 뒤 `requote`가 주문을 견적으로 되돌릴 때는 한 번에 쓸 돈을 올린 값으로 다시 쓴다. `GET /orders/:id`, confirm 답의 `OrderView.limitsAtOrder`(shared `zOrderView`, 선택 칸)로 나가며 영수증이 "그때" 값을 보일 수 있다. 칸이 없으면(옛 주문) 화면은 "지금" 값을 그대로 쓴다. 웹의 영수증 화면은 이 칸이 있으면 그때 값을, 없으면 지금 값을 "지금" 표시로 보인다. 승인(새 가게, 예산)으로 다시 열리는 주문은 처음 견적 값을 그대로 둔다.
- 충전 멱등성은 주문 단위로 있다 (아래 "즉시 충전(fund)의 멱등성" 코드 줄). 충전이 던지면 결제 전이라 재시도 가능 `failed`가 되고, 같은 주문을 다시 눌러도 결과 모를 충전은 반복하지 않는다. 아직: `CHAIN_AGENT_LIMIT_UNSET` 뒤 TransferLimit 재기록 1회 예외, float 상한(한 번에 쓸 돈 × `AGENT_FLOAT_MULTIPLIER`, `floatCapAokrw`) 유지, (서버 시작 때 `submitting` 재확인과 인덱서, 인덱서 커서 저장은 위 코드대로 있음) `DEMO_BYPASS_SERVER_LIMIT`.

### 견적 (`POST /orders`, `place_order`, 2026-11-20 코드)
- `modules/orders/order-quote.service.ts`의 `OrderQuoteService.create`. 결제하지 않는다. 아래 순서로 본다.
  1. 부화 전(ACTIVE도 FROZEN도 아님)이면 `CHAIN_AGENT_LIMIT_UNSET`, 멈췄으면 `SERVER_FROZEN`. 그다음 가게(없으면 `NOT_FOUND`, 미인증·비활성·영업 외면 `CHAIN_MERCHANT_INACTIVE`)와 메뉴(같은 메뉴 두 번은 400, 없거나 품절이면 `NOT_FOUND`)를 서버 값으로 매긴다. 여기서 거절되면 주문을 만들지 않는다.
  2. 체인 30일 상한: 지금 사용량 + 이 주문이 상한을 넘으면 `CHAIN_PERIODIC_LIMIT`(`resetAt` 포함). 승인으로 풀 수 없으니 주문을 만들지 않는다. 딱 상한까지는 통과.
  3. 승인 사유, 먼저 맞는 하나: 한 번에 쓸 돈 초과(에이전트에 저장된 금액과 비교, 코드 이름 `SERVER_OVER_LEVEL`은 그대로), 처음 보는 가게(`allowed_merchants`에 없고 그 가게 결제 주문도 없음, `SERVER_NEW_MERCHANT`. `DEMO_MODE`에서는 시드 가게를 허용한 가게로 친다, D-27), 이 주문으로 내 30일 한도 초과(D-31: 체인 30일 창의 사용량 `periodicVolume` + 금액 > 내 30일 한도, 달력 월이 아님. 딱 한도까지는 통과, `SERVER_BUDGET_OVER`). **내 30일 한도가 체인 공통 상한과 같으면 서버는 이 검사를 하지 않는다**: 같은 숫자를 체인이 지키므로 2번의 `CHAIN_PERIODIC_LIMIT`(체인 revert와 같은 사유)이 그대로 보인다 (데모 장면 14). 70%, 90% 잔소리는 두 경우 모두 같다. confirm의 다시 검사도 같은 규칙. 하나라도 맞으면 approvals `openWithOrder`로 `pending_approval` 주문과 승인 행을 함께 만들고 견적 카드는 보내지 않는다.
  4. 아니면 `quoted` 주문과 확인 카드(`OrderQuote`, `periodUsedAfter`는 체인 사용량 + 이 주문, `periodCap`은 내 30일 한도와 체인 상한 중 낮은 쪽, D-31, QA 5차).
- `orderRef`는 `keccak256(주문 ID의 UTF-8 바이트)` (`modules/orders/order-ref.ts`). ID만 있으면 다시 만들 수 있다.
- 처음 보는 가게 판정의 "결제 주문"은 그 사용자의 paid 이상만이다. quoted, failed, 승인 대기 주문은 치지 않는다 (새 `clientOrderId`로 다시 보내 승인을 건너뛰지 못하게).
- `clientOrderId`(`orders.client_order_id`, 사용자별 고유, 마이그레이션 0004): 같은 요청을 다시 보내면 규칙이 그사이 바뀌었어도 처음 만든 주문의 지금 상태를 돌려주고, 다른 요청이면 409. 동시에 온 두 요청은 고유 인덱스로 하나만 쓰이고 진 쪽도 같은 답을 받는다.
- 요청 메모(`note`, 최대 100자)는 `orders.note`에 저장하고 확인 카드의 `request`로 보낸다.
- `OrderQuoteService.create`는 `{ result, approvalReason }`을 돌려준다. `POST /orders`는 `result`만 보내고, LLM `place_order`는 승인 사유를 `APPROVAL_REQUIRED`와 함께 모델에 준다 (agent-runtime.md "코드").
- 다른 모듈은 `OrdersService.quote` 창구로만 견적을 만든다 (`OrderQuoteService`는 모듈 밖으로 내보내지 않는다).
- 아직: 같은 가게 60초 쿨다운(같은 가게, 같은 items의 살아 있는 `quoted` 주문이 있으면 그 견적을 다시 보여 줄지도 함께 검토), `DEMO_BYPASS_SERVER_LIMIT`. (`request_owner_approval`은 agent-runtime.md "코드".)

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
  - 코드 (2026-11-21): `OrderIndexer`(`modules/orders/order-indexer.service.ts`, tech-spec 3.9). 로그의 orderRef로 주문을 찾아 `submitting`과 `failed`만 `paid`(체인의 tx hash)로 맞춘다 (멱등: 이미 `paid`면 그대로, 체인 이벤트는 `(tx_hash, log_index)`로 한 번만 `order_events`에). 모르는 orderRef는 경고 로그만 남기고 무시, 로그의 amount와 merchantId가 주문의 금액과 가게의 온체인 ID와 다르면(가게에 온체인 ID가 없어도) paid로 바꾸지 않고 오류 로그만 남기며, 결제를 시작한 적 없는 주문(`quoted`, `pending_approval`)의 로그는 믿지 않고 오류 로그. 읽기만 하며 결제하지 않는다. 커서(체인과 컨트랙트별로 마지막에 반영한 블록)는 청크마다 `indexer_cursors`에 저장하고(마이그레이션 0014, 뒤로 가지 않음), 재시작하면 그 다음 블록부터, 행이 없거나 배포 블록보다 앞이면 배포 블록부터 읽는다. 경로 B만 켜지고 목 경로는 아무것도 하지 않는다.
- 제출 트랜잭션의 영수증이 revert면 그 사유로 위 분류를 따른다.
- **제출 시작 표시와 순서**: 표시는 체인이나 MAWS에 무엇이든 내보내기 **전에** DB에 커밋한다.
  - 경로 B: nonce 예약 → 서명 → (`submit_tx_hash`, `submit_nonce`, `submit_started_at`)를 DB에 커밋 → 그다음 브로드캐스트.
    - 코드 (2026-11-21): `PayRequest.beforeBroadcast({ txHash, nonce })`. 경로 B 제공자가 서명한 뒤 브로드캐스트 전에 부르고, confirm이 `submit_tx_hash`, `submit_nonce`를 조건부 UPDATE로 남긴다 (`submit_started_at`은 그보다 먼저 이미 커밋됨). 이 훅이 던지면 브로드캐스트하지 않는다(주문은 `submitting`에 남아 운영자 확인). 목 제공자는 부르지 않는다.
  - 경로 A: `maws_request_id`를 만들어 `submit_started_at`과 함께 DB에 커밋 → 그다음 MAWS 호출.
  - 표시가 없는 `submitting` 주문(시작 시 재확인 포함)은 "제출 전"이다. 근거: 브로드캐스트와 MAWS 호출은 표시 커밋 뒤에만 하므로, 표시 전에 죽었다면 서명된 트랜잭션도 내보내지지 않았다. 이 경우 재시도 가능 `failed`.
  - 표시가 있으면 tx hash 유무와 상관없이 위 "결과 모름" 규칙을 따른다.
  - 저장 칸: tech-spec 4 `orders`의 `attempt`, `submit_started_at`, `submit_tx_hash`, `submit_nonce`, `maws_request_id`.
- 제출 전에 확정된 거절(MAWS나 WaaS가 오류 코드로 답함, 서명이나 브로드캐스트 전 단계 예외)은 재시도 가능 `failed`.
- 제출 시작 표시 뒤의 타임아웃, 응답 없음은 tx hash가 없어도 `submitting`으로 두고 운영자 확인으로 넘긴다. hash 없음을 "제출 안 됨"으로 보지 않는다.
- 같은 nonce가 다른 트랜잭션으로 소비된 경우는 인덱서 DB가 아니라 그 nonce를 쓴 트랜잭션의 영수증 로그를 체인에서 직접 조회해서 판단한다. `OrderPlaced(orderRef)`가 없을 때만 재시도 가능 `failed`.
- `submitting`이 `SUBMITTING_ALERT_MS`(설정값, 기본 10분) 넘게 결론이 없으면 운영자에게 알린다. 상태는 사람이 확인할 때까지 그대로 둔다 (자동으로 `failed`로 바꾸지 않는다).
- 서버가 시작할 때 `submitting`인 주문을 모두 다시 확인한다 (프로세스가 `pay` 전후에 죽은 경우).
  - 코드 (2026-11-21): `modules/orders/order-boot-recheck.service.ts`(`OrderBootRecheck`, 부팅 훅). 시작 때 `submitting` 목록을 동기로 한 번 읽고(그 뒤에 시작된 주문은 보지 않음), 체인 조회는 백그라운드로 돈다. 표시 없음은 재시도 가능 `failed`(`INTERNAL`), 표시 있음은 `findPaid(orderRef)`가 있으면 `paid`(체인의 tx hash), 없거나 체인을 못 읽으면 `submitting` 유지(경고 로그). 읽기만 하고 `pay`는 부르지 않는다. 제출 해시의 영수증이 revert로 확정됐으면(`PaymentProvider.receiptOf(txHash)`: success, reverted(해석한 사유), unknown) 그 사유의 분류를 live 경로와 같은 `OrderSettler`(`order-settler.service.ts`, confirm과 공유)로 처리한다: 재시도 가능, 재시도 불가는 `failed`(그 코드), 승인 분류(SERVER_*, CHAIN_AGENT_LIMIT)는 `pending_approval`과 승인 행을 한 트랜잭션으로 만든다. 사유를 못 읽었거나(INTERNAL) 영수증이 없거나 체인을 못 읽으면 `submitting` 유지. 다시 보내지 않는다. 아직: `SUBMITTING_ALERT_MS` 알림.
- 사전 검사 실패는 `submitting`으로 바꾼 뒤에 나도 위 분류대로 상태를 바꾼다 (제출 전이므로 결과 모름이 아니다).

### 즉시 충전(fund)의 멱등성
- 충전 요청 ID는 (orderRef, 시도 번호)에서 만든다. 시도 번호는 사람이 confirm을 다시 눌러 결제를 시작할 때마다 하나 늘린다. 한 시도 안에서는 충전이 많아야 한 번이다.
- 충전에도 같은 순서로 제출 시작 표시를 먼저 쓴다 (tech-spec 4 `wallet_txs`의 `request_id`, `order_id`, `attempt`, `submit_started_at`, `nonce`, `maws_request_id`). 표시가 있는데 결론이 없는 충전이 있으면 다시 충전하지 않고 기다린다 (결과 모름). 잔액 계산에는 확정된 충전만 넣고, 새 충전 금액은 float 상한에서 확정 잔액과 결과 모름 충전을 뺀 만큼을 넘지 않는다. 그래서 재시도가 반복돼도 float 상한을 넘지 않는다.
- 코드 (2026-11-21): 지금은 충전 요청 ID 대신 **주문 한 줄에** 남긴다 (`orders.fund_started_at`, `fund_tx_hash`, `fund_amount`, 마이그레이션 0012. `wallet_txs` 표는 아직 없음). `OrderConfirmService.topUp`: 잔액이 이미 덮으면 충전하지 않는다. 부족하면 충전 호출 **전에** 표시를 조건부 UPDATE로 남기고(이미 표시만 있고 해시가 없으면 거절), 호출이 돌아오면 해시를 남긴다. 표시만 있고 해시가 없는 주문(응답을 잃은 충전)은 잔액에 안 보이는 동안 같은 주문을 다시 눌러도 충전하지 않고 재시도 가능 `failed`(`INTERNAL`)로 끝난다. 그 충전이 잔액에 보이면 충전 없이 결제한다. 소유자 서명을 기다리는 충전은 아무것도 안 나갔으므로 표시를 되돌린다. 충전이 영영 도착하지 않으면 그 주문은 막히고 새 견적(새 orderRef)으로 간다. 아직: 시도 번호별 요청 ID, float 상한에서 결론 없는 충전을 빼기.
- 해시 없는 충전 보류의 대사 (2026-11-21, 코드 `db/reconcile-topups.ts`, `pnpm topups:reconcile -- --dry-run|--run [--older-than <분>, 기본 30]`): 충전 호출이 던지거나 프로세스가 죽으면 용돈 장부의 `fund` 보류가 해시 없이 남아 예산이 묶인다. 주인이 손으로 돌린다(재전송 없음, 키 출력 없음). 판정 근거는 보류 행 자신이다(마이그레이션 0016): `order_id`(보류가 속한 주문)와 `fund_call_started_at`(`topUp`이 주문 표시를 쓴 뒤 충전 호출 바로 앞에서 남기고 지우지 않는 시각). 주문의 `fund_started_at` 표시는 같은 주문의 다음 충전이 덮거나 `clearFundStart`가 지우므로 근거로 쓰지 않는다. 주문 연결이 있고 호출 시작 시각이 없는 보류만 호출에 닿지 않았다고 증명되어 풀린다(해시와 호출 시작 시각이 없는 행만 지움). 호출 시작 시각이 있는 보류(던졌거나 응답 유실, 또는 장부 기록만 실패)와 연결이 없는 옛 행은 돈이 나갔을 수 있어 보고만 하고 사람이 체인에서 확인한다. 충전은 nonce를 남기지 않아 체인으로 미전송을 증명하지 못하므로 체인은 묻지 않는다 (추론). 종료 코드 1이면 애매한 보류가 남았다.
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
- 경로 B 키 보관 (2026-11-21 코드): `modules/payment/agent-key-vault.ts`의 `AgentKeyVault`. 새 EOA 키를 만들어 AES-256-GCM으로 봉인해(키는 `AGENT_KEY_ENCRYPTION_KEY`(32바이트 base64)에서 행마다 HKDF-SHA256으로 파생, salt는 행에 저장, 주소를 AAD로 묶음, `key_version` 2. 파생 전 v1 행은 마스터 키로 바로 열림. 교체 중에는 `AGENT_KEY_ENCRYPTION_KEY_PREVIOUS`로 열고 `pnpm agent-keys:rotate`가 v2로 다시 봉인, 절차는 security.md) `agent_keys`(마이그레이션 0010, salt는 0015)에 먼저 저장하고 주소만 돌려준다. 키는 `withAccount(address, fn)` 안에서만 풀리고 끝나면 버퍼를 0으로 채운다(viem에 넘긴 hex 문자열은 비울 수 없어 최선 노력). 열기 실패는 원인을 말하지 않고 `INTERNAL`. 저장소는 `agent-keys.repository.ts`.
- MAWS preflight 통과를 "결제 보장"으로 다루지 않는다 (오프체인, 확인).

## 확장 지점
- 다른 지갑(파우치 등)은 `PaymentProvider` 구현 추가로.
- VP 비공개 주문(2단계)은 `PrivatePaymentProvider`로 따로 두고, 감사 공개 범위를 설정으로.

## 소유자 서명 포트 (D-24)
- 소유자만 할 수 있는 일(TransferLimit 기록, `bindAgent`, `setAgentPaused` 멈춤과 해제, 회수, 충전)은 `OwnerAuthority`(가칭) 포트 하나로만 부른다. 결제 경로(A, B, C)와는 따로다.
- 구현 두 개: `CustodialOwner`(지금, 운영자 키로 서버가 서명, 수탁)와 `PouchOwner`(나중, 사용자 파우치 지갑에 서명을 요청, 비수탁). `OWNER_MODE=custodial|pouch`로 고른다.
- `PouchOwner`에서는 서버가 서명하지 못한다. 서버는 트랜잭션을 만들어 웹에 넘기고, 웹이 파우치 SDK로 사용자 재인증 후 서명한다. 그래서 소유자 일을 하는 API는 지금부터 "준비(prepare)"와 "결과 반영(confirm)" 두 단계로 나눠 둔다. custodial에서는 서버가 두 단계를 바로 이어서 한다.
- 주문, 대화, 화면 코드는 어느 구현인지 몰라야 한다.
- 코드 (2026-11-20): 타입은 `packages/shared/src/payment/owner.ts`(`OwnerAction`, `PreparedOwnerAction`, `OwnerAuthority`). 구현은 `modules/payment/owner-authority.ts`의 `CustodialOwner`(prepare가 signer `server`, confirm이 결제 경로로 바로 실행)와 `PouchOwner`(SDK 전에는 모든 호출이 `INTERNAL`, Q-30, 서버 서명 없음). 다른 모듈은 `payment.service`의 `OWNER_AUTHORITY` 토큰과 `runOwnerAction`(server면 바로 confirm, user면 prepared를 돌려줌)으로만 부른다. 부화는 이미 이 포트로 `bind`와 `setTransferLimit`을 한다. `PaymentProvider`에 컨트랙트 `bindAgent`를 더했다 (흉내 체인은 기록만, 묶지 않은 에이전트를 거절하지는 않는다). 아직: pouch의 prepared를 DB에 두고 웹이 서명해 돌려주는 confirm API, 멈춤과 해제, 회수, 충전 API.

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
