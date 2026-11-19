---
node: leaf
parent: _index.md
children: []
---

# ChatInput

`packages/ui/src/chat/ChatInput/`

## 책임
대화 입력칸과 보내기 버튼을 그린다.

## 책임 아님
메시지 전송 (onSend 콜백)

## props
`value: string`, `onChange: (value: string) => void`, `onSend: (text: string) => void` (앞뒤 공백을 뺀 글자), `placeholder: string`, `sending?: boolean` (입력은 되고 다시 보내기는 안 됨), `disabled?: boolean` (멈춤: 입력과 보내기 모두 끔), `disabledNote?: string` (멈춤일 때 아래 안내)

## 하네스 상태
`ChatInput.stories.tsx`에 아래를 전부 만든다.
- 빈 칸 (`Empty`, Main 시안)
- 입력됨 (`Filled`)
- 보내는 중 (`Sending`)
- 멈춤 상태라 비활성 안내 (`Stopped`)

## 쓰는 화면
Main, LimitChat

## 테스트 기준
- 빈 값이나 공백뿐이면 onSend 안 부름 (aria-disabled)
- Enter와 버튼으로 전송, 앞뒤 공백 뺀 글자로 한 번
- 한글 조합을 끝내는 Enter로는 보내지 않는다 (isComposing, compositionstart/end. 사파리처럼 compositionend 바로 뒤 Enter도 막음)
- 보내는 중에는 입력은 되고 보내지는 않는다 (aria-busy)
- 보내도 페이지가 다시 열리지 않는다 (폼 제출 기본 동작을 늘 막음)
- 멈춤이면 입력과 버튼이 꺼지고 안내를 aria-describedby로 읽는다
- 숨긴 라벨 "용이에게 말하기", 보내기 버튼 이름 "보내기", 시안 화살표
- 시안 값 (칸 48 알약, 여백 18, 1px `lineStrong`, 15px, 보내기 48 잎색 원, 화살표 20, 간격 8)

## 메모
- 시안은 빈 칸에서도 보내기 원이 잎색이다. 그래서 빈 칸과 보내는 중에는 모양을 바꾸지 않고 누르면 아무 일도 없게 했다. 회색 원은 멈춤일 때만.
- 화면 아래 띠(여백 10 16 24, 바탕 ground)는 화면이 그린다. 이 컴포넌트는 한 줄과 안내만.
- 멈춤 모양과 안내 문구는 시안에 없다 (추론).
- 조합 처리 (추론, 실기기 미확인): 크롬은 조합 중 Enter에 isComposing이 붙고, 사파리는 compositionend 바로 뒤 같은 틱에 Enter가 와서 ref가 막는다. 두 브라우저 모두 조합을 끝내는 Enter로는 안 보내고 한 번 더 눌러야 보낸다. iOS 한글 자판의 보내기 키도 그럴 수 있다. 웹 조립 때 실기기에서 확인하고 여기에 적는다. keyCode 229 검사는 린트(no-deprecated)가 막아 쓰지 않았다.
