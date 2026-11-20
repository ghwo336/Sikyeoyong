---
node: leaf
parent: _index.md
children: []
---

# 열린 질문

decisions.md D-11의 질문을 추적한다. 새 질문은 맨 아래에 번호를 이어서 추가한다. 결론이 나면 decisions.md와 해당 컴포넌트 문서에 반영하고 상태를 "해결"로 바꾼다.

## 양식
```
### Q-NN 질문 한 줄
- 상태: 열림 / 확인 중 / 해결
- 우선순위: P0 (1주차 게이트) / P1 / P2
- 배경:
- 확인 방법:
- 담당:
- 결론:
- 반영한 곳:
```

### Q-01 MAWS가 컨트랙트 함수 호출(calldata)을 지원하나?
- 상태: 열림
- 우선순위: P0
- 배경: 결제 경로 A/B/C 결정 (D-05). 문서에 없음 (devrel-feedback F-01).
- 확인 방법: MAWS 담당에게 질문. 테스트넷에서 `transfer.send`에 data 필드가 있는지 MCP 도구 스키마 확인 (`tools/list`).
- 담당: 호재 님 → 재욱 님, MAWS 담당
- 결론 (2026-11-20, 부분): MCP 도구로는 안 된다 (확인). `transfer.send` 스키마에 calldata 칸이 없다. WaaS API 직접 호출로 되는지는 (미확인)이라 MAWS 담당 답이 오면 다시 연다. 1단계는 경로 B (D-25).
- 반영한 곳: maroo-facts 1, decisions D-05와 D-25, devrel F-13

### Q-02 서버 하나로 여러 사용자의 MAWS 계정을 다룰 수 있나?
- 상태: 열림
- 우선순위: P0
- 배경: 사용자별 소유자 구조 (auth, infra). 문서에 없음 (F-02). 안 되면 데모는 운영자 계정 하나가 모든 에이전트를 소유.
- 확인 방법: MAWS 담당 질문, WaaS API 문서 확인.
- 담당: 호재 님, MAWS 담당
- 결론:
- 반영한 곳:

### Q-03 테스트넷에서 PAYMASTER 가스 모드가 동작하나?
- 상태: 열림
- 우선순위: P1
- 배경: 경로 A의 가스 출처. 모드 P에서도 에이전트 지갑에 float만 두려면 가스는 페이마스터가 좋다 (D-06). F-06.
- 확인 방법: 테스트 에이전트를 OKRW 0으로 두고 PAYMASTER 모드로 전송 시도.
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-04 `changeContractPolicies` 인자·권한, 셀렉터별 정책 지정 방법은?
- 상태: 열림
- 우선순위: P0
- 배경: `pnpm policy:apply` 설계. F-05.
- 확인 방법: docs.maroo.io `pcl-contract-admin-binding`, `pcl-policy-enforcement`, `pcl-policy-structure` 읽기, `IPcl.sol` 확인, 테스트 컨트랙트로 실험.
- 담당: 구현 세션, PCL 담당
- 결론:
- 반영한 곳:

### Q-05 30일 주기는 언제 시작하나? 달력 월 리셋이 가능한가?
- 상태: 열림
- 우선순위: P1
- 배경: 잔소리 표시와 장면 5 안내 문구.
- 확인 방법: 테스트넷에서 짧은 주기(예: 600초)로 첫 전송 시각과 `resetAt` 관계 측정.
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-06 `FOR_EACH_POLICY`로 소유자 단위 30일 합산이 되나?
- 상태: 열림
- 우선순위: P2
- 배경: 에이전트를 여러 개 만들어 30일 상한을 피하는 것 방지. 1단계는 사용자당 에이전트 1개라 급하지 않음.
- 확인 방법: 문서 `pcl-composite-policies`, 테스트넷 실험.
- 담당: 구현 세션, PCL 담당
- 결론:
- 반영한 곳:

### Q-07 테스트넷 KYB용 EAS 스키마를 우리가 만들어도 되나? attester는 누구?
- 상태: 열림
- 우선순위: P0
- 배경: 가게 등록 `EAS_POLICY` (장면 6).
- 확인 방법: 재욱 님, EAS 문서. 테스트넷 기존 스키마 확인.
- 담당: 호재 님
- 결론:
- 반영한 곳:

