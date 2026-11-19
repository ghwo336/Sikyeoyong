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
`open: boolean`, `onClose: () => void`, `label: string` (대화상자 이름, Confirm은 "주문 확인"), `children: ReactNode`, `snap?: 'content' | 'full'` (기본 `content`: 내용만큼, 위 48을 남기고 넘치면 안에서 스크롤. `full`: 늘 그 높이)

## 하네스 상태
`Sheet.stories.tsx`에 아래를 전부 만든다.
- 열림 (`Open`)
- 닫히는 중(스프링) (`Closing`, 열린 뒤 닫기를 눌러 내려가는 모습)
- 내용 길 때 스크롤 (`LongContent`)

## 쓰는 화면
Confirm

## 테스트 기준
- Esc와 바깥(어두운 막) 누르면 onClose, 안을 누르면 아님. Esc는 시트 밖으로 퍼지지 않는다
- 포커스 가두기: 열면 첫 버튼으로, Tab과 Shift+Tab이 안에서 돈다. 닫으면 연 버튼으로 돌아간다. 누를 것이 없으면 시트 자체에 머문다
- role dialog, aria-modal, label 이름
- 아래로 120px 넘게 끌거나 빠르게 튕기면 닫힌다 (`shouldClose`)
- 동작 줄이기면 미끄러짐 없이 페이드만, 기본은 아래에서 올라온다
- Confirm 시안 값 (막 `color.scrim`, 위 모서리 28, 여백 10 20 28, 간격 20, 손잡이 40×5 반경 3 `lineStrong`)

## 메모
- 스프링은 tokens.json `motion.sheet`("damping 22, 300ms 안팎")를 damping 22, stiffness 300으로 옮긴 것이다 (정착 약 360ms). damping은 테스트가 토큰과 맞춘다. 막 색은 ink 38% (`color.scrim`).
- 끌어 닫기는 실제 포인터 이벤트로 테스트한다 (멀리 끌면 닫힘, 조금 끌면 그대로, 동작 줄이기면 안 끌림).
- 패널은 `touch-action: none`, 본문은 `pan-y`라 휴대폰에서는 본문 위 끌기를 스크롤이 가져갈 수 있다 (추론, 기기 미확인). Confirm 조립 때 iOS 사파리에서 확인한다.
- 동작 줄이기에서는 끌어 닫기도 끈다. Esc와 바깥 누르기로 닫는다.
- 열고 닫는 상태는 부모가 쥔다. 시트는 onClose로 닫아 달라고만 한다.
