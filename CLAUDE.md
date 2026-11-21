# CLAUDE.md: 시켜용 작업 진입점

시켜용은 AI 비서(아기 드래곤)가 카드번호 대신 한도가 걸린 OKRW로 배달을 시키고, 한도와 신원 확인은 앱이 아니라 마루 체인(PCL)이 지키는 마루 대표 레퍼런스 디앱이다.

## 1. 읽는 순서 (새 세션은 반드시 이 순서)
1. `docs/pitch.md`: 무엇을 왜 만드는지 (한 장)
2. `docs/_research/decisions.md`: 모든 결정의 기준. 다른 문서와 다르면 이 파일이 맞다
3. `docs/wiki/README.md`: 위키 ROOT. DFS 규칙대로 내려간다
4. 맡은 컴포넌트 문서: `docs/wiki/components/<이름>.md`
5. `docs/tech-spec.md`의 해당 절: API, 테이블, 컨트랙트 세부
6. 마루 사실이 필요하면 `docs/_research/maroo-facts.md`
7. 화면을 만들면 `design/README.md`, `design/user-flow.md`, `docs/wiki/conventions/design-and-motion.md`, 만들 컴포넌트의 `docs/wiki/components/ui/<영역>/<이름>.md`
8. 코드를 쓰기 전에 `docs/wiki/conventions/architecture.md` (어디에 무엇을 두는가, 단일 책임)

작업 중 막히면 `docs/wiki/log/open-questions.md`부터 본다. 이미 열린 질문일 수 있다.

## 2. 절대 규칙
1. **em dash(U+2014)와 en dash(U+2013)를 쓰지 않는다.** 코드 주석, 커밋 메시지, 문서, UI 문구 모두. 마침표, 쉼표, 콜론, 괄호로 끊는다.
2. **체인 설정을 하드코딩하지 않는다.** 체인 ID, RPC, 컨트랙트 주소, 프리컴파일 주소는 `packages/shared/src/config`에만 둔다 (배포 주소는 `config/deployments/<chainId>.<profile>.json`). 테스트넷 체인 ID(450815)는 바뀔 예정이다.
3. **LLM에게 돈을 옮기는 도구를 주지 않는다.** 임의 주소 송금, 에이전트 생성·충전(즉시 충전 포함), 정책 변경 도구는 금지. LLM 도구는 읽기 도구와 `place_order`(견적과 확인 카드만), `request_owner_approval`, `propose_limit_change`(한도 변경 카드만, 바꾸지 않음, D-21)뿐이다. 결제는 사용자가 확인 카드 버튼을 눌렀을 때(`POST /api/orders/:id/confirm`)만 일어난다.
4. **금액은 aokrw 단위 `bigint`(DB는 문자열 또는 정수 문자열)로만 다룬다.** `number`, 소수, 부동소수점 금지. 표시할 때만 OKRW로 바꾼다.
5. **비밀을 커밋하지 않는다.** `.env`, `WAAS_AUTH_TOKEN`, 에이전트 키, OAuth 시크릿, Anthropic 키. 예시는 `.env.example`에 빈 값으로만.
6. **사실과 추론을 구분한다.** 마루 동작을 문서에 쓸 때 (확인), (추론), (미확인)을 붙인다. 모르면 미확인으로 쓰고 open-questions에 올린다.
7. **결정을 바꾸려면 `decisions.md`부터 고친다.** 날짜와 이유를 남기고, 그다음 영향받는 위키와 코드를 고친다.
8. **위키를 함께 갱신한다.** 컴포넌트 규칙이 바뀌면 그 컴포넌트 문서를, 새 문서를 만들면 부모 `children`과 ROOT 트리 지도를 같은 커밋에서 고친다.
9. **결제 호출은 자동 재시도하지 않는다.** 실패 원인을 확인하고 같은 `orderRef`로만 다시 시도한다 (멱등성).
10. **마루 문서·도구 문제를 발견하면 기록한다.** `docs/wiki/maroo/devrel-feedback.md`. 이 기록은 데브렐 업무로 이어진다.
11. **정책 동작을 과장하지 않는다.** "멤풀 전에 막는다"는 전역 정책(KYC 한도)에만 쓴다. 시켜용 컨트랙트 한도는 실행 중 revert(블록에 남고 가스 과금)다. 키 유출은 "주문 경로의 큰돈은 체인이 막고, 우회 경로로는 float만 잃는다"로 말한다 (decisions D-02, D-06).
12. **화면은 `design/` 시안대로 만든다.** 사용자 화면에 블록체인 말(지갑, 토큰, 트랜잭션, KYC, PCL)을 쓰지 않고, 체크리스트 카드, 안내 박스, 설명 문단 같은 AI 슬롭을 넣지 않는다 (D-17).
13. **단일 책임과 조립 원칙을 지킨다 (D-18).** 페이지(`apps/web/app/**/page.tsx`)는 조립만 한다. UI 컴포넌트는 `packages/ui`에 폴더 하나씩(본체, 하네스 스토리, 테스트) 두고 위키 문서를 같은 커밋에서 만든다. 하네스와 문서 없는 컴포넌트는 합치지 않는다. API는 Nest 모듈 하나가 책임 하나, 컨트롤러에 로직 금지, 다른 모듈 저장소 직접 접근 금지.

