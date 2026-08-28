import { getWeatherProvider } from "../../../lib/providers/weather-provider";

const finite = (value: string | null) => {
  const number = Number(value);
  return value !== null && Number.isFinite(number) ? number : undefined;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("source");
  const provider = getWeatherProvider(mode);
  try {
    const result = await provider.getForecast({
      latitude: finite(url.searchParams.get("lat")),
      longitude: finite(url.searchParams.get("lon")),
      city: url.searchParams.get("city") || undefined,
      manual: mode === "manual" ? {
        location: url.searchParams.get("city") || "Manual location",
        currentTemperature: finite(url.searchParams.get("temperature")),
        rainProbability: finite(url.searchParams.get("rain")),
        windMph: finite(url.searchParams.get("wind")),
        condition: url.searchParams.get("condition") || undefined,
      } : undefined,
    });
    return Response.json(
      { source: result.meta.provider, ...result.data, provider: result.meta, warnings: result.warnings, updatedAt: result.meta.fetchedAt },
      { headers: { "Cache-Control": mode === "manual" ? "private, no-store" : "public, max-age=600, stale-while-revalidate=600" } },
    );
  } catch (error) {
    const code = error instanceof Error && error.message === "WEATHER_LOCATION_NOT_FOUND"
      ? "WEATHER_LOCATION_NOT_FOUND"
      : "WEATHER_UNAVAILABLE";
    return Response.json(
      { source: "unavailable", location: url.searchParams.get("city") || "Chicago", code, message: code === "WEATHER_LOCATION_NOT_FOUND" ? "We could not find that city. Check the spelling or enter conditions manually." : "Live weather is temporarily unavailable. Enter conditions manually or try again." },
      { status: code === "WEATHER_LOCATION_NOT_FOUND" ? 404 : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
