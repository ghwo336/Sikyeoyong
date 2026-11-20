---
node: leaf
parent: _index.md
children: []
---

# API 서버 (apps/api, NestJS)

## 책임
- 사용자 API, 운영자 API, 데모 API, 판매자 API(2단계)를 NestJS 서버 하나에서 제공한다.
- 세션과 OAuth, 요청 검증, 권한, 에러 정규화, 감사 로그.
- 에이전트 런타임, 결제 어댑터, 추천과 잔소리, 체인 인덱서, 배달 타이머를 모듈로 나눠 돌린다.

## 책임 아님
- 화면 (apps/web, packages/ui)
- 한도 판정의 최종 권위 (체인이 한다. API 검사는 사용자 경험과 비용 절약용)
- 키 보관 방식 자체 (MAWS 또는 KMS, `payment.md`)

## 의존과 인터페이스 경계
- 모듈 구조와 규칙은 `conventions/architecture.md` "API". 모듈 목록: health(살아있음 확인만), auth, identity, allowance, wallet, pouchi, users, agents, payment, orders, merchants, recommend, budget, approvals, owner-approvals, llm, chain, indexer, delivery, admin, demo, (2단계) merchant-api.
- 공통 처리는 `src/common/`: 세션 가드, 역할 가드, zod 검증 파이프(`common/pipes/zod-validation.pipe.ts`, 스키마는 `packages/shared/src/api`), `AppErrorCode` 예외 필터, 로깅과 감사 인터셉터.
- DB는 `src/db`의 DbModule(Drizzle, SQLite WAL). 각 모듈의 저장소(repository)만 DB를 만진다.
- 엔드포인트 목록은 tech-spec "3.2 REST API". 경로는 그대로 쓰고 구현만 Nest 컨트롤러로 옮긴다.

## 반드시 지킬 규칙 (MUST)
- **모듈 하나 = 책임 하나.** 컨트롤러는 HTTP만, 서비스는 일, 저장소는 쿼리만. 다른 모듈은 `exports`한 서비스로만 부른다.
- **라우트 네이밍**: 사용자 `/api/...`, 판매자 `/api/merchant/...`(2단계), 운영자 `/api/admin/...`, 데모 `/api/demo/...`(`DEMO_MODE`일 때만 모듈 등록). 복수 명사, kebab-case. 동작은 하위 경로 동사 (`POST /api/orders/:id/cancel`).
- **검증**: 모든 입력(body, query, params)을 공유 zod 스키마 파이프로 검증. 실패는 400.
- **에러 형식** (모든 에러 동일, 예외 필터 하나가 만든다):
  ```json
  { "error": { "code": "CHAIN_AGENT_LIMIT", "message": "사람이 읽을 문장", "dragonLine": "드래곤 대사(선택)", "detail": {} } }
  ```
  `code`는 `AppErrorCode`만 (tech-spec 3.6). 체인 revert는 `chain-and-pcl.md` 매핑으로 바꾼다. 원본 revert는 `AppError.detail.chain`에 담아 서버 로그에만 남기고 응답에는 내보내지 않는다.
  HTTP 상태, `message`, `dragonLine`은 `packages/shared`의 `APP_ERRORS[code]`에서만 가져온다(필터에서 따로 정하지 않는다). 필터는 `common/filters/app-error.filter.ts` 하나이고 `configureApp`이 전역으로 건다. `AppError.detail`에서 응답으로 나가는 것은 `detail.public`뿐이고(5xx는 그것도 내보내지 않는다), 대사 자리표시 값은 `detail.dragonParams`로 넘긴다. 자리표시 값이 빠지면 대사를 빼고 보낸다. Nest HTTP 예외는 400, 401, 403, 404(405 포함), 409, 429를 해당 코드로 바꾸고, 그 밖의 4xx(본문 너무 큼 등)는 `VALIDATION_FAILED`(400), 5xx는 `INTERNAL`(500)로 보낸다. 요약: 검증 400, 로그인 401, 권한 403, 없음 404, 같은 멱등 키에 다른 내용 409, 체인·서버 규칙 거절 422, 멈춤 423, 레이트 리밋 429, 서버 설정·그 밖 500, 한도 메타데이터 미설정 503. 같은 멱등 키와 같은 내용의 재요청은 에러가 아니라 처음 응답을 그대로 돌려준다.
