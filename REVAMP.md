# UI/UX Revamp — Mobile-First Knowledge Graph

> **Date:** 19 March 2026  
> **Scope:** Full audit of `index.html`, `styles/base.css`, `styles/graph.css`, `styles/panels.css`, and all JS interaction code.  
> **Goal:** Make the knowledge graph a first-class mobile experience while improving desktop ergonomics.

---

## 1. Executive Summary

The current UI was built desktop-only. There are **zero `@media` queries**, **zero touch accommodations**, fixed pixel-width panels, hover-dependent interactions, and sub-minimum touch targets. The revamp is structured in four tiers:

| Tier | Theme | Effort |
|------|-------|--------|
| **T1** | Responsive layout & breakpoints | Medium |
| **T2** | Touch-first interactions | Medium |
| **T3** | Panel architecture overhaul (bottom sheets) | Large |
| **T4** | Visual polish, accessibility & onboarding | Medium |

---

## 2. Current State — Issues Identified

### 2.1 Layout & Responsiveness

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| L1 | **No responsive breakpoints** — zero `@media` queries across all 3 CSS files | `base.css`, `graph.css`, `panels.css` | 🔴 Critical |
| L2 | **Header overflows on <900px** — `#controls` uses `flex-wrap: wrap` with ~16 pills, wraps into 3-4 lines on tablets, unusable on phones | `base.css:26-30` | 🔴 Critical |
| L3 | **Node detail panel: fixed 400px width** — slides in from left, completely covers the graph on mobile (most phone viewports are 360-414px) | `panels.css:2-10` | 🔴 Critical |
| L4 | **Chat panel: fixed 380px width** — same issue, slides from right | `panels.css:165-174` | 🔴 Critical |
| L5 | **Rankings panel: fixed 380px width** — slides from right, overlaps with chat | `panels.css:105-113` | 🔴 Critical |
| L6 | **Add Paper panel: inline styles, fixed 360px, absolute positioned** — `top:54px;right:18px;width:360px` hardcoded in HTML | `index.html:47-54` | 🟡 Major |
| L7 | **Legend & stats overlays** — fixed `bottom:22px left:18px` and `bottom:22px right:18px`, overlap each other on narrow screens | `base.css:55-72` | 🟡 Major |
| L8 | **SVG canvas: `width:100vw; height:100vh`** — correct, but no adjustment for mobile browser chrome (address bar, home indicator) using `dvh` | `graph.css:2` | 🟡 Major |
| L9 | **Search input: fixed 150px** — too small on desktop, overflows its context on mobile | `base.css:43` | 🟠 Moderate |
| L10 | **Body `overflow: hidden`** — prevents any scroll-based UI patterns | `base.css:5` | 🟠 Moderate |

### 2.2 Touch & Interaction

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| T1 | **Hover-only tooltips** — `showNodeTip()` and `showLinkTip()` are triggered by `mouseover`/`mousemove`, completely invisible on touch devices | `interaction.js:45-62`, `main.js:108-130` | 🔴 Critical |
| T2 | **Touch targets below minimum** — `.pill` buttons have `padding: 4px 12px` (≈28×20px). Apple HIG requires 44×44px; Material requires 48×48dp | `base.css:32` | 🔴 Critical |
| T3 | **No pinch-to-zoom handling** — d3.zoom() handles wheel + mouse drag but doesn't explicitly support touch gestures or has no touch-action CSS | `main.js:64-67` | 🟡 Major |
| T4 | **Double-click to open paper** — no equivalent on mobile (double-tap triggers zoom in most browsers) | `main.js:137-139` | 🟡 Major |
| T5 | **Link hit area: 10px stroke** — too narrow for finger-based selection on touch | `render.js:62` | 🟡 Major |
| T6 | **Tooltip positioning uses clientX/clientY** — on touch, this is the touch point which the finger occludes; tooltip appears under the user's thumb | `interaction.js:60-63` | 🟡 Major |
| T7 | **No swipe-to-dismiss on panels** — panels only close via ✕ button or Escape key | `panels.css`, `main.js` | 🟠 Moderate |
| T8 | **Drag on nodes doesn't prevent page scroll** — needs `touch-action: none` on the SVG | `graph.css` | 🟠 Moderate |
| T9 | **No haptic feedback** — missing vibration API calls on significant interactions (select, filter change) | — | 🟢 Minor |

