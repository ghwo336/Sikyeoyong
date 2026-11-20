---
node: leaf
parent: _index.md
children: []
---

# CustodyNote

`packages/ui/src/wallet/CustodyNote/`

## 책임
지금은 시켜용이 용이 용돈을 대신 맡아 둔다는 한 줄을 그린다 (D-24 "밝히는 문구").

## 책임 아님
보일지 말지 정하기 (페이지가 `MeView.custodial`이 true일 때만 넣는다. 부품은 모드를 모른다)

## props
`detailed?: boolean` (자세히 보기가 켜져 있으면 true)

## 하네스 상태
`CustodyNote.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`, 지갑 화면 맨 아래)
- 자세히 보기 켬 (`Detailed`)

## 쓰는 화면
Wallet (맨 아래)

## 테스트 기준
- 기본 문구는 D-24 그대로 "체험판이에요. 용이 용돈은 지금 시켜용이 대신 맡아 두고 있어요." 블록체인 말이 없다 (D-17)
- 자세히 보기 문구는 D-24 그대로 (README와 같은 글자)
- 문단 하나, caption 크기, `ink-secondary` 색, 왼쪽 정렬 (작게 한 줄, 시안의 다른 줄과 같은 정렬)

## 메모
- 사실을 밝히는 한 줄이라 D-17의 안심 문구나 설명 문단으로 보지 않는다 (D-24). 아이콘, 상자, 닫기 버튼을 붙이지 않는다.
- `OWNER_MODE=pouch`가 되면 서버가 `custodial: false`를 주고 페이지가 이 부품을 넣지 않는다.
