# Testing Strategy & Verification: Haamika

Haamika employs a comprehensive, multi-tiered testing strategy spanning pure functional unit tests, Supertest-driven API integration tests, and React Testing Library UI tests paired with automated axe-core accessibility audits.

---

## 1. Test Architecture & Principles

1. **Deterministic & Isolated**:
   - Zero external cloud or database dependencies during testing.
   - Tests run against an in-memory repository architecture (`MemoryCircleRepository`) that implements the exact Firestore document and subcollection interfaces.
   - External services (Gemini API, Gmail SMTP) are abstracted behind deterministic test doubles (`fakeGeminiClient`, in-memory mail recorder).

2. **Time-Aware Testing with Fake Timers**:
   - Reminder escalation, slot windows, and dual-timezone conversions (e.g. `Asia/Kolkata` for elder vs `America/New_York` for family) are tested deterministically using fake clocks (`vi.useFakeTimers()`).

3. **Strict Coverage Thresholds**:
   - `vitest.config.ts` enforces an **80% minimum threshold** across Statements, Branches, Functions, and Lines.
   - Current test execution exceeds **94% Statements**, **80% Branches**, **94% Functions**, and **95% Lines**.

---

## 2. Test Suites Overview

### 2.1 Pure Function Unit Tests (`src/server/services/*.test.ts`)
- **`schedule.test.ts`**:
  - Calculates daily medicine slots based on circle anchor times (breakfast, lunch, evening, dinner).
  - Determines the active slot with configurable early/late adherence windows.
  - Converts times between UTC, elder local timezone, and overseas family timezones.
- **`adherence.test.ts`**:
  - Aggregates 7-day and 30-day compliance rates across circles, medicines, and slots.
  - Generates rule-based clinical insights (e.g., flags evening dose adherence drop-offs).
- **`reminderEngine.test.ts`**:
  - Computes due emails for `dose_upcoming`, `dose_missed`, `dose_missed_escalation`, `appointment_upcoming` (24h/2h), and `refill_low`.
  - Verifies multi-recipient deduplication keys formatted as `{circleId}:{kind}:{target}:{date}:{stage}:{memberId}`.
  - Validates escalation triggers (e.g., missed dose alert to elder first, escalated to family organizer after 45 minutes).
- **`voice.test.ts`**:
  - Detects emergency phrases in English, Hindi (feminine forms like *"gir gayi"*, masculine *"gir gaya"*, and neutral *"chhati mein dard"*), and Devanagari script.
  - Verifies Gemini structured output classification and deterministic fallback keyword matcher.
  - Enforces the clinical safety boundary: voice cannot alter medicine schedules or provide dosage advice.

### 2.2 API & Integration Tests (`src/server/routes/*.test.ts`)
- **`auth.test.ts`**:
  - Circle lookup via case-insensitive code (e.g., `AMMA-4729`).
  - Scrypt PIN hashing and verification.
  - Account lockout enforcement after 5 consecutive incorrect PIN attempts.
  - Scoped JWT cookie issuance (`circleId`, `memberId`, `role`).
- **`proposals.test.ts` & `medicines.test.ts`**:
  - Medicine lifecycle: Proposed by family $\rightarrow$ marked `pending` $\rightarrow$ approved by elder $\rightarrow$ marked `active`.
  - Rejection flow: Elder declines $\rightarrow$ marked `rejected`.
  - **RBAC 403 Enforcement**:
    - Rejects family attempts to approve a proposal (`403 Forbidden`).
    - Rejects caretaker attempts to approve a proposal (`403 Forbidden`).
    - Rejects caretaker attempts to create, update, or stop medicines (`403 Forbidden`).
- **`events.test.ts`**:
  - Records dose events (`taken`, `taken_late`, `skipped` with structured reason code).
  - Decrements medicine inventory counters and checks low-stock thresholds.
- **`internal.test.ts`**:
  - Verifies `POST /internal/tick` authentication using constant-time `timingSafeEqual` header verification (`X-Cron-Secret`).
  - Validates send-once execution and outbox persistence.
- **`sos.test.ts`**:
  - Enforces IP rate limiting on emergency triggers.
  - Immediately dispatches priority email alerts to all circle members.
  - Appends an emergency entry to the activity log.

### 2.3 UI & Accessibility Audits (`src/web/**/*.test.tsx`)
- **`PinPad.test.tsx`**:
  - Digit entry, backspace, and clear operations.
  - Full keyboard accessibility (`Tab`, `Enter`, `Space`).
  - Automated `vitest-axe` audit with **0 violations**.
- **`ElderHomeView.test.tsx`**:
  - Displays current slot medicines with shape-differentiated `PillIcon`.
  - One-tap "I took them" button action.
  - Skip flow with reason selection.
  - Screen reader `aria-live` announcements.
  - Automated `vitest-axe` audit with **0 violations**.
- **`ProposalConsentCard.test.tsx`**:
  - High-contrast "Okay" (`Haan`) and "Not now — call" (`Abhi nahi`) actions.
  - Keyboard-only navigation and activation.
  - Automated `vitest-axe` audit with **0 violations**.
- **`FamilyDashboardView.test.tsx`**:
  - Accessible SVG BarChart with hidden semantic `<table>` for screen readers.
  - Proposals review and circle configuration tabs.
  - Automated `vitest-axe` audit with **0 violations**.

---

## 3. Running Tests

```bash
# Run all unit, integration, and UI tests
npm test

# Run all tests with code coverage analysis and threshold enforcement
npm run test:coverage

# Run tests in interactive watch mode
npm run test:watch
```