### 2.3 Panel & Navigation UX

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| P1 | **Panels overlap graph entirely on mobile** — both nodeDetail (400px) and chat (380px) exceed viewport width | All panel CSS | 🔴 Critical |
| P2 | **No bottom-sheet pattern** — mobile users expect drawers from the bottom, not sidebars | — | 🔴 Critical |
| P3 | **Too many top-bar buttons** — 16 interactive elements in `#controls`, cognitive overload even on desktop | `index.html:21-41` | 🟡 Major |
| P4 | **Separator pills (`\|`) waste space** — `<span class="pill sep">` elements consume flex gap without value | `index.html`, `base.css:36` | 🟠 Moderate |
| P5 | **No hierarchy in controls** — filters, actions, and toggles all look identical (same `.pill` class) | `base.css:30-35` | 🟡 Major |
| P6 | **Chat/Rankings/Detail can all be open simultaneously** — no mutex behaviour, total screen occlusion | `main.js` | 🟡 Major |
| P7 | **Keyboard trap in chat** — Enter sends, but Shift+Enter for newline is not discoverable; no visual hint | `main.js:372-374` | 🟠 Moderate |
| P8 | **Model selector exposed to all users** — raw model identifiers like `openrouter/hunter-alpha` are not user-friendly | `index.html:151-165` | 🟠 Moderate |
| P9 | **No panel drag handle / resize** — panels are fixed width, no way to resize on desktop | — | 🟢 Minor |
| P10 | **No loading/skeleton states** — panels snap open with raw content, no transition for data loading | — | 🟢 Minor |

### 2.4 Visual Design & Accessibility

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| V1 | **Sub-minimum font sizes** — `8.5px`, `9px`, `9.5px` used throughout; WCAG SC 1.4.4 recommends min 12px for body text | `panels.css`, `base.css` throughout | 🔴 Critical |
| V2 | **Extremely low contrast text** — `#2a3858` on `#070910` = contrast ratio ~1.7:1 (WCAG AA requires 4.5:1) | `panels.css:262`, `base.css:68` | 🔴 Critical |
| V3 | **No focus indicators** — interactive elements have `outline: none` with no replacement focus ring | `base.css:44-45` (search), panel inputs | 🟡 Major |
| V4 | **Missing ARIA labels** — buttons use emoji-only labels (`⬡`, `＋`, `🤖`, `💬`, `📊`), invisible to screen readers | `index.html:37-41` | 🟡 Major |
| V5 | **No `prefers-reduced-motion`** — all transitions and animations play regardless of user preference | All CSS files | 🟡 Major |
| V6 | **No `prefers-color-scheme`** — dark-only design with no light mode option | `base.css` | 🟠 Moderate |
| V7 | **Info bar is pointer-events: none** — it's decorative text, but it overlaps interactive elements on small screens | `base.css:82` | 🟠 Moderate |
| V8 | **No safe-area-inset handling** — on iPhones with notch/Dynamic Island, UI will be clipped | — | 🟡 Major |

---

## 3. Proposed Architecture

### 3.1 Breakpoint System

```
Mobile:    0 – 639px    (single column, bottom sheets, hamburger)
Tablet:    640 – 1023px (collapsible sidebar, compact header)
Desktop:   1024px+      (current layout, improved)
```

Use CSS custom properties and `@media` queries. All dimensions in `rem`/`%`/`dvh` — eliminate hard-coded `px` widths for layout.

### 3.2 Mobile Layout (< 640px)

