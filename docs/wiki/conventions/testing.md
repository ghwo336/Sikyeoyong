---
node: leaf
parent: _index.md
children: []
---

# 테스트

## 층
| 층 | 도구 | 대상 | 언제 |
| --- | --- | --- | --- |
| 단위 | Vitest | shared 함수(금액 포맷, 에러 매핑), 서버 도메인 모듈(목 어댑터) | 모든 PR |
| UI 컴포넌트 | Vitest + Testing Library, Storybook 하네스 | 컴포넌트 문서의 테스트 기준과 하네스 상태 전부 | UI PR |
| API 통합 | Jest 또는 Vitest + Nest Testing + supertest, SQLite 메모리 | 컨트롤러, 가드, 멱등성, 에러 형식 | 모든 PR |
| 컨트랙트 | Foundry (`forge test`, fuzz, invariant) | `SikyeoyongOrders` 불변식 | 컨트랙트 PR |
| 테스트넷 | 스크립트 (viem) | PCL 정책이 실제로 막는지, 결제 경로 | 정책·결제 변경 시, 주 1회 |
| E2E | Playwright (웹 빌드) | 장면 1~3, 8 | 3주차부터 |
| 데모 리허설 | `pnpm demo:rehearse` | 장면 1~8 순서대로, 체인 포함 | 데모 전 매번 |

## 규칙
- 돈이 움직이는 기능은 테스트 없이 머지하지 않는다.
- LLM이 들어간 테스트는 녹화 응답 또는 목 `LlmProvider`로 결정적으로 만든다. 실제 모델 호출 테스트는 별도 태그(`@llm`)로 수동 실행.
- 체인 revert 매핑은 테스트넷에서 녹화한 실제 revert 데이터로 테스트한다.
- 테스트넷 테스트는 전용 테스트 에이전트·가게를 쓴다. 데모용 에이전트를 테스트로 오염시키지 않는다.
- 테스트넷 체인 ID·주소는 설정에서 읽는다 (변경 대비).
- `product/scenarios.md`의 기대 결과가 리허설의 판정 기준이다. 장면을 바꾸면 리허설도 바꾼다.

## 필수 테스트 목록 (요약)
- 금액 bigint 왕복, 10^24 이상
- 도구 화이트리스트 자동 비교
- 인젝션, 쪼개기
- orderRef 중복 결제 0건, 타임아웃 후 중복 0건
- 컨트랙트 불변식 1, 3, 4, 6 (`components/contracts.md`)
- 잔소리 경계값
- 동결 후 주문 0건, 회수 가능
