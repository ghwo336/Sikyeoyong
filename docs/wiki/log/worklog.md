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

### 2026-11-19 세션, 예산 API, 용이 대화 엔드포인트, 공유 API 스키마 (Claude, Claude Code)
- 한 일:
  - shared/api: 대화 이벤트(`zChatEvent`), 주문, 내 정보, 가입 zod 스키마. 웹의 임시 타입을 이것으로 바꾸고, 목 응답을 스키마로 검사. tech-spec 3.2 응답 모양을 화면 기준으로 맞춤(/me, /agents/me, /signup/config, /chat/history nextCursor).
  - auth: 세션 발급·확인·폐기(32바이트, 해시만 저장, 30일), `SessionGuard`(sid 쿠키나 Bearer, 쿠키 쓰기는 X-Requested-With, sid 둘이면 401).
  - `GET /api/budget`, 도구 핸들러 `get_budget`(모델에게는 표시 금액만), `get_context`(KST, 동네, static 날씨).
  - `POST /api/chat/messages` SSE: 대화 기록 저장(마이그레이션 0002), `clientMessageId` 멱등(같은 글이면 저장된 답, 다르면 409), 최근 20턴의 말만 모델에게(지난 도구 결과는 안 넘김), 깨진 기록 줄은 건너뜀, 1분 20회 제한(429), 연결이 끊기면 모델과 도구를 멈춤.
  - 웹 화면 조립 첫 조각(메인 대화, 확인 시트, 주문 현황, 가입)과 UI 재사용 리팩터링(공통 부품 8개, useSubmitLock, Dragon 분리)을 합침. D-18 원칙 5(재사용) 추가.
  - README 다시 씀, 용 네 마리 썸네일(docs/assets/thumbnail.png). 소개 영상은 GitHub 업로드용으로 압축만 해 둠(사용자 Desktop).
- 막힌 것: 없음. 호재 님 답 대기: 시안끼리 다른 요청 문구(Confirm "깍두기 많이" 대 Done의 긴 문구), 열린 질문 Q-22, Q-23, Q-26, Q-27, Q-28.
- 새로 안 마루 사실: 없음.
- 후속 (검증 MINOR):
  - 사용자당 하루 LLM 토큰 예산 (tech-spec 9.5).
  - 답 없이 남은 사용자 줄의 유효 시간(프로세스가 죽은 경우), '답이 있는 턴 20개' 기준 조회.
  - 체인 30일 사용량의 진짜 viem 읽기(배포 주소가 생기면), 판별을 NODE_ENV에서 배포 주소 유무로.
  - order_events의 source='chain' NOT NULL CHECK와 tx_hash 소문자, ORDER_STATUSES를 api db가 shared에서 가져오기.
  - OAuth(카카오, 구글) 로그인 라우트: 쿠키 Path=/ 하나, 이전 sid 만료.
- 다음 할 일: UI 부족분 브랜치 재검증과 병합, `GET /chat/history`, `GET /me`, `PATCH /me`(월 예산), `GET /signup/config`, 추천과 가게·메뉴, 주문 견적(place_order), 웹 목을 실제 API로 바꾸기.

