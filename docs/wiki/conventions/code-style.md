---
node: leaf
parent: _index.md
children: []
---

# 코드 스타일

## TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`. `any` 금지 (불가피하면 `unknown` 후 좁히기).
- 외부 입력(HTTP, LLM 도구 입력, 체인 이벤트, 시드 파일)은 zod로 파싱한 뒤에만 쓴다.
- 금액을 `Number()`, `parseInt`, 단항 `+`로 바꾸는 것은 ESLint가 다 막지 못한다. 금액 이름에 대한 이 검사는 커밋 게이트(`scripts/verify.py` R4)가 맡는다.
- 금액: `bigint` aokrw. 변수 이름 끝에 단위를 붙인다 (`amountAokrw`, `limitAokrw`). 표시용 문자열은 `formatOkrw()` 하나로.
- 시간: 내부는 UTC. 변수 이름에 단위 (`expiresAtMs`, `resetAtSec`).
- 에러: 도메인 에러는 `packages/shared`의 `AppErrorCode`를 가진 클래스 (tech-spec "3.6"). 문자열 throw 금지.
- 비동기: 떠도는 Promise 금지 (`no-floating-promises`).
- 주석·로그·문자열에 em dash, en dash 금지.

## 네이밍
| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 폴더, 파일 | kebab-case | `payment-provider.ts`, `merchant-api/` |
| React 컴포넌트 파일 | PascalCase | `ReceiptCard.tsx` |
| 타입, 인터페이스, 클래스 | PascalCase | `PaymentProvider` |
| 함수, 변수 | camelCase | `placeOrder` |
| 상수, 에러 코드 | SCREAMING_SNAKE_CASE | `CHAIN_AGENT_LIMIT` |
| 플랫폼 파일 | `.web.ts`, `.native.ts` | `session-store.web.ts` |
| Solidity | 컨트랙트 PascalCase, 함수 camelCase, 커스텀 에러 PascalCase | `OrderExists` |

## import 경계
- 앱과 서버가 공유하는 것은 **`packages/shared`만**. 앱이 서버 코드를, 서버가 앱 코드를 import하지 않는다.
- `packages/shared`에는 타입, zod 스키마, 설정(chain, policy), 에러 코드, 순수 함수(금액 포맷)만. 런타임 의존(DB, viem 클라이언트, React)을 넣지 않는다.
- 서버 내부: 라우트는 모듈의 `service.ts`만 부른다. 모듈끼리도 `service.ts`로만 (`payment`는 `llm`을 import하지 않는다). MAWS MCP 클라이언트는 `modules/payment` 안에서만 import (`no-restricted-imports`).
- 컨트랙트 ABI는 `forge build` 산출물에서 생성해 `packages/shared/src/abi`에 둔다. 손으로 쓰지 않는다. PCL ABI는 `@maroo-chain/contracts`의 것을 쓴다.

## 설정
- 체인·정책 값은 `packages/shared/src/config` (배포 주소는 `config/deployments/<chainId>.<profile>.json`). 환경별 값은 환경변수로 덮어쓰되 이름은 `.env.example`에 있어야 한다.
- 기능 토글(경로 A/B/C 선택 등)도 설정값으로.
