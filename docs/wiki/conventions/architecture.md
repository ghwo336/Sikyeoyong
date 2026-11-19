---
node: leaf
parent: _index.md
children: []
---

# 구조와 단일 책임 (프론트, 백엔드 공통)

결정은 D-03, D-04, D-18. 이 문서는 "어디에 무엇을 두는가"의 규칙이다. 애매하면 이 문서가 기준이다.

## 큰 그림

```
브라우저
  │
apps/web (Next.js)          화면만. 페이지는 조립, 데이터는 훅
  │  import                   │ fetch /api (같은 도메인, 쿠키 세션)
packages/ui                  │
  (컴포넌트 + 하네스)          ▼
packages/shared  ◀────── apps/api (NestJS)    돈, 체인, AI, 세션, 주기 작업
  (zod 스키마, 타입,             ├── SQLite (Drizzle)
   API 클라이언트, 설정)          ├── Claude API
                                 ├── MAWS MCP
                                 └── 마루 체인 (viem)
```

의존 방향은 한쪽뿐이다: `apps/*` → `packages/ui` → `packages/shared`. `packages/shared`는 아무것도 import하지 않는다(외부 라이브러리 zod, viem 타입 제외). `packages/ui`는 `apps/*`를 모른다.

## 웹 (apps/web)

### 폴더
```
apps/web/
├── app/                      라우트. page.tsx, layout.tsx, loading.tsx, error.tsx, 루트의 globals.css(페이지 전체 기본값, 토큰 변수만)만
│   ├── (onboarding)/start, verify, name, hatch, budget
│   ├── (main)/page.tsx        대화(홈)
│   ├── orders/[id]/page.tsx   조리 중, 배달 중, 도착 (상태별 조립)
│   ├── orders/[id]/receipt/page.tsx
│   └── dragon/page.tsx, dragon/id/page.tsx
├── features/<기능>/          기능별 데이터 훅과 화면 조합용 컨테이너
│   ├── hooks/                useOrder, useConfirmOrder (TanStack Query)
│   └── containers/           훅 결과를 ui 컴포넌트 props로 바꿔 넘기는 얇은 층
└── lib/                      api 클라이언트 생성, 쿼리 클라이언트, 환경 설정
```

### 규칙 (MUST)
- **페이지는 조립만:** `page.tsx`에는 레이아웃 배치, 컨테이너 호출, 라우트 파라미터 전달만 둔다. 스타일, `useState`, `fetch`, 금액 계산, 조건이 많은 분기를 두지 않는다. 기준: page.tsx가 60줄을 넘으면 쪼갤 신호.
- **컨테이너는 연결만:** 훅에서 데이터를 받아 ui 컴포넌트 props로 바꾼다. 마크업과 스타일을 갖지 않는다.
- **훅은 데이터만:** API 호출은 `packages/shared`의 API 클라이언트와 TanStack Query로만. 컴포넌트 안에서 `fetch`하지 않는다.
- **ui 컴포넌트는 그리기만:** props를 받아 그린다. API, 라우터, 전역 상태를 모른다. 상호작용은 콜백 props(`onConfirm`)로 밖에 알린다.
- 웹에는 결제, 체인, 키, LLM 호출 코드가 없다. 전부 API에 있다.
- Server Component와 Client Component를 나눈다. 움직임과 입력이 있는 컴포넌트만 `"use client"`.

## UI 컴포넌트 (packages/ui)

### 폴더 (컴포넌트 하나 = 폴더 하나)
```
packages/ui/src/<영역>/<이름>/
├── <이름>.tsx              본체. 한 가지 일만
├── <이름>.module.css       스타일. 값은 토큰 CSS 변수만
├── <이름>.stories.tsx      하네스. 위키 문서의 "하네스 상태" 전부
├── <이름>.test.tsx         테스트. 위키 문서의 "테스트 기준" 전부
└── index.ts                내보내기
```
영역: `base`, `dragon`, `chat`, `order`, `limits`, `onboarding`, `wallet`. 목록과 문서는 `docs/wiki/components/ui/`.

토큰: `design/tokens.json`이 원본이고 `pnpm --filter @sikyeoyong/ui tokens`가 `packages/ui/src/tokens/tokens.css`(색, 글자, 간격, 반경, 크기 변수: `--color-leaf`, `--space-4`, `--radius-sheet` 등)를 만든다. 생성 파일은 손으로 고치지 않는다 (테스트가 tokens.json과 변수 하나하나를 대조한다). tokens.json이 글로만 적은 글꼴 목록과 움직임 값(`--font-ui`, `--font-dragon`, `--font-code`, `--motion-screen`, `--motion-screen-easing`, `--motion-number`)은 `src/tokens/base.css`에 손으로 두고 출처를 적는다. 앱은 둘을 합친 `@sikyeoyong/ui/tokens.css`(`src/tokens/index.css`)를 한 번 import한다. ui 패키지는 소스를 그대로 내보낸다 (웹은 `transpilePackages`, 하네스는 Vite).