### 2026-11-19 ui 부족분으로 Main과 가입 화면을 시안에 맞춤, 검증 후속 MINOR (Claude, Claude Code)
- 한 일:
  - 새 부품: base `ScreenTitle`(제목 묶음 display, title, dragon), `Hero`(그림과 글 가운데 묶음), `IconButton`(44 아이콘 버튼, TopBar 뒤로가 이걸 쓴다), chat `ChatHeader`(위 줄), `ChatLayout`(대화 화면 띠), onboarding `TrialAllowance`(체험용 용돈 줄과 받은 뒤). base `lines`(줄바꿈 도우미).
  - props를 늘린 부품 (겉 props 그대로): DragonLine `children`과 layout `greeting`, Meter `framed`, TextField `hint`, Button variant `accent`, Icon `more`.
  - 토큰: `size.screenMax` 480, `signupGap` 22, `hatchTop` 56 등을 tokens.json에 옮겨 적었다.
  - 웹: Main은 ChatLayout과 DragonHeaderContainer, 추천 카드는 `threadRows`로 용이 말 아래. 가입 다섯 장은 새 부품으로 조립하고 화면 틀을 라우트별 layout으로 나눴다 (Start 0 24 32, Hatch 56 24 32 사이 28, Verify 사이 24).
  - 검증 후속: Button 동작 줄이기 테스트, ChoiceGroup 죽은 클래스, BudgetPicker 세 개 기준 메모, D-18 보충과 verify.py ui-style이 "자기 스타일 없음" 메모를 본다, KST 주석, 목 부화 중간 PENDING, `hatchPollInterval`.
  - 390, 360 폭 Chrome headless로 Main과 가입 다섯 장을 찍어 시안과 대조했다.
- 판단:
  - Name 안내 줄의 한도는 shared 정책 레벨 1 한 번에 한도(프로필과 무관)로 만든다 (`BORN_LINE`).
  - 체험용 용돈 받은 뒤 모양("받았어요")은 시안에 없어 디자인 선택으로 적었다.
  - 부화 GET이 실패해도 계속 묻는다 (web.md "부화 다시 받기").
  - Verify, Name 뒤로는 이전 단계로 `router.replace` (처음에는 `router.back()`, 검증 뒤 고침. web.md "가입 뒤로").
- 막힌 것: 없음.
- 새로 안 마루 사실: 없음.
- 다음 할 일: Start 알(금 간 알과 뿔) Egg 상태, 추천 줄 높이(시안 64, 지금 약 76), `/dragon` 페이지, LimitChat 조립 때 ChatThread 여백(16 20 12).

### 2026-11-20 할 일 추가: UX 다듬기 (D-23, 호재 님 요구)
- 화면 조립이 끝나면 UX 다듬기 단계를 반드시 한다. 기준은 "토스 수준으로 매우 부드럽게"이고, 측정 가능한 표는 conventions/design-and-motion.md "부드러움 기준"에 있다.
- 순서: 실제 API로 바꾼 뒤 화면마다 표를 채우고, 실기기(iOS Safari, Android Chrome)에서 녹화로 확인한다. 검증 에이전트가 화면 커밋에서 이 기준을 본다.

### 2026-11-20 할 일 추가: 수탁 구조를 화면과 README에 밝히기 (D-24)
- 데모 화면 어딘가(지갑 화면이나 신분증 화면 아래 한 줄, 또는 설정)와 README "상태" 절에 "테스트넷 데모, 운영자가 지갑을 대신 관리"를 넣는다. 위치와 문구는 시안이 없어 화면 다듬기 단계에서 정하고 호재 님께 보인다. 블록체인 말 금지(D-17)와 부딪히므로 사용자 화면 문구는 "지갑" 대신 쉬운 말로 다듬어야 한다.
- 결정됨 (2026-11-20): 문구와 위치는 D-24 "밝히는 문구". 구현은 `MeView.custodial`, ui/wallet `CustodyNote`, README. 남은 것: 지갑 화면 조립 때 `CustodyNote`를 맨 아래에 넣기.

