---
node: root
parent: null
children:
  - product/_index.md
  - components/_index.md
  - conventions/_index.md
  - maroo/_index.md
  - log/_index.md
  - roadmap.md
  - archive/_index.md
---

# 시켜용 위키 (ROOT)

## 최우선 규칙
1. **em dash(U+2014)와 en dash(U+2013)를 쓰지 않는다.** 위키, 코드 주석, 커밋, UI 문구 모두. 마침표, 쉼표, 콜론, 괄호로 끊는다.
2. **`docs/_research/decisions.md`가 기준이다.** 위키가 결정과 다르면 결정이 맞다. 위키를 고친다.

시켜용을 만들면서 지켜야 할 규칙, 경계, 불변식, 관례를 컴포넌트별로 모아 둔 트리형 위키. API 목록과 테이블 스키마 같은 세부는 `docs/tech-spec.md`에 있고, 여기서는 그 절을 이름으로 가리킨다.

## 트리 지도
```
docs/wiki/README.md                 ← ROOT (여기서 시작)
├── product/_index.md               무엇을 왜 만드는가
│   ├── vision.md                   목적, 마루다움 5장면
│   ├── scenarios.md                데모 장면 1~8 수용 기준
│   ├── glossary.md                 용어집
│   └── mascot-and-voice.md         아기 드래곤, 말투, 대사 규칙
├── components/_index.md            컴포넌트별 규칙 (같은 양식)
│   ├── web.md                      Next.js 웹 (페이지는 조립만)
│   ├── ui/_index.md                UI 컴포넌트 (packages/ui, 컴포넌트마다 하네스)
│   │   ├── base/ dragon/ chat/ order/ limits/ onboarding/ wallet/  영역별 _index와 컴포넌트 문서 51개
│   ├── auth.md                     카카오·구글·애플 로그인, 세션
│   ├── server-api.md               NestJS API 규약
│   ├── agent-runtime.md            LLM 도구, 인젝션 방어, 승인
│   ├── payment.md                  PaymentProvider, 경로 A/B/C, 멱등성
│   ├── chain-and-pcl.md            체인 설정, PCL 정책, revert 처리
│   ├── contracts.md                SikyeoyongOrders 불변식
│   ├── merchants.md                목 가게, 가게 등록, 판매자 권한
│   ├── recommend-and-nag.md        추천, 잔소리
│   ├── data.md                     Drizzle, 금액, 시간
│   ├── infra.md                    compose, 비밀, 배포, 백업
│   └── security.md                 위협 모델, 체크리스트
├── conventions/_index.md           공통 관례
│   ├── code-style.md               TS 규칙, 네이밍, import 경계
│   ├── git-and-review.md           브랜치, 커밋, PR
│   ├── testing.md                  테스트 층, 데모 리허설
│   ├── writing.md                  문서 문체
│   ├── design-and-motion.md        화면 문구, 슬롭 금지, 움직임, 성능
│   ├── architecture.md             구조와 단일 책임, 페이지 조립, 하네스, Nest 모듈
│   ├── wiki-gc.md                  위키 정리 규칙 (wiki-gardener 에이전트)
│   └── dev-loop.md                 커밋마다 검증 루프 (verify.py, commit-verifier)
├── maroo/_index.md                 마루 지식
│   ├── facts.md                    핵심 사실 요약 (원본은 _research)
│   └── devrel-feedback.md          마루 문서·도구 문제 기록
├── log/_index.md                   기록
│   ├── open-questions.md           열린 질문
│   ├── decisions-log.md            결정 변경 이력
│   └── worklog.md                  세션별 작업 기록
├── roadmap.md                      1단계 주차별, 2단계
└── archive/_index.md               보관함 (wiki-gardener가 옮긴 낡은 내용, 읽지 않아도 됨)
```

## 탐색 규칙 (DFS)
1. 항상 이 ROOT에서 시작한다.
2. 현재 노드의 frontmatter `children`을 위에서부터 순서대로 방문한다.
3. 자식이 `_index.md`(내부 노드)면 그 안으로 먼저 끝까지 내려간 뒤 다음 형제로 넘어간다.
4. 리프(`children: []`)에 닿으면 부모로 돌아가 다음 자식을 방문한다.
5. 질문과 관련 없는 서브트리는 `_index.md`의 요약만 보고 건너뛸 수 있다. 건너뛴 근거는 `_index.md` 요약이어야 한다.
6. 구현 작업이면 최소한 `product/vision.md`, 맡은 컴포넌트 문서, `conventions/` 전체, `log/open-questions.md`는 읽는다.

## 문서 작성 규칙
- 맨 위 최우선 규칙을 먼저 지킨다.
- 모든 문서는 frontmatter에 `node`(root, internal, leaf), `parent`, `children`을 가진다.
- 새 문서를 만들면 **부모의 `children`과 이 트리 지도를 같은 커밋에서** 고친다. 부모에 등록되지 않은 문서는 DFS에서 보이지 않는다.
- 하위 문서가 2개 이상 생길 주제는 폴더 + `_index.md`로 승격한다.
- `_index.md`에는 자식마다 한 줄 요약을 둔다 (가지치기 판단용).
- 사실과 추론을 구분한다: (확인), (추론), (미확인). 담당이 필요하면 (확인 필요: 누구).
- 고민은 먼저 `log/open-questions.md`에 적고, 결론이 나면 해당 노드로 옮긴다.
- 컴포넌트 문서는 `components/_index.md`의 양식을 그대로 쓴다.
- 세부 스펙(엔드포인트, 컬럼)은 `docs/tech-spec.md`에 쓰고 여기서는 절 이름으로 링크한다. 같은 내용을 두 곳에 쓰지 않는다.

_최초 작성: 2026-11-18 (기획 세션)_
