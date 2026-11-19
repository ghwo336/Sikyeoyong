---
node: leaf
parent: _index.md
children: []
---

# 결정 변경 이력

결정 자체는 [`docs/_research/decisions.md`](../../_research/decisions.md)에 있다. 여기에는 언제 무엇이 왜 바뀌었는지만 쌓는다. 결정을 바꾸는 순서: decisions.md 수정, 여기 기록, 영향받는 위키·코드 수정.

## 양식
```
### YYYY-MM-DD D-xx 무엇이 바뀌었나
- 이전:
- 이후:
- 이유:
- 누가:
- 영향: (고친 문서, 코드)
```

## 이력

### 2026-11-18 D-01 ~ D-11 최초 작성
- 이전: 없음
- 이후: 제품(시켜용, 배달 관리 에이전트), 마루다움 기준, 스택(Expo, Hono, SQLite+Drizzle, Foundry, MAWS), 저장소 구조, 결제 경로 A/B/C, 에이전트 탈출 3겹 방어, 정책값, 컨트랙트 이름, 목 가게, 일정, 열린 질문
- 이유: 기획 세션(호재 님과 Claude) 결과 정리
- 누가: 호재 님
- 영향: docs 전체 최초 작성

### 2026-11-18 D-02, D-06, D-08 변경, D-12, D-13 추가 (E-1 ~ E-8)
- 이전: 모든 한도를 "멤풀 전에 막는다"고 표현. 용돈은 주문 컨트랙트 선불 잔액(`deposit` 후 `placeOrder`에서 차감). `registerMerchant`는 운영자가 호출. `placeOrder(uint256, uint256, bytes32)`.
- 이후:
  - E-1: 기본은 모드 P. `placeOrder(uint64 merchantId, bytes32 orderRef) payable`, 에이전트 지갑에는 float(레벨 건당 한도 × 2)만, 주문 직전 즉시 충전. 모드 V(선불)는 S10 확인 후.
  - E-2: `registerMerchant(bytes32 kybUid, string metadataURI)`는 가게 payout 지갑이 직접 호출, 운영자는 `setMerchantStatus`로 활성화.
  - E-3: `bindAgent`, `setMerchantStatus`, `placeOrderFromVault` 추가.
  - E-4: 전역 정책은 제출 시점 거절, 컨트랙트 범위 정책은 실행 중 revert(가스 과금). "멤풀 전"은 전역 정책에만.
  - E-5: 키 유출 장면은 "주문 경로의 큰돈은 체인이 막고, 우회 경로로는 소액 float만 잃는다".
  - E-6 (D-12): 데모 프로필 60,000 OKRW / 3,600초 별도 배포.
  - E-7 (D-13): 경로 A의 MAWS `allowedTargets`는 주문 컨트랙트 주소 하나로 고정.
  - E-8: 테스트넷 Cosmos chain-id `maroo-testnet-1`, WebSocket `wss://ws-testnet.maroo.io`를 facts에 추가.
  - 함께 확정: `placeOrder`의 두 규칙은 `LOGICAL_POLICY`(And)로 묶음. 정책 admin은 첫 `changeContractPolicies` 호출자, 전체 교체.
- 이유: 기술 기획 조사에서 확인한 마루 문서 (pcl-template-agent-okrw-transfer-limit-policy, pcl-template-eas-policy, pcl-policy-enforcement, pcl-policy-structure, pcl-contract-admin-binding, testnet-access). tech-spec "12. 결정 기록 변경 제안".
- 누가: 기획 세션 (Claude 제안, decisions.md 반영)
- 영향: decisions.md, maroo-facts.md 4.1, tech-spec 1.4·3.2·3.3·3.4·5.1·5.2, 위키 components(contracts, chain-and-pcl, payment, security, merchants, agent-runtime, data, server-api, auth, app, recommend-and-nag, infra), product(scenarios, vision, glossary), maroo(facts, devrel-feedback), roadmap, open-questions(Q-10 ~ Q-18), CLAUDE.md