### 2026-11-20 컨트랙트 SikyeoyongOrders와 Foundry 프로젝트 (Claude, Claude Code 서브 에이전트)
- 한 일:
  - `contracts/` Foundry 프로젝트. solc 0.8.30, `evm_version = paris`. forge-std v1.17.0, OpenZeppelin v5.7.0을 `contracts/lib`에 태그 그대로 복사 (submodule은 새 worktree에서 비어 게이트가 깨져서. 해시는 `lib/VENDOR.txt`, `VENDOR.sha256`).
  - `SikyeoyongOrders`: D-08 함수, 이벤트, 에러 그대로. 모드 P 기본, 모드 V는 `vaultMode`. 한도 로직 없음 (PCL 몫). `bindAgent`는 1단계 운영자만 (Q-31). 명세와 다른 점은 contracts.md 표.
  - 테스트 72개 (단위, 재진입, 업그레이드 권한, 퍼즈, 불변식 1, 3, 4, 6, 7, 배포 스크립트). 일부러 깨 보기: `OrderExists` 검사, 환불 수신자, `refund`의 `nonReentrant`를 빼면 각각 테스트가 실패하는 것을 확인.
  - `script/Deploy.s.sol`(구현 배포와 배포 기록), `pnpm contracts:build`, `contracts:test`, `contracts:deploy:testnet`(준비 확인만). anvil에서 실제 실행, 연습 실행 무기록, 덮어쓰기 거절, 체인 ID 불일치 거절을 확인.
  - verify.py T1이 `contracts/lib` 복사본을 소스로 보지 않게 고침.
- 결과물: 테스트넷 배포 없음.
- 막힌 것: PCL 프록시 배포와 정책 바인딩(2단계 이후)은 `deployPclProxy` 인터페이스가 미확인이라 스크립트를 못 씀 (Q-13, F-12).
- 새로 안 마루 사실: 없음. 미확인 둘을 maroo-facts 4에 적음 (EVM 하드포크 Q-32, `deployPclProxy` 세부 Q-13). devrel F-11, F-12.
- 다음 할 일: S11 뒤 `bindAgent` 소유자 호출 열기(Q-31), `infra/scripts/deploy-orders.ts`(프록시, initialize, 정책 첫 호출), 테스트넷 배포는 호재 님 승인 뒤, 서버 `ChainReader`에 배포 기록(`proxy`가 0이면 미배포) 연결.

### 2026-11-20 가게·메뉴 조회, 추천, recommend_merchants와 get_menu 연결 (Claude, Claude Code)
- 한 일 (브랜치 `feat/api-merchants-recommend`, 커밋 5개):
  - shared `api/merchants.ts`: `MerchantCard`, `MenuView`, 목록 쿼리(verified는 true만), 이름 40자, 설명 200자.
  - merchants 모듈: `MerchantSource` 토큰과 `DbMerchantSource`, `GET /api/merchants`, `GET /api/merchants/:id`(SessionGuard). 미인증·비활성 가게는 숨기고 id로 물어도 404. 영업시간 `isOpenAt`(KST). 다른 모듈용 `catalog`, `lookupForOrder`, `categoryOf`.
  - recommend 모듈: 정수 점수 `rank()`(tech-spec 3.8), `WeatherService`(get_context와 같은 출처), 최근 주문 `RECENT_ORDERS` 포트.
  - llm: `recommend_merchants`, `get_menu` 실제 핸들러. `ToolReply(forModel, card)`로 모델용(표시 글자)과 화면용(aokrw 카드)을 나눔. `wrapData`가 `<`, `>`를 이스케이프. 대화 스트림에 `recommendations` 카드, 스키마 실패 카드는 버리고 로그.
- 판단 (명세가 비었거나 달라 보수적으로 정함, recommend-and-nag.md "추천 점수 규칙"):
  - 한도 넘는 메뉴는 craving이 맞을 때만 승인 필요로 넣고 한도 안 메뉴 뒤에. 개인 예산 넘는 메뉴는 승인 필요 표시만. 30일 상한을 넘게 되는 메뉴는 제외.
  - craving이 맞으면 맞은 메뉴만, 아니면 가게마다 메뉴 하나.
  - 보이는 가게는 DB `verified`와 `active`만으로 (open-questions Q-34, `onchain_id`는 체인 등록 스크립트 뒤).
  - 목 가게 `etaMin`은 배달 타이머 기본값 합 3분 (시안과 웹 목은 20~35분).
