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
`variant: 'primary' | 'secondary' | 'text' | 'kakao'`, `size?: 'lg' | 'md'` (기본 `lg`: 높이 56, 반경 18 / `md`: 높이 44 알약), `loading?: boolean`, `icon?: ReactNode` (스크린 리더에는 숨김), `onPress: () => void`, `children: ReactNode`

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
- 누름은 Motion `whileTap` scale 0.97 스프링(damping 18, stiffness 300). 동작 줄이기면 누름 효과 없음.
- 로딩 중에는 `aria-busy`, 흐리게, 누름 무시. 스피너는 넣지 않는다 (design-and-motion.md).
- 하네스에는 문서 상태 다섯 개와 `md` 크기 스토리가 있다.
- 시안 값: 주 lg는 17/700(Confirm, Budget), 보조와 카카오 lg는 16/600(Start), 텍스트는 높이 48에 15/400(Confirm "다시 고를래"), md는 높이 44 알약에 15/600이고 내용 너비(Wallet "채우기"). lg만 가로를 채운다. 글자 값은 tokens.json `type.button`, `type.buttonSub`(2026-11-19 시안에서 옮겨 적음).
- 반경: Start 시안은 16, Confirm과 Budget은 18이라 토큰 `radius.button`(18) 하나로 통일했다.
