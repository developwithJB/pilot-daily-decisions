import {
  PROVIDER_CONTRACT_VERSION,
  type ProviderResult,
  type WeatherContextV1,
  type WeatherProvider,
  type WeatherRequest,
} from "./contracts";

const CHICAGO = { latitude: 41.8781, longitude: -87.6298, city: "Chicago" };
const weatherLabels: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy showers",
  95: "Thunderstorm",
};

type OpenMeteoForecast = {
  timezone: string;
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation_probability: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: number[];
  };
  daily: { temperature_2m_max: number[] };
};

const labelHour = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: timezone }).format(new Date(iso));

export function normalizeOpenMeteo(
  payload: OpenMeteoForecast,
  location: string,
  now = new Date(),
): ProviderResult<WeatherContextV1> {
  const start = Math.max(0, payload.hourly.time.findIndex((item) => new Date(item).getTime() >= now.getTime()));
  const sample = [start, start + 4, start + 8, start + 12].filter((index) => payload.hourly.time[index]);
  const window = payload.hourly.precipitation_probability.slice(start, start + 24);
  const eveningIndex = payload.hourly.time.findIndex((item, index) => index >= start && labelHour(item, payload.timezone).startsWith("6 PM"));
  const current = payload.current;
  const rain = Math.max(current.precipitation_probability || 0, ...window);
  const flags = [
    current.temperature_2m < 62 && "cool_now",
    (payload.daily.temperature_2m_max[0] || current.temperature_2m) >= 75 && "warm_later",
    rain >= 40 && "possible_rain",
    current.wind_speed_10m >= 15 && "breezy",
  ].filter((value): value is string => Boolean(value));
  return {
    data: {
      location,
      timezone: payload.timezone,
      currentTemperature: Math.round(current.temperature_2m),
      currentFeelsLike: Math.round(current.apparent_temperature),
      dayHigh: Math.round(payload.daily.temperature_2m_max[0] || current.temperature_2m),
      eveningFeelsLike: Math.round(payload.hourly.apparent_temperature[eveningIndex >= 0 ? eveningIndex : Math.min(start + 12, payload.hourly.apparent_temperature.length - 1)] || current.apparent_temperature),
      rainProbability: Math.round(rain),
      windMph: Math.round(current.wind_speed_10m),
      humidity: Math.round(current.relative_humidity_2m),
      condition: weatherLabels[current.weather_code] || "Current conditions",
      weatherFlags: flags,
      hours: sample.map((index) => ({ time: labelHour(payload.hourly.time[index], payload.timezone), temperature: Math.round(payload.hourly.temperature_2m[index]) })),
    },
    meta: {
      contractVersion: PROVIDER_CONTRACT_VERSION,
      provider: "open-meteo",
      mode: "live",
      fetchedAt: now.toISOString(),
      freshUntil: new Date(now.getTime() + 15 * 60_000).toISOString(),
      confidence: "high",
    },
    warnings: [],
  };
}

async function fetchJson<T>(url: URL, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("WEATHER_PROVIDER_FAILED");
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly id = "open-meteo";

  async getForecast(input: WeatherRequest) {
    let latitude = input.latitude;
    let longitude = input.longitude;
    let location = input.city?.trim() || CHICAGO.city;
    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && input.city?.trim()) {
      const geocode = new URL("https://geocoding-api.open-meteo.com/v1/search");
      geocode.search = new URLSearchParams({ name: input.city.trim(), count: "1", language: "en", format: "json" }).toString();
      const result = await fetchJson<{ results?: Array<{ latitude: number; longitude: number; name: string; admin1?: string }> }>(geocode);
      const match = result.results?.[0];
      if (!match) throw new Error("WEATHER_LOCATION_NOT_FOUND");
      latitude = match.latitude;
      longitude = match.longitude;
      location = [match.name, match.admin1].filter(Boolean).join(", ");
    }
    latitude = Number.isFinite(latitude) ? latitude : CHICAGO.latitude;
    longitude = Number.isFinite(longitude) ? longitude : CHICAGO.longitude;
    const forecast = new URL("https://api.open-meteo.com/v1/forecast");
    forecast.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m",
      hourly: "temperature_2m,apparent_temperature,precipitation_probability",
      daily: "temperature_2m_max",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: "auto",
      forecast_days: "2",
    }).toString();
    return normalizeOpenMeteo(await fetchJson<OpenMeteoForecast>(forecast), location);
  }
}

export class ManualWeatherProvider implements WeatherProvider {
  readonly id = "manual";

  async getForecast(input: WeatherRequest): Promise<ProviderResult<WeatherContextV1>> {
    const temperature = Math.round(Number(input.manual?.currentTemperature ?? 68));
    const rain = Math.min(100, Math.max(0, Math.round(Number(input.manual?.rainProbability ?? 0))));
    const now = new Date();
    return {
      data: {
        location: input.manual?.location?.trim() || input.city?.trim() || "Manual location",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        currentTemperature: temperature,
        currentFeelsLike: Math.round(Number(input.manual?.currentFeelsLike ?? temperature)),
        dayHigh: Math.round(Number(input.manual?.dayHigh ?? temperature)),
        eveningFeelsLike: Math.round(Number(input.manual?.eveningFeelsLike ?? temperature)),
        rainProbability: rain,
        windMph: Math.max(0, Math.round(Number(input.manual?.windMph ?? 0))),
        humidity: Math.min(100, Math.max(0, Math.round(Number(input.manual?.humidity ?? 50)))),
        condition: input.manual?.condition?.trim() || (rain >= 40 ? "Possible rain" : "User-entered conditions"),
        weatherFlags: [temperature < 62 && "cool_now", rain >= 40 && "possible_rain"].filter((value): value is string => Boolean(value)),
        hours: [],
      },
      meta: { contractVersion: PROVIDER_CONTRACT_VERSION, provider: "manual", mode: "manual", fetchedAt: now.toISOString(), confidence: "medium" },
      warnings: ["Manual weather is only as current as the values you entered."],
    };
  }
}

export const getWeatherProvider = (mode: string | null): WeatherProvider =>
  mode === "manual" ? new ManualWeatherProvider() : new OpenMeteoWeatherProvider();
