# Hearth — Home Energy Analytics

A privacy-first platform that turns PG&E "Green Button" usage exports into insight:
usage and cost trends, an hourly heatmap, anomaly events, a peak-window read of your
own rate plan, a forecast-driven AC playbook, and dollar-quantified saving advice.

Users create an account, upload their electricity and/or gas CSVs, and every panel is
computed from their own meter data. A built-in **demo mode** shows the complete
experience on a sample home before signing up — the demo runs the exact same parsing
and analysis pipeline over bundled sample CSVs.

Built in the Hearth design (Kole Jain design system) — five pages (Overview, Energy,
Rates, AC Playbook, Activity), dark/light themes, desktop and mobile layouts.

## How it works

- **All analysis is client-side.** CSVs are parsed and analyzed in the browser; data
  is uploaded only when a signed-in user finishes setup (the raw CSV is stored in
  their account so any device can re-analyze it).
- **The rate plan is never assumed.** The peak window and peak/off-peak rates are
  inferred from the user's own cost column, so any PG&E plan works unconfigured.
  The Rates page goes further: it clusters unit prices into below/above-allowance
  tiers, tabulates hour-by-hour effective rates against the load actually run, and
  estimates the baseline allowance from where each cycle's prices step up.
- **Robust statistics only.** Baselines use median/MAD, so the spikes being hunted
  can't drag their own baseline. Estimated readings are excluded from spike
  detection. Gas uses an adaptive active-day threshold (water-heater days vs idle).
- **Honest numbers.** Savings estimates only count load that plausibly belongs to the
  thing being discussed (cooling = hot-day minus mild-day delta; ~15% of standby is
  treated as trimmable), never a flat share of the bill.
- **Three data tiers**: demo (sample home), guest (uploads stay in localStorage),
  account (Supabase — profile, uploads, question answers, event annotations, all
  behind per-user row-level security).
- **Onboarding asks only for what changes the output**: account (or continue without
  one, or browse the demo), then optional home facts each labeled with why they're
  asked (ZIP → live forecast; AC type → playbook; occupancy → quiet-day reads; home
  type → standby benchmarks; EV/pool/dryer → targeted questions), then the upload,
  then a billing-cycle confirmation pre-filled from the data.

## Stack

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript
- [Supabase](https://supabase.com) (GoTrue auth + PostgREST) via `@supabase/supabase-js`
- Open-Meteo + zippopotam.us for the optional ZIP-based 7-day forecast (keyless)
- DM Sans via `@fontsource/dm-sans`, [Phosphor Icons](https://phosphoricons.com); hand-rolled SVG charts

## Develop

```sh
npm install
npm run dev              # dev server
npm run build            # typecheck + production build into dist/
npm run preview          # serve the production build
node scripts/engine-test.mjs   # run the analysis engine over the sample CSVs
```

## Structure

```
src/
  lib/
    config.ts        Supabase URL + publishable key (RLS-protected)
    api.ts           Auth + data access (profiles, uploads, answers, annotations)
    parse.ts         PG&E Green Button CSV parser (fuel/granularity auto-detect)
    stats.ts         Robust statistics primitives (median, MAD, quantile)
    analyze.ts       The engine: TOU detection, always-on load, anomaly events,
                     hourly profile, heatmap, bill projection
    rates.ts         Rate-plan analysis: tier clustering, hour-by-hour effective
                     rates, baseline-allowance estimation
    content.ts       Generated insights, savings estimates, diagnostic questions
    acplan.ts        Thermostat schedule + comfort bands from the detected peak
    weather.ts       ZIP → 7-day forecast (cached, optional, degrades gracefully)
    sample.ts        Demo home rendered as real Green Button CSVs
    data.ts          Seeded generators behind the sample home
    svg.ts, format.ts
  store.ts           Session, profile, uploads, answers, annotations; demo/live modes
  App.tsx            State + shell; runs the engine over the active mode's uploads
  components/        Sidebar, Header, MobileTabBar, Onboarding, EmptyState
  pages/             Overview, Energy, Playbook, Activity
  styles/            Kole Jain tokens + Hearth base styles
```

## Database

Supabase project `wattwise` (`rhdtwvdcwlmaptdutelx`), tables `profiles`, `uploads`
(raw CSV + billing dates), `answers`, `annotations` — each with per-user RLS
(`auth.uid()` policies). Email confirmation is enabled for sign-ups.
