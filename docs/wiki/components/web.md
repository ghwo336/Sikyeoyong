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
- 추천을 눌렀는데 서버가 거절하면(`POST /orders` 오류, 예: 가게가 사라진 옛 카드의 422 `CHAIN_MERCHANT_INACTIVE`) 용이가 오류의 대사를 대화에 말한다(`features/chat/error-line.ts` `dragonLineOf`: 서버가 보낸 `dragonLine`, 없으면 shared 표의 대사, 값이 필요한 대사는 `message`, API 오류가 아니면 일반 한 줄). 30일 상한(`CHAIN_PERIODIC_LIMIT`)만 Cap 화면으로 간다. 말없이 아무 일도 없는 눌림은 없다 (QA 5차).
- 허락하기의 답(견적)과 안 시킬래요의 후속은 `useDecideApproval`의 훅 수준 `onSuccess`에서 부모에게 넘긴다. 답이 자기 카드를 목록에서 지우면 컨테이너가 사라져 `mutate()` 호출별 콜백이 버려지기 때문이다 (QA 6차: 시트가 안 열림). 같은 추천을 다시 누르면 새 주문 대신 `features/orders/same-pick.ts`로 기존 주문을 쓴다: 허락 대기 중이면 용이가 카드 쪽을 안내하거나(한도 대기는 막힘 화면), 닫은 확인 카드는 다시 연다. 서버에는 같은 메뉴를 알아보는 키가 없다.
- 읽기가 실패하면 그 자리에 `RetryLine`(오류 한 줄과 다시 불러오기)을 둔다. 블록을 말없이 빼지 않는다: 용돈 화면의 한도 줄(`/budget` 실패), 주문 내역(`/orders` 실패). 용이 모습과 신분증 줄은 예산 없이도 보이고, 멈추기 줄만 예산을 기다린다 (QA 6차).
- 멈춘 주문 화면의 용이 대사는 `features/orders/failed.ts` `stoppedLine`이 정한다: 다시 시도가 없는 주문에서 서버 대사가 "그래도 시킬까용?" 같은 질문이면 대화로 가라는 평서문으로 바꾼다 (버튼이 대화로 돌아가기뿐이라서, QA 6차). 한도 변경(`useSetLimits`)은 예산 재조회를 기다리지 않는다: 체인을 읽는 `/budget`이 느려도 누른 버튼이 "확인 중"에 머물지 않는다.
- 대화 SSE `approval_request {orderId, reason}`를 받으면(`useChat`의 `onApprovalRequest`) approvals와 orders 목록을 바로 다시 받아 허락 카드가 뜨게 하고, reason이 `OVER_LEVEL_LIMIT`이면 막힘 화면(`/limit/<orderId>`)으로 보낸다. 영수증의 `explorerUrl`은 없을 수 있다(탐색기 없는 흉내 체인): 없으면 "마루 탐색기에서 보기" 링크를 그리지 않는다.
- 서버 상태는 TanStack Query. 로컬 상태는 컴포넌트 안 `useState`로 충분하면 그것만, 여러 화면이 같이 쓰면 zustand.
- 대화 스트리밍은 API의 SSE(`packages/shared/src/api/chat.ts`의 `zChatEvent`). 이벤트를 프레임 단위로 묶어 그린다.

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
- 훅은 `lib/api`의 `api`(`ApiClient` 인터페이스)만 부른다. 구현은 `NEXT_PUBLIC_API_MODE`로 고른다: 비우거나 `mock`이면 `lib/mock/client.ts`(브라우저 안 가짜 서버), `http`면 `lib/api/http-client.ts`(같은 출처 `/api`, 쿠키 세션, 쓰기에 `X-Requested-With`). HTTP 클라이언트는 모든 응답을 shared zod 스키마로 검사하고, 에러 본문은 `AppError`(code, `detail.status`, `message`, `dragonLine`)로 바꾼다. 대화 SSE는 오는 대로 읽어 이벤트마다 `onEvent`로 넘기고 끝나면 전체를 돌려준다(2026-11-20, D-23). `useChat`은 쓰는 중인 답을 그린 항목만 바꿔 끼우며 글자가 흐르게 보이고, 첫 글자나 카드가 오기 전에는 ui `TypingIndicator`(용이와 점 셋)를 그린다. 목도 같은 `onEvent`로 넘긴다. 본인 인증은 `POST /api/identity/verify`. 로그인은 `NEXT_PUBLIC_DEV_LOGIN_KEY`가 있으면 API의 개발용 로그인(`POST /api/auth/dev-login`, API가 `DEV_LOGIN=true`일 때만)으로 그 키의 사용자로 들어가고, 없으면 바로 로그인(`login()`)은 `INTERNAL`이고, 실제 로그인은 세션 입구(아래)가 금고로 한다. 체험용 용돈은 `POST /api/signup/trial`(`zTrialResult`, 2026-11-20). 용이 모습 바꾸기는 `patchAgent(agentId, { dragonSpecies })` = `PATCH /api/agents/:id`(`zPatchAgentBody`, `zPatchAgentResult`, agentId는 GET /me의 `agentId`, D-32), 주문 목록은 `listOrders()` = `GET /api/orders`(`zOrderList`, 최근 `ORDER_LIST_MAX` 20개, 새것부터, 확인 안 한 견적은 빠짐). 목은 종을 세션에 바꿔 두고, 목록은 결제한 목 주문을 지금 상태로 돌려준다 (2026-11-20). 목은 `lib/mock/` 한 곳에만 둔다 (`fixtures.ts`는 시안 문구와 금액, `client.ts`는 동작).
- 로컬 https (2026-11-20): 파우치 SDK는 콜백이 https일 때만 금고를 연다(http면 `POUCHI_EMBEDDED_REQUEST_INVALID`, devrel F-19). 그래서 금고 로그인을 로컬에서 하려면 `pnpm dev:certs`(한 번, `.certs/`에 로컬 CA와 localhost 인증서, git 밖) 뒤 `pnpm dev:api`와 `pnpm dev:web:https`로 띄우고 `.env`의 `PUBLIC_BASE_URL=https://localhost:3000`. 파우치 앱에는 `https://localhost:3000` 출처와 콜백이 등록돼 있다. iOS 시뮬레이터는 `xcrun simctl keychain booted add-root-cert .certs/dev-ca.pem`로 신뢰(비밀번호 없음), 맥 브라우저는 `scripts/dev-certs.sh` 주석의 `security add-trusted-cert`(비밀번호 필요).
- 세션 입구 (2026-11-20, D-29): 모든 로그인은 `lib/session/entry.ts` 하나를 지난다. `startSession`은 `loginKind`(`lib/api`)에 따라 금고(파우치 Browser SDK `pouchiEmbedded.login`, `http` 모드이고 개발 키가 없을 때)나 바로 로그인(목, 또는 `NEXT_PUBLIC_DEV_LOGIN_KEY`의 개발용 로그인)을 쓴다. 금고는 열리기 전 `POST /api/auth/pouchi/bind`로 요청을 묶고 결과를 `POST /api/auth/pouchi/complete`로 한 번 보낸다(서버가 세션 쿠키). SDK는 이 파일 안에서만 브라우저일 때 불러온다. Start는 ui `EmailStart`("이메일로 시작하기" 하나). 금고는 가입과 재로그인이 같은 흐름이라 로그인에 성공하면 Start도 콜백도 `/`(입구)로 보내고 입구가 다음 단계를 정한다. `loginKind`는 `lib/api/login-kind.ts`의 순수 함수. 파우치에 카카오가 들어오면 이 파일과 첫 버튼만 바꾼다. Start 시안(두 버튼)은 갱신이 남았다.
- 입구 (2026-11-20): `/`(대화)는 `features/me/containers/EntryGate`로 감싼다. 판정은 순수 함수 `features/me/entry.ts`의 `entryRoute`: `GET /me`가 401이면 `/start`, 404(용이 없음)면 `GET /api/identity`를 물어 본인 인증 전이면 `/verify`, 마쳤으면 `/name`(이 답을 못 받으면 `/verify`, 다시 인증해도 바뀌는 것이 없다), 부화가 끝나지 않았거나 실패했으면 `/hatch`, 다 되었으면 대화를 그린다. 판정 전에는 아무것도 그리지 않는다(잘못된 화면이 번쩍이지 않게). 401, 404가 아닌 오류(5xx, 오프라인)는 세 번 다시 물은 뒤 화면을 그대로 그려 화면이 자기 오류를 보이게 한다(빈 화면으로 멈추지 않게, `retryMe`). 로그인하면 남아 있던 `me` 캐시를 지운다. 아직: 판정 동안 뼈대(Skeleton) 보이기(D-23), Budget 단계도 판정에 넣기(서버가 예산 설정 여부를 알려 주면). 목은 첫 방문을 로그인 전으로 시작하고 진행한 단계를 탭의 `sessionStorage`에 기억한다(새 탭은 다시 처음부터). 테스트는 `resetMockSession('hatched' | 'first-visit')`로 시작점을 정한다. 목 용이는 몇 가지 말만 알아듣는다(진짜 답은 Claude): 메뉴 이름은 확인 카드, "싼"은 가장 싼 것, 예산 말(예산, 다 쓴, 남았, 얼마)은 이번 달 쓴 돈과 남은 돈(넘었으면 얼마나), 먹는 말(시켜, 추천, 점심, 저녁, 배고, 먹)은 추천 카드, 그 밖은 카드 없이 한 줄이다(같은 카드가 되풀이되지 않게).
- 주문 뒤 화면 (2026-11-20): `/orders/[id]`가 상태에 따라 조리 중(Done), 배달 중(Tracking: 남은 분이 먼저, `DeliveryMap`), 도착(Arrived: `ArrivedContainer`, 이번 달 배달비, 아낀 돈, 맛 평가 `rateOrder`, 주문 상세 링크)을 그린다. 도착 전까지 2초마다 다시 묻는다. `/orders/[id]/receipt`는 Receipt: 주문 줄, 결제 수단, 한 번에와 30일 한도, 자세히 보기(`ReceiptDetails`, 기기의 자세히 보기 설정이 켜져 있으면 처음부터 펼침, 블록체인 말은 이 안에서만, D-17). 영수증 값은 `OrderView.receipt`(shared `zOrderReceipt`, 서버는 영수증을 쓸 때 채운다). 목 주문은 결제 뒤 20초 조리, 20초 배달, 그다음 도착이고(데모 속도), 영수증의 결제 기록 번호는 지어낸 값이다. 지도는 시안의 길 하나(`features/orders/map.ts`)이고 라이더 위치는 남은 분으로 정한다(`riderProgress`). 아직: 영수증 시각(주문 시각이 `OrderView`에 없다), 맛 평가를 추천에 반영, 실제 배달 위치.
- 한도 장면 (2026-11-20, user-flow 12~14, D-31): 한도는 레벨이 아니라 금액이다. 바꾸기는 `ApiClient.setLimits`(`useSetLimits`. `http`에서는 `PUT /api/agents/me/limits`, D-28, 서버가 한 번에 쓸 돈을 체인에 먼저 쓰고 답의 두 금액은 문자열로 검사)이고, 목은 한 번에 쓸 돈을 세션에 둔다. 추천의 `needsApproval`은 목이 지금 한 번에 한도로 다시 정하고, 대화는 지난 카드도 `needsApprovalNow`로 다시 그린다. Blocked가 제안하는 금액은 `features/limits/fit.ts`의 `limitToFit`, Main 위 줄의 한도 한 줄은 `features/me/limit-line.ts`의 `limitLine`("한 번에 10,000원까지"), 가입 예산 화면은 `BudgetSetupContainer`의 두 조절기(바뀐 값만 보낸다). 30일 한도는 user-flow "데모에서 보여 줄 순서" 4대로 데모 프로필(60,000원, 1시간)을 쓰고, 결제하면 30일 사용량과 이번 달 쓴 돈이 늘어난다(41,000원에서 시작해 국밥 두 그릇 뒤 세 번째가 막힌다). 목 용이는 "올려", "한도"에 변경 카드를 띄운다. 목의 거절은 HTTP처럼 거절된 프로미스로 돌아온다.
- 용이 관리 화면 (2026-11-20): `/dragon`(Wallet: 용돈, 한도와 예산 줄, 신분증, 멈추기, 자세히 보기, 수탁 한 줄), `/dragon/id`(IdCard), `/dragon/frozen`(Frozen: 돌려받기, 깨우기). 컨테이너는 `features/wallet/containers`에 영역별로 하나씩이고 페이지는 조립만 한다. 돈과 신분증 값은 `ApiClient.getWallet`, `getIdCard`(shared `zWalletView`, `zIdCardView`), 멈춤은 `setFrozen`, 돌려받기는 `refundPocket`. `http` 모드는 `GET /api/wallet`, `GET /api/me/id-card`, `POST /api/agents/me/freeze`와 `/unfreeze`, `POST /api/agents/me/drain`을 부르고 답을 shared 스키마(`zWalletView`, `zIdCardView`, `zFreezeResult`, `zRefundResult`)로 검사한다 (2026-11-20). 맛 평가는 `POST /api/orders/:id/rating`. 목은 실제처럼 움직인다(멈추면 예산 화면의 `frozen`, 돌려받으면 주머니가 주인님 용돈으로). 자세히 보기는 기기 설정이라 이 브라우저의 `localStorage`에만 둔다(`useDetailsMode`). 아직: 채우기 흐름, 한도 줄을 눌러 한도 바꾸기, 영역 사이 구분선(시안의 빈 띠), 신분증 공유하기 버튼.
- API 모양은 `packages/shared/src/api`의 zod 스키마가 원본이다. `lib/api/types.ts`는 그 타입을 화면이 쓰던 이름으로 다시 내보내고 `ApiClient`만 정의한다. 목 응답은 `lib/mock/schema.test.ts`가 shared 스키마로 검사한다 (목이 서버와 다른 말을 하면 테스트가 깨진다). 서버 용 표정 목록(`DRAGON_MOODS`)과 ui `DragonMood`는 컴파일 시점에 같은지 확인한다.
- 목 `confirmOrder`는 결제하지 않는다. 결제한 시각만 기록하고(30일 사용량과 이번 달 쓴 돈은 늘린다) 다시 눌러도 시계를 다시 시작하지 않는다. 목 `getOrder`는 그 시각에서 지난 시간으로 상태를 계산한다(20초 조리, 20초 배달, 그다음 도착). confirm된 주문과 승인 대기 주문만 안다 (새로고침하면 서버 재시작처럼 잊는다). 목 영수증의 결제 기록 번호는 지어낸 값이라, "마루 탐색기에서 보기"는 실제 테스트넷 탐색기로 가지만 그런 거래는 없다.
- 목 `listOrders`는 주인에게 주문이 하나라도 있으면 맨 끝(가장 오래된 것)에 멈춘 주문 한 건(`order-stopped-example`, `failed`)을 덧붙여 주문 내역에 "멈춤" 줄이 보이게 한다. 첫 주인은 내역이 비어 있다. 그 줄을 누르면 주문 현황의 멈춤 화면이 열리고(`getOrder`도 이 주문을 답한다) 다시 시도하기는 목에 이 주문이 없어 실패 한 줄이 뜬다. 30일 창은 단위 시각(unix) 기준 다음 정시에 다시 채워지고(`lib/mock/window.test.ts`가 고정 시계로 지킨다), 첫 결제 시각 더하기 한 시간이 아니다.
- 목 `sendChatMessage`는 SSE 대신 이벤트 배열을 한 번에 준다. 실제 스트림으로 바꿀 때 훅이 이벤트를 대화 항목으로 묶는 부분은 그대로 쓴다.
- 서버 상태는 TanStack Query(`lib/query-provider.tsx`, 루트 layout에서 한 번). mutation은 자동 재시도하지 않는다 (절대 규칙 9). 읽기 실패는 한 번만 0.4초 뒤에 다시 묻고(`makeQueryClient`, `/me`는 세 번이라도 0.4, 0.8, 1.6초), 그다음 화면의 오류 한 줄이 뜬다 (QA 5차: TanStack 기본은 1, 2, 4초 세 번이라 7초 동안 뼈대만 보였다. 테스트의 `retry: false`가 이 시간을 가리고 있었다. `lib/query-provider.test.tsx`가 가짜 시계로 지킨다).
- 화면 문자열 도우미(`lib/format.ts`): "25분", "가게에서 어디로, 25분쯤", "오늘 오후 12:28"(기기 시간대와 상관없이 KST).