### Q-08 테스트넷 체인 ID 변경과 Mock KYC 전환 시점은?
- 상태: 열림
- 우선순위: P1
- 배경: 12/7~12/9 외부 점검 중에 바뀌면 데모가 깨짐. 설정 분리로 대비는 해 둠.
- 확인 방법: 재욱 님.
- 담당: 호재 님
- 결론:
- 반영한 곳:

### Q-09 ClawOps 요금·발신 제한, AI 통화 고지 의무는?
- 상태: 닫힘 (2026-11-18, D-14 전화 기능 제외로 확인할 필요 없음)
- 우선순위: P2 (2단계)
- 배경: 전화 기능(제외됨, D-14).
- 확인 방법: 한국AI통신 문의, 법무 검토.
- 담당: 호재 님
- 결론:
- 반영한 곳:

### Q-10 모드 V(선불)에서 컨트랙트가 내보낸 지급이 에이전트 한도로 집계되나? (스파이크 S10)
- 상태: 열림
- 우선순위: P0
- 배경: 컨트랙트 범위 `AGENT_OKRW_TRANSFER_LIMIT_POLICY`는 직접 sender 귀속만 하고 실행 전 call value를 검사한다 (확인). 선불 차감은 call value가 0이라 한도를 비껴갈 수 있다. 그래서 모드 P가 기본 (D-06, E-1).
- 확인 방법: tech-spec "11" S10. 모드 V로 배포해 TransferLimit 초과 금액을 `placeOrderFromVault`로 지급 시도, 같은 금액을 모드 P로 시도해 비교.
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-11 8004 소유 관계 조회와 setMetadata 시그니처는? (스파이크 S11)
- 상태: 열림
- 우선순위: P0
- 배경: `bindAgent`의 소유 확인, TransferLimit 기록 (tech-spec "5.3", "5.7"). `IdentityRegistry.ownerOf`, `setMetadata`, `IAgent.getAgentIds` 페이지 인자 형식이 미확인.
- 확인 방법: Explorer 검증 소스에서 ABI 확인.
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-12 MAWS AA 지갑(EntryPoint 경유) 호출에서 컨트랙트 범위 TransferLimit가 에이전트를 sender로 보나? (스파이크 S12)
- 상태: 열림
- 우선순위: P1 (경로 A일 때만)
- 배경: 경로 A의 체인 한도가 실제로 걸리는지.
- 확인 방법: MAWS 에이전트로 정책 걸린 `placeOrder` 한도 초과 호출.
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-13 `deployPclProxy` kind 값과 초기화, PolicySet·LogicalPolicy·ForEachPolicy의 Solidity 타입과 enum 값은?
- 상태: 열림
- 우선순위: P0
- 배경: 배포 스크립트와 정책 인코딩 (tech-spec "5.5", "5.6"). `AGENT_OKRW_TRANSFER_LIMIT_POLICY`의 필드 없는 struct 인코딩도 미확인.
- 덧붙임 (2026-11-20): `SikyeoyongOrders.initialize`는 접근 제어가 없어 `deployPclProxy`가 초기화 데이터를 같이 받는지(원자적 초기화)도 이 질문으로 확인한다. 못 받으면 초기화 뒤 `owner()`, `operator()`를 다시 읽어 확인한다 (contracts.md "반드시 지킬 규칙").
- 확인 방법: `IPcl.sol` 원본(`@maroo-chain/contracts`) 확인, 스파이크 S4.
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-14 `simulateContract`(eth_call)에서 컨트랙트 범위 정책이 재현되나?
- 상태: 열림
- 우선순위: P1
- 배경: preflight로 가스를 아끼려면 시뮬레이션에서 PCL 거절이 보여야 한다. 컨트랙트 범위 정책은 실행 중 평가된다 (확인).
- 확인 방법: 정책 걸린 `placeOrder` 한도 초과를 `eth_call`로 호출해 revert 데이터 확인.
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-15 전역 KYC 한도 거절의 에러 이름은?
- 상태: 열림
- 우선순위: P1
- 배경: `CHAIN_KYC_LIMIT` 매핑 (tech-spec "3.6").
- 확인 방법: 미인증 지갑으로 건당 2,000,000 OKRW 초과 전송, 에러 디코드.
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-16 `@maroo-chain/contracts` export 경로, `@maroo-chain/agent-wallet-kit` 실행 명령과 MCP 전송 방식은?
- 상태: 열림
- 우선순위: P1
- 배경: `iPclAbi` import, `maws-mcp` 컨테이너 command (tech-spec "8.2"). stdio 전용이면 server 컨테이너의 자식 프로세스로 띄운다.
- 확인 방법: 패키지 설치 후 확인.
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-17 국세청 사업자등록 진위확인·상태조회 API 엔드포인트와 필드 이름은?
- 상태: 열림
- 우선순위: P2 (2단계)
- 배경: 실제 가게 등록 (tech-spec "7.2"). 엔드포인트는 추론 상태.
- 확인 방법: 공공데이터포털 테스트 페이지 (data.go.kr 15081808).
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-18 React Native fetch 스트리밍(SSE)이 실기기에서 동작하나?
- 상태: 닫힘 (2026-11-19, D-18로 웹 Next.js가 되어 React Native를 쓰지 않음. 브라우저 EventSource 또는 fetch 스트림 사용)
- 우선순위: P2 (iOS 때)
- 배경: 대화 스트리밍 (tech-spec "2.4"). 안 되면 `react-native-sse`.
- 확인 방법: iOS 실기기 테스트.
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-19 외부 디앱 사용자가 마루의 카카오 KYC 증명을 받을 수 있나?
- 상태: 열림
- 우선순위: P0 (가입 흐름이 걸려 있음)
- 배경: 테스트넷 KYC 발급은 카카오 본인 인증 하나, 발급 계정도 마루 쪽 하나 (D-16). 시켜용 앱 안에서 인증을 붙일 수 있는지, 익스피리언스처럼 마루 쪽에서 인증하고 돌아와야 하는지 모른다.
- 확인 방법: 재욱 님, 딜라이트랩스 (11/19 Mock KYC 요구사항 문서 검토 때).
- 담당: 호재 님
- 결론:
- 반영한 곳:

