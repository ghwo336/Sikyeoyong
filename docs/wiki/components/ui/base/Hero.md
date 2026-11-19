---
node: leaf
parent: _index.md
children: []
---

# Hero

`packages/ui/src/base/Hero/`

## 책임
큰 그림과 그 아래 글 묶음을 화면이 남긴 높이의 가운데에 세로로 쌓는다.

## 책임 아님
그림 그리기 (`Egg`, `Dragon`을 넘긴다), 제목 모양 (`ScreenTitle`), 화면 여백 (화면 틀)

## props
`art: ReactNode` (위 그림), `children: ReactNode` (아래 글, 보통 `ScreenTitle`), `gap: 'md' | 'lg'` (24 Hatch, 28 Start)

## 하네스 상태
`Hero.stories.tsx`에 아래를 전부 만든다.
- 알과 큰 제목, 간격 28 (`Start`, Start 시안)
- 흔들리는 알과 용이 말, 간격 24 (`Hatch`, Hatch 시안)

## 쓰는 화면
Start, Hatch

## 테스트 기준
- 그림이 먼저, 글이 다음
- 남은 높이를 채우고(`flex-grow: 1`) 가로세로 가운데
- 시안 간격 (md 24 `space-6`, lg 28 `space-7`)

## 메모
- 세로 flex 화면 틀 안에서만 가운데가 된다. 화면 틀(`apps/web/app/globals.css` `.screen`)이 세로 flex라 아래 블록(로그인 버튼, 부화 단계 카드)은 맨 아래로 밀린다.
- 자기 그림이 없는 배치 부품이지만 가운데 정렬과 간격을 스스로 가져서 CSS 모듈이 있다.
