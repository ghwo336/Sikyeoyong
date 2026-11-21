---
node: leaf
parent: _index.md
children: []
---

# LeakCompare

`packages/ui/src/wallet/LeakCompare/`

## 책임
키 유출 비교(데모 5번, tech-spec 9.3, `design/screens/LeakCompare.dc.html`)를 그린다. 드래곤 한 줄, "카드번호를 맡겼다면" 카드, "시켜용 용이" 카드(주문 한 번에 건당 한도까지와 기간 상한, 다른 길로 보내도 주머니에는 float만)를 숫자 위주로 그린다. 자세히 보기가 켜져 있으면 규칙 11의 정확한 한 줄을 더한다.

## 책임 아님
숫자 가져오기(페이지 컨테이너가 `GET /api/demo/leak-compare`로), DEMO_MODE 확인(페이지가 404로), 자세히 보기 스위치, 실제로 시도해 보기

## props
`perOrderLimit: bigint`, `periodicCap: bigint`, `periodSec: number` (모두 aokrw와 초), `floatAtRisk: bigint`, `pocket: bigint`, `detailed?: boolean`

## 하네스 상태
`LeakCompare.stories.tsx`에 아래를 전부 만든다.
- 데모 프로필, 시안 값 (`Default`, 1시간 60,000원)
- 기본 프로필 (`ThirtyDays`, 30일 500,000원)
- 건당 한도 50,000원, 주머니 0 (`Large`)
- 자세히 보기 켬 (`Detailed`)

## 쓰는 화면
키 유출 비교 (`app/demo/leak/page.tsx`, DEMO_MODE만)

## 테스트 기준
- 글자는 시안 그대로, 숫자는 formatOkrw (Number를 넘는 금액으로 확인)
- 평소 화면에 블록체인 말(체인, float, revert, KYC, PCL 등)과 "모두 막는다" 같은 과장이 없다 (D-17, 규칙 11)
- 자세히 보기에서만 "주문 경로의 큰돈은 체인이 막고, 우회 경로로는 float만 잃는다. 한도를 넘는 주문은 실행 중에 revert되어 블록에 남고 가스가 든다." (D-02, D-06). "멤풀"은 이 화면 어디에도 없다 (멤풀 전 차단은 전역 KYC 정책에만)
- 기간 이름은 3,600초면 "1시간", 2,592,000초면 "30일"
- 드래곤 줄은 고운돋움, 숫자는 크게 고정폭

## 메모
- 왼쪽 카드의 "전부 가져가요"는 숫자가 아니라 설명이다. 지어낸 금액을 쓰지 않는다.
- 데모 전용이다. 일반 화면 어디에서도 이 부품을 쓰지 않는다.
