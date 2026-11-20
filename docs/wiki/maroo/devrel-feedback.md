---
node: leaf
parent: _index.md
children: []
---

# 마루 문서·도구 피드백 기록

시켜용을 만들면서 막힌 곳, 문서가 비거나 틀린 곳을 기록한다. 이 기록은 호재 님의 데브렐 업무(Builder Resources 검수, KB 개선, 제품팀 피드백)로 이어진다. 해결되면 지우지 말고 상태를 바꾼다.

## 양식
```
### F-NN 한 줄 요약
- 상태: 열림 / 전달함 / 해결
- 종류: 문서 누락 / 문서 불일치 / 도구 버그 / 기능 요청
- 발견: 날짜, 누가, 어디서 (문서 경로, 명령, 트랜잭션)
- 영향: 시켜용에서 무엇이 막혔나
- 제안: 무엇을 고치면 되나
- 전달: 누구에게, 언제 (호재 님 경유)
```

## 기록

### F-01 MAWS가 컨트랙트 함수를 호출할 수 있는지 문서에 없음
- 상태: 열림
- 종류: 문서 누락 (기능 요청 가능성)
- 발견: 2026-11-18 기획 세션. `/apis/maws`, `/concepts/agents/maws-architecture-overview`, `/concepts/agents/agent-policy-semantics` 어디에도 calldata 지원 언급 없음. `transfer.send`는 주소로 OKRW 송금만 설명.
- 영향: 결제 경로 A/B/C 결정이 막힘 (decisions D-05). 에이전트가 dApp 컨트랙트를 쓰는 대부분의 사용 사례가 여기에 걸림.
- 제안: 지원하면 문서화와 예제, 안 하면 로드맵 공유.

