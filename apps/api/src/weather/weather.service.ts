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

/** Cache the forecast for 30 minutes — weather doesn't change faster than that. */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Abort an Open-Meteo request that takes longer than this. */
const FETCH_TIMEOUT_MS = 8_000;

/** Total attempts (first try + retries) before giving up. */
const MAX_ATTEMPTS = 3;

/** Backoff before retry n is RETRY_BASE_DELAY_MS * 2^(n-1): 500ms, then 1s. */
const RETRY_BASE_DELAY_MS = 500;

interface CacheEntry {
  result: WeatherResponse;
  expiresAt: number;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private cache: CacheEntry | null = null;

  constructor(private readonly garminService: GarminService) {}

  async getForecast(): Promise<WeatherResponse | { error: string }> {
    const lastPoint = await this.garminService.getLastGarminPoint();
    if (!lastPoint) {
      return { error: 'No tracking points available' };
    }

    const { latitude, longitude } = lastPoint;

    // Return cached result if still fresh and for the same coordinates.
    if (
      this.cache &&
      Date.now() < this.cache.expiresAt &&
      this.cache.result.latitude === latitude &&
      this.cache.result.longitude === longitude
    ) {
      return this.cache.result;
    }

    const url =
      OPEN_METEO_BASE +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&daily=${DAILY_FIELDS}` +
      `&temperature_unit=celsius&windspeed_unit=kmh` +
      `&timezone=auto&forecast_days=2`;

    const weather = await this.fetchWithRetry(url);
    if (!weather) {
      return { error: 'Weather unavailable' };
    }

    const result: WeatherResponse = {
      latitude,
      longitude,
      pointTimestamp: lastPoint.timestamp,
      forecast: weather.daily,
      timezone: weather.timezone,
    };

    this.cache = { result, expiresAt: Date.now() + CACHE_TTL_MS };
    this.logger.debug(`Weather cache updated for ${latitude},${longitude}`);

    return result;
  }

  /** Fetch with a timeout, status check and exponential backoff; null once all attempts fail (never cached). */
  private async fetchWithRetry(url: string): Promise<OpenMeteoResponse | null> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
        return (await res.json()) as OpenMeteoResponse;
      } catch (err) {
        this.logger.warn(`Weather fetch attempt ${attempt}/${MAX_ATTEMPTS} failed: ${String(err)}`);
      } finally {
        clearTimeout(timer);
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)));
      }
    }
    return null;
  }
}
