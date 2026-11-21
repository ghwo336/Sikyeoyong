---
node: leaf
parent: _index.md
children: []
---

# OwnerApprovalCard

`packages/ui/src/order/OwnerApprovalCard/`

## 책임
주문이 주인 허락을 기다리는 이유(처음 시키는 가게, 30일에 쓸 돈 넘음), 가게, 금액을 카드 하나로 그리고 "허락하기"와 "안 시킬래요" 두 버튼을 건다. 대화와 주문 내역 줄이 같은 카드를 쓴다.

## 책임 아님
허락 호출과 그 뒤(다시 견적, 확인 시트 열기, 목록 다시 받기: 웹 컨테이너), 허락 목록 조회, 한 번에 쓸 돈이 넘은 주문(그건 `LimitBlocked`와 한도 바꾸기 카드 몫이고 서버도 허락으로 풀지 않는다)

## props
`reason: 'NEW_MERCHANT' | 'OVER_PERSONAL_BUDGET'`, `store: string`, `amount: bigint` (aokrw), `onApprove: () => void`, `onReject: () => void`, `status?: 'idle' | 'approving' | 'rejecting' | 'failed'`

## 하네스 상태
`OwnerApprovalCard.stories.tsx`에 아래를 전부 만든다.
- 처음 시키는 가게 (`NewStore`), 30일에 쓸 돈 넘음 (`OverBudget`)
- 허락하는 중 (`Approving`), 안 시키는 중 (`Rejecting`), 답이 가지 못함 (`Failed`)
- 별 종 테마에서도 같은 색 (`StarSpecies`)

## 쓰는 화면
Main 대화(`ChatContainer` 안), 주문 내역 줄 아래

## 테스트 기준
- 종 테마와 상관없이 고정 색: 뿌리에 `data-theme="fixed"` (D-32)
- 이유마다 제목: "처음 시키는 가게예요", "30일에 쓸 돈을 넘어요". 가게와 금액 두 줄. 금액은 formatOkrw (Number를 넘는 금액으로 확인)
- 버튼마다 맞는 콜백 한 번. 두 번 눌러도 한 번 (`useSubmitLock`)
- 한쪽 답이 가는 중이면(`approving`, `rejecting`) 두 버튼 모두 눌리지 않고 가는 쪽에 aria-busy
- `failed`면 "답을 못 보냈어요. 다시 해 볼까요?"가 보이고 같은 버튼으로 다시 보낼 수 있다
- 블록체인 말(지갑, 토큰, 트랜잭션, KYC, PCL, 체인)과 "레벨"이 없다 (D-17, D-31)
- 틀은 LimitChat 카드와 같다 (2px 테마색 테두리, radius-card)

## 메모
- 시안에 주인 허락 카드는 없다 (Main 시안의 "허락 필요" 배지와 user-flow의 "주인 허락 카드"만 있다). 가장 가까운 LimitChat 카드(`LimitChangeCard`)와 같은 틀과 두 버튼 묶음(`ActionPair` sm)으로 가장 단순하게 만들었다. 캔버스에서 시안이 정해지면 이 문서와 웹 문서 "디자인 공백"을 고친다.
- 재인증(Face ID) 자리는 없다. 허락 두 이유는 한도를 올리지 않는다: 가게 허용과 이번 주문 금액 하나에 대한 예산 허락이고, 서버의 `POST /approvals/:id/approve`는 재인증을 받지 않는다. 한도를 올리는 일(D-21, D-28)만 재인증이다.
- 이유 설명 문단은 쓰지 않는다 (D-17 슬롭 금지). 제목이 이유를 말한다.
- 두 버튼은 base `Button`: 허락하기 primary `choice`, 안 시킬래요 text `md`.
