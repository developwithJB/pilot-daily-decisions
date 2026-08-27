type NWSPeriod = {
  startTime: string;
  temperature: number;
  shortForecast: string;
  windSpeed: string;
  isDaytime: boolean;
  probabilityOfPrecipitation?: { value: number | null };
  relativeHumidity?: { value: number | null };
};

const TIME_ZONE = "America/Chicago";

const maxWindMph = (value: string) => {
  const speeds = value.match(/\d+/g)?.map(Number) || [0];
  return Math.max(...speeds);
};

const apparentTemperature = (temperature: number, windMph: number, humidity: number) => {
  if (temperature <= 50 && windMph > 3) {
    return Math.round(35.74 + 0.6215 * temperature - 35.75 * windMph ** 0.16 + 0.4275 * temperature * windMph ** 0.16);
  }
  if (temperature >= 80 && humidity >= 40) {
    return Math.round(-42.379 + 2.04901523 * temperature + 10.14333127 * humidity - 0.22475541 * temperature * humidity - 0.00683783 * temperature ** 2 - 0.05481717 * humidity ** 2 + 0.00122874 * temperature ** 2 * humidity + 0.00085282 * temperature * humidity ** 2 - 0.00000199 * temperature ** 2 * humidity ** 2);
  }
  return temperature;
};

const hourLabel = (value: string) => new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  timeZone: TIME_ZONE,
}).format(new Date(value));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = url.searchParams.get("lat") || "41.8781";
  const lon = url.searchParams.get("lon") || "-87.6298";

  try {
    const headers = {
      "User-Agent":
        "PilotDailyDecisions/2.0 github.com/developwithjbhh/pilot-daily-decisions",
      Accept: "application/geo+json",
    };
    const point = await fetch(`https://api.weather.gov/points/${lat},${lon}`, { headers, cache:"no-store", signal:AbortSignal.timeout(5000) });
    if (!point.ok) throw new Error("NWS point lookup failed");
    const pointData = await point.json() as { properties:{ forecastHourly:string; relativeLocation?:{ properties?:{ city?:string } } } };
    const forecast = await fetch(pointData.properties.forecastHourly, { headers, cache:"no-store", signal:AbortSignal.timeout(5000) });
    if (!forecast.ok) throw new Error("NWS forecast lookup failed");
    const data = await forecast.json() as { properties:{ periods:NWSPeriod[]; updated?:string } };
    const periods = data.properties.periods.slice(0, 24);
    if (!periods.length) throw new Error("NWS forecast was empty");

    const current = periods[0];
    const temperatures = periods.map((period) => period.temperature);
    const rainProbability = Math.max(...periods.map((period) => period.probabilityOfPrecipitation?.value || 0));
    const windMph = Math.max(...periods.map((period) => maxWindMph(period.windSpeed)));
    const humidity = current.relativeHumidity?.value || 0;
    const sampleIndexes = [0, 4, 8, 12].filter((index) => periods[index]);
    const evening = periods.find((period) => hourLabel(period.startTime).startsWith("6 PM")) || periods[Math.min(12, periods.length - 1)];
    const condition = current.shortForecast || "Current conditions";
    const flags = [
      current.temperature < 62 && "cool_now",
      Math.max(...temperatures) >= 75 && "warm_later",
      rainProbability >= 40 && "possible_rain",
      windMph >= 15 && "breezy",
    ].filter(Boolean);

    return Response.json({
      source:"nws",
      location:pointData.properties.relativeLocation?.properties?.city || "Chicago",
      currentTemperature:current.temperature,
      currentFeelsLike:apparentTemperature(current.temperature, maxWindMph(current.windSpeed), humidity),
      dayHigh:Math.max(...temperatures),
      eveningFeelsLike:evening.temperature,
      rainProbability,
      windMph,
      condition,
      weatherFlags:flags,
      hours:sampleIndexes.map((index) => ({ time:hourLabel(periods[index].startTime), temperature:periods[index].temperature })),
      updatedAt:data.properties.updated || new Date().toISOString(),
    }, { headers:{ "Cache-Control":"public, max-age=600, stale-while-revalidate=600" } });
  } catch {
    return Response.json({
      source:"unavailable",
      location:"Chicago",
      message:"Live weather is temporarily unavailable.",
    }, { status:503, headers:{ "Cache-Control":"no-store" } });
  }
}
