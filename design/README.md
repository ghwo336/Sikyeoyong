# 시켜용 디자인 기준 (design/)

앱(`apps/web`)을 만들 때 이 폴더가 화면의 기준이다. 시안 원본은 claude.ai 디자인 캔버스 "시켜용 화면 시안"(https://claude.ai/artifact/Cu9jLaWmbgRbWJyaLgYWGG)이고, 여기 있는 파일은 2026-11-19 기준 사본이다.

- `screens/*.dc.html`: 화면 17장의 마크업. 캔버스 전용 형식이라 브라우저로 바로 열면 글꼴과 일부 동작이 빠진다. **보는 용도는 캔버스 링크, 읽는 용도는 이 파일.** 색, 간격, 글자 크기, 문구를 여기서 그대로 가져온다.
- `user-flow.md`: 화면 순서, 각 화면에서 사용자가 하는 일, 뒤에서 일어나는 일(서버, 체인).
- `tokens.json`: 색, 글꼴, 크기, 간격, 모서리. `pnpm --filter @sikyeoyong/ui tokens`가 이 값으로 `packages/ui/src/tokens/tokens.css`를 만든다.

시안과 코드가 다르면 시안이 맞다. 시안을 바꾸고 싶으면 캔버스를 고친 뒤 이 폴더 사본을 갱신한다.

## 화면 목록과 라우트

| 줄 | 파일 | 화면 | Next.js 경로 (제안) |
| --- | --- | --- | --- |
| 1 시작하기 | `Start.dc.html` | 시작 (카카오, 구글) | `app/(onboarding)/start/page.tsx` |
| | `Verify.dc.html` | 본인 인증 (카카오톡) | `app/(onboarding)/verify/page.tsx` |
| | `Name.dc.html` | 알 색 고르기, 이름 짓기 | `app/(onboarding)/name/page.tsx` |
| | `Hatch.dc.html` | 부화 중 (지갑 생성, 신분증 등록, 한도 기록) | `app/(onboarding)/hatch/page.tsx` |
| | `Budget.dc.html` | 이번 달 예산, 체험용 용돈 | `app/(onboarding)/budget/page.tsx` |
| 2 주문하고 기다리기 | `Main.dc.html` | 대화, 추천 | `app/(main)/page.tsx` |
| | `Confirm.dc.html` | 주문 확인 시트 | 바텀시트 (대화 화면 위) |
| | `Done.dc.html` | 조리 중 | `app/orders/[id]/page.tsx` (상태별) |
| | `Tracking.dc.html` | 배달 중 (지도) | `app/orders/[id]/page.tsx` (상태별) |
| | `Arrived.dc.html` | 도착, 아낀 돈, 맛 평가 | `app/orders/[id]/page.tsx` (상태별) |
| | `Receipt.dc.html` | 주문 상세, 자세히 보기 | `app/orders/[id]/receipt/page.tsx` |
| 3 한도와 규칙 | `Blocked.dc.html` | 한도 초과 | 대화 화면 안 카드 또는 전체 화면 |
| | `LimitChat.dc.html` | 말로 한도 바꾸기 (변경 카드) | 대화 화면 |
| | `Cap.dc.html` | 30일 한도 다 씀 | 전체 화면 |
| 4 용이 관리 | `Wallet.dc.html` | 용이 용돈 (잔액, 한도, 스위치) | `app/dragon/page.tsx` |
| | `IdCard.dc.html` | 용이 신분증 | `app/dragon/id/page.tsx` |
| | `Frozen.dc.html` | 용이 멈춤 | `app/dragon/page.tsx` (멈춤 상태) |

tech-spec "2.2 화면과 라우트"보다 이 표가 새 기준이다 (가입 단계와 도착, 상세가 늘었다). 각 화면을 이루는 UI 컴포넌트는 `docs/wiki/components/ui/` 문서의 "쓰는 화면" 칸으로 찾는다. 페이지는 그 컴포넌트를 조립만 한다.

## 지켜야 할 것 (요약, 전체는 `docs/wiki/conventions/design-and-motion.md`)
1. **블록체인 말을 화면에 쓰지 않는다.** 지갑, 주소, 토큰, 트랜잭션, 가스, KYC, PCL은 "자세히 보기" 안에서만.
2. **설명하지 말고 보여 준다.** 체크리스트 카드, 아이콘 달린 안내 박스, 설명 문단, 안심시키는 문구를 쓰지 않는다. 숫자를 크게, 드래곤 말은 한 줄, 버튼으로 끝낸다.
3. **드래곤 말은 고운돋움, 나머지는 Pretendard.** 숫자는 고정폭 숫자(tabular nums).
4. **토스처럼 부드럽게.** 애니메이션은 Motion으로 transform과 opacity만, 결제는 낙관적 UI, 로딩은 실제 모양 스켈레톤, 화면 전환은 View Transitions.
