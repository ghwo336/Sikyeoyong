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
`mood: 'default' | 'happy' | 'excited' | 'worried' | 'hiding' | 'sleeping' | 'eating' | 'cooking'`, `size: 32 | 44 | 56 | 64 | 96 | 104 | 128` (64는 IdCard 초상, 104는 Budget 3단계), `species: DragonSpecies`, `wings?: boolean`

## 하네스 상태
`Dragon.stories.tsx`에 아래를 전부 만든다.
- 표정 8종 전부
- 종 4가지 (숲용, 물용, 꽃용, 별용) x 대표 표정
- 크기 7종
- 날개 있음

## 쓰는 화면
거의 모든 화면

## 테스트 기준
- mood마다 다른 그림
- aria-hidden (장식)
- 종마다 다른 그림 (숲용 잎 볏, 물용 지느러미 귀와 물방울, 꽃용 꽃잎 귀와 꽃 볏, 별용 별 뿔)

## 메모
- 파일 나눔 (2026-11-19 재사용 감사, D-18 원칙 5): `Dragon.tsx`는 순서대로 놓기만 하고, 종 장식(볏, 이마, 껍데기 무늬)은 `DragonSpecies.tsx`, 머리와 얼굴(기분별 눈, 입, 숨은 머리)은 `DragonFace.tsx`, 효과(Zz, 땀, 김, 그릇, 날개)는 `DragonEffects.tsx`에 있다. 겉 Dragon과 props는 하나 그대로다. 하위 폴더 `parts/`가 아니라 같은 폴더의 `Dragon*.tsx`인 이유: 커밋 게이트(`scripts/verify.py` D18 ui-harness)가 컴포넌트 폴더 안 하위 폴더의 tsx를 막는다. 진짜 그림이 오면 이 폴더 안만 바꾼다.
`DragonSpecies = 'forest' | 'water' | 'flower' | 'star'` (숲용, 물용, 꽃용, 별용). 타입과 zod 스키마는 `packages/shared`의 `DragonSpecies`, `DRAGON_SPECIES`, `zDragonSpecies` 하나만 쓴다 (API의 `agents.dragon_species`와 같은 목록). 종별 모양 기준은 `design/screens/Dragons.dc.html` (D-20). 종은 색만 바꾸는 게 아니라 머리 장식이 다르다. 기본 얼굴(눈, 볼, 웃음)은 네 종이 같다.
한 번에 한도에 따라 자란다 (D-31, shared `dragonStage`: 10,000 이하 1단계, 30,000 이하 2단계, 그 위 3단계). 3단계에 날개가 생긴다(`wings`, 부모가 단계로 정함). Budget의 크기 성장(80, 92, 104)은 `DragonLine` `stage`가 한다. 화면에 "레벨" 말은 쓰지 않는다. 시안의 SVG는 임시. 본 일러스트가 오면 이 컴포넌트 안만 바꾼다.
표정 기준: 기본(Main), 기쁨(Arrived, ^ 눈과 벌린 입), 신남(크게 뜬 눈과 벌린 입), 걱정(Blocked 눈썹과 땀방울), 숨기(Blocked: 머리를 껍질 뒤로 내리고 눈썹과 눈만 테두리 위로, 땀방울, 조금 높은 껍질 테두리), 잠(감은 눈과 Zz), 먹기(Cap 만족한 눈과 그릇), 요리(Done 동그란 입과 김). 별용은 기본 표정에서 윙크하고 입이 조금 넓다, 꽃용은 볼이 조금 크다(도감). 별 뿔은 `dragonAccent.violet`(노른자색). 색은 모두 토큰(`color.dragon`, `color.dragonAccent`, `cheekFlower`, `sweat`, `steam`, `eggShell`)이고 종은 `data-species`로 바꾼다.
