---
node: leaf
parent: _index.md
children: []
---

# Sheet

`packages/ui/src/base/Sheet/`

## 책임
아래에서 올라오는 시트 틀과 손잡이를 그린다.

## 책임 아님
시트 안 내용 (children)

## props
`open`, `onClose`, `children`, `snap?: 'content' | 'full'`

## 하네스 상태
`Sheet.stories.tsx`에 아래를 전부 만든다.
- 열림
- 닫히는 중(스프링)
- 내용 길 때 스크롤

## 쓰는 화면
Confirm

## 테스트 기준
- Esc와 바깥 누르면 onClose
- 포커스 가두기

## 메모
없음