## 화면 틀
- 화면 틀(390 기준, 가운데 정렬, 최대 480 `size.screenMax`, 높이 100dvh 세로 줄)은 `app/globals.css`의 `.screen`이고 라우트 layout이 붙인다. page와 컨테이너는 class를 쓰지 않는다.
- 여백이 있는 화면(Done, Tracking: 8 20 24, 사이 16)은 `.screen.padded`. 주문 현황 layout(`app/orders/[id]/layout.tsx`)이 쓴다.
- 가입 화면은 `.screen.onboarding`(여백 8 20 32, 사이 22 `size.signupGap`, Name과 Budget 시안 값)이고 마지막 블록(큰 버튼, 로그인 버튼, 부화 단계 카드)은 맨 아래로 붙는다. 화면마다 여백이 달라 그룹 layout 대신 가입 라우트마다 layout이 있다 (`app/(onboarding)/<화면>/layout.tsx`):
  - Verify `.screen.onboarding.verify`: 사이 24
  - Start `.screen.onboarding.start`: 여백 0 24 32, 사이 0. 알과 제목 묶음(ui `Hero`)이 남은 높이 가운데
  - Hatch `.screen.onboarding.hatch`: 여백 56 24 32(`size.hatchTop`), 사이 28. 알과 말 묶음(ui `Hero`)이 남은 높이 가운데
