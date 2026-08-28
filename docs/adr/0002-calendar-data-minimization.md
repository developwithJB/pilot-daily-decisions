# ADR 0002: Normalize calendar data before persistence

Status: accepted.

Pilot needs wardrobe context, not a diary. Google and local ICS events are reduced to broad categories, start/end times, and a coarse place type. Descriptions, guests, detailed locations, and raw titles are discarded. ICS parsing occurs in the browser during onboarding. Google refresh tokens are encrypted at rest, and the API requests read-only calendar scope.
