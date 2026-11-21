---
node: leaf
parent: _index.md
children: []
---

# 보관한 질문 (닫힘)

`open-questions.md`에서 상태가 닫힘인 질문을 옮겨 둔 곳이다 (2026-11-21 wiki-gc). 결론은 각 항목의 "반영한 곳"(결정, 컴포넌트 문서, maroo-facts)에 이미 옮겨져 있다. 내용은 그때 모습 그대로라 "레벨" 같은 예전 말이 남아 있다. 새 세션은 읽지 않아도 된다.

### Q-09 ClawOps 요금·발신 제한, AI 통화 고지 의무는?
- 상태: 닫힘 (2026-11-18, D-14 전화 기능 제외로 확인할 필요 없음)
- 우선순위: P2 (2단계)
- 배경: 전화 기능(제외됨, D-14).
- 확인 방법: 한국AI통신 문의, 법무 검토.
- 담당: 호재 님
- 결론:
- 반영한 곳:

### Q-11 8004 소유 관계 조회와 setMetadata 시그니처는? (스파이크 S11)
- 상태: 닫힘 (2026-11-21, SDK ABI와 실제 실행으로 확인)
- 우선순위: P0
- 배경: `bindAgent`의 소유 확인, TransferLimit 기록 (tech-spec "5.3", "5.7"). `IdentityRegistry.ownerOf`, `setMetadata`, `IAgent.getAgentIds` 페이지 인자 형식이 미확인.
- 확인 방법: Explorer 검증 소스에서 ABI 확인.
- 담당: 구현 세션
- 결론 (확인): `ownerOf(agentId)`, `getAgentWallet(agentId)`, `setMetadata(agentId, key, bytes)`(소유자가 보냄), `setAgentWallet(agentId, newWallet, deadline, signature)`, `isAuthorizedOrOwner(agentId, spender)`가 있다. `getAgentIds(wallet, pageRequest)`는 `(uint256[] ids, { nextKey, total })`를 돌려주고 키는 소유자가 아니라 지갑이다 (F-23). `bindAgent`의 소유 확인을 컨트랙트가 8004로 직접 하게 하는 일은 여전히 하지 않는다 (Q-31).
- 반영한 곳: maroo-facts 2, chain-and-pcl.md, payment.md "경로 B 구현"

### Q-13 `deployPclProxy` kind 값과 초기화, PolicySet·LogicalPolicy·ForEachPolicy의 Solidity 타입과 enum 값은?
- 상태: 닫힘 (2026-11-20, 테스트넷 실제 배포로 확인)
- 우선순위: P0
- 배경: 배포 스크립트와 정책 인코딩 (tech-spec "5.5", "5.6"). `AGENT_OKRW_TRANSFER_LIMIT_POLICY`의 필드 없는 struct 인코딩도 미확인.
- 덧붙임 (2026-11-20): `SikyeoyongOrders.initialize`는 접근 제어가 없어 `deployPclProxy`가 초기화 데이터를 같이 받는지(원자적 초기화)도 이 질문으로 확인한다. 못 받으면 초기화 뒤 `owner()`, `operator()`를 다시 읽어 확인한다 (contracts.md "반드시 지킬 규칙").
- 확인 방법: `IPcl.sol` 원본(`@maroo-chain/contracts`) 확인, 스파이크 S4.
- 담당: 구현 세션
- 결론 (확인, 2026-11-20): 공식 SDK `@maroo-chain/viem@0.5.0`이 인코딩을 맡는다. 우리는 Solidity 타입을 직접 만들지 않는다.
  - kind: `pclProxyKinds` = Unspecified 0, Transparent 1, UUPS 2, Beacon 3, Diamond 4. 시켜용은 UUPS(2).
  - UUPS는 `deployPclProxy({ kind, logic, initializer })`. `initialOwner` 없음. `initializer`(`initialize(operator, owner, false)` calldata)는 같은 트랜잭션에서 위임 호출되어 원자적이다. 배포 직후 `owner()`, `operator()`가 운영자 주소로 읽혔다. OZ `UUPSUpgradeable` 구현이 PCL UUPS 프록시 뒤에서 그대로 초기화됐다 (`evm_version = paris` 바이트코드도 실행됨, Q-32의 일부 답).
  - 프록시 주소는 반환값이 아니라 영수증의 `PclProxyDeployed` 이벤트(`deployPclProxy.extractEvent(logs).args.proxy`).
  - 정책: `policy.and([policy.agentOkrwTransferLimit(), policy.periodicVolume({ limits: [{ token: 'atokrw', maxAmount, resetPeriodSeconds }] })], { selector })`. `AGENT_OKRW_TRANSFER_LIMIT_POLICY`는 값 없는 정책(`{}`)으로 인코딩된다. `changeContractPolicies({ contract, admin, policies })`가 받아들였고 `contractPolicies`가 `{ _contract, admin, policies[] }`로 돌려줬으며 `PolicySet.decode`로 읽힌다. ForEach는 쓰지 않았다(Q-06).
  - 정책 admin은 `deployPclProxy` 호출자가 배포와 동시에 묶인다 (`pclProxy(proxy).admin`이 `changeContractPolicies` 전에 이미 운영자). 문서의 "첫 `changeContractPolicies` 호출자" 설명과 다르다 (F-20).