```
┌────────────────────────┐
│  Compact Header        │  ← Title + hamburger + search icon
│  (48px height)         │
├────────────────────────┤
│                        │
│                        │
│    SVG Graph Canvas    │  ← Full viewport, touch-optimised
│    (100vw × 100dvh)    │
│                        │
│                        │
├────────────────────────┤
│  FAB cluster           │  ← Floating action buttons (bottom-right)
│  [Chat] [Filter] [Add] │     above safe-area-inset-bottom
└────────────────────────┘

   Bottom Sheet (swipeable):
┌────────────────────────┐
│ ── drag handle ──      │
│  Node Detail           │  ← Slides up from bottom, 40%→90% snap
│  Chat                  │
│  Rankings              │
│  Filters               │
└────────────────────────┘
```

### 3.3 Component Remap

| Current | Mobile | Tablet/Desktop |
|---------|--------|----------------|
| `#controls` (16 pills in header) | Hamburger menu → full-screen filter sheet | Collapsible pill bar with overflow scroll |
| `#nodeDetail` (400px left slide) | Bottom sheet, 50% height snap → full drag | Left panel, max `min(400px, 35vw)` |
| `#chatPanel` (380px right slide) | Bottom sheet, full height | Right panel, max `min(380px, 30vw)` |
| `#rankingsPanel` (380px right slide) | Bottom sheet, full height | Right panel (replaces chat when open) |
| `#legend` (fixed bottom-left) | Hidden by default, accessible from ⓘ button | Shown, auto-collapse < 1024px |
| `#stats` (fixed bottom-right) | Merged into header as compact badges | Shown as-is |
| `#infobar` (fixed bottom-center) | Removed; replaced by first-launch toast | Kept but auto-dismisses after 5s |
| Hover tooltips | Long-press tooltip / tap-to-show card | Hover (unchanged) + click fallback |
| Double-click open | Long-press context menu with "Open" action | Unchanged |

---

## 4. Detailed Specifications

### 4.1 Header — Mobile Compact Mode

**Current problem:** 16 buttons, search input, title, subtitle — all in one flex row.

**Proposed (mobile):**
```
┌──────────────────────────────────────┐
│ ☰   Research Knowledge Graph    🔍   │
└──────────────────────────────────────┘
```

- **Left:** Hamburger icon → opens full-screen filter/action sheet
- **Center:** Truncated title ("Knowledge Graph" on smallest screens)
- **Right:** Search icon → expands to full-width search bar (overlays title)
- **Height:** 48px (includes safe-area-inset-top)
- Remove subtitle entirely on mobile

**Proposed (tablet 640-1023px):**
```
┌───────────────────────────────────────────────────┐
│ Research Knowledge Graph        [🔍 Search…]      │
│ [All] [Oli] | [🧠] [🔗] [🔐] [🌐] | [⬡] [＋] [💬] │
└───────────────────────────────────────────────────┘
```

- Single-row pill bar with horizontal scroll (`.rp-tabs`-style overflow)
- Group pills by function with subtle dividers (not `<span>` separators)
- Search expands inline

**Proposed (desktop 1024px+):**
- Similar to current but with grouped button clusters
- Visual hierarchy: primary actions (Add, Chat, Rankings) get accent styling
- Secondary filters get subdued treatment

### 4.2 Bottom Sheet System (Mobile)

Implement a reusable `<bottom-sheet>` web component or CSS/JS pattern:

**Behaviour:**
- **Snap points:** collapsed (0%), half (50%), expanded (92% — leaves header visible)
- **Drag handle:** 40px wide × 4px rounded bar, centered at top
- **Swipe down from collapsed:** dismiss
- **Swipe up from collapsed:** expand to half
- **Velocity-aware:** fast swipe always snaps to next point
- **Backdrop:** Semi-transparent overlay on graph when sheet > 50%
- **Mutual exclusion:** Only one bottom sheet open at a time (chat, detail, rankings, or filters)
- **Keyboard adaptation:** When virtual keyboard opens, sheet content scrolls up

