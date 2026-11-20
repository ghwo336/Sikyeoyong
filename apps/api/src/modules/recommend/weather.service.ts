import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';

/** Weather the demo uses so scenes replay the same (tech-spec 3.8, WEATHER_PROVIDER=static). */
export const STATIC_WEATHER = '비';

/**
 * The one weather source for the recommender and get_context, so both always
 * say the same thing. Only `static` is wired; any other provider is an error
 * rather than made-up weather (k-skill korea-weather joins behind this later).
 */
@Injectable()
export class WeatherService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  current(): string {
    if (this.config.llm.weatherProvider !== 'static') {
      throw new AppError('INTERNAL', {
        reason: 'weather provider not wired',
        variables: ['WEATHER_PROVIDER'],
      });
    }
    return STATIC_WEATHER;
  }
}