- **금액**: JSON에서 aokrw 정수 문자열. 숫자 타입 금지.
- **시간**: unix ms 정수 (체인 `resetAt`은 unix 초, 필드 이름에 단위 표시). 달력 월(KST, 지갑 화면의 이번 달 아낀 돈과 잔소리 기록)은 `packages/shared/src/time`의 `kstMonthOf`, `kstMonthRange`로만 계산한다. 내 30일 한도는 달력 월이 아니라 체인 30일 창이다 (D-31). 화면에 보이는 KST 글자(`formatKstClock`, `formatKstDate`, `formatKstDateTime`)와 달력 날짜 차이(`kstDaysBetween`)도 같은 파일에 있다.
- **멱등성**: 주문 `clientOrderId`, 대화 `clientMessageId`, 충전과 회수도 클라이언트 요청 ID. 체인에서는 `orderRef`.
- **결제는 확인 엔드포인트에서만**: `POST /api/orders`와 LLM `place_order`는 견적만. 결제는 `POST /api/orders/:id/confirm`에서만.
- **confirm은 상태로 멱등** (D-19): 상태별 동작은 `payment.md` "confirm 상태 규칙"이 원본이다. 요지: `quoted`와 재시도 가능한 `failed`에서만 결제하고(실패는 체인 조회 뒤 같은 orderRef로), 상태 전이는 조건부 UPDATE 하나로 해서 동시에 온 요청 중 하나만 결제로 간다. 나머지 상태는 결제 없이 200과 현재 주문. confirm 상태 때문에 409를 쓰지 않는다.
- **바꿔 끼우는 구현은 프로바이더 토큰으로 주입**: `PaymentProvider`(A, B, C), `LlmProvider`, `MerchantSource`. 설정값으로 고른다.
- **주기 작업**: `indexer`(3초 간격 getLogs), `delivery`(배달 단계 타이머)는 `@nestjs/schedule`. SQLite라 프로세스 하나.
- **감사 로그**: 돈, 정책, 동결, 한도 변경은 누가 언제 무엇을 했는지 기록.
- 대화 응답은 SSE. 본문이 있는 POST라 `@Sse`(GET 전용) 대신 `@Post` + `@Res`로 직접 쓴다 (`data: <ChatEvent JSON>` 한 줄씩, 끝나면 항상 `res.end()`).

## 하지 말 것 (MUST NOT)
- 컨트롤러에서 체인, MAWS, DB를 직접 부르지 않는다.
- 다른 모듈의 저장소나 테이블을 직접 쓰지 않는다.
- 에러 메시지에 스택, 키, 내부 주소를 넣지 않는다.
- 결제 실패를 자동 재시도하지 않는다 (`payment.md`).
- 체인 설정을 서버 코드에 하드코딩하지 않는다.

## 확장 지점
- 심부름 플러그인은 모듈 하나로 추가하고 `/api/errands/:plugin/...`로 연다 (배달은 기존 `/api/orders`).
- 판매자 API는 2단계에 `merchant-api` 모듈로 추가한다.
- Postgres로 옮길 때는 DbModule의 드라이버와 Drizzle 설정, 마이그레이션만 바꾼다. 모듈 코드는 그대로.

## 테스트 기준
- 서비스 단위 테스트: 저장소와 프로바이더를 가짜로 주입.
- 컨트롤러 통합 테스트(Nest Testing + supertest, 메모리 SQLite): 정상, 400, 401/403, 멱등 재요청 동일 응답.
- 체인 revert 시나리오별 에러 코드 매핑 (목 체인 어댑터).

## 열린 질문
- 없음 (엔드포인트는 tech-spec에서 확정)

## 관련 문서
- `conventions/architecture.md`, `payment.md`, `chain-and-pcl.md`, `data.md`, `auth.md`
- `docs/tech-spec.md` "3.2 REST API", "3.6 에러 코드와 드래곤 대사" (D-18 대응표로 읽는다)
