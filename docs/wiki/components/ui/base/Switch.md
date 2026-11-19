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
- 늘어남은 가로 1.15배이고 스프링은 다른 누름과 같은 `motion.press`(damping 18, stiffness 300)다. 1.15는 시안에 없는 값이라 하네스 Pressing에서 눈으로 맞춘다.
- 켜짐 이동 거리는 안쪽 너비 46에서 손잡이 26을 뺀 20이고, `width - height`로 계산한다. 트랙 안쪽 여백 3은 `(height - knob) / 2`.
- 꺼짐 트랙 `lineStrong`은 흰 바탕에서 비텍스트 대비 3:1에 못 미친다. 시안 값을 따랐고 디자인 판단이 필요하다 (후속).
