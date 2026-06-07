# Access — Design Guidelines & Visual Identity Reference

**Status:** Proposed reference — for review & approval. **Not yet implemented.**
**Scope:** Official design system for the Access live interpreter platform.
**Phase:** This document defines the *target* design system to be applied in **Phase 2**
(visual redesign), after **Phase 1** (functional completion: end-to-end
user → interpreter → call workflow + Zoom Video SDK) is finished.

> ⚠️ This is documentation only. Nothing in this file is wired into the running app.
> The live product is intentionally **unchanged**. Treat this as the contract the
> Phase 2 implementation must satisfy.

---

## 1. Brand Positioning

**Access** is a professional interpretation platform used in healthcare, legal,
government, and corporate settings. It connects a user to a live human interpreter
over video, on demand.

**The visual language must signal:** institutional trust, calm expertise, and the
absence of friction. The product should disappear so the human connection through it
can be felt.

**Tone keywords:** professional · premium · calm · trustworthy · institutional ·
healthcare/government-friendly.

**Primary audience context:** Arabic-first (RTL primary, English secondary),
mobile-first. Every rule in this document must hold in both RTL and LTR.

**The north star screen:** the call screen — dark, immersive, glassmorphic — is
already the strongest, most distinctive surface in the product. The rest of the
system should aspire to the same intentionality and calm.

---

## 2. Color System

All values are expressed as HSL channel triplets so they can drop directly into the
existing `index.css` custom-property convention (`hsl(var(--token))`).

### 2.1 Brand — Deep Institutional Indigo
A cooler, deeper blue-violet that replaces the current generic purple
(`hsl(250 80% 55%)`). It reads as institutional rather than "app."

| Token | HSL | Use |
|---|---|---|
| `brand-900` | `242 60% 20%` | Darkest text/fills on light |
| `brand-800` | `242 58% 30%` | Headings on light |
| `brand-700` | `242 56% 40%` | Interactive borders, gradient end |
| `brand-600` | `242 54% 48%` | **Primary actions / main CTA** |
| `brand-500` | `242 52% 56%` | Hover states |
| `brand-400` | `242 50% 68%` | Disabled / secondary |
| `brand-100` | `242 60% 97%` | Subtle tinted backgrounds, avatar fills |
| `brand-50`  | `242 80% 99%` | Page tint / canvas |

### 2.2 Secondary — Slate (structure, not decoration)

| Token | HSL | Use |
|---|---|---|
| `slate-900` | `222 30% 12%` | Deepest surfaces |
| `slate-700` | `222 22% 28%` | Dark headers / sidebars |
| `slate-200` | `222 20% 92%` | Borders |
| `slate-100` | `222 30% 96%` | Table headers, muted areas |
| `slate-50`  | `222 40% 98%` | Page background |

### 2.3 Semantic Status (replaces all raw Tailwind status colors)
These replace ad-hoc classes like `text-green-600`, `text-blue-600`, `text-red-500`.

| Token | HSL | Meaning |
|---|---|---|
| `status-active`   | `152 60% 38%` | Live / connected / available (emerald) |
| `status-pending`  | `38 90% 50%`  | Waiting / busy (amber) |
| `status-ended`    | `222 16% 58%` | Concluded (slate) |
| `status-declined` | `0 72% 52%`   | Rejected / error (crimson) |
| `status-offline`  | `222 16% 70%` | Unavailable (grey-blue) |

### 2.4 Call Screen (dark surface tokens)

| Token | Value | Use |
|---|---|---|
| `call-bg`     | `hsl(222 28% 8%)` | Near-black with cool undertone |
| `call-glass`  | `hsla(222, 28%, 100%, 0.08)` | Glassmorphism surfaces |
| `call-border` | `hsla(222, 60%, 100%, 0.12)` | Glass element borders |