- 막힌 것 (다른 작업자 몫):
  - (해결 2026-11-20) orders 모듈이 최근 주문 읽기 함수(`OrdersService`에서 사용자, 시각 이후, paid 이상, `{ merchantId, createdAtMs }`)를 내보내야 추천의 선호와 새로움이 살아난다. 그때 `RECENT_ORDERS` 바인딩만 바꾼다. `OrdersService.recentOrdersSince`로 묶었다.
  - approvals 모듈이 허용 가게 읽기를 내보내면 추천 `needsApproval`에 `NEW_MERCHANT`를 더한다.
- 새로 안 마루 사실: 없음.
- 다음 할 일: 주문 견적(`place_order`)에서 `lookupForOrder` 쓰기(`not_orderable` → `CHAIN_MERCHANT_INACTIVE`), 웹 목을 실제 `/api/merchants`와 추천 카드로 바꾸기, `etaMin` 출처를 delivery 모듈로.

### 2026-11-20 수탁 안내 (D-24 밝히는 문구)
- 한 일: D-24에 문구와 자리 기록(bfb39d6), `GET /me`의 `custodial`(975d84a), ui/wallet `CustodyNote`(ff57b66), README 문구(cb185fc).
- 실수 기록: 975d84a 커밋 제목 범위에 쉼표(`feat(shared,api/users)`)를 넣어 형식(git-and-review.md "커밋 메시지")을 어겼다. 히스토리는 고치지 않는다 (dev-loop.md). 앞으로 여러 단위를 건드려도 범위는 하나로 쓴다.
- 남은 것: 지갑 화면 조립 때 `custodial`이 true일 때만 `CustodyNote`를 맨 아래에 넣고 자세히 보기 스위치를 `detailed`로 넘긴다 (false면 그리지 않는 테스트 포함). 시안 `Wallet.dc.html`에 이 한 줄을 넣는 것은 다음 디자인 갱신 때.

### 2026-11-20 주문: 승인 기반, 견적, confirm 결제
- 한 일:
  - approvals `openWithOrder`: 주문 쓰기와 승인 행을 한 트랜잭션에 (14708f7, PASS).
  - 견적 `POST /orders` (75a48da, 수정 f389eb1, 2라운드 PASS): 서버 가격, 30일 상한, 승인 사유, `clientOrderId` 멱등, `orderRef = keccak256(주문 ID)`.
  - confirm `POST /orders/:id/confirm` (207fc32, 검증 중): 상태로 멱등, 조건부 전이, findPaid 뒤 같은 orderRef 재시도, 부족분 즉시 충전, 제출 표시 뒤 pay, 실패 분류.
  - OwnerAuthority 부화 bind 테스트 (c0866e0, 13b32a1, PASS), 수탁 안내 (D-24, PASS).
- 막힌 것: Q-35 (처음 보는 가게 승인이 데모 첫 주문을 막음) 호재 님 결정 대기.
- 다음 할 일:
  - `GET /orders/:id`, 승인과 거절 API(`POST /approvals/:id/approve|reject`, 조치 뒤 `quoted`로), 만료 주기 작업.
  - LLM `place_order`, `request_owner_approval`을 `OrderQuoteService`에 연결 (금액 입력 없음, 확인 카드만).
  - payment.md "confirm 코드" 절의 "아직" 목록 (TransferLimit 재기록 1회, float 상한, 시작 시 submitting 재확인, 인덱서, 데모 우회, 영수증).
  - 추천 `needsApproval`에 `NEW_MERCHANT` 반영, 최근 주문 읽기 포트.
  - 웹 목을 실제 API로, 지갑 화면 조립(`CustodyNote`), UX 다듬기(D-23 토스급).

