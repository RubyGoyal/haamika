# Haamika — Product & Technical Specification

> **Haamika** (from the Hindi phrase *"haami bharna"* — to say yes, to give one's assent)
> *Haami aapki, fikar hamari* — Your yes, our care.

Haamika is an elderly care and medication management platform where **the elder only ever taps or talks**, while family and caretakers do all the setup and managing — and **nothing about the elder's medicines changes without the elder's "yes."**

---

## 1. Problem statement (verbatim from the challenge)

> **Elderly Care & Medication Management Platform**
>
> Develop a smart, interconnected healthcare management platform designed to help elderly individuals manage their daily medications, medical appointments, and healthcare routines while keeping their family members and caretakers informed.
>
> The platform should provide a shared ecosystem where elderly individuals, caretakers, and family members can access and manage an elderly person's healthcare profile through secure, passcode-based access. Authorized members should be able to view, add, edit, and manage medication schedules, track adherence, and monitor upcoming doctor appointments.
>
> The system should proactively send email reminders for missed medications, upcoming doses, and medical appointments, ensuring that important healthcare routines are never overlooked.
>
> The challenge is to go beyond a basic reminder application. Think creatively and develop innovative ways to make elderly care smarter, more accessible, reliable, and collaborative, while ensuring that elderly individuals remain at the centre of their own healthcare decisions.

## 2. Requirements traceability (every requirement → feature)

Requirement IDs are used in code comments, test names and the README.

| ID | Requirement (from brief) | Haamika feature |
|---|---|---|
| R1 | Manage daily medications: view, add, edit, manage schedules | Medicines tied to the elder's day (Morning / Afternoon / Evening / Night), with dose, pill color + shape, food instructions, days of week, stock count |
| R2 | Medical appointments; monitor upcoming | Appointments with doctor, specialty, place, time, elder's questions; "Add to Google Calendar" link |
| R3 | Healthcare routines | Routines (BP check, sugar check, walk, exercise, custom) scheduled like doses; optional readings (e.g. BP 140/90) |
| R4 | Shared ecosystem: elder, caretakers, family | One **Care Circle** per elder with three member roles: elder, family, caretaker (+ read-only doctor link) |
| R5 | Secure, passcode-based access; authorized members only | Circle Code + personal numeric PIN per member; hashed PINs, lockout, single-use invite codes, role-based authorization on every request |
| R6 | Track adherence | Every dose/routine event recorded (taken, taken late, skipped with reason, missed); adherence % by day / medicine / time of day; pattern insights |
| R7 | Proactive email reminders: missed meds, upcoming doses, appointments | Scheduled reminder engine (Cloud Scheduler → Cloud Run) with escalation: upcoming → missed → family; appointment reminders 24 h and 2 h before; refill-low alerts; in-app Outbox of every email |
| R8 | Beyond basic: smarter, more accessible, reliable, collaborative | Voice assistant "Haamika" (Hindi + English), one-tap elder screen, SOS, pattern insights, WhatsApp share, installable app, demo mode, Gemini-written explanations and summaries |
| R9 | Elder at the centre of their own healthcare decisions | **Consent cards**: any medicine add/change/stop by others becomes a proposal the elder approves with one tap; "skip with reason" recorded as the elder's decision; elder can remove any member; full activity log |

## 3. Personas and what each one sees

| Role | Who | What they can do | Effort |
|---|---|---|---|
| **Elder** | e.g. Kamla Devi, 72 | One big screen: today's medicines and routines, next doctor visit, approve/decline proposed changes, mark taken / skip with reason, log readings, talk to Haamika, call or WhatsApp family, SOS, remove a circle member | 4-digit PIN once; device stays signed in for 30 days; no typing |
| **Family (organizer)** | e.g. son Rohan (may live abroad) | Creates the circle; proposes medicines/routines; manages appointments; invites members; sees adherence, insights, activity log, Outbox; creates doctor link; resets elder/caretaker PIN | 6-digit PIN |
| **Caretaker** | e.g. attendant Sunita | "Give now" checklist; mark given / skip with reason; log readings; weekly pill-box fill grid; view appointments | 6-digit PIN, joins via invite code |
| **Doctor (guest)** | Any doctor | Read-only visit brief via a link that expires after 24 h | No account |

## 4. Features

### 4.1 Access (R4, R5)
- **Create a circle** (family organizer): elder's name, preferred name ("Amma"), language (en / hi), timezone (default `Asia/Kolkata`), day anchors (defaults: breakfast 08:00, lunch 13:00, evening 18:00, dinner 20:30), organizer name + email + 6-digit PIN, elder 4-digit PIN (set together with the elder). Returns a **Circle Code** (8 characters shown as `XXXX-XXXX`, alphabet A–Z and 2–9 without I or O, e.g. `KM7Q-4FXR`; input is case-insensitive and the hyphen optional).
- **Sign in**: enter Circle Code once per device → tap your name tile → PIN pad (large numeric keypad). Elder sessions last 30 days; others 7 days.
- **Invite**: family creates a single-use invite code for a role (family or caretaker), valid 48 h. Joiner enters code, name, optional email, sets own PIN.
- **Doctor link**: family creates a read-only visit link (random token, expires 24 h, revocable).
- **Elder control**: elder can see all members and remove any of them (confirmation required). Family can reset a locked elder or caretaker PIN (logged).
- **Lockout**: 5 wrong PINs → that member locked for 15 minutes; IP-based rate limits on sign-in and circle lookup.

### 4.2 Elder home — "one tap" screen (R1, R3, R6, R8, R9)
- Greeting with preferred name and date, in the elder's language.
- **Now card**: the current time-of-day slot (e.g. "Morning — after breakfast") listing each medicine as **pill icon (color + shape) + name + dose + instruction**, and each routine. Big button **"I took them"** (marks all in the slot) plus per-item tap.
- **Skip with reason**: big reason buttons — Felt unwell / Doctor said / Ran out / Other. Recorded as the elder's decision, not as "missed."
- **Consent cards** (top of screen when pending): "Rohan wants to add **Calcium + Vitamin D3**, after lunch." Plain-language summary, read aloud. Buttons: **Okay** / **Not now — call Rohan**.
- Next doctor visit card.
- Big buttons: **Talk to Haamika** (voice), **Call family** (`tel:`), **WhatsApp family** (`https://wa.me/` link), **SOS**.
- Language toggle EN / हिंदी. Text size 22–28 px. Contrast ≥ 7:1. Touch targets ≥ 56 px.

### 4.3 Voice assistant "Haamika" (R8, R9)
Tap **Talk to Haamika**, speak Hindi, English or Hinglish.

| Intent | Example | Result |
|---|---|---|
| `WHAT_NOW` | "Abhi kaunsi dawai leni hai?" | Reads out current slot items with color/shape |
| `MARK_TAKEN` | "Maine subah ki dawai le li" | Reads back what will be marked → confirm by voice "haan" or tap |
| `SKIP` | "Aaj raat ki dawai nahi lungi, tabiyat theek nahi" | Skip with reason after confirmation |
| `MED_INFO` | "Yeh Metformin kis liye hai?" | Explains purpose (stored explanation) |
| `NEXT_APPOINTMENT` | "Doctor ke paas kab jaana hai?" | Reads next appointment |
| `LOG_READING` | "Mera BP 140 by 90 hai" | Logs BP reading after confirmation |
| `ADD_QUESTION` | "Doctor se poochna hai ki chakkar kyun aata hai" | Adds question to the next appointment |
| `CALL_FAMILY` | "Rohan ko phone karo" | Opens call link |
| `EMERGENCY` | "I fell", "chakkar aa raha hai", "chest pain" | SOS screen + immediate emails |
| `UNKNOWN` | — | Friendly "I didn't catch that" + the big buttons |

**Pipeline**: browser speech recognition (`hi-IN` / `en-IN`) → `POST /api/voice/intent` → (1) **emergency keyword check in code** (English + Hindi + Hinglish list) → (2) Gemini structured output maps transcript to one intent from the fixed enum → (3) deterministic keyword fallback if Gemini is unavailable → server builds the reply from **code templates** in the elder's language → browser speaks it (`speechSynthesis`; Cloud Text-to-Speech as an enhancement).

**Voice safety rules (enforced in code):** voice can never add, change or stop a medicine and never gives dosing advice. Questions like "Can I take two?" → fixed reply: "Please ask your doctor. I've let Rohan know." (creates an activity entry + email to family). Every state-changing voice action requires a confirmation.

### 4.4 Medicines, routines and consent (R1, R3, R9)
- Medicine fields: name, strength (e.g. "500 mg"), purpose (plain words), pill color (white, yellow, pink, orange, blue, green, red, brown), pill shape (round, oval, capsule, liquid, drops, inhaler, injection), food instruction (before food / after food / with food / any), slots (one or more of morning / afternoon / evening / night), dose per slot, days of week (default daily), stock count, refill threshold, status (`proposed` | `active` | `stopped`).
- Routine fields: type (bp_check, sugar_check, walk, exercise, custom), label, slot, days of week, `needsReading`, status.
- **Proposals**: when family adds, changes or stops a medicine, it is saved as a proposal. It becomes active only after the elder taps **Okay**. "Not now" declines it, emails the proposer and suggests a call. Routines and appointments do not need approval but the elder is notified on their screen.
- **First-time setup**: medicines entered at setup appear on the elder's first sign-in as "Rohan set up 4 medicines for you — let's check them," with Okay per item or "Okay to all."
- Stock decrements by dose when a medicine is taken.

### 4.5 Schedule & adherence engine (R6, R7) — pure functions, fully unit-tested
- Each slot has an anchor time from the circle's day anchors. **Dose window** = anchor − 30 min → anchor + 120 min (configurable).
- Event statuses: `pending`, `taken`, `taken_late` (after window closed), `skipped` (with reason), `missed` (window closed, nothing recorded).
- Event IDs are deterministic: `{date}_{slot}_{itemType}_{itemId}` → idempotent writes.
- Adherence % = (taken + taken_late) ÷ (due − skipped) over 7 and 30 days; per medicine; per slot.
- **Pattern insights** (code rules): a slot with ≥ 3 misses in the last 7 days → insight "Night doses are often missed" + suggestion to move that anchor 30 min earlier → offered to the elder as a consent card.

### 4.6 Reminders and escalation (R7)
`POST /internal/tick` runs every 5 minutes (Google Cloud Scheduler, protected by a secret header). For each circle:

| When | Email to | Kind |
|---|---|---|
| Window start (anchor − 30 min) | Members with "upcoming" notifications on (default: caretaker; elder if they have an email) | `dose_upcoming` |
| Window closes, item not taken/skipped | Caretaker + elder (if email) | `dose_missed` |
| Window close + 60 min, still not taken | Family members | `dose_missed_escalation` |
| 24 h and 2 h before appointment | Elder (if email), caretaker, family | `appointment_upcoming` |
| Stock ≤ refill threshold | Family | `refill_low` |
| SOS pressed / emergency words | Everyone in the circle | `sos` |

- Every email is written to the circle's **Outbox** (visible in the family view) with a dedupe key `{circleId}:{kind}:{target}:{date}:{stage}` → never sent twice.
- Emails show the elder's local time, plus the recipient's local time when they have a different timezone (e.g. family abroad).
- Sending uses Gmail SMTP (app password). If SMTP is not configured, emails are recorded in the Outbox with status `logged` (no crash).

### 4.7 Appointments (R2)
- Fields: doctor name, specialty, place, date-time, notes, elder's questions (list), status.
- "Add to Google Calendar" link (`https://calendar.google.com/calendar/render?action=TEMPLATE&...`).
- Elder's next appointment always shown on the home screen.

### 4.8 Family dashboard (R4, R6, R8)
Tabs: **Overview** (today's status, 7/30-day adherence, insights, pending proposals) · **Medicines & Routines** · **Appointments** · **Circle** (members, invites, doctor link, PIN resets) · **Activity log** · **Outbox** · **Settings** (day anchors, timezone, language, notification preferences). "Share update on WhatsApp" button (prefilled `wa.me` text).

### 4.9 Caretaker view (R1, R3, R6)
"Give now" checklist by slot, mark given / skip with reason, log readings, **weekly pill-box grid** (7 days × 4 slots) to fill the physical organizer, appointments (read-only).

### 4.10 SOS (R8)
Large SOS button (press-and-hold 2 s, or confirm dialog). Opens an emergency screen with a **Call 112** button (`tel:112`) and **Call family**; emails all members immediately; logs the event.

### 4.11 Installable app (R8)
Web app manifest + small service worker that caches the app shell and today's schedule, so the elder opens Haamika from a home-screen icon like any app. "Taken" taps made offline are queued and synced.

### 4.12 Demo mode (judging)
`DEMO_MODE=true` seeds a demo circle on startup (if missing):
- Circle Code `AMMA-4729`; elder **Kamla Devi** ("Amma", Delhi, Hindi), PIN `2580`; family **Rohan** (Toronto timezone), PIN `135790`; caretaker **Sunita**, PIN `246802`.
- Medicines: Amlodipine 5 mg (BP, morning), Metformin 500 mg (sugar, morning + night, after food), Atorvastatin 10 mg (cholesterol, night), Pantoprazole 40 mg (acidity, morning, before food).
- Routines: BP check (morning, reading), evening walk.
- 14 days of history at ~85% adherence with **night doses often missed** (so the insight shows).
- One pending proposal from Rohan: Calcium + Vitamin D3, after lunch.
- Appointments: Dr. Mehta (Cardiology) in 2 days; Dr. Iyer (Diabetes) in 12 days.
- Landing page shows "Try the demo as Elder / Family / Caretaker" buttons that **pre-fill** the circle code and PIN and go through the normal sign-in.

### 4.13 Stretch features (after first submission, in priority order)
1. Phone notifications for the elder via **Firebase Cloud Messaging** (web push).
2. **Gemini medicine explainer** (en + hi), cached on the medicine, labeled "AI explanation — confirm with your doctor or pharmacist."
3. **Doctor visit brief** (24 h before appointment, emailed to family and shown on the doctor link): adherence per medicine, missed patterns, skip reasons, BP/sugar trend, elder's questions, plus **rule-based medicine safety flags** (duplicate medicines; drugs that need caution in older adults, from a small curated list in `src/server/rules/medicationSafety.ts`) phrased only as "Ask your doctor" items. Nothing is changed automatically.
4. **Google Cloud Text-to-Speech** voice (`hi-IN`, `en-IN`) with `speechSynthesis` fallback.
5. Weekly family summary email (numbers computed in code; warm wording by Gemini).
6. Prescription photo → Gemini drafts medicines → family reviews → becomes proposals for the elder. Image processed in memory, never stored.
7. Trusted person: elder nominates one member who may approve on their behalf (every such approval still shown to the elder).

## 5. Responsible AI
- **Code decides, Gemini only words.** Schedules, missed detection, escalation, emergencies, safety flags and permissions are deterministic code with tests. Gemini is used only to classify voice intents (fixed enum, structured output), and to write explanations and summaries.
- Names and contact details are removed before any text is sent to Gemini.
- Every Gemini call has a timeout and a non-AI fallback; the app works fully without Gemini.
- No medical advice: no dosing guidance anywhere; AI text is labeled.

## 6. Architecture

```
Browser (React PWA)  ──HTTPS──▶  Cloud Run: Node 22 + Express 5 (API + static web)
   │  Web Speech API                 ├─ Firestore (Native mode)        ← all data
   │  speechSynthesis                ├─ Vertex AI Gemini (@google/genai) ← intent, wording
   │                                 ├─ Gmail SMTP (nodemailer)         ← reminder emails
   │                                 ├─ Secret Manager                  ← SESSION_SECRET, CRON_SECRET, SMTP_PASS
   │                                 └─ Cloud Logging (structured JSON logs)
Cloud Scheduler ──every 5 min──▶ POST /internal/tick (X-Cron-Secret)
```

### 6.1 Google services used
| Service | Used for |
|---|---|
| Cloud Run | Hosts API + web app (one container) |
| Firestore | All circle data |
| Vertex AI — Gemini (`@google/genai`) | Voice intent classification; explanations; summaries |
| Cloud Scheduler | Triggers the reminder engine every 5 min |
| Secret Manager | Session, cron and SMTP secrets |
| Cloud Logging | Structured logs (no PII) |
| Google Calendar | "Add to Google Calendar" links |
| Gmail (SMTP) | Sending reminder emails |
| Firebase Cloud Messaging, Cloud Text-to-Speech | Stretch |

### 6.2 Tech stack (pin exact versions; no `latest`)
- **Language**: TypeScript (strict) everywhere.
- **Server**: Node 22, Express 5, zod, helmet, express-rate-limit, compression, jose (JWT), luxon, nodemailer, @google-cloud/firestore, @google/genai. PIN hashing with Node `crypto.scrypt` + `timingSafeEqual` (no native deps).
- **Web**: React 19 + Vite + react-router; plain CSS with CSS variables (no UI framework); hand-built accessible SVG charts with a data-table fallback.
- **Quality**: ESLint (typescript-eslint, eslint-plugin-jsx-a11y), Prettier, Vitest, Supertest, Testing Library, vitest-axe.
- **Runtime config** (validated with zod at startup): `PORT`, `NODE_ENV`, `DATA_BACKEND` (`memory` | `firestore`), `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_GENAI_USE_VERTEXAI`, `GEMINI_MODEL`, `GEMINI_API_KEY` (local dev only), `SESSION_SECRET`, `CRON_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `APP_BASE_URL`, `DEMO_MODE`.

### 6.3 Repository layout
```
haamika/
├─ README.md
├─ docs/  SPEC.md · ARCHITECTURE.md · SECURITY.md · ACCESSIBILITY.md · TESTING.md
├─ .github/workflows/ci.yml          # lint, typecheck, test, build
├─ Dockerfile · .dockerignore · .gcloudignore · .gitignore · .env.example
├─ firestore.rules                   # deny all client access (server-only data)
├─ package.json · package-lock.json · tsconfig*.json · vite.config.ts · vitest.config.ts · eslint.config.js
├─ public/  manifest.webmanifest · icons (small) · sw.js
└─ src/
   ├─ shared/      schemas.ts (zod) · types.ts · slots.ts · i18n keys
   ├─ server/
   │  ├─ index.ts · app.ts (createApp for tests) · config.ts
   │  ├─ middleware/  session.ts · requireRole.ts · originCheck.ts · rateLimits.ts · errorHandler.ts · security.ts
   │  ├─ routes/      auth · circles · members · invites · medicines · routines · proposals · schedule · events · appointments · activity · outbox · voice · sos · visit · internal · health
   │  ├─ services/    scheduleEngine.ts · adherence.ts · insights.ts · reminderEngine.ts · emailService.ts · geminiClient.ts · voiceIntent.ts · emergency.ts · pin.ts · tokens.ts · calendarLink.ts · whatsappLink.ts · piiScrub.ts
   │  ├─ repositories/ repository.ts (interface) · firestoreRepository.ts · memoryRepository.ts
   │  └─ seed/demo.ts
   └─ web/
      ├─ main.tsx · App.tsx · routes.tsx · api/client.ts · i18n/{en,hi}.json · styles/
      ├─ components/ Button · PinPad · PillIcon · Dialog · LanguageToggle · LiveRegion · BarChart
      └─ views/ landing · signin · join · onboarding · elder · family · caretaker · visit
```

### 6.4 Data model (Firestore; all under `circles/{circleId}`)
- `circles/{circleId}`: elderName, preferredName, language, timezone, anchors {breakfast, lunch, evening, dinner}, windowBeforeMin, windowAfterMin, escalationAfterMin, circleCodeHash, createdAt.
- `members/{memberId}`: name, role, email?, phone?, timezone?, pinHash, pinSalt, failedAttempts, lockedUntil?, isOrganizer, notify {upcoming, missed, appointments, refill}, createdAt, removedAt?.
- `invites/{inviteId}`: codeHash, role, expiresAt, usedAt?, createdBy.
- `medicines/{id}`, `routines/{id}`: as in §4.4.
- `proposals/{id}`: type (add_medicine | change_medicine | stop_medicine | change_anchor), payload, proposedBy, status (pending | approved | declined), decidedAt?.
- `events/{date_slot_itemType_itemId}`: date, slot, itemType, itemId, status, actorId, reason?, reading?, at.
- `appointments/{id}`: doctorName, specialty, place, startsAt, notes, questions[], status.
- `activity/{id}`: actorId, actorRole, action, target, summary, at.
- `outbox/{id}`: to, subject, body, kind, dedupeKey, status (sent | logged | failed), at.
- `visitLinks/{id}`: tokenHash, expiresAt, revokedAt?, createdBy.
- Top-level `circleCodes/{codeHash}` → circleId (lookup without scanning).

### 6.5 API (all JSON; all inputs validated with zod; all routes except auth/visit/health require a session)
`POST /api/circles` (create) · `POST /api/auth/lookup` (circle code → member tiles) · `POST /api/auth/signin` · `POST /api/auth/signout` · `GET /api/me` · `POST /api/invites` · `POST /api/invites/accept` · `GET/DELETE /api/members/:id` · `POST /api/members/:id/reset-pin` · `GET/POST/PATCH /api/medicines` · `GET/POST/PATCH /api/routines` · `GET /api/proposals` · `POST /api/proposals/:id/decide` · `GET /api/schedule/today` · `POST /api/events` (taken / skipped / reading) · `GET /api/adherence` · `GET/POST/PATCH/DELETE /api/appointments` · `GET /api/activity` · `GET /api/outbox` · `POST /api/voice/intent` · `POST /api/sos` · `POST /api/visit-links` · `GET /api/visit/:token` · `POST /internal/tick` · `GET /healthz`.

### 6.6 Permission matrix (enforced server-side by `requireRole` + ownership checks; covered by tests)
| Action | Elder | Family | Caretaker | Doctor link |
|---|---|---|---|---|
| View schedule, medicines, appointments | ✓ | ✓ | ✓ | read-only brief |
| Mark taken / skip / log reading | ✓ | ✓ | ✓ | ✗ |
| Propose medicine add/change/stop | ✗ (asks family) | ✓ | ✗ | ✗ |
| Approve / decline proposal | ✓ | ✗ | ✗ | ✗ |
| Create/edit routines, appointments | ✗ | ✓ | ✗ | ✗ |
| Invite members, doctor link, reset PIN | ✗ | ✓ | ✗ | ✗ |
| Remove a member | ✓ | ✓ (not the elder) | ✗ | ✗ |
| View activity log, outbox, adherence | ✓ | ✓ | adherence only | ✗ |

## 7. Security requirements
- PINs: scrypt with per-member random salt; constant-time compare; never logged or returned. Elder PIN 4 digits, others 6 digits.
- Lockout: 5 failures → 15 min per member; IP rate limits on `/api/auth/*` and `/api/invites/accept`.
- Circle codes, invite codes and doctor tokens are random (crypto), stored only as SHA-256 hashes; invites single-use + 48 h expiry; doctor links 24 h + revocable.
- Session: signed JWT (jose, HS256, `SESSION_SECRET` ≥ 32 bytes) in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie; contains only circleId, memberId, role.
- CSRF: SameSite=Strict + `Origin` header check on every state-changing request.
- Authorization on every route via `requireRole`; every query scoped to the session's circleId (no cross-circle access — tested).
- Input validation with zod on body, params and query; JSON body limit 50 kb.
- helmet with a strict Content-Security-Policy (no inline scripts), HSTS, referrer policy; same-origin only (no permissive CORS).
- Central error handler: no stack traces or internal messages in responses.
- Structured logging with no PINs, codes, tokens, emails or health details.
- `/internal/tick` requires `X-Cron-Secret` (constant-time compare).
- Secrets only in environment / Secret Manager; `.env.example` has placeholders only; nothing secret committed.
- `firestore.rules` denies all client access (data is server-only).
- Docker image runs as non-root `node` user; `npm ci --omit=dev`; `npm audit` with no high/critical issues.

## 8. Accessibility requirements (WCAG 2.1 AA; elder screens stricter)
- Semantic HTML landmarks (`header`, `nav`, `main`), one `h1` per view, skip link.
- Every control has a visible label; errors linked with `aria-describedby`.
- `aria-live="polite"` region announces status changes and Haamika's spoken replies as text.
- Full keyboard navigation; visible focus outline; logical focus order; dialogs trap and restore focus.
- Base font 18 px (elder view 22–28 px); line height ≥ 1.5; contrast ≥ 4.5:1 (elder ≥ 7:1).
- Touch targets ≥ 48 px (elder ≥ 56 px).
- Never rely on color alone: pills show color **and** shape **and** name; statuses use text + icon.
- `lang` attribute switches with language (en / hi); `prefers-reduced-motion` respected.
- Charts have `role="img"` + `aria-label` and a visually hidden data table.

## 9. Testing requirements
- **Unit**: schedule engine (windows, statuses, late/missed, days of week, timezones), adherence math, insights, reminder engine (who gets what, when; escalation; dedupe), PIN hashing + lockout, token expiry/single use, emergency keyword detection (en/hi), voice keyword fallback, PII scrubbing, calendar/WhatsApp link builders.
- **API integration** (Supertest, memory repository, fake clock, fake mailer, fake Gemini): create circle → sign in → propose medicine → elder approves → becomes active → mark taken → adherence updates; caretaker cannot propose or approve (403); family cannot approve (403); cross-circle access denied (403/404); tick sends missed + escalation emails exactly once; invalid input → 400; locked member → 423/429.
- **UI** (Testing Library + vitest-axe): elder home, PIN pad, consent card, family overview have **no axe violations**; keyboard-only flows for PIN entry and approving a proposal.
- Test names reference requirement IDs, e.g. `it("R7: emails family when a dose is still missed 60 min after the window closes")`.
- Coverage ≥ 80% on `src/server/services` and `src/server/routes`.
- CI (GitHub Actions): `npm ci`, lint, typecheck, test with coverage, build.

## 10. Efficiency
- Pure-function engine; batch Firestore reads per circle per tick; single-field queries only (no composite indexes needed).
- Gemini results cached (explanations stored on the medicine); 4 s timeout.
- `compression`; long-cache headers for hashed static assets; route-level code splitting; no heavy libraries (target < 200 kb gzipped JS).

## 11. Roadmap (pitch only — not built today)
WhatsApp Business alerts · SMS / voice-call reminders for feature phones · ABHA (Ayushman Bharat Health Account) link · smart pill box · more Indian languages · pharmacy refill ordering.