- 대화 화면(Main)은 `.screen` 하나에 ui `ChatLayout`이 띠(위 줄 16 20 12, 예산 0 20, 입력칸 10 16 24)를 그린다.
- 앱처럼 열기 (2026-11-20, D-23): `public/manifest.webmanifest`(`display: standalone`, 색은 `design/tokens.json`의 `ground` 값을 옮겨 적음. 정적 JSON이라 토큰을 바꾸면 같이 고친다. `app/`에는 page와 layout만 둔다는 D-18 게이트 때문에 Next의 `app/manifest.ts`를 쓰지 않는다)와 layout의 `appleWebApp`, `themeColor`. 홈 화면에 추가해 열면 브라우저 주소창 없이 뜬다. 주소창이 없는 것은 manifest의 standalone 덕이고 `appleWebApp`은 제목과 상태 표시줄만 정한다 (Next 16은 `mobile-web-app-capable`을 낸다, 실측). 색이 토큰과 같은지는 `lib/pwa-manifest.test.ts`가 지킨다. 남은 것: 앱 아이콘(`public/apple-touch-icon.png`와 `metadata.icons`. `app/`에는 page와 layout만, D-18. 없으면 iOS가 화면을 줄여 아이콘으로 쓴다), 실기기 확인, 위 상태 표시줄과 겹치는 화면의 safe-area 확인.
- 화면 전환 (2026-11-21, D-23): `lib/transition-router.tsx`의 `useTransitionRouter()`(`push`, `replace`)가 `document.startViewTransition`으로 화면 사이를 220ms 크로스페이드한다(`globals.css`의 `::view-transition-old/new(root)`, opacity만). 새 경로가 그려질 때(`TransitionBridge`가 root layout에서 pathname을 봄) 또는 1초 뒤 놓는다. API가 없는 브라우저와 "동작 줄이기"는 그냥 이동한다(같은 결과). 대화에서 주문 현황, 주문 내역에서 주문, 용돈에서 모습과 신분증, 한도 화면 이동에 쓴다. Next의 `experimental.viewTransition`은 next.config.ts라 쓰지 않았다. 대화 입력 키보드는 ui `useKeyboardInset`(ChatLayout). 불러오는 모양은 ui `LoadingShape`(Main 헤더와 30일 막대, 주문 현황, 주문 상세, 신분증, 용돈 줄, 한도 화면).

