import { describe, expect, it } from 'vitest';
import { findChainWords } from './checks.ts';
import { buildScenes } from './scenes.ts';
import { apiEnv, webEnv } from './servers.ts';

const scenes = buildScenes();

describe('buildScenes', () => {
  it('has the demo order of user-flow.md: 1, 2, 3, 4, 5, 6, 7', () => {
    expect(scenes.map((s) => s.id)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });
  it('gives every scene a screenshot and no empty step list', () => {
    for (const s of scenes) {
      expect(s.steps.length).toBeGreaterThan(0);
      expect(s.steps.some((st) => st.do === 'shot')).toBe(true);
    }
  });
  it('names every screenshot once, with no dashes outside the scene prefix', () => {
    const names = scenes.flatMap((s) =>
      s.steps.flatMap((st) => (st.do === 'shot' ? [st.name] : [])),
    );
    expect(new Set(names).size).toBe(names.length);
  });
  it('waits are bounded and long waits are only the delivery in scene 2', () => {
    for (const s of scenes) {
      for (const st of s.steps) {
        if (st.do === 'wait' && st.ms !== undefined && st.ms > 120_000) expect(s.id).toBe('2');
      }
    }
  });
  it('only scene 5 needs a route, and it is skipped when the route is missing', () => {
    expect(scenes.filter((s) => s.needsRoute !== undefined).map((s) => s.id)).toEqual(['5']);
  });
  it('expects no blockchain words on screen', () => {
    for (const s of scenes) {
      for (const st of s.steps) {
        if (st.do === 'expect') expect(findChainWords(st.texts.join(' '))).toEqual([]);
      }
    }
  });
});

describe('rehearsal servers settings', () => {
  const ports = { api: 41001, web: 41002 };
  it('runs the api as the demo wants: mock payment, demo profile, replayed dragon, temp db', () => {
    const env = apiEnv(ports, '/tmp/x/rehearsal.db');
    expect(env).toMatchObject({
      PAYMENT_PATH: 'mock',
      DEMO_MODE: 'true',
      POLICY_PROFILE: 'demo',
      LLM_MODE: 'replay',
      DEV_LOGIN: 'true',
      WEATHER_PROVIDER: 'static',
      WEATHER_STATIC: '비',
      PORT: '41001',
      DATABASE_URL: 'file:/tmp/x/rehearsal.db',
    });
  });
  it('blanks secrets and chain overrides a developer .env could bring in', () => {
    const env = apiEnv(ports, '/tmp/x/rehearsal.db');
    for (const k of ['OPERATOR_KEY', 'ANTHROPIC_API_KEY', 'ORDERS_CONTRACT', 'POUCHI_API_URL']) {
      expect(env[k]).toBe('');
    }
  });
  it('points the web at that api, over http, never at port 3000', () => {
    const env = webEnv(ports);
    expect(env.API_DEV_ORIGIN).toBe('http://localhost:41001');
    expect(env.NEXT_PUBLIC_API_MODE).toBe('http');
    expect(env.NEXT_DIST_DIR).not.toBe('.next');
  });
});
