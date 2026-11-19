---
node: leaf
parent: _index.md
children: []
---

# Dragon

`packages/ui/src/dragon/Dragon/`

## 책임
아기 드래곤을 종, 표정, 크기에 맞게 그린다.

## 책임 아님
언제 어떤 표정을 쓸지 (부모가 mood를 넘김)

## props
`mood: 'default' | 'happy' | 'excited' | 'worried' | 'hiding' | 'sleeping' | 'eating' | 'cooking'`, `size: 32 | 44 | 56 | 96 | 128`, `species: DragonSpecies`, `wings?: boolean`

## 하네스 상태
`Dragon.stories.tsx`에 아래를 전부 만든다.
- 표정 8종 전부
- 종 4가지 (숲용, 물용, 꽃용, 별용) x 대표 표정
- 크기 5종
- 날개 있음

## 쓰는 화면
거의 모든 화면

## 테스트 기준
- mood마다 다른 그림
- aria-hidden (장식)
- 종마다 다른 그림 (숲용 잎 볏, 물용 지느러미 귀와 물방울, 꽃용 꽃잎 귀와 꽃 볏, 별용 별 뿔)

## 메모
`DragonSpecies = 'forest' | 'water' | 'flower' | 'star'` (숲용, 물용, 꽃용, 별용). 타입과 zod 스키마는 `packages/shared`의 `DragonSpecies`, `DRAGON_SPECIES`, `zDragonSpecies` 하나만 쓴다 (API의 `agents.dragon_species`와 같은 목록). 종별 모양 기준은 `design/screens/Dragons.dc.html` (D-20). 종은 색만 바꾸는 게 아니라 머리 장식이 다르다. 기본 얼굴(눈, 볼, 웃음)은 네 종이 같다.
레벨에 따라 날개가 생긴다(레벨 3). 시안의 SVG는 임시. 본 일러스트가 오면 이 컴포넌트 안만 바꾼다.
표정 기준: 기본(Main), 기쁨(Arrived, ^ 눈과 벌린 입), 신남(크게 뜬 눈과 벌린 입), 걱정(Blocked 눈썹과 땀방울), 숨기(머리를 껍질 뒤로 내림, 걱정 눈썹), 잠(감은 눈과 Zz), 먹기(Cap 만족한 눈과 그릇), 요리(Done 동그란 입과 김). 별용은 기본 표정에서 윙크한다(도감). 색은 모두 토큰(`color.dragon`, `color.dragonAccent`, `cheekFlower`, `sweat`, `steam`, `eggShell`)이고 종은 `data-species`로 바꾼다.
