import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { GarminService } from '../garmin/garmin.service.js';
import { WeatherService } from './weather.service.js';

const DAILY = {
  time: ['2026-06-01', '2026-06-02'],
  temperature_2m_max: [20, 21],
  temperature_2m_min: [10, 11],
  precipitation_sum: [0, 1],
  precipitation_probability_max: [5, 60],
  weathercode: [1, 61],
  windspeed_10m_max: [10, 12],
  windgusts_10m_max: [20, 25],
};

const okResponse = () =>
  new Response(JSON.stringify({ daily: DAILY, timezone: 'America/New_York' }), { status: 200 });

describe('WeatherService.getForecast', () => {
  let fetchMock: jest.Mock<typeof fetch>;
  let service: WeatherService;

  /** Resolve getForecast while stepping fake timers through timeouts and backoff. */
  const run = async () => {
    const p = service.getForecast();
    await jest.runAllTimersAsync();
    return p;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock;
    const garmin = {
      getLastGarminPoint: () =>
        Promise.resolve({
          latitude: 35.5,
          longitude: -83.5,
          timestamp: '2026-06-01T12:00:00Z',
        }),
    } as unknown as GarminService;
    service = new WeatherService(garmin);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the forecast on success and serves the next call from cache', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()));
    const first = await run();
    expect(first).toMatchObject({ latitude: 35.5, forecast: DAILY, timezone: 'America/New_York' });
    await run();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a non-2xx response and recovers without caching the bad body', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"reason":"busy"}', { status: 503 }))
      .mockResolvedValueOnce(okResponse());
    const result = await run();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ forecast: DAILY });
  });

  it('returns an error and caches nothing after all attempts fail, then recovers later', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('{}', { status: 500 })));
    const failed = await run();
    expect(failed).toEqual({ error: expect.any(String) });
    expect(failed).not.toHaveProperty('forecast');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()));
    const later = await run();
    expect(later).toMatchObject({ forecast: DAILY });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung request on timeout and treats it as a failure', async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    );
    const result = await run();
    expect(result).toEqual({ error: expect.any(String) });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
