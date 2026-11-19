---
node: leaf
parent: _index.md
children: []
---

# TrialAllowance

`packages/ui/src/onboarding/TrialAllowance/`

## 책임
체험용 용돈 줄(이름, 금액, "받기" 버튼 또는 받았다는 표시)을 그린다.

## 책임 아님
용돈 받기 요청과 멱등성 (부모와 서버), 실패 표시 (가입 실패 자리는 web.md "남은 일")

## props
`amount: bigint` (aokrw), `status: 'idle' | 'pending' | 'done'`, `onClaim: () => void` (idle일 때만 부른다)

## 하네스 상태
`TrialAllowance.stories.tsx`에 아래를 전부 만든다.
- 받기 전 (`Idle`, Budget 시안)
- 받는 중 (`Pending`)
- 받은 뒤 (`Done`)
- 눌러 보기 (`Flow`, 1초 뒤 받은 뒤 모양)

## 쓰는 화면
Budget

## 테스트 기준
- 이름 "체험용 용돈"과 formatOkrw 금액, Number를 넘는 금액도 정확히
- idle에서 누르면 onClaim 한 번. pending은 `aria-busy`이고 몇 번 눌러도 부르지 않는다
- done이면 버튼이 없고 "받았어요"를 `aria-live` 자리에 보인다
- Budget 시안 값 (위 1px `line`, 선 아래 18 `size.trialTop`, 이름 15/600 위 금액 13px `ink-secondary` 고정폭 숫자, 둘 사이 2)

## 메모
- "받기"는 base `Button` accent md(흰 바탕, 잎색 테두리와 글자, 높이 44 알약 0 18px, 15/600)다.
- 받은 뒤 모양은 시안에 없다 (디자인 선택). 버튼 자리에 잎색 15/600 "받았어요"를 둔다. 캔버스에서 정하면 고친다.
- 버튼이 사라지면 포커스가 몸으로 돌아간다. 다음 할 일("용이랑 시작하기")은 화면 아래 버튼이다.