- 반영한 곳: chain-and-pcl.md "배포", maroo-facts 3.5, 3.6, tech-spec 5.5, 5.6, 5.9, `infra/scripts/deploy-orders.ts`

### Q-14 `simulateContract`(eth_call)에서 컨트랙트 범위 정책이 재현되나?
- 상태: 닫힘 (2026-11-21, 테스트넷 실제 실행으로 확인)
- 우선순위: P1
- 배경: preflight로 가스를 아끼려면 시뮬레이션에서 PCL 거절이 보여야 한다. 컨트랙트 범위 정책은 실행 중 평가된다 (확인).
- 확인 방법: 정책 걸린 `placeOrder` 한도 초과를 `eth_call`로 호출해 revert 데이터 확인.
- 담당: 구현 세션
- 결론 (확인, 2026-11-21): 재현된다. SDK `pcl.simulatePclProxy`(에이전트를 보낸 사람으로, `value` 포함)와 `estimateGas` 둘 다 `ExceededAgentTransferLimit(maxLimit, value)`를 revert로 돌려줬다 (TransferLimit 500 OKRW에서 1,000 OKRW 주문). 우리 컨트랙트 본문의 거절(`AgentIsPaused`)도 같은 시뮬레이션에서 읽혔다. 그래서 `pay`는 추정 단계에서 거절을 받으면 서명 없이 돌려준다(가스 없음). 가스가 과금되는 실제 revert는 이 경로로는 만들지 못했다.
- 반영한 곳: chain-and-pcl.md "에이전트 연결과 30일 사용량 읽기", payment.md "경로 B 구현", maroo-facts 3.3

### Q-18 React Native fetch 스트리밍(SSE)이 실기기에서 동작하나?
- 상태: 닫힘 (2026-11-19, D-18로 웹 Next.js가 되어 React Native를 쓰지 않음. 브라우저 EventSource 또는 fetch 스트림 사용)
- 우선순위: P2 (iOS 때)
- 배경: 대화 스트리밍 (tech-spec "2.4"). 안 되면 `react-native-sse`.
- 확인 방법: iOS 실기기 테스트.
- 담당: 구현 세션
- 결론:
- 반영한 곳:

