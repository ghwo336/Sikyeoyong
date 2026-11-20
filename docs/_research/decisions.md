# 시켜용 결정 기록 (모든 문서의 기준)

이 파일과 다른 문서가 다르면 이 파일이 맞다. 결정을 바꾸면 여기부터 고치고 날짜를 남긴다.
문장 규칙: em dash(U+2014)와 en dash(U+2013)를 쓰지 않는다. 마침표, 쉼표, 콜론, 괄호로 끊는다.

## D-01 제품 (2026-11-18, 호재)
- 이름: **시켜용**. "시켜요" + 마스코트 아기 용.
- 첫 레퍼런스: **배달 관리 에이전트**. 버스 예매, 미용실 예약 등은 같은 구조로 나중에 늘린다. 전화는 하지 않는다 (D-14).
- 목적: 마루 대표 레퍼런스 디앱 (DR-TASK-5A). PCL + Agent 조합. VP는 2단계.
- 한 줄: AI 비서가 카드번호 대신 한도가 걸린 OKRW로 배달을 시키고, 한도와 신원 확인은 앱이 아니라 마루 체인이 지킨다.
- 마스코트: 알에 반쯤 걸쳐 앉은 아기 드래곤. 레벨이 오르면 알에서 나와 자란다. 말투 "~용".

## D-02 마루다움 기준 (2026-11-18)
레퍼런스는 "Base + USDC로 옮기면 무엇이 깨지는가"에 답해야 한다. 시켜용이 보여 줄 마루 고유 장면:
1. 원화(OKRW) 결제, 가스도 원화 또는 페이마스터.
2. 체인(PCL)이 막는 한도: 에이전트 건당(TransferLimit), 30일 누적, 소유자 KYC 단위 합산. **표현 주의 (E-4, 2026-11-18)**: 전역 정책(KYC 한도)은 제출 시점에 거절되어 블록에 들어가지 않는다. 컨트랙트 범위 정책(TransferLimit, 30일 누적)은 실행 단계에서 revert되어 트랜잭션은 블록에 남고 가스가 과금된다. 그래서 "멤풀 전에 막는다"는 전역 정책에만 쓰고, 나머지는 "체인이 막는다(실행 중 되돌림)"로 쓴다. 근거: https://docs.maroo.io/concepts/compliance/pcl-policy-enforcement
3. AI 신분증: ERC-8004 등록 + 소유자 KYC(EAS).
4. 정책값 변경이 앱 배포 없이 즉시 적용 (컨트랙트 범위 `changeContractPolicies`).
5. 정상 흐름에서도 보이게: 영수증에 "마루 규칙 N개 통과" 표시.
보강(2단계): VP로 배달 내역 비공개 (금액·가게는 감사자만).

## D-03 플랫폼과 스택 (2026-11-18, 2026-11-19 D-18로 개정)
| 영역 | 결정 |
| --- | --- |
| 저장소 | 모노레포, pnpm workspaces + Turborepo. 이름 `sikyeoyong`. 앱, 서버, 공유 타입, UI 컴포넌트, 컨트랙트, 문서를 한 저장소에 둬서 사람과 에이전트가 같은 컨텍스트를 본다 |
| 웹 | Next.js (App Router) + TypeScript. 모바일 화면 웹. **페이지는 조립만** 한다 |
| UI 컴포넌트 | `packages/ui`. 컴포넌트마다 폴더 하나에 본체, 하네스(Storybook 스토리), 테스트, 위키 문서(`docs/wiki/components/ui/`) |
| 스타일 | CSS Modules + CSS 변수. 값은 `design/tokens.json`에서 생성 |
| 움직임 | Motion(framer-motion), View Transitions. 규칙은 `conventions/design-and-motion.md` |
| 웹 상태 | TanStack Query (서버 상태), zustand (가벼운 로컬 상태, 꼭 필요할 때만) |
| 로그인 | 카카오, 구글. OAuth는 API 서버(NestJS)가 처리하고 httpOnly 쿠키 세션을 발급. 웹과 API는 같은 도메인(`/api`는 Caddy가 API로 넘김) |
| 백엔드 | NestJS (Node 22, Express 어댑터) + TypeScript. 모듈, 컨트롤러, 서비스, 저장소로 단일 책임을 구조로 강제. 입력 검증은 공유 zod 스키마와 자체 `ZodValidationPipe`(2026-11-19 변경: nestjs-zod 5.6의 peer 범위가 Nest 10, 11까지라 Nest 12와 맞지 않아 파이프를 직접 둔다). 주기 작업(체인 인덱서, 배달 타이머)은 `@nestjs/schedule`로 같은 프로세스에서 |
| DB | SQLite(better-sqlite3, WAL) + Drizzle ORM. 데모 단계라 사용자가 거의 없어서. 실제 가게가 붙거나 서버를 여러 대로 늘릴 때 Postgres로 옮긴다(Drizzle 설정과 마이그레이션만) |
| AI | Anthropic Claude API 도구 호출. 모델 이름은 설정값. `LlmProvider` 인터페이스로 감싼다 |
| 체인 | viem. 체인 ID, RPC, 주소는 `packages/shared/src/config` 설정 파일에만 |
| 컨트랙트 | Solidity + Foundry. PCL 프록시(`deployPclProxy`, UUPS) 뒤에 배포 |
| 에이전트 지갑 | MAWS. API 서버 옆 컨테이너에서 MAWS MCP 서버를 `WAAS_AUTH_TOKEN`으로 실행, API가 MCP 클라이언트로 호출 |
| 인프라 | VM 1대, docker compose: web(next start), api(Nest), maws-mcp, caddy(TLS). SQLite 파일은 api 볼륨 |
| 판매자 콘솔 | 2단계. `apps/merchant` (Next.js). `packages/ui`와 같은 API 서버의 `/api/merchant/*` 사용 |
| iOS | 1단계 없음. 웹 먼저. 필요해지면 PWA 또는 감싸기로 다시 정한다 (Q-20) |

## D-04 저장소 구조 (2026-11-19 개정)
```
sikyeoyong/
├── CLAUDE.md                 새 세션 진입점 (읽는 순서, 절대 규칙)
├── README.md
├── apps/
│   ├── web/                  Next.js 사용자 웹. app/ 아래 페이지는 조립만
│   ├── api/                  NestJS. 사용자 API, 운영자 API, 판매자 API(2단계), 에이전트 런타임, 인덱서
│   └── merchant/             판매자 콘솔 (2단계, Next.js)
├── packages/
│   ├── shared/               타입, zod 스키마, API 클라이언트, 체인 설정, 정책값, 에러 코드, 금액 포맷
│   └── ui/                   UI 컴포넌트. 컴포넌트마다 본체 + 하네스 + 테스트
├── contracts/                Foundry (SikyeoyongOrders)
├── design/                   시안 사본, 유저 플로우, 토큰
├── infra/                    docker-compose, Caddyfile, 배포 스크립트
├── seed/                     목 가게·메뉴 시드 JSON
└── docs/
    ├── pitch.md, plan.md, tech-spec.md
    ├── _research/            사실 확인, 결정 기록
    └── wiki/                 규칙 위키 (트리). UI 컴포넌트 문서는 components/ui/
```

