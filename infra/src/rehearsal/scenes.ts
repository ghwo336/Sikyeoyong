/**
 * The demo scenes as data (design/user-flow.md "데모에서 보여 줄 순서"). Each scene is a list
 * of steps the interpreter (`run.ts`) plays in a real browser. The texts are what the screens
 * show; the dragon's words come from the replay turns (`harness/demo-turns.ts`).
 *
 * Scene 5 (the key-leak comparison) is a placeholder until its route exists.
 */
export type Step =
  /** Tap the button or card whose text contains `text` (the last match, as the newest card is last). */
  | { readonly do: 'tap'; readonly text: string }
  /** What a screen the fast mock hatch skips would have done: a call to the api as the owner. */
  | { readonly do: 'post'; readonly path: string }
  /** Flip the switch in the row that shows `near` (the switch has no label of its own). */
  | { readonly do: 'tapSwitch'; readonly near: string }
  /** Tap it only if it shows up within a few seconds (a confirm sheet that may not come). */
  | { readonly do: 'tapIfShown'; readonly text: string }
  /** Type into the chat input and send. */
  | { readonly do: 'say'; readonly text: string }
  | { readonly do: 'goto'; readonly path: string }
  /** Wait until the page shows the text (`ms` default 20 s). */
  | { readonly do: 'wait'; readonly text: string; readonly ms?: number }
  /** Like wait, but when it never shows the scene is skipped with `note` (a feature not built yet). */
  | { readonly do: 'waitOrSkip'; readonly text: string; readonly note: string }
  /** The page must show every text now (the screen's key outcome). */
  | { readonly do: 'expect'; readonly texts: readonly string[] }
  | { readonly do: 'expectNo'; readonly texts: readonly string[] }
  | { readonly do: 'url'; readonly includes: string }
  /** A screenshot, and the blockchain-words check unless the screen is the 자세히 보기 part. */
  | { readonly do: 'shot'; readonly name: string; readonly chainWordsOk?: boolean };

export interface Scene {
  readonly id: string;
  readonly title: string;
  /** A route that must exist for the scene to run; otherwise the scene is skipped with a note. */
  readonly needsRoute?: string;
  /** Browser-logged answers that are the scene's point (the 30-day cap is a 422). */
  readonly allowStatus?: readonly number[];
  readonly steps: readonly Step[];
}

const PER_ORDER = '한 번에 10,000원까지';