## 종별 테마 (D-32, 2026-11-20)
- 앱 색은 `<html data-species>` 하나로 바꾼다 (값과 고정 부분은 ui `_index.md` "종별 테마"). 루트 layout이 기본 `forest`로 그리고, `<head>`의 짧은 스크립트(`lib/theme.ts`의 `bootSpecies`)가 이 브라우저가 마지막으로 쓴 종(localStorage `sikyeoyong.species`, 알려진 네 값만)을 첫 그림 전에 얹는다. 다시 찾는 사용자는 다른 종 색이 번쩍이지 않는다. 처음 오는 기기에서 숲이 아닌 용이면 GET /me가 올 때 한 번 바뀐다.
- `features/me/containers/ThemeSync`가 GET /me 캐시의 `dragonSpecies`를 따라 `applySpecies`(속성과 기억)를 부른다. 스스로 /me를 묻지 않는다 (`useMeCached`, 가입 화면에 요청을 더하지 않으려고).
- Name: 알을 고르는 순간 `applySpecies(종, { remember: false })`로 화면 색이 바뀌고(저장 전, D-32), 알 깨우기가 성공하면 기억한다.
- 한도 화면 layout(`app/limit/layout.tsx`: Blocked, 한도 올리기, Cap)은 `data-theme="fixed"`라 종과 상관없이 기본 색이다. 바탕은 `.screen[data-theme='fixed']`가 칠한다. 확인 시트는 ui `OrderConfirmSheet`가 스스로 고정이다.
- 시안과 다른 점: Confirm, Blocked, Cap 시안은 버튼과 막대에 종 색(`sy_accent`)을 쓰지만 D-32 결정(돈과 경고는 고정)을 따른다. `themeColor`(주소창 색)와 manifest 색은 숲 그대로다.

## 첫 진입 로딩 (Splash, user-flow 0, 2026-11-20)
- Main(`/`)의 세션 입구만 `<EntryGate splash>`다. 다른 화면은 묻는 동안 아무것도 그리지 않는다 (그대로).
- 시점은 `features/me/hooks/useSplashTiming` 하나가 정한다: 세션 답이 1초(`SPLASH_DELAY_MS`) 안에 오면 Splash 없이 바로 넘어간다 ("1초 안에 끝나면 바로 넘긴다"). 1초가 지나도 모르면 Splash를 띄우고(나타나기는 페이드), 한 번 뜨면 적어도 0.8초(`SPLASH_MIN_MS`) 둔다. 막 뜬 화면이 번쩍 사라지지 않게 하려는 것이고, 화면을 누르면 그 기다림을 건너뛴다 ("화면을 누르면 넘어감"). 답 전에는 갈 곳을 몰라 누를 것이 없으므로 `onSkip`을 주지 않는다: Splash는 버튼이 아니고 "용이를 깨우는 중이에요"만 들린다 (브라우저 QA 2차: 답 전에 "시켜용 시작하기"를 눌러도 아무 일이 없었다). 답이 오면 남은 최소 시간 동안만 버튼이 된다.
- 다음 화면(Main 또는 Start 등으로 가는 redirect)이 뜰 때까지 Splash가 남아 빈 화면이 끼지 않는다. 종은 GET /me가 있으면 그 종, 없으면 `<html data-species>`(이 기기가 마지막으로 쓴 종)이고 바탕도 그 테마 색이다.
- 동작 줄이기는 ui `Splash`가 한다 (오르내림과 점 멈춤, 페이드만).

## 가입 뒤로 (Verify, Name)
- 뒤로 버튼은 브라우저 기록(`router.back()`)이 아니라 이전 단계로 `router.replace`한다: Verify는 /start, Name은 /verify (2026-11-19 판단).
- 이유: 새로고침은 기록이 남지만, 직접 링크나 새 탭으로 들어오면 앞 기록이 없거나 다른 사이트라 `router.back()`이 아무것도 안 하거나 앱을 떠난다. 가입은 한 줄로 이어지는 단계라 "뒤로"는 언제나 앞 단계다. push 대신 replace라 브라우저 뒤로로 같은 단계를 오가며 기록이 쌓이지 않는다.
- 남는 것: replace 뒤 브라우저 뒤로는 그 단계에 들어오기 전 기록으로 간다. 로그인 전 사용자를 어디로 보낼지(로그인했으면 /start를 건너뛸지)는 실제 세션이 붙을 때 정한다.

## 부화 다시 받기 (Hatch)
- 규칙은 순수 함수 `features/onboarding/hatch.ts`의 `hatchPollInterval` 하나다. `useAgentSetup`은 이 값을 TanStack Query `refetchInterval`로 넘기기만 한다.
- PENDING일 때만 1초마다 다시 묻는다. 첫 응답 전이나 첫 조회가 실패했으면 묻지 않는다: 입구(`EntryGate`)와 Hatch가 "못 불러왔어요" 줄과 다시 불러오기 버튼을 보이고, 눌러야 다시 묻는다. PENDING 중 조회가 연달아 4번(재시도 포함) 실패하면 1초 조회도 멈춘다 (`HATCH_MAX_FAILURES`, QA 6차: `/dragon`이 빈 화면으로 매초 반복). 가입 표시는 Name의 알 깨우기가 만든 뒤(또는 PENDING에서 ACTIVE로 바뀌는 것을 지켜본 때) 남고, 부화가 끝나면 그 표시가 있는 사람만 /budget으로 간다(목처럼 첫 조회에서 이미 ACTIVE여도 한도 정하기를 건너뛰지 않는다, QA 6차)(이미 가입한 사람이 /hatch를 바로 열면 /로 간다). FAILED면 멈추고 "다시 깨우기"만 다시 시작한다.
- 오류가 나도 연달아 4번(`HATCH_MAX_FAILURES`)까지는 계속 묻는다. GET은 몇 번 불러도 안전하고 부화는 1~3분이라 잠깐 끊긴 네트워크로 멈추면 안 되기 때문이다 (2026-11-19 판단). 실패한 GET은 마지막 상태를 그대로 둔다(TanStack Query는 오류에도 data를 지킨다). 4번 연달아 실패하면 조회를 멈추고 다시 불러오기 버튼을 보인다 (QA 6차, 2026-11-21).
- 서버 부화 시한(PENDING에서 FAILED로 넘어가는 시간)이 아직 명세에 없다. 오류 없이 서버가 계속 PENDING이면 1초 조회가 끝없이 이어진다. 시한은 API agents 모듈을 만들 때 정하고, 정해지면 웹은 그대로 FAILED를 받아 멈춘다.

