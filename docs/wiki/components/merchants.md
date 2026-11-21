---
node: leaf
parent: _index.md
children: []
---

# 가게 (seed/, apps/api/src/modules/merchants, 2단계 apps/merchant)

## 책임
- 1단계: 목 가게 시드(66곳, 메뉴 163개), 온체인 등록, 배달 상태 타이머.
- 2단계: 실제 가게 등록 흐름(판매자 콘솔), 판매자 API, 주문 접수 화면.

## 책임 아님
- 결제 (`payment.md`), KYB attestation 정책 (`chain-and-pcl.md`)

## 의존과 인터페이스 경계
- 시드 파일: `seed/merchants.json` (스키마 예시는 tech-spec "7.1 1단계: 목 가게 시드"). 시드 파일 zod 스키마(`SeedFile`)와 DB 적재는 `apps/api/src/db/seed.ts`(`pnpm db:seed`). 시드는 서버 전용 입력이라 공유 패키지에 두지 않는다. 체인 등록은 `infra/scripts/register-merchants.ts`(`pnpm merchants:register`, 아래 "온체인 등록 절차"). 결과는 `seed/onchain/<chainId>.<profile>.json`이고 `pnpm merchants:sync-onchain`(또는 `pnpm db:seed`)이 `merchants.onchain_id`에 넣는다.
- 서버는 `MerchantSource` 인터페이스(`modules/merchants/merchant-source.ts`, 토큰 `MERCHANT_SOURCE`)로 가게를 읽는다. 구현은 `DbMerchantSource` 하나다: 1단계 시드 가게와 2단계 판매자 콘솔 가게가 같은 테이블이라 같은 구현으로 읽는다. 실제 제휴 가게가 생기면 다른 구현을 추가. 저장된 JSON 칸(태그, 영업시간)이 깨졌으면 로그만 남기고 빈 값으로 읽는다(태그 없음, 영업 안 함). 도착 예상 시간 `etaMin`은 1단계 목 가게에서 배달 타이머 기본값 합(30 + 60 + 90초)인 3분이다 (`MOCK_ETA_MIN`, delivery 모듈이 생기면 그쪽 값으로).
- 코드: 저장소 `merchants.repository.ts`(쿼리만), 규칙 `merchants.service.ts`, HTTP `merchants.controller.ts`, 영업시간 판정 `open-hours.ts`(`isOpenAt`, KST, 자정 넘는 구간 "15:00-02:00", "24:00"은 하루 끝, 못 읽는 키나 구간은 닫힘).
- API: `GET /api/merchants?category&verified`(`{ merchants: MerchantCard[] }`), `GET /api/merchants/:id`(`{ merchant, menus }`). 둘 다 `SessionGuard`. 스키마는 shared `api/merchants.ts`(`zMerchantCard`, `zMenuView`, `zMerchantListQuery`). 메뉴 가격은 aokrw 문자열. 쿼리 `verified`는 `true`만 받는다(`false`나 모르는 키는 400). 숨긴 가게(미인증, 비활성)를 id로 물으면 없는 가게와 같이 404 `NOT_FOUND`이고 메뉴를 내주지 않는다. 가게는 사용자별 데이터가 없어 누가 물어도 같은 답이다.
- 다른 모듈이 쓰는 `MerchantsService` 함수: `catalog(now)`(보이는 가게와 메뉴, 가격 bigint, 추천용), `lookupForOrder(merchantId, now)`(주문용: `unknown` / `not_orderable`(`unverified`, `inactive`, `closed`) / `ok`와 메뉴 id별 서버 가격), `categoryOf(id)`(숨긴 가게도, 최근 주문의 카테고리용). 주문 모듈(미구현)은 `not_orderable`을 `CHAIN_MERCHANT_INACTIVE`로 바꿀 예정이다 (tech-spec 7.1 6단계). 품절 메뉴도 `ok`의 메뉴 맵에 `available=false`로 들어 있으니 주문 모듈이 그 메뉴를 거절해야 한다.
- 글자 상한(tech-spec 9.2): 가게 이름 40, 메뉴 이름 40, 메뉴 설명 200, 카테고리 20, 태그 20자 10개. 서비스가 화면과 모델 어느 쪽에 주기 전에 자른다(`clipText`, 글자를 반으로 자르지 않는다).
- 등록 흐름과 판매자 API 상세는 tech-spec "6. 판매자 백엔드", "7. 가게 등록 받는 법".