### Q-20 12/9 시연을 웹 빌드로 할까, iOS 실기기로 할까?
- 상태: 열림
- 우선순위: P1
- 배경: D-18로 웹(Next.js) 먼저가 정해졌다. 남은 질문은 시연을 휴대폰 브라우저로 할지, 홈 화면 추가(PWA)로 전체 화면을 쓸지, 나중에 iOS가 필요한지다.
- 확인 방법: 재욱 님 (iOS 계정), 1주차 끝에 웹 빌드 성능 측정.
- 담당: 호재 님
- 결론:
- 반영한 곳:

### Q-21 한도 안 주문은 확인 버튼 없이 알아서 결제하게 할까?
- 상태: 열림
- 우선순위: P2
- 배경: 피클은 결제마다 카카오페이 승인을 누른다. 시켜용은 한도가 체인에 있어서 한도 안은 자동 결제가 가능하다. 지금 설계(D-06)는 매번 확인 버튼.
- 확인 방법: 호재 님 결정, 데모 피드백.
- 담당: 호재 님
- 결론:
- 반영한 곳:

### Q-22 화면에 음수 금액이 나오는 곳이 있나?
- 상태: 열림
- 우선순위: P2
- 배경: `formatOkrw`는 음수를 "-9,000원"으로 표시하게 정했다(code-style.md). 시안(`design/screens`)에는 음수 금액이 없다. 환불(`refund`)이나 예산 초과분을 어떻게 보여 줄지 정해지지 않았다.
- 확인 방법: 영수증, 환불, 예산 화면 시안을 볼 때 정한다. 음수를 쓰지 않기로 하면 `formatOkrw`가 음수에 에러를 내게 바꾼다.
- 담당: 호재 님
- 결론:
- 반영한 곳:

