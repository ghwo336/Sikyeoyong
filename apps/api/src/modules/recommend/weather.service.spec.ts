import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config/env.js';
import { WEATHER_CACHE_MS, WeatherService, weatherWord } from './weather.service.js';

const svc = (env: Record<string, string> = {}) =>
  new WeatherService(loadConfig({ WEATHER_PROVIDER: 'openmeteo', ...env }));
const ok = (code: number, temp: number) =>
  Promise.resolve(
    new Response(JSON.stringify({ current: { weather_code: code, temperature_2m: temp } })),
  );

afterEach(() => vi.unstubAllGlobals());

describe('weatherWord (WMO code to recommender words)', () => {
  it.each([
    [61, 15, '비'],
    [80, 15, '비'],
    [95, 15, '비'],
    [73, 1, '눈'],
    [0, 15, '맑음'],
    [1, 15, '맑음'],
    [3, 15, '흐림'],
    [45, 15, '흐림'],
    [0, 2, '추움'],
    [3, 31, '더움'],
    [61, 2, '비'],
  ])('code %i at %i C is %s', (code, temp, word) => {
    expect(weatherWord(code, temp)).toBe(word);
  });
});

describe('WeatherService', () => {
  it('static says its configured word, default 맑음, and never calls the network', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await new WeatherService(loadConfig({})).current()).toBe('맑음');
    expect(await new WeatherService(loadConfig({ WEATHER_STATIC: '비' })).current()).toBe('비');
    expect(f).not.toHaveBeenCalled();
  });

  it('asks Open-Meteo for the configured place and maps the code', async () => {
    const f = vi.fn((_url: string) => ok(61, 14));
    vi.stubGlobal('fetch', f);
    expect(await svc({ WEATHER_LAT: '35.1', WEATHER_LON: '129.0' }).current()).toBe('비');
    const url = String(f.mock.calls[0]?.[0]);
    expect(url).toContain('latitude=35.1&longitude=129');
    expect(url).toContain('current=weather_code,temperature_2m');
  });

  it('caches for 10 minutes, then asks again', async () => {
    const f = vi.fn(() => ok(0, 15));
    vi.stubGlobal('fetch', f);
    const s = svc();
    await s.current(1_000);
    await s.current(1_000 + WEATHER_CACHE_MS - 1);
    expect(f).toHaveBeenCalledTimes(1);
    await s.current(1_000 + WEATHER_CACHE_MS);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['network error', () => Promise.reject(new Error('offline'))],
    ['http 500', () => Promise.resolve(new Response('x', { status: 500 }))],
    ['timeout', () => Promise.reject(new DOMException('timed out', 'TimeoutError'))],
    ['bad body', () => Promise.resolve(new Response('{"current":{}}'))],
  ])('%s gives unknown (null), not made-up weather, and is not cached', async (_n, impl) => {
    const f = vi.fn(impl);
    vi.stubGlobal('fetch', f);
    const s = svc();
    expect(await s.current()).toBeNull();
    expect(await s.current()).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('rejects a bad coordinate at boot', () => {
    expect(() => loadConfig({ WEATHER_LAT: '91' })).toThrow();
    expect(() => loadConfig({ WEATHER_LON: 'abc' })).toThrow();
  });
});