## 목 가게 규칙 (D-09)
- 처음 8곳은 tech-spec 7.1 표가 기준이다: 국밥, 치킨, 분식, 중식, 피자, 샐러드, 보쌈, 가짜 가게. 2026-11-21에 58곳을 더했다 (QA: 밤에 연 가게가 둘뿐이고 둘 다 첫 한 번 한도 1만 원을 넘어 추천이 0건). 어느 요일 어느 시간에도 1만 원 이하 메뉴가 있는 열린 가게가 3곳 이상이고(24시 가게 포함), 3만 원 넘는 메뉴(한우, 대게, 코스, 파티 플래터, 최고 15만 원)도 둔다. `modules/merchants/seed-coverage.spec.ts`가 지킨다. 가격은 실제와 비슷하게 (시드 JSON은 OKRW 정수, DB는 aokrw 문자열로 변환해 저장).
- **7곳은 KYB 인증, 1곳은 미인증 가짜 가게(`fake-01`).** 가짜 가게는 장면 6 전용이다. attestation 없이 `registerMerchant`를 시도하면 `EasNoAttestationReceived`로 거절되고(장면 6의 증거), DB에는 `verified=false, onchain_id=null`로 남아 추천에서 빠진다.
- 이름은 실존 가게·브랜드와 겹치지 않는 가상 이름. 실존 상표 사용 금지.
- 가게마다 테스트넷 payout 키 1개. 시드 스크립트가 생성해 `seed/.keys/merchants.json`(git 제외, 권한 600, 임시 파일에 쓰고 이름 바꾸기)에 두고 다음 실행 때 재사용한다. 키는 출력하지 않고, 파일이 깨져도 오류에 키가 실리지 않는다. **payout 지갑이 직접 `registerMerchant`를 호출**하므로(EAS_POLICY는 sender만 검사, 확인) 가스용 tOKRW를 조금 넣어 둔다. 실제 가게(2단계)의 키는 서버에 두지 않는다.
- 메뉴마다 `priceAokrw`, 카테고리, 맵기, 1인분 여부 같은 추천용 속성.
- 처음 제안 건당 한도(10,000 OKRW)로도 살 수 있는 메뉴와 넘는 메뉴를 섞는다. 장면 4용으로 10,000원 한도는 넘고 건당 한도 최대(50,000) 안인 메뉴(보쌈 대 45,000)를 둔다. 건당 한도를 45,000으로 올리면 통과한다 (D-31).
- 배달 상태: 접수 → 조리 중 → 배달 중 → 완료. 서버 타이머, 값은 `DELIVERY_TIMELINE_SECONDS` (기본 30, 60, 90초).

