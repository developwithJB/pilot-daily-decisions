# ADR 0001: Open-Meteo as the credential-free weather provider

Status: accepted.

Pilot uses Open-Meteo for city/coordinate forecasts because it supports the onboarding journey without a paid key and provides hourly temperature, apparent temperature, rain, wind, humidity, timezone, and weather codes. The adapter normalizes this data behind `WeatherProvider`, applies timeouts and a small retry, and returns freshness metadata. Manual entry is the required fallback. Vendor payloads do not enter recommendation code.
