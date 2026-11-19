---
node: leaf
parent: _index.md
children: []
---

# 작업 기록

새 세션은 **맨 아래 항목부터** 읽는다. 세션이 끝날 때 항목을 하나 추가한다.

## 양식
```
### YYYY-MM-DD 세션 이름 (누가: 사람, 세션 종류)
- 한 일:
- 결과물: (파일, PR, 트랜잭션 해시, 배포 주소)
- 막힌 것:
- 새로 안 마루 사실: (maroo-facts.md에도 반영했는지)
- 다음 할 일:
```

## 기록

### 2026-11-18 기획 세션 (호재 님 + Claude, claude.ai)
- 한 일:
  - 마루 PCL + Agent 대표 레퍼런스 디앱 아이디어를 여러 차례 좁힘 (법인카드, 금고 털기, 티켓팅, 에이전트 마을은 기존 사례와 겹치거나 마루다움이 약해서 제외). 피클(AI 비서)과 k-skill(한국 생활 스킬)을 참고해 "결제까지 끝내는 AI 비서"로 결정.
  - 첫 레퍼런스를 배달 관리 에이전트로, 이름을 시켜용, 마스코트를 알에 반쯤 걸쳐 앉은 아기 드래곤으로 확정.
  - 잔소리·메뉴 추천, 한 달 단위 한도(30일 고정 주기), 레벨별 건당 한도, 070 전화(2단계), 카카오·구글 로그인, Expo 웹 시연 후 iOS 출시, 목 가게 8곳, 가볍지만 확장 가능한 구조를 결정.
  - 마루다움 점검: 정상 흐름에서 마루가 안 보이는 문제를 영수증 표시, 정책 변경 장면, VP(2단계)로 보강.
  - AI가 새 지갑으로 돈을 빼는 공격을 3겹(도구 화이트리스트, 선불 구조, PCL)으로 막기로 함. (같은 날 뒤 항목에서 선불 구조를 모드 P float로 변경)
  - docs.maroo.io로 MAWS, PCL 템플릿, 이중 정책 모델, 가스 모드, PCL 프록시, 정책 관리자 확인.
- 결과물: `docs/pitch.md`, `docs/plan.md`, `docs/tech-spec.md`, `docs/_research/*`, `docs/wiki/*`, `CLAUDE.md`, `README.md`. claude.ai Docs 기획안 (시켜용 기획안).
- 막힌 것: MAWS 컨트랙트 함수 호출 지원 여부(Q-01), 멀티테넌트(Q-02), KYB 스키마(Q-07), `changeContractPolicies` 상세(Q-04).
- 새로 안 마루 사실: 테스트넷 전역 정책이 TransferLimit를 검사하지 않음, ALLOW_LIST 테스트넷 미등록, MAWS 규칙은 체인이 읽지 않음 등. `maroo-facts.md`에 반영. 문서 문제 6건은 `devrel-feedback.md`.
- 다음 할 일:
  1. 재욱 님께 `docs/pitch.md`로 방향 설명, Q-01·Q-02·Q-07 질문.
  2. 1주차 게이트: 테스트넷에서 컨트랙트 범위 정책(TransferLimit, 30일) 실험 (`roadmap.md`).
  3. 모노레포 스캐폴딩 (CLAUDE.md 명령어 규약대로).

### 2026-11-18 결정 변경 반영과 일관성 점검 (Claude 서브 에이전트)
- 한 일:
  - tech-spec 조사 결과(E-1 ~ E-8)를 decisions.md에 반영한 것을 위키 전체, CLAUDE.md, tech-spec에 전파. 선불 구조를 모드 P(payable `placeOrder` + float + 즉시 충전)로, 가게 등록을 payout 지갑 직접 호출로, "멤풀 전" 표현을 전역 정책에만으로 바꿈.
  - 위키의 tech-spec 참조를 실제 절 번호와 제목으로 고침.
  - 문서 간 불일치 정리: 에러 코드를 tech-spec 3.6 `AppErrorCode`로 통일, 컨트랙트 에러 이름 통일(`OrderExists`, `MerchantNotActive`, `AgentIsPaused`), LLM 도구 이름 통일(`get_budget`, `get_order_history`, `get_context`, `recommend_merchants`, `get_menu`), 서버 폴더(`apps/api/src/modules/*`), API 접두사(`/api`, `/api/admin`), 멱등성(`clientOrderId`), 시간 저장(unix ms), ID(UUID v7), 잔소리 빈도(단계당 한 달 1번), 장면 4 금액(45,000).
  - 결제 확인 규칙 통일: `place_order`는 견적과 확인 카드만, 결제는 `POST /api/orders/:id/confirm`에서만 (tech-spec 1.4, 2.4, 3.2, 3.3 수정).
- 결과물: 위 파일들. open-questions Q-10 ~ Q-18 추가, devrel-feedback F-07 ~ F-10 추가.
- 막힌 것: 없음 (확인은 1주차 스파이크로).
- 새로 안 마루 사실: maroo-facts 4.1 (평가 단계, EAS sender, 셀렉터당 정책 하나, admin 바인딩, indexAttestation, 테스트넷 chain-id).
- 다음 할 일: 1주차 스파이크 S1, S11, S10 먼저.

### 2026-11-18 전화 기능 제외 (호재 님 + Claude, claude.ai)
- 한 일: D-14 추가. 전화(070, ClawOps) 관련 내용을 기획서, 한 장 요약, tech-spec, 위키에서 뺌. `components/phone.md` 삭제. 데모 장면은 1~8.
- 결과물: decisions-log의 D-14 항목 참고.
- 막힌 것: 없음.
- 다음 할 일: 이전 항목과 같음 (재욱 님 설명, 1주차 스파이크 S1, S11, S10).

