---
node: leaf
parent: _index.md
children: []
---

# Button

`packages/ui/src/base/Button/`

## 책임
누르면 콜백을 부르는 버튼 하나를 그린다. 종류는 주(잎색), 보조(옅은 테두리), 테두리(ink), 텍스트, 링크(잎색 글자), 카카오.

## 책임 아님
무엇을 할지 결정 (콜백만 부름), 로딩 중 API 대기 처리 (부모가 `loading`을 넘김)

## props
`variant: 'primary' | 'secondary' | 'outline' | 'accent' | 'text' | 'link' | 'kakao'`, `size?: 'lg' | 'md' | 'sm' | 'choice' | 'tall'` (기본 `lg`: 높이 56, 반경 18 / `md`: 높이 44 알약, 0 18px / `sm`: 높이 44 작은 글자 13/600 / `choice`: 높이 52 가로 채움 / `tall`: 높이 64 가로 채움, 두 줄), `loading?: boolean`, `icon?: ReactNode` (스크린 리더에는 숨김), `onPress: () => void`, `children: ReactNode`

## 하네스 상태
`Button.stories.tsx`에 아래를 전부 만든다.
- 기본 일곱 종류
- 누름(0.97 스프링)
- 로딩
- 아이콘 포함
- 긴 문구 줄바꿈
- 작은 크기 (`Small`, link sm)
- 고르기 크기 (`Choice`, primary와 secondary choice, text md)
- 두 줄 크기 (`Tall`)
- 테두리 알약 (`Outline`)
- 잎색 테두리 알약 (`Accent`, Budget 받기)

## 쓰는 화면
모든 화면

## 테스트 기준
- onPress 호출
- 로딩 중 두 번 누름 방지
- 키보드 포커스 표시
- 터치 영역 44 이상
- 종류와 크기 클래스가 붙고, 화면에서 옮겨 온 크기 값(sm 44, choice 52, tall 64, md 0 18px, outline ink 테두리, accent 잎색 테두리와 글자, link 잎색)이 시안대로다

## 메모
- 누름은 Motion `whileTap` scale 0.97 스프링(damping 18, stiffness 300). 동작 줄이기면 누름 효과 없음.
- 로딩 중에는 `aria-busy`, 흐리게, 누름 무시. 스피너는 넣지 않는다 (design-and-motion.md).
- 하네스에는 문서 상태 열 개와 `md` 크기 스토리가 있다.
- 2026-11-19 재사용 감사(D-18 원칙 5)로 화면마다 손으로 만들던 버튼을 여기로 모았다: `outline md`(Frozen 돌려받기), `link sm`(UserBubble 다시 보내기, HatchProgress 다시 깨우기), `secondary choice`(Blocked 다시 고르기, 52 15/600), `primary choice`(LimitChat 바꾸기, 52 반경 16 16/700), `text md`(LimitChat 그만두기, 44 15/400), `primary tall`(Blocked 올리기, 64). 크기와 종류의 조합 값은 시안을 그대로 옮겼다. 다른 영역은 `motion.button`을 직접 쓰지 않는다 (press.test가 지킨다).
- `md` 옆 여백은 Wallet "채우기"와 Frozen "돌려받기" 시안 값 0 18px(`size.pillPadX`)이다 (이전 8 16을 시안대로 고침).
- 시안 값: 주 lg는 17/700(Confirm, Budget), 보조와 카카오 lg는 16/600(Start), 텍스트는 높이 48에 15/400(Confirm "다시 고를래"), md는 높이 44 알약에 15/600이고 내용 너비(Wallet "채우기"). lg만 가로를 채운다. 글자 값은 tokens.json `type.button`, `type.buttonSub`(2026-11-19 시안에서 옮겨 적음).
- `accent`는 Budget 시안 "받기"(흰 바탕, 1px 잎색 테두리, 잎색 글자)다. md와 같이 쓴다 (2026-11-19, TrialAllowance).
- 반경: Start 시안은 16, Confirm과 Budget은 18이라 토큰 `radius.button`(18) 하나로 통일했다.
