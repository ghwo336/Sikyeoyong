---
node: leaf
parent: _index.md
children: []
---

# 웹 (apps/web, Next.js)

## 책임
- 사용자 화면을 조립한다: 가입, 대화와 추천, 주문 확인, 주문 현황(조리 중, 배달 중, 도착), 주문 상세, 한도 화면, 용이 관리. 화면 목록과 경로는 저장소 `design/README.md`.
- 페이지마다 `packages/ui` 컴포넌트를 배치하고, `features/<기능>/hooks`의 데이터를 `containers`로 연결한다.
- 모바일 화면 웹(기준 너비 390, 가운데 정렬 최대 480). 360에서도 깨지지 않게.

## 책임 아님
- 컴포넌트 그리기 (`packages/ui`가 한다. 웹은 배치만)
- 금액 계산, 한도 판정, 잔소리 판정, 추천 계산 (API)
- 체인 호출, 지갑 서명, 키 보관, LLM 호출 (API. 웹에는 어떤 키도 없다)
- OAuth 토큰 교환과 세션 발급 (API의 auth 모듈)

## 의존과 인터페이스 경계
- `packages/ui`(그리기), `packages/shared`(타입, zod 스키마, API 클라이언트, 금액 포맷)만 import한다. 구조 규칙은 `conventions/architecture.md`.
- API는 같은 도메인 `/api`로 부른다 (Caddy가 API 서버로 넘김). 세션은 API가 발급한 httpOnly 쿠키라 웹 코드가 토큰을 만지지 않는다.
- 서버 상태는 TanStack Query. 로컬 상태는 컴포넌트 안 `useState`로 충분하면 그것만, 여러 화면이 같이 쓰면 zustand.
- 대화 스트리밍은 API의 SSE(`ChatEvent`, `packages/shared/src/chat-events.ts`). 이벤트를 프레임 단위로 묶어 그린다.

## 반드시 지킬 규칙 (MUST)
- **페이지는 조립만** (`conventions/architecture.md`). `page.tsx`에 스타일, 상태 로직, `fetch`, 금액 계산을 두지 않는다.
- 화면은 `design/` 시안대로. 문구, 슬롭 금지, 움직임, 성능은 `conventions/design-and-motion.md`.
- 결제는 확인 시트의 버튼이 부르는 `POST /api/orders/:id/confirm`으로만 시작한다. 대화 입력창의 "응"으로 결제하지 않는다.
- 결제 버튼은 낙관적 UI로 바로 다음 화면으로 넘어가고, 실패하면 되돌린 뒤 드래곤이 이유를 말한다.
- 막힘(체인 거절), 허락 대기, 멈춤 상태를 화면에서 구분한다. 사용자가 "왜 안 됐는지"를 알 수 있어야 한다.
- 영수증의 결제 기록 번호, 통과한 규칙 이름, 탐색기 링크는 "자세히 보기" 안에서만 보여 준다. 체인이 실제로 검사한 규칙만 넘긴다 (tech-spec 2.5).
- 금액은 aokrw 문자열을 `bigint`로 받아 `formatOkrw`로만 표시한다.
- 토큰과 글꼴은 루트 `app/layout.tsx`에서 한 번만 불러온다: `@sikyeoyong/ui/tokens.css`, Pretendard Variable(npm `pretendard`, 동적 서브셋), 고운돋움(npm `@fontsource/gowun-dodum`, 한글과 라틴 400). 토큰의 글꼴 이름과 같게 하려고 `next/font`(이름을 바꿈) 대신 자체 호스팅 CSS를 쓴다. 페이지 전체 기본값은 `app/globals.css`(토큰 변수만).
- 동작 줄이기는 전역에서 끄지 않는다. 각 ui 컴포넌트가 Motion `useReducedMotion`이나 자기 CSS 모듈의 `prefers-reduced-motion`으로 "이동 없이 페이드만"을 구현한다 (design-and-motion.md).

