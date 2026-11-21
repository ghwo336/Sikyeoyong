---
node: leaf
parent: _index.md
children: []
---

# 인프라 (infra/)

## 책임
- VM 1대(개인 서버로 시작, 공개 전 회사 서버로 이전)에서 docker compose로 운영: `web`(Next.js, `next start`), `api`(NestJS, SQLite 파일 볼륨), `maws-mcp`, `caddy`(TLS, `/api`는 api로, 나머지는 web으로).
- 비밀 관리, 배포, 백업, 모니터링 최소한.

## 책임 아님
- 체인 노드 운영 (공개 RPC 사용)
- iOS 배포 (1단계 없음, Q-20)

## 의존과 인터페이스 경계
- 환경변수 이름 목록은 `.env.example`이 기준. 다른 컴포넌트는 이 이름만 쓴다. 상세와 `.env.example` 전문은 tech-spec "8.3 환경 변수".
- `OWNER_MODE=custodial|pouch` (D-24): 지금은 custodial. pouch는 파우치 SDK가 나온 뒤에만 켠다.
- MAWS MCP 서버는 `WAAS_AUTH_TOKEN`으로 대화형 로그인 없이 컨테이너에서 실행 (확인, 가이드 있음). 서버는 내부 네트워크로만 접근.

## 반드시 지킬 규칙 (MUST)
- 비밀(`WAAS_AUTH_TOKEN`, Anthropic 키, OAuth 시크릿, 경로 B 에이전트 키 암호화 키, 운영자 키)은 VM의 `.env`(권한 600) 또는 비밀 관리자에만. 저장소, 이미지, 로그에 넣지 않는다.
- `maws-mcp`와 DB는 외부 포트를 열지 않는다. 외부에는 Caddy 443만.
- API는 `X-Forwarded-For`를 loopback과 사설 망(Caddy 컨테이너)에서 온 것만 믿는다 (`app.setup.ts` trust proxy, IP당 제한 tech-spec 9.5). Caddy를 다른 망으로 옮기면 이 값을 함께 고친다.
- SQLite 파일은 볼륨에 두고 하루 1회 이상 백업 (백업 파일도 VM 밖으로).
- 배포는 스크립트 하나(`infra/deploy.sh`)로 재현 가능해야 한다. 손으로 고친 설정을 남기지 않는다.
- 헬스 체크 엔드포인트와 컨테이너 재시작 정책.
- 서버 이전(개인 → 회사)은 `.env`, SQLite 백업, 도메인만 옮기면 되게 유지한다.

## 하지 말 것 (MUST NOT)
- `~/.maroo/credentials.json`을 이미지에 굽지 않는다.
- 운영자 키(`OPERATOR_KEY`)를 필요 이상으로 쓰지 않는다. 1단계는 서버가 운영자 키로 소유자 역할(TransferLimit 기록, `bindAgent`, `setAgentPaused`)과 가게 활성화를 하므로 서버 환경에 둔다 (tech-spec "9.6 운영자 키 권한 분리"). 그 대신 운영자 키로 사용자 돈을 움직이는 함수는 컨트랙트에 없다. 2단계에 KMS와 정책 admin 멀티시그로 옮긴다.
- 테스트넷 데모 서버를 메인넷 설정으로 돌리지 않는다.

## 데모 리허설 (`pnpm demo:rehearse`)
- 주인이 직접 돌리는 스크립트(`infra/scripts/demo-rehearse.ts`, 부품은 `infra/src/rehearsal/`). 자기 api와 web을 따로 띄운다: 빈 포트, 임시 SQLite, `PAYMENT_PATH=mock`, `DEMO_MODE=true`, `POLICY_PROFILE=demo`, `LLM_MODE=replay`(D-26, 비용 없음), `DEV_LOGIN=true`, 날씨 `비`, http. 개발자의 `.env` 비밀과 체인 설정은 빈 값으로 덮어 쓰고, 3000번과 돌고 있는 dev 서버는 건드리지 않는다(web은 `NEXT_DIST_DIR=.next-rehearsal`로 잠금 파일을 따로 쓴다). 끝나면 자식 프로세스를 모두 내린다(오류, Ctrl+C 포함).
- 시스템 Chrome을 `puppeteer-core`(infra devDependency, 정확한 버전)로 390x844 모바일 화면에 띄워 장면을 user-flow 순서로 돈다: 1 시작에서 부화, 2 정상 주문과 기다림(6 to 10, 목 배달 3분), 3 한도 초과와 말로 올리기(12 to 13), 4 30일 한도(14), 5 키 유출 비교(`/demo/leak`, web은 `NEXT_PUBLIC_DEMO_MODE=true`로 띄우고 정확한 문장을 확인), 6 멈추고 돌려받기(17, 데모 목 체인이 경로 B처럼 가스 몫을 주머니에 남겨 돌려받기가 보인다), 7 영수증 자세히 보기(11, 서버가 쓴 영수증의 흉내 체인 규칙 2개). api는 `apps/api/dist-rehearsal`에 따로 빌드해 개발 서버의 dist를 건드리지 않고, Chrome 경로는 `CHROME_PATH`로 바꾼다. 장면은 `scenes.ts`의 데이터이고 `run.ts`가 한 단계씩 실행한다. 화면 문구, 블록체인 말(자세히 보기 밖), 콘솔 오류를 검사하고 스크린샷을 `infra/rehearsal-out/`(git 밖)에 둔다. 통과표를 찍고 실패가 있으면 종료 코드 1.
- 용이의 말은 `llm/harness/demo-turns.ts`의 손으로 쓴 턴이다(돼지국밥, 보쌈, "5만 원까지 올려 줘"). 도구는 진짜라 카드와 숫자는 실제다.
- 알려 둔 것: 목 부화가 너무 빨라 예산 화면(5)을 거치지 않고 바로 대화로 간다(부화를 본 사람만 예산 단계를 받는다). 그래서 체험 용돈은 시나리오가 `POST /signup/trial`로 대신 받는다.

## 확장 지점
- Postgres 컨테이너 추가, 이벤트 인덱서 분리.
- 경로 B 키를 클라우드 KMS로 (회사 서버 이전 시).

## 테스트 기준
- 새 VM에서 `deploy.sh`로 처음부터 올라온다.
- 백업 복원 리허설 1회.
- 외부 포트 스캔 결과 443만 열림.

## 열린 질문
- 개인 서버 vs 회사 서버, 공개 시점 (재욱 님)
- 웹 호스팅: 같은 VM의 `web` 컨테이너 (기본). Vercel은 쿠키 도메인 문제로 쓰지 않는다 (추론)
- D-11 #2 멀티테넌트에 따라 MAWS 컨테이너가 사용자별로 필요한지

## 관련 문서
- `docs/tech-spec.md` "8. 인프라"
- `security.md`, `auth.md`
