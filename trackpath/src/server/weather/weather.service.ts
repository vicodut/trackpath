import { Injectable, Logger } from '@nestjs/common';
import { GarminService } from '../garmin/garmin.service.js';
import type { OpenMeteoResponse, WeatherResponse } from './weather.types.js';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const DAILY_FIELDS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'weathercode',
  'windspeed_10m_max',
  'windgusts_10m_max',
].join(',');

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(private readonly garminService: GarminService) {}

  async getForecast(): Promise<WeatherResponse | { error: string }> {
    const lastPoint = await this.garminService.getLastGarminPoint();
    if (!lastPoint) {
      return { error: 'No tracking points available' };
    }

    const { latitude, longitude } = lastPoint;
    const url =
      `${OPEN_METEO_BASE}` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&daily=${DAILY_FIELDS}` +
      `&temperature_unit=celsius&windspeed_unit=kmh` +
      `&timezone=auto&forecast_days=2`;

    const res = await fetch(url);
    const weather = (await res.json()) as OpenMeteoResponse;

    return {
      latitude,
      longitude,
      pointTimestamp: lastPoint.timestamp,
      forecast: weather.daily,
      timezone: weather.timezone,
    };
  }
}
