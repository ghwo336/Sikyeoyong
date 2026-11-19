---
node: leaf
parent: _index.md
children: []
---

# ErrorLine

`packages/ui/src/base/ErrorLine/`

## 책임
실패나 다시 확인할 일을 한 줄로 그리고, 나타나면 화면 읽기가 알린다(`role="alert"`).

## 책임 아님
언제 보일지 (부모가 실패 상태일 때만 그린다), 다시 하기 버튼, 문구 정하기 (부모가 용이 말투 쉬운 말로 넘긴다)

## props
`children: string` (한 줄), `id?: string` (입력칸 `aria-describedby`용), `align?: 'start' | 'center'` (기본 start)

## 하네스 상태
`ErrorLine.stories.tsx`에 아래를 전부 만든다.
- 왼쪽 정렬 (`Start`)
- 가운데 정렬 (`Center`)
- 긴 문구 (`Long`)

## 쓰는 화면
Name(`TextField` 오류), Verify(`KakaoVerify` 실패), Confirm(`OrderConfirmSheet` 가격 변경), LimitChat(`LimitChangeCard` 실패)

## 테스트 기준
- `role="alert"`와 넘긴 문구
- `id`가 붙는다
- 기본 start, center로 바꿀 수 있다
- 13px `over-ink`, 여백 0

## 메모
- 2026-11-19 재사용 감사(D-18 원칙 5)로 네 곳에 따로 있던 호박색 한 줄을 모았다.
- 시안에는 오류 모양이 없다. Blocked 시안의 주의 색(`over-ink`)을 빌렸다 (Q-27).
- 글자만 받는다(`string`). 금액이 들어가면 부모가 formatOkrw로 만든 문장을 넘긴다.