## 3. 작업 시작 체크리스트
- [ ] 위 읽는 순서 1~4를 읽었다
- [ ] `docs/wiki/log/worklog.md` 마지막 항목을 읽었다 (이전 세션이 어디까지 했는지)
- [ ] 맡은 일과 관련된 열린 질문을 확인했다
- [ ] 바꿀 인터페이스가 다른 컴포넌트와 닿는지 확인했다 (`packages/shared` 변경이면 영향 범위를 적는다)

## 4. 커밋마다
- 커밋은 한 가지 일만. 커밋할 때마다 `commit-verifier` 에이전트로 검증하고 FAIL이면 수정 커밋으로 고쳐 다시 검증한다 (`docs/wiki/conventions/dev-loop.md`). 기계 게이트는 `python3 -I scripts/verify.py`.

## 5. 작업 종료 체크리스트
- [ ] 테스트를 돌렸다 (`docs/wiki/conventions/testing.md` 기준)
- [ ] `grep -rnP '\x{2014}|\x{2013}' .` 결과가 비어 있다 (node_modules 제외)
- [ ] 바뀐 규칙을 컴포넌트 문서에 반영했다
- [ ] 새로 알게 된 마루 사실은 `maroo-facts.md`에, 문제는 `devrel-feedback.md`에 적었다
- [ ] 해결한 질문은 `open-questions.md`에 결론을 적었다
- [ ] `worklog.md`에 오늘 한 일, 막힌 것, 다음 할 일을 남겼다
- [ ] 결정을 바꿨거나 금요일이면 `wiki-gardener` 에이전트로 위키를 정리했다 (`docs/wiki/conventions/wiki-gc.md`)

## 6. 서브 에이전트 분업 가이드
아래 단위는 인터페이스만 맞으면 서로 독립적으로 작업할 수 있다. 공유 인터페이스는 모두 `packages/shared`에 있다. 분업 전에 공유 타입을 먼저 확정하고, 각 에이전트는 자기 폴더만 고친다.

| 작업 단위 | 폴더 | 경계 (먼저 고정할 것) | 의존 |
| --- | --- | --- | --- |
| 컨트랙트 | `contracts/` | `SikyeoyongOrders` ABI, 이벤트 이름 (decisions D-08) | 없음 |
| 체인·결제 어댑터 | `apps/api/src/modules/chain`, `apps/api/src/modules/payment` | `PaymentProvider` 인터페이스, `AppErrorCode` | 컨트랙트 ABI |
| 에이전트 런타임 | `apps/api/src/modules/llm` | 도구 목록과 입출력 스키마 (tech-spec 3.3) | 결제 어댑터 인터페이스 (구현은 목으로 대체 가능) |
| 사용자 API | `apps/api/src/modules/*` 컨트롤러 (orders, agents, budget, approvals, users) | API 스키마 (`packages/shared/src/api`) | 데이터 계층 |
| 데이터·시드 | `apps/api/src/db`, `seed/`, `infra/scripts/seed-merchants.ts` | Drizzle 스키마 | 없음 |
| UI 컴포넌트 | `packages/ui` (영역 단위로 나눠 맡김: base, dragon, chat, order, limits, onboarding, wallet) | 위키 `components/ui/` 문서의 props | 없음 (하네스로 혼자 개발) |
| 웹 조립 | `apps/web` (app/, features/) | API 스키마, ui props | UI 컴포넌트, 사용자 API (목으로 대체 가능) |
| 인프라 | `infra/` | 환경변수 이름 목록 | 없음 |

