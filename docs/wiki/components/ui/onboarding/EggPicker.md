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
`value: DragonSpecies`, `onChange: (value: DragonSpecies) => void`

## 하네스 상태
`EggPicker.stories.tsx`에 아래를 전부 만든다.
- 종 4가지 각각 선택됨 (`Forest`, `Water`, `Flower`, `Star`)

## 쓰는 화면
Name

## 테스트 기준
- role=radiogroup (이름 "알"), 숲, 물, 꽃, 별 순서, 각 이름 "숲용 알" 등
- 고른 알만 aria-checked, 클릭으로 onChange 한 번
- 고른 알을 크게(132) 그 종의 무늬로 그리고 (다른 종 무늬는 없음) 아래에 이름과 첫 말 (tokens.json dragonSpecies와 같은 글자)
- Name 시안 값 (선택 칸 60 원, 2px 잎색 테두리와 흰 바탕, 작은 알 40, 칸 사이 10, 묶음 간격 14, 이름 17/700, 말 16px 고운돋움 `ink-secondary`, 이름 줄 높이 48 `size.eggCaption`)
- 화살표 키 이동 (`base/radio-group.ts`의 `radioGroupKeyDown`, `radioTabIndex`를 쓴다)

## 메모
- 나눔 (2026-11-19 재사용 감사): 알 네 개 고르기는 base `ChoiceGroup` row(제목 없이 이름 "알")이고 이 컴포넌트는 둥근 알 버튼만 그린다. 고른 종 이름과 첫 대사는 같은 폴더 `EggPickerCaption.tsx`로 뺐다. 표 `SPECIES_INFO`는 2026-11-20부터 `dragon/Dragon`에 있다 (Look과 같이 쓰려고). EggPicker는 더 내보내지 않는다.
- 둥근 알 버튼은 Chip이 아니다: Chip은 알약 모양 글자 칸이고 이 버튼은 52 원 안의 알 그림이라 모양을 공유하지 않는다 (판단).
알 그림은 `Egg`를 쓴다. 고르면 알 아래에 그 종의 이름과 한마디(도감의 대사)를 보여 준다. 설명 문단은 쓰지 않는다 (D-17).
- 이름과 첫 말은 `DragonLine` 대신 시안대로 이름 17/700과 고운돋움 16px 한 줄로 그린다. 바뀌면 화면 읽기가 한 번 읽는다 (aria-live polite).
- 작은 알은 `Egg` 40px을 그대로 써서 시안(viewBox를 잘라 그림자 없음)과 달리 아래 그림자가 작게 보인다.
