import { AppError } from '@sikyeoyong/shared';
import { describe, expect, it, vi } from 'vitest';
import { createHttpApi, parseSseEvents } from './http-client';

// Amounts by hand: 10,000원 = 10000 * 10^18 aokrw.
const W10000 = '10000000000000000000000';

function fakeFetch(answers: Record<string, { status?: number; body: string }>) {
  return vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    const key = `${init?.method ?? 'GET'} ${href}`;
    const a = answers[key];
    if (a === undefined) return Promise.reject(new Error(`unexpected ${key}`));
    return Promise.resolve(new Response(a.body, { status: a.status ?? 200 }));
  });
}

describe('createHttpApi', () => {
  it('reads GET /api/me, same origin, with the fetch header', async () => {
    const me = {
      dragonName: '용이',
      dragonSpecies: 'forest',
      level: 1,
      perOrderLimit: W10000,
      custodial: true,
    };
    const f = fakeFetch({ 'GET /api/me': { body: JSON.stringify(me) } });
    expect(await createHttpApi(f).getMe()).toEqual(me);
    const init = f.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('same-origin');
    expect((init?.headers as Record<string, string>)['X-Requested-With']).toBe('fetch');
  });

  it('refuses an answer that breaks the shared schema (no silent number amounts)', async () => {
    const bad = { dragonName: '용이', dragonSpecies: 'forest', level: 1, perOrderLimit: 10000 };
    const f = fakeFetch({ 'GET /api/me': { body: JSON.stringify(bad) } });
    await expect(createHttpApi(f).getMe()).rejects.toThrow();
  });

  it('turns an error body into an AppError with its code and dragon line', async () => {
    const f = fakeFetch({
      'POST /api/orders/o1/confirm': {
        status: 423,
        body: JSON.stringify({
          error: {
            code: 'SERVER_FROZEN',
            message: '멈춰 있어요',
            dragonLine: '지금 자는 중이에용',
          },
        }),
      },
    });
    const err = await createHttpApi(f)
      .confirmOrder('o1')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({
      code: 'SERVER_FROZEN',
      detail: { status: 423, message: '멈춰 있어요', dragonLine: '지금 자는 중이에용' },
    });
  });

  it('an unknown code or a body that is not ours is INTERNAL', async () => {
    const f = fakeFetch({
      'GET /api/budget': { status: 502, body: JSON.stringify({ error: { code: 'BAD_GATEWAY' } }) },
    });
    await expect(createHttpApi(f).getBudget()).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('sends the confirm as POST with an encoded id and no body', async () => {
    const view = {
      id: 'o/1',
      status: 'paid',
      store: '마루국밥',
      destination: '역삼동',
      items: [{ name: '돼지국밥', quantity: 1, price: '9000000000000000000000' }],
      amount: '9000000000000000000000',
      etaAt: 1,
      remainingMin: 3,
      dragonLine: '주문 넣었어용.',
      dragonMood: 'happy',
    };
    const f = fakeFetch({
      'POST /api/orders/o%2F1/confirm': { body: JSON.stringify({ order: view }) },
    });
    expect((await createHttpApi(f).confirmOrder('o/1')).order.status).toBe('paid');
    expect(f.mock.calls[0]?.[1]?.body).toBeUndefined();
  });

  it('PATCH /api/me carries the budget as an aokrw string', async () => {
    const f = fakeFetch({
      'PATCH /api/me': { body: '{"user":{"nickname":"n","monthlyBudget":"1"}}' },
    });
    await createHttpApi(f).setMonthlyBudget('300000000000000000000000');
    expect(f.mock.calls[0]?.[1]?.body).toBe('{"monthlyBudgetOkrw":"300000000000000000000000"}');
  });

  it('refuses what the server cannot do yet instead of pretending it worked', async () => {
    const api = createHttpApi(fakeFetch({}));
    await expect(api.login('kakao')).rejects.toMatchObject({ code: 'INTERNAL' }); // no OAuth yet
    await expect(api.claimTrialAllowance()).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('with a dev login key, login posts it to the dev login (as a cookie write)', async () => {
    // The API answers 204; a test Response cannot carry 204 with a body, so 200 with none.
    const f = fakeFetch({ 'POST /api/auth/dev-login': { body: '' } });
    await createHttpApi(f, '/api', 'local').login('kakao');
    expect(f.mock.calls[0]?.[1]?.body).toBe('{"key":"local"}');
    expect((f.mock.calls[0]?.[1]?.headers as Record<string, string>)['X-Requested-With']).toBe(
      'fetch',
    );
  });

  it('the identity check posts to /api/identity/verify; a refusal stays a refusal', async () => {
    const ok = fakeFetch({ 'POST /api/identity/verify': { body: '{"verified":true}' } });
    expect(await createHttpApi(ok).verifyIdentity()).toEqual({ verified: true });
    const no = fakeFetch({
      'POST /api/identity/verify': {
        status: 500,
        body: JSON.stringify({ error: { code: 'INTERNAL', message: '잠시 문제가 있어요' } }),
      },
    });
    await expect(createHttpApi(no).verifyIdentity()).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('collects the chat SSE stream into events', async () => {
    const stream =
      'data: {"type":"token","text":"찾아볼게용."}\n\n' +
      'data: {"type":"done","messageId":"m1"}\n\n';
    const f = fakeFetch({ 'POST /api/chat/messages': { body: stream } });
    expect(await createHttpApi(f).sendChatMessage({ text: '점심', clientMessageId: 'c1' })).toEqual(
      [
        { type: 'token', text: '찾아볼게용.' },
        { type: 'done', messageId: 'm1' },
      ],
    );
  });
});

describe('createHttpApi: what the server and proxies require', () => {
  const headersOf = (f: ReturnType<typeof fakeFetch>, i = 0) =>
    f.mock.calls[i]?.[1]?.headers as Record<string, string>;
  const VIEW = {
    id: 'o1',
    status: 'paid',
    store: '마루국밥',
    destination: '역삼동',
    items: [{ name: '돼지국밥', quantity: 1, price: '9000000000000000000000' }],
    amount: '9000000000000000000000',
    etaAt: 1,
    remainingMin: 3,
    dragonLine: '주문 넣었어용.',
    dragonMood: 'happy',
  };

  it('every cookie write carries X-Requested-With and the same-origin cookie (else 403)', async () => {
    const f = fakeFetch({
      'POST /api/orders/o1/confirm': { body: JSON.stringify({ order: VIEW }) },
      'PATCH /api/me': { body: '{"user":{"nickname":"n","monthlyBudget":"1"}}' },
      'POST /api/chat/messages': { body: 'data: {"type":"done","messageId":"m1"}\n\n' },
    });
    const api = createHttpApi(f);
    await api.confirmOrder('o1');
    await api.setMonthlyBudget('1');
    await api.sendChatMessage({ text: '점심', clientMessageId: 'c1' });
    for (const i of [0, 1, 2]) {
      expect(headersOf(f, i)['X-Requested-With']).toBe('fetch');
      expect(f.mock.calls[i]?.[1]?.credentials).toBe('same-origin');
    }
  });

  it.each([
    [502, '<html>Bad Gateway</html>'],
    [504, 'upstream timeout'],
  ])(
    'a %s with a body that is not JSON is an INTERNAL AppError with the status',
    async (status, body) => {
      const f = fakeFetch({
        'POST /api/orders/o1/confirm': { status, body },
        'POST /api/chat/messages': { status, body },
      });
      const api = createHttpApi(f);
      for (const call of [
        () => api.confirmOrder('o1'),
        () => api.sendChatMessage({ text: '점심', clientMessageId: 'c1' }),
      ]) {
        const err = await call().catch((e: unknown) => e);
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({ code: 'INTERNAL', detail: { status } });
      }
    },
  );

  it('refuses a confirm answer whose amount is a number (money stays a string)', async () => {
    const f = fakeFetch({
      'POST /api/orders/o1/confirm': { body: JSON.stringify({ order: { ...VIEW, amount: 9000 } }) },
    });
    await expect(createHttpApi(f).confirmOrder('o1')).rejects.toThrow();
  });
});

describe('parseSseEvents', () => {
  it('skips comments and blank frames, refuses an event outside the shared schema', () => {
    expect(parseSseEvents(': ping\n\ndata: {"type":"token","text":"a"}\n\n\n')).toEqual([
      { type: 'token', text: 'a' },
    ]);
    expect(() => parseSseEvents('data: {"type":"pay_now"}\n\n')).toThrow();
  });
});
