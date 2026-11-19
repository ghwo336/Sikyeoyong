---
node: leaf
parent: _index.md
children: []
---

# DetailRows

`packages/ui/src/base/DetailRows/`

## 책임
카드 안의 읽기 전용 이름과 값 쌍 여러 개를 설명 목록(`dl`, `dt`, `dd`)으로 그린다.

## 책임 아님
값 만들기 (부모가 formatOkrw, 짧은 해시 등으로 만들어 넘긴다), 누르기 (줄 전체가 버튼인 설정 줄은 ListRow), 카드 틀

## props
`rows: readonly { label: string; value: ReactNode }[]`, `layout?: 'inline' | 'stacked'` (기본 inline: 이름 왼쪽 값 오른쪽 / stacked: 두 칸, 이름 위 값 16/600), `size: 'caption' | 'small'` (13px, 14px), `gap: 'tight' | 'normal' | 'loose'` (8, 10 `size.summaryGap`, 14 `size.limitsGap`), `tone?: 'ink' | 'secondary'` (inline 값 색, 기본 ink)

## 하네스 상태
`DetailRows.stories.tsx`에 아래를 전부 만든다.
- 영수증 카드 줄 (`ReceiptCard`, small tight secondary)
- 자세히 보기 안 (`ReceiptDetails`, caption normal, 값에 title)
- 한도 바꾸기 카드 (`LimitChange`, small loose)
- 신분증 (`IdCardFacts`, stacked)

## 쓰는 화면
Done과 Receipt(`OrderSummary` details), Receipt(`ReceiptDetails` 펼침), LimitChat(`LimitChangeCard`), IdCard(`IdCard`)

## 테스트 기준
- `dt`, `dd` 쌍을 순서대로, 이름 바로 다음이 값
- 값 노드는 그대로 (짧은 해시의 title 유지)
- 같은 이름이 두 번 와도 줄을 잃지 않는다
- layout, size, gap 클래스와 tone이 목록에 붙는다
- 시안 값 (13px, 14px, 간격 8, 10, 14, 이름 `ink-secondary`, 값 tabular, stacked 두 칸 열 간격 12, 이름 `card-ink`, 값 16/600)

## 메모
- 2026-11-19 재사용 감사(D-18 원칙 5)로 OrderSummary, IdCard, ReceiptDetails, LimitChangeCard에 따로 있던 이름과 값 줄을 모았다. 화면마다 글자 크기와 간격이 달라 그 차이만 props로 받는다.
- **ListRow와 합치지 않는다.** ListRow는 설정 화면의 56px 한 줄(15px, 누르면 버튼, 화살표나 스위치)이고 하나씩 쓴다. DetailRows는 카드 안의 13~14px 읽기 전용 묶음이고 `dl` 의미가 있다. 높이, 글자, 누르기, 의미가 모두 달라 합치면 둘 다 조건문만 늘어난다.
- stacked는 지금 IdCard만 쓴다. 이름 색 `card-ink`는 종 색 카드 위 대비 값이라 다른 곳에서 stacked를 쓰려면 이 문서와 함께 다시 본다.