### 2026-11-20 주문 흐름 마무리: confirm, place_order, 승인 API, request_owner_approval
- 한 일 (모두 검증 PASS):
  - confirm 결제 (207fc32, 수정 9a6f4ce): 표시 뒤 던짐은 submitting, 30일 재검사, 승인 롤백, attempt는 SQL에서.
  - place_order 연결 (26c6230, 수정 e77c10c): OrdersService 창구, 모델에는 표시 말만, 승인 필요면 APPROVAL_REQUIRED.
  - 승인과 거절 API (28b8834, 수정 ccdfe8a): owner-approvals 모듈, 결정과 주문 효과를 한 트랜잭션에, 레벨 승인은 /agents/me/level 몫.
  - request_owner_approval (6f66ee5, 수정 0dcf4c6): 살아 있는 대기 승인에 메시지, 승인이 필요 없으면 아무것도 만들지 않음.
- 막힌 것: Q-35 결정 대기.
- 후속 (검증 MINOR):
  - 충전 멱등성(요청 ID, 충전 제출 표시)은 실제 경로 연결 전 필수 (payment.md "confirm 코드" 아직).
  - 같은 가게 60초 쿨다운, 한 메시지 안 대기 승인 중복, 살아 있는 quoted 재사용 검토.
  - 승인 응답 카드 만들기에서 체인 RPC가 실패하면 500 (돈 문제 없음), 1분 만료 주기 작업, GET /approvals에 메시지.
  - txHash 대문자 정규화, 결제 지갑과 row.agentId 대조, 경로별 제출 표시(nonce, maws_request_id), 새 견적 전 이전 orderRef 확인.
- 다음 할 일: 레벨 상향 API(`POST /agents/me/level`, 재인증, TransferLimit 확정 뒤 승인 주문 quoted), `GET /orders/:id`, 경로 B 실제 연결, 웹 목을 실제 API로, 지갑 화면 조립(CustodyNote), UX 다듬기(D-23).

### 2026-11-20 데모 유저플로우 전체 조립, D-26/27/28
- 한 일:
  - 목 모드에서 user-flow 17개 화면을 모두 조립하고 검증 PASS (지갑과 신분증과 멈춤 880f6f7, 주문 화면 7cd95dd, 한도 장면 a380b1d). 로그인부터 시작하는 EntryGate, 목 대화 반복 고침, "…" 404 고침.
  - 로컬 http 모드: dev 로그인(`DEV_LOGIN`), 신원 확인 `POST /identity/verify`(목 기록).
  - D-26 데모 LLM 비용 (0f69643, 수정 80bd8c2): `LLM_MODE=replay`(읽기 도구만, API 호출 없음), live는 KST 하루 토큰 상한(캐시 포함), 닿으면 용이가 피곤하다는 한 줄만. effort 기본 low.
  - D-27 데모 시드 가게는 승인 없이 (4b02b96).
  - D-28 레벨 바꾸기 `POST /agents/me/level` (760c63c), 웹 http 연결 (7bf6c0c).
- 막힌 것: 없음. 호재 님 Xcode 설치 후 iOS 시뮬레이터로 폰 화면 보기.
- 후속:
  - 레벨 올린 뒤 OVER_LEVEL 승인 주문을 다시 견적으로 (http, approvalId 연결).
  - http에서 아직 거절하는 것: 지갑, 신분증, 멈춤, 환불, 맛 평가, 체험 용돈.
  - production에서 replay 허용 여부, 장면 시나리오 재생, 하루 상한 동시성.
  - 충전 멱등성(실제 경로 전 필수), 60초 쿨다운, 1분 승인 만료 작업, 영수증 시각, 목 30일 창 초기화, 결제 때 주머니 감소.
  - D-23 UX 다듬기: Skeleton, iOS 키보드(visualViewport), Next dev 표시.
- 다음 할 일: 위 검증 결과 반영, 경로 B 실제 연결, OAuth.

