---
node: leaf
parent: _index.md
children: []
---

# LimitChangeCard

`packages/ui/src/limits/LimitChangeCard/`

## 책임
말로 요청한 한도 변경을 전과 후로 보여 주고 확인 버튼을 그린다.

## 책임 아님
변경 실행과 재인증 (onConfirm 뒤 부모가 처리)

## props
`field: 'perOrder' | 'monthlyBudget'`, `from: bigint`, `to: bigint`, `levelFrom?`, `levelTo?`, `needsReauth: boolean`, `onConfirm`, `onCancel`

## 하네스 상태
`LimitChangeCard.stories.tsx`에 아래를 전부 만든다.
- 올리기(재인증)
- 내리기(바로)
- 확인 중
- 실패

## 쓰는 화면
LimitChat

## 테스트 기준
- needsReauth면 'Face ID로 확인하고 바꾸기'
- LLM이 만든 카드라도 확정은 버튼으로만

## 메모
없음