**CSS pattern:**
```css
.bottom-sheet {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  max-height: 92dvh;
  border-radius: 16px 16px 0 0;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding-bottom: env(safe-area-inset-bottom);
  touch-action: none;
  z-index: 400;
}
.bottom-sheet.open { transform: translateY(0); }
```

### 4.3 Node Detail — Revised

**Mobile (bottom sheet):**
- Header: badge row + title (max 2 lines, ellipsis)
- Sticky action bar at bottom: `[↗ Open]  [⌖ Focus]  [✦ Synthesise]`
- Abstract: collapsed by default, "Read more" toggle
- Connections: horizontal scroll cards instead of vertical list
- Metrics: simplified to top-3 with expandable full list

**Desktop:**
- Keep left-slide panel
- Width: `clamp(320px, 30vw, 420px)` instead of fixed `400px`
- Add subtle resize handle on right edge

### 4.4 Touch Interactions

**Tap (single):**
- Select node → highlight connections, open detail bottom-sheet (mobile) or panel (desktop)
- Same as current click

**Long-press (500ms, mobile only):**
- Show tooltip card (replaces hover tooltip)
- Add subtle haptic pulse via `navigator.vibrate(10)`
- Card appears *above* the finger, not under it
- Auto-dismiss after 4s or on any other touch

**Double-tap:**
- Currently: open paper URL → conflicts with browser zoom
- **Change:** Remove double-tap-to-open; move "Open paper" to the detail panel and long-press context menu
- Let native double-tap-to-zoom work (better for graph exploration)

**Pinch-to-zoom:**
- Already partially supported by d3.zoom
- Add `touch-action: none` to `#canvas` to prevent browser interference
- Add visible zoom controls (＋/－ buttons) in bottom-right FAB cluster for accessibility

**Swipe on panels:**
- Horizontal swipe on bottom sheet → switch between detail/chat/rankings tabs
- Vertical swipe → expand/collapse sheet

### 4.5 Tooltip Redesign

**Current:** Floating `<div>` positioned at mouse coordinates. Invisible on touch.

**Proposed — dual mode:**

| Mode | Trigger | Position | Dismiss |
|------|---------|----------|---------|
| Desktop | `mouseenter` (200ms debounce) | 18px right + below cursor, clamped to viewport | `mouseleave` (300ms delay) |
| Mobile | `touchstart` + 500ms hold | Centered above the node (above finger), clamped to viewport | Any other touch, or 4s timeout |

**Additional changes:**
- Increase max-width from `310px` to `min(310px, 90vw)`
- Increase font sizes: title 14px, body 12px, tags 11px (up from 13/10.5/9.5)
- Add a subtle arrow/caret pointing to the node
- Ensure the tooltip doesn't overlap the detail panel

### 4.6 Filter/Controls — Mobile Sheet

When hamburger is tapped, open a full-screen sheet:

```
┌────────────────────────────────────┐
│  Filters & Actions           ✕     │
├────────────────────────────────────┤
│                                    │
│  SCOPE                             │
│  ● All    ○ Oli only               │
│                                    │
│  DOMAIN                            │
│  □ 🧠 Consciousness                │
│  □ 🔗 Trust / Bayesian             │
│  □ 🔐 Crypto / ZK                  │
│  □ 🌐 Collective                   │
│                                    │
│  SOURCE                            │
│  □ arXiv    □ Zenodo               │
│                                    │
│  ─────────────────────             │
│  VISUALISATION                     │
│  [⬡ Hulls]    [⬡ Spectral]        │
│                                    │
│  ACTIONS                           │
│  [＋ Add Paper]  [🤖 AI Edges]      │
│                                    │
│  ─────────────────────             │
│  [Apply filters]                   │
└────────────────────────────────────┘
```

