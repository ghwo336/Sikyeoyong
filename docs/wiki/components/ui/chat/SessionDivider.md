---
node: leaf
parent: _index.md
children: []
---

# SessionDivider

`packages/ui/src/chat/SessionDivider/`

## 책임
지난 대화 위에 날짜와 끼니("11월 21일 저녁")를 한 줄로 그린다 (D-34).

## 책임 아님
날짜와 끼니 문구 만들기 (웹 대화 기능이 시각에서 만들어 글로 넘긴다)

## props
`label: string`

## 하네스 상태
`SessionDivider.stories.tsx`에 아래를 전부 만든다.
- 날짜와 끼니 (`Default`)
- 시각을 모르는 옛 대화 (`Unknown`, "지난 대화")

## 쓰는 화면
Main (접힌 지난 대화)

## 테스트 기준
- 글만 그리고 버튼이 없다
- 가운데 정렬, `type.stamp`와 `ink-secondary` (ChatThread 맨 위 시각과 같은 목소리)

## 메모
- 시안에는 아직 없다. 디자이너 확인 필요 (디자인 공백): 지난 대화 구분선의 모양과 간격. 지금은 맨 위 시각과 같은 글자로 둔다.
