# Haamika — Security & Privacy Architecture

Security and privacy are non-negotiable foundations for Haamika. Elderly healthcare data is protected through multi-layered defenses.

---

## 1. Authentication & PIN Security

- **Hashing**: All member PINs are hashed using Node's native `crypto.scrypt` with a cryptographically secure per-member salt (32 bytes). PIN comparison is performed using `crypto.timingSafeEqual` to eliminate timing attacks.
- **Account Lockout**: After 5 failed PIN attempts, the account is locked for 15 minutes (`lockedUntil` timestamp).
- **Hashed Tokens**: Circle codes (`XXXX-XXXX`), single-use invite codes, and doctor visit tokens are stored exclusively as SHA-256 hashes (`tokens.ts`).

---

## 2. Session Management & CSRF Defense

- **JWT Session Cookie**: Session tokens are signed using `jose` (HS256) with a minimum 32-character secret (`SESSION_SECRET`). The cookie is configured with:
  - `HttpOnly: true` (inaccessible to JavaScript)
  - `SameSite: Strict` (mitigates CSRF)
  - `Secure: true` in production environments
- **Origin Header Check**: State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) are inspected by [originCheck.ts](file:///C:/Projects/Haamika/src/server/middleware/originCheck.ts) to verify the `Origin` header matches the server's `Host` header.
- **Reverse Proxy Trust**: `app.set('trust proxy', 1)` ensures secure cookie transmission and IP extraction behind Cloud Run's load balancer.

---

## 3. Role-Based Access Control (RBAC)

Every protected route enforces the permission matrix defined in SPEC §6.6 using `requireRole`:

| Capability | Elder | Family | Caretaker | Doctor (Token) |
| :--- | :---: | :---: | :---: | :---: |
| View schedule & medicines | ✓ | ✓ | ✓ | Read-only |
| Mark taken / skip / log reading | ✓ | ✓ | ✓ | ✗ |
| Propose medicine changes | ✗ | ✓ | ✗ | ✗ |
| Approve / decline proposals (R9) | ✓ | ✗ (403) | ✗ (403) | ✗ |
| Manage appointments & routines | ✗ | ✓ | ✗ (403) | ✗ |
| Manage members & invites | ✗ | ✓ | ✗ (403) | ✗ |
| Remove member | ✓ | ✓ (except elder) | ✗ (403) | ✗ |
| View activity log & Outbox | ✓ | ✓ | ✗ (403) | ✗ |

Every database read and write is strictly partitioned by `circleId`. Cross-circle data leaks are impossible and covered by automated test suites.

---

## 4. Network & Content Security Policy (CSP)

Configured via `helmet` in [security.ts](file:///C:/Projects/Haamika/src/server/middleware/security.ts):
- `defaultSrc: ["'self'"]`
- `scriptSrc: ["'self'"]` (no inline scripts, no `eval`)
- `workerSrc: ["'self'"]` (Service Worker)
- `manifestSrc: ["'self'"]` (Web App Manifest)
- `objectSrc: ["'none'"]`
- `frameSrc: ["'none'"]`
- `HSTS`: 1 year duration (`maxAge: 31536000`)

---

## 5. Responsible AI & PII Protection

1. **Scrubbing Before Gemini**: All circle member names are replaced with role tokens (e.g. `[FAMILY_1]`) and contact details are scrubbed before transcripts are sent to Vertex AI Gemini ([piiScrub.ts](file:///C:/Projects/Haamika/src/server/services/piiScrub.ts)).
2. **Deterministic Code Decides**: Gemini is utilized exclusively for natural language intent classification within a fixed enum. It never mutates state or makes scheduling decisions.
3. **No Medical Dosing Guidance**: Inquiries asking for dosage adjustments return a deterministic safe response referring the elder to their physician, while simultaneously alerting the family.
4. **Zero Client Firestore Access**: `firestore.rules` denies all direct client operations (`allow read, write: if false`).
