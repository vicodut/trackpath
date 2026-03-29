import { useState, useEffect } from 'react';

interface DayForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitation: number;
  precipProb: number;
  windMax: number;
  gustMax: number;
  code: number;
}

const WEATHER_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '❄️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

function weatherIcon(code: number): string {
  return WEATHER_ICONS[code] || '🌡️';
}

export function Weather() {
  const [forecast, setForecast] = useState<DayForecast[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
          return;
        }
        const days: DayForecast[] = data.forecast.time.map((date: string, i: number) => ({
          date,
          tempMax: data.forecast.temperature_2m_max[i],
          tempMin: data.forecast.temperature_2m_min[i],
          precipitation: data.forecast.precipitation_sum[i],
          precipProb: data.forecast.precipitation_probability_max[i],
          windMax: data.forecast.windspeed_10m_max[i],
          gustMax: data.forecast.windgusts_10m_max[i],
          code: data.forecast.weathercode[i],
        }));
        setForecast(days.slice(0, 2));
      })
      .catch(() => setError('Failed to load weather'));
  }, []);

  if (error) return null;
  if (!forecast) return null;

  return (
    <div className="weather">
      <div className="weather-title">Weather at last position</div>
      <div className="weather-days">
        {forecast.map((day) => {
          const label = isToday(day.date) ? 'Today' : isTomorrow(day.date) ? 'Tomorrow' : formatDay(day.date);
          return (
            <div key={day.date} className="weather-day">
              <div className="weather-day-label">{label}</div>
              <div className="weather-day-icon">{weatherIcon(day.code)}</div>
              <div className="weather-day-temp">
                <span className="temp-max">{Math.round(day.tempMax)}°</span>
                <span className="temp-min">{Math.round(day.tempMin)}°</span>
              </div>
              <div className="weather-day-details">
                {day.precipProb > 0 && <span>💧 {day.precipProb}%</span>}
                <span>💨 {Math.round(day.windMax)} km/h</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isToday(date: string) {
  return date === new Date().toISOString().split('T')[0];
}

function isTomorrow(date: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date === tomorrow.toISOString().split('T')[0];
}

function formatDay(date: string) {
  return new Date(date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' });
}