### 규칙 (MUST)
- **단일 책임:** 컴포넌트 이름을 "~하는 것" 한 문장으로 설명할 수 없으면 쪼갠다. 예: `OrderConfirmSheet`는 확인 시트를 그린다. 결제는 하지 않는다(`onConfirm`만 부른다).
- **하네스 필수:** 위키 문서에 적힌 상태(기본, 로딩, 실패, 빈 상태, 막힘 등)를 스토리로 전부 만든다. 하네스 없이는 합치지 않는다.
- **문서 필수:** 새 컴포넌트를 만들면 `docs/wiki/components/ui/<영역>/<이름>.md`와 그 영역 `_index.md`를 같은 커밋에서 만든다. props를 바꾸면 문서도 바꾼다.
- 영역 사이 import는 `base`와 `dragon`만 허용한다(다른 영역이 가져다 쓰는 기초). `order`가 `limits`를 import하지 않는다. 필요하면 페이지나 컨테이너에서 조립한다.
- 금액은 `bigint`나 aokrw 문자열로 받고 표시는 `packages/shared`의 `formatOkrw`로만.

## API (apps/api, NestJS)

### 폴더
```
apps/api/src/
├── main.ts, app.module.ts
├── config/                   환경 변수 zod 검증(env.ts), 전역 ConfigModule(APP_CONFIG 토큰). 다른 곳은 process.env를 읽지 않는다
├── common/                   가드(세션, 역할), 파이프(zod), 필터(AppErrorCode, 드래곤 대사), 인터셉터(로깅, 감사)
├── db/                       Drizzle 스키마, 마이그레이션, DbModule
└── modules/<모듈>/
    ├── <모듈>.module.ts
    ├── <모듈>.controller.ts  HTTP만: 검증된 입력을 서비스에 넘기고 결과를 돌려준다
    ├── <모듈>.service.ts     일: 비즈니스 규칙
    ├── <모듈>.repository.ts  DB: Drizzle 쿼리만
    └── *.spec.ts
```
모듈: health(살아있음 확인만), auth, users, agents, payment, orders, merchants, recommend, budget, approvals, llm, chain, indexer, delivery, admin, demo, (2단계) merchant-api.

### 규칙 (MUST)
- **모듈 하나 = 책임 하나.** 다른 모듈의 저장소나 테이블을 직접 쓰지 않는다. 내보낸(`exports`) 서비스만 주입받아 부른다.
- **컨트롤러에 로직 금지:** 검증(zod 파이프), 권한(가드), 서비스 호출, 응답 반환만.
- **저장소에 규칙 금지:** 쿼리만. "한도 넘으면 막는다" 같은 판단은 서비스에.
- **바꿔 끼우는 것은 인터페이스로:** `PaymentProvider`(경로 A, B, C), `LlmProvider`, `MerchantSource`는 Nest 프로바이더 토큰으로 주입한다. 설정값으로 구현을 고른다.
- **주기 작업:** 인덱서(`indexer` 모듈)와 배달 타이머(`delivery` 모듈)는 `@nestjs/schedule`. SQLite라 프로세스는 하나로 돌린다.
- 에러는 `AppErrorCode`로만 내보낸다. 필터 하나가 HTTP 응답 형식과 드래곤 대사를 맞춘다.

## 공유 (packages/shared)
- ESM 전용 패키지(`dist`, NodeNext)다. 소비자는 ESM으로 import하거나 Node 22.12 이상의 `require(esm)`을 쓴다. api tsconfig는 `module: nodenext`로 컴파일한다 (CommonJS `node16`은 TS1479로 깨진다).
- zod 스키마(`api/`), 그 스키마에서 추론한 타입, 타입 있는 API 클라이언트, 체인 설정(`config/`), 정책값(`config/policy.ts`), `AppErrorCode`, `ChatEvent`, 금액·시간 유틸.
- 웹과 API가 같은 스키마를 쓴다. 스키마를 바꾸면 양쪽 타입 검사가 함께 깨져야 정상이다.

## 하지 말 것 (MUST NOT)
- 페이지에서 직접 `fetch`, 스타일, 금액 계산.
- ui 컴포넌트에서 API, 라우터, 전역 상태 import.
- API 컨트롤러에 비즈니스 로직, 모듈 사이 저장소 직접 접근.
- `packages/shared`에 런타임 부작용(환경변수 읽기, 네트워크).
