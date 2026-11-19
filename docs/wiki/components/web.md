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
- 목 `confirmOrder`는 결제하지 않는다. 주문을 조리 중으로 바꿀 뿐이다.
- 목 `sendChatMessage`는 SSE 대신 이벤트 배열을 한 번에 준다. 실제 스트림으로 바꿀 때 훅이 이벤트를 대화 항목으로 묶는 부분은 그대로 쓴다.
- 서버 상태는 TanStack Query(`lib/query-provider.tsx`, 루트 layout에서 한 번). mutation은 자동 재시도하지 않는다 (절대 규칙 9).
- 화면 문자열 도우미(`lib/format.ts`): "25분", "가게에서 어디로, 25분쯤", "오늘 오후 12:28"(기기 시간대와 상관없이 KST).

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
- E2E(Playwright): 데모 장면을 브라우저에서 재현 (`conventions/testing.md`).
- 360px 너비에서 레이아웃이 깨지지 않는다.

## 열린 질문
- Q-20 시연 기기 (웹 먼저로 정해짐. iOS 필요 여부만 남음)

## 관련 문서
- `conventions/architecture.md`, `conventions/design-and-motion.md`, `components/ui/_index.md`
- 저장소 `design/README.md`, `design/user-flow.md`
- `docs/tech-spec.md` 2장 (D-18 대응표로 읽는다)
