---
node: leaf
parent: _index.md
children: []
---

# Git과 리뷰

## 브랜치
- `main`은 항상 데모 가능한 상태.
- 작업 브랜치: `<종류>/<짧은-설명>`. 종류는 `feat`, `fix`, `contract`, `docs`, `infra`, `chore`.

## 커밋 메시지
- 형식: `<종류>(<범위>): <요약>`. 예: `feat(payment): 경로 B ManagedEoaProvider 추가`.
- 종류: `feat`, `fix`, `contract`, `docs`, `infra`, `chore`, `test`(테스트만), `refactor`(동작 변화 없음). 범위는 영문, 숫자, `/._-`, 컴포넌트 이름은 PascalCase 그대로 (`feat(ui/Button): ...`).
- 요약은 한국어 가능, 50자 안팎. em dash, en dash 금지.
- 결정 변경을 포함하면 본문에 `D-xx` 번호를 쓴다.
- AI 세션이 만든 커밋은 세션 규칙에 따른 attribution 줄을 붙인다.

## PR 체크리스트
- [ ] 관련 컴포넌트 위키 문서를 갱신했다 (규칙이 바뀌었다면)
- [ ] `decisions.md`와 충돌하지 않는다 (충돌하면 decisions.md를 먼저 바꿨다)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` 통과
- [ ] 컨트랙트 변경이면 `pnpm contracts:test` 통과, 불변식 영향 설명
- [ ] 정책값 변경이면 `pnpm policy:apply --check` 결과 첨부
- [ ] 비밀 없음, `.env.example` 갱신
- [ ] `pnpm check:dash` 통과
- [ ] 마루 문서·도구 문제를 발견했으면 `devrel-feedback.md`에 기록

## 리뷰 원칙
- 컨트랙트, 결제 어댑터, 에이전트 도구 목록 변경은 작성자가 아닌 사람(또는 다른 세션·에이전트)이 리뷰한다.
- 리뷰어는 "돈이 나가는 새 경로가 생겼나"를 먼저 본다.

## 비밀
- `.env`, 키 파일, `credentials.json`은 `.gitignore`. 실수로 커밋했으면 키를 즉시 폐기·교체하고 기록한다 (히스토리 삭제만으로는 부족).
