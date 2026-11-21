---
node: leaf
parent: _index.md
children: []
---

# 작업 기록

새 세션은 **맨 아래 항목부터** 읽는다. 세션이 끝날 때 항목을 하나 추가한다.

## 양식
```
### YYYY-MM-DD 세션 이름 (누가: 사람, 세션 종류)
- 한 일:
- 결과물: (파일, PR, 트랜잭션 해시, 배포 주소)
- 막힌 것:
- 새로 안 마루 사실: (maroo-facts.md에도 반영했는지)
- 다음 할 일:
```

## 기록

### 2026-11-20 주문 흐름 마무리: confirm, place_order, 승인 API, request_owner_approval
- 한 일 (모두 검증 PASS):
  - confirm 결제 (207fc32, 수정 9a6f4ce): 표시 뒤 던짐은 submitting, 30일 재검사, 승인 롤백, attempt는 SQL에서.
  - place_order 연결 (26c6230, 수정 e77c10c): OrdersService 창구, 모델에는 표시 말만, 승인 필요면 APPROVAL_REQUIRED.
  - 승인과 거절 API (28b8834, 수정 ccdfe8a): owner-approvals 모듈, 결정과 주문 효과를 한 트랜잭션에, 레벨 승인은 /agents/me/level 몫.
  - request_owner_approval (6f66ee5, 수정 0dcf4c6): 살아 있는 대기 승인에 메시지, 승인이 필요 없으면 아무것도 만들지 않음.
- 막힌 것: Q-35 결정 대기.
- 후속 (검증 MINOR):
  - 충전 멱등성(요청 ID, 충전 제출 표시)은 실제 경로 연결 전 필수 (payment.md "confirm 코드" 아직).
  - 같은 가게 60초 쿨다운, 한 메시지 안 대기 승인 중복, 살아 있는 quoted 재사용 검토.
  - 승인 응답 카드 만들기에서 체인 RPC가 실패하면 500 (돈 문제 없음), 1분 만료 주기 작업, GET /approvals에 메시지.
  - txHash 대문자 정규화, 결제 지갑과 row.agentId 대조, 경로별 제출 표시(nonce, maws_request_id), 새 견적 전 이전 orderRef 확인.
- 다음 할 일: 레벨 상향 API(`POST /agents/me/level`, 재인증, TransferLimit 확정 뒤 승인 주문 quoted), `GET /orders/:id`, 경로 B 실제 연결, 웹 목을 실제 API로, 지갑 화면 조립(CustodyNote), UX 다듬기(D-23).

### 2026-11-20 데모 유저플로우 전체 조립, D-26/27/28
- 한 일:
  - 목 모드에서 user-flow 17개 화면을 모두 조립하고 검증 PASS (지갑과 신분증과 멈춤 880f6f7, 주문 화면 7cd95dd, 한도 장면 a380b1d). 로그인부터 시작하는 EntryGate, 목 대화 반복 고침, "…" 404 고침.
  - 로컬 http 모드: dev 로그인(`DEV_LOGIN`), 신원 확인 `POST /identity/verify`(목 기록).
  - D-26 데모 LLM 비용 (0f69643, 수정 80bd8c2): `LLM_MODE=replay`(읽기 도구만, API 호출 없음), live는 KST 하루 토큰 상한(캐시 포함), 닿으면 용이가 피곤하다는 한 줄만. effort 기본 low.
  - D-27 데모 시드 가게는 승인 없이 (4b02b96).
  - D-28 레벨 바꾸기 `POST /agents/me/level` (760c63c), 웹 http 연결 (7bf6c0c).
- 막힌 것: 없음. 호재 님 Xcode 설치 후 iOS 시뮬레이터로 폰 화면 보기.
- 후속:
  - 레벨 올린 뒤 OVER_LEVEL 승인 주문을 다시 견적으로 (http, approvalId 연결).
  - http에서 아직 거절하는 것: 지갑, 신분증, 멈춤, 환불, 맛 평가, 체험 용돈.
  - production에서 replay 허용 여부, 장면 시나리오 재생, 하루 상한 동시성.
  - 충전 멱등성(실제 경로 전 필수), 60초 쿨다운, 1분 승인 만료 작업, 영수증 시각, 목 30일 창 초기화, 결제 때 주머니 감소.
  - D-23 UX 다듬기: Skeleton, iOS 키보드(visualViewport), Next dev 표시.
