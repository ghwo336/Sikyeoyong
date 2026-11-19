---
node: leaf
parent: _index.md
children: []
---

# TopBar

`packages/ui/src/base/TopBar/`

## 책임
화면 위 뒤로 가기와 제목을 그린다.

## 책임 아님
라우팅 (onBack 콜백)

## props
`title?`, `onBack?`, `trailing?`

## 하네스 상태
`TopBar.stories.tsx`에 아래를 전부 만든다.
- 뒤로만
- 제목
- 단계 표시 포함

## 쓰는 화면
대부분 화면

## 테스트 기준
- 뒤로 버튼 aria-label

## 메모
없음