- Use toggle chips / checkboxes instead of exclusive pill buttons
- Allow multi-select on domains (currently exclusive — only one filter at a time)
- Group by semantic function (Scope → Domain → Source → Viz → Actions)
- Persist filter state in `sessionStorage`

### 4.7 Floating Action Buttons (Mobile)

Bottom-right cluster, above safe-area inset:

```
          [💬]   ← Chat toggle
     [📊]        ← Rankings toggle  
[🔍]             ← Quick search
     [＋]        ← Add paper
```

- 48×48px minimum, with 8px gaps
- Semi-transparent background with backdrop-blur
- Expandable: show only primary (💬) by default, tap to fan out secondary actions
- Auto-hide on scroll-down, show on scroll-up (or on graph zoom-out)

### 4.8 Graph Canvas Optimisation

**Performance (mobile):**
- Reduce particle count on mobile: hide labels for non-Oli nodes when zoomed out below 0.5×
- Throttle simulation tick to 30fps on mobile (vs 60fps desktop) via `requestAnimationFrame` gating
- Use `will-change: transform` on the `<g>` transform group
- Consider WebGL renderer (e.g., `d3-force` + PixiJS) for >100 nodes on low-end devices

**Visual:**
- On mobile, default zoom level should frame all Oli nodes (auto-fit on load)
- Add a "fit to view" button (🔲) in the FAB cluster
- Dim node labels at zoom < 0.6× to reduce visual noise

### 4.9 Chat Panel — Revised

**Mobile (bottom sheet, full height snap):**
- Sticky input bar at bottom with safe-area padding
- Messages fill remaining height
- Model selector: collapsed behind ⚙️ icon (not always visible)
- Virtual keyboard: sheet content scrolls, input stays above keyboard (use `visualViewport` API)

**Desktop:**
- Width: `clamp(320px, 28vw, 400px)`
- Resizable right edge

**UX improvements (all breakpoints):**
- Show "Shift+Enter for newline" hint below textarea
- Add typing indicator animation (three bouncing dots)
- Message timestamps (relative: "2m ago")
- Collapsible code/data blocks in AI responses
- Quick-action suggestion chips after AI response: `[Show connections] [Focus on this] [Explain more]`

### 4.10 Search — Revised

**Mobile:**
- Tap 🔍 icon → full-width search bar slides in over the header
- Show results as a dropdown overlay with node previews (title + cluster badge)
- Tap result → focus node + open detail sheet
- "X" to clear / dismiss

**Desktop:**
- Expand search from 150px to `min(280px, 20vw)` on focus
- Show dropdown results inline
- Keyboard shortcut: `Cmd/Ctrl + K` to focus search (power users)

---

## 5. Accessibility Checklist

| Item | Current | Target |
|------|---------|--------|
| **Contrast ratio** (body text) | ~1.7:1 (`#2a3858` on `#070910`) | ≥ 4.5:1 (WCAG AA) |
| **Contrast ratio** (labels/subtle text) | ~2.5:1 (`#3a4055`) | ≥ 3:1 (large text), ≥ 4.5:1 (small text) |
| **Minimum font size** | 8.5px | 12px for body, 11px absolute minimum for labels |
| **Touch target size** | ~28×20px (pills) | ≥ 44×44px (Apple HIG) |
| **Focus indicators** | None (`outline: none`) | Visible 2px ring, offset, using `:focus-visible` |
| **ARIA labels** | Missing on emoji-only buttons | All interactive elements get `aria-label` |
| **Screen reader announcements** | None | `aria-live` regions for filter changes, panel open/close |
| **Reduced motion** | Not respected | `@media (prefers-reduced-motion: reduce)` disables all transitions |
| **Safe area insets** | Not handled | `env(safe-area-inset-*)` on all edge-positioned elements |
| **Keyboard navigation** | Partial (Escape only) | Full tab order, arrow keys for filters, Enter for actions |
| **Semantic HTML** | All `<div>` | Use `<nav>`, `<main>`, `<aside>`, `<header>`, `<dialog>` |

