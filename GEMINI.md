# Haamika — Engineering Rules for the Build Agent

Read `docs/SPEC.md` before every task. The spec is the source of truth. If something is unclear, choose the simplest option consistent with the spec and note it in your summary.

## How to work
1. Work in the phase you are given. Do not start later phases early.
2. Before writing code, show a short plan (files to create or change, tests to add). Wait for approval if in Planning Mode.
3. After each phase, run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. Fix every failure before reporting done.
4. End each phase with: what was built, which requirement IDs (R1–R9) it covers, test results, and any open issues.
5. Commit at the end of each phase with a clear message (e.g. `feat(schedule): dose windows and adherence engine (R1, R6)`). Work on the `main` branch only.

## Code quality
- TypeScript `strict: true`. No `any`, no `@ts-ignore`, no unused code, no commented-out code, no `console.log` (use the logger).
- Small, single-purpose modules. Business rules live in `src/server/services` as **pure functions** with no I/O, so they are easy to test.
- Data access only through the `Repository` interface (`memoryRepository` for local/tests, `firestoreRepository` for production). Routes never call Firestore directly.
- Shared zod schemas in `src/shared/schemas.ts` are used by both server validation and web forms.
- Descriptive names. JSDoc on exported functions explaining *why*, not *what*.
- Consistent formatting via Prettier. ESLint must pass with zero warnings.
- Pin exact dependency versions in `package.json` (no `^`, no `~`, no `latest`). Keep dependencies minimal; do not add a library when a few lines of code will do.

## Security (never compromise)
- Never commit secrets, keys, tokens or real personal data. Only `.env.example` with placeholders.
- Validate every request body, param and query with zod. Reject unknown fields.
- Every protected route uses session middleware **and** `requireRole`, and scopes every read/write to the session's `circleId`.
- Hash PINs with `crypto.scrypt` + random salt; compare with `timingSafeEqual`. Hash circle codes, invite codes and doctor tokens with SHA-256 before storing.
- Cookies: `HttpOnly`, `Secure` (in production), `SameSite=Strict`. Check the `Origin` header on state-changing requests.
- helmet with strict CSP; no inline scripts; never use `dangerouslySetInnerHTML`.
- Error responses never include stack traces or internal details. Logs never include PINs, codes, tokens, emails or health details.
- Gemini: send no names or contact details (use `piiScrub`); always set a timeout; always have a non-AI fallback; Gemini never makes decisions.
- No medical or dosing advice anywhere in the product.

## Accessibility (WCAG 2.1 AA; elder screens stricter)
- Semantic HTML first; ARIA only when needed. Every input has a `<label>`.
- Keyboard accessible everything; visible focus; dialogs trap and restore focus.
- Elder screens: text 22–28 px, contrast ≥ 7:1, touch targets ≥ 56 px, no typing required.
- Never rely on color alone. Respect `prefers-reduced-motion`. Set `lang` per language.
- Run `eslint-plugin-jsx-a11y` and vitest-axe tests on key screens.

## Testing
- Write tests alongside features, not at the end. Name tests with requirement IDs, e.g. `it("R9: medicine proposed by family stays inactive until the elder approves")`.
- Use a fake clock, fake mailer and fake Gemini client; tests never hit the network.
- Cover permission failures (403), invalid input (400), lockout, cross-circle access, and reminder dedupe.
- Keep coverage ≥ 80% for `src/server/services` and `src/server/routes`.

## Efficiency
- No N+1 queries; batch reads per circle. Single-field Firestore queries only.
- Cache Gemini outputs. Use compression and long-cache headers for hashed assets. Code-split routes.

## Deployment
- One container on Cloud Run serves the API and the built web app. Listen on `process.env.PORT`.
- Multi-stage `Dockerfile` on `node:22-slim`, `npm ci`, build, then a runtime stage with `npm ci --omit=dev`, running as the non-root `node` user.
- `GET /healthz` returns `{ ok: true }` without touching external services.
- Validate configuration at startup with zod and fail fast with a clear (secret-free) message.

## Repository hygiene
- Keep the repo small (< 5 MB): no `node_modules`, `dist`, `coverage`, large images or videos.
- `.gitignore`, `.dockerignore`, `.gcloudignore` kept accurate.
- README always reflects what actually works. Never claim a feature that is not implemented.
