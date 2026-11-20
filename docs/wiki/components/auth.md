---
node: leaf
parent: _index.md
children: []
---

# 인증 (auth)

## 책임
- 사용자 로그인: 파우치 로그인 하나 (D-29, 2026-11-20). 이메일과 패스키, 가입 때 사용자 지갑이 생긴다. 시작 버튼은 "이메일로 시작하기". 웹은 세션 입구 하나로 감싸고, 서버는 auth 모듈의 파우치 BFF(`bind`, `complete`)가 결과를 검증해 시켜용 세션을 발급한다. 파우치에 카카오가 들어오면 첫 버튼과 입구 안쪽만 바꾼다. (예전 계획: 카카오, 구글 OAuth. 아래 OAuth 문장은 D-29로 대체됨)
- 서버 세션 발급·갱신·폐기.
- 역할 구분: `user`(앱 사용자), `merchant`(판매자, 2단계), `operator`(운영자, 시드·가게 등록·정책 적용).
- 앱 사용자와 체인 신원의 연결: 사용자 1명 = 소유자 지갑 1개 = 에이전트 1개 이상 (1단계는 에이전트 1개).

## 책임 아님
- MAWS 로그인 자체 (MAWS는 서버 컨테이너가 `WAAS_AUTH_TOKEN`으로 인증. `infra.md`)
- KYC 수행 (테스트넷 KYC 사이트 또는 Mock KYC에서. 우리는 EAS attestation을 조회만)

## 의존과 인터페이스 경계
- 로그인은 파우치 로그인 하나다 (D-29, 2026-11-20 구현). 흐름:
  1. 웹은 `GET /api/auth/pouchi/config`(공개, `zPouchiLoginConfig`: 금고 주소, 앱 ID, 콜백)를 받는다. 앱 키는 웹에 오지 않는다.
  2. 웹이 `pouchiEmbedded.login`(@nc-waas/sdk/browser beta.8)으로 파우치 금고(이메일 코드, 패스키, 가입이면 지갑 생성)를 연다. 금고가 열리기 전 `beforeOpen`에서 `POST /api/auth/pouchi/bind { requestId, codeChallenge, flow }`로 요청을 서버에 묶는다.
  3. 금고의 서명된 결과를 `POST /api/auth/pouchi/complete { envelope, codeVerifier, requestId }`로 보낸다. 서버(`modules/pouchi`의 `PouchiService`)는 묶어 둔 요청을 한 번만, 10분 안에만 쓰고, 기대 앱 ID와 흐름은 콜백 본문이 아니라 서버 설정과 묶은 기록에서 가져와 SDK `completeBridgeResult`(결과 서명 검증, PKCE)로 확인한다. 기기 확인(`ownerVerified`)까지 통과해야 한다.
  4. 통과하면 `users` 모듈 `PouchiLoginService`가 파우치 지갑 ID로 사용자를 찾거나 만들고(`pouchi_accounts`, 첫 로그인은 닉네임 "주인님"과 정책 기본 예산) `AuthService.rotate`로 세션 쿠키를 발급한다.
  - Safari 패스키는 같은 탭으로 금고에 갔다 `/pouchi/callback`으로 돌아올 수 있다. 웹은 시작할 때와 콜백에서 먼저 `pouchiBridge.handleCallback()`을 부르고 같은 요청으로 `complete`한다.
  - 묶어 둔 요청은 프로세스 메모리(1,000개까지, 만료 먼저 버림, D-03 한 프로세스). 서버를 다시 띄우면 진행 중인 로그인은 다시 해야 한다.
  - `POUCHI_API_URL`이 비면 로그인이 꺼진다(config와 bind가 404). production은 필수.
  - 나중에 파우치 Browser SDK에 카카오가 들어오면(pouchi-questions 3번) 시작 화면의 첫 버튼과 웹 세션 입구 안쪽만 바꾼다.