- 다음 할 일: 위 검증 결과 반영, 경로 B 실제 연결, OAuth.

### 2026-11-20 파우치 스파이크 S14, http 모드 전환, 파우치 로그인 (D-29)
- 한 일:
  - S14 문서 조사와 파우치 앱 등록(tenant_369d04cfd8, localhost:3000, sandbox 키는 git 밖 .env.pouchi). 문의 모음 `docs/_research/pouchi-questions.md` (5개, S14 끝에 호재 님께 정리).
  - D-29: 로그인은 파우치 로그인 하나, 시작 버튼 "이메일로 시작하기", 웹은 http 모드로.
  - 서버 API 채움: GET /wallet와 주인 용돈 장부(allowance, 0006), POST /signup/trial, freeze/unfreeze/drain(AgentLock으로 한 줄), GET /me/id-card, POST /orders/:id/rating(0007), 즉시 충전을 장부 fund로, GET /identity.
  - 파우치 로그인: 서버(pouchi 모듈, users의 config/bind/complete, pouchi_accounts 0008, PKCE challenge 비교, IP당 1분 10회, trust proxy), 웹(세션 입구 lib/session/entry.ts, EmailStart와 TermsLine, /pouchi/callback, 입구가 Verify와 Name을 가름).
  - 홈 화면 추가용 manifest(주소창 없이), iOS 시뮬레이터(Xcode 27의 DeviceHub).
  - 로컬 개발: 루트 .env(비밀 없음 + 파우치 키 복사, git 밖), 마이그레이션 0006~0008 적용, 시드.
- 실수 기록: 커밋 제목이 게이트 상한(콜론 뒤 71자)을 넘은 것 둘. 24d48a9와 ee5c736. dev-loop.md대로 amend하지 않는다. `pnpm verify --precommit`은 메시지를 보지 않으므로 커밋 전에 제목 길이를 따로 센다.
- 막힌 것: 실제 파우치 금고 로그인(이메일 코드, 패스키)은 사람이 해야 해서 아직 끝까지 돌려 보지 못했다. 테넌트 `pending-approval`이 풀렸는지 모른다.
- 열린 질문: Q-37(이번 달 아낀 돈), Q-38(장부가 모자라면 주문을 막나).
- 후속:
  - Start 시안 갱신(한 버튼), 예산 화면 30일 사용액이 목 체인에서 0(개발 ChainReader가 목 결제를 읽지 않음).
  - 체험 용돈 버튼 실패 표시, 파우치 BFF 예제의 로그인 전 세션 범위 pending과 Origin 검사, bind만 셀지(IP 제한).
  - 장부 실체인 전 할 일(영수증 금액, txHash 유일 열쇠, 체인 멈춤 뒤 drain), REVOKED 오류 코드, 동결과 confirm 겹침.
  - OWNER_MODE=pouch(PouchOwner)와 S14 2단계 실행(배포, 세션 키 실험은 React SDK spikes에서).
- 다음 할 일: 호재 님 실제 로그인 결과를 보고 고치기, Start 시안, 30일 사용액, D-23 UX 다듬기.

### 2026-11-20 실제 LLM 대화, 한도 금액(D-31), 캔버스 시안과 종별 테마(D-32), 체인 확인
- 한 일:
  - 대화: OpenAI 공급자(D-30), 음식 주제 제한, 쓰는 중 점 셋과 스트리밍, 회색 스크롤바 숨김, 위로 올려 읽다가 보내면 맨 아래로(followKey).
  - 목 체인 30일 사용량, 배달 단계 흉내(목과 데모만), 검증 FAIL 수정 커밋들.
  - 테스트넷 준비: 운영자 키를 .env에 새로 만듦(주소 0xBb71B672BC33745283842ce701F5b0FC28d023d3, 값은 출력 안 함), faucet 5,000 tOKRW 1회. 배포는 아직. `@maroo-chain/viem` 0.5.0 타입으로 deployPclProxy(kind Transparent 1, UUPS 2, initializer 같이)와 policy 빌더(agentOkrwTransferLimit, periodicVolume, and, eas)를 확인(Q-13 후속).
  - D-31 (7803f0c): 한도는 사용자가 금액으로, 레벨 없앰, 월 예산은 내 30일 한도로 합침, 드래곤은 금액 구간으로 자람. PUT /agents/me/limits, 마이그레이션 0009.
  - 캔버스 시안 반영과 D-32 (b774a33): 종별 테마 색, Look, Themes. 들어온 시안이 D-31 전 것이라 D-31 문구를 다시 얹음.
  - 체인 읽기: 파우치 EntryPoint v9가 PCL entrypoints에 있음(Q-39), KYC recipient는 스마트 지갑(Q-19, Q-40).
  - main 머지와 push (c31890b까지).