### 2.5 Usage Rules
- **One primary action per view.** Only the most important action uses `brand-600`.
- **Status is never communicated by color alone** — always pair with a dot + label
  (accessibility + colorblind safety).
- **Slate carries structure** (borders, backgrounds, dividers); **brand carries
  intent** (actions, focus, active state). Do not decorate with brand.
- Maintain WCAG AA contrast: `brand-600` on white passes for large text and UI; use
  `brand-700`/`brand-800` for small body text on light backgrounds.

---

## 3. Typography

### 3.1 Typefaces
- **Latin:** IBM Plex Sans — weights 400 / 500 / 600 / 700.
- **Arabic:** IBM Plex Sans Arabic — weights 400 / 600. (Primary script; never rely
  on OS fallback.)
- **Mono:** IBM Plex Mono — for IDs and timestamps.

**Why IBM Plex:** it is institutional (used by government and enterprise tech), has a
true Arabic companion designed to harmonize with the Latin metrics, and reads as
professional rather than trendy. It replaces Inter (the generic default).

### 3.2 Type Scale

| Role | Size / Line | Weight | Tracking | Use |
|---|---|---|---|---|
| `display`   | 40 / 1.15 | 600 | -0.02em | Page titles |
| `heading-1` | 28 / 1.2  | 600 | -0.01em | Section heads |
| `heading-2` | 20 / 1.3  | 600 | — | Card titles |
| `heading-3` | 16 / 1.4  | 600 | — | Label heads |
| `body-lg`   | 16 / 1.6  | 400 | — | Primary body |
| `body`      | 14 / 1.6  | 400 | — | UI body |
| `caption`   | 12 / 1.5  | 500 | +0.02em | Metadata, badges |
| `mono`      | 13 / 1.5  | 400 | — | IDs, timestamps |

### 3.3 Rules
- Hierarchy comes from the scale, **not** from ad-hoc `font-bold` on everything.
- Arabic and Latin share the scale; the IBM Plex Arabic metrics keep rhythm aligned.
- Tables and dense UI use `body` (14) and `caption` (12); never shrink below 12.

---

## 4. Border Radius — Unified Scale

Replaces the current four inconsistent scales (`rounded-md` / `xl` / `2xl` / `3xl`).

| Token | Value | Use |
|---|---|---|
| `radius-xs`   | 4px  | Inputs cells, tiny chips |
| `radius-sm`   | 8px  | Dropdowns, tooltips, small cards |
| `radius-md`   | 12px | **Buttons, form fields (default)** |
| `radius-lg`   | 16px | Standard cards, panels |
| `radius-xl`   | 24px | Feature cards, modals, PiP video |
| `radius-full` | 9999px | Avatars, pills, status dots, circular buttons |

---

## 5. Elevation / Shadow Scale

Replaces ad-hoc `shadow-sm` / `shadow` / `shadow-xl` usage.

| Token | Value | Use |
|---|---|---|
| `shadow-1` | `0 1px 2px rgba(0,0,0,.04), 0 1px 4px rgba(0,0,0,.03)` | Subtle lift |
| `shadow-2` | `0 2px 8px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.04)` | Card resting |
| `shadow-3` | `0 4px 16px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04)` | Card hover / modal |
| `shadow-4` | `0 8px 32px rgba(0,0,0,.12), 0 4px 10px rgba(0,0,0,.06)` | Dialogs, popovers |
| `shadow-brand` | `0 4px 20px hsla(242,54%,48%,.22)` | Primary CTA button |
| `shadow-call`  | `0 8px 40px rgba(0,0,0,.6)` | PiP video, call controls |

---

## 6. Spacing & Layout

- **Base unit:** 4px. Use the 4-point rhythm: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- **Page padding:** 16px mobile, 32px desktop — applied consistently across all pages
  (currently inconsistent: `p-4 sm:p-8` vs `p-4 md:p-8` vs `p-6 sm:p-8`).
