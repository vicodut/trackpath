import { Injectable, Logger } from '@nestjs/common';
import { WeatherService } from '../../weather/weather.service.js';
import type { NarrativeFacts } from '../generation/narrative.builder.js';
import type { FactsGatherer } from '../notifications.types.js';
import { DistanceFacts } from './distance.facts.js';
import { MessagesFacts } from './messages.facts.js';
import { TrailProgressFacts } from './trail-progress.facts.js';

/** WMO weather code groups (Open-Meteo) to a plain phrase. */
function describeWeather(code: number): string {
  if (code === 0) return 'clear skies';
  if (code <= 3) return 'partly cloudy';
  if (code <= 48) return 'fog';
  if (code <= 57) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain showers';
  if (code <= 86) return 'snow showers';
  return 'thunderstorms';
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Composes the distance, trail-progress, messages and forecast providers into one day's facts. */
@Injectable()
export class DailyFactsGatherer implements FactsGatherer {
  private readonly logger = new Logger(DailyFactsGatherer.name);

  constructor(
    private readonly distance: DistanceFacts,
    private readonly trail: TrailProgressFacts,
    private readonly messages: MessagesFacts,
    private readonly weather: WeatherService,
  ) {}

  async gather(hikeId: number, date: string): Promise<NarrativeFacts> {
    const [km, trailLines, { messages, hadSignal }, forecast] = await Promise.all([
      this.distance.getDistanceKm(hikeId, date),
      this.trail.getFacts(date),
      this.messages.getForDay(date),
      this.getForecast(date),
    ]);
    const facts: NarrativeFacts = {
      hikeId,
      date,
      distanceKmToday: round1(km),
      messages,
      hasSignal: hadSignal,
      forecast,
    };
    // The trail provider hands back sentences; read the numbers out of them (shortcut: breaks if its wording changes, the seam spec catches that).
    const progress = /Trail progress: (\d+) km of (\d+) km/.exec(trailLines.slice(0, 1).join(''));
    if (progress) facts.progress = { doneKm: Number(progress[1]), totalKm: Number(progress[2]) };
    const highlight = /Nearest highlight: (?:at|about (\d+) km from) (.+)/.exec(trailLines.slice(1, 2).join(''));
    if (highlight) facts.highlight = { name: highlight[2], offsetKm: Number(highlight[1] || 0) };
    return facts;
  }

  /** The evening update looks ahead: tomorrow's forecast when the API has it, else the day's. Null when unavailable. */
  private async getForecast(date: string): Promise<NarrativeFacts['forecast']> {
    try {
      const res = await this.weather.getForecast();
      if ('error' in res) return null;
      const { time, weathercode, temperature_2m_min: min, temperature_2m_max: max } = res.forecast;
      const i = time.findIndex((t) => t > date) >= 0 ? time.findIndex((t) => t > date) : time.indexOf(date);
      if (i < 0) return null;
      return { summary: describeWeather(weathercode[i]), minC: Math.round(min[i]), maxC: Math.round(max[i]) };
    } catch (err) {
      this.logger.warn(`Forecast unavailable: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
