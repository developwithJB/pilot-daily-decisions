# Security policy

## Reporting

Do not open a public issue for a vulnerability or privacy incident. Use GitHub's private vulnerability reporting for this repository. Include affected routes, impact, reproduction steps using non-personal test data, and any proposed mitigation. Do not access data that is not yours or degrade a live service while testing.

## Supported version

Security fixes target the default branch. Demo mode is the only credential-free supported deployment. Operators enabling the authenticated bundle or live providers own secret management, retention scheduling, monitoring, backups, and the release gates in `TESTING.md`.

## Baseline expectations

- Server identity comes from validated Supabase authentication, never a client user ID.
- Personal media buckets remain private and owner-prefixed.
- Calendar tokens are encrypted with a dedicated 32-byte key.
- Signed URLs are short-lived and must not be logged.
- Provider credentials are server-only; flags alone are not authorization.
- Account and media deletion failures remain retryable and observable.

## Dependency audit note

As of 2026-08-27, `npm audit --omit=dev` reports no known production dependency vulnerabilities. The full audit retains four moderate advisories in the legacy `drizzle-kit` development-server chain. npm's proposed automatic fix is a breaking downgrade, so it is not applied. Do not expose development tooling to untrusted networks; Dependabot and CI are configured so this exception can be removed when the migration toolchain offers a compatible fix.
