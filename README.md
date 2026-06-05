# P n Ledger

A local-first futures & stock-options day trading journal. Runs as a desktop app
(Windows / macOS / Linux) and can be packaged for iPhone and Android — all from
this one codebase. Nothing is sold, no account is required, and **all of your data
stays on your own device.**

---

## What's inside (v0.1)

- **Accounts** — group accounts by prop firm or broker; eval / funded / live /
  paper / blown statuses; eval type + freeform rules; per-account commission;
  starting balance with manual override; record payouts; mark passed / blown /
  purchased; auto-prompt to spin up a funded account when an eval hits its target.
- **Trade logging** — futures *and* options (the form changes fields to match),
  instrument typeahead, partial exits with live **net** P/L (gross − commission),
  setup grade, your custom rules checklist, mistake tags, notes, screenshots, and
  a **trade copier** to duplicate a journal entry into other accounts.
- **Dashboard** — today / week P/L, rule-following %, streak, trades left, P/L by
  strategy, today's trades, most expensive mistakes. Filter by account / firm /
  type. The little dot by the logo turns amber/red if you stop following rules.
- **Calendar** — month grid colored by daily P/L, US market holidays baked in,
  markers for payouts / passed / blown / purchased, click any day for full detail.
- **Analytics** — equity curve, win rate, profit factor, avg win/loss, P/L by
  time of day, by setup grade, and by strategy.
- **Daily recap** — the end-of-day "close the chart on purpose" form + report card.
- **Import** — upload a broker CSV (Tradovate preset + generic column mapping),
  preview, and bulk-import. More broker presets are next.
- **Settings** — every list (strategies, rules, mistake tags) and every
  instrument spec + commission is editable. JSON backup export.

### About the numbers
Contract specs (tick size / tick value / point value) come from public CME data
and are baked in correctly — MNQ is $0.50/tick, NQ $5.00, ES $12.50, and so on.
**Gross P/L is exact tick math.** The only thing that turns it into **net** is the
commission you set per account (pre-filled with a typical rate, fully editable,
and changes apply to all past trades). If you leave commission at 0, the app shows
gross and says so.

---

## Run it (development)

You need [Node.js](https://nodejs.org) 18+ installed.

```bash
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173). This is the fast way
to use and iterate on the app in a browser. Your data persists locally in the
browser's storage.

---

## Run it as a desktop app (the double-click icon)

```bash
npm run electron:dev      # opens the app in a native desktop window (not a browser tab)
```

To produce a real installer with a desktop shortcut:

```bash
npm run electron:build
```

The installer lands in the `release/` folder. On Windows that's an `.exe` that
installs **P n Ledger** and creates a desktop icon you double-click to open. On
macOS it's a `.dmg`; on Linux an `AppImage`.

> Optional: drop a `build/icon.ico` (Windows), `build/icon.icns` (macOS), and
> `build/icon.png` (Linux, 512×512) to use your own app icon. Without them the
> build still works with a default icon.

---

## Put it on iPhone / Android (later)

This uses [Capacitor](https://capacitorjs.com), and `capacitor.config.json` is
already set up. When you're ready:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npm run build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios       # opens Xcode (needs a Mac) to run/install on iPhone
npx cap open android   # opens Android Studio to run/install on a device
```

Because the whole app stores data in the device's local storage, it works the
same on mobile as on desktop — no server, no login.

---

## Put it on GitHub

```bash
git init
git add .
git commit -m "P n Ledger v0.1"
```

Then create an empty repo on github.com and:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pnledger.git
git push -u origin main
```

`node_modules`, `dist`, and `release` are already in `.gitignore`, so only the
source gets committed. (I can walk you through this step-by-step when you want.)

---

## Tech

React + Vite, IndexedDB (via Dexie) for local storage, Recharts for charts,
Electron for the desktop shell, Capacitor for mobile. One codebase, three targets.
