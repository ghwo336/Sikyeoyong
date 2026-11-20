// S14 spike browser side: embedded login (docs embedded-quickstart, current SDK beta.8).
// handleCallback runs first on every load, including /pouchi/callback (Safari passkey hops).
import { pouchiBridge, pouchiEmbedded, type PouchiBridgeResult } from '@nc-waas/sdk/browser';

const logEl = document.getElementById('log') as HTMLPreElement;
const log = (line: string) => {
  logEl.textContent = `${logEl.textContent === '준비 중...' ? '' : `${logEl.textContent}\n`}${line}`;
};

async function post(path: string, value: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' },
    body: JSON.stringify(value),
  });
  const json: unknown = await res.json();
  if (!res.ok) throw new Error(`${path} ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const complete = (r: PouchiBridgeResult) =>
  post('/api/complete', {
    envelope: r.envelope,
    codeVerifier: r.codeVerifier,
    requestId: r.requestId,
  });

async function start() {
  const config = (await (await fetch('/api/config')).json()) as {
    vaultUrl: string;
    appId: string;
    callbackUrl: string;
  };
  const returned = await pouchiBridge.handleCallback();
  if (returned) {
    log(`콜백 결과: ${JSON.stringify(await complete(returned))}`);
    history.replaceState(null, '', '/');
  } else {
    log('로그인 버튼을 누르세요.');
  }
  const button = document.getElementById('login') as HTMLButtonElement;
  button.onclick = async () => {
    button.disabled = true;
    try {
      const result = await pouchiEmbedded.login({
        ...config,
        beforeOpen: (request) => post('/api/bind', request).then(() => undefined),
      });
      log(`로그인 결과: ${JSON.stringify(await complete(result))}`);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      log(`실패: ${err.code ?? ''} ${err.message ?? String(e)}`);
    } finally {
      button.disabled = false;
    }
  };
}

void start().catch((e: unknown) => log(`시작 실패: ${String(e)}`));
