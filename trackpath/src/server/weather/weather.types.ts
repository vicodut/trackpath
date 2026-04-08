export interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  weathercode: number[];
  windspeed_10m_max: number[];
  windgusts_10m_max: number[];
}

export interface OpenMeteoResponse {
  daily: OpenMeteoDaily;
  timezone: string;
}

export interface WeatherResponse {
  latitude: number;
  longitude: number;
  pointTimestamp: string;
  forecast: OpenMeteoDaily;
  timezone: string;
}
