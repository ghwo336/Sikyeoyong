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
    const bad = { dragonName: '용이', dragonSpecies: 'forest', perOrderLimit: 10000 };
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

  it('refuses what the server cannot do yet instead of pretending it worked', async () => {
    const api = createHttpApi(fakeFetch({}));
    await expect(api.login()).rejects.toMatchObject({ code: 'INTERNAL' }); // no login yet
  });

  it('the wallet screen routes: paths, methods, bodies, and every answer checked by the shared schema', async () => {
    const H = `0x${'c'.repeat(64)}`;
    const f = fakeFetch({
      'GET /api/wallet': {
        body: JSON.stringify({ owner: W10000, pocket: '0', savedThisMonth: W10000 }),
      },
      'GET /api/me/id-card': {
        body: JSON.stringify({ ownerName: '호재', ownerVerified: true, bornAt: 1 }),
      },
      'POST /api/agents/me/freeze': { body: JSON.stringify({ frozen: true, txHashes: [H] }) },
      'POST /api/agents/me/unfreeze': { body: JSON.stringify({ frozen: false, txHashes: [H] }) },
      'POST /api/agents/me/drain': { body: JSON.stringify({ refunded: W10000, txHashes: [H] }) },
      'POST /api/signup/trial': { body: '{"granted":true}' },
      'POST /api/orders/o%2F1/rating': { body: '' },
    });
    const api = createHttpApi(f);
    expect(await api.getWallet()).toEqual({ owner: W10000, pocket: '0', savedThisMonth: W10000 });
    expect((await api.getIdCard()).ownerName).toBe('호재');
    await api.setFrozen(true);
    await api.setFrozen(false);
    await api.refundPocket();
    await api.claimTrialAllowance();
    await api.rateOrder('o/1', 'again');
    const sent = f.mock.calls.map((c) => [c[1]?.method, c[0], c[1]?.body]);
    expect(sent).toEqual([
      ['GET', '/api/wallet', undefined],
      ['GET', '/api/me/id-card', undefined],
      ['POST', '/api/agents/me/freeze', undefined],
      ['POST', '/api/agents/me/unfreeze', undefined],
      ['POST', '/api/agents/me/drain', undefined],
      ['POST', '/api/signup/trial', undefined],
      ['POST', '/api/orders/o%2F1/rating', '{"value":"again"}'],
    ]);
    for (const c of f.mock.calls.slice(2)) {
      expect((c[1]?.headers as Record<string, string>)['X-Requested-With']).toBe('fetch');
    }
  });

  it('refuses wallet answers that break the schema (a number amount, a short tx hash)', async () => {
    const bad = fakeFetch({
      'GET /api/wallet': { body: '{"owner":81000,"pocket":"0","savedThisMonth":"0"}' },
      'POST /api/agents/me/drain': { body: '{"refunded":"1","txHashes":["0x12"]}' },
      'POST /api/agents/me/freeze': { body: '{"frozen":"yes","txHashes":[]}' },
      'POST /api/signup/trial': { body: '{"granted":1}' },
      'GET /api/me/id-card': { body: '{"ownerName":"","ownerVerified":true,"bornAt":1}' },
    });
    const api = createHttpApi(bad);
    await expect(api.getWallet()).rejects.toThrow();
    await expect(api.refundPocket()).rejects.toThrow();
    await expect(api.setFrozen(true)).rejects.toThrow();
    await expect(api.claimTrialAllowance()).rejects.toThrow();
    await expect(api.getIdCard()).rejects.toThrow();
  });

  it('GET /api/identity is checked by the shared schema', async () => {
    const ok = fakeFetch({ 'GET /api/identity': { body: '{"verified":false}' } });
    expect(await createHttpApi(ok).getIdentity()).toEqual({ verified: false });
    const bad = fakeFetch({ 'GET /api/identity': { body: '{"verified":"no"}' } });
    await expect(createHttpApi(bad).getIdentity()).rejects.toThrow();
  });

  it('the Pouchi login calls: public config checked by the schema, bind and complete as cookie writes', async () => {
    const f = fakeFetch({
      'GET /api/auth/pouchi/config': {
        body: JSON.stringify({
          vaultUrl: 'https://auth.pouchi.io',
          appId: 'sikyeoyong',
          callbackUrl: 'http://localhost:3000/pouchi/callback',
        }),
      },
      'POST /api/auth/pouchi/bind': { body: '' },
      'POST /api/auth/pouchi/complete': { body: '' },
    });
    const api = createHttpApi(f);
    expect((await api.getPouchiLoginConfig()).appId).toBe('sikyeoyong');
    await api.pouchiBind({ requestId: 'r1', codeChallenge: 'c', flow: 'signup' });
    await api.pouchiComplete({ envelope: 'e', codeVerifier: 'v'.repeat(43), requestId: 'r1' });
    expect(f.mock.calls[1]?.[1]?.body).toBe(
      '{"requestId":"r1","codeChallenge":"c","flow":"signup"}',
    );
    for (const i of [1, 2]) {
      expect((f.mock.calls[i]?.[1]?.headers as Record<string, string>)['X-Requested-With']).toBe(
        'fetch',
      );
    }
    const keyed = fakeFetch({
      'GET /api/auth/pouchi/config': {
        body: '{"vaultUrl":"https://auth.pouchi.io","appId":"a","callbackUrl":"https://x.example/cb","appKey":"k"}',
      },
    });
    await expect(createHttpApi(keyed).getPouchiLoginConfig()).rejects.toThrow();
  });

  it('with a dev login key, login posts it to the dev login (as a cookie write)', async () => {
    // The API answers 204; a test Response cannot carry 204 with a body, so 200 with none.
    const f = fakeFetch({ 'POST /api/auth/dev-login': { body: '' } });
    await createHttpApi(f, '/api', 'local').login();
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

  it('a limit change puts aokrw strings to /api/agents/me/limits and checks the answer (D-31)', async () => {
    const answer = {
      perOrderLimit: W10000,
      myPeriodicLimit: W10000,
      txHash: `0x${'a'.repeat(64)}`,
    };
    const ok = fakeFetch({ 'PUT /api/agents/me/limits': { body: JSON.stringify(answer) } });
    expect(await createHttpApi(ok).setLimits({ perOrderLimit: W10000 })).toEqual(answer);
    expect(ok.mock.calls[0]?.[1]?.method).toBe('PUT');
    expect(ok.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ perOrderLimit: W10000 }));
    expect((ok.mock.calls[0]?.[1]?.headers as Record<string, string>)['X-Requested-With']).toBe(
      'fetch',
    );
    const numberLimit = fakeFetch({
      'PUT /api/agents/me/limits': {
        body: '{"perOrderLimit":10000,"myPeriodicLimit":"1","txHash":null}',
      },
    });
    await expect(createHttpApi(numberLimit).setLimits({ perOrderLimit: W10000 })).rejects.toThrow();
    const frozen = fakeFetch({
      'PUT /api/agents/me/limits': {
        status: 409,
        body: JSON.stringify({ error: { code: 'SERVER_FROZEN', message: '멈춰 있어요' } }),
      },
    });
    await expect(createHttpApi(frozen).setLimits({ perOrderLimit: W10000 })).rejects.toMatchObject({
      code: 'SERVER_FROZEN',
    });
  });

  it('hands each chat event over as it arrives, even when a frame is split across chunks', async () => {
    const parts = [
      'data: {"type":"token","text":"비 "}\n\ndata: {"type":"tok',
      'en","text":"와용"}\n\n',
      'data: {"type":"done","messageId":"m1"}\n\n',
    ];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const p of parts) controller.enqueue(new TextEncoder().encode(p));
        controller.close();
      },
    });
    const f = vi.fn(() => Promise.resolve(new Response(body, { status: 200 })));
    const seen: string[] = [];
    const all = await createHttpApi(f).sendChatMessage(
      { text: '점심', clientMessageId: 'c1' },
      (e) => seen.push(e.type === 'token' ? e.text : e.type),
    );
    expect(seen).toEqual(['비 ', '와용', 'done']);
    expect(all).toHaveLength(3);
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
      'PUT /api/agents/me/limits': {
        body: '{"perOrderLimit":"1","myPeriodicLimit":"1","txHash":null}',
      },
      'POST /api/chat/messages': { body: 'data: {"type":"done","messageId":"m1"}\n\n' },
    });
    const api = createHttpApi(f);
    await api.confirmOrder('o1');
    await api.setLimits({ myPeriodicLimit: '1' });
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
