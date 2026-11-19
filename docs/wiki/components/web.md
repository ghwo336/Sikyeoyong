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
- 화면 틀(390 기준, 가운데 정렬, 최대 480, 높이 100dvh 세로 줄)은 `app/globals.css`의 `.screen`이고 라우트 layout이 붙인다. page와 컨테이너는 class를 쓰지 않는다.
- 최대 폭 480은 토큰이 없어 날값이다 (후속: tokens.json `size`에 최대 폭을 올린다).
- 여백이 있는 화면(Done, Tracking: 8 20 24, 사이 16)은 `.screen.padded`. 주문 현황 layout(`app/orders/[id]/layout.tsx`)이 쓴다.
- 가입 화면은 모두 `.screen.onboarding`(여백 8 20 32, 사이 22, Name과 Budget 시안 값)이다. 마지막 블록(큰 버튼)은 맨 아래로 붙는다. `app/(onboarding)/layout.tsx`가 쓴다. 22는 간격 토큰이 없어 날값이다.
- 시안과 다른 곳: Verify는 사이 24, Start는 여백 0 24 32(제목 묶음을 가운데), Hatch는 여백 56 24 32에 사이 28이다. 한 class로 맞춰서 지금은 조금씩 다르다. 화면별 layout이나 class로 나눌지는 ui 부족분(제목 묶음, Hatch 가운데 정렬)을 채울 때 함께 정한다.

## 조립 현황 (목 데이터)
| 화면 | 경로 | 컨테이너 | 상태 |
| --- | --- | --- | --- |
| Main | `app/(main)/page.tsx` | `features/budget/containers/BudgetMeterContainer`, `features/chat/containers/ChatContainer` | 대화 기록, 보내기와 실패 다시 보내기, 추천 고르기(견적 요청), 빠른 답장. 허락 필요 가게는 견적이 없어 아직 아무 일도 없다 (허락 카드 미조립) |
| Confirm | Main 위 시트 | `features/orders/containers/OrderConfirmContainer` (ChatContainer 안) | 추천 고르기(`POST /orders` 견적)와 용이의 `order_confirm` 둘 다 시트를 연다. 시키기는 `useConfirmOrder`(목 confirm, 결제 없음)를 부르고 바로 주문 현황으로 넘어간다 (낙관적). confirm이 실패하면 `useConfirmOrder`가 대화로 되돌린다 (`router.replace('/')`). 용이가 이유를 말하는 것은 shared `ChatEvent`의 `order_failed`가 생긴 뒤 |
| Done | `app/orders/[id]/page.tsx` | `features/orders/containers/OrderStatusContainer` | 조리 중. 상태를 4단계로 바꾸는 규칙은 `features/orders/status.ts`(`orderStep`). 결제 전(`quoted`, `pending_approval`)과 멈춘 주문(`failed`, `cancelled`, `refunded`)은 단계로 그리지 않고 위 줄만 보인다 (실패를 접수처럼 보이지 않게). 그 상태들의 화면, 배달 중(Tracking), 도착(Arrived), 상태 다시 받기는 아직 |
| Start, Verify, Name, Hatch, Budget | `app/(onboarding)/<start, verify, name, hatch, budget>/page.tsx` | `features/onboarding/containers/*` | 목으로 끝까지 이어진다: 로그인, 본인 인증, 알 고르기와 이름(빈 이름은 버튼을 끄지 않고 안내), 부화(1초마다 다시 받기, 다 되면 /budget), 예산 고르기와 체험용 용돈, 시작하기(/). 로그인 취소, 인증 실패 다시 시도는 목에서 일어나지 않는다. 약관, 개인정보 링크(/terms, /privacy)는 페이지가 없다 |

## ui에 없는 것 (기록만. 웹에서 마크업을 만들지 않는다)
- Main 위 줄: 용이 44, 이름 18/700, "레벨 1, 한 번에 10,000원까지" 13px, 설정 버튼(…). 맡을 컴포넌트가 없다. 지금은 빠져 있다.
- Main 예산 카드: Meter를 감싸는 흰 카드(1px `line`, 반경 16, 여백 12 14, 바깥 0 20). Meter만 있어 막대가 화면 끝에 붙는다.
- Main 추천 카드 들여쓰기: 시안은 추천 카드가 드래곤 말 아래 같은 칸(32 + 10 들여쓰기)에 있다. DragonLine에 자식 자리가 없고 RecommendationList는 들여쓰지 않아 지금은 화면 폭 그대로다.
- 입력칸 아래 띠: ChatInput.md는 "화면이 그린다"(여백 10 16 24)지만 웹은 스타일을 두지 않으므로 지금은 입력칸이 화면 끝에 붙는다. ui에 대화 화면 아래 띠(또는 ChatInput 안 여백)가 필요하다.
- 시안끼리 다른 문구: 요청이 Confirm은 "깍두기 많이", Done은 "깍두기 많이, 문 앞에 두고 가 주세요"다. 목은 둘 다 "깍두기 많이"로 둔다. 어느 쪽이 맞는지 캔버스에서 정한다.
- 가입 화면 제목 묶음: Start("배달은 용이한테 시켜용" 30/700과 설명 15px), Verify, Name(26/700 제목과 15px 설명)을 그릴 컴포넌트가 없다. 지금은 빠져 있다.
- Name 아래 한 줄 "레벨 1로 태어나요. 한 번에 10,000원까지." (14px): 컴포넌트가 없다.
- Verify, Name 위 단계 막대: 시안은 48 높이 줄 안에 막대만 있다. TopBar는 trailing만 있으면 34 빈 칸을 두므로(Budget용) StepProgress를 줄 없이 그렸다. 높이 48 줄이 빠져 있다.
- Hatch: 알(176)이 가운데가 아니라 왼쪽에 붙는다(Egg가 스스로 가운데 정렬하지 않음). 시안 글씨는 고운돋움 22에 설명 14px("1~3분 걸려요. 다 되면 알려 드릴게요.")인데 DragonLine center는 19이고 설명 줄을 그릴 곳이 없다. 단계 카드는 맨 아래에 붙는다 (시안은 알 묶음이 가운데).
- Budget: 용이 말은 시안이 20px인데 DragonLine inline은 17이다. 체험용 용돈 줄은 시안이 이름 아래 금액(13px), 위 1px 선이고 ListRow는 금액을 오른쪽에 둔다. 받기 버튼은 받은 뒤 모양이 없어 그대로 남는다.
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
