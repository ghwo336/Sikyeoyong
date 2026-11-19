---
node: leaf
parent: _index.md
children: []
---

# ScreenTitle

`packages/ui/src/base/ScreenTitle/`

## 책임
화면 제목(h1)과 그 아래 짧은 설명 한두 줄을 묶어 그린다.

## 책임 아님
문구 정하기 (부모가 넘긴다), 화면 안 위치 (가운데 묶음은 `Hero`, 화면 여백은 화면 틀)

## props
`title: string` (`\n`에서 줄을 바꾼다), `description?: string` (빈 문자열은 없음과 같다), `variant: 'display' | 'title' | 'dragon'`

## 하네스 상태
`ScreenTitle.stories.tsx`에 아래를 전부 만든다.
- 큰 제목 가운데 (`Display`, Start 시안)
- 제목과 설명 (`Title`, Verify 시안)
- 제목만 (`TitleOnly`, Name 시안)
- 용이 말 가운데 (`Dragon`, Hatch 시안)
- 좁은 폭 (`Narrow`, 360 화면)

## 쓰는 화면
Start, Verify, Name, Hatch

## 테스트 기준
- 제목은 h1, `\n`은 `<br>`. 설명은 `p`, 없거나 빈 문자열이면 그리지 않는다
- 시안 값: display 30/700 줄간격 1.3 가운데, 설명까지 10(`size.displayGap`). title 26/700 줄간격 1.35 왼쪽, 8. dragon 고운돋움 22 줄간격 1.5 가운데(`type.dragonHero`), 8, 설명 14px. 설명은 기본 15px 줄간격 1.6 `ink-secondary`
- 말줄임 없음

## 메모
- Hatch의 "알이 흔들려용..."은 용이 말이지만 옆에 용이가 없고 설명 줄이 붙어서 DragonLine이 아니라 여기 `dragon`으로 그린다. 시안은 `p`지만 화면 제목이라 h1로 둔다.
- 줄바꿈은 base `lines`(DragonLine과 같이 쓴다)로 그린다.
- `type.display.lineHeight`(1.3), `type.dragonHero`, `size.displayGap`은 2026-11-19 시안에서 tokens.json으로 옮겨 적었다.