### F-02 MAWS 멀티테넌트(서버 하나로 여러 사용자) 방법 문서에 없음
- 상태: 열림
- 종류: 문서 누락
- 발견: 2026-11-18. `/guides/agents/guide-authenticating-maws`는 1인 로그인과 `~/.maroo/credentials.json`만 설명.
- 영향: 사용자마다 자기 소유자 계정을 갖는 앱 구조를 못 정함 (D-11 #2).
- 제안: 앱 백엔드에서 사용자별 WaaS 계정을 다루는 방법 가이드.

### F-03 MAWS 규칙의 온체인 강제 여부가 페이지마다 다름
- 상태: 열림
- 종류: 문서 불일치
- 발견: 2026-11-18. `agent-policy-semantics`는 "오프체인 검사를 우회해도 합의 단계에서 차단"이라고 쓰고, `two-layer-policy-model`과 `/concepts/agents`는 `spendingLimit`, `allowedTargets`, `status`를 체인이 읽지 않는다고 씀.
- 영향: 개발자가 MAWS 한도를 체인 보호로 오해할 수 있음 (보안 문제).
- 제안: agent-policy-semantics 문장 수정. "체인이 강제하는 것은 TransferLimit(정책이 걸린 경우)과 PCL 정책뿐" 명시.

### F-04 테스트넷 전역 정책이 TransferLimit를 검사하지 않음 (눈에 잘 안 띔)
- 상태: 열림
- 종류: 문서 보강
- 발견: 2026-11-18. `maws-architecture-overview` 제약 항목에만 있음. 에이전트 개념 페이지는 "PCL이 TransferLimit을 읽어 강제"라고만 써서 테스트넷에서 자동으로 걸린다고 오해하기 쉬움.
- 영향: 에이전트 한도를 체인 보호로 믿고 만든 앱이 테스트넷에서 실제로는 보호받지 못함.
- 제안: 에이전트 개념 페이지와 TransferLimit 템플릿 페이지에 "테스트넷 전역 정책 미포함, 컨트랙트 범위로 걸어야 함" 명시와 예제.

### F-05 `changeContractPolicies` 인자와 셀렉터별 정책 지정 예제 부족
- 상태: 열림
- 종류: 문서 누락
- 발견: 2026-11-18. `pcl-policy-admin`, `pcl-proxy-hook`에 함수 이름만 있고 인자, 권한, 셀렉터 지정, 재배포 없이 변경 가능 여부가 없음. `pcl-contract-admin-binding` 페이지는 아직 확인 전.
- 영향: 정책 적용 스크립트(`pnpm policy:apply`) 설계가 막힘.
- 제안: 컨트랙트 범위 정책 적용 end to end 예제 (배포, 함수별 정책, 변경).

### F-06 테스트넷에서 PAYMASTER 가스 모드 동작 여부 문서에 없음
- 상태: 열림
- 종류: 문서 누락
- 발견: 2026-11-18. `gas-source-modes`에 테스트넷 언급 없음.
- 영향: 경로 A에서 에이전트 지갑에 float만 두고 가스를 따로 대 줄 수 있는지 모름 (D-06).
- 제안: 네트워크별 지원 표.

### F-07 "멤풀 전에 막는다"는 소개 문구가 컨트랙트 범위 정책에는 맞지 않음
- 상태: 열림
- 종류: 문서 불일치
- 발견: 2026-11-18 기술 기획 조사. 마루 소개(overview, 용어집, 마케팅 문구)는 "위반 트랜잭션은 멤풀 전에 차단"이라고 쓴다. 그런데 `pcl-policy-enforcement`에 따르면 그건 전역 정책(제출 시점 거절)뿐이고, 컨트랙트 범위 정책은 실행 중 평가되어 revert되며 트랜잭션이 블록에 남고 가스가 과금된다.
- 영향: dApp 개발자가 자기 컨트랙트 정책도 가스 없이 막힌다고 오해한다. 시켜용도 처음 기획서와 한 장 요약에 "멤풀 전"이라고 잘못 썼다.
- 제안: 소개 문구에 "전역 정책은 제출 단계, 컨트랙트 정책은 실행 단계" 구분을 넣고, 정책 템플릿 페이지마다 평가 시점을 표시.

### F-08 컨트랙트 범위 TransferLimit와 선불(escrow, vault) 패턴의 관계가 문서에 없음
- 상태: 열림
- 종류: 문서 누락
- 발견: 2026-11-18. `pcl-template-agent-okrw-transfer-limit-policy`는 컨트랙트 범위에서 직접 sender 귀속만 하고 실행 전 call value를 검사한다고만 쓴다. 컨트랙트가 보관한 돈을 내보낼 때(에이전트가 value 0으로 호출) 에이전트 한도로 집계되는지 설명이 없다.
- 영향: 에이전트 용돈을 컨트랙트에 맡기는 흔한 설계에서 한도가 걸리는지 모른다. 시켜용은 모드 P로 바꿨다 (D-06, 스파이크 S10).
- 제안: 템플릿 페이지에 "에스크로 패턴에서의 귀속" 예제 추가.

### F-09 컨트랙트 정책 admin이 첫 호출자로 한 번만 정해진다는 경고가 배포 가이드에 없음
- 상태: 열림
- 종류: 문서 보강
- 발견: 2026-11-18. `pcl-contract-admin-binding`에만 있고, 프록시 배포(`pcl-proxy-hook`)와 고급 가이드(`managing-contract-policies`)에는 배포 직후 바로 바인딩해야 한다는 경고와 `deployPclProxy` 절차가 없다.
- 영향: 프록시를 배포하고 정책 바인딩을 미루면 남이 먼저 admin을 잡을 수 있다 (추론).
- 제안: 배포 가이드에 "배포와 첫 `changeContractPolicies`를 한 스크립트에서" 경고, `deployPclProxy` 인자와 초기화 예제.

### F-10 PolicySet, LogicalPolicy 등의 Solidity 타입과 빈 struct 인코딩 예제가 없음
- 상태: 열림
- 종류: 문서 누락
- 발견: 2026-11-18. `pcl-policy-structure`와 가이드 예시만으로는 `selector`가 `bytes4`인지 `bytes`인지, enum 숫자값, `AGENT_OKRW_TRANSFER_LIMIT_POLICY`의 필드 없는 struct 인코딩을 알 수 없다 (tech-spec "5.6").
- 영향: viem으로 정책을 인코딩하는 스크립트를 문서만으로 못 쓴다.
- 제안: TypeScript(viem) 인코딩 예제와 `IPcl.sol` 링크.

### F-13 MAWS MCP `transfer.send`로 컨트랙트 함수를 부를 수 없음 (calldata 칸 없음)
- 상태: 열림
- 종류: 기능 부족, 문서 누락
- 발견: 2026-11-20. m-aws MCP 도구 스키마에서 `transfer.send` 입력이 `agentId`, `to`, `amount`, `clientToken`뿐임을 확인했다. 에이전트가 결제 컨트랙트(`placeOrder`)처럼 함수를 부르는 방법이 MCP에도 문서에도 없다.
- 영향: 에이전트 결제 디앱이 MAWS AA 지갑과 페이마스터를 쓰지 못하고 서버가 키를 직접 보관하는 경로(B)로 간다 (D-24). 키 보관 부담과 위험이 디앱으로 넘어온다.
- 제안: `transfer.send`에 `data`(calldata) 칸, 또는 `contract.call` 도구. 허용 대상과 함수 셀렉터를 정책으로 묶는 방법도 함께.

### F-14 MAWS 정책을 누가 강제하는지 문서와 도구 설명이 다르게 읽힘
- 상태: 열림
- 종류: 문서 불일치
- 발견: 2026-11-20. `transfer.send` 도구 설명은 "m-aws MCP 서버가 정책을 검사하고 WaaS는 강제하지 않는다"고 쓴다. agent-policy-semantics는 "오프체인 검사를 우회해도 합의 단계에서 차단"이라고 쓴다 (maroo-facts 1의 문서 불일치 행과 같은 주제).
- 영향: 디앱이 "MAWS 한도가 지켜 준다"고 과장할 위험. 시켜용은 컨트랙트 범위 PCL 기준으로만 말한다.
- 제안: 정책 강제 위치(MCP 서버, WaaS, 체인)를 표 하나로 정리.