### 2026-11-19 디자인 세션 (호재 님 + Claude, claude.ai)
- 한 일: 디자인 캔버스 "시켜용 화면 시안"에 화면 17장(시작하기, 주문하고 기다리기, 한도와 규칙, 용이 관리)을 만들고 사본을 `design/`에 넣음. 유저 플로우(`design/user-flow.md`), 토큰(`design/tokens.json`), 규칙 문서(`conventions/design-and-motion.md`) 작성. D-15 ~ D-17 추가.
- 막힌 것: 카카오 KYC 발급 경로(Q-19), 시연 기기(Q-20).
- 다음 할 일: 1주차 스파이크(S1, S11, S10, S13), 재욱 님께 Q-19 질문, 앱 스캐폴딩 때 tokens.json으로 theme 만들기.

### 2026-11-19 스택 변경 반영 (호재 님 + Claude, claude.ai)
- 한 일: D-18(Next.js + NestJS + SQLite) 결정을 문서 전체에 반영. 구조 규칙 `conventions/architecture.md` 작성. 시안 17장을 UI 컴포넌트 35개로 나눠 `components/ui/<영역>/<이름>.md`(책임, props, 하네스 상태, 쓰는 화면, 테스트 기준) 작성. 저장소를 맥북 `~/Desktop/products/sikyeoyong`에 둠.
- 막힌 것: 없음.
- 다음 할 일: 모노레포 스캐폴딩(pnpm, Turborepo, apps/web, apps/api, packages/ui, packages/shared), `design/tokens.json`으로 CSS 변수 생성, `base`와 `dragon` 컴포넌트부터 하네스와 함께 만들기, 1주차 스파이크.

### 2026-11-19 개발 시작: 검증 루프, 뼈대 (호재 님 + Claude, Claude Code)
- 한 일:
  - 커밋마다 검증하는 루프를 만듦: 기계 게이트 `scripts/verify.py`(자체 테스트 `scripts/verify_test.py`), 검증 에이전트 `.claude/agents/commit-verifier.md`, 규칙 `conventions/dev-loop.md`. 같은 커밋 3라운드 FAIL이면 사람에게 올림.
  - 검증이 커밋 밖으로 번져 개발이 늦어져서, 호재 님 결정으로 범위를 그 커밋으로 조임 (돈, 비밀, 절대 규칙, 빌드 실패만 범위와 상관없이 막음).
  - 모노레포 루트(pnpm, Turborepo, TS 6, ESLint 경계 규칙과 회귀 테스트 69개, prettier), 공급망 최소 배포 기간을 지키게 버전 고정.
  - packages/shared: AppErrorCode 표(22개, HTTP 상태, 문구, 대사), 금액 유틸(bigint aokrw, formatOkrw), 체인 설정과 정책값(D-07, D-12).
  - D-19 결정(호재 님): 결제 실패 뒤 다시 누르면 같은 orderRef로 재시도. payment.md "confirm 상태 규칙"을 원본으로 결제 상태, 승인 흐름, 제출 시작 표시 순서를 정함. `SERVER_PRICE_CHANGED` 추가.
  - apps/api: NestJS 뼈대, `GET /api/health`, 환경 변수 zod 검증, AppError 예외 필터, ZodValidationPipe (D-03: nestjs-zod가 Nest 12를 지원하지 않아 자체 파이프).
  - apps/web: Next.js 뼈대, 루트 `pnpm dev`(api + web, 개발 때 /api rewrite).
  - packages/ui: 토큰 CSS 생성(design/tokens.json), Storybook 하네스, 테스트 환경.
- 결과물: 브랜치 `feat/phase1-foundation` (main은 문서 기준선만).
- 막힌 것: 없음. 열린 질문 Q-22(음수 금액 표시), Q-23(예산 칩 "20만 원"), Q-24(경로 C 중복 orderRef), Q-25(판매자 거절 상태).
- 새로 안 마루 사실: 없음 (schemaRegistry 주소는 미확인 표시).
- 후속 (검증 MINOR, 다음 관련 커밋에서):
  - 게이트: 정규식 리터럴 주석 처리, T1 문자열 안 공백, `const amount = useState<number>` 테스트, UTF-8 아닌 파일 exit 2, 복수형 이름 오탐(employees), querySelector('#..') 오탐, file_allowed는 주석에서만, 큰 bigint 리터럴 규칙을 dev-loop 표에.
  - ESLint: `../.././index` 배럴 우회, verify.py와 ESLint의 `@sikyeoyong/ui/*` 기준 통일.
  - shared: rpc url 정규식(IPv6, 밑줄, 쿼리만), ChainOverrides에 ws와 탐색기.
  - api: ORDERS_CONTRACT를 deployments 해석으로(체인 모듈), dragonParams는 formatOkrw와 KST 변환 한곳에서, Node 22.12 부팅 스모크, tech-spec 3.1 모듈 트리(Hono 시절) 정리.
  - 결제 문서: approvals payload_json에 승인 금액, wallet_txs request_id 규칙과 칸 이름, CHAIN_AGENT_LIMIT_UNSET 조건을 tech-spec 3.6과 chain-and-pcl.md에서 payment.md로 연결.
- 다음 할 일: 웹에 ui 토큰과 글꼴 연결, base 컴포넌트(Button, Amount 등) 하네스와 함께, Drizzle DB 모듈과 마이그레이션, 목 가게 시드, 컨트랙트.
