---
node: leaf
parent: _index.md
children: []
---

# Switch

`packages/ui/src/base/Switch/`

## 책임
켜고 끄는 스위치 하나를 그린다.

## 책임 아님
켜면 무슨 일이 일어나는지 (부모 콜백)

## props
`checked`, `onChange(checked)`, `labelId`

## 하네스 상태
`Switch.stories.tsx`에 아래를 전부 만든다.
- 꺼짐
- 켜짐
- 누르는 중

## 쓰는 화면
Wallet

## 테스트 기준
- role=switch, aria-checked
- 키보드 스페이스로 토글

## 메모
없음
