---
node: leaf
parent: _index.md
children: []
---

# 인증 (auth)

## 책임
- 사용자 로그인: 카카오, 구글 (1단계). 애플 (iOS 출시 때, 앱스토어 4.8 대응).
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
- 코드: `modules/auth/auth.service.ts`의 `AuthService`(발급 `issue`, 확인 `resolve`, 폐기 `revoke`, 최근 로그인 `isRecentLogin`)와 `common/guards/session.guard.ts`의 `SessionGuard`, `@CurrentUser()`. 가드는 `sid` 쿠키(웹)나 `Bearer`(네이티브, 스킴 대소문자 무시)를 읽고, 쿠키로 오는 쓰기 요청에는 `X-Requested-With`를 요구한다. `sid` 쿠키가 둘 이상 오면 401이다 (쿠키 심기 방지). 그래서 로그인 라우트를 만들 때 쿠키는 `Path=/` 하나로 고정하고 이전 `sid`를 만료시킨다. 컨트롤러와 도구 핸들러는 사용자를 `@CurrentUser()`에서만 받는다. 세션 발급 시각은 따로 저장하지 않고 `expires_at - 30일`로 계산한다. 카카오·구글 OAuth는 시크릿이 준비되면 같은 모듈에 붙인다. 내 정보는 `modules/users`의 `MeController`(`GET /me`는 용 요약, 용이 없으면 404, `PATCH /me`는 월 예산을 정책 선택지 값으로만 바로 바꿈, D-21)와 `SignupController`(`GET /signup/config`, 공개, `VERIFY_MODE`와 체험용 용돈).

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
