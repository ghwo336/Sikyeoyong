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
`label`, `value`, `onChange`, `placeholder?`, `error?`, `inputMode?`

## 하네스 상태
`TextField.stories.tsx`에 아래를 전부 만든다.
- 빈 칸
- 입력됨
- 오류

## 쓰는 화면
Name

## 테스트 기준
- 라벨과 입력 연결(htmlFor)
- error가 있으면 aria-invalid

## 메모
없음