## D-05 결제 경로 (2026-11-18, 미확정 1건 포함)
MAWS가 컨트랙트 함수를 호출할 수 있는지가 미확인이다. 세 경로를 정해 두고 첫 주에 고른다.
- **경로 A (처음 기본안, D-25로 1단계는 B)**: MAWS 에이전트가 `SikyeoyongOrders.placeOrder()`를 직접 호출. 에이전트가 직접 sender라 컨트랙트 범위 PCL(TransferLimit, 30일 누적)이 모두 적용된다. MAWS가 calldata를 지원해야 함.
- **경로 B (MAWS가 calldata 미지원일 때 1순위)**: 백엔드가 에이전트 전용 EOA 키를 KMS(또는 암호화 저장)로 관리하고, 그 주소를 8004에 에이전트로 등록. 에이전트가 직접 sender라 PCL은 경로 A와 같다. MAWS의 AA 지갑·페이마스터는 못 씀. MAWS 팀에 calldata 지원을 피드백으로 전달.
- **경로 C (최후)**: 에이전트가 `transfer.send`로 주문 컨트랙트에 OKRW를 보내고, 컨트랙트 `receive()`가 백엔드가 미리 등록한 주문 의도(intent)와 맞춰 처리. 셀렉터 없는 호출에 컨트랙트 범위 정책이 어떻게 걸리는지 확인 필요.
- 모든 경로 공통: 서버 코드는 `PaymentProvider` 인터페이스로 감싸서 경로를 바꿔도 위쪽 코드는 그대로.
- 결과 (2026-11-20, D-25): 스파이크 S1에서 MAWS MCP `transfer.send`에 calldata 칸이 없음을 확인했다. 1단계는 **경로 B**다.

## D-06 에이전트 탈출 방어 (2026-11-18)
AI가 새 지갑을 만들어 돈을 옮기는 것을 막는 3겹:
1. **도구 설계**: LLM 도구는 읽기 도구와 `place_order(merchantId, items)`, `request_owner_approval(reason)`뿐. 임의 주소 송금, 에이전트 생성·충전, 정책 변경 도구는 LLM에 주지 않는다. 가게 주소는 서버가 DB에서 찾는다.
2. **구조 (소액 float + 즉시 충전, E-1 2026-11-18 변경)**: 기본은 **모드 P**. `placeOrder`는 `payable`이고 에이전트가 `msg.value`로 직접 낸다. 에이전트 지갑에는 소액 float(기본: 레벨 건당 한도 × 2)만 두고, 서버가 주문 직전에 소유자 쪽에서 채운다. AI가 새 지갑으로 빼돌려도 잃는 건 float뿐이다.
   - 바꾼 이유: 컨트랙트 범위 `AGENT_OKRW_TRANSFER_LIMIT_POLICY`는 직접 sender 귀속만 하고 실행 전 call value를 검사한다. 선불(vault)에서 차감하면 call value가 0이라 체인 한도를 비껴갈 수 있다.
   - **모드 V (선불 원안)**는 1주차 스파이크 S10에서 "컨트랙트가 내보낸 지급도 에이전트 한도로 집계된다"가 확인될 때만 쓴다. 컨트랙트는 두 모드를 모두 지원하고 `vaultMode` 플래그로 고른다.
   - 데모와 문서 표현 (E-5): "체인이 모든 유출을 막는다"가 아니라 "주문 경로의 큰돈은 체인이 막고, 우회 경로로는 소액 float만 잃는다".
3. **체인 정책**: `placeOrder`에 TransferLimit, 30일 누적, 소유자 KYC. `ALLOW_LIST_POLICY`가 테스트넷에 등록되면 에이전트 송금처를 주문 컨트랙트로 고정.

## D-07 PCL 정책값 (`packages/shared/src/config/policy.ts`, 예시값)
| 규칙 | 값 | 강제 |
| --- | --- | --- |
| 레벨별 건당 한도 | Lv1 10,000 · Lv2 30,000 · Lv3 50,000 OKRW | 체인: `AGENT_OKRW_TRANSFER_LIMIT_POLICY` (주문 컨트랙트 범위) + 8004 `TransferLimit` |
| 30일 누적 상한 | 500,000 OKRW / 2,592,000초 | 체인: `PERIODIC_VOLUME_POLICY` (`placeOrder` 셀렉터) |
| 소유자 KYC | 미인증 건당 2,000,000, 하루 10,000,000 | 체인: 전역 (테스트넷 기본) |
| 가게 등록 | KYB attestation 필수 | 체인: `registerMerchant`에 `EAS_POLICY` |
| 개인 월 예산 | 기본 300,000 OKRW, 사용자 변경 | 앱/서버 (잔소리용) |
| 잔소리 기준 | 70%, 90%, 100% | 서버 설정 |
| 처음 보는 가게 | 소유자 승인 | 서버 (`allowed_merchants`). MAWS allowedTargets는 주문 컨트랙트 주소 하나로 고정 (D-13) |
| 동결 | freeze | MAWS status + 서버 + 컨트랙트 `setAgentPaused`/`agentPaused` (모든 경로에서 온체인) |

## D-08 컨트랙트 `SikyeoyongOrders` (이름 고정, 2026-11-18 E-2·E-3 반영)
상세 시그니처와 의사 코드는 `docs/tech-spec.md` 5.2. 요지:
- `registerMerchant(...)`: **가게 payout 지갑이 직접 호출**한다. `EAS_POLICY`는 sender만 검사하므로 KYB attestation을 가진 주소가 sender여야 한다 (E-2).
- `setMerchantStatus(merchantId, status)`: 운영자가 등록된 가게를 활성화·정지.
- `bindAgent(address agent)`: 소유자가 에이전트를 자기에게 묶는다 (소유자-에이전트 관계를 컨트랙트에 기록).
- `placeOrder(uint64 merchantId, bytes32 orderRef) payable`: 모드 P 기본. 에이전트가 `msg.value`로 내고 가게 payout으로 즉시 지급.
- `placeOrderFromVault(uint64 merchantId, uint256 amount, bytes32 orderRef)`: 모드 V 전용 (S10 확인 후).
- `deposit`, `withdraw`: 모드 V 전용. withdraw는 소유자 주소로만.
- `refund(bytes32 orderRef) payable`: 가게 payout 또는 운영자가 돌려보내고, 컨트랙트가 소유자에게 전달.
- `setAgentPaused(address agent, bool paused)`: 소유자 (온체인 동결).
- 이벤트: `MerchantRegistered`, `MerchantStatusChanged`, `AgentBound`, `Deposited`, `OrderPlaced`, `Refunded`, `Withdrawn`, `AgentPaused`
- 한 셀렉터에는 PolicySet 하나만 둘 수 있다. `placeOrder`에 건당 한도와 30일 누적을 같이 걸려면 `LOGICAL_POLICY`(And)로 묶고, 자식에는 셀렉터를 넣지 않는다.
- 컨트랙트 정책 admin은 처음 `changeContractPolicies`를 호출한 주소로 한 번만 정해지고, `changeContractPolicies`는 전체 교체 방식이다. 배포 스크립트가 운영자 키로 가장 먼저 호출한다.

