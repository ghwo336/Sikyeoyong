---
node: leaf
parent: _index.md
children: []
---

# 용어집

| 용어 | 뜻 | 시켜용에서 |
| --- | --- | --- |
| OKRW | 마루의 원화 스테이블코인. 유일한 네이티브 자산이자 가스 토큰 | 결제 통화. ERC-20이 아니라 네이티브라 결제 함수는 `payable` |
| tOKRW | 테스트넷 OKRW. 금전 가치 없음 | 1단계 데모는 이것만 쓴다 |
| aokrw / atokrw | 최소 단위. 10^18 aokrw = 1 OKRW. 테스트넷 denom은 `atokrw` | 코드와 DB의 모든 금액 단위. `bigint` |
| PCL | Programmable Compliance Layer. 트랜잭션을 정책으로 검사하는 마루 프로토콜 계층. 전역 정책은 제출 시점에 거절(블록 미포함), 컨트랙트 범위 정책은 실행 중 revert(블록 포함, 가스 과금) | 시켜용의 주인공. 한도와 가게 검증 |
| 전역 정책 | 모든 트랜잭션에 걸리는 PCL 정책. 관리자 단일 주소만 변경 | 테스트넷 KYC 한도 (건당 200만, 하루 1,000만) |
| 컨트랙트 범위 정책 | PCL 프록시로 배포한 컨트랙트에만 걸리는 정책 | `SikyeoyongOrders`의 함수별 정책 |
| PCL 프록시 | `deployPclProxy`로 배포한 프록시. 실행 전후 `preCall`/`postCall` 훅 | 주문 컨트랙트는 반드시 이 뒤에 둔다 |
| principal | 정책 평가 대상인 최종 사용자. 직접 호출자와 다를 수 있음 | 에이전트가 직접 sender가 되게 설계 |
| TransferLimit | 8004 메타데이터 키. 에이전트 단일 전송 상한. 소유자가 기록 | 사용자가 정한 건당 한도 (D-31) |
| preflight | 전송 전에 정책 통과 여부를 미리 검사 | MAWS `policy.preflight`. 오프체인, 보장 아님 |
| ERC-8004 / IdentityRegistry | 에이전트 신원 레지스트리. 마루에 preinstall (`0x8004...0001`) | AI 신분증, TransferLimit 저장 |
| EAS | Ethereum Attestation Service. KYC·KYB 증명 | 소유자 KYC, 가게 KYB |
| KYC / KYB | 개인 / 사업자 확인 | KYC는 소유자, KYB는 가게 |
| MAWS | Maroo Agent Wallet Stack. 에이전트 AA 지갑, 오프체인 정책, 전송 | 에이전트 지갑 (경로 A) |
| WaaS | MAWS의 지갑 계층. 키 관리와 서명 | 우리는 키를 보지 않는다 |
| PAYMASTER | MAWS 가스 출처 기본값. WaaS가 가스 후원 | 에이전트 지갑의 float를 가스로 쓰지 않기 위해 사용 (테스트넷 미확인, Q-03) |
| 경로 A/B/C | 에이전트가 주문을 결제하는 세 방법 (D-05) | `components/payment.md` |
| 모드 P | 기본 결제 방식. `placeOrder`가 `payable`이고 에이전트가 `msg.value`로 직접 낸다 | 컨트랙트 범위 TransferLimit가 call value를 검사하므로 이 방식이 기본 (D-06) |
| float | 모드 P에서 에이전트 지갑에 두는 소액. 기본 건당 한도 × 2 | 주문 직전에 서버가 즉시 충전. 유출돼도 잃는 최대치 |
| 즉시 충전 | 주문 직전에 서버가 소유자 쪽에서 에이전트 지갑을 float까지 채우는 것 | LLM 도구가 아니다. 서버 코드만 |
| 모드 V / 선불 잔액 | 주문 컨트랙트 안에 에이전트별로 용돈을 쌓고 차감하는 방식 (D-06 원안) | 스파이크 S10에서 한도 집계가 확인될 때만 쓴다 |
| 데모 프로필 | 30일 상한 장면을 보여 주려고 주기를 줄인 별도 배포 (60,000 OKRW / 3,600초) | `POLICY_PROFILE=demo`, 주소가 운영 프로필과 다름 (D-12) |
| 정책 admin | 컨트랙트 범위 정책을 바꿀 수 있는 주소. 처음 `changeContractPolicies`를 호출한 주소로 한 번만 정해짐 | 배포 스크립트가 운영자 키로 즉시 첫 호출 |
| orderRef | 주문 고유 ID (bytes32). 멱등성 키 | 같은 orderRef는 한 번만 결제 |
| 드래곤 단계 (D-31, 예전 레벨) | 용이 모습의 성장 단계. 레벨은 없어졌고 사용자가 정한 건당 한도의 구간으로 정해짐 (`dragonStage`, 표시 전용) | 10,000 이하 1단계, 30,000 이하 2단계, 그 위 3단계 |
| 내 30일 한도 (D-31, 예전 개인 월 예산) | 사용자가 정한 30일 배달 한도. 체인이 아니라 서버가 관리 | 잔소리 기준 |
| 30일 상한 | 체인이 막는 30일 누적 한도. 모든 사용자 같은 값 | 안전망 |
| 잔소리 | 예산 70/90/100%에서 비서가 먼저 말리는 것 | 막지는 않는다. 막는 건 체인 |
| 목 가게 | 데모용 가짜 가게 8곳 (7 인증, 1 미인증) | `seed/merchants.json` |
| 동결 | 비서를 멈추는 것 | 서버 + MAWS freeze + 컨트랙트 `setAgentPaused` |
| 마루 규칙 N개 통과 | 영수증에 통과한 체인 규칙을 보여 주는 표시 | 정상 흐름에서 마루를 보이게 하는 장치 |
