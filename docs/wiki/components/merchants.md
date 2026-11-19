---
node: leaf
parent: _index.md
children: []
---

# 가게 (seed/, apps/api/src/modules/merchants, 2단계 apps/merchant)

## 책임
- 1단계: 목 가게 8곳과 메뉴 시드, 온체인 등록, 배달 상태 타이머.
- 2단계: 실제 가게 등록 흐름(판매자 콘솔), 판매자 API, 주문 접수 화면.

## 책임 아님
- 결제 (`payment.md`), KYB attestation 정책 (`chain-and-pcl.md`)

## 의존과 인터페이스 경계
- 시드 파일: `seed/merchants.json` (스키마 예시는 tech-spec "7.1 1단계: 목 가게 시드"). zod 스키마는 `packages/shared`.
- 서버는 `MerchantSource` 인터페이스로 가게를 읽는다. 1단계 구현은 `mockMerchantSource`(시드를 DB에 적재한 것을 읽음), 2단계는 `dbMerchantSource`(판매자 콘솔로 등록된 가게, 같은 테이블). 실제 제휴 가게가 생기면 다른 구현을 추가.
- 등록 흐름과 판매자 API 상세는 tech-spec "6. 판매자 백엔드", "7. 가게 등록 받는 법".

## 목 가게 규칙 (D-09)
- 8곳 구성은 tech-spec 7.1 표가 기준이다: 국밥, 치킨, 분식, 중식, 피자, 샐러드, 보쌈, 가짜 가게. 가격은 실제와 비슷하게 (시드 JSON은 OKRW 정수, DB는 aokrw 문자열로 변환해 저장).
- **7곳은 KYB 인증, 1곳은 미인증 가짜 가게(`fake-01`).** 가짜 가게는 장면 6 전용이다. attestation 없이 `registerMerchant`를 시도하면 `EasNoAttestationReceived`로 거절되고(장면 6의 증거), DB에는 `verified=false, onchain_id=null`로 남아 추천에서 빠진다.
- 이름은 실존 가게·브랜드와 겹치지 않는 가상 이름. 실존 상표 사용 금지.
- 가게마다 테스트넷 payout 키 1개. 시드 스크립트가 생성해 `seed/.keys/merchants.json`(git 제외)에 둔다. **payout 지갑이 직접 `registerMerchant`를 호출**하므로(EAS_POLICY는 sender만 검사, 확인) 가스용 tOKRW를 조금 넣어 둔다. 실제 가게(2단계)의 키는 서버에 두지 않는다.
- 메뉴마다 `priceAokrw`, 카테고리, 맵기, 1인분 여부 같은 추천용 속성.
- 레벨 1 한도(10,000 OKRW)로도 살 수 있는 메뉴와 넘는 메뉴를 섞는다. 장면 4용으로 레벨 1, 2 한도는 넘고 레벨 3 한도(50,000) 안인 메뉴(보쌈 대 45,000)를 둔다.
- 배달 상태: 접수 → 조리 중 → 배달 중 → 완료. 서버 타이머, 값은 `DELIVERY_TIMELINE_SECONDS` (기본 30, 60, 90초).

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
- 온체인 등록이 성공하고 Active인 가게만 추천·주문 대상이다. DB에만 있고 체인에 없거나 Active가 아닌 가게는 숨긴다.
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
- `pnpm db:seed`가 멱등 (두 번 돌려도 같은 결과).
- 시드 후 온체인 등록·활성화 7곳 성공, 가짜 가게 1곳 `EasNoAttestationReceived`로 실패.
- 판매자 권한 테스트 (2단계).

## 열린 질문
- D-11 #7 KYB EAS 스키마를 우리가 만들어도 되나, attester는 누구

## 관련 문서
- `docs/tech-spec.md` "6. 판매자 백엔드", "7. 가게 등록 받는 법"
- `contracts.md`, `chain-and-pcl.md`, `recommend-and-nag.md`
