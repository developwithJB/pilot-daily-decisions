# Syndy Studio V2

Run `npm run dev:v2` from the repository root, then open http://127.0.0.1:4175. Use `STUDIO_PORT=4176` if another local demo already occupies that port.

This is a standalone React/Vite viewer. The main Pilot app remains on its separate port. Weather uses the shared Open-Meteo provider directly. Google Calendar goes through Vite’s `/api/calendar` proxy to the authenticated Pilot backend (`PILOT_BACKEND_ORIGIN`, default `http://127.0.0.1:3000`). Detailed setup and screenshot walkthrough: [root README](../../README.md).

## Included media

`public/assets/` includes two fictional generated fashion models/outfits, three generated environments, and existing generic garment cutouts. No source photo of a real person was used to make the public sample models. Sydney’s original personal media stays outside this public checkout.

- `tailored.png` / `tailored.mp4`: trench, sweater, trousers, loafers
- `evening.png` / `evening.mp4`: cobalt midi dress, gold heels
- `studio.png`, `riverwalk.png`, `rooftop.png`: environment backdrops
- Named garment PNGs: inspection-card illustrations

The supplied sample footage can have generative inconsistencies and its subjects are illustrative. It is not a calibrated body or garment model.

## Using your own media

Generate your assets with a tool/provider you have access to; this app does not submit generation jobs.

1. Start with an authorized full-body reference. Keep reference photos outside the public asset folder and source control.
2. Generate a front-facing outfit still with **GPT Image 2.5** on Higgsfield or a compatible image tool. Preserve the intended identity and outfit. Keep the entire head and both shoes within the frame.
3. Use that still as the first-frame reference for a **12-second turntable video**. The sample was authored using Seedance 2.5 on Higgsfield. Example prompt:

   > Locked camera, one continuous complete 360-degree turn. Front at 0 seconds, right at 3, back at 6, left at 9, front at 12. Entire head and both shoes visible at every moment. Preserve identity, exact outfit and shoe details. Even neutral lighting. Uniform saturated chroma green #00ff00 background and floor, with no shadows, props, zoom or cuts.

4. Inspect the full clip for missing views, changed garments and cropped shoes. Prefer non-green clothes, since green parts are removed by the compositor.
5. Place authorized outputs at the image/video paths above **only in a private local copy or protected deployment**. Update outfit names and garment cards in `src/main.tsx` when changing the garments. Source videos should support browser seeking (MP4/H.264 with a usable index).
6. Restart and verify all angles, close-ups and PNG export.

Image source prompts for the public samples requested an entirely fictional adult model with a short dark bob, neutral studio lighting, green background and the named outfits; no personal reference input was supplied. Backgrounds were generated as empty fashion studio/Chicago terraces for later compositing. Generation may cost provider credits; ordinary use of the bundled viewer does not.

## Runtime behavior

- Rotation seeks generated video; angle labels are approximate.
- WebGL removes the green backdrop without uploading anything.
- Uploaded scene images use temporary blob URLs and are revoked when replaced or unmounted.
- Save stores only the sample outfit and preset scene in `localStorage`.
- Calendar snapshots remain in memory and discard private textual fields.
- Live weather refreshes every 15 minutes; Google every 5 minutes while open.
- The date/context view advances while the page is open.
- Errors keep live data separate from manual/imported data; failed Google refreshes clear stale events.

## Build

`npm run build:v2` writes to `work/syndy-v2/build`. Run `npm run preview:v2` to serve the build locally with the calendar proxy. Static hosting needs its own proxy/auth backend for live Google Calendar.