## D-12 데모 프로필 (E-6, 2026-11-18)
- 데모 장면 4(건당 한도)는 4만 5천 원 주문을 쓴다. Lv1(1만)에서 막히고, 주인이 Lv3(5만)로 올리면 통과한다. 8만 원은 Lv3로도 통과하지 못해 장면이 성립하지 않는다.
- 데모에서 30일 상한 장면을 몇 분 안에 보여 주기 위해 별도 배포(데모 프로필)를 둔다: 상한 60,000 OKRW, 주기 3,600초.
- 운영 프로필은 D-07 값(500,000 OKRW, 2,592,000초).
- 프로필은 `packages/shared/src/config/policy.ts`의 설정값으로 고르고 컨트랙트 주소도 프로필별로 둔다.

## D-13 MAWS allowedTargets (E-7, 2026-11-18)
- 처음 보는 가게의 승인은 서버 `allowed_merchants`로 관리한다. MAWS allowedTargets는 목적지 주소 기준이라 모든 주문이 같은 컨트랙트로 가면 가게를 구분할 수 없다 (추론).
- 경로 A에서 에이전트의 `allowedTargets`는 주문 컨트랙트 주소 하나로 고정한다. 소유자 주소는 MAWS가 항상 허용한다.

## D-09 목 가게 (2026-11-18)
- 8곳: 7곳 KYB 인증, 1곳 미인증(가짜 가게, 데모 장면용).
- 메뉴는 `seed/merchants.json`. 가게마다 payout 주소 1개(테스트넷).
- 배달 상태: 접수 → 조리 중 → 배달 중 → 완료, 서버 타이머(데모는 수 분).
- 실제 가게 등록 흐름(판매자 콘솔, 국세청 사업자 확인, 운영자 검토, EAS 발급)은 2단계.

## D-10 일정
- 11/18~11/23: 선행 확인(D-05 경로, 멀티테넌트, 테스트넷 정책 동작), 서버·MAWS 컨테이너, 시드 데이터.
- 11/24~11/30: 컨트랙트 + 정책, 백엔드(주문·추천·잔소리), 결제 어댑터.
- 12/1~12/9: Next.js 웹(packages/ui 컴포넌트와 하네스 포함), 키 유출 비교 화면, README, QA.
- 2단계: 판매자 콘솔, iOS(회사 조직 계정, 애플 로그인), VP 비공개 주문, k-skill PR.

## D-11 열린 질문 (담당)
1. MAWS가 컨트랙트 함수 호출을 지원하나? (MAWS 담당, 재욱 님) → D-05
2. 서버 하나로 여러 사용자의 MAWS 계정을 다룰 수 있나? 안 되면 데모는 운영자 계정 하나가 에이전트를 소유 (MAWS 담당)
3. 테스트넷 PAYMASTER 동작 여부
4. `changeContractPolicies` 인자와 권한, 셀렉터별 정책 지정 방법 (PCL 담당, pcl-contract-admin-binding 문서)
5. 30일 주기 시작 시점, 달력 월 리셋 가능 여부
6. 소유자 단위 30일 합산을 `FOR_EACH_POLICY`로 할 수 있나
7. 테스트넷 KYB용 EAS 스키마를 우리가 만들어도 되나, attester는 누구
8. 체인 ID 변경과 Mock KYC 전환 시점 (재욱 님)
9. (닫힘, D-14) ClawOps 요금·발신 제한, AI 통화 고지 의무. 전화 기능을 빼서 확인할 필요가 없어졌다.

## D-14 전화 기능 제외 (2026-11-18, 호재)
- 070 전화(ClawOps)는 1단계와 2단계 모두에서 뺀다. 데모 장면 9(전화)도 없앤다.
- 이유: 주문을 받는 가게는 모두 마루에 등록된 KYB 가게라 주문은 `placeOrder`와 판매자 알림으로 전달되고, 전화할 상대가 없다. 등록 안 된 가게에 전화로 주문하면 OKRW로 결제할 수 없어 체인이 한도를 지킨다는 핵심이 빠진다. 070 비용, AI 통화 고지 의무, 음성 인식 실패 처리 부담에 비해 PCL + Agent 메시지와 관련이 없다.
- 배달 지연 문의 같은 필요는 판매자 화면의 상태·지연 사유 입력으로 대신한다.
- 다시 검토하는 조건: 실제 가게가 붙은 뒤 사용자가 원할 때. 그때 새 결정으로 연다.

## D-15 배달과 주문 현황 (2026-11-19, 호재)
- 시켜용은 주문과 결제만 맡는다. 실제 배달은 가게가 원래 쓰던 배달대행이 한다. 라이더 네트워크를 만들지 않는다.
- 1단계 목 가게는 서버 타이머로 접수, 조리 중, 배달 중, 도착이 넘어간다. 2단계에 배달대행 연동으로 실제 라이더 위치를 받는다.
- 주문 현황 화면은 배달의민족을 참고한다: 도착 시각을 분 단위로 크게, 라이더 위치 지도, 4단계 진행, 출발하면 알림.
- 레퍼런스 디앱의 목표는 배달앱과 경쟁이 아니라 "AI에게 돈을 안전하게 맡기는 법"을 보여 주는 것이다. 혜택 이야기는 결제수수료 없음, 즉시 정산, 아낀 돈 정도만 가볍게.

## D-16 본인 인증 (2026-11-19, 호재)
- 가입에 본인 인증이 필수다. 안 하면 용이를 부화시키지 않는다.
- 지금 테스트넷 KYC 발급은 카카오 본인 인증 하나뿐이다 (2026-11-11 주간 회의, 카카오용 EAS 스키마 하나, 발급 계정 하나). 그래서 인증 화면은 "카카오톡으로 본인 인증" 버튼 하나이고, 구글 가입자도 카카오로 인증한다. Mock KYC로 바뀌면 같은 자리에 체험용 인증을 둔다(설정값).
- 시켜용 컨트랙트에서 주인 KYC를 검사하려면 `EAS_POLICY`가 보낸 지갑(에이전트)만 본다는 점 때문에 `FOR_EACH_POLICY`로 에이전트 주인을 검사해야 한다 (미확인, 스파이크 S13). 확인되면 카카오 스키마 UID를 그대로 쓴다.
- 외부 디앱 사용자가 마루의 카카오 KYC 발급을 받을 수 있는 경로는 미확인 (Q-19).

