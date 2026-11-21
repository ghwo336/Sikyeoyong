/// <reference lib="dom" />
// The functions passed to page.evaluate run in the browser, so they use the DOM types.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { type Browser, type ElementHandle, type Page } from 'puppeteer-core';
import { type ConsoleNote, type Outcome, findChainWords, isBenignConsole } from './checks.ts';
import type { Scene, Step } from './scenes.ts';

/** CHROME_PATH overrides the macOS default. */
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEFAULT_WAIT_MS = 20_000;

/** Page text with every run of whitespace as one space, so scene texts match across lines. */
const NORMALIZE = (): string => document.body.innerText.replace(/\s+/g, ' ');

export interface Session {
  readonly browser: Browser;
  readonly page: Page;
  readonly notes: ConsoleNote[];
}

/** A phone-sized headless Chrome (390x844), which collects console errors for the checks. */
export async function openSession(): Promise<Session> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const notes: ConsoleNote[] = [];
  page.on('console', (m) => {
    notes.push({ type: m.type(), text: m.text(), url: m.location().url ?? '' });
  });
  page.on('pageerror', (e) => {
    notes.push({ type: 'error', text: `pageerror ${String(e)}`, url: page.url() });
  });
  return { browser, page, notes };
}

async function bodyText(page: Page): Promise<string> {
  return page.evaluate(NORMALIZE);
}

async function waitText(page: Page, text: string, ms: number): Promise<void> {
  try {
    await page.waitForFunction(
      (t) => document.body.innerText.replace(/\s+/g, ' ').includes(t),
      { timeout: ms },
      text,
    );
  } catch {
    throw new Error(`"${text}" did not show within ${String(ms / 1000)}s`);
  }
}

/** The last visible button, link or switch whose label or text contains `text`. */
async function findTarget(page: Page, text: string): Promise<ElementHandle | null> {
  const handle = await page.evaluateHandle((t) => {
    const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
    const els = [...document.querySelectorAll('button, a, [role=button], [role=switch]')].filter(
      (e) => e.getBoundingClientRect().width > 0,
    );
    const hits = els.filter(
      (e) =>
        norm((e as HTMLElement).innerText).includes(t) ||
        norm(e.getAttribute('aria-label') ?? '').includes(t),
    );
    return hits.at(-1) ?? null;
  }, text);
  return handle.asElement() as ElementHandle | null;
}