## 가게 키 보관과 회수 (D-33)
- 코드: `apps/api/src/db/merchant-keys/` (`payout-keys.ts` 키 파일과 보관본, `sweep.ts` 회수 계획과 실행, `cli.ts` 명령, `viem-chain.ts` 체인 연결). 체인 ID와 RPC는 `packages/shared` 설정에서만 읽는다 (`MAROO_RPC_URL`로 덮어쓸 수 있음).
- 보관본: 키를 만들 때마다 `seed/.keys/archive/keys.jsonl`(폴더 700, 파일 600, git 제외)에 한 줄 `{ merchantKey, address, privateKey, createdAt }`을 **덧붙이기만** 한다. 지우거나 고쳐 쓰지 않는다. 시드에서 빠진 가게의 키도 남는다. 이 기능 이전에 만든 키는 다음 `pnpm db:seed` 때 채워 넣는다.
- `pnpm merchants:balances [--keys <폴더>] [--merchant <키>]`: 읽기 전용. 가게 이름, 주소, 잔액(tOKRW 문자열)만 출력한다. 보관본에만 있는 가게는 `(archived)`가 붙는다.
- `pnpm merchants:sweep --to <체크섬 주소> (--merchant <키> | --all) [--dry-run] [--keys <폴더>]`: 가게 지갑마다 `잔액 - 가스 추정 x 가스 가격`을 `--to`로 보낸다. 잔액이 0이거나 가스에도 모자라면 건너뛴다. `--dry-run`은 가게별 잔액, 수수료, 보낼 금액만 보여 주고 아무것도 보내지 않는다. 한 지갑이 실패해도 나머지는 계속하고 자동 재시도는 없다.
- 키는 어떤 출력과 오류에도 싣지 않는다. 사람이 직접 실행할 때만 돌고 LLM 도구와 서버 API에는 없다 (규칙 3).

## 온체인 등록 절차 (데모 프로필, D-33)
- 실행은 소유자만: `pnpm merchants:register --keys <seed/.keys/merchants.json> --db <sqlite 파일> [--only a,b] [--dry-run] [--max-spend 250]`. 운영자 키는 `.env`의 `OPERATOR_KEY`(출력하지 않음). 진짜 트랜잭션이고 운영자 잔액을 쓴다.
- 가게마다: (1) 운영자가 payout 지갑에 가스비만 보낸다(`estimateGas` x `estimateFeesPerGas`의 `maxFeePerGas` x 1.1, 이미 있으면 건너뜀), (2) payout 지갑이 `registerMerchant(0x0, metadataURI)`를 호출(데모 프로필은 KYB 정책이 없어 `kybUid`는 0, 확인), (3) `MerchantRegistered` 이벤트에서 `merchantId`를 읽고, (4) 운영자가 `setMerchantStatus(id, Active)`. 쓰기 전에 시뮬레이션하고 예산(`--max-spend`)을 넘길 쓰기 앞에서 멈춘다. 자동 재시도 없음.
- 멱등, 이어서 실행 가능: 체인의 `merchantIdByPayout`을 먼저 묻고, 등록만 되고 기록이 없으면 이벤트 로그에서 해시를 복구한다. 가게마다 기록 파일을 바로 저장한다.
- `metadataURI`는 DB의 `metadata_uri`(`--db`로 읽기 전용 조회)다. 로컬 DB는 `http://localhost:3000/...`이라 체인에는 이 값이 남는다. 공개 도메인 값으로 다시 쓸 수 없다(컨트랙트에 수정 함수 없음).
- 기록 파일 `seed/onchain/450815.demo.json`(공개 정보만: merchantKey, onchainId, payout, 트랜잭션 해시, 블록. 키 없음). 파싱은 shared `parseMerchantOnchain`. 동기화(`pnpm merchants:sync-onchain`)는 payout 주소로 맞춰 `onchain_id`를 채우며(`apps/api/src/db/merchant-onchain-sync.ts`), 이미 다른 값이 있으면 멈춘다.
- 비용 (확인, 2026-11-21): `registerMerchant`는 가게당 약 3.0 tOKRW(334,618 가스 x 9,000 gwei), `setMerchantStatus` 약 1.6, 가스비 송금 약 0.2. 가게당 약 4.8, 가스비 여유분(약 0.5)은 payout 지갑에 남는다(`pnpm merchants:sweep`로 회수). 65곳 전부는 약 310 tOKRW가 필요하다. 예산 250으로 46곳(id 1~46)을 먼저 등록했고, 2026-11-21 저녁 나머지 19곳(id 47~65)을 같은 명령으로 이어서 등록했다(약 108 tOKRW, 가스 가격 10,600 gwei). 지금 65곳 모두 Active (확인).