- 실수 기록 (amend 안 함, dev-loop.md):
  - 7fa0080은 게이트 FAIL(D18 경계, lint) 상태로 커밋됐다. 게이트 출력을 `tail`로 넘겨 종료 코드를 보지 않았다. 3c4d4da로 고쳤고, 이후 커밋은 게이트 종료 코드가 0일 때만 한다.
  - 7c1761c 제목의 종류 `design`은 허용 목록에 없다(G2). 시안 커밋은 `docs(design)`으로 쓴다.
  - b774a33에 Verify 행의 KYC recipient 내용(Q-19 반영)이 같이 들어갔다. 원래 37d9d70의 일이다.
- 막힌 것: 테스트넷 배포는 faucet 두 번째 수령을 멈춘 뒤 호재 님 지시 대기.
- 열린 질문: Q-37(아낀 돈, D-31 뒤 뜻 바뀜), Q-38, Q-40(마루 KYC 담당자께).
- 후속: web.md의 레벨 설명(43, 75, 81, 87행)과 Chip `lg` 죽은 크기는 D-32 UI 작업(별도 worktree)과 겹쳐 그 브랜치를 합친 뒤 고친다(7803f0c 검증 지적). 충전 코드가 floatCapAokrw를 쓰게, web 테스트가 turbo 병렬에서 5초 타임아웃(불안정), D-32 tech-spec과 위키 반영, 시작 화면 아래 한 줄은 D-17 설명 문구에 가까움(지울지 판단).
- 다음 할 일: D-32 구현(테마 CSS 변수, Look), Splash, 진행 중 주문 카드, 주문 내역 버튼, 브라우저 QA 결과 반영.

### 2026-11-20 브라우저 QA 반영과 5a071b5..e206c2c 검증 지적
- 한 일:
  - 숨은 글자(.srOnly)가 문서를 길게 만들던 것 (6cd3aeb), 한도 올린 뒤 기다리던 주문을 다시 견적으로 `POST /orders/:id/requote` (fd1c510)와 웹에서 확인 시트를 연 채로 대화로 (39db1ca), 멈추기 바로 이동과 멈춘 동안 입력 끔 (aacd6eb), 한 번에 > 30일 금지(D-31 한 줄, 52dbee1), 지난 한도 카드와 지난 한도 링크 (9090db9), "집으로"와 처음 사용자 안내 글 (21d6cf5), 스위치 44px (efd343b).
  - 검증 지적: LimitChangeCard 고정 테마 (02e53a3), Splash "체험용 데모"와 키보드 건너뛰기, verify.py 금지 말 "테스트넷" (fef6d0b), 주문 내역 줄은 열 화면이 있을 때만 누름과 failed는 "멈춤" (3b6a01f), Chip `lg` 없앰 (71b9e79), web.md 레벨 설명과 README 문서 수 59 (bc17006).
- 실수 기록 (amend 안 함): 6cd3aeb 메시지에 제목 뒤 빈 줄이 없어 본문 첫 문단이 제목에 붙었다. 이후 커밋은 메시지 파일로 쓴다.
- 못 한 것: 지갑 "이번 달 아낀 돈" 오른쪽 맞춤은 코드와 시안이 같아(값 뒤 16px 띠, 다른 줄의 화살표 16px과 같은 자리) 재현하지 못해 고치지 않았다. 화면 캡처가 있으면 다시 본다. Storybook(6006)은 지워진 BudgetPicker 이야기 색인 오류로 멈춰 있어 다시 띄워야 한다.
- 범위 밖 (보고만): 목 체인이 API 재시작 때 초기화됨, 기본 한도에서 밤 추천이 비는 것, 목 모드에서 부화 화면 건너뜀, 신분증 공유 버튼.
- 다음 할 일: 허락 카드(처음 가게, 30일 한도) 조립 뒤 주문 내역의 허락 대기 줄을 그 카드로, 멈춤과 취소 주문 영수증 화면.

