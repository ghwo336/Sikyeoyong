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

## 2026-11-19 용이 도감 반영 (D-20)
- 한 일: 캔버스 "용이 도감"을 `design/screens/Dragons.dc.html`로 복사. `Dragon`, `Egg`, `EggPicker` 문서를 색에서 종(`DragonSpecies`)으로 바꿈. tokens.json에 `dragonSpecies`, tech-spec에 `agents.dragon_species`와 `POST /agents`의 `dragonSpecies`.
- 새로 안 마루 사실: 없음.
- 다음 할 일: dragon 영역 컴포넌트를 만들 때 도감 기준으로 종 4가지 하네스. agents 스키마 마이그레이션에 `dragon_species` 포함.

### 2026-11-19 base, dragon 컴포넌트 (Claude, Claude Code)
- 한 일:
  - packages/ui base 10개를 하네스, 테스트, 위키와 함께 만들고 커밋마다 검증 루프를 돌림: Button, Amount, Chip, Switch, TextField, Meter, StepProgress, TopBar, ListRow, Sheet. 모두 검증 PASS (Sheet는 1라운드 진행 중).
  - dragon 영역: Dragon(종 4가지, 표정, 숨는 얼굴), Egg(종별 무늬, 흔들림), DragonLine(대화, 한 줄, 가운데 배치, 말줄임 없음). D-20 도감 기준.
  - 공용: 누름 스프링 `base/press.ts`(tokens.json motion.press와 맞는지 테스트), 동작 줄이기 `base/reduced-motion.ts`.
  - tokens.json에 시안 값을 토큰으로 올림 (type.label/input/small/barTitle, size.chip/meter/step/topBar/listRow/sheet 등, color.scrim).
- 막힌 것: 없음. 새 열린 질문 Q-27(입력칸 오류 모양), Q-28(예산 막대 평소 색). 호재 님 답을 기다리는 것: Q-22, Q-23, Q-26, Q-27, Q-28.
- 새로 안 마루 사실: 없음.
- 후속 (검증 MINOR):
  - Switch 꺼짐 트랙, Meter 노른자 채움, TextField placeholder의 대비가 기준보다 낮음 (시안 값). 디자인 판단 필요.
  - Storybook 하네스가 Gowun Dodum 글꼴을 불러오지 않아 드래곤 말 줄바꿈이 시안과 다르게 보임.
  - Receipt 카드의 "결제 수단, 한 번에 쓸 수 있는 돈, 30일 한도" 줄을 맡을 order 영역 컴포넌트를 정하고 ListRow.md 메모를 고침.
  - ListRow의 onPress와 Switch trailing 조합을 타입으로 막을지.
  - Arrived 맛 평가를 고르기(radio)로 쓸지 버튼으로 쓸지 화면 조립 때 결정.
- 다음 할 일: ui 나머지 영역(chat, order, limits, onboarding, wallet), 그다음 API 모듈(orders, agents, budget), 컨트랙트, 가게 체인 등록 시드.

### 2026-11-19 ui 컴포넌트 35개 완료 (Claude, Claude Code)
- 한 일:
  - packages/ui의 나머지 영역을 하네스, 테스트, 위키와 함께 만들고 커밋마다 검증 루프를 돌림. chat(UserBubble, ChatInput, QuickReplies, ChatThread), order(RecommendationList, OrderSummary, OrderConfirmSheet, OrderStatusHeader, DeliveryMap, TasteRating, ReceiptDetails), limits(LimitBlocked, CapReached, LimitChangeCard), onboarding(BudgetPicker, EggPicker, HatchProgress, KakaoVerify, SocialLogin), wallet(AllowanceSummary, FrozenPanel, IdCard). IdCard만 검증 진행 중이고 나머지는 PASS.
  - 공용 도우미: `base/radio-group.ts`(WAI-ARIA radio 그룹 키보드), Sheet `initialFocus`, TopBar `backLabel`, Meter `kind`(예산 노른자, 한도 잎색), DragonLine `sheet` 배치, Dragon 64.
  - 검증이 잡은 중요한 것: 주문 확인 시트가 열리자마자 시키기 버튼에 포커스가 가서 Enter 한 번이면 결제가 시작될 수 있었다 (고침, 절대 규칙 3). ui 안에 두 번째 금액 표시 함수를 만들었던 것 (지움, formatOkrw 하나로). 테스트 시간대를 서울이 아닌 곳으로 고정 (timeZone 누락을 잡게). 리셋 시각을 분 단위로 올림 (체인 리셋 전 시각을 보이지 않게).