### 2026-11-20 파우치 스파이크 S14, http 모드 전환, 파우치 로그인 (D-29)
- 한 일:
  - S14 문서 조사와 파우치 앱 등록(tenant_369d04cfd8, localhost:3000, sandbox 키는 git 밖 .env.pouchi). 문의 모음 `docs/_research/pouchi-questions.md` (5개, S14 끝에 호재 님께 정리).
  - D-29: 로그인은 파우치 로그인 하나, 시작 버튼 "이메일로 시작하기", 웹은 http 모드로.
  - 서버 API 채움: GET /wallet와 주인 용돈 장부(allowance, 0006), POST /signup/trial, freeze/unfreeze/drain(AgentLock으로 한 줄), GET /me/id-card, POST /orders/:id/rating(0007), 즉시 충전을 장부 fund로, GET /identity.
  - 파우치 로그인: 서버(pouchi 모듈, users의 config/bind/complete, pouchi_accounts 0008, PKCE challenge 비교, IP당 1분 10회, trust proxy), 웹(세션 입구 lib/session/entry.ts, EmailStart와 TermsLine, /pouchi/callback, 입구가 Verify와 Name을 가름).
  - 홈 화면 추가용 manifest(주소창 없이), iOS 시뮬레이터(Xcode 27의 DeviceHub).
  - 로컬 개발: 루트 .env(비밀 없음 + 파우치 키 복사, git 밖), 마이그레이션 0006~0008 적용, 시드.
- 실수 기록: 커밋 제목이 게이트 상한(콜론 뒤 71자)을 넘은 것 둘. 24d48a9와 ee5c736. dev-loop.md대로 amend하지 않는다. `pnpm verify --precommit`은 메시지를 보지 않으므로 커밋 전에 제목 길이를 따로 센다.
- 막힌 것: 실제 파우치 금고 로그인(이메일 코드, 패스키)은 사람이 해야 해서 아직 끝까지 돌려 보지 못했다. 테넌트 `pending-approval`이 풀렸는지 모른다.
- 열린 질문: Q-37(이번 달 아낀 돈), Q-38(장부가 모자라면 주문을 막나).
- 후속:
  - Start 시안 갱신(한 버튼), 예산 화면 30일 사용액이 목 체인에서 0(개발 ChainReader가 목 결제를 읽지 않음).
  - 체험 용돈 버튼 실패 표시, 파우치 BFF 예제의 로그인 전 세션 범위 pending과 Origin 검사, bind만 셀지(IP 제한).
  - 장부 실체인 전 할 일(영수증 금액, txHash 유일 열쇠, 체인 멈춤 뒤 drain), REVOKED 오류 코드, 동결과 confirm 겹침.
  - OWNER_MODE=pouch(PouchOwner)와 S14 2단계 실행(배포, 세션 키 실험은 React SDK spikes에서).
- 다음 할 일: 호재 님 실제 로그인 결과를 보고 고치기, Start 시안, 30일 사용액, D-23 UX 다듬기.

### 2026-11-20 실제 LLM 대화, 한도 금액(D-31), 캔버스 시안과 종별 테마(D-32), 체인 확인
- 한 일:
  - 대화: OpenAI 공급자(D-30), 음식 주제 제한, 쓰는 중 점 셋과 스트리밍, 회색 스크롤바 숨김, 위로 올려 읽다가 보내면 맨 아래로(followKey).
  - 목 체인 30일 사용량, 배달 단계 흉내(목과 데모만), 검증 FAIL 수정 커밋들.
  - 테스트넷 준비: 운영자 키를 .env에 새로 만듦(주소 0xBb71B672BC33745283842ce701F5b0FC28d023d3, 값은 출력 안 함), faucet 5,000 tOKRW 1회. 배포는 아직. `@maroo-chain/viem` 0.5.0 타입으로 deployPclProxy(kind Transparent 1, UUPS 2, initializer 같이)와 policy 빌더(agentOkrwTransferLimit, periodicVolume, and, eas)를 확인(Q-13 후속).
  - D-31 (7803f0c): 한도는 사용자가 금액으로, 레벨 없앰, 월 예산은 내 30일 한도로 합침, 드래곤은 금액 구간으로 자람. PUT /agents/me/limits, 마이그레이션 0009.
  - 캔버스 시안 반영과 D-32 (b774a33): 종별 테마 색, Look, Themes. 들어온 시안이 D-31 전 것이라 D-31 문구를 다시 얹음.
  - 체인 읽기: 파우치 EntryPoint v9가 PCL entrypoints에 있음(Q-39), KYC recipient는 스마트 지갑(Q-19, Q-40).
  - main 머지와 push (c31890b까지).
