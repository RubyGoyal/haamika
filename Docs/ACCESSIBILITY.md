# Accessibility Specification & Audit: Haamika

Haamika is designed for Indian elders (65+), their families, and domestic caretakers. Elders often face mild-to-moderate visual decline (presbyopia, cataracts, reduced contrast sensitivity), motor tremors or reduced dexterity, and lower digital literacy.

Haamika meets **WCAG 2.1 AA** standards across all screens and implements stricter ergonomic guidelines for the elder interface.

---

## 1. Ergonomic Design Standards for Elders

### 1.1 Typography & Contrast
- **Large Base Font Size**: Elder screen body text is set between `20px` and `28px`, with headings at `28px` to `36px`.
- **High Contrast Ratios**:
  - Primary text on elder surfaces uses `#111827` (almost black) on `#ffffff` or `#f9fafb`, achieving a contrast ratio of **16.5:1** (far exceeding the WCAG AAA requirement of 7:1).
  - Secondary text uses `#4b5563`, maintaining at least **7.0:1** contrast.
  - Active button states and primary accents (e.g. emerald `#059669`, indigo `#4338ca`) maintain ≥ **4.5:1** contrast with white labels.

### 1.2 Touch Targets & Tremor Tolerance
- **Minimum Target Size**: All interactive buttons, cards, and keys on elder screens are at least **56×56 px** (Fitts's Law optimization).
- **Generous Spacing**: Minimum **12px to 16px** gutter between adjacent buttons to eliminate accidental miss-taps caused by hand tremors.
- **Press Feedback**: Active states include immediate visual depress effects and high-contrast borders.

### 1.3 Zero-Typing Interaction Model
- Elders are never asked to type words, URLs, or free-form text on small software keyboards.
- **Authentication**:
  1. Circle selection / one-click member tile selection with large avatar initial.
  2. 4-to-6 digit numeric PIN entered via a high-contrast on-screen **PinPad** with oversized digit keys, backspace, and clear buttons.
- **Medication Actions**:
  - Big 1-tap **"I took them"** (`Maine le li`) button takes all medicines in the current slot.
  - Per-item checkoff allows toggling individual medications with a single tap.
  - Skip actions provide prominent one-tap preset reasons: *"Doctor said to stop"*, *"Felt unwell"*, *"Ran out of medicine"*, *"Other"*.

### 1.4 Multi-Sensory Pill Identification (PillIcon)
- Medicine identification never relies on color alone (preventing errors for color-blind users or low-contrast ambient lighting).
- Every medicine displays:
  - **Color**: Visual swatch and background tint.
  - **Geometric Shape**: Unique SVG glyph (`round`, `oval`, `capsule`, `square`, `triangle`).
  - **Readable Label**: Name, strength, and timing instruction (e.g., *"Paracetamol 500mg • After food"*).

---

## 2. Screen Reader & ARIA Implementation

### 2.1 Semantic Landmark Structure
- Semantic elements (`<header>`, `<main>`, `<nav>`, `<aside>`, `<footer>`) are used across all views.
- Dialogs (e.g., proposal consent, voice assistant panel, PIN reset) use `<dialog role="dialog" aria-modal="true">` with `aria-labelledby` and `aria-describedby`.

### 2.2 Dynamic Voice & Status Feedback (`aria-live`)
- Voice assistant interactions utilize an `aria-live="polite"` region. Spoken transcripts, system confirmations, and status prompts are announced directly to screen readers without interrupting current speech.
- Real-time dose status updates and offline queue indicators announce sync events using `aria-live`.

### 2.3 Accessible Visualizations (SVG BarChart)
- Adherence trend charts render an accessible SVG bar graph with `aria-hidden="true"` accompanied by a sibling visually hidden HTML `<table>` (`.sr-only`).
- Screen reader users perceive a structured data table containing:
  - Slot / Date
  - Scheduled Doses
  - Taken Doses
  - Adherence Percentage

---

## 3. Keyboard Navigation & Focus Management

- **Full Tab Traversal**: All interactive controls are reachable via `Tab` and `Shift+Tab`.
- **Keyboard Activation**: PinPad buttons, consent action buttons, and accordion panels respond to both `Enter` and `Space`.
- **Visible Focus Indicator**: Focus rings use high-visibility outlines:
  ```css
  :focus-visible {
    outline: 3px solid #2563eb;
    outline-offset: 2px;
  }
  ```
- **Focus Trapping**: Modals trap focus during active confirmation flows and restore focus to the triggering element upon closure.

---

## 4. Automated Testing & Compliance Verification

- **Automated Axe Core Audits**: Every primary screen and interactive component is audited with `vitest-axe`:
  - `ElderHomeView.test.tsx`: Verified with **0 accessibility violations**.
  - `PinPad.test.tsx`: Verified with **0 accessibility violations**.
  - `ProposalConsentCard.test.tsx`: Verified with **0 accessibility violations**.
  - `FamilyDashboardView.test.tsx`: Verified with **0 accessibility violations**.
- **Keyboard-Only Test Suites**: Automated tests simulate sequential `Tab` key navigation and `Enter`/`Space` activation for:
  - Full PIN entry without pointer input.
  - Proposal consent review (accept/decline) via keyboard alone.
