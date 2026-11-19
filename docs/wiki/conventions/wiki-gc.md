---
node: leaf
parent: _index.md
children: []
---

# 위키 정리 (가비지 컬렉션)

컨텍스트가 쌓이면 위키에 더 이상 참고하지 않는 값, 바뀐 결정의 흔적, 닫힌 질문이 남는다. 새 세션의 에이전트가 낡은 내용을 사실로 읽지 않게, `wiki-gardener` 에이전트가 주기적으로 정리한다.

## 언제 돌리나
- 결정(`decisions.md`)이 바뀐 커밋 직후.
- 주 1회 (금요일 작업 종료 때).
- `python3 -I scripts/wiki-gc.py` 후보가 20개를 넘었을 때.

## 어떻게 돌리나
- Claude Code에서: "wiki-gardener 에이전트로 위키 정리해 줘". 정의는 `.claude/agents/wiki-gardener.md`.
- 에이전트는 먼저 `scripts/wiki-gc.py`로 후보를 뽑고, 아래 규칙대로 하나씩 판단한다.

## 무엇을 치우나

| 종류 | 찾는 법 | 처리 |
| --- | --- | --- |
| 낡은 용어 (결정이 바뀐 말) | 스크립트의 낡은 용어 목록 | 현재 결정의 말로 고친다. 역사 설명이 필요하면 결정 번호만 남긴다 |
| 없는 경로 | 문서가 가리키는 `docs/`, `design/`, `scripts/` 경로가 없음 | 옮겨진 곳으로 고치거나 줄을 지운다 |
| 대체된 결정 인용 | `decisions.md`에서 "대체됨: D-xx" 표시된 결정을 인용 | 새 결정 번호로 바꾼다 |
| 닫힌 질문 | `open-questions.md`의 상태 닫힘, 해결 | 결론을 해당 컴포넌트 문서나 결정에 옮겼는지 확인한 뒤 `archive/questions.md`로 옮긴다 |
| 작업 기록이 너무 김 | `worklog.md` 항목 10개 초과 | 최근 10개만 남기고 나머지는 `archive/worklog.md`에 한 줄 요약으로 |
| 같은 내용이 두 곳 | 에이전트 판단 (규칙 문장이 두 문서에 똑같이 있음) | 한 곳(더 구체적인 문서)에만 두고 다른 곳은 링크 |
| 쓰이지 않는 UI 컴포넌트 문서 | `components/ui/` 문서의 컴포넌트가 `packages/ui`에 없고 시안에도 없음 | 보관 |

## 원칙 (MUST)
- **지우지 말고 보관한다.** `docs/wiki/archive/`로 옮기고 원래 자리에는 아무것도 남기지 않는다(링크만 고친다). 결정 이력(`decisions-log.md`)과 `decisions.md`의 결정 본문은 건드리지 않는다.
- **결정이 기준이다.** 위키와 `decisions.md`가 다르면 위키를 고친다. 결정을 바꾸지 않는다. 결정이 틀려 보이면 `open-questions.md`에 질문으로 올린다.
- **확인 표시를 지키며 옮긴다.** (확인), (추론), (미확인) 표시를 지우지 않는다.
- **트리를 지킨다.** 옮기거나 지운 문서는 부모 `children`, 영역 `_index.md` 표, ROOT 트리 지도를 같은 커밋에서 고친다. 끝나면 `python3 -I scripts/check-wiki.py docs/wiki`가 오류 0, em dash 검사가 비어 있어야 한다.
- **한 번에 하나의 커밋.** 커밋 메시지: `wiki-gc: 낡은 용어 N, 없는 경로 N, 질문 보관 N`.
- **사람 판단이 필요한 것은 남긴다.** 애매하면 고치지 말고 `worklog.md` 항목의 "정리 보류"에 적는다.

## 하지 말 것 (MUST NOT)
- `decisions.md`, `decisions-log.md`, `_research/maroo-facts.md`의 사실을 고치지 않는다 (사실 정정은 사람이 한다).
- 코드(`apps/`, `packages/`, `contracts/`)를 고치지 않는다. 문서만.
- 하네스나 테스트 기준을 "안 쓰는 것 같아서" 지우지 않는다. 시안과 코드 둘 다에 없을 때만 보관한다.