## D-17 디자인 방향 (2026-11-19, 호재)
- 기준은 claude.ai 디자인 캔버스 "시켜용 화면 시안"과 저장소 `design/` 사본. 화면 17장, 유저 플로우, 토큰.
- 귀엽게: 아기 드래곤 표정으로 상태를 말하고, 드래곤 말은 고운돋움, 나머지는 Pretendard. 색은 연두(드래곤), 진한 잎색(버튼), 노른자(뿔, 예산 막대). 체인이 막은 화면도 빨강 대신 호박색.
- 블록체인 경험을 숨긴다: 사용자 화면에 블록체인 말을 쓰지 않고, 데모용 "자세히 보기"에서만 결제 기록 번호, 정책 이름, 탐색기 링크를 보여 준다.
- AI 슬롭 금지: 체크리스트 카드, 아이콘 안내 박스, 설명 문단, 안심 문구를 쓰지 않는다.
- 토스 수준으로 부드럽게: Reanimated, 낙관적 UI, 스켈레톤, 햅틱. 규칙은 `docs/wiki/conventions/design-and-motion.md`.
- 한도는 말로도 바꿀 수 있다 (마루 폴리시 빌더의 "말로 만들기"와 같은 경험). 단 LLM은 변경 카드만 만들고, 확정은 주인의 버튼으로만 한다(레벨 올릴 때 Face ID, 예산 변경, 내리기, 멈춤은 바로, D-21). D-06 도구 규칙은 그대로 (카드를 띄우는 도구 추가는 D-21).
- 결제 확인: 지금은 주문마다 확인 버튼(D-06). "한도 안에서는 알아서 시켜" 옵션은 열린 질문 (피클과의 차이를 가장 크게 보여 주는 지점).

## D-18 스택 변경: Next.js + NestJS + SQLite, 컴포넌트 하네스 (2026-11-19, 호재)
- 앱을 Expo에서 **Next.js 웹**으로, 백엔드를 Hono에서 **NestJS**로 바꾼다. DB는 **SQLite 유지**(데모 단계). 저장소는 모노레포 유지(컨텍스트 공유).
- 원칙 1, 단일 책임: 웹은 화면만, API는 돈·체인·AI·세션만. 웹에는 결제, 체인, 키 코드가 들어갈 수 없다.
- 원칙 2, 페이지는 조립만: `apps/web/app/**/page.tsx`는 `packages/ui` 컴포넌트를 배치하고 데이터 훅을 연결할 뿐, 스타일·상태 로직·API 호출 코드를 직접 갖지 않는다.
- 원칙 3, 컴포넌트마다 하네스: `packages/ui/src/<영역>/<이름>/`에 본체, `*.stories.tsx`(상태별 하네스), `*.test.tsx`, 그리고 위키 `docs/wiki/components/ui/<영역>/<이름>.md`. 하네스와 문서 없는 컴포넌트는 합치지 않는다.
- 원칙 4, 백엔드 모듈: Nest 모듈 하나가 책임 하나. 컨트롤러는 요청 받기, 서비스는 일, 저장소는 DB. 다른 모듈은 내보낸 서비스로만 부른다.
- 원칙 5, 재사용 (2026-11-19 추가, 호재): UI 컴포넌트는 한 가지 일만 하고, 두 곳 이상에서 같은 모양이나 로직이 나오면 공통 부품으로 뽑아 재사용한다. 이미 있는 부품(base Button 등)을 다시 만들지 않는다. 이유: 35개 감사에서 OrderConfirmSheet가 OrderSummary를 다시 그리고, LimitChangeCard가 Button과 결제 두 번 눌림 잠금을 복사한 것이 나왔다. 영향: architecture.md UI 규칙, 기존 컴포넌트 분해 (겉 props는 유지).
- 원칙 3 보충, 스타일 없는 조립형 (2026-11-19 추가, 호재): 자기 스타일이 하나도 없고 base 부품을 조립만 하는 컴포넌트(BudgetPicker, TasteRating처럼 ChoiceGroup에 Chip을 넘기기만 하는 것)는 `<이름>.module.css`를 두지 않고, 컴포넌트 문서 `## 메모`에 "자기 스타일 없음"과 그 이유(무엇이 그리는지)를 적는다. 이유: 빈 CSS 파일은 "스타일이 정말 없는지"를 말해 주지 못하고 게이트 REVIEW만 쌓인다. 문서에 적으면 사람과 게이트(`scripts/verify.py` ui-style)가 같은 근거를 본다. 영향: architecture.md UI 규칙, verify.py와 verify_test.py, BudgetPicker.md, TasteRating.md.
- 이유: 호재 님 결정(Next로 개발, 단단한 백엔드, 단일 책임). Hono 대비 Nest는 구조를 프레임워크가 강제하고, Express 경험이 그대로 쓰인다. SQLite는 사용자가 거의 없는 데모라 충분하고 Drizzle로 나중에 Postgres로 옮긴다.
- 영향: D-03, D-04 개정, tech-spec 2장과 3장은 상단 대응표로 읽는다, 위키 components(web, server-api, auth, infra), conventions(architecture 신규, testing, design-and-motion), components/ui 신규, CLAUDE.md.

