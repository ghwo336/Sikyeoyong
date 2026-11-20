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
  - `bindAgent(address agent)`: 소유자 (8004 소유 관계 확인, tech-spec "5.3 소유자와 에이전트 관계"). **1단계 구현은 운영자만 부른다** (아래 "명세와 다른 점", Q-30)
  - `placeOrder(uint64 merchantId, bytes32 orderRef) payable`: **모드 P (기본)**. 에이전트가 `msg.value`로 낸다
  - `placeOrderFromVault(uint64 merchantId, uint256 amount, bytes32 orderRef)`: 모드 V 전용 (스파이크 S10 확인 후)
  - `deposit(address agent) payable`, `withdraw(address agent, uint256 amount)`: 모드 V 전용
  - `refund(bytes32 orderRef) payable`: 가게 payout 또는 운영자가 돈을 돌려보내고, 컨트랙트가 에이전트 소유자에게 전달
  - `setAgentPaused(address agent, bool paused)`: 소유자 (온체인 동결, 상태 변수 `agentPaused`)
  - 이벤트: `MerchantRegistered`, `MerchantStatusChanged`, `AgentBound`, `Deposited`, `OrderPlaced`, `Refunded`, `Withdrawn`, `AgentPaused`
  - 커스텀 에러: `NotOperator`, `NotAgentOwner`, `AgentNotBound`, `AgentIsPaused`, `MerchantNotActive`, `OrderExists`, `OrderNotPaid`, `BadAmount`, `TransferFailed` (tech-spec 5.2와 같은 이름). 구현이 더한 에러는 아래 "명세와 다른 점"
- 초기화: `initialize(address operator, address owner, bool vaultMode)`. `owner`는 업그레이드 권한자(OZ `OwnableUpgradeable`, `_authorizeUpgrade`는 owner만). 구현 컨트랙트 자체는 생성자에서 초기화를 잠근다.
- 모드는 `vaultMode` 플래그(초기화 인자)로 고른다. 1단계 기본은 `false`(모드 P).
- 배포: PCL 프록시(`deployPclProxy`, UUPS) 뒤. 프록시 없이 배포한 컨트랙트는 컨트랙트 범위 정책이 걸리지 않는다.

## 구현 (contracts/, 2026-11-20)
- 코드: `contracts/src/SikyeoyongOrders.sol`. Foundry, solc 0.8.30 고정, `evm_version = paris` (마루 EVM 하드포크 미확인, Q-31).
- 의존성: forge-std v1.17.0, OpenZeppelin Contracts와 Contracts Upgradeable v5.7.0. git submodule이 아니라 `contracts/lib`에 태그 그대로 복사했다. 이유와 커밋, 해시는 `contracts/lib/VENDOR.txt` (커밋마다 새 worktree에서 검증하므로 submodule은 매번 비어 빌드가 깨진다).
- 상속: `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`, `ReentrancyGuard`. OZ v5.5 이후 `ReentrancyGuard`는 ERC-7201 이름 공간 슬롯을 써서 프록시 뒤에서 그대로 쓴다 (업그레이드용 사본이 따로 없다).
- 저장소 레이아웃: 슬롯 0에 `operator`, `nextMerchantId`, `vaultMode`를 묶고 매핑 6개, 그 뒤 `__gap[43]`. 업그레이드 때 순서를 바꾸지 않고 새 변수는 gap 앞에 더한다.
- 가게 번호는 1부터 (`nextMerchantId` 초기값 1). 0은 "없음"이다.
- 체크 순서는 tech-spec 5.2 의사 코드 그대로: 모드, 바인딩, 정지, 가게 Active, 금액(0 또는 uint128 초과면 `BadAmount`), `OrderExists`. 그다음 기록과 `OrderPlaced`, 마지막에 지급. 지급이 실패하면 전체가 되돌아가 주문 기록도 남지 않는다 (같은 orderRef로 다시 시도할 수 있다).
- 돈이 나가거나 들어오는 함수(`placeOrder`, `placeOrderFromVault`, `deposit`, `withdraw`, `refund`)는 모두 `nonReentrant`. `receive`와 `fallback`이 없어 그냥 보낸 OKRW는 되돌아간다.