## 실제 가게 등록 (2단계 규칙)
1. 사장님 가입 (카카오 로그인, 역할 `merchant`).
2. 사업자등록번호 입력, 국세청 사업자 상태 조회로 진위·휴폐업 확인 (k-skill `nts-business-registration` 또는 공공데이터 API).
3. 운영자 검토 (자동 승인 금지).
4. payout 지갑 연결 (서명 챌린지로 소유 증명).
5. 운영자 attester가 테스트넷 EAS로 KYB attestation 발급 (recipient = payout) 후 `indexAttestation` (인덱싱돼야 EAS_POLICY가 인정, 확인).
6. **가게 지갑이 직접** `registerMerchant` 서명 (판매자 콘솔, EAS_POLICY 통과해야 등록).
7. 운영자 `setMerchantStatus(Active)`.
8. 메뉴 등록, 영업 시작.

## 반드시 지킬 규칙 (MUST)
- 온체인 등록이 성공하고 Active인 가게만 추천·주문 대상이다. DB에만 있고 체인에 없거나 Active가 아닌 가게는 숨긴다. 지금 코드는 DB의 `verified=true`와 `active=true`로만 판정한다. 체인 등록 스크립트(`infra/scripts/register-merchants.ts`)로 데모 프로필에 65곳 모두 등록됐고(위 "온체인 등록 절차"), 개발 DB에는 `pnpm merchants:sync-onchain`으로 `onchain_id`를 채운다. 새로 시드한 가게가 아직 등록 전이면 `onchain_id=null`로 보이고, 경로 B에서 이 가게의 confirm은 결제 전에 멈춘다(`OrderConfirmService`, `onchain_id`가 null이고 경로가 mock이 아니면). `onchain_id`가 있어야 보이게 바꿀지는 open-questions Q-34.
- 메뉴 가격의 기준은 서버 DB다. LLM이나 앱이 준 가격은 쓰지 않는다.
- 판매자는 자기 가게 주문만 본다. 판매자 API는 `merchant` 역할 + 가게 소유 확인.
- payout 주소 변경은 운영자 확인과 재등록 절차를 거친다 (돈이 새는 길).

## 하지 말 것 (MUST NOT)
- 실존 가게·브랜드 이름, 로고, 사진을 쓰지 않는다.
- KYB 없이 등록을 우회하는 운영자 경로를 만들지 않는다 (정책 관리자도 EAS_POLICY 우회 불가, 확인).
- 미인증 가짜 가게를 추천 목록에 넣지 않는다.

## 확장 지점
- `MerchantSource` 구현 추가 (실제 제휴, 외부 API).
- 심부름 플러그인별 가게 종류 (미용실, 버스 회사).

## 테스트 기준
- `pnpm db:seed`가 멱등 (두 번 돌려도 같은 결과). 기준은 payout 주소: 이미 있는 가게는 메뉴와 함께 건너뛴다. 키 파일을 지우면 새 가게로 다시 들어가니 지우지 않는다. `metadata_uri`는 `PUBLIC_BASE_URL/api/merchants/<id>/meta.json`.
- 시드 후 온체인 등록·활성화 7곳 성공, 가짜 가게 1곳 `EasNoAttestationReceived`로 실패.
- 판매자 권한 테스트 (2단계).
- 사용자 API: 세션 없으면 401, 미인증·비활성 가게는 목록에 없고 id로 물어도 404, `verified=false`와 모르는 쿼리 키는 400, 응답은 shared 스키마를 지킨다 (`merchants.controller.spec.ts`).

## 열린 질문
- D-11 #7 KYB EAS 스키마를 우리가 만들어도 되나, attester는 누구
- Q-34 보이는 가게 판정에 `onchain_id`를 언제부터 넣나 (체인 등록 스크립트 뒤)

## 관련 문서
- `docs/tech-spec.md` "6. 판매자 백엔드", "7. 가게 등록 받는 법"
- `contracts.md`, `chain-and-pcl.md`, `recommend-and-nag.md`