## D-19 결제 실패 뒤 다시 누르기: 같은 주문번호로 재시도 (2026-11-19, 호재)
- 결제 확인(`POST /api/orders/:id/confirm`) 뒤 결제가 실패하거나 응답이 없던 주문에서 사용자가 다시 누르면, 새 견적을 만들지 않고 **같은 orderRef로** 다시 시도한다. 그 전에 체인에서 `OrderPlaced(orderRef)`를 조회해서 이미 결제됐으면 결제하지 않고 결제 완료로 맞춘다.
- 결과를 모르는 제출(타임아웃, 네트워크 오류)은 실패(`failed`)가 아니라 결제 중(`submitting`)으로 둔다. 결론이 날 때까지 다시 눌러도 결제하지 않는다.
- 재시도할 수 없는 실패(가게 정지, 메뉴 없음, 가격 바뀜)만 새 견적을 만든다. 새 견적 전에 이전 제출 트랜잭션이 확정되었고 `OrderPlaced(orderRef)`가 없는지 확인한다.
- 분류에 없거나 애매한 실패의 기본값은 "결과 모름"(`submitting`)이다.
- 견적 유효 시간은 두지 않는다. 대신 confirm 사전 검사가 매번 현재 가격을 다시 계산하고, 다르면 `SERVER_PRICE_CHANGED`로 새 견적을 만들게 한다.
- 승인 흐름(같은 날 바꿈): 승인 필요 사유는 `failed`가 아니라 `pending_approval`로 가고, 승인 행은 주문에 묶어 같은 트랜잭션에서 만든다. 승인되면 주문을 `quoted`로 되돌리고 확인 카드를 다시 보낸다. 서버가 승인 뒤 스스로 결제하지 않는다 (이전 tech-spec 흐름 3의 "서버가 원래 주문을 재시도"를 대체).
- 경로 C는 같은 orderRef 중복 보호가 확인될 때까지(Q-24) `failed` 재시도를 하지 않는다.
- 승인된 사유는 그 주문의 confirm에서 다시 막지 않는다. 예산 초과 승인은 승인 금액이 주문 금액과 같을 때만 유효하다.
- 제출 시작 표시(서명한 tx hash와 nonce, 또는 MAWS 요청 ID)를 DB에 커밋한 **뒤에만** 브로드캐스트하거나 MAWS를 부른다. 표시가 없으면 제출 전, 있으면 결과 모름.
- 이유: 새 견적은 새 orderRef라 체인의 `OrderExists` 보호를 받지 못해 타임아웃 뒤 이중 결제가 날 수 있다. CLAUDE.md 9(같은 orderRef로만 재시도)를 결제 상태 규칙으로 구체화했다. 에러 코드 커밋 검증 3라운드 지적에서 나왔다.
- 영향: payment.md "confirm 상태 규칙"(원본), server-api.md, tech-spec 1.4 흐름 1과 흐름 3, 3.2 confirm과 approve 행, 3.6 `SERVER_PRICE_CHANGED`, 4 `approvals.order_id`와 `orders`, `wallet_txs`의 제출 표시 칸, 8.3 `SUBMITTING_ALERT_MS`, open-questions Q-24, Q-25.

## D-20 용이는 알마다 종이 다르다 (2026-11-19, 호재)
- 알 네 가지를 색이 아니라 종으로 둔다: 숲용(`forest`, 연두, 잎 점 알, 잎 볏), 물용(`water`, 하늘, 물결 알, 지느러미 귀와 이마 물방울), 꽃용(`flower`, 분홍, 꽃잎 점 알, 꽃잎 귀와 꽃 볏), 별용(`star`, 보라, 별과 달 알, 별 뿔과 윙크).
- 그림 기준은 캔버스의 "용이 도감"과 사본 `design/screens/Dragons.dc.html`. 기본 얼굴은 같고 머리 장식과 알 무늬가 다르다. 다른 화면 시안의 용이는 숲용이다.
- 코드: `DragonColor` 대신 `DragonSpecies`. `Dragon`, `Egg`, `EggPicker`가 `species`를 받는다. `agents.dragon_species` 칸, `POST /api/agents` 본문에 `dragonSpecies`. 종은 화면 꾸밈일 뿐 결제, 한도, 체인에 영향이 없다 (온체인 메타데이터에도 넣지 않는다).
- 이유: 호재 님 결정. 알을 고르는 순간을 더 귀엽고 내 것 같게. 광고 영상도 종별 용이를 쓴다.
- 영향: design/README, design/tokens.json(`dragonSpecies`), user-flow, 위키 ui/dragon(Dragon, Egg, _index), ui/onboarding(EggPicker, _index), tech-spec 데이터 모델과 API.

## D-21 대화로 한도 바꾸기: LLM은 변경 카드만 제안한다 (2026-11-19, 호재)
- LimitChat에서 사용자가 말로 한도를 바꾸자고 하면, Claude가 새 도구 `propose_limit_change`로 **변경 카드만** 띄운다. 이 도구는 한도, 레벨, 예산을 바꾸지 않는다. 바꾸는 일은 사용자가 카드 버튼을 누른 뒤 서버가 한다 (레벨 올리기는 재인증 뒤, 예산 변경과 내리기는 바로). open-questions Q-29의 (a).
- 도구 입력은 금액이 아니라 정해진 값만: `field`(`perOrder` | `monthlyBudget`)와 `perOrder`면 `targetLevel`(1, 2, 3), `monthlyBudget`이면 서버가 정한 예산 선택지 하나. 금액과 "전과 후"는 서버가 레벨표와 현재 값으로 붙인다. LLM이 정책값을 만들지 않는다는 기존 규칙을 지킨다.
- 서버가 카드를 버리는 경우: (1) 그 턴에 사용자가 직접 쓴 메시지에 한도 의도 키워드가 하나도 없을 때, (2) 최고 레벨(3)을 넘거나 예산 선택지에 없는 값일 때, (3) 지금 값과 같을 때. 이 도구도 쓰기 도구처럼 메시지당 1회다. 한 번에 여러 단계를 올리는 것은 막지 않는다 (LimitChat 시안이 레벨 1에서 3으로 바로 간다).
- 의도 판단: 서버가 그 턴의 **사용자 원문**만 보고, `packages/shared/src/config/policy.ts`의 `LIMIT_INTENT_KEYWORDS`와 `hasLimitIntent`(한도, 예산, 올려, 내려, 늘려, 줄여, 레벨, 만 원, 만원, 숫자 뒤 원. "내리", "올리" 같은 어간은 "비 내리는 날", "올리브"에 걸려 넣지 않는다)에 하나라도 맞으면 의도가 있다고 본다. 도구 결과(가게, 메뉴, 날씨 글)는 보지 않는다. 키워드에 안 걸려 카드가 안 뜨는 경우는 받아들이고, 용이가 "지갑 화면에서 바꿀 수 있어용"처럼 버튼 경로로 안내한다. 이 판단은 인젝션을 막는 문턱일 뿐 말을 이해하는 일은 LLM이 한다.
- 예산 선택지: `policy.ts`의 `monthlyBudgetOptions`(키는 금액이 아닌 이름 `small`, `medium`, `large`, 값은 20만, 30만, 50만 원 aokrw. Budget 시안의 세 칸). `get_budget` 결과(`BudgetView.budgetOptions`)로 LLM에 알려 주고, LLM은 키만 고른다.
- 확정 경로: 레벨은 `POST /agents/me/level`(올리기는 재인증, 내리기는 바로). 월 예산은 `PATCH /me { monthlyBudgetOkrw }`로 서버가 선택지 값을 넣는다. 예산은 앱 안의 개인 상한이라 올리기도 재인증 없이 바로 한다. 재인증을 서버가 어떻게 확인하는지는 API 구현 커밋에서 정한다.
- 서버 보안 규칙을 같이 적는다: 도구는 "누구의 것"을 LLM 입력이 아니라 로그인 세션에서 정한다. 사용자별 메시지 수 제한으로 LLM 비용 공격을 막는다. 모델 답은 글자로만 그린다 (HTML로 넣지 않는다).
- 이유: 말을 이해해서 카드를 띄울 수 있는 것은 LLM뿐이고(서버 규칙 해석은 다르게 말하면 못 알아듣는다), 카드는 보여 주기만 해서 잘못 떠도 사용자가 그만두기를 누르면 끝이다. 호재 님 결정.
- 영향: CLAUDE.md 절대 규칙 3(도구 목록), tech-spec 2.4(ChatEvent `limit_change_card`), 3.2(BudgetView `budgetOptions`), 3.3(도구 정의)과 9.2, agent-runtime.md, security.md, LimitChangeCard.md, open-questions Q-29, D-17(도구 목록 추가는 D-21).