### Q-23 예산 칩 "20만 원" 표기를 허용할까?
- 상태: 열림
- 우선순위: P2
- 배경: 시안 Budget의 예산 고르기 칩 라벨이 "20만 원" 형식이다. design-and-motion.md는 금액 표기를 "9,000원" 하나로, code-style.md는 표시 문자열을 `formatOkrw` 하나로 정했다. 둘이 어긋난다.
- 확인 방법: 호재 님 결정. 허용하면 `packages/shared`에 두 번째 공식 함수(예: `formatOkrwShort`)를 두고 쓰는 곳을 칩 라벨로 한정한다. 아니면 시안을 "200,000원"으로 고친다.
- 담당: 호재 님
- 결론:
- 반영한 곳:

### Q-24 경로 C에서 같은 orderRef로 두 번 보내면 컨트랙트가 막나?
- 상태: 열림
- 우선순위: P1
- 배경: D-19는 결제 실패 뒤 같은 orderRef로 재시도한다. 경로 A, B는 `placeOrder`의 `OrderExists`가 두 번째 결제를 막는다. 경로 C(`transfer.send`로 컨트랙트에 보내고 `receive()`가 미리 등록한 의도와 맞춤)는 두 번째 송금을 어떻게 처리하는지 정해지지 않았다.
- 확인 방법: 경로 C를 쓰게 되면 컨트랙트 설계에서 의도당 한 번만 받고 나머지는 되돌리거나 환불하게 하고 forge 테스트로 확인한다.
- 담당: 컨트랙트 작업자
- 결론:
- 반영한 곳:

### Q-25 판매자가 주문을 거절(`rejected`)하면 주문 상태는?
- 상태: 열림
- 우선순위: P2
- 배경: tech-spec 6.2 판매자 API는 `rejected`를 받지만 tech-spec 4 `orders.status` 목록에는 `rejected`가 없다. 결제 뒤 거절이면 환불(`refunded`)로 가야 할 것 같다 (추론).
- 확인 방법: 판매자 콘솔(2단계) 설계 때 정한다. 1단계 목 가게는 거절하지 않는다.
- 담당: 호재 님
- 결론:
- 반영한 곳:

### Q-26 Cap 시안의 "지갑이 텅 비었어용"은 그대로 쓸까?
- 상태: 열림
- 우선순위: P2
- 배경: design/screens/Cap.dc.html의 드래곤 대사 둘째 줄이 "지갑이 텅 비었어용..."이다. D-17과 design-and-motion.md는 사용자 화면에 "지갑"을 쓰지 않고 "용돈"으로 바꾼다고 정했다. tech-spec 3.6의 `CHAIN_PERIODIC_LIMIT` 대사는 "이번 30일 배달비를 다 썼어용. {resetAt}부터 다시 시킬 수 있어용"이다.
- 확인 방법: 호재 님 결정. "용돈이 텅 비었어용" 같은 말로 시안을 고치거나, 3.6 대사로 통일한다.
- 담당: 호재 님
- 결론:
- 반영한 곳:


### Q-27 입력칸 오류 모양을 시안에 넣을까?
- 상태: 열림
- 우선순위: P2
- 배경: user-flow.md 3단계는 "이름 비면 버튼 비활성 대신 안내"라고 하지만 design/screens/Name.dc.html에는 오류 모양이 없다. TextField는 임시로 Blocked.dc.html의 주의 색을 빌려 테두리 `color.over`, 안내 문구 13px `color.overInk`로 그린다. 빨간색 토큰은 없다.
- 확인 방법: 호재 님이 Name 시안에 오류 상태를 그리거나 지금 모양을 승인한다.
- 담당: 호재 님
- 결론:
- 반영한 곳: packages/ui/src/base/TextField/TextField.module.css

