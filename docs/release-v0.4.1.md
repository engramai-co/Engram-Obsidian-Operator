# Operator v0.4.1 Release Notes

This beta tightens the Operator Home install path and reduces first-run UI noise. It keeps the same Markdown-first product model as v0.4.0, with a calmer dashboard, compact Preview defaults, and clearer setup memory for future development work.

## User Install

1. Download `operator-control-0.4.1.zip` from the GitHub release.
2. Unzip it and move the resulting `operator-control/` folder into `<your vault>/.obsidian/plugins/`.
3. Enable **Operator** in Obsidian Community plugins, initialize the vault from **Get started**, then use **Setup health** to install Codex or Claude skills.

Release zip users do not need npm commands. `npm install`, `npm run build`, and `npm run install:plugin -- "<vault>"` are only for source development or cloned repos.

## Product Notes

- **Get started** prioritizes native vault initialization before backend skill installation, then keeps the full setup checklist collapsed.
- Start my day Preview stays compact by default: target, expected note, backend, edit/copy/run controls first; full prompt and read/write details stay inspectable behind advanced details.
- **Setup health** shows selected-backend readiness first. Optional integrations and alternate backend checks stay advanced and non-blocking.
- Dashboard helper copy, full vault paths, raw logs, and implementation-source labels are moved out of the visible first screen where possible.
- Development memory and UX review docs now define the durable product direction, while scratch plans and screenshots remain ignored.
- The release includes both `operator-control-0.4.1.zip` and the compatibility `operator-control.zip`.

## Clean-vault smoke checklist

Use a clean local vault before merging or publishing the release:

- Build and verify locally with `npm run test`, `npm run build`, and `npm run package:plugin`.
- Confirm `unzip -Z1 dist/operator-control-0.4.1.zip` lists only `operator-control/`, `operator-control/manifest.json`, `operator-control/main.js`, and `operator-control/styles.css`.
- Unzip `dist/operator-control-0.4.1.zip` into a clean vault's `.obsidian/plugins/` folder.
- Enable **Operator** in Obsidian and open the dashboard.
- Confirm the first screen is calm: **Today**, **Quick Capture**, **Current Work**, collapsed **More workflows**, collapsed **Setup health**, and **Last Run** only when present.
- Confirm first-run **Get started** shows one current next step and prioritizes **Initialize vault** before Codex or Claude skill setup.
- Confirm **Start my day** is disabled only for selected-backend blockers, not for optional Gmail/Gemini/Calendar/Multi-agent status.
- Initialize the vault, create a native project, and confirm the project note appears under **Current Work**.
- Confirm Start my day unlocks with the selected backend after vault setup, CLI, login where required, and Operator skills are ready.
- Confirm **Start my day Preview** opens compactly, exposes **Edit prompt**, and keeps full prompt/read/write detail collapsed but inspectable.
- Switch to Claude mode and confirm Claude CLI and Claude Operator skills appear first, while Codex login is optional.
- Expand **More workflows** and confirm GitHub, arXiv, AI weekly, content, and calendar/event workflows are inside **Optional modules**, not first-screen defaults.
- Capture narrow and normal Obsidian pane screenshots before treating rendered UI smoke as complete.