## 조립 현황 (목 데이터)
| 화면 | 경로 | 컨테이너 | 상태 |
| --- | --- | --- | --- |
| Main | `app/(main)/page.tsx` | `features/chat/containers/ChatContainer`(ui `ChatLayout`), `features/me/containers/DragonHeaderContainer`(ui `ChatHeader`), `features/budget/containers/BudgetMeterContainer`(Meter `framed`), `features/orders/containers/ActiveOrderContainer`(ui `ActiveOrderCard`) | 위 줄(용이, 한도 한 줄, 주문 내역 버튼은 `/orders`, 설정 버튼은 `/dragon` 지갑으로), 예산 카드, 그 아래 진행 중인 주문 카드(2026-11-20: `GET /orders`에서 가장 새 진행 중 주문 하나, `features/orders/active.ts`. 접수와 조리 중은 Done, 배달 중은 Tracking인 `/orders/:id`로 가고 주문을 캐시에 넣어 바로 그린다. 진행 중이면 5초마다 목록을 다시 받는다. 결제가 되면 목록을 다시 받는다), 대화 기록, 용이 말 아래 추천 카드(`threadRows`가 말 바로 뒤 추천을 그 말의 DragonLine children으로 묶는다), 보내기와 실패 다시 보내기, 추천 고르기(견적 요청), 빠른 답장. 허락 필요 가게는 견적이 없어 아직 아무 일도 없다 (허락 카드 미조립). 멈춘 동안 입력칸은 꺼지고 아래에 "용이가 자고 있어요"(ui `ChatInput` `disabled`, `disabledNote`). 입력칸 안내 글은 주문이 있으면 시안의 "오늘 저녁도 부탁해", 없으면 "뭐 먹고 싶은지 말해 줘"(시안과 다른 점, 처음 쓰는 사람에게 "도"가 맞지 않아서). 가는 곳 조사는 `lib/format.ts`의 `withRo`(받침이 있으면 "으로", ㄹ과 받침 없음은 "로", 끝의 괄호는 보지 않음) |
| Confirm | Main 위 시트 | `features/orders/containers/OrderConfirmContainer` (ChatContainer 안) | 추천 고르기(`POST /orders` 견적)와 용이의 `order_confirm` 둘 다 시트를 연다. 시키기는 `useConfirmOrder`(목 confirm, 결제 없음)를 부르고 바로 주문 현황으로 넘어간다 (낙관적). confirm이 실패하면 `useConfirmOrder`가 대화로 되돌린다 (`router.replace('/')`). 용이가 이유를 말하는 것은 shared `ChatEvent`의 `order_failed`가 생긴 뒤 |
| Done | `app/orders/[id]/page.tsx` | `features/orders/containers/OrderStatusContainer` | 조리 중, 배달 중(Tracking, 지도), 도착(Arrived, `ArrivedContainer`). 상태를 4단계로 바꾸는 규칙은 `features/orders/status.ts`(`orderStep`). 결제 전(`quoted`, `pending_approval`)과 취소, 환불은 단계로 그리지 않고 위 줄만 보인다 (접수처럼 보이지 않게, 화면은 아직). 멈춘 주문(`failed`)은 `FailedOrderContainer`(QA 5차): "주문이 멈췄어요", 주문의 `dragonLine`(오류 코드 대사), 그리고 다음 걸음 하나. D-19로 같은 주문을 다시 결제할 수 있는 코드(`features/orders/failed.ts` `canRetryFailed`, API `failure-class.ts` 재시도 가능 표와 같게: 용돈 부족, 30일 한도, 멈춘 용이, 한도 미설정, 규칙 걸림, 본인 인증, 결제 전 `INTERNAL`)면 "다시 시도하기"(`useRetryOrder`, 같은 주문의 confirm, 사람이 누를 때만)와 "대화로 돌아가기", 그 밖(가게 정지, 가격 바뀜, 주인 거절이나 만료)이면 "대화로 돌아가기"뿐. 다시 눌러 또 실패하면 한 줄(`ErrorLine`)로 알리고 자동 재시도는 없다. 도착 전까지 2초마다 다시 받는다 |
| 주문 내역 | `app/orders/(list)/page.tsx` (`/orders`, layout `.screen.padded`) | `features/orders/containers/OrderHistoryContainer` (ui `TopBar`, `ListRow`, `Skeleton`, `DragonLine`, `ErrorLine`) | 시안 없음 (아래 "ui에 없는 것"). `GET /orders` 새것부터, 줄마다 메뉴(진행 중이면 ", 배달 중"처럼 단계, 허락 대기, 멈춤(`failed`, D-19: 결제 거절이나 주인이 거절, 만료), 취소, 환불도 한 마디)와 금액. 누르면 갈 곳이 있는 줄만 화살표와 누르기가 있다(`orderHref`): 진행 중은 `/orders/:id`, 도착은 영수증, 한 번에 한도를 넘어 허락을 기다리는 주문은 `/limit/:id`. 멈춤(`failed`)은 주문 현황의 멈춤 화면으로 열린다(QA 5차). 취소, 환불, 다른 이유(처음 가게, 30일 한도)로 기다리는 주문은 열 화면이 아직 없어 누르지 못한다(2026-11-20 검증 지적: 빈 화면). 목도 허락 대기 주문을 목록에 넣는다. 불러오는 동안 줄 모양 두 개, 비면 용이 한 줄, 실패는 한 줄 |
| Receipt | `app/orders/[id]/receipt/page.tsx` | `features/orders/containers/ReceiptContainer` | 주문 줄, 결제 수단, 한도 줄, 자세히 보기(`ReceiptDetails`). 한도 줄은 `OrderView.limitsAtOrder`(견적 때 저장한 값)가 있으면 그때 값 "한 번에 쓸 수 있는 돈"과 "30일 한도"(한도 값 하나, "지금" 없음)로 쓴다. 없으면(옛 주문) 오늘 값을 "지금 한 번에 쓸 수 있는 돈"(값 하나, "9,000 / 10,000원" 같은 비율은 넘친 것처럼 읽혀 쓰지 않는다. QA 3), "지금 30일 한도"로 쓴다. 영수증 시각은 아직. 시안과 다른 점: 시안 라벨에는 "지금"이 없다 |
| Wallet | `app/dragon/(awake)/page.tsx` (`/dragon`) | `features/wallet/containers/*` (WalletTopBar, Allowance, LimitRows, DragonControls, CustodyNote, FrozenRedirect) | 시안 값대로. "한 번에 쓸 돈"과 "30일에 쓸 돈" 줄은 화살표가 있고 누르면 `/dragon/limits`(한도 바꾸기, QA 5차). "용이 모습" 줄(D-32)은 신분증 위, 누르면 Look. 멈춘 용이는 `/dragon/frozen`으로 보낸다. 멈추기 스위치는 성공하면 예산 캐시의 `frozen`을 바로 바꾸고 다시 받기는 기다리지 않고 Frozen으로 간다(`useSetFrozen`, 2026-11-20 브라우저 QA). 시안에는 위 뒤로 버튼이 없지만 대화로 돌아갈 길이 필요해 "대화로 돌아가기"를 넣었다(시안과 다른 점) |
| 한도 바꾸기 | `app/dragon/limits/page.tsx` (`/dragon/limits`, layout `.screen.onboarding`, 고정 색) | `features/limits/containers/LimitEditContainer`(ui `AmountStepper` 둘은 `LimitSteppers`, `TopBar`, `Button`, `LimitChangeCard`), 훅 `useLimitDraft`, `useSetLimits`, 순수 `features/limits/draft.ts` | QA 5차. Wallet의 "한 번에 쓸 돈", "30일에 쓸 돈" 줄(시안대로 화살표, 둘 다 같은 화면)에서 온다. **시안에 이 화면이 없어** Budget의 조절기 두 개를 가입 말(인사, 체험 용돈) 없이 그대로 쓴다(시안과 다른 점, 디자인 빈틈). 값을 바꾸면 "바꾸기"가 켜진다. 내리기만 하면 바로 `PUT /agents/me/limits`(재인증 없음)를 부르고 Wallet으로 돌아간다. 올리는 것이 하나라도 있으면 먼저 `LimitChangeCard`(Face ID 확인 버튼, D-28)가 조절기를 대신하고, 그 버튼만 보낸다(뒤로나 그만두기는 조절기로). 한 번에 쓸 돈은 30일에 쓸 돈 이하(D-31, 30일 조절기의 최소가 한 번에 쓸 돈을 따라 오른다). 가입 Budget도 같은 `useLimitDraft`, `LimitSteppers`, `limitsBody`를 쓴다. 실패는 한 줄(`ErrorLine`)과 같은 버튼으로 다시(자동 재시도 없음), 예산을 못 불러오면 `RetryLine`. 멈춘 용이는 `FrozenRedirect`로 Frozen으로 간다 |
| Look | `app/dragon/look/page.tsx` (`/dragon/look`, layout `.screen.onboarding.look`: 8 20 32, 사이 20, 버튼은 맨 아래) | `features/wallet/containers/LookContainer`(ui `TopBar`, `LookPreview`, `SpeciesPicker`, `Button`), 훅 `useChangeLook` | D-32. Wallet의 "용이 모습" 줄(값은 종 이름, `SPECIES_INFO`)에서 온다. 고르면 용이, 말버릇, 앱 색이 바로 바뀌고(미리보기, 기억 안 함), "이 모습으로 바꾸기"가 `patchAgent(me.agentId)`를 부른 뒤 /me 캐시를 새 종으로 바꾸고 다시 받아 Wallet으로 돌아간다(`router.replace('/dragon')`). 지금 종과 같으면 요청 없이 돌아간다. 저장 없이 나가면 저장된 종으로 되돌린다. 실패하면 한 줄(`ErrorLine`)과 고른 것 그대로. 낙관적으로 먼저 넘기지 않는 이유: 색은 이미 미리보기로 바뀌어 있어 기다림이 버튼 로딩 한 번이고, 실패를 Wallet에서 되돌리면 더 헷갈린다. Look은 `(awake)` 밖이라 멈춘 용이도 모습을 바꿀 수 있다 |
| IdCard | `app/dragon/(awake)/id/page.tsx` (`/dragon/id`) | `features/wallet/containers/IdCardContainer` | 카드. 아래 안내 한 줄과 공유하기는 아직(아래 "ui에 없는 것") |
| LeakCompare (데모 전용) | `app/demo/leak/page.tsx` (`/demo/leak`) | `features/demo/containers/LeakCompareContainer`, 들어가는 줄은 `LeakEntryContainer`(지갑 맨 아래) | 데모 빌드(`NEXT_PUBLIC_DEMO_MODE` 또는 루트 `.env`의 `DEMO_MODE`가 true)에서만 열리고 아니면 404. 숫자는 `ApiClient.getLeakCompare`(`GET /api/demo/leak-compare`, API도 `DEMO_MODE`가 꺼지면 404). 목은 시안 값 |
| Blocked | `app/limit/[orderId]/page.tsx` | `features/limits/containers/BlockedContainer` | 한 번에 한도를 넘어 승인 대기(`pending_approval`)가 된 주문. 추천에서 고르면 대화가 이리로 보낸다. 올릴 금액은 주문 금액을 덮는 가장 작은 단위 값(`features/limits/fit.ts`의 `limitToFit`, D-31). 다시 고르기는 대화로. 주문이 없거나 이미 한도 안이면(지난 링크) 대화로 돌아간다(`useBackToChat`). 한도 바꾸기 화면도 올릴 것이 없으면 같다 |
| 한도 바꾸기 | `app/limit/[orderId]/raise/page.tsx` | `features/limits/containers/RaiseContainer` | LimitChat 카드(`LimitChangeCard`)를 화면 하나로. 버튼(재인증 자리, D-28: 테스트넷은 버튼만, pouch는 지갑 서명)을 눌러야 `setLimits`(`PUT /api/agents/me/limits`). 올릴 값은 `features/limits/fit.ts`의 `raisePlan`: 새 한 번에 쓸 돈이 30일에 쓸 돈보다 크면 30일 값도 그 이상의 가장 작은 단위로 같이 보내고 카드 아래 줄이 "A에서 B으로"가 된다(D-31). 30일 값이 체인 공통 상한을 넘어야 하면 Blocked가 올리기를 제안하지 않는다. 목도 서버처럼 한 번에 > 30일을 거절한다. 올린 뒤 `useRequoteOrder`(`POST /api/orders/:id/requote`)로 기다리던 주문을 다시 견적으로 받아 `handQuoteToChat`으로 대화에 넘기고 대화로 간다. 대화는 그 확인 시트를 연 채로 뜬다 (user-flow 12, O에서 I로). 결제는 여전히 시트의 버튼뿐. 대화의 지난 추천 카드는 `needsApprovalNow`(지금 한도로 다시 계산, `features/limits/fit.ts`)로 허락 필요를 다시 그린다 |
| LimitChat | Main 대화 안 | `features/limits/containers/LimitChangeContainer` (ChatContainer 안) | `limit_change_card` 이벤트를 대화에 그린다(D-21: 카드만, 버튼이 바꾼다). 바꾸면 그 자리에 용이가 새 한도를 말한다. 그만두기는 카드를 닫는다. 기록에서 다시 그린 카드는 지금 한도(`GET /budget`)와 비교한다: 지금 값이 카드의 "후"면 이미 바꾼 것이라 새 한도 한 줄만, "전"도 "후"도 아니면 지난 카드라 그리지 않는다(누를 수 없게, 2026-11-20 브라우저 QA). 카드는 그 턴의 말 뒤(빠른 답 칩 앞)에 그린다(`entries.ts` `dragonTurn`): 모델이 도구를 먼저 부르고 "아직 바뀌지 않았어용"을 뒤에 말해도, 누른 뒤의 "바꿨어용!"이 맨 아래 새 줄로 읽힌다(브라우저 QA 2차) |
| 주인 허락 카드 | Main 대화 맨 아래, 주문 내역 줄 아래 | `features/approvals/containers/OwnerApprovalContainer`(ui `OwnerApprovalCard`), 훅 `useOwnerApprovals`(`GET /approvals?status=pending`), `useDecideApproval` | 2026-11-21. 주문이 새 가게(`NEW_MERCHANT`)나 30일에 쓸 돈 넘음(`OVER_PERSONAL_BUDGET`)으로 `pending_approval`이면 그 승인이 카드로 뜬다. 한 번에 한도 초과(`OVER_LEVEL_LIMIT`)는 목록에 와도 카드를 만들지 않는다(서버도 approve를 400으로 막고 길은 Blocked, `features/approvals/owner.ts`). 대화와 주문 내역은 같은 조건(`cardsToShow`, 주문 목록에서 그 주문이 아직 `pending_approval`일 때만)으로 카드를 정한다. 한 카드는 탭 한 번에 답 하나만 보낸다(ref로 막고, 실패하면 돌려줌). "허락하기"는 `POST /approvals/:id/approve`를 부르고 서버가 주문을 다시 견적해 확인 카드(`quote`)를 준다: 대화는 `chat.showQuote`로 시트를 열고, 주문 내역은 `handQuoteToChat`을 하고 `/`로 간다 (Blocked 올리기와 같은 넘기기). 결제는 시트의 버튼만(규칙 3). "안 시킬래요"는 `POST /approvals/:id/reject`고 대화에서는 용이가 "알겠어용. 안 시킬게용."이라고 한다. 재인증은 없다: D-21, D-28의 재인증은 한도 올리기만이고 허락 두 이유는 한도를 올리지 않으며 서버 approve도 재인증을 받지 않는다. 답이 간 카드는 목록이 다시 올 때까지 눌리지 않고, 실패하면 "답을 못 보냈어요"와 같은 버튼으로 다시(자동 재시도 없음). 주문을 고른 직후 `useCreateOrder`가 승인과 주문 목록을 다시 받아 카드가 바로 뜨고, 대화는 맨 아래로 따라간다. 승인이 있을 때만 30초마다 다시 묻는다(10분 시한). 목: 30일에 쓸 돈을 낮춰 한도를 넘기면 승인이 생기고, 새 가게는 없다(D-27) |
| Cap | `app/limit/cap/page.tsx` | `features/limits/containers/CapContainer` | 30일 한도 거절(`CHAIN_PERIODIC_LIMIT`)이면 대화가 이리로 보낸다. 다시 채워지는 시각은 예산 화면의 `chainResetAtSec`. "알려 줘"는 아직 대화로 돌아가기만. 30일 창이 아직 없으면(`chainResetAtSec` null, 주소로 바로 온 경우) 대화로 돌아간다(브라우저 QA 2차, 빈 화면 대신) |
| Frozen | `app/dragon/frozen/page.tsx` | `features/wallet/containers/FrozenContainer` | 자는 바탕(레이아웃 `sleep`), 대화로 돌아가기, 돌려받기, 깨우기. 지갑 값을 모르면 숫자 없이 깨우기만 |
| 파우치 로그인 돌아오기 | `app/pouchi/callback/page.tsx` | `features/auth/containers/PouchiCallbackContainer` | 시안 없음 (D-29). 금고가 같은 탭으로 돌아오면 그 요청을 한 번 마치고 `/`(입구)로. 실패는 한 줄과 "처음으로"(/start). 로그인으로 치지 않는다 |
| Start, Verify, Name, Hatch, Budget | `app/(onboarding)/<start, verify, name, hatch, budget>/page.tsx` | `features/onboarding/containers/*` | 시안대로 조립했다 (Start `Hero`와 `ScreenTitle`, Verify와 Name `TopBar` 뒤로와 단계 막대, Name 안내 줄 `BORN_LINE`은 정책의 처음 제안 한 번에 쓸 돈(`perOrderLimit.initialAokrw`), Hatch `Hero`, Budget DragonLine greeting과 `TrialAllowance`). 뒤로는 이전 단계로 `router.replace` (Verify는 /start, Name은 /verify, 아래 "가입 뒤로"). 목으로 끝까지 이어진다: 로그인, 본인 인증, 알 고르기와 이름(빈 이름은 버튼을 끄지 않고 안내), 부화(1초마다 다시 받기, 다 되면 /budget), 한도 정하기(`BudgetSetupContainer`: 한 번에, 30일에 두 조절기, 시작하기를 누르면 바뀐 값만 `setLimits`로 보낸다. 30일 조절기의 최소는 한 번에 쓸 돈 이상의 가장 작은 단위 값이고, 한 번에 쓸 돈을 그 위로 올리면 30일 값도 따라 오른다, `thirtyDayFloor`, D-31)와 체험용 용돈, 시작하기(/). 한도 정하기는 가입 때 한 번만 보인다: 부화가 끝나면 Hatch가 `onboarding/pending-budget.ts`의 표시(localStorage)를 남기고, 시작하기가 지운다. 표시 없이 /budget을 여는 이미 가입한 사람은 `/dragon`(지갑)으로 보낸다(브라우저 QA 3). 로그인 취소, 인증 실패 다시 시도는 목에서 일어나지 않는다. 약관, 개인정보 링크(/terms, /privacy)는 페이지가 없다 |

