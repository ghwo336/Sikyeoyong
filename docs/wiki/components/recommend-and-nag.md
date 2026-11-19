---
node: leaf
parent: _index.md
children: []
---

# 추천과 잔소리 (apps/api/src/modules/recommend, budget)

## 책임
- 추천: 지금 시킬 만한 가게·메뉴 2~3개를 고른다.
- 잔소리: 개인 월 예산 대비 사용률로 경고 단계를 판정한다.
- 결과를 에이전트 런타임에 구조화된 데이터로 넘긴다 (말로 바꾸는 건 런타임).

## 책임 아님
- 주문을 막는 것 (잔소리는 막지 않는다. 막는 건 체인 정책)
- 대사 문장 (`product/mascot-and-voice.md` 규칙에 따라 런타임이 생성)

## 의존과 인터페이스 경계
- 누적 금액 출처: **체인에서 확정된 주문**. 개인 예산 사용액은 인덱서가 `OrderPlaced`/`Refunded` 이벤트로 확정한 `orders`(KST 달력 월, 상태 paid 이상) 합이다. 30일 상한 사용량은 `contractPeriodicVolume(proxy, agent, placeOrderSelector, "atokrw")` (확인된 조회 함수). 인덱서가 확정하지 않은 주문을 합산하지 않는다. DB와 체인이 다르면 체인이 맞다.
- 예산 기준: 개인 월 예산(서버 설정, 기본 300,000 OKRW)과 30일 상한(체인, 500,000 OKRW).
- 코드: `modules/budget/budget.service.ts`의 `BudgetService.getView(userId)`가 `BudgetView`(shared `zBudgetView`)를 만든다. 사용자 예산은 `UsersService`, 레벨·동결·지갑은 `AgentsService`, 이번 달 사용액은 `OrdersService.spentInMonthAokrw`, 30일 사용량은 `ChainReader`로만 받는다 (다른 모듈 저장소를 직접 읽지 않는다). 체인 읽기가 실패하면 숫자를 지어내지 않고 오류를 그대로 낸다.
- 추천 입력: 날씨, 시간대, 대략 위치(1단계는 고정 지역 또는 사용자 입력), 최근 주문, 선호 메모리, 남은 예산, 레벨 한도.

## 잔소리 규칙
| 단계 | 조건 | 행동 |
| --- | --- | --- |
| 없음 | 사용률 < 70% | 평소대로 |
| 1 | 70% 이상 | 걱정 표정, 한 줄 경고, 추천을 저렴한 쪽으로 |
| 2 | 90% 이상 | 경고 + 남은 금액 명시, 주문 전 한 번 더 확인 |
| 3 | 100% 이상 | 예산 초과 안내. 주문은 사용자가 원하면 진행 (30일 상한 전까지) |
| 체인 상한 | 30일 상한 도달 | 체인이 거절. `resetAt` 안내 |
기준값(70/90/100)은 `packages/shared/src/config/policy.ts`의 `nagThresholdsBps`(bps, [7000, 9000, 10000])이고 판정은 `nagStage`다. 소수를 쓰지 않는다.

## 반드시 지킬 규칙 (MUST)
- "이번 달"의 정의를 화면에 밝힌다: 개인 예산은 달력 월(Asia/Seoul), 체인 상한은 30일 고정 주기. 둘이 다르다는 걸 사용자가 헷갈리지 않게 표시한다.
- 추천 목록에는 체인에 등록된 가게만, 그리고 현재 레벨 한도 안 메뉴를 우선한다. 한도를 넘는 메뉴는 "주인 승인 필요" 표시와 함께만.
- 잔소리 톤은 걱정이다. 비난, 비꼼 금지.
- 같은 단계 잔소리는 한 달에 한 번 (`nag_events` 유니크). 예외: `over100` 이후 주문 직전 확인 카드에는 짧게 붙인다 (tech-spec "3.7 잔소리 계산").
- 잔소리 문구의 숫자는 템플릿과 변수로 만든다. LLM이 숫자를 지어내게 하지 않는다.
- 추천 점수는 서버가 결정적으로 계산하고 LLM은 설명만 한다 (tech-spec "3.8 추천 로직"). 데모는 `WEATHER_PROVIDER=static`으로 재현성을 확보한다.

## 하지 말 것 (MUST NOT)
- 잔소리로 주문을 막지 않는다 (막는 건 체인, 이게 데모의 구분).
- 서버 DB 합계만으로 예산을 판정하지 않는다.
- 위치를 정밀하게 저장하지 않는다 (동 단위 이하).

## 확장 지점
- k-skill `korea-weather`, `kakao-map`을 추천 입력 어댑터로 (`ContextProvider` 인터페이스).
- 2단계 푸시 알림 잔소리.

## 테스트 기준
- 경계값: 69.9%, 70%, 90%, 100%.
- 환불이 누적에서 빠진다.
- 달력 월 경계(말일, 1일)와 30일 주기 경계에서 표시가 맞다.

## 열린 질문
- 1단계 위치 입력 방식 (고정 지역 vs 사용자 입력)

## 관련 문서
- `agent-runtime.md`, `chain-and-pcl.md`, `product/scenarios.md` 장면 3, 5
- `docs/tech-spec.md` "3.7 잔소리 계산 (budget 모듈)", "3.8 추천 로직 (recommend 모듈)"