## D-22 데모 LLM 모델: Claude Opus 5.5 하나 (2026-11-19, 호재)
- 데모 기간에는 용이 대화를 포함한 모든 LLM 호출을 Claude Opus 5.5(`claude-opus-5-5`) 하나로 한다. 모델 이름은 설정값(`LLM_MODEL`)이라 코드에 적지 않는다.
- 호출마다 바꾸는 것은 모델이 아니라 생각 깊이(`LLM_EFFORT`, 기본 `medium`. 2026-11-20 D-26으로 코드 기본값을 `low`로 바꿨다)다. 모델을 섞으면 프롬프트 캐시를 같이 못 쓰고, 공식 안내도 여러 모델로 나누기 전에 좋은 모델의 낮은 effort를 먼저 재 보라고 한다.
- 고정된 시스템 프롬프트와 도구 목록을 캐시하고, 강제 tool_choice는 쓰지 않는다 (Opus 5.5는 400). 도구는 `strict: true`.
- LLM 평가 하네스는 두 층: 1층은 녹화나 손으로 쓴 모델 턴을 재생해 매 커밋 돈다(돈 안 듦). 2층은 실제 API로 같은 시나리오를 돌려 도구 정확도, 인젝션, 비용, 시간을 잰다. 모델이나 프롬프트를 바꿀 때만, 예상 비용을 호재 님께 먼저 보이고 돈다.
- 나중에 비용을 줄일 때 요약 같은 단순 호출을 더 싼 모델로 내릴지는 2층 결과를 보고 호재 님이 정한다.
- 이유: 데모 품질이 먼저다. 호재 님 결정.
- 영향: `.env.example`(`LLM_MODEL`, `LLM_EFFORT`), agent-runtime.md, tech-spec 8.3.

## D-23 UX 품질 기준: 토스 수준으로 부드럽게 (2026-11-20, 호재)
- 화면 조립이 끝나면 UX 다듬기를 별도 단계로 반드시 한다. 기준은 "토스 수준으로 매우 부드럽게"다. 기능이 동작하는 것만으로는 끝이 아니다.
- 기준 (모든 사용자 화면):
  1. 누르면 100ms 안에 반응이 보인다. 서버를 기다리는 동작은 낙관적 UI로 먼저 바꾸고, 실패하면 되돌린 뒤 용이가 이유를 말한다. 결제 확정만은 예외다: 결제는 확인 버튼을 누른 뒤에만 일어나고, 화면은 "진행 중" 상태를 보인다 (CLAUDE.md 규칙 3).
  2. 화면 전환과 시트는 끊기지 않는다: 60fps, 위치 이동은 transform과 opacity만, 화면 사이는 View Transitions 또는 공유 요소 전환, 시트는 손으로 끌어 닫을 수 있다.
  3. 기다림은 뼈대(Skeleton)로 보인다. 빈 화면, 레이아웃 밀림(CLS), 깜빡임이 없다. 스피너는 1초 넘게 걸리는 곳에만 쓴다.
  4. 금액 숫자는 자리별로 굴러가며 바뀐다 (tokens.json motion.number). 누름은 스프링(motion.press), 동작 줄이기 설정이면 페이드만.
  5. 다음 화면에 필요한 데이터는 미리 받는다 (prefetch). 뒤로 가면 이전 화면이 바로 다시 보인다.
  6. 입력은 한글 조합 중에도 끊기지 않고, 키보드가 올라와도 입력칸과 버튼이 가려지지 않는다.
  7. 실기기(iOS Safari, Android Chrome)에서 확인한다. 햅틱은 지원하는 곳에서만 짧게 쓴다.
- 이유: 호재 님 요구 ("todo에 반드시 ux 개선도 넣어야 함, 매우 부드러워야 해, 토스급 ux"). 시켜용은 데모로 사람을 설득하는 앱이라 첫인상이 곧 신뢰다.
- 영향: conventions/design-and-motion.md(측정 가능한 기준과 점검 목록), web.md, 작업 기록의 다음 할 일. 검증 에이전트는 화면 커밋에서 이 기준을 본다.

## D-24 지갑 소유: 테스트넷은 수탁, 파우치가 나오면 비수탁으로 갈아 끼운다 (2026-11-20, 호재)
- 지금(테스트넷): 운영자가 모든 에이전트의 소유자다 (D-02 1단계 그대로). 서버가 운영자 키로 소유자 일(TransferLimit 기록, `bindAgent`, `setAgentPaused`, 회수)을 하고, 경로 B면 에이전트 키도 서버가 암호화해 보관한다. 이것은 **수탁 구조**다. 데모 화면과 README에 "테스트넷 데모, 운영자가 지갑을 대신 관리"라고 밝힌다.
- 나중(파우치 임베디드 SDK 출시 후): 사용자가 가입 때 파우치 로그인(이메일과 패스키)으로 만든 파우치 지갑(비수탁, 키 방식은 MPC로 추론, S14)이 (2026-11-20 D-29로 바뀜. 예전 문구: "카카오 로그인으로 앱 안에서 만든 파우치 지갑(TEE 기반 비수탁)") 에이전트의 소유자가 된다. 한도 올리기, 동결 해제, 회수, 충전은 사용자 지갑 서명(화면의 Face ID 단계)으로만 한다. 운영자 키는 가게 등록, KYB 발급, 정책 관리만 하고 사용자 돈과 에이전트 설정에는 손대지 않는다. 사용자는 시켜용 앱 하나만 쓴다 (지갑 앱 별도 설치 없음).
- 갈아 끼우는 자리: 소유자 서명을 하나의 포트 뒤에 둔다. `OwnerAuthority` (가칭) 인터페이스에 `setTransferLimit`, `pause`, `unpause`, `drain`, `fund`, `bind`를 두고, 구현은 `CustodialOwner`(운영자 키, 지금)와 `PouchOwner`(사용자 서명 요청, 나중) 두 개. 환경 변수 `OWNER_MODE=custodial|pouch`. 주문, 대화, 화면 코드는 어느 쪽인지 몰라야 한다. DB `agents.owner_address`는 지금도 칸을 두고 운영자 주소를 넣는다.
- 화면은 지금부터 비수탁 흐름으로 만든다: 한도 변경 확정은 이미 "버튼 + 재인증"(D-17, D-21)이라, 나중에 재인증이 파우치 서명으로 바뀌어도 화면은 그대로다.
- 이유: 파우치 임베디드 SDK는 만드는 중이고 아직 배포 전이다 (11/20 호재 님 확인). 테스트넷 데모는 실제 가치가 없어 수탁이어도 당장 문제가 없지만, 레퍼런스 디앱이 수탁 구조를 굳히면 "체인이 지킨다"는 메시지가 약해지고 따라 만드는 개발자가 수탁형 서비스를 복사하게 된다. 메인넷이나 실사용 전에는 반드시 비수탁으로 바꾼다 (특금법상 가상자산 보관·관리 해당 여부는 법무 확인 필요).
- 밝히는 문구 (2026-11-20, 호재 님 결정):
  - 사용자 화면: 용이 지갑 화면 맨 아래에 작게 한 줄. "체험판이에요. 용이 용돈은 지금 시켜용이 대신 맡아 두고 있어요." 블록체인 말이 없다 (D-17). 사실을 밝히는 한 줄이라 D-17이 금지한 안심 문구나 설명 문단으로 보지 않는다.
  - 데모 "자세히 보기"와 README: 그대로 정확하게. "테스트넷 데모. 에이전트 키와 소유자 권한은 운영자 서버가 보관한다(수탁, D-24). 파우치 임베디드 SDK가 나오면 사용자 지갑이 소유자가 된다."
  - `OWNER_MODE=pouch`가 되면 화면 문구는 저절로 빠진다. 서버가 `GET /me`의 `custodial`(OWNER_MODE가 custodial일 때만 true)로 알려 주고, 화면은 이 값만 보고 그린다. 화면은 모드 이름을 모른다.