## ui에 없는 것 (기록만. 웹에서 마크업을 만들지 않는다)
- 주인 허락 카드 (2026-11-21): 시안에는 Main의 "허락 필요" 배지와 user-flow의 "주인 허락 카드"뿐이고 카드 시안이 없다. LimitChat 카드(`LimitChangeCard`)와 같은 틀로 가장 단순하게 `OwnerApprovalCard`를 만들었다(제목이 이유, 가게와 금액 두 줄, "허락하기", "안 시킬래요"). 주문 내역 줄 아래에 같은 카드가 붙는 모양, 허락한 뒤 줄이 어떻게 바뀌는지, 만료(10분)를 어떻게 알릴지, 단어("허락"이 맞는지)는 캔버스에서 정한다. 처음 시키는 가게는 데모에 없어서(D-27) 화면에서 직접 본 적이 없다.
- 주문 내역 화면 (2026-11-20): Main 시안의 영수증 버튼은 있지만 목록 화면 시안이 없다 (시안 링크는 Receipt로 바로 간다). 있는 부품(`TopBar`, `ListRow`)으로 가장 단순한 목록을 만들었다. 날짜, 가게 이름, 상태 배지를 보일지는 캔버스에서 정한다.
- Main 진행 중인 주문 카드의 단계 막대는 base `StepProgress` sm이라 칸 사이가 4다 (시안 3).
- (2026-11-19 해결) Main 위 줄, 예산 카드, 추천 카드 들여쓰기, 입력칸 아래 띠: ui `ChatHeader`, Meter `framed`, DragonLine `children`, `ChatLayout`으로 채웠다.
- Main 추천 줄 높이: 시안 줄은 64인데 지금은 약 76이다. 시안은 줄간격을 두지 않았고(브라우저 기본) 웹 body는 1.6이라 가게 이름과 메뉴 두 줄이 높아진다. RecommendationList 글자 줄간격을 시안에 맞출지 ui에서 정한다.
- 시안끼리 다른 문구: 요청이 Confirm은 "깍두기 많이", Done은 "깍두기 많이, 문 앞에 두고 가 주세요"다. 목은 둘 다 "깍두기 많이"로 둔다. 어느 쪽이 맞는지 캔버스에서 정한다.
- (2026-11-19 해결) 가입 제목 묶음(Start, Verify, Name), Name 아래 한 줄, Verify와 Name의 48 단계 줄, Hatch 가운데 정렬과 22/14 글씨, Budget 말 20과 체험용 용돈 줄과 받은 뒤 모양: ui `ScreenTitle`, TextField `hint`, `TopBar`(뒤로와 단계 막대), `Hero`, DragonLine `greeting`, `TrialAllowance`로 채웠다.
- Start 알: 시안은 금 간 알 위로 뿔이 보이는 그림인데 `Egg`에 그 상태가 없어 닫힌 알(`closed`)로 그린다. Egg에 상태를 늘릴지 ui에서 정한다.
- IdCard 화면 아래 "가게는 주문을 받을 때 이 신분증을 봐요" 한 줄과 "신분증 공유하기" 버튼: 이 한 줄에 맞는 ui 부품(카드 아래 작은 안내 글)이 없다. ui에 만들지(예: IdCard에 `footnote`) 정한다. 그 전까지 웹은 그리지 않는다.
- 받은 뒤 모양("받았어요")은 시안에 없다. TrialAllowance.md에 디자인 선택으로 적었다.
- 빠른 답장 `quick_replies` 이벤트는 shared `zChatEvent`와 tech-spec 2.4에 들어갔다 (해결).
- 캔버스 수정 요청 (2026-11-20 검증 지적): Splash 시안 맨 아래 "마루 테스트넷 데모"는 블록체인 말(D-17)이다. ui는 "체험용 데모"로 그린다(Splash.md 시안과 다른 점). 캔버스 시안도 같은 문구로 고쳐 주세요.