- **Content max-widths:** dashboards 1280px (admin) / 1024px (interpreter); auth 384px;
  language grid 1024px.
- **Header height:** fixed 64px on all dashboards.
- **Touch targets:** minimum 44px for all interactive controls (mobile-first).
- **RTL:** use logical properties (`start`/`end`, `ms-`/`me-`) — never hard-code
  `left`/`right` for layout that must mirror.

---

## 7. Component Standards

### 7.1 Button
- **Primary:** gradient `linear-gradient(135deg, brand-600, brand-700)`, no border,
  `shadow-brand`, height 44px, `radius-md`, weight 600. Hover: gradient ~4% lighter +
  shadow grows. Active: shadow collapses, `scale(0.98)`. Disabled: opacity .5, no shadow.
- **Secondary:** white background, 1.5px `slate-200` border, `shadow-1`, `radius-md`.
  Hover: `slate-50` background, border `brand-400`.
- **Ghost / Icon:** transparent, no border. Hover: `brand-100` background, `radius-sm`.
- **Destructive:** `status-declined` fill, white text (used for end-call, delete).

### 7.2 Card
- White background, 1px `slate-200` border, `shadow-2`, `radius-lg`.
- **Interactive card** (clickable): hover → `shadow-3` + border `brand-400`, 150ms ease.

### 7.3 Input / Form Field
- White background, 1.5px `slate-200` border, `radius-md`, height 44px.
- Focus: border `brand-600` + ring `0 0 0 3px hsla(242,54%,48%,.12)`.
- Latin-only fields (email, password) stay `dir="ltr"` even in RTL layout.

### 7.4 Status Badge
- Pill shape (`radius-full`), height 22px, padding 4px 10px, `caption` type.
- **Structure:** colored 6px dot + label. **Never color alone.**
- Color keyed to semantic status tokens. Replaces all inline `text-*-600` overrides.

### 7.5 Status Dot (standalone)
- 8px circle. `available` → `status-active` + pulse; `busy` → `status-pending`;
  `offline` → `status-offline`; `active-call` → `status-active` + faster pulse.

### 7.6 Table
- Header: `slate-100` background, `caption` weight 600, **sentence case** (not
  uppercase), `slate-700` text.
- Rows: 52px height, white, border-bottom `slate-200`. Hover: `slate-50`.
- Numeric/ID/time columns: `mono`, `dir="ltr"`.

### 7.7 Avatar / Initials
- Circle (`radius-full`). Sizes: 36px (header), 40px (tables), 56px (profile).
- `brand-100` background, `brand-600` text, weight 700.

### 7.8 Interpreter Status Panel (special)
The interpreter's availability control is their primary action and gets dedicated
real estate (replaces the small inline Switch):
- **Available:** `status-active`/10 tinted card, 4px left accent bar in `status-active`,
  pulsing dot, large label, outline "Go offline" button.
- **Offline:** `slate-100` card, `status-offline` indicator, primary "Go available" button.

### 7.9 App Header (shared)
- 64px, white, border-bottom `slate-200`, sticky, no shadow.
- Logo at fixed 32px height (SVG) with 16px clearance.
- Right-zone order (consistent across all dashboards): avatar → language toggle → logout.

### 7.10 Empty State (reusable)
- Centered: icon (in a `brand-100` circle), `heading-2`, `body` description, optional
  primary action. Replaces bare "icon + grey text" empty states.

### 7.11 Loading
- **Skeletons** for stat cards and table rows (replaces blank flash).
- **Branded overlay:** Access logo (light variant) with a calm pulse ring — replaces
  the full-screen `Loader2` + blur cover.

---

## 8. Branding & Logo Rules

- Provide an **SVG** logo (export from `public/access-logo.png`) for crisp rendering.
- Provide a **white/light variant** for dark surfaces (call screen) instead of the
  current `brightness-0 invert` CSS hack.