- 영향: auth.md, security.md, payment.md(소유자 포트), infra.md(OWNER_MODE), Q-30, README, ui/wallet `CustodyNote`, `MeView.custodial`.

## D-25 결제 경로는 B로 간다 (2026-11-20, 스파이크 S1 결과, 호재 님 동의)
- 사실: MAWS MCP `transfer.send`의 입력은 `agentId`, `to`, `amount`, `clientToken`뿐이고 calldata 칸이 없다 (확인, 도구 스키마, 호재 님 승인으로 스키마만 읽음). 그래서 MCP로는 `SikyeoyongOrders.placeOrder`를 부를 수 없다. 경로 A는 MCP로는 불가.
- 결정: D-05의 규칙("A가 안 되면 B가 1순위")대로 1단계 결제는 **경로 B**다. 서버가 에이전트마다 EOA 키를 만들어 `AGENT_KEY_ENCRYPTION_KEY`로 AES-GCM 암호화해 보관하고(`agent_keys`), 운영자가 8004에 등록하며, 에이전트 키로 `placeOrder{value}`를 직접 sender로 보낸다. 컨트랙트 범위 PCL(TransferLimit, 30일)은 경로 A와 같이 걸린다.
- 같이 확인한 것: MAWS의 건당 한도와 허용 주소는 m-aws MCP 서버가 검사하고 WaaS(서명)는 강제하지 않는다 (확인, 도구 설명). 시켜용은 "한도는 체인(PCL)이 지킨다"를 MAWS 정책이 아니라 컨트랙트 범위 PCL 기준으로만 말한다 (규칙 11).
- 남은 것: WaaS API가 calldata를 받는다는 답이 오면 경로 A를 다시 검토한다 (Q-01). 경로 B는 MAWS의 AA 지갑과 페이마스터를 못 쓰므로 에이전트 지갑에 가스용 소액(기본 2,000 OKRW)을 둔다 (tech-spec 3.4).
- 영향: payment.md, tech-spec 3.4 경로 B, `PAYMENT_PATH` 기본 B(이미), agent_keys 테이블과 키 보관 구현, devrel F-13, F-14. 경로 B의 에이전트 키 보관과 운영자 소유는 D-24의 수탁 구조이며, 소유자 일은 D-24의 `OwnerAuthority` 포트 뒤에 둔다.

## D-26 데모 LLM 비용: 리허설은 녹화 재생, 실제 데모는 Claude에 low effort와 하루 상한 (2026-11-20, 호재 님 "추천대로")
- 배경: 실제 Claude API가 비싸다. 서버에서 도는 Claude Code(구독)를 대화 엔진으로 쓰는 안은 쓰지 않는다. Agent SDK와 Claude Code 안내가 승인 없이 제3자 제품에 claude.ai 로그인이나 구독 사용량을 쓰지 말고 API 키를 쓰라고 하기 때문이다 (추론, 안내 문서 기준). 시켜용 용이는 엄격한 도구 스키마 8개를 쓰는 대화라 CLI로 옮기기도 맞지 않는다.
- 결정:
  - 개발과 리허설: `LLM_MODE=replay`. LLM 평가 하네스 1층(D-22)의 녹화나 손으로 쓴 용이 턴을 재생한다. API를 부르지 않아 비용이 없다. 데모 장면 1~8의 대화를 시나리오로 둔다.
  - 실제 데모 자리: `LLM_MODE=live`. 모델은 D-22대로 Claude Opus 5.5 하나. 생각 깊이는 D-22의 기본 `medium`을 `low`로 바꾼다(이유: 비용). 코드 기본값(`LLM_EFFORT` 기본)을 `low`로 바꾸고, 장면에 더 깊은 생각이 필요하면 그 실행의 env로 올린다. 프롬프트 캐시 유지, 하루 토큰 상한(`LLM_DAILY_TOKEN_CAP`, 넘으면 용이가 오늘은 쉬어야 한다고 말하고 재생이나 고정 답으로 돌아간다).
  - 모델을 더 싼 것으로 내리는 일은 D-22대로 2층 평가 결과를 보고 따로 정한다.
- 영향: agent-runtime.md, tech-spec 3.3과 8.3(`LLM_MODE`, `LLM_DAILY_TOKEN_CAP`), llm-provider 팩토리, .env.example.

## D-27 데모 모드에서는 시드 가게를 이미 허용한 가게로 본다 (2026-11-20, Q-35 결론, 호재 님 "추천대로")
- 배경: "처음 보는 가게는 소유자 승인"(D-07)을 글자 그대로 적용하면 새 사용자의 첫 주문은 어느 가게든 승인 카드부터 뜬다. 데모 순서 2(정상 주문)와 부딪힌다 (Q-35).
- 결정: Q-35의 (b). `DEMO_MODE=true`일 때만 시드 가게(목 가게, `merchants.source = 'seed'`)를 그 사용자가 이미 허용한 가게로 친다. 실제 운영 규칙(D-07)은 바뀌지 않는다. 데모에서도 시드가 아닌 가게(`console`, 가게 등록은 2단계 D-09)는 그대로 승인을 묻는다. 그래서 1단계 데모에는 처음 보는 가게 승인 장면이 없다(시드 아닌 가게가 2단계에서 생긴다).
- 영향: payment.md 견적 절, OrderRules, open-questions Q-35.