## 명세와 다른 점 (2026-11-20, 구현 세션)
명세가 비었거나 서로 다른 곳은 가장 보수적인 쪽을 골랐다.
| 곳 | 명세 | 구현 | 이유 |
| --- | --- | --- | --- |
| `bindAgent` 호출자 | 소유자, 8004에서 소유 확인 | **운영자만**, 묶인 주인은 `msg.sender`(운영자). 다른 주인에게 묶인 에이전트는 `NotAgentOwner`, 같은 주인 재호출은 그대로 | 8004 소유 확인 인터페이스가 미확인(S11, Q-11)이고 1단계는 모든 에이전트의 8004 소유자가 운영자다 (tech-spec 5.3). 확인 없이 열면 아무나 남의 에이전트를 묶어 멈추거나 환불을 받는다. Q-30 |
| 모드가 틀린 호출 | 의사 코드 `revert()` (이름 없음) | `WrongMode()` | 문자열 없는 빈 revert는 서버가 원인을 구분하지 못한다 |
| 초기화 운영자 0 | 없음 | `ZeroAddress()` (`bindAgent(0)`도) | 운영자 0이면 가게를 영영 활성화하지 못한다 |
| 같은 payout으로 두 번 등록 | `merchantIdByPayout` 매핑만 있음 | `PayoutAlreadyRegistered(payout)` | 매핑이 하나만 가리키므로 덮어쓰면 앞 가게를 잃는다 |
| 없는 가게 상태 변경 | 없음 | `MerchantNotFound(id)`, 상태 `None`으로 바꾸기는 `InvalidMerchantStatus()` | payout이 0인 가게가 Active가 되면 주문 돈이 0 주소로 간다 |
| `refund` 권한 없음 | 에러 이름 없음 | `NotOperator()` | 목록 안의 가장 가까운 이름 |
| `deposit` 대상 | 누구나 (보통 소유자) | 묶인 에이전트에만 (`AgentNotBound`) | 주인이 없으면 꺼낼 사람이 없어 돈이 묶인다 |
| 선불 부족 | 없음 | `BadAmount()` | 새 이름 없이 금액 오류로 |
| 운영자 교체 | 함수 없음 | 만들지 않음 (업그레이드로만) | 명세에 없다. Q-32 |
| 초기화 때 operator, vaultMode 설정 | 불변식 10 "모든 상태 변경은 이벤트" | 전용 이벤트 없음. OZ `Initialized`, `OwnershipTransferred`만 | 명세 이벤트 목록에 없다. 값은 공개 getter로 읽는다 |

더한 에러는 운영자, 배포 경로에서만 나온다. 사용자 주문 경로의 매핑(chain-and-pcl.md "revert 매핑")에는 `WrongMode`만 닿을 수 있고 배포 설정 오류라 `INTERNAL`로 둔다.

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
- 실제 테스트넷 배포는 호재 님 승인 뒤에만 한다 (돈이 드는 체인 호출). `pnpm contracts:deploy:testnet`은 환경변수(`MAROO_RPC_URL`, `CHAIN_ID`, `POLICY_PROFILE`, `OPERATOR_KEY`)가 있는지만 보고 승인 뒤 실행할 명령을 안내한다. 값은 출력하지 않는다.