---

## 6. CSS Custom Properties (Design Tokens)

Replace hardcoded values with a token system:

```css
:root {
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* Typography */
  --font-xs: 0.6875rem;    /* 11px */
  --font-sm: 0.75rem;      /* 12px */
  --font-md: 0.875rem;     /* 14px */
  --font-lg: 1rem;         /* 16px */
  --font-xl: 1.25rem;      /* 20px */

  /* Surfaces */
  --bg-primary: #070910;
  --bg-surface: rgba(5, 7, 16, 0.97);
  --bg-elevated: rgba(8, 11, 22, 0.97);
  --bg-interactive: rgba(255, 255, 255, 0.05);

  /* Text */
  --text-primary: #eef2ff;
  --text-secondary: #8a9ac0;
  --text-tertiary: #556080;
  --text-disabled: #3a4868;

  /* Accent */
  --accent-blue: #6e9fff;
  --accent-purple: #b07dff;
  --accent-green: #5ecfa0;
  --accent-orange: #f0a040;
  --accent-cyan: #60c8f0;

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.1);
  --border-accent: rgba(110, 159, 255, 0.35);

  /* Radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 9999px;

  /* Panels */
  --panel-width: clamp(320px, 30vw, 420px);
  --header-height: 54px;

  /* Touch */
  --touch-min: 44px;

  /* Safe areas */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

@media (max-width: 639px) {
  :root {
    --header-height: 48px;
    --panel-width: 100vw;
  }
}
```

---

## 7. Implementation Plan

### Phase 1 — Foundation (Week 1–2)
1. **Add CSS custom properties** — tokenise all hardcoded colours, sizes, radii
2. **Add breakpoint media queries** — mobile/tablet/desktop scaffolding
3. **Add `touch-action: none`** on `#canvas`
4. **Add `dvh` units** — replace `100vh` with `100dvh` (with `vh` fallback)
5. **Add `env(safe-area-inset-*)` padding** to header, panels, FABs
6. **Convert inline styles** in `#addPanel` to CSS classes
7. **Semantic HTML** — replace structural `<div>`s with `<header>`, `<main>`, `<nav>`, `<aside>`

### Phase 2 — Mobile Header & Controls (Week 2–3)
1. **Build hamburger menu** — collapses `#controls` into a full-screen filter sheet on mobile
2. **Build compact header** — title + hamburger + search icon
3. **Build expandable search** — overlay mode on mobile, inline expand on desktop
4. **Group filter buttons** — scope / domain / source / viz / actions
5. **Increase touch targets** — minimum 44×44px on all interactive elements
6. **Add `aria-label`** to all emoji-only buttons

### Phase 3 — Bottom Sheet System (Week 3–4)
1. **Build `BottomSheet` component** — snap points, drag handle, backdrop, velocity-aware
2. **Migrate `#nodeDetail`** → bottom sheet on mobile, keep left panel on desktop
3. **Migrate `#chatPanel`** → bottom sheet on mobile, keep right panel on desktop
4. **Migrate `#rankingsPanel`** → bottom sheet on mobile, keep right panel on desktop
5. **Add panel mutex** — only one sheet open at a time on mobile
6. **Add swipe-to-dismiss**

### Phase 4 — Touch Interactions (Week 4–5)
1. **Long-press tooltip** — replace hover with 500ms touch-hold on mobile
2. **Remove double-tap-to-open** — move to detail panel action
3. **Position tooltip above finger** on touch devices
4. **Add zoom ＋/－ buttons** — FAB cluster
5. **Add "fit to view" button**
6. **Add haptic feedback** via `navigator.vibrate()`

