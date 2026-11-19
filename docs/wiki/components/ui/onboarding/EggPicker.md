---
node: leaf
parent: _index.md
children: []
---

# EggPicker

`packages/ui/src/onboarding/EggPicker/`

## 책임
알 네 가지(숲, 물, 꽃, 별) 중 하나를 고르게 하고 고른 알을 그린다.

## 책임 아님
저장

## props
`value: DragonSpecies`, `onChange`

## 하네스 상태
`EggPicker.stories.tsx`에 아래를 전부 만든다.
- 종 4가지 각각 선택됨

## 쓰는 화면
Name

## 테스트 기준
- role=radiogroup
- 화살표 키 이동

## 메모
알 그림은 `Egg`를 쓴다. 고르면 알 아래에 그 종의 한마디(도감의 대사)를 `DragonLine`으로 보여 줄 수 있다. 종 이름(숲용 등)은 보여 주되 설명 문단은 쓰지 않는다 (D-17).