## D-28 테스트넷 데모의 레벨 올리기 재인증은 버튼만, 파우치가 나오면 파우치 서명 (2026-11-20, Q-36 결론, 호재 님 "추천대로")
- 배경: D-21은 레벨 올리기에 재인증(화면은 Face ID)을 요구하고 서버 확인 방법은 미뤘다 (Q-36). D-24로 지금은 운영자 수탁, 나중에는 사용자 파우치 지갑이 소유자다.
- 결정: Q-36의 (c). `REAUTH_MODE=none`이면 레벨 올리기 버튼만으로 올린다(테스트넷 데모 전용). production 설정은 `REAUTH_MODE=none`으로 부팅하지 않는다. 파우치 임베디드 SDK가 나오면(Q-30) 레벨 올리기는 `OwnerAuthority`의 사용자 서명(prepare, confirm)이 되고, 그 서명이 재인증을 대신한다. 화면은 지금도 "확인하고 바꾸기" 버튼과 재인증 자리를 그대로 둔다 (D-24: 화면은 비수탁 흐름으로).
- 영향: auth.md, security.md, tech-spec 3.2 `POST /agents/me/level`, 8.3 `REAUTH_MODE`, open-questions Q-36.

## D-29 로그인은 파우치 로그인 하나, 시작 버튼은 "이메일로 시작하기", 웹은 http 모드로 (2026-11-20, 호재 님 결정, S14)
- 배경: 파우치 현재 Browser SDK(`@nc-waas/sdk` beta.8)의 금고는 이메일과 패스키만 된다. "앱에서 연 금고는 이메일과 패스키만 제공해요. 소셜 로그인은 없어요." (확인, README). 카카오 로그인은 문서가 이전 연동으로 둔 React SDK에만 있다 (확인, spikes/S14). 그래서 D-24가 말한 "카카오 로그인으로 만든 파우치 지갑"은 지금 SDK로는 한 번에 되지 않는다. 시켜용 계정과 지갑을 두 번 로그인으로 나누는 안도 있었지만 쓰지 않는다.
- 결정:
  - 로그인은 파우치 로그인 하나다 (Browser SDK `pouchiEmbedded.login`, 파우치 금고 화면). 카카오와 구글 OAuth 로그인은 하지 않는다 (auth.md의 1단계 카카오, 구글 계획을 대체).
  - 시작 화면의 버튼은 "이메일로 시작하기" 하나다. 브랜드 이름(파우치)을 쓰지 않는다 (D-17).
  - 가입 흐름: 이메일 → 패스키(Face ID) 설정과 지갑 생성(파우치 금고가 함께 한다) → 카카오톡 본인 인증(D-16 그대로) → 알 고르기 → 부화 → 예산.
  - 세션 입구 하나: 웹은 로그인을 한 곳(세션 입구)으로 감싸고, 화면은 그 입구만 부른다. 서버는 파우치 결과를 검증하는 BFF(`bind`, `complete`, 앱 키는 서버에만)를 둔다. 배치 (2026-11-20 고침, 구현 검증 뒤): SDK와 결과 확인은 `pouchi` 모듈 한 곳(SDK를 다른 모듈이 보지 않게), 라우트와 사용자 찾기와 세션 발급은 `users` 모듈(개발용 로그인과 같은 자리, 사용자를 만드는 곳이라). 처음 문구 "auth 모듈 한 곳"에서 바꾼 이유: auth 모듈은 세션만 다루고 사용자를 모른다. 나중에 파우치 Browser SDK에 카카오가 들어오면(pouchi-questions 3번) 시작 화면의 첫 버튼과 입구 안쪽만 바꾼다.
  - 개발 중에는 `DEV_LOGIN` 우회를 그대로 둔다.
  - 웹은 목 모드에서 진짜 서버(http) 모드로 지금 옮긴다. 서버가 아직 받지 않는 기능(지갑, 신분증, 멈춤, 환불, 맛 평가, 체험 용돈)의 API부터 채운다. 로그인은 파우치 입구가 붙기 전까지 개발용 우회로 한다. 결제는 계속 목 체인(`PAYMENT_PATH=mock`)이다.
- D-24와의 관계: 파우치 지갑이 가입 때 생기므로 D-24의 "나중"(사용자 지갑이 소유자)의 지갑은 이 로그인 지갑이다. 소유자 일을 그 지갑 서명으로 옮기는 것(`OWNER_MODE=pouch`, `PouchOwner`)은 S14와 pouchi-questions 5번 결과 뒤다. 그때까지 소유자 일은 수탁(운영자)이고 수탁 안내 문구도 그대로다.
- 남은 것: Start 시안(`design/screens/Start.dc.html`)의 두 버튼(카카오, 구글)을 "이메일로 시작하기" 하나로 고치는 시안 갱신. 이메일과 패스키 화면은 파우치 금고가 그리므로 시켜용 시안이 없다.
- 영향: auth.md, design/user-flow.md(전체 흐름, 1단계 행), web.md(세션 입구), tech-spec 2.3 인증 흐름과 3.2, D-24 문구, S14.

## D-30 대화 모델 공급자는 설정으로 고른다: Anthropic 또는 OpenAI (2026-11-20, 호재 님 결정)
- 배경: 데모 대화를 실제 모델로 돌려야 하는데, 회사 Anthropic 계정 키는 쓰기 어렵고 Claude 구독을 제품에 쓰는 것은 D-26대로 하지 않는다. 호재 님 개인 OpenAI 계정(선불 크레딧, 프로젝트 월 한도 10달러 hard limit, 자동 충전 끔)이 있다.
- 결정:
  - `LLM_PROVIDER=anthropic|openai`(기본 anthropic). openai면 `OPENAI_API_KEY`(비밀, 서버에만)와 `LLM_MODEL`(OpenAI 모델 이름)을 쓴다.
  - D-22의 "모델은 Claude 하나"를 "공급자는 설정, 기본은 Claude"로 바꾼다. 공급자는 `LlmProvider` 뒤의 어댑터 하나(`llm/openai-provider.ts`, Chat Completions 스트리밍과 도구 호출)이고 런타임, 도구 8개, 결제 경계(규칙 3)는 그대로다.
  - 생각 깊이(`LLM_EFFORT`)는 OpenAI의 `reasoning_effort`로 넘긴다. 하루 토큰 상한(D-26)은 OpenAI 사용량(prompt, completion, cached)으로 같이 센다.
  - 도구 스키마는 OpenAI 쪽에서 strict로 보내지 않는다(스키마 규칙이 공급자마다 달라 거절될 수 있어서). 서버가 도구 입력을 zod로 다시 검사하므로 안전은 그대로다.
- 영향: agent-runtime.md, tech-spec 3.3과 8.3, .env.example, llm-provider 팩토리. 시스템 프롬프트와 용이 말투는 Claude 기준으로 다듬어 왔으므로 OpenAI에서 대화 품질을 다시 본다(후속).