- 실수 기록 (amend 안 함, dev-loop.md):
  - 7fa0080은 게이트 FAIL(D18 경계, lint) 상태로 커밋됐다. 게이트 출력을 `tail`로 넘겨 종료 코드를 보지 않았다. 3c4d4da로 고쳤고, 이후 커밋은 게이트 종료 코드가 0일 때만 한다.
  - 7c1761c 제목의 종류 `design`은 허용 목록에 없다(G2). 시안 커밋은 `docs(design)`으로 쓴다.
  - b774a33에 Verify 행의 KYC recipient 내용(Q-19 반영)이 같이 들어갔다. 원래 37d9d70의 일이다.
- 막힌 것: 테스트넷 배포는 faucet 두 번째 수령을 멈춘 뒤 호재 님 지시 대기.
- 열린 질문: Q-37(아낀 돈, D-31 뒤 뜻 바뀜), Q-38, Q-40(마루 KYC 담당자께).
- 후속: web.md의 레벨 설명(43, 75, 81, 87행)과 Chip `lg` 죽은 크기는 D-32 UI 작업(별도 worktree)과 겹쳐 그 브랜치를 합친 뒤 고친다(7803f0c 검증 지적). 충전 코드가 floatCapAokrw를 쓰게, web 테스트가 turbo 병렬에서 5초 타임아웃(불안정), D-32 tech-spec과 위키 반영, 시작 화면 아래 한 줄은 D-17 설명 문구에 가까움(지울지 판단).
- 다음 할 일: D-32 구현(테마 CSS 변수, Look), Splash, 진행 중 주문 카드, 주문 내역 버튼, 브라우저 QA 결과 반영.

### 2026-11-20 브라우저 QA 반영과 5a071b5..e206c2c 검증 지적
- 한 일:
  - 숨은 글자(.srOnly)가 문서를 길게 만들던 것 (6cd3aeb), 한도 올린 뒤 기다리던 주문을 다시 견적으로 `POST /orders/:id/requote` (fd1c510)와 웹에서 확인 시트를 연 채로 대화로 (39db1ca), 멈추기 바로 이동과 멈춘 동안 입력 끔 (aacd6eb), 한 번에 > 30일 금지(D-31 한 줄, 52dbee1), 지난 한도 카드와 지난 한도 링크 (9090db9), "집으로"와 처음 사용자 안내 글 (21d6cf5), 스위치 44px (efd343b).
  - 검증 지적: LimitChangeCard 고정 테마 (02e53a3), Splash "체험용 데모"와 키보드 건너뛰기, verify.py 금지 말 "테스트넷" (fef6d0b), 주문 내역 줄은 열 화면이 있을 때만 누름과 failed는 "멈춤" (3b6a01f), Chip `lg` 없앰 (71b9e79), web.md 레벨 설명과 README 문서 수 59 (bc17006).
- 실수 기록 (amend 안 함): 6cd3aeb 메시지에 제목 뒤 빈 줄이 없어 본문 첫 문단이 제목에 붙었다. 이후 커밋은 메시지 파일로 쓴다.
- 못 한 것: 지갑 "이번 달 아낀 돈" 오른쪽 맞춤은 코드와 시안이 같아(값 뒤 16px 띠, 다른 줄의 화살표 16px과 같은 자리) 재현하지 못해 고치지 않았다. 화면 캡처가 있으면 다시 본다. Storybook(6006)은 지워진 BudgetPicker 이야기 색인 오류로 멈춰 있어 다시 띄워야 한다.
- 범위 밖 (보고만): 목 체인이 API 재시작 때 초기화됨, 기본 한도에서 밤 추천이 비는 것, 목 모드에서 부화 화면 건너뜀, 신분증 공유 버튼.
- 다음 할 일: 허락 카드(처음 가게, 30일 한도) 조립 뒤 주문 내역의 허락 대기 줄을 그 카드로, 멈춤과 취소 주문 영수증 화면.