## 남은 일 (가입)
- 체험용 용돈은 `POST /api/signup/trial` (2026-11-20, allowance 모듈): 두 번 와도 한 번만 주고 `{ granted }`(`zTrialResult`), 본인 인증을 마친 주인만.
- 실패 표시 자리: 로그인 취소, 인증 실패, 부화 실패, 예산 저장 실패를 어디에 어떤 모양으로 보일지 (시안 없음).
- 가입 화면의 '용이' 고정 문구(부화 단계 "용이 용돈 주머니 만들기" 등)가 고른 이름 자리인지 시안에서 확인한다.
- 로그인 흐름: D-29로 파우치 로그인 하나(세션 입구). 지금 `login`은 목 Promise이거나 http 모드의 개발용 우회(`DEV_LOGIN`)다.

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
- 읽기 실패 (QA 4차, D-23): 세션 확인(GET /me)이 재시도 끝에 5xx나 오프라인이면 첫 진입은 Splash의 실패 한 줄과 "다시 깨워 볼까요"로 끝난다(`onRetry`). 주문 현황, 주문 상세, Main의 30일 배달비 막대는 읽기가 실패하면 `RetryLine`(오류 한 줄과 "다시 불러오기")을 제 자리에 그린다. 빈 화면이나 말없이 사라지는 일은 없다.
- CSP (2026-11-21): 헤더는 `proxy.ts`가 요청마다 nonce와 함께 붙이고(`lib/csp.ts`), 루트 레이아웃 테마 부트 스크립트가 `x-nonce`를 단다. 규칙은 security.md.
  - 금고 출처(`POUCHI_VAULT_URL`)는 `next.config.ts`가 빌드에 굽는다(`env.CSP_VAULT_ORIGIN`). 바꾸면 웹 재빌드가 필요하다. 개발 서버는 `next.config.ts`가 `@sikyeoyong/shared`를 가져오므로 `packages/shared`를 먼저 빌드(`dist`)해 둬야 다시 읽을 때 죽지 않는다. 자세한 이유는 security.md.
