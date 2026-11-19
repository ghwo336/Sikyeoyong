---
node: leaf
parent: _index.md
children: []
---

# 컨트랙트 (contracts/)

## 책임
- `SikyeoyongOrders`: 가게 등록 신청과 활성화, 에이전트 바인딩, 주문 결제(가게 payout으로 즉시 지급), 환불, 에이전트 일시 정지. 모드 V에서는 선불 충전과 회수.
- 이벤트로 모든 돈의 이동을 남긴다 (서버 인덱서와 잔소리 계산의 근거).

## 책임 아님
- 한도 정책 로직 (PCL이 한다. 컨트랙트에 건당·30일 한도 코드를 중복으로 넣지 않는다)
- 메뉴, 가격, 배달 상태 (서버 DB)

## 의존과 인터페이스 경계
- 함수와 이벤트 이름은 decisions.md D-08로 고정. 바꾸려면 decisions.md부터. 상세 시그니처와 의사 코드는 tech-spec "5.2 상태 변수와 함수".
  - `registerMerchant(bytes32 kybUid, string metadataURI)`: **가게 payout 지갑이 직접 호출** (payout = `msg.sender`). `EAS_POLICY`는 sender만 검사하므로 운영자가 대신 호출하면 의미가 없다 (확인, D-08 E-2)
  - `setMerchantStatus(uint64 merchantId, MerchantStatus status)`: 운영자
  - `bindAgent(address agent)`: 소유자 (8004 소유 관계 확인, tech-spec "5.3 소유자와 에이전트 관계")
  - `placeOrder(uint64 merchantId, bytes32 orderRef) payable`: **모드 P (기본)**. 에이전트가 `msg.value`로 낸다
  - `placeOrderFromVault(uint64 merchantId, uint256 amount, bytes32 orderRef)`: 모드 V 전용 (스파이크 S10 확인 후)
  - `deposit(address agent) payable`, `withdraw(address agent, uint256 amount)`: 모드 V 전용
  - `refund(bytes32 orderRef) payable`: 가게 payout 또는 운영자가 돈을 돌려보내고, 컨트랙트가 에이전트 소유자에게 전달
  - `setAgentPaused(address agent, bool paused)`: 소유자 (온체인 동결, 상태 변수 `agentPaused`)
  - 이벤트: `MerchantRegistered`, `MerchantStatusChanged`, `AgentBound`, `Deposited`, `OrderPlaced`, `Refunded`, `Withdrawn`, `AgentPaused`
  - 커스텀 에러: `NotOperator`, `NotAgentOwner`, `AgentNotBound`, `AgentIsPaused`, `MerchantNotActive`, `OrderExists`, `OrderNotPaid`, `BadAmount`, `TransferFailed` (tech-spec 5.2와 같은 이름)
- 모드는 `vaultMode` 플래그(초기화 인자)로 고른다. 1단계 기본은 `false`(모드 P).
- 배포: PCL 프록시(`deployPclProxy`, UUPS) 뒤. 프록시 없이 배포한 컨트랙트는 컨트랙트 범위 정책이 걸리지 않는다.

## 불변식 (MUST, 테스트로 고정)
1. 컨트랙트에서 나가는 돈은 **Active 가게의 payout** 또는 **그 에이전트의 소유자**에게만 간다. 다른 어떤 주소로도 나가지 않는다.
2. `placeOrder`의 `msg.sender`는 에이전트 자신이다. 컨트랙트 범위 `AGENT_OKRW_TRANSFER_LIMIT_POLICY`는 직접 sender 귀속만 하고 실행 전 call value를 검사한다 (확인). 대리 호출 함수를 만들지 않는다.
3. 같은 `orderRef`는 한 번만 결제된다 (`OrderExists`).
4. 모드 P: 컨트랙트는 돈을 보관하지 않는다 (받은 즉시 payout으로 보냄, 컨트랙트 잔액 0 유지). 모드 V: 선불 합계 = 컨트랙트 OKRW 잔액.
5. 일시 정지된 에이전트는 주문 불가 (`AgentIsPaused`). 모드 V의 `withdraw`는 정지 중에도 가능.
6. `withdraw`는 소유자만, 받는 주소는 소유자 고정 (인자로 받는 주소 없음).
7. `refund`는 운영자 또는 해당 가게만, 결제된 주문에만, 한 번만. 돈은 **에이전트 소유자**에게 간다 (에이전트 지갑을 다시 채우지 않음).
8. Active가 아닌 가게로 주문 불가 (`MerchantNotActive`).
9. 바인딩되지 않은 에이전트는 주문 불가 (`AgentNotBound`).
10. 모든 상태 변경은 이벤트를 낸다.

