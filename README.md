# Hearth — Home Energy Analytics

A home-energy analytics dashboard that turns PG&E "Green Button" usage exports into
insight: daily usage and cost trends, an hourly heatmap, anomaly events, a
forecast-driven AC playbook, and dollar-quantified saving advice.

This is the implementation of the **Hearth Prototype** design (Claude Design handoff,
built on the Kole Jain design system): four pages — Overview, Energy, AC Playbook,
Activity — plus a 4-step onboarding flow, in dark and light themes, for desktop and
mobile.

## Stack

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript
- DM Sans via `@fontsource/dm-sans`, [Phosphor Icons](https://phosphoricons.com) via `@phosphor-icons/web`
- No other runtime dependencies; charts are hand-rolled SVG

## Develop

```sh
npm install
npm run dev        # dev server
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

## Structure

```
src/
  styles/tokens.css      Kole Jain design-system tokens (ported from the handoff)
  styles/hearth.css      App base styles, light-theme overrides, interaction states
  lib/data.ts            Deterministic demo dataset (seeded generators from the design)
  lib/svg.ts             SVG series-path helper
  model.ts               Shared static content: nav, questions, events, formatting
  App.tsx                State + app shell (sidebar / header / mobile tab bar)
  components/            Sidebar, Header, MobileTabBar, Onboarding modal
  pages/                 Overview, Energy, Playbook, Activity
```

## Design-to-code notes

- The prototype's `device` canvas prop (desktop 1280×860 / mobile 393×852 frames) maps
  to a responsive breakpoint: the sidebar layout appears at ≥ 860px, the bottom tab
  bar below it.
- The prototype's `startWithOnboarding` prop maps to a first-visit gate: onboarding
  opens automatically until it is completed or dismissed once (`hearth-setup-done`
  in localStorage); "Replay setup" reopens it any time.
- Theme choice persists as `hearth-theme` in localStorage, matching the prototype.
- `color-scheme` is synced to the active theme (dark by default, light under
  `.hearth-light`) so native form-control chrome — select popups, checkbox glyphs —
  follows the app theme rather than the OS preference. The prototype declared none,
  which would have left UA chrome always light.
- The demo dataset ports the design's seeded generators exactly, so every on-screen
  number matches the design: 1,687.8 kWh / $686.10 electric, 24.3 therms / $38.20 gas
  over Jul 25 – Aug 23, 2026.
- Real CSV parsing, accounts, and weather integration (see the Wattwise spec this
  product derives from) are intentionally out of scope here; the data layer is
  isolated in `src/lib/data.ts` so a parser can replace it without touching the UI.
