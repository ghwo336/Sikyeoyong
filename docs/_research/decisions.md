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
- **경로 A (기본안)**: MAWS 에이전트가 `SikyeoyongOrders.placeOrder()`를 직접 호출. 에이전트가 직접 sender라 컨트랙트 범위 PCL(TransferLimit, 30일 누적)이 모두 적용된다. MAWS가 calldata를 지원해야 함.
- **경로 B (MAWS가 calldata 미지원일 때 1순위)**: 백엔드가 에이전트 전용 EOA 키를 KMS(또는 암호화 저장)로 관리하고, 그 주소를 8004에 에이전트로 등록. 에이전트가 직접 sender라 PCL은 경로 A와 같다. MAWS의 AA 지갑·페이마스터는 못 씀. MAWS 팀에 calldata 지원을 피드백으로 전달.
- **경로 C (최후)**: 에이전트가 `transfer.send`로 주문 컨트랙트에 OKRW를 보내고, 컨트랙트 `receive()`가 백엔드가 미리 등록한 주문 의도(intent)와 맞춰 처리. 셀렉터 없는 호출에 컨트랙트 범위 정책이 어떻게 걸리는지 확인 필요.
- 모든 경로 공통: 서버 코드는 `PaymentProvider` 인터페이스로 감싸서 경로를 바꿔도 위쪽 코드는 그대로.

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
- 한도는 말로도 바꿀 수 있다 (마루 폴리시 빌더의 "말로 만들기"와 같은 경험). 단 LLM은 변경 카드만 만들고, 확정은 주인의 버튼과 재인증으로만 한다(올릴 때 Face ID, 내리기와 멈춤은 바로). D-06 도구 규칙은 그대로.
- 결제 확인: 지금은 주문마다 확인 버튼(D-06). "한도 안에서는 알아서 시켜" 옵션은 열린 질문 (피클과의 차이를 가장 크게 보여 주는 지점).

## D-18 스택 변경: Next.js + NestJS + SQLite, 컴포넌트 하네스 (2026-11-19, 호재)
- 앱을 Expo에서 **Next.js 웹**으로, 백엔드를 Hono에서 **NestJS**로 바꾼다. DB는 **SQLite 유지**(데모 단계). 저장소는 모노레포 유지(컨텍스트 공유).
- 원칙 1, 단일 책임: 웹은 화면만, API는 돈·체인·AI·세션만. 웹에는 결제, 체인, 키 코드가 들어갈 수 없다.
- 원칙 2, 페이지는 조립만: `apps/web/app/**/page.tsx`는 `packages/ui` 컴포넌트를 배치하고 데이터 훅을 연결할 뿐, 스타일·상태 로직·API 호출 코드를 직접 갖지 않는다.
- 원칙 3, 컴포넌트마다 하네스: `packages/ui/src/<영역>/<이름>/`에 본체, `*.stories.tsx`(상태별 하네스), `*.test.tsx`, 그리고 위키 `docs/wiki/components/ui/<영역>/<이름>.md`. 하네스와 문서 없는 컴포넌트는 합치지 않는다.
- 원칙 4, 백엔드 모듈: Nest 모듈 하나가 책임 하나. 컨트롤러는 요청 받기, 서비스는 일, 저장소는 DB. 다른 모듈은 내보낸 서비스로만 부른다.
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