### Q-29 LimitChat의 한도 변경 카드는 어떤 경로로 만드나?
- 상태: 닫힘
- 우선순위: P1
- 배경: user-flow.md 13단계는 "LLM은 변경 카드만 만든다. 확정은 버튼과 재인증"이라고 한다. 그런데 CLAUDE.md 절대 규칙 3과 tech-spec 3.3의 LLM 도구는 읽기 도구, `place_order`, `request_owner_approval`(주문 승인용, reason/merchantId/items)뿐이라 한도 변경 카드를 만드는 도구가 없다. LimitChangeCard 컴포넌트는 만들었지만 카드 데이터를 누가 만드는지 정해지지 않았다.
- 확인 방법: 호재 님 결정. (a) 정책을 바꾸지 않고 카드 데이터만 돌려주는 읽기 성격의 도구(예: `propose_limit_change`)를 더한다. 고르면 decisions.md부터 적고 CLAUDE.md 절대 규칙 3의 도구 목록과 tech-spec 3.3 도구 목록도 함께 고친다, (b) 서버가 대화를 규칙으로 해석해 카드를 만든다, (c) LimitChat에서는 버튼으로만 고르게 한다.
- 담당: 호재 님
- 결론: (a). Claude에 카드만 띄우는 `propose_limit_change`를 더한다. 금액 없이 레벨이나 예산 선택지만 받고, 사용자 메시지에 의도가 없으면 서버가 카드를 버린다. 확정은 버튼으로만 (레벨 올리기는 재인증, 예산 변경과 내리기는 바로) (2026-11-19 호재 님, decisions D-21).
- 반영한 곳: decisions D-21, CLAUDE.md 절대 규칙 3, tech-spec 3.3과 9.2, agent-runtime.md, security.md, LimitChangeCard.md

### Q-35 "처음 보는 가게" 승인이 데모의 첫 정상 주문을 막는다. 어떻게 할까?
- 상태: 닫힘
- 우선순위: P1
- 배경: D-07과 tech-spec 1.4 흐름 3은 "처음 보는 가게면 소유자 승인"이다. 2026-11-20 견적 구현은 이것을 글자 그대로 따른다: `allowed_merchants`에 없고 그 가게에서 결제된 주문(paid 이상)도 없으면 `SERVER_NEW_MERCHANT`로 `pending_approval`. 그러면 새 사용자의 **첫 주문은 어느 가게든** 승인 카드부터 뜬다. user-flow 데모 순서 2(6, 7, 8 정상 주문)와 부딪힌다.
- 선택지: (a) 그대로 둔다(첫 주문마다 허락 카드, 보안 메시지는 강하지만 첫인상이 한 번 막힘) (b) 부화 때 시드 가게 전부를 허용 목록에 넣는다(데모만, `DEMO_MODE`) (c) 추천 카드로 고른 인증 가게는 처음이어도 묻지 않고, 대화에서 직접 이름을 댄 가게만 묻는다 (d) 레벨 1 건당 한도 안의 주문은 처음 가게여도 묻지 않는다.
- 확인 방법: 호재 님 결정. 결정 전까지 데모 리허설은 (b)처럼 허용 목록을 미리 채운 계정으로 한다 (추론, 기본값).
- 담당: 호재
- 결론: (b)로 정함 (2026-11-20, D-27): DEMO_MODE에서만 시드 가게를 허용한 가게로 친다.
- 반영한 곳: decisions D-27, payment.md 견적 절, `apps/api/src/modules/orders/order-rules.service.ts`

### Q-36 레벨 올리기의 "재인증"을 서버가 무엇으로 확인하나?
- 상태: 닫힘
- 우선순위: P1
- 배경: D-21은 레벨 올리기를 `POST /agents/me/level` + 재인증(화면은 Face ID)으로 정했고, 서버가 재인증을 어떻게 확인할지는 "API 구현 커밋에서 정한다"고 미뤘다. D-24로 지금은 운영자 수탁, 나중에는 파우치 서명이 소유자 서명이 된다. 승인 API는 레벨 초과 승인을 이 엔드포인트로 넘겼다(payment.md). 그래서 데모 장면 12→13(한도 초과, 말로 올리고 다시 시키기)은 이 질문이 풀려야 끝까지 돈다.
- 선택지: (a) WebAuthn(패스키, 기기 생체 인증)으로 짧은 재인증 토큰을 받아 레벨 요청에 붙인다. 웹 표준이고 Face ID와 같은 경험, 서버에 자격 증명 저장 필요. (b) 소셜 로그인을 다시 거쳐(카카오, 구글 재로그인) 5분짜리 재인증 표시를 세션에 남긴다. 구현이 쉽고 경험은 덜 매끄럽다. (c) 테스트넷 데모 동안은 재인증 없이 버튼만(`REAUTH_MODE=none`, production 거절), 파우치가 나오면 파우치 서명이 재인증을 대신한다(D-24). (d) (a)를 하되 파우치 출시 뒤 파우치 서명으로 바꾼다.
- 확인 방법: 호재 님 결정. 결정 전까지 레벨 올리기와 레벨 초과 승인 연결은 만들지 않는다. 재인증이 필요 없는 레벨 내리기는 이 질문과 상관없이 만들 수 있다.
- 담당: 호재
- 결론: (c)로 정함 (2026-11-20, D-28): 테스트넷 데모는 REAUTH_MODE=none으로 버튼만, production 거절, 파우치가 나오면 파우치 서명.
- 반영한 곳: decisions D-28 (구현은 후속)