export function buildScenes(): readonly Scene[] {
  return [
    {
      id: '1',
      title: '시작에서 부화까지',
      steps: [
        { do: 'goto', path: '/start' },
        { do: 'wait', text: '이메일로 시작하기' },
        { do: 'shot', name: '1-start' },
        { do: 'tap', text: '이메일로 시작하기' },
        { do: 'wait', text: '체험용으로 인증하기' },
        { do: 'tap', text: '체험용으로 인증하기' },
        { do: 'wait', text: '알 깨우기' },
        { do: 'shot', name: '1-name' },
        { do: 'tap', text: '알 깨우기' },
        { do: 'wait', text: '용이에게 말하기', ms: 120_000 },
        // The mock hatch is too quick to show the budget step, so its trial allowance is asked here.
        { do: 'post', path: '/signup/trial' },
        { do: 'wait', text: '60,000원' },
        { do: 'expect', texts: [PER_ORDER, '30일 배달비'] },
        { do: 'shot', name: '1-main' },
      ],
    },
    {
      id: '2',
      title: '정상 주문과 기다림 (6 to 10)',
      steps: [
        { do: 'say', text: '돼지국밥 시켜 줘' },
        { do: 'wait', text: '돼지국밥 골라 봤어용' },
        { do: 'tap', text: '돼지국밥 9,000원' },
        { do: 'wait', text: '9,000원 시키기' },
        { do: 'expect', texts: ['이대로 괜찮아용?', '결제할 금액'] },
        { do: 'shot', name: '2-confirm' },
        { do: 'tap', text: '9,000원 시키기' },
        { do: 'wait', text: '주문 현황' },
        { do: 'expect', texts: ['주문 넣었어용', '결제한 금액'] },
        { do: 'shot', name: '2-placed' },
        { do: 'wait', text: '만드는 중이에용', ms: 90_000 },
        { do: 'shot', name: '2-preparing' },
        { do: 'wait', text: '라이더님 출발했어용', ms: 120_000 },
        { do: 'shot', name: '2-delivering' },
        { do: 'wait', text: '도착했어용', ms: 180_000 },
        { do: 'shot', name: '2-arrived' },
        { do: 'tap', text: '또 먹을래' },
        { do: 'shot', name: '2-rated' },
      ],
    },
    {
      id: '3',
      title: '건당 한도 초과, 말로 올리고 다시 시키기 (12 to 13)',
      steps: [
        { do: 'goto', path: '/' },
        { do: 'wait', text: '용이에게 말하기' },
        { do: 'say', text: '보쌈 큰 걸로 시켜 줘' },
        { do: 'wait', text: '보쌈 골라 봤어용' },
        { do: 'tap', text: '보쌈 대(大) 45,000원' },
        { do: 'wait', text: '한 번에 45,000원으로 올리고 시키기' },
        { do: 'url', includes: '/limit/' },
        { do: 'expect', texts: ['10,000원까지', '10,000원 안에서 다시 고르기'] },
        { do: 'shot', name: '3-blocked' },
        { do: 'tap', text: '대화로 돌아가기' },
        { do: 'wait', text: '용이에게 말하기' },
        { do: 'say', text: '한 번에 5만 원까지 올려 줘' },
        { do: 'wait', text: '확인하고 바꾸기' },
        { do: 'expect', texts: ['10,000원', '50,000원'] },
        { do: 'shot', name: '3-limit-card' },
        { do: 'tap', text: '확인하고 바꾸기' },
        { do: 'wait', text: '바꿨어용' },
        { do: 'expect', texts: ['한 번에 50,000원까지'] },
        { do: 'tap', text: '보쌈 대(大) 45,000원' },
        { do: 'wait', text: '45,000원 시키기' },
        { do: 'tap', text: '45,000원 시키기' },
        { do: 'wait', text: '주문 현황' },
        { do: 'expect', texts: ['주문 넣었어용', '45,000원'] },
        { do: 'shot', name: '3-ordered' },
      ],
    },
    {
      id: '4',
      title: '30일 한도 (14, 데모 프로필 1시간 주기)',
      allowStatus: [422],
      steps: [
        { do: 'tap', text: '대화로 돌아가기' },
        { do: 'wait', text: '용이에게 말하기' },
        { do: 'say', text: '돼지국밥 시켜 줘' },
        { do: 'wait', text: '돼지국밥 골라 봤어용' },
        { do: 'tap', text: '돼지국밥 9,000원' },
        { do: 'tapIfShown', text: '9,000원 시키기' },
        { do: 'url', includes: '/limit/cap' },
        { do: 'shot', name: '4-cap' },
      ],
    },
    {
      id: '5',
      title: '키 유출 비교 (DEMO_MODE)',
      needsRoute: '/demo',
      steps: [
        { do: 'goto', path: '/demo' },
        { do: 'shot', name: '5-compare' },
      ],
    },
    {
      id: '6',
      title: '멈추고 돌려받기 (17)',
      steps: [
        { do: 'goto', path: '/dragon' },
        { do: 'wait', text: '용이 멈추기' },
        { do: 'shot', name: '6-wallet' },
        { do: 'tapSwitch', near: '용이 멈추기' },
        { do: 'wait', text: '용이가 자고 있어요' },
        { do: 'expect', texts: ['모든 주문이 멈췄어요', '용이 깨우기'] },
        { do: 'shot', name: '6-frozen' },
        // 돌려받기 shows only while the pocket holds money; the mock pays each order exactly, so
        // the pocket is empty here and the refund itself is not rehearsed (infra.md).
        { do: 'tap', text: '용이 깨우기' },
        { do: 'wait', text: '용이에게 말하기' },
        { do: 'shot', name: '6-awake' },
      ],
    },
    {
      id: '7',
      title: '영수증 자세히 보기 (11)',
      steps: [
        { do: 'goto', path: '/orders' },
        { do: 'wait', text: '주문 내역' },
        { do: 'tap', text: '돼지국밥' },
        { do: 'wait', text: '결제한 금액' },
        { do: 'expect', texts: ['돼지국밥 1개', '결제 수단'] },
        {
          do: 'waitOrSkip',
          text: '자세히 보기',
          note: 'the server does not write the receipt (OrderView.receipt) yet',
        },
        { do: 'shot', name: '7-receipt' },
        { do: 'tap', text: '자세히 보기' },
        { do: 'wait', text: '결제 기록 번호' },
        { do: 'shot', name: '7-receipt-detail', chainWordsOk: true },
      ],
    },
  ];
}
