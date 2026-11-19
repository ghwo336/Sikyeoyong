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
`checked: boolean`, `onChange: (checked: boolean) => void` (반대 값을 요청만 하고 상태는 부모가 정한다), `labelId: string` (보이는 라벨 id, `aria-labelledby`)

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
- Wallet 시안: 트랙 52×32(`size.switchWidth`, `size.switchHeight`), 손잡이 26(`size.switchKnob`) 흰색, 켜짐 잎색, 꺼짐 `lineStrong`. 보이는 높이 32, 누르는 영역 44.
- 손잡이는 `translate`로만 움직이고(시안의 정렬 바꾸기 대신), 누르는 동안 가로로 조금 늘어난다. 동작 줄이기면 미끄러짐과 늘어남이 없다.