async function tapText(page: Page, text: string, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const el = await findTarget(page, text);
    if (el) {
      await el.scrollIntoView();
      // A sheet still sliding in can make a touch tap fail; a plain click does the same job.
      await el.tap().catch(() =>
        el.evaluate((e) => {
          (e as HTMLElement).click();
        }),
      );
      return true;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

/** A scene that cannot run yet: reported as a skip with the reason, not as a failure. */
export class SkipScene extends Error {}

/** Plays one step; throws with a plain sentence when the screen is not as expected. */
export async function playStep(
  s: Session,
  step: Step,
  base: string,
  shotDir: string,
): Promise<void> {
  const { page } = s;
  switch (step.do) {
    case 'goto':
      await page.goto(`${base}${step.path}`, { waitUntil: 'domcontentloaded' });
      return;
    case 'wait':
      return waitText(page, step.text, step.ms ?? DEFAULT_WAIT_MS);
    case 'waitOrSkip':
      try {
        await waitText(page, step.text, 8_000);
      } catch {
        throw new SkipScene(step.note);
      }
      return;
    case 'tap':
      if (!(await tapText(page, step.text, DEFAULT_WAIT_MS))) {
        throw new Error(`nothing to tap: "${step.text}"`);
      }
      return;
    case 'post': {
      const status = await page.evaluate(async (path) => {
        const res = await fetch(`/api${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        });
        return res.status;
      }, step.path);
      if (status >= 400) throw new Error(`POST ${step.path} answered ${String(status)}`);
      return;
    }
    case 'tapSwitch': {
      const sw = await page.evaluateHandle((near) => {
        // The closest row that shows the text wins (a shared parent shows every row's text).
        const depth = (e: Element): number => {
          for (let p: Element | null = e, i = 0; p && i < 4; p = p.parentElement, i += 1) {
            if ((p as HTMLElement).innerText.replace(/\s+/g, ' ').includes(near)) return i;
          }
          return 99;
        };
        const all = [...document.querySelectorAll('[role=switch]')];
        const best = all.reduce<Element | null>(
          (m, e) => (depth(e) < 99 && (m === null || depth(e) < depth(m)) ? e : m),
          null,
        );
        return best;
      }, step.near);
      const el = sw.asElement();
      if (!el) throw new Error(`no switch near "${step.near}"`);
      await (el as ElementHandle).evaluate((e) => {
        (e as HTMLElement).click();
      });
      return;
    }
    case 'tapIfShown':
      await tapText(page, step.text, 6_000);
      return;
    case 'say': {
      await page.waitForSelector('input', { visible: true, timeout: DEFAULT_WAIT_MS });
      await page.type('input', step.text);
      // A press during hydration can be lost: the input still holds the text then, so press again
      // (the text is sent once; a sent message empties the input).
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (!(await tapText(page, '보내기', 5_000))) throw new Error('no send button');
        await new Promise((r) => setTimeout(r, 1_500));
        const left = await page.$eval('input', (el) => el.value);
        if (left === '') return;
      }
      throw new Error('the message was not sent');
    }
    case 'expect': {
      const text = await bodyText(page);
      const missing = step.texts.filter((t) => !text.includes(t));
      if (missing.length > 0) throw new Error(`missing on screen: ${missing.join(' | ')}`);
      return;
    }
    case 'expectNo': {
      const text = await bodyText(page);
      const found = step.texts.filter((t) => text.includes(t));
      if (found.length > 0) throw new Error(`should not be on screen: ${found.join(' | ')}`);
      return;
    }
    case 'url':
      if (!page.url().includes(step.includes)) {
        throw new Error(`url is ${page.url()}, expected it to include ${step.includes}`);
      }
      return;
    case 'shot': {
      await new Promise((r) => setTimeout(r, 700));
      await page.screenshot({ path: join(shotDir, `${step.name}.png`) });
      if (step.chainWordsOk !== true) {
        const words = findChainWords(await bodyText(page));
        if (words.length > 0)
          throw new Error(`blockchain words on ${step.name}: ${words.join(', ')}`);
      }
    }
  }
}

async function routeExists(base: string, path: string): Promise<boolean> {
  const res = await fetch(`${base}${path}`);
  return res.status !== 404;
}

/** Runs the scenes in order in one browser (one owner, the scenes build on each other). */
export async function runScenes(
  scenes: readonly Scene[],
  base: string,
  outDir: string,
  log: (line: string) => void,
): Promise<Outcome[]> {
  mkdirSync(outDir, { recursive: true });
  const session = await openSession();
  const outcomes: Outcome[] = [];
  try {
    for (const scene of scenes) {
      const mark = session.notes.length;
      if (scene.needsRoute !== undefined && !(await routeExists(base, scene.needsRoute))) {
        outcomes.push({
          scene: scene.id,
          title: scene.title,
          status: 'skip',
          detail: `no ${scene.needsRoute} route yet`,
        });
        continue;
      }
      log(`scene ${scene.id}: ${scene.title}`);
      let failure = '';
      let skipNote = '';
      for (const step of scene.steps) {
        try {
          await playStep(session, step, base, outDir);
        } catch (err) {
          if (err instanceof SkipScene) {
            skipNote = err.message;
            break;
          }
          const text = (await bodyText(session.page).catch(() => '')).slice(0, 300);
          failure = `${err instanceof Error ? err.message : String(err)} (at ${JSON.stringify(step)}; screen: ${text})`;
          await session.page
            .screenshot({ path: join(outDir, `fail-${scene.id}.png`) })
            .catch(() => undefined);
          break;
        }
      }
      if (skipNote !== '') {
        outcomes.push({ scene: scene.id, title: scene.title, status: 'skip', detail: skipNote });
        continue;
      }
      if (failure === '') {
        const allowed = (scene.allowStatus ?? []).map((c) => `status of ${String(c)}`);
        const bad = session.notes
          .slice(mark)
          .filter((n) => !isBenignConsole(n) && !allowed.some((a) => n.text.includes(a)));
        if (bad.length > 0)
          failure = `console errors: ${bad.map((n) => n.text.slice(0, 120)).join(' ; ')}`;
      }
      outcomes.push({
        scene: scene.id,
        title: scene.title,
        status: failure === '' ? 'pass' : 'fail',
        detail: failure,
      });
    }
  } finally {
    await session.browser.close();
  }
  return outcomes;
}