- 막힌 것: 없음. 호재 님 답을 기다리는 열린 질문: Q-22, Q-23("만 원" 표기, BudgetPicker는 지금 "300,000원"), Q-26, Q-27(입력칸 오류 모양), Q-28(예산 막대 색, 시안 근거로 예산 노른자, 한도 잎색 추론), Q-29(LimitChat 한도 변경 카드를 만드는 경로, P1).
- 새로 안 마루 사실: 없음.
- 후속 (검증 MINOR):
  - 대비가 4.5:1보다 낮은 시안 값: Switch 꺼짐 트랙, Meter 노른자 채움, TextField placeholder, LimitBlocked `leafSubInk`, HatchProgress 대기 줄. 디자인 판단 필요.
  - 시안과 다르게 통일한 값 (디자인 선택): LimitChat 말풍선 폭 270과 위 여백 16, Receipt 카드 간격 8, Button 반경 16과 18, OrderStatusHeader 24시간제와 Cap 오전/오후.
  - 실기기 확인: ChatInput 한글 조합 Enter(사파리, iOS), Sheet 본문 위 끌어 닫기(iOS), ChatThread VoiceOver aria-busy.
  - 카카오, 구글 로그인 버튼의 브랜드 가이드 일치 (미확인).
  - IdCard 초상 용이 얼굴이 시안과 조금 다름, FrozenPanel 제목 heading 여부는 화면 조립 때.
- 다음 할 일: apps/web 화면 조립(시안 17장을 ui 컴포넌트로), apps/api 모듈(orders, agents, budget, approvals, users), 컨트랙트, 가게 체인 등록 시드.

### 2026-11-19 LLM 런타임과 핵심 DB 스키마 (Claude, Claude Code)
- 한 일:
  - D-21(한도 변경 카드 `propose_limit_change`, Q-29 (a)), D-22(데모 LLM은 Opus 5.5 하나, effort만 설정) 기록.
  - shared: 한도 의도 키워드 `hasLimitIntent`, 월 예산 선택지. 게이트 LLM 도구 허용 목록 8개.
  - apps/api/src/modules/llm:
    - 도구 정의 8개(strict, SDK 변환기 고정점 테스트)와 대화 루프 `AgentRuntime`. 안전장치는 메시지당 도구 8회, 주문 1회, 승인 요청 1회, 카드 1회, 카드 의도 게이트, `<data>` 감싸기, 세션 사용자 고정, 거절과 max_tokens 처리다.
    - LLM 하네스 1층(ScriptedProvider), Claude 어댑터, Nest LlmModule.
  - DB 마이그레이션 0001: users, oauth_accounts, sessions, agents, agent_limit_history, orders(D-19 칸), order_events, approvals, allowed_merchants, chat_messages, nag_events. 금액과 상태 CHECK 19개 모두 테스트.
- 막힌 것: 없음. 호재 님께 물은 것: "vooy나 피클"이 무엇인지(답 대기). 열린 질문 Q-22, Q-23, Q-26, Q-27, Q-28.
- 새로 안 마루 사실: 없음.
- 후속 (검증 MINOR):
  - 거절(refusal) 때 서버 대체 문구는 아직 없음 (지금은 멈춤만).
  - tech-spec 3.3 JSON과 TOOL_DEFINITIONS가 같은지 지키는 테스트 없음.
  - drizzle 스키마와 마이그레이션 어긋남을 잡는 게이트 없음 (`drizzle-kit generate`가 변경 없음인지).
  - order_events는 source='chain'이면 tx_hash, log_index NOT NULL CHECK와 소문자 정규화 (chain 모듈 때).
  - APPROVAL_REASONS, NAG_LEVELS를 shared 상수 하나로. 예산 초과 승인 금액 칸(approvals.amount)을 둘지.
  - enum 칸마다 정상 값 전부가 통과하는지 보는 테스트, 이름 없는 CHECK 개수 확인.
- 다음 할 일: 도구 핸들러 모듈(budget, recommend, merchants/menus, orders 견적, approvals, agents level, 한도 카드), POST /api/chat/messages SSE, 결제·체인 모듈, 컨트랙트, apps/web 화면 조립.

