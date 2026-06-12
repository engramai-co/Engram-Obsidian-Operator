# Operator UX Review Checklist

Use this checklist before making frontend or workflow-surface changes. The first pass should produce findings only, then accepted findings can become a separate implementation plan.

## Severity

- P0: blocks normal first-run use.
- P1: makes UX confusing, visually noisy, or trust-eroding.
- P2: polish, layout, copy, or maintainability.

## First-Screen Calmness

- The first screen leads with Today and the user's current vault state.
- Quick Capture and Current Work are easy to scan.
- Section headers avoid visible helper paragraphs when controls and content already explain the surface.
- More workflows is collapsed by default.
- Optional modules do not dominate core workflows.
- Last Run appears only when there is useful run history.
- First-run onboarding prioritizes native vault initialization before agent skill setup.
- First-run onboarding shows one current action, not a duplicated setup control row.
- First-run runner consent uses calm language and accurately states write limits and outside-vault read access.

## Setup Health

- Setup health does not look scary.
- Selected backend blockers are visually and textually primary.
- Optional integrations are labeled optional and do not look required.
- Setup and onboarding chips visually distinguish needed, locked, and optional states.
- Healthy state details do not create a wall of explanatory text.
- Disabled workflow buttons explain the exact selected-backend blocker.

## Preview

- Preview is inspectable without being noisy.
- Start my day shows target and expected output before the full prompt.
- Full vault paths stay out of visible Preview metadata.
- Compact Preview expected note labels stay short while full paths remain inspectable.
- Preview helper copy does not add visible intro paragraphs.
- Preview modals stay within the viewport and scroll internally.
- Long modal paths and metadata chips wrap instead of widening the modal.
- Advanced Preview detail grids do not widen narrow modals.
- Full prompt, likely reads/writes, and pre-flight details are available for inspection.
- Editing the prompt updates expected target information where supported.
- Copy prompt and Run use the same resolved prompt.

## Workflow Tiering

- Core daily/project/meeting workflows are easiest to find.
- Strategy and deadline workflows are available without dominating onboarding.
- Intelligence, academic, content, calendar/event, and deep research workflows stay under Optional modules or power-user surfaces.
- Raw slash commands and CLI handoff remain reachable for power users.

## Responsive Layout

- mobile/narrow-width text does not overflow.
- Dashboard header copy and actions wrap before the first screen feels cramped.
- Button labels remain readable or wrap cleanly.
- Inputs, selects, and textareas shrink within cards and modals.
- Panel title rows wrap when titles and actions compete for width.
- Status tile labels and chips wrap without horizontal overflow.
- Cards, tiles, and panels keep stable dimensions when content changes.
- Project row empty states avoid Markdown headings like ## Now.
- Long paths, prompts, and raw logs wrap or scroll inside their containers.
- Last Run metadata wraps long expected note paths.
- Last Run expected note metadata stays compact while full paths remain inspectable.
- Disabled expected-note openers explain why they are unavailable.
- No text overlaps preceding or following content.

## Obsidian-Native Behavior

- Obsidian-native behavior stays primary for deterministic structure.
- Native actions write only the expected Markdown files and folders.
- Disabled native open buttons explain which Markdown file is missing.
- Native project path previews stay compact while full paths remain inspectable.
- Task actions update source Markdown checkboxes.
- Agent workflows remain preview-first.
- The UI does not imply Operator is a separate database-backed task app.

## Review Output Format

Use this format for UX findings:

```text
P1 - Setup health detail is visually too dominant
Evidence: describe the visible issue and where it appears.
Impact: explain why this hurts first-run trust or scanning.
Suggested direction: describe the smallest product-level fix, not a full implementation.
```