### Q-38 주인 용돈(장부)이 모자라면 주문을 막나?
- 상태: 닫힘 (2026-11-21, 호재 님께 보고 예정)
- 결론: 선택지 (a)와 (c)의 합. DEMO_MODE가 아니면 confirm은 장부가 즉시 충전액을 못 덮을 때 충전 전에 `CHAIN_INSUFFICIENT_FUNDS`("용돈이 모자라용")로 거절한다. 장부 확인과 `fund` 기록은 한 SQLite 트랜잭션이라(보류 기록 `reserveFund`) 두 주문이 같은 용돈을 함께 쓰지 못한다. 충전이 안 나갔으면 보류를 되돌리고, 충전 호출이 던졌으면(돈이 나갔을 수 있음) 보류를 남긴다. DEMO_MODE는 예전처럼 막지 않고 충전 뒤에 기록한다 (b). 리드가 정했고 호재 님께 보고 예정. 구현은 `order-confirm.service.ts`, `allowance.service.ts`.
- 우선순위: P2
- 배경: 수탁(D-24) 동안 confirm의 즉시 충전은 운영자 돈으로 용이 주머니를 채우고, 그 금액을 주인 용돈 장부에 `fund`로 뺀다 (2026-11-20). 장부가 0이어도 지금은 충전하고 결제한다(지갑 화면 표시는 0에서 멈춤). 체험 용돈을 받지 않은 사용자도 주문할 수 있다.
- 선택지: (a) 장부가 모자라면 충전 전에 `CHAIN_INSUFFICIENT_FUNDS`("용돈이 모자라용")로 거절. 지갑 화면과 맞고, 테스트 고정 사용자에게 장부를 넣어야 한다. (b) 지금처럼 막지 않음(데모 편의, 수탁이라 운영자 돈이 나감). (c) 데모 모드에서만 막지 않음.
- 지금 기본값: (b).
- 확인 방법: 호재 님 결정. (a)면 장부 확인과 기록을 한 트랜잭션으로 묶는다(검증 MINOR).
- 담당: 호재

### Q-39 파우치 EntryPoint v9가 테스트넷 PCL의 신뢰 엔트리포인트인가?
- 상태: 닫힘 (2026-11-20)
- 우선순위: P1 (파우치 위임 결제 경로, S14)
- 배경: PCL 훅은 등록된 프록시나 `PclParams.entrypoints`의 엔트리포인트가 부를 때만 돈다 (maroo-facts). 파우치 스마트 지갑의 UserOperation이 EntryPoint를 거쳐 주문 컨트랙트를 부를 때 정책이 걸리려면 그 EntryPoint가 목록에 있어야 한다.
- 확인 방법: 테스트넷 PCL 프리컴파일 `getParams()` 읽기 (`cast call 0x1000000000000000000000000000000000000005 "getParams()((address,address[]))"`, 읽기만).
- 결론 (확인, 2026-11-20 조회): 있다. entrypoints = `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`(v0.6, 추론: 표준 배포 주소), `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108`(v0.8, 추론: 표준 배포 주소), `0x433709009B8330FDa32311DF1C2AFA402eD8D009`(파우치 EntryPoint v9, bech32 `maroo1gvmsjqymsvc0mgerz803c2h6gqhd35qfx3tslf`와 같은 주소). policyAdmin = `0x58eC1E718ff15e5f34591747D47ADf5BccDA804F`.
- 남은 것: 목록에 있다는 것과 컨트랙트 범위 TransferLimit가 스마트 지갑을 sender로 보는지는 다른 질문이다 (Q-12, S14 2단계).
- 반영한 곳: 이 항목