### 2026-11-21 브라우저 QA 2차 반영 (대화, 추천, 화면)
- 한 일: 허락 대기 뒤 모델 말을 막고 서버 문장과 칩(973e47d), 한도 카드를 그 턴의 말 뒤로(be79eb6), 빈 추천의 까닭 `empty`(11d387f), 멈춘 동안 추천 누름에 쉰다는 줄과 입력 안내(573a872), 세션 답 전 Splash는 버튼 아님(3f2ecd2), 날씨 같은 사실은 도구 결과에 있을 때만(3182b93), 영수증 한도 줄은 "지금" 값(b8e2b60), /limit/cap 바로 방문은 대화로(5669a00), 막대 바탕과 꺼진 입력 칸의 `--theme-track`(7a70751), "되용"을 "돼용"으로(9a9a19d).
- 못 한 것: 주인 허락 카드(새 가게, 30일 한도)가 웹에 없어 허락 대기는 서버 문장과 칩으로만 안내한다. 영수증의 주문 때 한도는 주문에 저장하지 않아 보일 수 없다(저장 칸 필요). `WEATHER_PROVIDER=static`은 늘 "비"라 모델이 여전히 비를 말할 수 있다(데모 장면과 맞물려 판단 필요).
- 다음 할 일: 허락 카드 조립 뒤 `approval-wait.ts` 문장과 칩을 그 카드로, 주문에 그때 한도 남기기, 정적 날씨를 실제 날씨나 "모름"으로.

### 2026-11-21 오더스 컨트랙트 테스트넷 실제 배포 (demo 프로필, 호재 님 승인)
- 한 일:
  - `infra/` (`@sikyeoyong/infra`) 새 패키지: `deploy-orders.ts`(forge build, 구현, UUPS `deployPclProxy`+initialize, owner/operator 확인, 정책, 재조회, 기록), `apply-policy.ts`(`--check`). 쓰기마다 eth_call과 estimateGas 시뮬레이션, 가스 예산 300 OKRW, 기록이 있으면 `--force` 없이는 멈춤. `contracts:deploy:testnet`과 `policy:apply`가 이를 부른다. `deploy-testnet.sh`는 지움.
  - shared: `deployments.ts`(검증, `resolveOrdersContract`, env `ORDERS_CONTRACT` 우선), `deployments-data.ts`(등록).
  - 실제 배포 (체인 450815, demo): 구현 `0xf3091258a7ecee5a1b71577a573690bcdf8914e6`(블록 23814924), 프록시 `0x36713c60A8b4E54b56997553aD4b8b16d7C02Db8`(23814926), 정책(23814928). 가스 22.16 tOKRW. tx는 `deployments/450815.demo.json`과 탐색기 `https://explorer-testnet.maroo.io/tx/<해시>`.
  - Q-13 닫음, F-20(정책 admin은 deployPclProxy 호출자), F-21, F-22 기록.
- 다음 할 일: API 체인 모듈이 `resolveOrdersContract`와 `ORDERS_CONTRACT`를 쓰게(지금은 env만), `contractPolicies`를 `ChainReader`로 읽기, 목 가게 `registerMerchant`(가게 payout 키), 에이전트 TransferLimit 기록, `placeOrder` 실제 호출로 한도 revert와 `simulatePclProxy`(Q-14) 확인, `Deploy.s.sol` 주석과 기록 쓰기(이제 TS가 전부 함)를 정리.
- 메모: worktree에는 `.env`가 없어 `node --env-file=<메인 저장소 .env>`로 직접 실행했다 (키는 출력하지 않음).

### 2026-11-21 경로 B 실제 결제 (ManagedEoaPaymentProvider), 테스트넷 실행 (호재 님 승인)
- 한 일 (커밋 순서):
  - `agent_keys` 표(마이그레이션 0010)와 `AgentKeyVault`(AES-256-GCM, 주소 AAD, 키는 체인 일 전에 저장, 열기는 콜백 안에서만).
  - shared `PayRequest.beforeBroadcast`: 서명 해시와 nonce를 브로드캐스트 전에 confirm이 `submit_tx_hash`, `submit_nonce`로 남긴다. `createAgent`는 `agentRowId`를 받는다.
  - `ManagedEoaPaymentProvider`(register, setAgentWallet, setMetadata, bindAgent, setAgentPaused, fund, drain, preflight=`simulatePclProxy`, pay, findPaid), `common/onchain/`(클라이언트, ABI, 배포 주소 해석, revert 해석), `payment.service`가 B를 연결(프로덕션은 키나 프록시가 없으면 부팅 멈춤, 개발은 결제 안 하는 제공자로 대체), `AGENT_GAS_SHARE_OKRW`.
  - `ChainReader` 경로 B: `contractPeriodicVolume`. confirm 즉시 충전이 제공자의 가스 몫을 더한다. `pnpm e2e:path-b`.
  - 문서: payment.md "경로 B 구현", chain-and-pcl.md, tech-spec 3.4와 4, maroo-facts, F-23 ~ F-25, Q-05(부분), Q-11, Q-14 닫음.
- 실제 실행 결과 (체인 450815, demo 프로필, 일회용 에이전트): 8004 연결, TransferLimit, 9,000 OKRW 주문 통과(`OrderPlaced`), 한도 500으로 낮춘 뒤 1,000 주문은 `CHAIN_AGENT_LIMIT`(500원), 30일 사용량 9,000, 동결 시 `CHAIN_AGENT_PAUSED`, 회수. 실행 2회(첫 실행은 마지막 단계의 오류 해석 버그를 잡음). 가스 합계 약 27 OKRW.
- 놓친 것과 발견: (1) 30일 창 경계가 첫 주문이 아니라 주기 배수(Q-05, 목 체인은 다르게 흉내 냄). (2) 기본 가스 몫 2,000 OKRW는 실측(주문 약 4.3 OKRW)에 비해 크다. (3) 가게 payout `gukbap-01`(온체인 가게 1)에 두 번의 주문으로 18,000 OKRW가 들어 있다. 주인이 `pnpm merchants:sweep --to <운영자> --merchant gukbap-01`로 회수할 수 있다 (이 세션은 승인받은 세 가게만 회수했다).
- 다음 할 일: 부화 흐름(agent-setup)이 `agentRowId` 없이도 키를 연결하는지 통합 확인, 서버 시작 때 표시 있는 `submitting` 재확인, 인덱서, 충전 멱등성(payment.md "아직"), 목 체인 창을 실제 규칙으로, 가스 몫 기본값 조정, 체인 ID 부팅 대조.

### 2026-11-21 경로 B 검증 반영
- 한 일: 재시도 때 같은 `agentRowId`의 저장된 키를 다시 쓴다(부화 재시도가 unique 인덱스에 막히던 것, 자금 든 키는 버리지 않음). 회수 테스트에 운영자와 다른 소유자(파우치 방식) 추가. 마스터 키 base64를 정규형만 받게. 가스 몫 기본 100 OKRW, 상한 1,000 OKRW(D-25).
- 실수 기록 (amend 안 함): cfd4457 제목 `feat(shared,orders): ...`는 범위에 쉼표를 써서 형식 위반이다. 이후 범위는 하나만 쓴다.

### 2026-11-21 밤새 정리 (테스트넷 실제 트랜잭션까지, 호재 님 자는 동안)
- 한 일 (모두 커밋마다 검증 에이전트 PASS 뒤 main에 push, 마지막 cff1f2e):
  - 테스트넷 실제 배포(demo): 프록시 `0x36713c60A8b4E54b56997553aD4b8b16d7C02Db8`, `placeOrder`에 And(TransferLimit, 30일 60,000/3600초), `registerMerchant` 정책 없음(D-33).
  - 가게 66곳 시드와 가게별 키 보관본(`seed/.keys/archive/`), 주인이 손으로 돌리는 `merchants:balances`, `merchants:sweep`. 65곳 중 46곳 온체인 등록과 활성화(`seed/onchain/450815.demo.json`).
  - 결제 경로 B(`ManagedEoaPaymentProvider`): 키 금고(AES-256-GCM), 8004 등록과 `setAgentWallet`, TransferLimit, 즉시 충전(가스 몫 100 OKRW, D-25), 전송 전 해시와 nonce 기록, 재시도 이어 하기(8004 id 저장, 0011). 실제 e2e: 9,000 OKRW 주문 성공, 한도 초과는 CHAIN_AGENT_LIMIT, 멈춤은 CHAIN_AGENT_PAUSED, 회수 성공.
  - 실제 날씨(Open-Meteo), 목 체인 30일 창을 실제 규칙(주기 배수)으로, 브라우저 QA 3차까지 반영(메뉴 바꿔치기 막기와 부정 말 처리, 끊겨도 턴 저장 등).