## API 경계와 목 데이터 (2026-11-19)
- 훅은 `lib/api`의 `api`(`ApiClient` 인터페이스)만 부른다. 지금 구현은 `lib/mock/client.ts`(브라우저 안 가짜 서버)이고, 실제 API로 갈아 끼울 때는 `lib/api/index.ts` 한 줄만 바꾼다. 목은 `lib/mock/` 한 곳에만 둔다 (`fixtures.ts`는 시안 문구와 금액, `client.ts`는 동작).
- `lib/api/types.ts`는 임시 타입이다 (파일 맨 위 "TODO: packages/shared/src/api로 교체"). shared에 스키마가 생기면 하나씩 지우고 shared에서 import한다. `BudgetView`는 이미 shared(`zBudgetView`)를 쓴다.
- 목 `confirmOrder`는 결제하지 않는다. 주문을 바로 `submitting`으로 두고 잠시 뒤 조리 중으로 바꿀 뿐이다. 목 `getOrder`는 confirm된 주문만 안다 (새로고침하면 서버 재시작처럼 잊는다).
- 목 `sendChatMessage`는 SSE 대신 이벤트 배열을 한 번에 준다. 실제 스트림으로 바꿀 때 훅이 이벤트를 대화 항목으로 묶는 부분은 그대로 쓴다.
- 서버 상태는 TanStack Query(`lib/query-provider.tsx`, 루트 layout에서 한 번). mutation은 자동 재시도하지 않는다 (절대 규칙 9).
- 화면 문자열 도우미(`lib/format.ts`): "25분", "가게에서 어디로, 25분쯤", "오늘 오후 12:28"(기기 시간대와 상관없이 KST).

## 화면 틀
- 화면 틀(390 기준, 가운데 정렬, 최대 480 `size.screenMax`, 높이 100dvh 세로 줄)은 `app/globals.css`의 `.screen`이고 라우트 layout이 붙인다. page와 컨테이너는 class를 쓰지 않는다.
- 여백이 있는 화면(Done, Tracking: 8 20 24, 사이 16)은 `.screen.padded`. 주문 현황 layout(`app/orders/[id]/layout.tsx`)이 쓴다.
- 가입 화면은 `.screen.onboarding`(여백 8 20 32, 사이 22 `size.signupGap`, Name과 Budget 시안 값)이고 마지막 블록(큰 버튼, 로그인 버튼, 부화 단계 카드)은 맨 아래로 붙는다. 화면마다 여백이 달라 그룹 layout 대신 가입 라우트마다 layout이 있다 (`app/(onboarding)/<화면>/layout.tsx`):
  - Verify `.screen.onboarding.verify`: 사이 24
  - Start `.screen.onboarding.start`: 여백 0 24 32, 사이 0. 알과 제목 묶음(ui `Hero`)이 남은 높이 가운데
  - Hatch `.screen.onboarding.hatch`: 여백 56 24 32(`size.hatchTop`), 사이 28. 알과 말 묶음(ui `Hero`)이 남은 높이 가운데
- 대화 화면(Main)은 `.screen` 하나에 ui `ChatLayout`이 띠(위 줄 16 20 12, 예산 0 20, 입력칸 10 16 24)를 그린다.

## 가입 뒤로 (Verify, Name)
- 뒤로 버튼은 브라우저 기록(`router.back()`)이 아니라 이전 단계로 `router.replace`한다: Verify는 /start, Name은 /verify (2026-11-19 판단).
- 이유: 새로고침은 기록이 남지만, 직접 링크나 새 탭으로 들어오면 앞 기록이 없거나 다른 사이트라 `router.back()`이 아무것도 안 하거나 앱을 떠난다. 가입은 한 줄로 이어지는 단계라 "뒤로"는 언제나 앞 단계다. push 대신 replace라 브라우저 뒤로로 같은 단계를 오가며 기록이 쌓이지 않는다.
- 남는 것: replace 뒤 브라우저 뒤로는 그 단계에 들어오기 전 기록으로 간다. 로그인 전 사용자를 어디로 보낼지(로그인했으면 /start를 건너뛸지)는 실제 세션이 붙을 때 정한다.

