---
node: leaf
parent: _index.md
children: []
---

# 데이터 (apps/api/src/db)

## 책임
- SQLite + Drizzle ORM 스키마, 마이그레이션, 시드.
- 사용자, 세션, 에이전트, 가게·메뉴, 주문, 승인 요청, 대화, 감사 로그 저장.

## 책임 아님
- 돈의 진실 (체인이 진실. DB는 캐시와 오프체인 정보)

## 의존과 인터페이스 경계
- 테이블 목록과 컬럼은 tech-spec "4. 데이터 모델 (Drizzle, SQLite)". 여기에 다시 쓰지 않는다.
- 다른 모듈의 테이블을 직접 쿼리하지 않는다. 각 모듈의 `service.ts` 함수로만 접근한다 (tech-spec "3.1 모듈 구조"). 예: orders는 `merchantsService.get()`을 부른다.

## 반드시 지킬 규칙 (MUST)
- **금액**: aokrw를 정수 문자열(`text`)로 저장. 읽을 때 `bigint`로 변환. SQLite·Postgres 공통으로 안전.
- **시간**: `integer` unix ms (UTC). 표시 변환은 앱. 예외: 체인 `resetAt`은 unix 초 그대로 받아 변환한다. 개인 예산 달은 `month_kst` 문자열(`2026-12`).
- **ID**: 내부 ID는 `text` UUID v7. `orderRef`(bytes32 hex)는 별도 컬럼 `order_ref`(유니크).
- **마이그레이션**: `drizzle-kit`으로 생성(`pnpm --filter @sikyeoyong/api db:generate`), 커밋. 적용은 `pnpm db:migrate`. 스키마는 `apps/api/src/db/schema/`, SQL은 `apps/api/src/db/migrations/`(빌드 때 dist로 복사).
- **연결**: `openDb`가 WAL, `foreign_keys=ON`, busy_timeout 5000ms를 켠다. 테스트는 `:memory:`. `DATABASE_URL`의 상대 경로는 실행 위치 기준이라 pnpm으로 돌리면 `apps/api/data/`에 생긴다. Postgres로 옮기면 금액 칸은 `numeric(78,0)`이 되고 SQLite용 GLOB CHECK는 지운다. 금액 칸에는 DB에서도 CHECK(숫자만, 앞자리 0 없음, 78자리 이하)를 건다.
- 수동으로 DB를 고치지 않는다. 되돌릴 수 없는 마이그레이션은 PR에 표시.
- **체인 데이터 동기화**: 트랜잭션 해시, 블록 번호, 이벤트 로그 인덱스를 저장해서 재동기화 가능하게. 인덱서 이벤트는 `(tx_hash, log_index)` 유니크로 멱등, 커서는 `chain_cursor`를 같은 DB 트랜잭션에서 갱신.
- **결제 제출 표시**: `orders`와 `wallet_txs`의 제출 시작 칸(`submit_started_at`, tx hash, nonce, `maws_request_id`)은 브로드캐스트나 MAWS 호출 전에 별도 DB 트랜잭션으로 커밋한다 (payment.md "confirm 상태 규칙", D-19).
- 외래 키를 켠다 (`PRAGMA foreign_keys=ON`). Postgres 이전 시 금액 `text`는 `numeric(78,0)`.
- **삭제**: 주문, 결제, 감사 로그는 삭제하지 않는다 (상태로 표현). 대화 기록과 선호 메모리는 사용자 요청 시 삭제 가능.
- Postgres 전환을 막는 SQLite 전용 기능을 쓰지 않는다.

## 하지 말 것 (MUST NOT)
- 금액을 `real`, `integer`(64비트 넘침 위험)로 저장하지 않는다.
- 비밀(경로 B 에이전트 키 포함)을 평문 컬럼에 두지 않는다.
- 공급자 OAuth 토큰을 저장하지 않는다.

## 확장 지점
- Postgres 전환: 드라이버와 설정만 교체. 리포지토리 계층 덕분에 상위 코드 무변경.
- 이벤트 인덱서를 별도 프로세스로 분리 가능.

## 테스트 기준
- 마이그레이션을 빈 DB에 처음부터 적용해 성공.
- 금액 왕복 (bigint → text → bigint) 손실 없음, 10^24 이상 값 포함.
- 시드 멱등.

## 열린 질문
- 대화 기록 보존 기간 (기본 30일 제안, 미확정)

## 관련 문서
- `docs/tech-spec.md` "4. 데이터 모델 (Drizzle, SQLite)"
- `server-api.md`, `merchants.md`