- **Display height:** fixed 32px in headers; 48–64px on the auth screen.
- **Minimum size:** never below 24px height.
- **Clearance:** keep at least 16px clear space on all sides.
- **Don'ts:** don't recolor outside approved variants, don't place the dark logo on a
  dark background, don't stretch or rotate, don't add drop shadows to the mark.

---

## 9. Iconography & Motion

- **Icons:** lucide-react (already in use), 16–24px, 1.5px stroke, inherit text color.
- **Motion:** 150ms ease for hover/state; 200ms for entrances; pulse animation for live
  status dots. Respect `prefers-reduced-motion`. Motion is calm and functional, never
  decorative.

---

## 10. Per-Page Design Intent (Before → After)

These describe the *target* for Phase 2. No layout/markup is changed now.

- **Login:** background `brand-50` tint; card lifts with `shadow-3` + a 3px `brand-600`
  top accent; gradient primary button with `shadow-brand`; remove blur orbs, replace
  with a faint dot-grid; add a tracked-out caption positioning line under the logo.
- **Language selection:** background `slate-50`; each language becomes a real card
  (white, `shadow-1`, `slate-200` border, `radius-lg`, hover `shadow-3` + `brand-500`);
  unavailable = `opacity-60` + `status-offline` dot (not globally dimmed); branded
  loading card instead of full-screen blur.
- **Interpreter dashboard:** dedicated status panel (§7.8); language pills on `brand-100`;
  session rows with left-accent hover + status badges; proper empty state (§7.10).
- **Admin dashboard:** stat cards gain a 4px semantic left-accent + icon in a colored
  circle + `display`-size number; tabs become brand pills; table headers sentence-case;
  all status badges use §7.4; row actions become icon buttons; empty states (§7.10).
- **Call screen (refinements only — already strong):** unify control buttons (mic/cam
  52px glass, end-call 60px `status-declined` + `shadow-call`); PiP `radius-xl` +
  `shadow-call` + safe-area insets; add interpreter name under the language pill;
  branded pulse-ring wait state.

---

## 11. Deferred — Safe to Apply Later (Phase 2 Backlog)

Ordered by impact-to-risk. Each item is visual and does **not** change functionality,
routing, auth, API, or WebRTC/Zoom behavior.

1. **Token + font refresh** — update `index.css` variables and load IBM Plex. Visual
   only, zero structural change. Highest impact, lowest risk.
2. **Core component restyle** — `button` / `badge` / `card` / `input`. Passive
   improvement across every page; no prop/API changes.
3. **Status system components** — add `StatusBadge` / `StatusDot`; replace inline color
   overrides in admin + interpreter pages.
4. **Shared AppHeader extraction** — unify the three dashboard headers. Structural;
   do carefully; no behavior change.
5. **Page-by-page refinements** — login → language → interpreter → admin → call, in
   that order.
6. **Empty/loading components + skeletons** — reusable `EmptyState`, skeleton rows,
   branded loading overlay.

**Explicitly out of scope for Phase 2 design work:** routing, auth logic, API calls,
Zoom/WebRTC session behavior, RTL logic (already correct), and the call screen's
fundamental dark/immersive layout (keep it).

---

## 12. Implementation Notes (for Phase 2)

- Tokens are provided copy-paste-ready in `./design-tokens.css`. They are **not**
  imported anywhere yet.
- The current theme uses shadcn primitives + an "elevate" hover system in `index.css`.
  Phase 2 should layer the new tokens onto that system rather than replacing it
  wholesale, to minimize regression risk.
- Apply changes in the backlog order above, validating each step against the running
  app before moving on.

---

## 13. Mood Board

See `./assets/access-moodboard.png` for the visual identity proposal — palette
direction, surface treatment (soft-shadowed light cards + dark glass call panel),
rounded geometry, and the calm, institutional tone this system targets.

*The mood board conveys tone and direction; the exact, authoritative values are the
tokens in §2–§6 and `design-tokens.css`.*