### Q-28 예산 막대의 평소(70% 미만) 색은?
- 상태: 열림
- 우선순위: P2
- 배경: Main.dc.html(70%)과 Arrived.dc.html(73%)은 예산 막대를 노른자로 그린다. D-17은 "노른자(뿔, 예산 막대)"라고 적었다. 70% 미만 예산 막대 색은 어느 시안에도 없다.
- 새 근거 (2026-11-19): Confirm.dc.html의 한도 막대("한 번에" 90%, "30일 동안" 44%)는 잎색이고 바탕이 `line`(#E3E8E2)이다. 그래서 색은 비율이 아니라 막대 종류로 갈린다고 읽었다 (추론): 예산은 늘 노른자, 한도는 잎색. Meter에 `kind: 'budget' | 'limit'`을 넣어 이대로 그린다.
- 확인 방법: 호재 님이 위 읽기(예산은 늘 노른자, 한도는 잎색)가 맞는지 확인한다.
- 담당: 호재 님
- 결론:
- 반영한 곳: packages/ui/src/base/Meter/Meter.module.css

### Q-29 LimitChat의 한도 변경 카드는 어떤 경로로 만드나?
- 상태: 닫힘
- 우선순위: P1
- 배경: user-flow.md 13단계는 "LLM은 변경 카드만 만든다. 확정은 버튼과 재인증"이라고 한다. 그런데 CLAUDE.md 절대 규칙 3과 tech-spec 3.3의 LLM 도구는 읽기 도구, `place_order`, `request_owner_approval`(주문 승인용, reason/merchantId/items)뿐이라 한도 변경 카드를 만드는 도구가 없다. LimitChangeCard 컴포넌트는 만들었지만 카드 데이터를 누가 만드는지 정해지지 않았다.
- 확인 방법: 호재 님 결정. (a) 정책을 바꾸지 않고 카드 데이터만 돌려주는 읽기 성격의 도구(예: `propose_limit_change`)를 더한다. 고르면 decisions.md부터 적고 CLAUDE.md 절대 규칙 3의 도구 목록과 tech-spec 3.3 도구 목록도 함께 고친다, (b) 서버가 대화를 규칙으로 해석해 카드를 만든다, (c) LimitChat에서는 버튼으로만 고르게 한다.
- 담당: 호재 님
- 결론: (a). Claude에 카드만 띄우는 `propose_limit_change`를 더한다. 금액 없이 레벨이나 예산 선택지만 받고, 사용자 메시지에 의도가 없으면 서버가 카드를 버린다. 확정은 버튼으로만 (레벨 올리기는 재인증, 예산 변경과 내리기는 바로) (2026-11-19 호재 님, decisions D-21).
- 반영한 곳: decisions D-21, CLAUDE.md 절대 규칙 3, tech-spec 3.3과 9.2, agent-runtime.md, security.md, LimitChangeCard.md

### Q-30 파우치 임베디드 SDK로 에이전트 소유자를 맡길 수 있나? 언제 나오나?
- 상태: 열림
- 우선순위: P1
- 배경: D-24. 지금은 운영자 수탁. 파우치가 앱 안 SDK로 나오면 사용자 지갑을 8004 소유자로 바꾼다. 파우치 측은 임베디드 SDK를 만들고 있다고 함 (11/20).
- 확인 방법: 파우치 담당(수현 님)께 질문. (1) SDK 배포 일정, 웹(Next.js) 지원 여부 (2) 파우치 지갑 주소를 IdentityRegistry 소유자로 쓸 수 있나 (3) 서명 요청 UX(Face ID 같은 재인증) (4) 사용자 서명 없이 앱이 대신 실행하는 위임 기능이 있나, 범위 제한은 어디서 지키나 (5) MAWS 소유자를 외부 지갑 주소로 둘 수 있나 (MAWS 담당, 소유권 이전 문서는 `toOwnerId: "user_123"` 형태라 MAWS 계정 ID일 가능성)
- 붙일 때 정할 것 (2026-11-20, 검증 메모): 지금 부화는 `bind`가 사용자 서명을 기다려도 `setTransferLimit`을 이어서 부른다. custodial이면 둘 다 바로 끝나서 문제없지만, pouch에서 limit만 server로 실행되면 한도는 체인에 남고 용은 ACTIVE가 아니다. `bind`가 끝나기 전에는 limit을 준비만 할지 이 작업에서 정한다 (`modules/agents/agent-setup.service.ts`).
- 담당: 호재
- 결론:
- 반영한 곳:

### Q-31 `bindAgent`를 언제 소유자 직접 호출로 여나?
- 상태: 열림
- 우선순위: P1
- 배경: D-08과 tech-spec 5.3은 소유자가 `bindAgent`를 부르고 컨트랙트가 8004에서 소유 관계를 확인한다고 한다. 그런데 확인 인터페이스(`IAgent.getAgentIds` 페이지 인자, IdentityRegistry `ownerOf`)가 미확인이다 (Q-11, S11). 확인 없이 열면 아무나 남의 에이전트를 자기에게 묶어 멈추거나 환불을 받을 수 있다. 그래서 1단계 구현(2026-11-20)은 `bindAgent`를 운영자만 부르게 하고 주인은 호출자(운영자)로 둔다. 1단계는 모든 에이전트의 8004 소유자가 운영자라 결과가 같다 (tech-spec 5.3).
- 확인 방법: S11로 ABI가 확정되면 (a) `bindAgent`에 8004 확인을 넣고 소유자 직접 호출로 연다, 또는 (b) tech-spec 5.3 대안 `bindAgentByOperator(agent, owner)`를 더해 운영자가 실제 사용자 주소를 주인으로 묶는다. 어느 쪽이든 UUPS 업그레이드로 한다.
- 담당: 컨트랙트 작업자, 호재 님 (결정)
- 결론:
- 반영한 곳: contracts/src/SikyeoyongOrders.sol `bindAgent`, contracts.md "명세와 다른 점"

### Q-32 마루 EVM은 어느 하드포크까지 지원하나? (PUSH0, MCOPY, TSTORE)
- 상태: 열림
- 우선순위: P1
- 배경: docs.maroo.io에서 EVM 버전(Shanghai의 PUSH0, Cancun의 MCOPY와 TSTORE) 지원 여부를 찾지 못했다 (미확인). 지원하지 않는 옵코드가 바이트코드에 있으면 배포나 호출이 실패한다. 그래서 `contracts/foundry.toml`은 가장 보수적인 `evm_version = "paris"`로 컴파일하고, 재진입 가드는 일시 저장소(`ReentrancyGuardTransient`) 대신 저장소 기반 `ReentrancyGuard`를 쓴다.
- 확인 방법: 마루 팀에 cosmos/evm 버전과 활성 하드포크를 묻는다. 또는 테스트넷에 PUSH0, MCOPY, TSTORE를 쓰는 작은 컨트랙트를 배포해 본다 (돈이 드는 체인 호출이라 호재 님 승인 뒤).
- 담당: 컨트랙트 작업자
- 결론:
- 반영한 곳: contracts/foundry.toml, contracts.md "구현"

### Q-33 운영자 키를 어떻게 바꾸나?
- 상태: 열림
- 우선순위: P2
- 배경: tech-spec 5.2에 `operator` 변수는 있지만 바꾸는 함수가 없다. 명세에 없는 기능이라 구현(2026-11-20)도 만들지 않았다. 지금은 owner가 UUPS 업그레이드로만 바꿀 수 있다. 운영자 권한은 가게 활성화, 에이전트 바인딩, 환불 대행이다 (환불 돈은 소유자에게만 간다). 1단계는 owner와 운영자가 같은 키라 키가 새면 업그레이드 권한도 함께 넘어간다.
- 확인 방법: 호재 님 결정. (a) owner만 부르는 `setOperator`를 더한다 (decisions D-08부터), (b) 업그레이드로만 바꾼다, (c) 2단계에 owner를 멀티시그로 옮길 때 같이 정한다.
- 담당: 호재 님
- 결론:
- 반영한 곳: contracts.md "명세와 다른 점"

### Q-34 보이는 가게 판정에 `onchain_id`를 언제부터 넣나?
- 상태: 열림
- 우선순위: P1
- 배경: merchants.md MUST는 "온체인 등록이 성공하고 Active인 가게만 추천·주문 대상"이다. 그런데 체인 등록 스크립트(`infra/scripts/seed-merchants.ts`)가 아직 없어 시드 가게는 모두 `onchain_id=null`이다. 지금 `MerchantsService`는 DB의 `verified`와 `active`만 본다 (2026-11-20).
- 확인 방법: 컨트랙트 배포와 체인 등록 스크립트가 생기는 커밋에서 보이는 가게 조건에 `onchain_id`가 있어야 한다는 조건을 더하고 merchants.md를 고친다. 체인의 Active 상태를 서버가 어떻게 따라갈지(인덱서 `MerchantStatusChanged`)도 같이 정한다.
- 담당: 컨트랙트, 시드 작업자
- 결론:
- 반영한 곳:
