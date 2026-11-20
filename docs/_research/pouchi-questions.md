# 파우치(Pouchi) 문의 모음 (S14, 2026-11-20)

문서(`https://pouchi.io/llms-full.txt` 전문, `auth.pouchi.io/downloads/README.html`, manifest, `@nc-waas/sdk` beta.8 타입 선언)로 먼저 풀어 보고, 그래도 안 풀린 것만 둔다. S14 실행으로 풀리면 지운다. S14가 끝나면 한 메시지로 정리해 호재 님께 드린다 (수현 님께 한 번에 전달).

## 1. 서버 대리인(앱 서버를 대리인으로 하는 위임)을 만드는 함수와 `@nc-waas/tenant-server-sdk`는 언제 공개되나
- 찾아본 곳: delegation "대리인 종류" 표("`executeDelegatedPolicy` (사용 가능), 위임 만들기 함수는 준비 중"), 같은 문서 하단("`@nc-waas/tenant-server-sdk` 패키지 배포는 준비 중입니다. 지금은 nc-waas 저장소의 `packages/tenant-server-sdk`에 있습니다", "앱 서버를 대리인으로 하는 위임을 만들고 앱 연결 토큰을 받는 서버 SDK 함수는 준비 중입니다"), 에이전트 절("새 서버 위임을 만드는 앱 운영자 SDK 함수는 별도로 준비 중"). 모두 "준비 중"이고 일정이 없다. beta.8 웹 SDK에는 소유자가 위임을 승인하는 쪽(`approveDelegatedApprovalReview`)만 있다.
- 시켜용에서 바뀌는 것: 이 경로가 열리면 결제를 서버 에이전트 키(경로 B, 수탁) 대신 사용자 파우치 지갑의 위임으로 옮길 수 있다. 확인 버튼 뒤 서버가 결제하는 지금 구조와 `requestId` 멱등이 그대로 맞는다. D-25(경로 B)를 다시 정하고, `agent_keys` 보관이 필요 없어진다. 일정이 멀면 경로 B를 유지하고 소유자 일만 파우치로 옮긴다.

## 2. 사용자의 온체인 위임 회수는 언제 되나
- 찾아본 곳: delegation("사용자가 위임을 회수하는 기능은 준비 중이에요. 회수를 전제로 한 서비스 적용은 아직 진행하지 마세요."), FAQ "해지와 중지 시점"(`revoke_mandate`는 게이트웨이 중지이고 온체인 회수가 아님), browser-sdk("위임 회수는 준비 중"). 일정이 없다.
- 시켜용에서 바뀌는 것: 회수가 없으면 위임 결제에서 키가 새면 남은 한도와 기간만큼 잃는다. 그래서 위임으로 옮겨도 킬 스위치는 `SikyeoyongOrders.setAgentPaused`를 유지하고, 위임 한도와 기간을 작게 잡아야 한다. 회수가 생기면 멈춤 화면(Frozen)의 "용이 멈추기"가 위임 회수까지 하도록 바꾼다.

## 3. 세션 키(`useSessionApproval`)와 소셜 로그인(카카오)이 현재 Browser SDK(`@nc-waas/sdk`)에도 들어오나
- 찾아본 곳: sdk.md("새 웹 연동은 현재 Browser SDK와 앱 서버로 시작하세요", React/Provider는 "호환 자료"), README("앱에서 연 금고는 이메일과 패스키만 제공해요. 소셜 로그인은 없어요."), reference/react(`useSessionApproval`, `useLoginWithOAuth`의 google, apple, kakao, naver는 React SDK `@shard-lab/nc-waas-react`에만 있음), beta.8 타입 선언(세션 키 없음). 계획이 문서에 없다.
- 시켜용에서 바뀌는 것: 카카오가 들어오면 D-24의 "카카오 로그인으로 만든 파우치 지갑"이 그대로 되어, 시켜용 로그인과 지갑 로그인이 하나가 된다. 안 들어오면 사용자는 시켜용(카카오)과 파우치 금고(이메일, 패스키)에 따로 로그인한다. 세션 키가 들어와도 탭 안, 최대 24시간이라 결제에는 쓰지 않고, 반복 소액 동작에만 검토한다.

## 4. 파우치 지갑으로 부른 컨트랙트 호출에서 체인의 sender(`msg.sender`)는 사용자 스마트 지갑(WaaSWallet) 주소인가 (S14에서 직접 확인되면 지움)
- 찾아본 곳: reference/react("The Pouchi wallet is itself an ERC-4337 smart wallet"), sdk/embedded-start(영수증에서 EntryPoint, `UserOperationEvent`, `OwnerCallExecuted` 대조), FAQ(ERC-4337 paymaster). 지갑이 4337 지갑이라는 것은 확인되지만, 대상 컨트랙트가 보는 `msg.sender`가 무엇인지는 직접 쓰여 있지 않다.
- 시켜용에서 바뀌는 것: 마루 컨트랙트 범위 정책(TransferLimit, 30일 상한)은 직접 sender에 걸린다. sender가 사용자 지갑이면 파우치 지갑으로 결제할 때 정책이 사용자 지갑에 걸리고, 8004 에이전트 신분증을 어디에 붙일지(S14 4번)가 정해진다. 결제 경로 판단(D-25)의 전제다.

## 5. 서버의 소유자 서명 요청(`createOwnerSigningRequest`)으로 마루 시스템 컨트랙트나 프리컴파일(8004 IdentityRegistry, PCL 한도 기록)을 부를 수 있나
- 찾아본 곳: beta.8 타입 선언 `CreateOwnerSigningRequest`(`to`, `value`, `data`, `abiFragment`, `requireAuth`)는 임의 호출 모양이다. reference/react는 로그인한 사용자가 직접 제안하는 호출이 테넌트 `userCallPolicy`(기본은 등록한 컨트랙트만)로 제한된다고 쓴다. delegation은 위임 한도의 대상을 "컨트랙트 주소(코드 해시 포함)"로 적는다. 서버 소유자 요청에도 같은 등록 제한이 걸리는지, 코드가 없는 프리컴파일 주소를 등록하거나 부를 수 있는지는 문서에 없다.
- 시켜용에서 바뀌는 것: 된다면 D-24의 `PouchOwner`를 지금 만들 수 있다. 소유자 일(TransferLimit 기록, `bindAgent`, `setAgentPaused`, 충전)을 사용자 파우치 지갑 서명으로 하고, 경로 B의 에이전트 지갑은 그대로 둔다 (수탁은 에이전트 키 하나로 줄어든다). 안 된다면 소유자 일이 들어 있는 시켜용 컨트랙트 함수만 파우치로 부르고, 마루 시스템 쪽 소유자 일은 운영자가 계속 한다.