- 막힌 것 (호재 님 판단 필요):
  - 운영자 잔액 약 1,691 tOKRW. 화면에서 실제 체인 주문을 끝까지 하려면 약 12,000 이상 필요. `pnpm merchants:sweep --to 0xBb71B672BC33745283842ce701F5b0FC28d023d3 --merchant gukbap-01`(약 18,000)을 돌려 주시거나 자동 모드에서 faucet(`mcp__maws__faucet_drip`)과 회수 명령을 허락해 주셔야 이어 간다 (분류기가 막음, 우회하지 않음).
  - 남은 가게 19곳 등록(약 92 tOKRW)도 위 자금 뒤에.
  - dev 서버는 아직 `PAYMENT_PATH=mock`. 경로 B로 바꾸려면 서버를 멈추고 `pnpm merchants:sync-onchain`, `pnpm db:migrate` 뒤 `.env`의 `PAYMENT_PATH=B`.
- 메모: 온체인 가게 metadataURI는 `http://localhost:3000/...`로 남았다(컨트랙트에 수정 함수 없음). 데모의 비 장면은 `WEATHER_STATIC=비`(또는 openmeteo 실제 날씨). Storybook(6006)은 지워진 BudgetPicker 색인 때문에 다시 띄워야 한다.
- 후속: 메뉴 이름 일부("국밥") 인식, 부정 말 사전 보강("별로", "질렸"), 사용자별 하루 LLM 예산, 서버 시작 때 `submitting` 재확인, 인덱서, 충전 멱등성, 웹 목 30일 창 테스트, 허락 카드 조립.

### 2026-11-21 위키 정리 (wiki-gardener, wiki-gc)
- 한 일: 낡은 용어 고침 문서 11개(제품 4: mascot-and-voice, glossary, scenarios, product/_index. 그 밖 7: README, pitch, wiki ROOT, components/_index, roadmap, Meter.md, plan.md 안내 한 줄). 레벨은 드래곤 단계(D-31), 월 예산은 내 30일 한도, 카카오·구글 로그인은 파우치 로그인(D-29)으로. 닫힌 질문 10개(Q-09, 11, 13, 14, 18, 29, 35, 36, 38, 39) 보관, 작업 기록 19개 보관(최근 10개만 남김).
- 보관한 것: `archive/questions.md`, `archive/worklog.md` (원문 그대로, 한 줄 요약 목록 포함). archive 색인을 internal로 바꿨다.
- 후보에서 뺀 것: 멤풀 표현 3건(chain-and-pcl, devrel-feedback F-07, scenarios)은 전역 정책과 컨트랙트 정책을 구분하는 바른 문장이라 그대로 둔다.
- 정리 보류 (사람 판단 필요):
  - `docs/tech-spec.md`: 2장 앞부분(로그인 카카오·구글, expo-auth-session, 117 ~ 119행)과 `users` 폴더 설명의 "월 예산"(204행), `SERVER_BUDGET_OVER` 문구 "이번 달 예산"(472행)은 코드와 에러 문구에 걸려 있다. 상단 대응표로 읽는 구간과 겹쳐 손대지 않았다.
  - `docs/plan.md` 본문(레벨표, 월 예산, 카카오·구글, Lv 표)은 처음 계획이라 안내 한 줄만 붙이고 본문은 두었다.
  - `components/merchants.md` 50행, tech-spec 761행의 사장님 "카카오 로그인"은 2단계 판매자 콘솔 계획이라 D-29 범위 밖인지 정해야 한다.
  - `ui/onboarding/KakaoVerify.md` 32행 "구글로 가입했어도 카카오톡으로 인증해요"는 코드 문구와 시안(Verify.dc.html)을 같이 고쳐야 한다. SocialLogin 문서와 `Start.dc.html`, `design/tokens.json`의 카카오 버튼 메모도 시안 갱신 때 함께.
  - `design/` 시안과 코드는 건드리지 않았다.
- 다음 할 일: 위 보류 항목 결정. 열린 질문은 `open-questions.md`.

