# Hearth — working notes

Home energy analytics for PG&E Green Button exports. Vite + React 19 + TypeScript,
Supabase for auth and storage, deployed on Vercel.

## Conventions that must hold

### Every screen has a real URL

**Never ship a screen that lives at `/` or `/#`.** Each screen — including
settings, account, and anything added later — gets its own path (`/overview`,
`/energy`, `/settings`, …). This is not cosmetic:

- **Analytics**: page views are only attributable when the URL distinguishes them.
- **SEO**: a crawler cannot index a screen that has no address.
- **Users**: refresh, bookmark, share, and back/forward all depend on it.

How it works here:

- `src/lib/routes.ts` owns the path table. **Adding a screen = adding one entry
  to `PAGE_PATHS` and `PAGE_TITLE`.** Nothing else needs to learn about it.
- The URL is the source of truth. `App.tsx` derives the current page from the
  path; it never keeps a separate "which page" state that could disagree.
- Navigation goes through `navigate()` (pushState), and nav items are real
  `<a href>` elements so middle-click, open-in-new-tab and crawlers all work.
  Plain left clicks are intercepted; modified clicks are left to the browser.
- `document.title` is set per route, so history entries and search results read
  distinctly.
- `vercel.json` rewrites unknown paths to `/index.html`, so a deep link survives
  a refresh. Static assets are matched before rewrites and are unaffected.
- Redirects that correct the URL use `replaceState`, never `pushState`, so a
  corrected address never traps the back button.

### Other standing rules

- **Dates are mm/dd/yyyy.** Uploads are normalised on parse regardless of the
  file's order (`detectDateOrder` in `src/lib/parse.ts`); when a file reads
  validly both ways the user is asked rather than guessed at.
- **Temperatures are °F in the engine**, converted at render via `fmtTemp`.
  A temperature *difference* uses `fmtTempDelta` (×5/9, no 32° offset).
- **Charts are interactive by default** — crosshair, one tooltip listing every
  series, keyboard parity. Shared primitives live in `src/components/chart.tsx`.
- **Motion follows the Kole rules**: 150ms interaction states, ~500ms ease-out
  entrances, all disabled under `prefers-reduced-motion`.
- **No em-dashes in user-facing copy.**
- **A signed-in account's uploads merge, they don't replace.** Each fuel is one
  history (`src/lib/merge.ts`). Before saving, the upload step shows where a new
  file overlaps that history and what gap it leaves, and the user confirms once;
  overlapping readings keep the saved copy unless they choose the file's. The
  merged history is stored as one CSV and updated in place, so annotations keyed
  to the row survive. Guests' files still replace. Demo view has no upload.
- **Email links land on `/signin`.** A confirmation link's session is never used:
  `readEmailLanding` (`src/lib/api.ts`) strips the token before the Supabase client
  can read it, revokes it, and sign-in says the address is confirmed. Auth redirect
  URLs are full paths, since the allow-list's `/**` entries never match a bare origin.
- **Every nav tab explains itself.** `NAV_PAGES` entries carry a required one-line
  `brief`; `PageTip` shows it beside the tab the first time a visitor or a new
  account (under 14 days old) lands on that page.
- **Billing cycles come from one place.** `src/lib/cycles.ts` steps cycles out
  from the one the user confirmed. The Rates allowance, the bill projection
  (always the cycle holding the last reading), the Overview cycle dots and Bills
  by cycle all walk them from there. A confirmed range outside 20 to 40 days is
  not a cycle, and those features stand down rather than guess.
- **Calibrate asks everything as questions.** Flagged days join the diagnostic
  questions (`dayQuestions`, `src/lib/content.ts`); a day's answer is its event tag
  (`evMeta`, the `annotations` table), read and written through `answerOf` and
  `dayTag`. A day an existing question already covers is not asked twice.
- **Calibrate's archive only tidies the page.** Archived answers keep refining
  every estimate. Accounts keep it as `archived_at` on `answers` and
  `annotations`; guests and the demo in the browser. Answer and annotation writes
  share one ordered queue (`inOrder`, `src/lib/api.ts`), so an archive never
  overtakes the answer it files.

## Commands

```
npm run dev        # vite dev server
npm run typecheck  # tsc -b   ← the real typecheck; `tsc --noEmit` is a no-op here
npm run build      # tsc -b && vite build
node scripts/engine-test.mjs   # engine self-test over the sample data
```

`tsconfig.json` is a solution file with `"files": []` and project references, so
**`npx tsc --noEmit` silently checks nothing**. Always use `npm run typecheck`.