## 부화 다시 받기 (Hatch)
- 규칙은 순수 함수 `features/onboarding/hatch.ts`의 `hatchPollInterval` 하나다. `useAgentSetup`은 이 값을 TanStack Query `refetchInterval`로 넘기기만 한다.
- PENDING이거나 아직 모르면(첫 응답 전) 1초마다 다시 묻는다. ACTIVE면 멈추고 /budget으로 넘어간다. FAILED면 멈추고 "다시 깨우기"만 다시 시작한다.
- 오류일 때는 계속 묻는다 (2026-11-19 판단). GET은 몇 번 불러도 안전하고, 부화는 1~3분이라 잠깐 끊긴 네트워크로 화면이 멈추면 안 되며, 부화 중에는 다시 시도 버튼도 없다. 실패한 GET은 마지막 상태를 그대로 두므로(TanStack Query는 오류에도 data를 지킨다) 오류만으로는 멈추지 않는다. 오류를 화면에 어떻게 보일지는 "남은 일 (가입)"의 실패 표시 자리와 같이 정한다.

## 조립 현황 (목 데이터)
| 화면 | 경로 | 컨테이너 | 상태 |
| --- | --- | --- | --- |
| Main | `app/(main)/page.tsx` | `features/chat/containers/ChatContainer`(ui `ChatLayout`), `features/me/containers/DragonHeaderContainer`(ui `ChatHeader`), `features/budget/containers/BudgetMeterContainer`(Meter `framed`) | 위 줄(용이, 레벨 한 줄, 설정은 `/dragon`으로 가지만 페이지는 아직 없다), 예산 카드, 대화 기록, 용이 말 아래 추천 카드(`threadRows`가 말 바로 뒤 추천을 그 말의 DragonLine children으로 묶는다), 보내기와 실패 다시 보내기, 추천 고르기(견적 요청), 빠른 답장. 허락 필요 가게는 견적이 없어 아직 아무 일도 없다 (허락 카드 미조립) |
| Confirm | Main 위 시트 | `features/orders/containers/OrderConfirmContainer` (ChatContainer 안) | 추천 고르기(`POST /orders` 견적)와 용이의 `order_confirm` 둘 다 시트를 연다. 시키기는 `useConfirmOrder`(목 confirm, 결제 없음)를 부르고 바로 주문 현황으로 넘어간다 (낙관적). confirm이 실패하면 `useConfirmOrder`가 대화로 되돌린다 (`router.replace('/')`). 용이가 이유를 말하는 것은 shared `ChatEvent`의 `order_failed`가 생긴 뒤 |
| Done | `app/orders/[id]/page.tsx` | `features/orders/containers/OrderStatusContainer` | 조리 중. 상태를 4단계로 바꾸는 규칙은 `features/orders/status.ts`(`orderStep`). 결제 전(`quoted`, `pending_approval`)과 멈춘 주문(`failed`, `cancelled`, `refunded`)은 단계로 그리지 않고 위 줄만 보인다 (실패를 접수처럼 보이지 않게). 그 상태들의 화면, 배달 중(Tracking), 도착(Arrived), 상태 다시 받기는 아직 |
| Start, Verify, Name, Hatch, Budget | `app/(onboarding)/<start, verify, name, hatch, budget>/page.tsx` | `features/onboarding/containers/*` | 시안대로 조립했다 (Start `Hero`와 `ScreenTitle`, Verify와 Name `TopBar` 뒤로와 단계 막대, Name 안내 줄 `BORN_LINE`은 정책의 레벨 1 한 번에 한도, Hatch `Hero`, Budget DragonLine greeting과 `TrialAllowance`). 뒤로는 이전 단계로 `router.replace` (Verify는 /start, Name은 /verify, 아래 "가입 뒤로"). 목으로 끝까지 이어진다: 로그인, 본인 인증, 알 고르기와 이름(빈 이름은 버튼을 끄지 않고 안내), 부화(1초마다 다시 받기, 다 되면 /budget), 예산 고르기와 체험용 용돈, 시작하기(/). 로그인 취소, 인증 실패 다시 시도는 목에서 일어나지 않는다. 약관, 개인정보 링크(/terms, /privacy)는 페이지가 없다 |