- 예전 계획(D-29로 대체): Passport 카카오·구글 OAuth. 흐름은 tech-spec "2.3 인증 흐름"의 옛 내용.
- 세션 저장: httpOnly, Secure, SameSite=Lax 쿠키. 웹과 API가 같은 도메인이라 CORS가 필요 없다.
- 코드: `modules/auth/auth.service.ts`의 `AuthService`(발급 `issue`, 확인 `resolve`, 폐기 `revoke`, 최근 로그인 `isRecentLogin`)와 `common/guards/session.guard.ts`의 `SessionGuard`, `@CurrentUser()`. 가드는 `sid` 쿠키(웹)나 `Bearer`(네이티브, 스킴 대소문자 무시)를 읽고, 쿠키로 오는 쓰기 요청에는 `X-Requested-With`를 요구한다. `sid` 쿠키가 둘 이상 오면 401이다 (쿠키 심기 방지). 그래서 로그인 라우트를 만들 때 쿠키는 `Path=/` 하나로 고정하고 이전 `sid`를 만료시킨다. 컨트롤러와 도구 핸들러는 사용자를 `@CurrentUser()`에서만 받는다. 세션 발급 시각은 따로 저장하지 않고 `expires_at - 30일`로 계산한다. 카카오·구글 OAuth는 시크릿이 준비되면 같은 모듈에 붙인다. 그 전의 로컬 개발용으로 `POST /api/auth/dev-login { key }`가 있다 (`modules/users/dev-login.controller.ts`, 2026-11-20): `DEV_LOGIN=true`일 때만 열리고, production 설정은 `DEV_LOGIN=true`로 부팅하지 않는다. 켜짐 검사와 `X-Requested-With` 검사는 `DevLoginGuard`가 본문 검증보다 먼저 하므로, 꺼져 있으면 본문과 상관없이 모르는 라우트처럼 404다. 이전 세션 폐기와 새 발급은 `AuthService.rotate`(모든 로그인 라우트가 같이 쓴다)가 하고, 이전 세션은 쿠키의 `sid`에서 읽는다(`sessionCookieFrom`). 사용자 id는 `dev-<key>`(소문자, 숫자, `-`, 24자까지)로 OAuth 사용자와 겹치지 않고, 처음이면 정책 기본 예산으로 만든다. 다른 쿠키 쓰기처럼 `X-Requested-With`를 요구하고, 이전 `sid`는 폐기하며, `sid`는 HttpOnly, SameSite=Lax, `Path=/` 하나다(개발은 http라 Secure 없음). 레벨 올리기 재인증(D-28): `REAUTH_MODE=none`이면 `POST /agents/me/level`의 버튼만으로 올린다(테스트넷 데모, production은 부팅 거절). `pouch`는 파우치 지갑 서명이 재인증을 대신할 자리이고 Q-30 전까지 거절한다. 내리기는 재인증이 없다(D-21). 구현은 `modules/agents/agent-level.service.ts`. 본인 인증은 `modules/identity`(`POST /identity/verify`, 테이블 `identity_checks`, D-16): `VERIFY_MODE=mock`이면 통과를 기록하고, `kakao`는 Q-19 전까지 거절한다. `AgentsService.create`는 통과 기록이 없으면 403으로 부화를 막는다. identity를 users와 따로 둔 것은 users가 agents를 import해서 agents가 users에 물으면 순환이 생기기 때문이다. 내 정보는 `modules/users`의 `MeController`(`GET /me`는 용 요약, 용이 없으면 404, `PATCH /me`는 월 예산을 정책 선택지 값으로만 바로 바꿈, D-21)와 `SignupController`(`GET /signup/config`, 공개, `VERIFY_MODE`와 체험용 용돈). 체험용 용돈 받기 `POST /signup/trial`은 allowance 모듈의 `TrialController`다(세션, 본인 인증 통과 필요, 한 번만).

## 반드시 지킬 규칙 (MUST)
- 파우치 결과는 서버가 묶어 둔 요청으로만, 한 번만 받는다. 앱 ID와 흐름은 서버 기록에서 가져온다 (콜백 본문을 믿지 않는다).
- 파우치 앱 키(`POUCHI_APP_KEY`)는 API 환경변수에만 둔다. 웹, `NEXT_PUBLIC_`, 로그, 응답에 넣지 않는다.
- 파우치에서 받은 것은 지갑 ID와 지갑 주소만 저장한다 (이메일 같은 프로필 없음).
- 로그인 전 쿠키 쓰기 라우트(bind, complete)도 `X-Requested-With`를 요구한다 (`CsrfHeaderGuard`).
- 모든 쓰기 API는 세션의 역할을 확인한다. `operator` 역할은 환경변수 허용 목록의 계정만.
- 동결 상태의 사용자도 로그인과 조회, 회수(에이전트 지갑 float를 소유자로 drain, 모드 V면 `withdraw`)는 할 수 있어야 한다.

## 하지 말 것 (MUST NOT)
- 파우치 앱 키를 웹에 넣지 않는다 (API 환경변수에만).
- 세션 토큰을 웹 localStorage에 두지 않는다.
- 앱 로그인 계정과 MAWS 계정이 자동으로 같다고 가정하지 않는다 (미확인, D-11 #2).

## 확장 지점
- 파우치 결과 확인은 `PouchiBridge` 포트 뒤(`modules/pouchi/pouchi-bridge.ts`, 실제는 `sdk-pouchi-bridge.ts`)라 SDK가 바뀌어도 그 한 파일만 고친다. 웹은 세션 입구 하나로 감싼다.
- MAWS 멀티테넌트가 확인되면 "사용자별 MAWS 계정 연결" 단계를 온보딩에 넣는다. 확인 전에는 운영자 계정 하나가 모든 에이전트를 소유하는 방식(데모 한정)을 쓴다. 이 경우 화면과 README에 정직하게 밝힌다.

## 테스트 기준
- 묶지 않은 요청, 이미 쓴 요청, 만료된 요청, 거절되거나 취소된 결과, 기기 확인 전 결과는 401이고 세션도 사용자도 생기지 않는다 (`users/pouchi-login.spec.ts`).
- 같은 파우치 지갑으로 다시 로그인하면 같은 사용자다.
- 역할 없는 세션으로 operator API 호출 시 403.
- 로그아웃 후 세션이 무효.

## 열린 질문
- D-11 #2 MAWS 멀티테넌트. 결론에 따라 "소유자 지갑"이 누구 것인지 바뀐다.
- 1단계 결정 (tech-spec "2.3 인증 흐름", "5.3 소유자와 에이전트 관계"): 운영자 계정이 모든 에이전트의 8004 소유자다. 그러면 전역 KYC 하루 누적이 모든 사용자에게 합쳐진다 (추론). 사용자별 소유자 지갑은 D-24에 따라 파우치 임베디드 SDK가 나오면 사용자 파우치 지갑으로 바꾼다 (Q-30). 그때까지 소유자 서명은 `OwnerAuthority` 포트의 `CustodialOwner` 구현이 맡는다.

## 관련 문서
- `docs/tech-spec.md` "2.3 인증 흐름", "9.4 세션·인증"
- `security.md`, `infra.md`
