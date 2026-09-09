import { useEffect, useRef, useState } from "react";
import { CalendarDays, CloudSun, RefreshCw } from "lucide-react";
import {
  OpenMeteoWeatherProvider,
  ManualWeatherProvider,
} from "../../../lib/providers/weather-provider";
import { parseIcsSignals } from "../../../lib/calendar-ics";
import type {
  CalendarSignalV1,
  WeatherContextV1,
} from "../../../lib/providers/contracts";
import {
  suggestStudioLook,
  todaySignals,
  readGoogleCalendar,
  planCategories,
} from "./daily-context";

declare const __PILOT_ORIGIN__: string;
const categories = planCategories;
export function DailyContext({ onChoose }: { onChoose: (id: string) => void }) {
  const [city, setCity] = useState("Chicago");
  const [location, setLocation] = useState("Chicago");
  const [weather, setWeather] = useState<WeatherContextV1 | null>(null);
  const [weatherState, setWeatherState] = useState("Loading weather…");
  const [manualWeather, setManualWeather] = useState(false);
  const [temperature, setTemperature] = useState("68");
  const [rain, setRain] = useState("0");
  const [calendarMode, setCalendarMode] = useState<"manual" | "ics" | "google">(
    "manual",
  );
  const [dayType, setDayType] = useState("Office");
  const [events, setEvents] = useState<CalendarSignalV1[]>([]);
  const [calendarState, setCalendarState] = useState("Manual plan");
  const [calendarLive, setCalendarLive] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [refresh, setRefresh] = useState(0);
  const [importError, setImportError] = useState("");
  const ics = useRef<HTMLInputElement>(null);
  const timezone =
    weather?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let disposed = false;
    async function update() {
      if (!disposed) setWeatherState("Refreshing weather…");
      try {
        const result = await (
          manualWeather
            ? new ManualWeatherProvider()
            : new OpenMeteoWeatherProvider()
        ).getForecast({
          city: location,
          manual: {
            currentTemperature: Number(temperature),
            rainProbability: Number(rain),
          },
        });
        if (disposed) return;
        setWeather(result.data);
        setWeatherState(
          `${manualWeather ? "Manual weather" : "Live · Open-Meteo"} · ${new Date(result.meta.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        );
      } catch {
        if (!disposed) {
          setWeather(null);
          setWeatherState(
            "Live weather unavailable. Retry or enter conditions.",
          );
        }
      }
    }
    void update();
    const timer = setInterval(() => void update(), 15 * 60_000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [location, manualWeather, temperature, rain, refresh]);
  useEffect(() => {
    if (calendarMode !== "google") return;
    let disposed = false;
    async function sync() {
      setCalendarState("Syncing Google Calendar…");
      try {
        const body = await readGoogleCalendar();
        if (disposed) return;
        if (!body.connected) {
          setCalendarLive(false);
          setEvents([]);
          setCalendarState(
            body.configured
              ? "Connect Google Calendar in Pilot."
              : "Configure Google OAuth in the Pilot backend.",
          );
          return;
        }
        setEvents(body.events);
        setCalendarLive(true);
        setCalendarState(
          `Live · Google · ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        );
      } catch (error) {
        if (!disposed) {
          setCalendarLive(false);
          setEvents([]);
          setCalendarState(
            error instanceof Error ? error.message : "Calendar sync failed.",
          );
        }
      }
    }
    void sync();
    const timer = setInterval(() => void sync(), 5 * 60_000);
    const focus = () => void sync();
    window.addEventListener("focus", focus);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [calendarMode, refresh]);
  const activities =
    calendarMode === "manual"
      ? [dayType]
      : [
          ...new Set(
            todaySignals(events, now, timezone).map((e) => e.category),
          ),
        ];
  const suggestion = suggestStudioLook(weather, activities);
  async function importCalendar(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setImportError("Choose an ICS file under 2 MB.");
      return;
    }
    try {
      const text = await file.text();
      // Avoid silently misreading named-zone or recurring events as local single events.
      if (
        /^(?:RRULE|RDATE|EXDATE|RECURRENCE-ID)[;:]/m.test(text) ||
        /^DT(?:START|END);[^\r\n]*TZID=/m.test(text)
      )
        throw new Error(
          "Export expanded events in UTC, or use Google sync. Recurrence and named-zone ICS rules are not supported here.",
        );
      const parsed = parseIcsSignals(text);
      if (!parsed.length)
        throw new Error("No dated events found in this ICS file.");
      setEvents(parsed);
      setCalendarMode("ics");
      setCalendarLive(false);
      setCalendarState("Imported ICS snapshot · re-import for changes");
      setImportError("");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Could not read the calendar.",
      );
    }
  }
  return (
    <section className="daily-context" aria-label="Daily weather and calendar">
      <div className="context-heading">
        <div>
          <p className="eyebrow">DRESSED FOR YOUR DAY</p>
          <h2>
            {new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              timeZone: timezone,
            }).format(now)}
          </h2>
        </div>
        <button
          onClick={() => setRefresh((v) => v + 1)}
          aria-label="Refresh weather and calendar"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      <div className="context-grid">
        <div>
          <h3>
            <CloudSun size={17} /> Weather
          </h3>
          <p className="context-status" role="status">
            {weatherState}
          </p>
          {weather && (
            <p className="conditions">
              <strong>{weather.currentTemperature}°F</strong>{" "}
              {weather.condition}
              <span>
                Feels {weather.currentFeelsLike}° · Evening{" "}
                {weather.eveningFeelsLike}° · Rain {weather.rainProbability}%
              </span>
              <small>
                {weather.location} · {weather.timezone}
              </small>
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setLocation(city.trim() || "Chicago");
              setManualWeather(false);
              setRefresh((v) => v + 1);
            }}
          >
            <label htmlFor="weather-city">City</label>
            <div className="context-input-row">
              <input
                id="weather-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={100}
              />
              <button type="submit">Update</button>
            </div>
          </form>
          <label className="manual-toggle">
            <input
              type="checkbox"
              checked={manualWeather}
              onChange={(e) => setManualWeather(e.target.checked)}
            />{" "}
            Enter weather manually
          </label>
          {manualWeather && (
            <div className="manual-fields">
              <label>
                Temperature °F
                <input
                  aria-label="Manual temperature"
                  type="number"
                  min="-80"
                  max="140"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </label>
              <label>
                Rain %
                <input
                  aria-label="Manual rain probability"
                  type="number"
                  min="0"
                  max="100"
                  value={rain}
                  onChange={(e) => setRain(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>
        <div>
          <h3>
            <CalendarDays size={17} /> Calendar
          </h3>
          <p className="context-status" role="status">
            {calendarMode === "manual" ? "Manual plan" : calendarState}
          </p>
          <label htmlFor="calendar-source">Plan source</label>
          <select
            id="calendar-source"
            value={calendarMode}
            onChange={(e) => {
              setCalendarMode(e.target.value as typeof calendarMode);
              setEvents([]);
              setCalendarLive(false);
              if (e.target.value === "ics")
                setCalendarState("Import an ICS file below.");
            }}
          >
            <option value="manual">Manual plan</option>
            <option value="ics">Local ICS snapshot</option>
            <option value="google">Google Calendar sync</option>
          </select>
          {calendarMode === "manual" ? (
            <>
              <label htmlFor="day-plan">Today’s plan</label>
              <select
                id="day-plan"
                value={dayType}
                onChange={(e) => setDayType(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </>
          ) : (
            <p className="today-plans">
              {activities.length
                ? activities.join(" → ")
                : calendarMode === "google" && !calendarLive
                  ? "No synced events available."
                  : "No events for today in this calendar."}
            </p>
          )}
          {calendarMode === "ics" && (
            <>
              <button
                className="context-action"
                onClick={() => ics.current?.click()}
              >
                Import calendar (.ics)
              </button>
              <small>
                Local snapshot, not continuous sync. UTC or floating dates only.
              </small>
            </>
          )}
          {calendarMode === "google" && (
            <div className="calendar-links">
              <a href={__PILOT_ORIGIN__} target="_blank" rel="noreferrer">
                1. Sign in to Pilot
              </a>
              <a
                href={`${__PILOT_ORIGIN__}/api/calendar/connect`}
                target="_blank"
                rel="noreferrer"
              >
                2. Connect Google
              </a>
              <small>
                Refreshes every 5 minutes while open. Only event categories and
                times are used.
              </small>
            </div>
          )}
          <input
            ref={ics}
            hidden
            type="file"
            accept=".ics,text/calendar"
            onChange={(e) => {
              void importCalendar(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {importError && (
            <p role="alert" className="context-error">
              {importError}
            </p>
          )}
        </div>
      </div>
      <div className="context-suggestion">
        <div>
          <strong>{suggestion.reason}</strong>
          <p>
            {suggestion.warnings.join(" ") ||
              "Compare the two prepared looks below."}
          </p>
        </div>
        <button onClick={() => onChoose(suggestion.outfit)}>
          Preview suggested look
        </button>
      </div>
      <small className="context-attribution">
        Weather:{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
        . Suggestions compare the two demo looks; no new garments are generated.
      </small>
    </section>
  );
}
