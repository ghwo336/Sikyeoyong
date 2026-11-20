---
node: leaf
parent: _index.md
children: []
---

# SpeciesPicker

`packages/ui/src/wallet/SpeciesPicker/`

## 책임
용이 모습 네 가지(숲용, 물용, 꽃용, 별용) 중 하나를 고르게 하고, 무엇이 바뀌고 무엇이 그대로인지 한 줄을 그린다 (Look, D-32).

## 책임 아님
저장과 앱 색 바꾸기 (웹 컨테이너), 미리보기 (`LookPreview`)

## props
`value: DragonSpecies` (화면에서 고른 종), `onChange: (value: DragonSpecies) => void` (누름과 화살표 키. 저장은 부모)

## 하네스 상태
`SpeciesPicker.stories.tsx`에 아래를 전부 만든다.
- 숲용 고름 (`Forest`)
- 별용 고름, 테두리도 별 색 (`Star`)
- 눌러서 바꾸기 (`Picking`, 고른 종으로 테마가 바뀐다)

## 쓰는 화면
Look

## 테스트 기준
- radiogroup 이름 "용이 모습", 네 카드가 D-20 순서, 카드마다 그 종의 `Dragon` 56과 종 이름
- value만 체크, 누름과 화살표 키로 onChange, Tab은 고른 카드로 들어온다 (base `ChoiceGroup` columns)
- 아래 한 줄은 시안 그대로 "모습과 말버릇, 앱 색만 바뀌어요. 이름, 용돈, 한도는 그대로예요." (`LOOK_NOTE`)
- 시안 값: 카드 높이 104, 모서리 18(`radius.button`), 흰 바탕, 테두리 2 `line`, 고른 카드는 `--theme-accent`(D-32 선택 테두리), 이름 15/600, 줄 14 `ink-secondary`, 카드 사이 8, 줄과 20

## 메모
- 아래 한 줄은 시안에 있는 문장이라 설명 문단(D-17)으로 보지 않는다. 모습을 바꿔도 돈과 한도가 그대로라는 사실을 밝힌다.
- 초점 테두리는 시안대로 `ink`(다른 부품은 강조색)다. 고른 카드 테두리와 겹쳐도 보이게.
