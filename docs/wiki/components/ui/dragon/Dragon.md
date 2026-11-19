---
node: leaf
parent: _index.md
children: []
---

# Dragon

`packages/ui/src/dragon/Dragon/`

## 책임
아기 드래곤을 표정과 크기에 맞게 그린다.

## 책임 아님
언제 어떤 표정을 쓸지 (부모가 mood를 넘김)

## props
`mood: 'default' | 'happy' | 'excited' | 'worried' | 'hiding' | 'sleeping' | 'eating' | 'cooking'`, `size: 32 | 44 | 56 | 96 | 128`, `color: DragonColor`, `wings?: boolean`

## 하네스 상태
`Dragon.stories.tsx`에 아래를 전부 만든다.
- 표정 8종 전부
- 색 4종
- 크기 5종
- 날개 있음

## 쓰는 화면
거의 모든 화면

## 테스트 기준
- mood마다 다른 그림
- aria-hidden (장식)

## 메모
레벨에 따라 날개가 생긴다(레벨 3). 시안의 SVG는 임시. 본 일러스트가 오면 이 컴포넌트 안만 바꾼다.
