---
node: leaf
parent: _index.md
children: []
---

# Icon

`packages/ui/src/base/Icon/`

## 책임
한 가지 색(`currentColor`) 아이콘 하나를 이름으로 그린다. 화면 읽기에는 숨긴다.

## 책임 아님
크기와 색 (부르는 쪽 클래스가 정한다. 화면마다 아이콘 크기 토큰이 다르다), 버튼 (Button `icon`이나 부르는 쪽 버튼이 감싼다), 그림(용이, 알, 지도)과 여러 색 마크

## props
`name: 'back' | 'chevron-right' | 'chevron-down' | 'arrow-right' | 'arrow-up' | 'face-id' | 'kakao' | 'more'`, `className?: string` (크기, 색), `data-*` (부르는 쪽 CSS 상태, 예: `data-open`)

## 하네스 상태
`Icon.stories.tsx`에 아래를 전부 만든다.
- 전부 (`All`, 24px 글자색)
- 부르는 쪽이 크기와 색을 정함 (`SizedByCaller`)

## 쓰는 화면
TopBar(back), ListRow(chevron-right), ReceiptDetails(chevron-down), LimitChangeCard(arrow-right, face-id), ChatInput(arrow-up), SocialLogin과 KakaoVerify(kakao), ChatHeader(more, `IconButton`으로)

## 테스트 기준
- 모든 이름이 `aria-hidden`, viewBox 24, `currentColor`
- 선 아이콘의 선 굵기와 경로가 시안 그대로 (back, chevron 2, arrow-up 2.2, face-id 1.8에 이음 둥글림 없음, more는 점 세 개 1.8에 이음 둥글림 없음)
- kakao는 채움, 선 없음
- 부르는 쪽 클래스와 `data-*`가 붙는다
- 한 가지 색 아이콘을 다른 컴포넌트가 직접 그리지 않는다 (소스를 훑는 테스트)

## 메모
- 2026-11-19 재사용 감사(D-18 원칙 5)로 화면마다 복사된 인라인 SVG를 모았다. 경로와 선 굵기는 시안 파일 값 그대로다.
- 직접 `<svg>`를 그려도 되는 곳은 그림과 여러 색 마크뿐이다: Dragon, Egg, DeliveryMap, HatchProgress 상태 표시(부분마다 색이 다르고 도는 호가 있어 한 가지 색 아이콘이 아니다), SocialLogin 구글 G(브랜드 네 색). 이 목록은 Icon 테스트가 지킨다.
- kakao 마크의 브랜드 가이드 일치는 미확인이다 (SocialLogin 문서와 같음). 색은 SocialLogin CSS의 `fill`(`kakao-ink`)이 정한다.
- 크기를 Icon이 정하지 않는 이유: back 22, 줄 화살표 16, 보내기 20처럼 화면마다 토큰이 다르고, 디자인 값 테스트가 각 컴포넌트 CSS에서 그 값을 본다.
