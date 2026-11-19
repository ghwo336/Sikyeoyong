---
node: leaf
parent: _index.md
children: []
---

# HatchProgress

`packages/ui/src/onboarding/HatchProgress/`

## 책임
부화 세 단계(용돈 주머니, 신분증, 한도 새기기)의 진행을 그린다.

## 책임 아님
상태 폴링 (부모 훅)

## props
`steps: readonly { label: string; status: 'done' | 'doing' | 'waiting' | 'failed' }[]`, `onRetry?: () => void` ("다시 깨우기")

## 하네스 상태
`HatchProgress.stories.tsx`에 아래를 전부 만든다.
- 처음 (`Start`)
- 신분증 중 (`IdCardDoing`, Hatch 시안)
- 모두 완료 (`AllDone`)
- 실패와 다시 깨우기 (`Failed`)

## 쓰는 화면
Hatch

## 테스트 기준
- failed일 때만 onRetry ("다시 깨우기" 버튼, 그 단계 줄에). onRetry가 없으면 "안 됐어요"만
- 단계 이름과 상태 말(완료, 하는 중, 대기)을 순서대로, 상태별 아이콘 (아이콘은 aria-hidden)
- 아이콘 모양: 완료 잎색 원과 체크, 하는 중 회색 고리 위 잎색 호, 대기 회색 고리 하나, 실패 호박 고리와 느낌표
- 실패 줄은 버튼 옆에도 숨긴 글자 "안 됐어요"가 있어 화면 읽기가 실패를 안다
- 하는 중 고리는 돌고, 동작 줄이기면 멈춘다
- Hatch 시안 값 (카드 여백 16 간격 14, 줄 간격 12, 15px, 하는 중 600과 잎색 상태, 대기 `ink-muted`, 아이콘 22)

## 메모
- 실패 모양(호박 고리와 느낌표, "다시 깨우기")은 시안에 없다 (디자인 선택). user-flow 4단계의 "다시 깨우기" 문구를 따랐다.
- "다시 깨우기"는 base `Button` link `sm`(잎색 13/600, 높이 44, 옆 여백 8)이다. UserBubble "다시 보내기"와 같은 버튼.
- 대기 줄의 `ink-muted`는 흰 바탕 대비가 4.5:1보다 낮다 (시안 값, 디자인 판단 필요).
- 위의 흔들리는 알과 "알이 흔들려용..."은 화면이 `Egg`와 `DragonLine`으로 그린다.
