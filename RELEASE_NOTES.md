# Release Notes

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
