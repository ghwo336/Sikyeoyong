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
- 웹: 로그인 버튼은 API의 `/api/auth/oauth/:provider/start`로 이동만 한다. 웹 코드는 토큰을 만지지 않는다.
- API(NestJS auth 모듈): Passport 카카오·구글 전략으로 인가 코드를 교환하고(PKCE, state), 공급자 토큰을 검증한 뒤 자체 세션을 발급하고 웹으로 돌려보낸다. 흐름은 tech-spec "2.3 인증 흐름", 엔드포인트는 "3.2 REST API", 테이블은 "4. 데이터 모델".
- 세션 저장: httpOnly, Secure, SameSite=Lax 쿠키. 웹과 API가 같은 도메인이라 CORS가 필요 없다.
- 코드: `modules/auth/auth.service.ts`의 `AuthService`(발급 `issue`, 확인 `resolve`, 폐기 `revoke`, 최근 로그인 `isRecentLogin`)와 `common/guards/session.guard.ts`의 `SessionGuard`, `@CurrentUser()`. 가드는 `sid` 쿠키(웹)나 `Bearer`(네이티브, 스킴 대소문자 무시)를 읽고, 쿠키로 오는 쓰기 요청에는 `X-Requested-With`를 요구한다. `sid` 쿠키가 둘 이상 오면 401이다 (쿠키 심기 방지). 그래서 로그인 라우트를 만들 때 쿠키는 `Path=/` 하나로 고정하고 이전 `sid`를 만료시킨다. 컨트롤러와 도구 핸들러는 사용자를 `@CurrentUser()`에서만 받는다. 세션 발급 시각은 따로 저장하지 않고 `expires_at - 30일`로 계산한다. 카카오·구글 OAuth는 시크릿이 준비되면 같은 모듈에 붙인다. 그 전의 로컬 개발용으로 `POST /api/auth/dev-login { key }`가 있다 (`modules/users/dev-login.controller.ts`, 2026-11-20): `DEV_LOGIN=true`일 때만 열리고, production 설정은 `DEV_LOGIN=true`로 부팅하지 않는다. 켜짐 검사와 `X-Requested-With` 검사는 `DevLoginGuard`가 본문 검증보다 먼저 하므로, 꺼져 있으면 본문과 상관없이 모르는 라우트처럼 404다. 이전 세션 폐기와 새 발급은 `AuthService.rotate`(모든 로그인 라우트가 같이 쓴다)가 하고, 이전 세션은 쿠키의 `sid`에서 읽는다(`sessionCookieFrom`). 사용자 id는 `dev-<key>`(소문자, 숫자, `-`, 24자까지)로 OAuth 사용자와 겹치지 않고, 처음이면 정책 기본 예산으로 만든다. 다른 쿠키 쓰기처럼 `X-Requested-With`를 요구하고, 이전 `sid`는 폐기하며, `sid`는 HttpOnly, SameSite=Lax, `Path=/` 하나다(개발은 http라 Secure 없음). 레벨 올리기 재인증(D-28): `REAUTH_MODE=none`이면 `POST /agents/me/level`의 버튼만으로 올린다(테스트넷 데모, production은 부팅 거절). `pouch`는 파우치 지갑 서명이 재인증을 대신할 자리이고 Q-30 전까지 거절한다. 내리기는 재인증이 없다(D-21). 구현은 `modules/agents/agent-level.service.ts`. 본인 인증은 `modules/identity`(`POST /identity/verify`, 테이블 `identity_checks`, D-16): `VERIFY_MODE=mock`이면 통과를 기록하고, `kakao`는 Q-19 전까지 거절한다. `AgentsService.create`는 통과 기록이 없으면 403으로 부화를 막는다. identity를 users와 따로 둔 것은 users가 agents를 import해서 agents가 users에 물으면 순환이 생기기 때문이다. 내 정보는 `modules/users`의 `MeController`(`GET /me`는 용 요약, 용이 없으면 404, `PATCH /me`는 월 예산을 정책 선택지 값으로만 바로 바꿈, D-21)와 `SignupController`(`GET /signup/config`, 공개, `VERIFY_MODE`와 체험용 용돈).

## 반드시 지킬 규칙 (MUST)
- OAuth는 PKCE와 state 검증을 한다.
- 공급자 토큰은 검증 후 저장하지 않는다 (필요한 식별자만: 공급자, 공급자 사용자 ID, 이메일 선택).
- 같은 사람이 카카오와 구글로 따로 로그인하면 별개 계정이다. 계정 병합은 1단계 범위 밖.
- 모든 쓰기 API는 세션의 역할을 확인한다. `operator` 역할은 환경변수 허용 목록의 계정만.
- 동결 상태의 사용자도 로그인과 조회, 회수(에이전트 지갑 float를 소유자로 drain, 모드 V면 `withdraw`)는 할 수 있어야 한다.

## 하지 말 것 (MUST NOT)
- 클라이언트 시크릿을 웹에 넣지 않는다 (API 환경변수에만).
- 세션 토큰을 웹 localStorage에 두지 않는다.
- 앱 로그인 계정과 MAWS 계정이 자동으로 같다고 가정하지 않는다 (미확인, D-11 #2).

## 확장 지점
- 공급자 추가는 `AuthProvider` 인터페이스 구현 하나로 끝나게 한다 (애플, 네이버).
- MAWS 멀티테넌트가 확인되면 "사용자별 MAWS 계정 연결" 단계를 온보딩에 넣는다. 확인 전에는 운영자 계정 하나가 모든 에이전트를 소유하는 방식(데모 한정)을 쓴다. 이 경우 화면과 README에 정직하게 밝힌다.

## 테스트 기준
- state 불일치, 만료 코드, 위조 ID 토큰을 거부한다.
- 역할 없는 세션으로 operator API 호출 시 403.
- 로그아웃 후 세션이 무효.

## 열린 질문
- D-11 #2 MAWS 멀티테넌트. 결론에 따라 "소유자 지갑"이 누구 것인지 바뀐다.
- 1단계 결정 (tech-spec "2.3 인증 흐름", "5.3 소유자와 에이전트 관계"): 운영자 계정이 모든 에이전트의 8004 소유자다. 그러면 전역 KYC 하루 누적이 모든 사용자에게 합쳐진다 (추론). 사용자별 소유자 지갑은 D-24에 따라 파우치 임베디드 SDK가 나오면 사용자 파우치 지갑으로 바꾼다 (Q-30). 그때까지 소유자 서명은 `OwnerAuthority` 포트의 `CustodialOwner` 구현이 맡는다.

## 관련 문서
- `docs/tech-spec.md` "2.3 인증 흐름", "9.4 세션·인증"
- `security.md`, `infra.md`
