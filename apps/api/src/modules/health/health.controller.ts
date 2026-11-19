import { Controller, Get } from '@nestjs/common';
import { HealthService, type Liveness } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  get(): Liveness {
    return this.health.liveness();
  }
}
