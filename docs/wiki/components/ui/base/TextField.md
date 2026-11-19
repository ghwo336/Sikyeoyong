---
node: leaf
parent: _index.md
children: []
---

# TextField

`packages/ui/src/base/TextField/`

## 책임
라벨이 붙은 한 줄 입력칸을 그린다.

## 책임 아님
값 검증 규칙 (부모가 `error`를 넘김)

## props
`label: string`, `value: string`, `onChange: (value: string) => void`, `placeholder?: string`, `error?: string` (부모가 정한 안내 문구, 빈 문자열은 없음과 같다), `inputMode?`, `maxLength?: number` (Name은 8)

## 하네스 상태
`TextField.stories.tsx`에 아래를 전부 만든다.
- 빈 칸 (`Empty`)
- 입력됨 (`Filled`, 시안의 "용이")
- 오류 (`Invalid`, "이름을 지어 주세요")

## 쓰는 화면
Name

## 테스트 기준
- 라벨과 입력 연결(htmlFor), 칸마다 다른 id (`useId`)
- error가 있으면 aria-invalid, 안내 문구를 aria-describedby로 읽는다. 없거나 빈 문자열이면 둘 다 없다
- 입력한 값을 그대로 부모에 넘긴다
- Name 시안 값 (라벨 13/600 `ink-secondary`, 칸 52, 여백 16, 1px `line-strong`, 반경 14, 흰 바탕, 글자 17/600, 간격 6)

## 메모
- 라벨과 입력 글자는 `type.label`(13/600), `type.input`(17/600) 토큰을 쓴다.
- 시안에 오류 모양이 없어 Blocked의 주의 색을 빌렸다: 테두리 `color.over`, 안내 13px `color.overInk`. 확정은 open-questions Q-27.
- placeholder는 `ink-muted`, 보통 굵기.
