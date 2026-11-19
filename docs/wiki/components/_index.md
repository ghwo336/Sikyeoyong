---
node: internal
parent: ../README.md
children:
  - web.md
  - ui/_index.md
  - auth.md
  - server-api.md
  - agent-runtime.md
  - payment.md
  - chain-and-pcl.md
  - contracts.md
  - merchants.md
  - recommend-and-nag.md
  - data.md
  - infra.md
  - security.md
---

# 컴포넌트

모든 컴포넌트 문서는 아래 양식을 그대로 쓴다. 칸이 비면 "없음"이라고 쓴다.

```
## 책임
## 책임 아님
## 의존과 인터페이스 경계
## 반드시 지킬 규칙 (MUST)
## 하지 말 것 (MUST NOT)
## 확장 지점
## 테스트 기준
## 열린 질문
## 관련 문서
```

| 자식 | 요약 |
| --- | --- |
| [web.md](web.md) | Next.js 웹. 페이지는 조립만, 금액·체인·키 코드 없음 |
| [ui/_index.md](ui/_index.md) | UI 컴포넌트 35개(packages/ui). 컴포넌트마다 책임, props, 하네스 상태, 테스트 기준 |
| [auth.md](auth.md) | 카카오·구글(1단계), 애플(iOS). 서버 세션 발급, 웹 쿠키·네이티브 secure-store |
| [server-api.md](server-api.md) | NestJS API 규약: 모듈 구조, 라우트 규약(`/api`, `/api/admin`), zod, 에러 형식(`AppErrorCode`), 결제는 확인 엔드포인트에서만, 권한(user, merchant, operator) |
| [agent-runtime.md](agent-runtime.md) | LLM 도구 화이트리스트, 프롬프트 인젝션 방어, 승인 흐름, 대화 메모리 |
| [payment.md](payment.md) | PaymentProvider, 경로 A/B/C, 모드 P(float, 즉시 충전), orderRef 멱등성, 자동 재시도 금지, 에러 정규화 |
| [chain-and-pcl.md](chain-and-pcl.md) | 체인 설정 분리, 정책 평가 시점(제출 vs 실행), `placeOrder` LOGICAL And 정책, admin 바인딩, revert 매핑, 정책 변경 절차 |
| [contracts.md](contracts.md) | SikyeoyongOrders 함수(D-08), 모드 P/V, 불변식, 재진입, 이벤트, 업그레이드, 배포 순서 |
| [merchants.md](merchants.md) | 목 가게 시드 규칙, 실제 가게 등록(2단계), KYB, 판매자 API 권한 |
| [recommend-and-nag.md](recommend-and-nag.md) | 추천 입력·규칙, 잔소리 70/90/100(단계당 한 달 1번), 데이터 출처는 체인에서 확정된 주문 |
| [data.md](data.md) | Drizzle 규약, 마이그레이션, 금액 문자열 저장, UTC, 삭제 정책 |
| [infra.md](infra.md) | docker compose, 비밀, MAWS 컨테이너, 배포, 백업, 서버 이전 |
| [security.md](security.md) | 위협 모델 요약과 출시 전 체크리스트 |
