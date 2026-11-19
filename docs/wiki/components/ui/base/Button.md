---
node: leaf
parent: _index.md
children: []
---

# Button

`packages/ui/src/base/Button/`

## 책임
누르면 콜백을 부르는 버튼 하나를 그린다. 종류는 주(잎색), 보조(테두리), 텍스트, 카카오.

## 책임 아님
무엇을 할지 결정 (콜백만 부름), 로딩 중 API 대기 처리 (부모가 `loading`을 넘김)

## props
`variant: 'primary' | 'secondary' | 'text' | 'kakao'`, `size: 'lg' | 'md'`, `loading?: boolean`, `icon?: ReactNode`, `onPress: () => void`, `children`

## 하네스 상태
`Button.stories.tsx`에 아래를 전부 만든다.
- 기본 네 종류
- 누름(0.97 스프링)
- 로딩
- 아이콘 포함
- 긴 문구 줄바꿈

## 쓰는 화면
모든 화면

## 테스트 기준
- onPress 호출
- 로딩 중 두 번 누름 방지
- 키보드 포커스 표시
- 터치 영역 44 이상

## 메모
없음