규칙:
- 두 에이전트가 같은 파일을 동시에 고치지 않는다. `packages/shared` 변경은 한 에이전트가 맡고 나머지는 기다린다.
- 각 에이전트는 끝날 때 worklog에 자기 항목을 남긴다.
- 리뷰는 만든 에이전트가 아닌 다른 에이전트가 한다 (특히 컨트랙트, 결제, 에이전트 도구).

## 7. 명령어 규약 (이 이름으로 만든다. 명령은 대상 패키지나 폴더가 생기는 커밋에서 루트 package.json에 추가한다)
| 명령 | 뜻 |
| --- | --- |
| `pnpm install` | 의존성 설치 |
| `pnpm dev` | api + web 동시 실행 |
| `pnpm dev:api` / `pnpm dev:web` | 하나만 실행 |
| `pnpm ui:harness` | Storybook으로 UI 컴포넌트 하네스 실행 |
| `pnpm build` | 전체 빌드 |
| `pnpm test` | 단위·통합 테스트 |
| `pnpm lint` / `pnpm typecheck` | 린트(패키지 ESLint, 경계 회귀 테스트, prettier 검사), 타입 검사 |
| `pnpm format` / `pnpm format:check` | prettier로 코드 정리 / 검사 (마크다운 문서는 대상 아님) |
| `pnpm db:migrate` / `pnpm db:seed` | 마이그레이션, 목 가게 시드 |
| `pnpm contracts:build` / `pnpm contracts:test` | `forge build` / `forge test` |
| `pnpm contracts:deploy:testnet` | PCL 프록시로 테스트넷 배포 |
| `pnpm policy:apply` | `packages/shared/src/config/policy.ts` 값(프로필별)을 컨트랙트 범위 정책에 반영. `changeContractPolicies`는 전체 교체라 현재 값을 읽고 전체를 다시 쓴다 |
| `pnpm merchants:balances` / `pnpm merchants:sweep --to <주소> (--merchant <키>\|--all) [--dry-run]` | 가게 지갑 잔액 보기 / 주인이 손으로 돌리는 가게 지갑 회수 (D-33). 키는 `seed/.keys`(보관본 `archive/`), LLM과 서버 API에는 없다 |
| `pnpm e2e:path-b --run` (또는 `--drain <에이전트 주소>`) | 경로 B 실제 테스트넷 결제 전 과정을 주인이 손으로 돌린다 (실제 트랜잭션, 일회용 에이전트, 끝에 회수). `OPERATOR_KEY`, `AGENT_KEY_ENCRYPTION_KEY` 필요, 키는 출력하지 않는다 |
| `pnpm agent-keys:rotate -- --dry-run\|--run` | 에이전트 키를 현재 마스터 키(v2, HKDF)로 다시 봉인. 교체 절차는 security.md, 키는 출력하지 않는다 |
| `pnpm demo:rehearse` | 데모 장면 1~8 자동 리허설 |
| `pnpm check:dash` | em dash, en dash 검사 |
| `pnpm verify` | 커밋 게이트 (`python3 -I scripts/verify.py`, 커밋 전에는 `pnpm verify --precommit`). 자체 테스트는 `pnpm verify:test` |
| `pnpm wiki:gc` | 위키 정리 후보 찾기 (`python3 -I scripts/wiki-gc.py`, 이미 있음). 정리는 `wiki-gardener` 에이전트 |
| `pnpm check:wiki` | 위키 트리 일관성 검사 (`python3 scripts/check-wiki.py docs/wiki`, 이미 있음) |