### 배포 스크립트가 하는 일 (2026-11-20)
- `contracts/script/Deploy.s.sol`은 위 순서의 첫 단계(구현 배포)와 배포 기록 쓰기만 한다. 체인 ID, RPC, 키는 환경변수와 명령 인자로만 받는다. `CHAIN_ID`가 연결된 RPC의 체인 ID와 다르면 아무것도 보내기 전에 `ChainIdMismatch`로 멈춘다. `POLICY_PROFILE`은 `default` 또는 `demo`만.
- `deployPclProxy`, `initialize`, `changeContractPolicies` 첫 호출, `contractPolicies` 재조회는 `infra/scripts/deploy-orders.ts`(viem, tech-spec 5.9, 아직 없음) 몫이다. `deployPclProxy`의 kind 값, 구현 주소와 초기화 데이터를 넘기는 방법, PCL 프록시가 OZ `UUPSUpgradeable`의 `proxiableUUID` 검사와 맞는지, PolicySet 타입은 (미확인, Q-13). 프록시 배포와 `initialize` 사이에 남이 먼저 초기화하지 못하게, 초기화 데이터를 프록시 배포와 함께 넘기는 방법이 있으면 그것을 쓴다.
- 목 가게 등록은 가게 payout 키가 직접 해야 해서(D-08 E-2) 배포 스크립트에 넣지 않는다 (`infra/scripts/seed-merchants.ts`).

### 배포 기록
`packages/shared/src/config/deployments/<chainId>.<profile>.json`. `forge script --broadcast`일 때만 쓰고(연습 실행은 쓰지 않음), 같은 파일이 있으면 덮어쓰지 않고 `DeploymentExists`로 멈춘다. forge는 실행을 흉내 낸 뒤 보내므로 기록이 전송보다 앞선다. 전송이 실패하면 **사람이** 기록 파일을 지운다 (스크립트는 지우지 않는다). 후속: 구현 주소에 코드가 있는지(extcodesize) 확인한 뒤에만 기록하는 단계를 둔다.
```json
{
  "chainId": 0,
  "profile": "default",
  "implementation": "0x...",
  "proxy": "0x0000000000000000000000000000000000000000",
  "deployBlock": 0,
  "policyHash": "0x0000000000000000000000000000000000000000000000000000000000000000"
}
```
`proxy`, `deployBlock`(프록시 배포 블록, 인덱서 시작점 `ORDERS_DEPLOY_BLOCK`), `policyHash`가 0이면 아직 2단계 이후를 하지 않은 것이다. 서버는 `proxy`가 0인 기록을 배포 안 됨으로 다룬다.

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
- 파일 (`pnpm contracts:test`): `test/SikyeoyongOrders.t.sol`(모드 P, 업그레이드, 권한, 재진입, 퍼즈), `test/SikyeoyongOrdersVault.t.sol`(모드 V), `test/invariant/`(핸들러로 무작위 호출 뒤 불변식 1, 3, 4, 6, 7). 테스트는 OZ `ERC1967Proxy` 뒤에 배포한다. PCL 프록시와 같은 UUPS 모양이지만 정책 훅은 없다.
- 퍼즈는 고정 시드(`foundry.toml`)로 게이트에서 매번 같은 입력을 돈다.
- PCL 의존 동작(한도 revert, EAS 거절)은 anvil에서 재현 불가. 테스트넷 TypeScript 통합 테스트로 (`conventions/testing.md`).

## 열린 질문
- (해결, 2026-11-20) 금액 상한: `msg.value`(모드 V는 `amount`)가 0이거나 `type(uint128).max`를 넘으면 `BadAmount`로 되돌린다. 캐스트 전에 검사한다 (`test_PlaceOrder_AboveUint128Reverts`, `testFuzz_PlaceOrder_AboveUint128Reverts`).
- Q-30: `bindAgent`를 소유자 직접 호출로 열 시점 (8004 소유 확인, S11 뒤)
- Q-31: 마루 EVM 하드포크 (PUSH0, MCOPY, TSTORE). 확인 전까지 `paris`
- Q-32: 운영자 키 교체 방법 (지금은 업그레이드로만)
- S10 (Q-10): 모드 V에서 컨트랙트가 내보낸 지급이 에이전트 한도로 집계되나
- S11 (Q-11): 8004 `ownerOf`, `setMetadata` 시그니처
- Q-13: `deployPclProxy` kind 값과 초기화 절차, PolicySet Solidity 타입

## 관련 문서
- `chain-and-pcl.md`, `payment.md`, `security.md`
- `docs/tech-spec.md` "5. 스마트 컨트랙트" (5.2 함수, 5.3 소유 관계, 5.5 배포, 5.6 정책)
