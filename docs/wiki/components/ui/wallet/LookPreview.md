---
node: leaf
parent: _index.md
children: []
---

# LookPreview

`packages/ui/src/wallet/LookPreview/`

## 책임
고른 종의 용이를 크게, 이름과 종 이름, 종별 말버릇과 함께 그린다 (Look 위 미리보기, D-32).

## 책임 아님
종 고르기 (`SpeciesPicker`), 저장 (`PATCH /agents/:id`는 웹 컨테이너), 앱 색 바꾸기 (웹이 `<html data-species>`를 바꾸고 이 부품은 `--theme-*`를 쓸 뿐)

## props
`name: string` (용이 이름, 모습을 바꿔도 그대로), `species: DragonSpecies` (화면에서 고른 종, 저장 전일 수 있음)

## 하네스 상태
`LookPreview.stories.tsx`에 아래를 전부 만든다.
- 종 네 가지 (`Forest`, `Water`, `Flower`, `Star`, 스토리마다 그 종 테마로 감싼다)
- 긴 이름 8자 (`LongName`)

## 쓰는 화면
Look

## 테스트 기준
- 종마다 그 종의 `Dragon`을 168로, 이름, 종 이름(`SPECIES_INFO`), 따옴표 친 말버릇
- 고른 것이 바뀌면 읽어 준다 (`aria-live="polite"`), 용이 그림은 장식 (aria-hidden)
- 시안 값: 바탕 `--theme-tint`, 모서리 28(`radius.sheet`), 여백 24 20 22, 사이 10. 종 이름 배지는 `--theme-accent` 바탕에 흰 글자 13/600, 말버릇은 고운돋움 17

## 메모
- 종 이름과 말버릇은 `dragon/Dragon`의 `SPECIES_INFO`(tokens.json `dragonSpecies.*.name`, `line`) 하나만 쓴다. EggPicker와 같은 표다.
- 이름 20/700과 아래 여백 22는 맞는 토큰이 없어 시안 숫자를 그대로 쓴다.
