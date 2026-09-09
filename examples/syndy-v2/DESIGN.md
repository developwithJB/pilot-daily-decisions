# Syndy V2 — local fitting studio

A personal fashion studio for inspecting a digital fashion likeness, full outfits and shoes across environments. Retain Pilot’s warm editorial voice. References: the repository’s original Sydney screens and garment assets (local); https://www.vogue.com/fashion for spacious editorial hierarchy (inspiration only).

## Tokens
Ivory background #f7f5f0; white surfaces #ffffff; ink #242820; muted text #72756c; border #e3e4da; olive action #536448; pale sage #e8ecdf. Serif display Georgia; existing system sans for controls. Spacing 4/8/12/16/24/32/48. Radius 10 for controls, 20 for cards, 28 for stage. Restrained 0 10px 35px #24282008 shadow. Motion 160ms; respect prefers-reduced-motion; rotation begins paused.

## Layout and components
Desktop: compact left navigation rail; page heading; expansive center stage plus a 300px wardrobe inspector. Stage dominates; keep entire head and both shoes visible in full-body view. Floating scene label and viewer tools. Environment thumbnails beneath stage. Right-hand garment cards show original local asset cutouts, outfit identity, and selected state. Mobile below 800px: horizontal navigation; stage first, wardrobe below; minimum 44px targets. Content usable at 390px without horizontal scroll.

## States and accessibility
Native labelled buttons and range input; aria-pressed selections; keyboard left/right rotation; visible focus rings; aria-live loading/error/save status. Show poster while video loads. Explicit failure message with retry. Save selection locally; custom scene stays in the session. Label output as AI visual preview, with approximate rotation angle and no physical-fit claims.

## Acceptance
Verify desktop/mobile, fictional sample likeness, shoes in frame, scene switching, drag/scrub, close-up, export, local save/reload, empty upload and media errors. Reject generic mannequin substitution, fake provider integration, nonfunctional generation buttons, cropped feet, noisy dashboards, or claims of true 3D geometry from generated video.

## Daily context extension
A compact white panel above the stage reuses existing provider contracts for current weather and calendar context. Every mode names its source. Two-column desktop layout stacks at 650px. Suggestions explicitly compare only the two rendered sample looks. Never label an imported ICS file as live sync.