### Phase 5 — Visual & Accessibility (Week 5–6)
1. **Fix colour contrast** — raise all text to WCAG AA minimums
2. **Raise minimum font sizes** — 12px body, 11px labels
3. **Add `:focus-visible` rings** on all interactive elements
4. **Add `prefers-reduced-motion`** — disable transitions/animations
5. **Add `aria-live` regions** for dynamic content updates
6. **Add keyboard navigation** — tab order, arrow keys in filters
7. **Add onboarding toast** — first-visit hint replacing the static `#infobar`

### Phase 6 — Performance (Week 6+)
1. **Throttle sim tick to 30fps on mobile** devices
2. **Auto-hide labels** at low zoom levels
3. **Lazy-render** off-screen nodes (viewport culling)
4. **Test on real devices** — iPhone SE (375px), iPhone 15 (393px), Pixel 7 (412px), iPad Mini (744px)

---

## 8. File Change Map

| File | Changes |
|------|---------|
| `index.html` | Semantic HTML tags; ARIA labels; remove inline styles from `#addPanel`; add `<meta name="theme-color">`; add hamburger button; restructure controls into grouped `<nav>` |
| `styles/base.css` | Design tokens; breakpoints; safe area insets; header responsive modes; touch targets; contrast fixes; font size floor |
| `styles/graph.css` | `touch-action: none`; `dvh` units; reduced-motion; zoom button styles; responsive tooltip max-width |
| `styles/panels.css` | Bottom sheet styles; `clamp()` panel widths; responsive panel modes; drag handle; backdrop overlay; keyboard-aware input |
| `src/graph/interaction.js` | Long-press handler; touch-aware tooltip positioning; remove double-click on mobile; viewport detection utility |
| `src/graph/render.js` | Adaptive label visibility based on zoom and viewport; performance throttling |
| `src/graph/simulation.js` | Frame-rate gating for mobile |
| `src/panels/detail.js` | Bottom sheet integration; collapsible abstract; responsive connection cards |
| `src/panels/chat.js` | Bottom sheet integration; virtual keyboard handling; model selector collapse |
| `src/panels/rankings.js` | Bottom sheet integration; responsive row layout |
| `src/main.js` | FAB cluster; hamburger wiring; panel mutex; viewport resize handling; onboarding logic |
| **New:** `src/ui/bottom-sheet.js` | Reusable bottom sheet with snap points, drag, velocity, backdrop |
| **New:** `src/ui/fab.js` | Floating action button cluster with expand/collapse |
| **New:** `src/ui/hamburger.js` | Mobile menu controller |

---

## 9. Testing Matrix

| Device | Viewport | Priority | Key Tests |
|--------|----------|----------|-----------|
| iPhone SE (3rd gen) | 375 × 667 | 🔴 P0 | Smallest modern phone; all touch targets reachable |
| iPhone 15 Pro | 393 × 852 | 🔴 P0 | Dynamic Island safe area; notch handling |
| Pixel 7 | 412 × 915 | 🔴 P0 | Android Chrome; virtual keyboard behaviour |
| iPad Mini | 744 × 1133 | 🟡 P1 | Tablet breakpoint; split-view multitasking |
| iPad Pro 12.9" | 1024 × 1366 | 🟡 P1 | Desktop breakpoint on tablet |
| Desktop 1440px | 1440 × 900 | 🔴 P0 | Current primary target; regression test |
| Desktop 1920px | 1920 × 1080 | 🟠 P2 | Large screen; panel proportions |
| Galaxy Fold (unfolded) | 717 × 512 | 🟠 P2 | Unusual aspect ratio |

---

## 10. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Lighthouse Mobile Performance | Untested (likely < 60) | ≥ 85 |
| Lighthouse Accessibility | Untested (likely < 50) | ≥ 90 |
| First meaningful interaction (mobile) | N/A — non-functional | < 3 seconds |
| WCAG AA contrast compliance | 0% of text elements | 100% |
| Touch target compliance (44px min) | 0% of buttons | 100% |
| Panel usable on 375px viewport | ❌ | ✅ |
| Graph navigable via touch only | ❌ | ✅ |