### 2026-11-19 apps/web 화면 조립 첫 조각, 목 데이터 (Claude, Claude Code)
- 한 일:
  - 목 API 경계(`lib/api`의 `ApiClient`, `lib/mock`), TanStack Query 5.106.0(2주 넘은 버전 고정).
  - Main(대화, 추천, 빠른 답장, 예산 막대), Confirm(확인 시트, 시키기는 목 confirm만, 낙관적 이동, 실패 시 대화로 되돌림), Done(조리 중), 가입 다섯 장(Start, Verify, Name, Hatch, Budget)을 ui 컴포넌트로 조립.
  - apps/web에 vitest. 결제 버튼 한 번에 confirm 한 번, 실패 재시도 없음, 추천과 빠른 답장은 confirm을 부르지 않음, 상태 단계 매핑, KST 날짜 경계.
  - commit-verifier 1라운드 FAIL(실패 주문이 접수처럼 보임, 테스트 없음) 뒤 수정 커밋으로 PASS.
- 막힌 것: ui에 없는 그림(Main 위 줄, 예산 카드, 추천 들여쓰기, 입력칸 띠, 가입 제목 묶음, Hatch 가운데 정렬 등)은 만들지 않고 `components/web.md` "ui에 없는 것"에 기록. 임시 API 타입은 `apps/web/lib/api/types.ts`(shared로 옮길 것).
- 새로 안 마루 사실: 없음.
- 다음 할 일: ui 부족분 컴포넌트, shared `ChatEvent`(quick_replies, order_failed)와 API 스키마, Tracking, Arrived, Receipt, 한도 화면, 허락 카드, 실제 API 클라이언트로 교체.

### 2026-11-19 packages/ui 재사용 리팩터링 (Claude, Claude Code, D-18 원칙 5)
- 한 일 (커밋 10개, 겉 props 그대로):
  - 새 base 부품: `useSubmitLock`(두 번 눌림 잠금 훅), `Icon`(한 가지 색 아이콘 7개), `DetailRows`(이름과 값 dl), `ErrorLine`(role alert 한 줄), `ActionPair`(주 버튼과 물러나는 버튼), `AmountChange`, `AmountRatio`(둘 다 Amount 위), `ChoiceGroup`(라디오 묶음), `Skeleton`. order 영역 `OrderLines`(OrderSummary와 OrderConfirmSheet 공유).
  - Button에 종류 outline, link와 크기 sm, choice, tall. 화면마다 손으로 만든 motion.button 6곳을 Button으로. 누름 값은 `base/press.ts`의 `PRESS` 하나 (press.test가 다른 곳의 motion.button을 막는다).
  - shared로 이동: `formatKstClock`, `formatKstDate`, `formatKstDateTime`, `kstDaysBetween`(time/kst), `levelWithRo`(text/korean). ui 컴포넌트는 예전 import를 위해 다시 내보내기만 한다.
  - Dragon 318줄을 `DragonSpecies.tsx`, `DragonFace.tsx`, `DragonEffects.tsx`로 나눔. EggPicker 고르기는 ChoiceGroup, 설명 글은 `EggPickerCaption.tsx`.
  - 화면 테스트의 디자인 값 검사는 지우지 않고 새 부품 CSS와 붙은 클래스로 옮겼다. 결제 안전장치(시트 첫 포커스, 두 번 눌러도 onConfirm 한 번) 테스트는 그대로 통과.
- 판단:
  - DetailRows와 ListRow는 합치지 않는다 (56px 누르는 설정 줄과 카드 안 읽기 전용 dl은 높이, 글자, 의미가 다르다).
  - HatchProgress 상태 표시와 구글 G는 여러 색이라 Icon에 넣지 않았다. Icon 테스트가 직접 svg를 그려도 되는 파일 목록을 지킨다.
  - OrderConfirmSheet 가격 변경 문장은 AmountChange가 아니라 ErrorLine 글자다.
  - Dragon 부품을 `parts/` 하위 폴더에 두면 verify.py D18 ui-harness가 BLOCKER로 막아서 같은 폴더 `Dragon*.tsx`로 뒀다.
  - Button md 옆 여백을 시안 값 0 18px로 고쳤다 (Wallet 채우기, Frozen 돌려받기).
- 막힌 것: 없음.
- 새로 안 마루 사실: 없음.
- 후속: BudgetPicker, TasteRating은 자기 CSS가 없어져 verify REVIEW(ui-style)가 두 건 뜬다 (의도). apps/web이 ui의 KST 함수나 levelWithRo를 쓰기 시작하면 shared에서 바로 가져오게 하고 ui 다시 내보내기를 지운다.