### 2026-11-18 D-14 전화 기능 제외
- 이전: 2단계에 070 전화(ClawOps), 데모 장면 9(전화), 컴포넌트 `phone.md`.
- 이후: 전화 기능을 1단계와 2단계 모두에서 뺌. 장면은 1~8. D-11 9번, Q-09, 스파이크 S9 닫힘.
- 이유: 주문받는 가게는 모두 마루 등록 가게라 전화할 상대가 없고, 미등록 가게에 전화로 주문하면 OKRW 결제와 체인 한도가 빠진다. 비용, AI 통화 고지 의무, 음성 처리 부담에 비해 PCL + Agent 메시지와 관련이 없다.
- 누가: 호재 님
- 영향: decisions.md(D-01, D-10, D-11, D-14), plan.md(v2.2), pitch.md, tech-spec(1장 표, 8.3, 8.9, 11장 S9), maroo-facts, 위키 README, components(_index, agent-runtime, security, infra, phone.md 삭제), product(vision, scenarios, _index), roadmap, open-questions

### 2026-11-19 D-15, D-16, D-17 추가 (배달, 본인 인증, 디자인)
- 이전: 배달 주체와 주문 현황 화면 미정, 인증 화면은 휴대폰 인증 가정, 디자인 기준 없음.
- 이후: 시켜용은 주문과 결제만 하고 배달은 가게 배달대행(D-15). 본인 인증 필수, 테스트넷은 카카오 본인 인증 하나(D-16). 화면 기준은 디자인 캔버스와 `design/`, 블록체인 말 숨김, 슬롭 금지, 토스 수준 움직임(D-17).
- 이유: 11/19 디자인 세션. 배민 라이더 인프라는 만들 수 없음, 11/11 회의 KYC 현황, 피클 조사.
- 누가: 호재 님
- 영향: decisions.md, design/ 신규, conventions/design-and-motion.md 신규, components/app.md, CLAUDE.md(읽는 순서 7, 규칙 12), tech-spec 11장 S13, open-questions Q-19 ~ Q-21

### 2026-11-19 D-03, D-04 개정, D-18 추가 (Next.js + NestJS + SQLite, 컴포넌트 하네스)
- 이전: Expo 앱, Hono 백엔드, 화면 컴포넌트 규칙 없음.
- 이후: Next.js 웹(페이지는 조립만), NestJS API(모듈 하나가 책임 하나), SQLite 유지, `packages/ui`에 컴포넌트마다 본체, 하네스, 테스트, 위키 문서. 모노레포 유지.
- 이유: 호재 님 결정(Next로 개발, 단단한 백엔드, 단일 책임, 컨텍스트 공유).
- 누가: 호재 님
- 영향: decisions.md(D-03, D-04, D-10, D-18), conventions/architecture.md 신규, components/ui/ 신규(35개), components/web.md(app.md 대체), server-api.md, auth.md, infra.md, testing.md, design-and-motion.md, tech-spec 상단 대응표, plan, pitch, design/README.md, user-flow.md, CLAUDE.md(읽는 순서 7, 8, 규칙 13, 분업표, 명령어), README.md, Q-18 닫힘, Q-20 갱신

### 2026-11-19 D-19 결제 실패 뒤 다시 누르기
- 이전: confirm 재시도 규칙이 문서마다 달랐다 (payment.md는 같은 orderRef 재시도, server-api.md 초안은 실패 주문의 confirm을 결제 없이 돌려줌).
- 이후: 실패 주문은 체인 조회 뒤 같은 orderRef로 재시도, 결과 모르는 제출은 submitting 유지, 재시도 불가 실패만 새 견적.
- 이유: 타임아웃 뒤 새 견적으로 이중 결제가 날 수 있음 (커밋 검증 지적).
- 누가: 호재 님
- 영향: decisions.md D-19, payment.md, server-api.md, tech-spec 1.4, 3.2

