# Contributing

Thank you for improving Pilot. Keep changes focused, privacy-preserving, and honest about what recommendation or generative output can do.

1. Fork the repository and create a focused branch.
2. Copy `.env.example` to `.env.local`. Keep demo mode and all live-provider flags off unless you are testing a reviewed adapter with your own credentials.
3. Run `npm ci`, `npm run check`, and the relevant Playwright projects.
4. Add tests for user-visible behavior, provider normalization/failure states, and authorization boundaries.
5. Open a pull request with the problem, screenshots using sample data, test evidence, privacy impact, migration/rollback notes, and any provider or flag changes.

Never commit credentials, signed URLs, user IDs, calendar text, photos, production exports, or generated personal media. New dependencies need a reason, maintenance/license review, and should not duplicate platform capability. Database changes must be additive, owner-scoped by RLS, and documented in `docs/MIGRATIONS.md`.

Use issues for bugs and proposals. Security and privacy findings must follow `SECURITY.md`, not public issues.
