# 시켜용

AI 비서(알에 반쯤 걸쳐 앉은 아기 드래곤)가 배달을 대신 시켜 주는 앱. 결제는 카드번호 대신 한도가 걸린 원화 스테이블코인(OKRW)으로 하고, 한도와 신원 확인은 앱이 아니라 [마루](https://docs.maroo.io) 체인의 PCL이 지킨다.

마루 대표 레퍼런스 디앱(PCL + Agent)이다. 다른 개발자가 "에이전트 결제", "PCL 정책 묶음", "가맹점 결제 컨트랙트" 패턴을 가져다 쓰게 하는 것이 목표다.

## 상태
기획 완료, 구현 전 (2026-11-18). 1단계 목표는 2026-12-09 테스트넷 데모.

1단계의 정직한 한계: 운영자 계정이 모든 에이전트의 소유자다(MAWS 멀티테넌트 미확인). 30일 상한 장면은 주기를 줄인 데모 프로필로 보여 준다. 에이전트 지갑의 직접 송금은 체인이 막지 못하므로 지갑에는 소액 float만 둔다. 자세한 내용은 [docs/wiki/product/vision.md](docs/wiki/product/vision.md).

## 구조
```
apps/web        Next.js 사용자 웹 (페이지는 조립만)
apps/api        NestJS. 사용자 API, 판매자 API(2단계), 에이전트 런타임, 인덱서
apps/merchant   판매자 콘솔 (2단계, Next.js)
packages/ui     UI 컴포넌트. 컴포넌트마다 본체, 하네스(Storybook), 테스트
packages/shared 타입, zod 스키마, API 클라이언트, 체인 설정, 정책값, 에러 코드
design          시안 사본, 유저 플로우, 토큰
contracts       Foundry. SikyeoyongOrders (PCL 프록시 뒤)
infra           docker compose, Caddy, 배포 스크립트
seed            목 가게·메뉴 시드
docs            기획, 기술 기획, 위키
```

## 빠른 시작 (스캐폴딩 후 채울 자리표시)
```bash
pnpm install
cp .env.example .env        # 값 채우기 (비밀은 커밋 금지)
pnpm db:migrate && pnpm db:seed
pnpm contracts:build
pnpm dev                    # 서버 + 앱 웹
```
테스트넷 자금은 https://faucet.maroo.io, 탐색기는 https://explorer-testnet.maroo.io.

## 문서 지도
| 문서 | 내용 |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | 작업 진입점, 절대 규칙, 분업 가이드 |
| [docs/pitch.md](docs/pitch.md) | 한 장 요약 |
| [docs/plan.md](docs/plan.md) | 기획서 |
| [docs/tech-spec.md](docs/tech-spec.md) | 기술 기획 (API, 데이터, 컨트랙트, 인프라, 판매자 등록) |
| [docs/_research/decisions.md](docs/_research/decisions.md) | 결정 기록 (기준) |
| [docs/_research/maroo-facts.md](docs/_research/maroo-facts.md) | 마루 사실 확인 기록 |
| [docs/wiki/README.md](docs/wiki/README.md) | 컴포넌트 규칙 위키 (ROOT) |
