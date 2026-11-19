---
node: leaf
parent: _index.md
children: []
---

# 개발 루프: 커밋 하나, 검증 하나 (2026-11-19, 호재 님 요청)

구현은 작은 커밋 단위로 나눠서 하고, 커밋마다 만든 쪽과 다른 검증 에이전트가 까다롭게 본다. 통과할 때까지 고치고 다시 본다.

## 루프
```
계획한 커밋 하나 구현
  → python3 -I scripts/verify.py --skip-build 와 해당 패키지 테스트로 스스로 확인
  → 커밋 (한 가지 일만)
  → commit-verifier 에이전트를 새로 띄운다 (범위, 하려던 일만 전달. 작성자의 결론은 주지 않는다)
  → VERDICT: FAIL 이면 지적 항목을 고쳐 별도 수정 커밋 fix(<범위>): 검증 피드백 반영
       → 같은 기준으로 다시 검증 (범위: 원래 커밋의 부모..수정 커밋, 이전 피드백 함께 전달)
  → VERDICT: PASS 이면 다음 커밋으로
```
- 수정 커밋도 나눠서 쌓는다. 이미 만든 커밋을 amend하거나 히스토리를 고치지 않는다.
- 같은 커밋에서 3라운드가 지나도 FAIL이면 멈추고 사람(호재 님)에게 지적 목록과 막힌 이유를 보여 준다. 검증자와 작성자의 해석이 갈리는 지점(명세가 모호함)은 `log/open-questions.md`에 올린다.
- 검증자는 매번 새로 띄운다. 앞 라운드 검증자의 결론에 묶이지 않게 하려는 것이다. 이전 피드백 목록만 넘긴다.
- MINOR만 남으면 통과다. MINOR는 다음 커밋에서 고치거나 무시 사유를 남긴다.

## 하네스 두 겹
| 겹 | 파일 | 하는 일 |
| --- | --- | --- |
| 기계 게이트 | `scripts/verify.py` (`pnpm verify`) | 절대 규칙과 구조 규칙을 정적으로 검사하고 lint, typecheck, test, build, forge를 돌린다. BLOCKER나 MAJOR가 있으면 실패 |
| 검증 에이전트 | `.claude/agents/commit-verifier.md` | 기계 게이트 결과, diff 정독, 결정·위키·시안 대조, 직접 실행, 일부러 깨 보기(테스트가 동작을 지키는지)로 PASS 또는 FAIL |

기계 게이트 규칙 번호 (verify.py 출력의 규칙 이름):
| 이름 | 내용 | 근거 |
| --- | --- | --- |
| G1, G2, G3 | 깨끗한 작업 트리, 커밋 메시지 형식과 attribution, 커밋 크기와 단위 | `git-and-review.md` |
| R1 | em dash, en dash | CLAUDE.md 1 |
| R2 | 체인 ID, 마루 URL, 주소 하드코딩 | CLAUDE.md 2 |
| R3 | LLM 도구 허용 목록 | CLAUDE.md 3, tech-spec 3.3 |
| R4 | 금액 number, 부동소수점, 단위 변환 위치 | CLAUDE.md 4 |
| R5 | 비밀 파일과 키 패턴, `.env.example` 빈 값 | CLAUDE.md 5 |
| R8 | 위키 트리 일관성, ROOT 트리 지도 등록 | CLAUDE.md 8 |
| R9 | 결제 모듈 재시도 흔적 | CLAUDE.md 9 |
| S1 | any, ts-ignore, 사유 없는 eslint-disable, 문자열 throw | `code-style.md` |
| D17 | 토큰 밖 색, 그라데이션, 레이아웃 애니메이션, 화면의 블록체인 말 | `design-and-motion.md` |
| D18 | 페이지 조립, ui 순수성, 영역 import, 컴포넌트 폴더와 위키 문서, 하네스 상태 수, API 모듈 경계, 얇은 컨트롤러 | `architecture.md` |
| D06 | MAWS 클라이언트는 payment 모듈 안에서만 | decisions D-06 |
| T0, T1 | 빌드·테스트 실패, 소스를 바꿨는데 테스트 변경 없음 | `testing.md` |

## 규칙을 고칠 때
- 게이트가 틀리게 막으면(오탐) 게이트를 고치는 커밋을 따로 만든다 (`chore(verify): ...`). 규칙을 피하려고 코드를 꼬지 않는다.
- 새 규칙이 생기면 이 표와 verify.py를 같은 커밋에서 고친다.