## ui에 없는 것 (기록만. 웹에서 마크업을 만들지 않는다)
- (2026-11-19 해결) Main 위 줄, 예산 카드, 추천 카드 들여쓰기, 입력칸 아래 띠: ui `ChatHeader`, Meter `framed`, DragonLine `children`, `ChatLayout`으로 채웠다.
- Main 추천 줄 높이: 시안 줄은 64인데 지금은 약 76이다. 시안은 줄간격을 두지 않았고(브라우저 기본) 웹 body는 1.6이라 가게 이름과 메뉴 두 줄이 높아진다. RecommendationList 글자 줄간격을 시안에 맞출지 ui에서 정한다.
- 시안끼리 다른 문구: 요청이 Confirm은 "깍두기 많이", Done은 "깍두기 많이, 문 앞에 두고 가 주세요"다. 목은 둘 다 "깍두기 많이"로 둔다. 어느 쪽이 맞는지 캔버스에서 정한다.
- (2026-11-19 해결) 가입 제목 묶음(Start, Verify, Name), Name 아래 한 줄, Verify와 Name의 48 단계 줄, Hatch 가운데 정렬과 22/14 글씨, Budget 말 20과 체험용 용돈 줄과 받은 뒤 모양: ui `ScreenTitle`, TextField `hint`, `TopBar`(뒤로와 단계 막대), `Hero`, DragonLine `greeting`, `TrialAllowance`로 채웠다.
- Start 알: 시안은 금 간 알 위로 뿔이 보이는 그림인데 `Egg`에 그 상태가 없어 닫힌 알(`closed`)로 그린다. Egg에 상태를 늘릴지 ui에서 정한다.
- 받은 뒤 모양("받았어요")은 시안에 없다. TrialAllowance.md에 디자인 선택으로 적었다.
- ChatEvent에 빠른 답장이 없다: 시안에 칩이 있어 임시 타입에 `quick_replies` 이벤트를 넣었다. shared `ChatEvent`에 추가가 필요하다.

## 남은 일 (가입)
- 체험용 용돈 API 라우트가 tech-spec에 없다. 웹은 한 번만 부르지만, 두 번 와도 한 번만 주도록 서버가 멱등하게 받아야 한다.
- 실패 표시 자리: 로그인 취소, 인증 실패, 부화 실패, 예산 저장 실패를 어디에 어떤 모양으로 보일지 (시안 없음).
- 가입 화면의 '용이' 고정 문구(부화 단계 "용이 용돈 주머니 만들기" 등)가 고른 이름 자리인지 시안에서 확인한다.
- OAuth 리다이렉트 흐름: 지금 `login`은 목 Promise다. 실제로는 제공자 페이지로 갔다가 API 콜백이 쿠키를 주고 돌아온다.

## 하지 말 것 (MUST NOT)
- 체인 ID, RPC, 컨트랙트 주소를 웹 코드에 넣지 않는다.
- `number`로 금액을 계산하지 않는다.
- 사용자 입력을 LLM 프롬프트로 조립하지 않는다 (API가 한다).
- 세션 토큰을 localStorage에 두지 않는다.
- 페이지나 컨테이너에서 마크업과 스타일을 새로 만들지 않는다. 필요한 그림이 없으면 `packages/ui`에 컴포넌트(하네스, 문서 포함)를 먼저 만든다.

## 확장 지점
- 심부름 플러그인이 늘면 대화 화면은 그대로, 결과 카드 컴포넌트만 `packages/ui`에 영역을 추가한다.
- iOS가 필요해지면 PWA 또는 감싸기로 다시 정한다 (Q-20). 웹 코드 구조는 그대로 둔다.

## 테스트 기준
- 페이지 테스트는 하지 않는다 (조립만 하니까). 대신 컨테이너가 훅 결과를 props로 바르게 바꾸는지 테스트한다.
- `pnpm --filter @sikyeoyong/web test`(vitest, jsdom, 서울이 아닌 시간대). 테스트는 `features/**`, `lib/**`의 `*.test.ts(x)`. 결제 버튼은 한 번 누르면 confirm 한 번, 실패하면 대화로 되돌리고 다시 부르지 않음, 추천 고르기와 빠른 답장과 허락 필요 가게는 confirm을 부르지 않음을 지킨다.
- E2E(Playwright): 데모 장면을 브라우저에서 재현 (`conventions/testing.md`).
- 360px 너비에서 레이아웃이 깨지지 않는다.

## 열린 질문
- Q-20 시연 기기 (웹 먼저로 정해짐. iOS 필요 여부만 남음)

## 관련 문서
- `conventions/architecture.md`, `conventions/design-and-motion.md`, `components/ui/_index.md`
- 저장소 `design/README.md`, `design/user-flow.md`
- `docs/tech-spec.md` 2장 (D-18 대응표로 읽는다)
