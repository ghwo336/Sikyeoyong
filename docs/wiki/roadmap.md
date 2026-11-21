---
node: leaf
parent: README.md
children: []
---

# 로드맵

기준: `docs/_research/decisions.md` D-10. 날짜가 바뀌면 decisions.md부터 고친다.

## 1단계: 2026-12-09 테스트넷 데모

### 1주차 (11/18 ~ 11/23): 선행 확인과 뼈대
| 할 일 | 완료 기준 |
| --- | --- |
| 결제 경로 결정 (D-05 A/B/C) | MAWS가 컨트랙트 함수 호출을 지원하는지 답을 받고, 쓸 경로를 decisions.md에 기록 |
| 멀티테넌트 확인 (D-11 #2) | 안 되면 "운영자 계정 하나가 에이전트 소유" 방식을 decisions.md에 기록 |
| 1주차 검증 스파이크 | tech-spec "11. 1주차 검증 스파이크" 우선순위대로 S1 → S11 → S10 → S4 → S7 → S3 → S5 → S2 → S6 → S12. 결과는 `docs/_research/spikes/S<번호>.md`에 기록하고 decisions.md 갱신 |
| 테스트넷 정책 실험 | 테스트 컨트랙트에 `LOGICAL_POLICY`(And: `AGENT_OKRW_TRANSFER_LIMIT_POLICY` + `PERIODIC_VOLUME_POLICY`)를 걸고 초과 시 revert, 가스 과금, 블록 포함을 탐색기에서 확인 |
| 결제 모드 확정 | S10 결과로 모드 P(기본) 유지 또는 모드 V 채택을 decisions.md에 기록 |
| 모노레포 스캐폴딩 | `pnpm dev`로 빈 서버와 빈 앱(웹)이 뜸, CLAUDE.md 명령어 이름대로 |
| MAWS 컨테이너 | 서버 VM에서 MAWS MCP가 뜨고 `agent.list`가 응답 |
| 목 가게 시드 | `seed/merchants.json` 8곳(7 인증, 1 미인증), `pnpm db:seed` 동작 |

**게이트**: S1, S10, S11 결과와 테스트넷 정책 실험이 나오면 결제 경로와 컨트랙트 모드를 확정한다. 정책 실험이 실패하면(체인이 안 막음) 앱 작업 전에 방향을 다시 정한다.

### 2주차 (11/24 ~ 11/30): 컨트랙트와 백엔드
| 할 일 | 완료 기준 |
| --- | --- |
| `SikyeoyongOrders` + 테스트 | `forge test` 통과, 불변식 테스트 포함 (`components/contracts.md`) |
| PCL 프록시 배포 + 정책 적용 | 배포 스크립트가 프록시 배포 직후 운영자 키로 첫 `changeContractPolicies` 호출(admin 확보). 운영 프로필과 데모 프로필(D-12) 두 프록시. `pnpm policy:apply` 후 `contractPolicies` 조회 결과가 policy.ts와 같음 |
| 결제 어댑터 | 선택한 경로로 `placeOrder{value}` 성공, 주문 직전 즉시 충전(float 상한 이내), 한도 초과 시 정규화된 에러 코드 |
| 에이전트 런타임 | 도구 화이트리스트, 승인 요청 흐름, 추천 동작 |
| 잔소리 | 70/90/100% 판정이 인덱서가 확정한 주문 기준으로 맞음 |
| API | 장면 2~6이 API 호출만으로 재현 |

### 3~4주차 (12/1 ~ 12/9): 앱과 리허설
| 할 일 | 완료 기준 |
| --- | --- |
| Next.js 웹 + packages/ui (하네스) | 파우치 로그인(D-29), 대화, 주문, 잔소리, 한도·승인·동결 화면 |
| 영수증 "마루 규칙 N개 통과" | 정상 주문마다 통과한 규칙 목록이 보임 |
| 키 유출 비교 화면 | 장면 7 재현 |
| README, 데모 스크립트 | 다른 사람이 받아서 실행 가능 |
| `pnpm demo:rehearse` | 장면 1~8 자동 리허설 통과 |

**대안**: 앱이 밀리면 12/9 점검은 같은 백엔드를 쓰는 웹 데모로 하고 앱은 다음 달로 넘긴다.

## 2단계
- 판매자 콘솔 (`apps/merchant`), 실제 가게 등록 흐름 (국세청 사업자 확인, 운영자 검토, EAS KYB)
- iOS 출시: 회사 조직 계정, 애플 로그인 추가, 푸시 알림
- VP로 배달 내역 비공개 (금액·가게는 감사자만)
- k-skill 연동과 PR, 다른 심부름 플러그인 (버스 예매 등)
- 마스코트 본 디자인
