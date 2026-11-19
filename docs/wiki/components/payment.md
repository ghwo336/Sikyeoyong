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
구현체는 경로별로 하나씩 (`pathA`, `pathB`, `pathC`, 테스트용 mock). 선택은 `PAYMENT_PATH` 환경 변수.

## 경로 (D-05)
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
- **자동 재시도 금지**: 타임아웃이나 네트워크 오류면 먼저 체인에서 `OrderPlaced(orderRef)` 존재를 확인한다. 없을 때만, 사람이 보는 흐름에서 같은 orderRef로 다시 시도한다. 예외: `CHAIN_AGENT_LIMIT_UNSET`은 TransferLimit 재기록 후 1회.
- **TransferLimit 먼저**: 에이전트를 만들면 주문 가능 상태로 표시하기 전에 `TransferLimit`을 기록한다. 없으면 정책을 건 컨트랙트에서 `AgentTransferLimitMetadataInvalid`로 실패한다 (확인된 동작에서 추론).
- **즉시 충전은 서버 코드만**: `fund`는 LLM 도구가 아니다. 주문 서비스가 결제 직전에 부르거나, 사용자가 버튼으로 부른다.
- **가스 한도 고정 금지**: 추정값을 쓴다. 가스 한도의 절반은 무조건 과금된다 (확인). 컨트랙트 범위 정책에 막힌 트랜잭션도 가스가 과금된다 (확인).
- **에러 정규화**: revert 이름을 `packages/shared` 에러 코드로 바꾼다. 매핑 표는 `chain-and-pcl.md`.
- 경로 A에서 MAWS `allowedTargets`는 주문 컨트랙트 주소 하나로 고정한다 (D-13). 소유자 주소는 MAWS가 항상 허용한다.
- 모든 체인 트랜잭션 해시를 `wallet_txs`, `orders`에 저장하고 탐색기 링크를 만들 수 있게 한다.

## confirm 상태 규칙 (D-19, 이 절이 원본)
결제는 `POST /api/orders/:id/confirm`에서만 일어나고, 주문 상태로 멱등하다. 같은 주문의 confirm은 몇 번이 와도 결제는 많아야 한 번이다.

| 주문 상태 | confirm이 하는 일 | 응답 |
| --- | --- | --- |
| `quoted` | 조건부 UPDATE 하나로 `quoted`에서 `submitting`으로 바꾼다. 이긴 요청만 사전 검사, 즉시 충전, `pay`로 간다 | 결제 결과 |
| `submitting` | 결제하지 않는다 (동시에 들어온 두 번째 요청, 결과를 기다리는 중) | 200, 현재 주문 |
| `failed` 재시도 가능 | 먼저 체인에서 `OrderPlaced(orderRef)`를 조회한다. 있으면 `paid`로 맞추고 영수증을 만든다. 없으면 조건부 UPDATE로 `submitting`으로 바꾸고 **같은 orderRef로** 결제한다 (사람이 누른 재시도) | 결제 결과 또는 200, 현재 주문 |
| `failed` 재시도 불가 | 결제하지 않는다. 새 견적이 필요하다고 알린다. 새 견적을 만들기 전에 이전 orderRef가 체인에 없는지 확인한다 | 200, 현재 주문 (`error_code` 포함) |
| `paid` 이후 (`preparing`, `delivering`, `delivered`, `cancelled`, `refunded`) | 결제하지 않는다 | 200, 현재 주문과 영수증 |
| `pending_approval` | 결제하지 않는다. 승인 흐름이 먼저다 | 200, 현재 주문 |

- **결과를 모르는 제출은 실패가 아니다**: `pay`가 타임아웃이나 네트워크 오류로 끝나면 `failed`로 바꾸지 않고 `submitting`으로 둔다. 인덱서(`OrderPlaced`)나 트랜잭션 영수증 조회로 결론이 나면 `paid` 또는 재시도 가능한 `failed`로 바꾼다.
- **재시도 가능 여부는 `error_code`로 정한다**: 체인이 막았지만 orderRef가 체인에 남지 않는 실패(`CHAIN_AGENT_LIMIT` 승인 뒤, `CHAIN_INSUFFICIENT_FUNDS`, `CHAIN_AGENT_LIMIT_UNSET`, `MAWS_POLICY_REJECTED`, `SERVER_*` 사전 검사)는 재시도 가능. 주문 자체가 성립하지 않는 실패(`CHAIN_MERCHANT_INACTIVE`, `CHAIN_EAS_REQUIRED`, 견적 만료)는 재시도 불가.
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
