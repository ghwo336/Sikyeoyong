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
- MAWS MCP 서버는 `WAAS_AUTH_TOKEN`으로 대화형 로그인 없이 컨테이너에서 실행 (확인, 가이드 있음). 서버는 내부 네트워크로만 접근.

## 반드시 지킬 규칙 (MUST)
- 비밀(`WAAS_AUTH_TOKEN`, Anthropic 키, OAuth 시크릿, 경로 B 에이전트 키 암호화 키, 운영자 키)은 VM의 `.env`(권한 600) 또는 비밀 관리자에만. 저장소, 이미지, 로그에 넣지 않는다.
- `maws-mcp`와 DB는 외부 포트를 열지 않는다. 외부에는 Caddy 443만.
- SQLite 파일은 볼륨에 두고 하루 1회 이상 백업 (백업 파일도 VM 밖으로).
- 배포는 스크립트 하나(`infra/deploy.sh`)로 재현 가능해야 한다. 손으로 고친 설정을 남기지 않는다.
- 헬스 체크 엔드포인트와 컨테이너 재시작 정책.
- 서버 이전(개인 → 회사)은 `.env`, SQLite 백업, 도메인만 옮기면 되게 유지한다.

## 하지 말 것 (MUST NOT)
- `~/.maroo/credentials.json`을 이미지에 굽지 않는다.
- 운영자 키(`OPERATOR_KEY`)를 필요 이상으로 쓰지 않는다. 1단계는 서버가 운영자 키로 소유자 역할(TransferLimit 기록, `bindAgent`, `setAgentPaused`)과 가게 활성화를 하므로 서버 환경에 둔다 (tech-spec "9.6 운영자 키 권한 분리"). 그 대신 운영자 키로 사용자 돈을 움직이는 함수는 컨트랙트에 없다. 2단계에 KMS와 정책 admin 멀티시그로 옮긴다.
- 테스트넷 데모 서버를 메인넷 설정으로 돌리지 않는다.

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
