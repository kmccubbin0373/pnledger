# Release Notes

## v0.4.0 — macOS Support (2026-06-10)

### What's new

**P n Ledger now builds and runs on macOS**

- Added `build/icon.icns` (full multi-resolution app icon set, 16px–1024px) so `npm run electron:build` produces a properly-iconed `.dmg` on macOS instead of falling back to the default Electron icon.
- Added a `mac.category` (`public.app-category.finance`) to the electron-builder config so the app is categorized correctly in Launchpad / Finder.
- Verified the Electron main process and preload script are platform-agnostic (no Windows-only paths or APIs), so the existing codebase needed no further changes to run on macOS.

### Files changed

- `build/icon.icns` — new macOS app icon
- `package.json` — added `mac.category`, version bump to 0.4.0

---

## v0.3.2 — PDF Export (2026-06-09)

### What's new

**Three PDF export actions**

- **Full PDF** — one-click daily report: plan details + all setup screenshots, every trade with entry/exit prices + trade screenshots, and your full recap/review. Shows a P/L summary strip at the top. Available in the recap modal footer when editing a saved recap.
- **Trades PDF** — trades-only export for the date. Same button, same modal.
- **Plan PDF** — exports your trading plan (bias, setups, avoids, stop rules, notes, setup screenshots) as a clean PDF. Button appears on each plan card alongside the existing .txt / .md buttons.

All three PDFs share a dark navy header bar with the app name, date, and section label. Long-text fields wrap cleanly; screenshots are embedded and scaled proportionally. Missing screenshots are silently skipped — no crash.

### Files changed

- `src/lib/pdfExport.js` — new PDF engine (jsPDF-based)
- `src/pages/Recap.jsx` — Full PDF and Trades PDF buttons in modal footer
- `src/pages/Plan.jsx` — Plan PDF button on plan cards
- `package.json` — added `jspdf` dependency

---

## v0.3.1 — Recap Export (2026-06-09)

### What's new

**Recap export to .txt and .md**

Each recap card now shows **.txt** and **.md** download buttons below the snippet preview. Clicking either downloads a formatted file without opening the modal — clicking the card itself still opens it as before.

When editing an existing recap, the same two export buttons appear in the modal footer next to Delete, so you can export while reviewing or editing.

**Export format**

- `.txt` — plain-text `Label: value` layout, compatible with "Import recap" for round-tripping. Long-text fields get their own paragraph block. Sections are numbered (Pre-session plan, Execution review, Discipline, Reflection, Wellbeing, Custom, Other).
- `.md` — Markdown with bold labels and `##` section headings. Suitable for pasting into Notion, Obsidian, or any Markdown journal.

### Files changed

- `src/lib/recapio.js` — added `buildRecapTxt` and `buildRecapMd` export functions
- `src/pages/Recap.jsx` — wired export buttons onto cards and modal footer

---

## v0.3.0 — Custom Recap Fields, Universal Recap Import, Plan Screenshots, Plan Export/Import, Dashboard Timeframe

- Custom recap fields manager (add / reorder / archive fields)
- Universal recap import — parse any .txt, .md, or .docx shaped as "Label: value"
- Plan screenshots — attach and view screenshots on the daily plan
- Plan export (.txt / .md) and import
- Dashboard timeframe selector (1W / 1M / 3M / 6M / YTD / 1Y / All)

---

## v0.2.0 — R-Multiple, Exit Efficiency, Report Builder, Plan Module, Advanced Analytics, Shareable Report

- R-multiple and exit efficiency metrics per trade
- Report builder with shareable HTML export
- Daily plan module (bias, targets, avoids, stop rules)
- Advanced analytics page
- Shareable report link

---

## v0.1.1 — Auto Updater, Startup Launch

- Electron auto-updater via GitHub Releases
- Launch on system startup option