### 2026-11-21 브라우저 QA 2차 반영 (대화, 추천, 화면)
- 한 일: 허락 대기 뒤 모델 말을 막고 서버 문장과 칩(973e47d), 한도 카드를 그 턴의 말 뒤로(be79eb6), 빈 추천의 까닭 `empty`(11d387f), 멈춘 동안 추천 누름에 쉰다는 줄과 입력 안내(573a872), 세션 답 전 Splash는 버튼 아님(3f2ecd2), 날씨 같은 사실은 도구 결과에 있을 때만(3182b93), 영수증 한도 줄은 "지금" 값(b8e2b60), /limit/cap 바로 방문은 대화로(5669a00), 막대 바탕과 꺼진 입력 칸의 `--theme-track`(7a70751), "되용"을 "돼용"으로(9a9a19d).
- 못 한 것: 주인 허락 카드(새 가게, 30일 한도)가 웹에 없어 허락 대기는 서버 문장과 칩으로만 안내한다. 영수증의 주문 때 한도는 주문에 저장하지 않아 보일 수 없다(저장 칸 필요). `WEATHER_PROVIDER=static`은 늘 "비"라 모델이 여전히 비를 말할 수 있다(데모 장면과 맞물려 판단 필요).
- 다음 할 일: 허락 카드 조립 뒤 `approval-wait.ts` 문장과 칩을 그 카드로, 주문에 그때 한도 남기기, 정적 날씨를 실제 날씨나 "모름"으로.

### 2026-11-21 오더스 컨트랙트 테스트넷 실제 배포 (demo 프로필, 호재 님 승인)
- 한 일:
  - `infra/` (`@sikyeoyong/infra`) 새 패키지: `deploy-orders.ts`(forge build, 구현, UUPS `deployPclProxy`+initialize, owner/operator 확인, 정책, 재조회, 기록), `apply-policy.ts`(`--check`). 쓰기마다 eth_call과 estimateGas 시뮬레이션, 가스 예산 300 OKRW, 기록이 있으면 `--force` 없이는 멈춤. `contracts:deploy:testnet`과 `policy:apply`가 이를 부른다. `deploy-testnet.sh`는 지움.
  - shared: `deployments.ts`(검증, `resolveOrdersContract`, env `ORDERS_CONTRACT` 우선), `deployments-data.ts`(등록).
  - 실제 배포 (체인 450815, demo): 구현 `0xf3091258a7ecee5a1b71577a573690bcdf8914e6`(블록 23814924), 프록시 `0x36713c60A8b4E54b56997553aD4b8b16d7C02Db8`(23814926), 정책(23814928). 가스 22.16 tOKRW. tx는 `deployments/450815.demo.json`과 탐색기 `https://explorer-testnet.maroo.io/tx/<해시>`.
  - Q-13 닫음, F-20(정책 admin은 deployPclProxy 호출자), F-21, F-22 기록.
- 다음 할 일: API 체인 모듈이 `resolveOrdersContract`와 `ORDERS_CONTRACT`를 쓰게(지금은 env만), `contractPolicies`를 `ChainReader`로 읽기, 목 가게 `registerMerchant`(가게 payout 키), 에이전트 TransferLimit 기록, `placeOrder` 실제 호출로 한도 revert와 `simulatePclProxy`(Q-14) 확인, `Deploy.s.sol` 주석과 기록 쓰기(이제 TS가 전부 함)를 정리.
- 메모: worktree에는 `.env`가 없어 `node --env-file=<메인 저장소 .env>`로 직접 실행했다 (키는 출력하지 않음).