### 2026-11-21 낮 (호재 님 외출 중 6시간 큐)
- 한 일 (모두 Sonnet 개발, Sonnet 검증 PASS 뒤 main push, 마지막 cdb29d9):
  - 후속: LLM 사용자별 하루 상한과 동시 턴 1개, 메뉴 부분 이름과 부정 말, 부팅 때 submitting 재확인(receiptOf, 승인 분류는 OrderSettler로 confirm과 같은 경로), OrderPlaced 인덱서(멱등, 금액과 가게 대조, 커서 0014), 충전 멱등(0012), 체인 ID 부팅 검사, 견적 때 한도 저장(0013)과 영수증, 주인 허락 카드, 영수증 작성(paid 네 전이).
  - 새 기능: 데모 자동 리허설 `pnpm demo:rehearse`(장면 1~7 통과, 자체 포트와 임시 DB, dist-rehearsal), 키 유출 비교 화면(데모 장면 5, `/demo/leak`), "내 주문" 시안 제안(design/proposals/my-orders.md, 호재 님 결정 대기), 한도 바꾸기 화면(`/dragon/limits`), 멈춘 주문 화면.
  - 보안 점검과 수정: 사용자별 레이트 리밋, production VERIFY_MODE=mock 거절(D-16 한 줄), Q-38 닫힘(운영은 장부 보류, 데모는 예전), 충전과 결제를 AgentLock 안에서, 웹과 API 보안 헤더 4종(CSP는 후속).
  - D-23 다듬기: 실제 모양 뼈대(실패 때 끝남), View Transitions, iOS 키보드, 누름 반응, dev 배지 숨김, 재시도 줄.
  - 흉내 체인이 API 재시작 뒤 DB에서 되살아남, 승인 주장 문장 거르기(과거형과 결과형만), 확인 카드 30일 숫자는 min(내 한도, 체인 상한).
  - 위키 정리(닫힌 질문 10개, worklog 19개 보관).
- 실수 기록: 7c1761c 이후 없음. 검증에서 FAIL은 모두 수정 커밋으로 고침(amend 없음). 승인 필터는 3차에서 PASS.
- 막힌 것: 운영자 잔액 약 1,691 tOKRW (가게 지갑 회수나 faucet 허락 필요), 남은 가게 19곳 등록, 실체인 화면 주문.
- 후속: 승인 필터 미탐 몇 개(놨, 넣었, 날렸, 보내졌, 끝!, OK), tech-spec 로그인과 월 예산 문구, KakaoVerify "구글로 가입했어도", CSP(nonce 미들웨어), AgentLock 상한 시간, 충전 보류 대사 절차, 에이전트 키 HKDF와 교체, 내 주문 페이지 구현(시안 결정 뒤), worklog 11개(다음 정리 때 보관).

### 2026-11-21 오후 (후속 큐)
- 한 일 (Sonnet 개발, Sonnet 검증 PASS 뒤 main push, 마지막 ace25d1):
  - 에이전트 키 HKDF v2와 마스터 키 교체(`pnpm agent-keys:rotate`). 재봉인 확인과 HKDF info 고정 테스트 보강, dry-run 문구 바로잡음.
  - QA 7 남은 것: 답 첫 이벤트에서 "보내는 중" 지움, 붙여 쓴 가게+메뉴 이름 매칭(어묵탕은 재현 못 함, 원인이 모델 입력일 수 있음).
  - 동작 줄이기가 `(root)` 화면 전환도 끈다(`!important`, 블록 맨 아래).
  - 충전 보류 대사 `pnpm topups:reconcile`. 1차 FAIL(덮어써지는 주문 표시로 짝지어 돈이 나간 보류를 풀 수 있었음) 뒤 보류 행에 order_id와 fund_call_started_at(0016)을 두고, 호출 시작 전 보류만 푼다.
  - nonce CSP를 `apps/web/proxy.ts`에서 요청마다. 1차 FAIL(루트 .env를 못 읽어 금고 출처가 어긋남) 뒤 기본값은 shared `config/pouchi.ts` 한 곳, next.config가 출처를 풀어 넘긴다.
- 실수 기록: 없음. dev 웹 서버가 next.config 바뀜을 shared dist 빌드보다 먼저 읽어 한 번 죽음(재시작으로 해결).
- 막힌 것: 운영자 잔액(가게 지갑 회수나 faucet 허락), 남은 가게 19곳 등록, 실체인 화면 주문, 내 주문 시안 결정.
- 후속: `markFundCallStarted` 변경 행 수 확인, CSP 금고 출처는 빌드 때 박힘(문서화), 승인 필터 미탐 몇 개, tech-spec 문구, worklog 정리.