## 반드시 지킬 규칙 (MUST)
- 체크, 효과, 상호작용 순서. 재진입 가드(`nonReentrant`)를 돈이 나가는 모든 함수에.
- 금액 단위 aokrw. 네이티브 OKRW 전송은 `call{value:}` 후 성공 확인.
- 커스텀 에러 사용 (문자열 revert 금지). 이름은 위 목록과 `chain-and-pcl.md` 매핑을 맞춘다.
- 업그레이드: UUPS 저장소 레이아웃을 깨지 않는다 (새 변수는 끝에, gap 사용). 1단계 운영자 키, 2단계 멀티시그.
- 배포 순서 (tech-spec "5.5 PCL 프록시 배포 절차"): 구현 배포, `deployPclProxy`, `initialize(operator, owner, vaultMode=false)`, **같은 스크립트에서 즉시 운영자 키로 `changeContractPolicies` 첫 호출** (최초 호출자가 정책 admin이 되고 한 번만 지정됨, 확인), 목 가게 등록, 주소를 `packages/shared/src/config/deployments/<chainId>.<profile>.json`에 기록.
- 데모 프로필(D-12)은 별도 프록시로 배포한다. 운영 프로필과 주소가 다르다.
- 테스트넷 배포 주소와 트랜잭션 해시를 worklog에 남긴다.

## 하지 말 것 (MUST NOT)
- 임의 주소로 보내는 관리자 함수(`sweep`, `rescue` 등)를 만들지 않는다. 불변식 1이 깨진다.
- 한도 값을 컨트랙트 상수로 넣지 않는다 (PCL과 설정이 담당).
- 빈 셀렉터 정책을 걸지 않는다 (운영자 함수까지 걸림, tech-spec "5.6 붙일 정책").
- `tx.origin`을 쓰지 않는다. 가스 한도를 고정하지 않는다.

## 확장 지점
- 심부름 종류가 늘면 같은 패턴의 컨트랙트를 추가한다. 주문 컨트랙트 하나를 계속 키우지 않는다.
- VP 결제(2단계)는 별도 컨트랙트 또는 프리컴파일 경유. 이 컨트랙트에 섞지 않는다.
- `bindAgentByOperator(agent, owner)`: 8004 소유 확인(S11)이 안 될 때의 대안 (1단계 경로 B는 소유자가 운영자라 충분).

## 테스트 기준
- Foundry 단위 테스트 (anvil, PCL 없음): 바인딩, 동결, 가게 상태, 중복 orderRef, 지급 실패, 환불 수신자=소유자, 모드 P/V 분기, 재진입(악성 payout), 업그레이드 권한.
- 불변식 테스트(fuzz/invariant): 위 1, 3, 4, 6, 7.
- PCL 의존 동작(한도 revert, EAS 거절)은 anvil에서 재현 불가. 테스트넷 TypeScript 통합 테스트로 (`conventions/testing.md`).

## 열린 질문
- 금액 상한: `Order.amount`는 `uint128`이고 서버의 `zAokrwString`은 uint256까지 받는다. 컨트랙트가 `msg.value > type(uint128).max`면 `BadAmount`로 되돌리는지(tech-spec 5.2 의사 코드) 컨트랙트 구현과 리뷰에서 확인하고, 캐스트에 상한 검사 없이 내리지 않는다.
- S10 (Q-10): 모드 V에서 컨트랙트가 내보낸 지급이 에이전트 한도로 집계되나
- S11 (Q-11): 8004 `ownerOf`, `setMetadata` 시그니처
- Q-13: `deployPclProxy` kind 값과 초기화 절차, PolicySet Solidity 타입

## 관련 문서
- `chain-and-pcl.md`, `payment.md`, `security.md`
- `docs/tech-spec.md` "5. 스마트 컨트랙트" (5.2 함수, 5.3 소유 관계, 5.5 배포, 5.6 정책)
