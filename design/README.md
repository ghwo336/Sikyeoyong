# 시켜용 디자인 기준 (design/)

앱(`apps/web`)을 만들 때 이 폴더가 화면의 기준이다. 시안 원본은 claude.ai 디자인 캔버스 "시켜용 화면 시안"(https://claude.ai/artifact/Cu9jLaWmbgRbWJyaLgYWGG)이고, 여기 있는 파일은 2026-11-20 기준 사본이다 (캔버스 최신본, 그 위에 D-31 한도 문구와 스테퍼를 다시 얹고, Start의 '지갑' 문구를 블록체인 말 없이 고침).

- `screens/*.dc.html`: 화면 19장, 용이 도감(`Dragons.dc.html`), 용 종류별 색 비교(`Themes.dc.html`)의 마크업. 캔버스 전용 형식이라 브라우저로 바로 열면 글꼴과 일부 동작이 빠진다. **보는 용도는 캔버스 링크, 읽는 용도는 이 파일.** 색, 간격, 글자 크기, 문구를 여기서 그대로 가져온다.
- `user-flow.md`: 화면 순서, 각 화면에서 사용자가 하는 일, 뒤에서 일어나는 일(서버, 체인).
- `tokens.json`: 색, 글꼴, 크기, 간격, 모서리. `pnpm --filter @sikyeoyong/ui tokens`가 색, 글자, 간격, 반경, 크기로 `packages/ui/src/tokens/tokens.css`를 만들고, 글로만 적힌 글꼴 목록과 움직임은 `packages/ui/src/tokens/base.css`에 손으로 둔다 (`docs/wiki/conventions/architecture.md` 토큰 절).

시안과 코드가 다르면 시안이 맞다. 시안을 바꾸고 싶으면 캔버스를 고친 뒤 이 폴더 사본을 갱신한다.

## 화면 목록과 라우트

| 줄 | 파일 | 화면 | Next.js 경로 (제안) |
| --- | --- | --- | --- |
| 1 시작하기 | `Splash.dc.html` | 로딩 (앱 첫 진입, 세션 확인 동안) | `app/loading.tsx` 또는 첫 진입 전용 화면 |
| | `Start.dc.html` | 시작 (이메일로 시작하기 하나, 파우치 로그인, D-29) | `app/(onboarding)/start/page.tsx` |
| | `Verify.dc.html` | 본인 인증 (카카오톡) | `app/(onboarding)/verify/page.tsx` |
| | `Name.dc.html` | 알 고르기 (숲, 물, 꽃, 별), 이름 짓기 | `app/(onboarding)/name/page.tsx` |
| | `Hatch.dc.html` | 부화 중 (지갑 생성, 신분증 등록, 한도 기록) | `app/(onboarding)/hatch/page.tsx` |
| | `Budget.dc.html` | 한 번에 쓸 돈, 30일에 쓸 돈(D-31), 체험용 용돈 | `app/(onboarding)/budget/page.tsx` |
| 2 주문하고 기다리기 | `Main.dc.html` | 대화, 추천. 위에 진행 중인 주문 카드(누르면 주문 화면), 상단에 주문 내역 버튼 (2026-11-20) | `app/(main)/page.tsx` |
| | `Confirm.dc.html` | 주문 확인 시트 | 바텀시트 (대화 화면 위) |
| | `Done.dc.html` | 조리 중 | `app/orders/[id]/page.tsx` (상태별) |
| | `Tracking.dc.html` | 배달 중 (지도) | `app/orders/[id]/page.tsx` (상태별) |
| | `Arrived.dc.html` | 도착, 아낀 돈, 맛 평가 | `app/orders/[id]/page.tsx` (상태별) |
| | `Receipt.dc.html` | 주문 상세, 자세히 보기 | `app/orders/[id]/receipt/page.tsx` |
| 3 한도와 규칙 | `Blocked.dc.html` | 한도 초과 | 대화 화면 안 카드 또는 전체 화면 |
| | `LimitChat.dc.html` | 말로 한도 바꾸기 (변경 카드) | 대화 화면 |
| | `Cap.dc.html` | 30일 한도 다 씀 | 전체 화면 |
| 4 용이 관리 | `Wallet.dc.html` | 용이 용돈 (잔액, 한도, 스위치) | `app/dragon/(awake)/page.tsx` (주소 `/dragon`) |
| | `IdCard.dc.html` | 용이 신분증 | `app/dragon/(awake)/id/page.tsx` (주소 `/dragon/id`) |
| | `Frozen.dc.html` | 용이 멈춤 | `app/dragon/frozen/page.tsx` (멈춘 용이는 `/dragon`에서 이리로 간다. 바탕이 달라 레이아웃이 따로다, 2026-11-20) |
| | `Look.dc.html` | 용이 모습 바꾸기 (종을 바꾸면 모습, 말버릇, 앱 색이 바뀜. 이름, 용돈, 한도는 그대로, D-32) | `app/dragon/(awake)/look/page.tsx` (주소 `/dragon/look`, 제안) |
| 비교용 | `Themes.dc.html` | 용 종류별 색 비교 (숲, 물, 꽃, 별 테마를 한눈에). 화면이 아니라 라우트가 없다 | 없음 |

tech-spec "2.2 화면과 라우트"보다 이 표가 새 기준이다 (가입 단계와 도착, 상세가 늘었다). 각 화면을 이루는 UI 컴포넌트는 `docs/wiki/components/ui/` 문서의 "쓰는 화면" 칸으로 찾는다. 페이지는 그 컴포넌트를 조립만 한다.

## 지켜야 할 것 (요약, 전체는 `docs/wiki/conventions/design-and-motion.md`)
1. **블록체인 말을 화면에 쓰지 않는다.** 지갑, 주소, 토큰, 트랜잭션, 가스, KYC, PCL은 "자세히 보기" 안에서만.
2. **설명하지 말고 보여 준다.** 체크리스트 카드, 아이콘 달린 안내 박스, 설명 문단, 안심시키는 문구를 쓰지 않는다. 숫자를 크게, 드래곤 말은 한 줄, 버튼으로 끝낸다.
3. **드래곤 말은 고운돋움, 나머지는 Pretendard.** 숫자는 고정폭 숫자(tabular nums).
4. **토스처럼 부드럽게.** 애니메이션은 Motion으로 transform과 opacity만, 결제는 낙관적 UI, 로딩은 실제 모양 스켈레톤, 화면 전환은 View Transitions.

## 용이 도감

`Dragons.dc.html`은 화면이 아니라 그림 기준이다. 알 네 가지(숲, 물, 꽃, 별)마다 알 무늬와 아기 용 모양이 다르다. `Dragon`, `Egg`, `EggPicker`는 색이 아니라 종(`DragonSpecies`)을 받고, 종별 모양은 이 파일에서 가져온다 (D-20). 2026-11-20 시안부터 다른 화면도 `species` 속성으로 종을 고를 수 있고, 고른 종에 따라 볏(숲 잎사귀, 물 지느러미 귀와 물방울, 꽃 꽃잎 귀와 꽃 볏, 별 별 뿔)과 앱 강조색이 바뀐다 (D-32).
