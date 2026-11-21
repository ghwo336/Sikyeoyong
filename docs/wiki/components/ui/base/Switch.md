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
- 꺼짐 트랙 색이 `ink-secondary`이고 `line-strong`이 아니다 (대비 3:1 이상)

## 메모
- Wallet 시안: 트랙 52×32(`size.switchWidth`, `size.switchHeight`), 손잡이 26(`size.switchKnob`) 흰색, 켜짐 잎색, 꺼짐 `inkSecondary`(시안의 `lineStrong`은 바탕과 1.3:1이라 비텍스트 3:1에 못 미쳐 2026-11-22 브라우저 a11y 점검 뒤 바꿨다, 바탕 5.6:1). 보이는 높이 32, 누르는 영역 44. 버튼 자체가 높이 44(`min-height: size.touchMin`, 투명)이고 시안 크기의 트랙은 그 안의 span이다 (2026-11-20 브라우저 QA: 요소 크기가 52×32로 재져서 `::after` 확장 대신 버튼을 키웠다).
- 손잡이는 `translate`로만 움직이고(시안의 정렬 바꾸기 대신), 누르는 동안 가로로 조금 늘어난다. 동작 줄이기면 미끄러짐과 늘어남이 없다.
- 늘어남은 가로 1.15배이고 스프링은 다른 누름과 같은 `motion.press`(damping 18, stiffness 300)다. 1.15는 시안에 없는 값이라 하네스 Pressing에서 눈으로 맞춘다.
- 켜짐 이동 거리는 안쪽 너비 46에서 손잡이 26을 뺀 20이고, `width - height`로 계산한다. 트랙 안쪽 여백 3은 `(height - knob) / 2`.
- 꺼짐 트랙은 시안 `lineStrong`에서 `inkSecondary`로 바꿨다(시안과 다른 점). `inkMuted`(#8A938C)도 바탕 `ground`와 2.96:1이라 3:1에 모자라 쓰지 않는다.
- 흰 손잡이는 꺼짐 트랙 위에서 5.9:1이다.
