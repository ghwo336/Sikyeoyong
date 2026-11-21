---
node: internal
parent: ../_index.md
children:
  - base/_index.md
  - dragon/_index.md
  - chat/_index.md
  - order/_index.md
  - limits/_index.md
  - onboarding/_index.md
  - wallet/_index.md
---

# UI 컴포넌트 (packages/ui)

컴포넌트마다 문서 하나. 문서는 그 컴포넌트의 하네스(Storybook 스토리)와 테스트의 기준이다. 구조 규칙은 `../../conventions/architecture.md`, 화면 기준은 저장소 `design/`.

## 문서 양식 (모든 UI 컴포넌트 같음)
```
## 책임            한 문장. "~을 그린다"
## 책임 아님        다른 곳이 할 일
## props            타입까지
## 하네스 상태      스토리로 반드시 만들 상태 목록
## 쓰는 화면        design/screens 파일 이름
## 테스트 기준
## 메모
```

## 새 컴포넌트를 만들 때
1. 영역을 고른다. 없으면 이 문서와 상위 문서에 영역을 먼저 추가한다.
2. `packages/ui/src/<영역>/<이름>/`에 본체, 스타일, 스토리, 테스트, index를 만든다.
3. 이 위키에 문서를 만들고 영역 `_index.md`의 children과 표, ROOT 트리 지도를 같은 커밋에서 고친다.
4. 하네스에서 문서의 상태가 전부 보이는지 확인한다.

## 종별 테마 (D-32)
- 강조색은 `--theme-accent`, `--theme-dark`(누름), `--theme-tint`, `--theme-bg`(화면 바탕), `--theme-body` 다섯 변수다. `pnpm --filter @sikyeoyong/ui tokens`가 `design/tokens.json`의 `dragonSpecies.<종>.theme`에서 `tokens.css`로 만든다 (`:root`과 `[data-species='forest']`가 기본, `[data-species='water' | 'flower' | 'star']`가 종별). 앱은 `<html data-species>` 하나로 바꾼다.
- 테마를 따르는 것: 주요 버튼, 내 말풍선, 진행 막대(StepProgress, Meter limit), 선택 테두리(Chip, EggPicker), 스위치, 초점 테두리, 지도 경로, 로딩 배경, 화면 바탕. 컴포넌트 CSS는 이 변수를 쓴다.
- 고정(테마를 따르지 않음): 경고 노랑(`yolk`, `over` 계열, 30일 배달비 막대와 허락 필요 배지)은 원래 고정 색이다. 한도 초과(`LimitBlocked`), 30일 한도 다 씀(`CapReached`), 금액 확인 시트(`OrderConfirmSheet`, `Sheet fixedTheme`), 한도 바꾸기 카드(`LimitChangeCard`, 금액과 Face ID 확인), 주인 허락 카드(`OwnerApprovalCard`)는 뿌리에 `data-theme="fixed"`를 달아 기본(숲) 색으로 되돌린다. 돈과 경고는 종이 바뀌어도 같은 색이어야 알아본다.
- `--color-leaf`, `--color-ground` 같은 고정 토큰은 그대로 있다 (값은 숲 테마와 같다, 테스트가 맞춘다). 새 컴포넌트가 강조색을 쓰면 `--theme-*`를, 종과 상관없이 늘 같은 색이어야 하면 고정 토큰을 쓴다.
- 하네스 툴바의 "테마"로 모든 스토리를 네 종으로 볼 수 있다.

| 영역 | 내용 |
| --- | --- |
| [base/_index.md](base/_index.md) | 기초: 다른 영역이 가져다 쓰는 기초 부품. 토큰만 쓰고 도메인을 모른다 |
| [dragon/_index.md](dragon/_index.md) | 드래곤: 용이 그림과 말. 표정으로 상태를 말한다 |
| [chat/_index.md](chat/_index.md) | 대화: 대화 화면 부품. 말풍선, 드래곤 한 줄, 입력창 |
| [order/_index.md](order/_index.md) | 주문: 추천, 확인, 기다림, 도착, 상세 |
| [limits/_index.md](limits/_index.md) | 한도: 한도 정하기(금액 조절), 막힘, 변경 카드 |
| [onboarding/_index.md](onboarding/_index.md) | 가입: 로그인, 본인 인증, 알 고르기, 부화, 체험용 용돈 |
| [wallet/_index.md](wallet/_index.md) | 용이 관리: 용돈, 신분증, 멈춤, 맡아 둔다는 한 줄 |
