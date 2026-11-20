import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';

/** Open-Meteo is free and keyless. Current weather only, KST day. */
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
export const WEATHER_CACHE_MS = 10 * 60 * 1000;
export const WEATHER_TIMEOUT_MS = 3000;

/** 추움 at or below this, 더움 at or above that, when the sky itself is not rain or snow. */
const COLD_C = 5;
const HOT_C = 28;

/**
 * WMO weather_code to the words the recommender reacts to (score.ts WEATHER_TAGS:
 * 비, 눈, 추움, 더움) plus 맑음 and 흐림 as neutral. Rain and snow win over
 * temperature; any other sky becomes 추움 or 더움 at the extremes.
 */
export function weatherWord(code: number, tempC: number | null): string {
  const rain =
    (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);
  if (rain) return '비';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '눈';
  if (tempC !== null && tempC <= COLD_C) return '추움';
  if (tempC !== null && tempC >= HOT_C) return '더움';
  if (code === 0 || code === 1) return '맑음';
  return '흐림';
}

/**
 * The one weather source for the recommender and get_context, so both always
 * say the same thing. `null` means unknown (provider failed): callers treat it
 * as no weather signal and never invent a sky.
 */
@Injectable()
export class WeatherService {
  private readonly log = new Logger(WeatherService.name);
  private cache: { word: string; atMs: number } | undefined;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async current(nowMs: number = Date.now()): Promise<string | null> {
    const { weatherProvider, weatherStatic } = this.config.llm;
    if (weatherProvider === 'static') return weatherStatic;
    if (this.cache !== undefined && nowMs - this.cache.atMs < WEATHER_CACHE_MS) {
      return this.cache.word;
    }
    try {
      const word = await this.fetchOpenMeteo();
      this.cache = { word, atMs: nowMs };
      return word;
    } catch (e) {
      this.log.warn(`weather unavailable, treating as unknown: ${(e as Error).message}`);
      return null;
    }
  }

  private async fetchOpenMeteo(): Promise<string> {
    const { weatherLat, weatherLon } = this.config.llm;
    const url =
      `${OPEN_METEO_URL}?latitude=${weatherLat}&longitude=${weatherLon}` +
      `&current=weather_code,temperature_2m&timezone=Asia%2FSeoul`;
    const res = await fetch(url, { signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`open-meteo http ${res.status}`);
    const body = (await res.json()) as {
      current?: { weather_code?: unknown; temperature_2m?: unknown };
    };
    const code = body.current?.weather_code;
    if (typeof code !== 'number') throw new Error('open-meteo response has no weather_code');
    const t = body.current?.temperature_2m;
    return weatherWord(code, typeof t === 'number' ? t : null);
  }
}
