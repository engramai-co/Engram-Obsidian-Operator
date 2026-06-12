# Operator Development Memory

This is the durable product and UX memory for Operator Home. Use it before changing dashboard structure, setup health, release install docs, workflow placement, or Preview behavior.

This file records product decisions, not contributor workflow. Agent scratch locations and the two-layer memory model live in `CLAUDE.md` under "Rules for content & data".

## Product Promise

Operator Home is an Obsidian-native daily home and AI concierge for Markdown-first execution. It can grow into a broader personal operating system, but the first product impression should feel like a calm daily concierge that uses native Obsidian actions for fixed structure and launches Codex or Claude only when reasoning, synthesis, or orchestration is useful.

Default product promise:

- Install the dashboard without cloning or building.
- Initialize a clear vault structure.
- Create projects, capture notes, and update Markdown tasks natively.
- Start the day with a previewed agent run.
- Keep advanced workflows reachable without making the first screen feel like a workflow console.

## Workflow Tiers

### Core Default

Core Default workflows may appear in the normal product path:

- Vault initialization
- Start my day
- Quick Capture
- Native project creation
- Native Done and Carry actions for visible Markdown tasks
- Weekly setup and weekly review
- Project sync
- Meeting prep and meeting processing

### Advanced But Product-Relevant

Advanced But Product-Relevant workflows should stay available but not dominate onboarding:

- Annual vision and annual review
- Quarterly plan, monthly pulse, and quarter review
- Deadline plan
- Link enrichment or graph maintenance
- Raw agent prompt
- Copy CLI handoff
- Legacy slash-command paths such as `/project-init`

### Optional Modules

Optional Modules are off by default for Start my day and should never look required:

- Intelligence: AI weekly, GitHub trends, academic scans
- Content: content extraction and drafting
- Calendar/events: pasted event and deadline ingestion
- Deep research: preserved for power users, but not a first-screen default

When an optional module is enabled, Preview should make that explicit before the run starts.

## UX Principles

### Dashboard

- First screen should stay calm: Today, Quick Capture, Current Work, collapsed More workflows, collapsed Setup health, and Last Run only when useful.
- First-run onboarding should show one current next step first, with the full setup checklist collapsed.
- First-run onboarding should prioritize native vault initialization before backend skill installation.
- First-run next-step cards should show at most one current action rather than duplicating the full Setup health control row.
- Onboarding should not repeat setup-helper copy after the current next step; the next-step card and collapsed Setup health already cover the missing setup detail.
- Avoid first-screen exposure of GitHub trends, arXiv scans, content engine, deep research, and calendar/event ingestion.
- Use native Obsidian actions for deterministic work before reaching for an agent workflow.
- Do not turn Markdown tasks into a separate task manager.
- Disabled native open buttons should explain missing Markdown files in title and aria metadata.
- Keep expanded More workflows grouped by Plan, Projects & meetings, Strategy, Optional modules, and Power user rather than one undifferentiated workflow grid.
- Last Run should keep the latest summary visible, with the full prompt and raw log collapsed for debugging.
- Last Run metadata paths should wrap instead of widening the dashboard.
- Last Run expected note metadata should show compact status labels while full paths stay in title or data metadata.
- Disabled Last Run expected-note buttons should explain missing or pending notes in title and aria metadata.
- Expanded Last Run prompt and raw log should wrap or scroll inside the dashboard without widening the pane.
- Empty states should be short and plain; keep implementation sources such as `Blockers.md`, section names, and long setup explanations in docs, titles, or troubleshooting copy rather than repeating them across the first screen.
- Project row empty states should use user-facing next-action language and keep Markdown section names in metadata or docs.
- Core section headers should avoid visible helper copy when the title, controls, and content already explain the surface; keep helper context in title or metadata instead.
- Button labels should wrap cleanly in narrow Obsidian panes.
- Form controls should shrink within workflow cards and modals instead of widening the pane.
- Panel title rows should wrap when titles and actions compete for narrow pane width.
- Status tile titles should wrap labels and chips instead of forcing horizontal overflow.
- Needed, locked, and optional chips should have distinct subdued styles instead of inheriting plain neutral chip styling.
- Dashboard header copy and actions should wrap before they make the first screen feel cramped.
- Workflow helper descriptions should live in title or aria metadata when the visible label and controls are already clear; avoid turning expanded workflow panels into a written manual.
- Nested workflow disclosures should use workflow group styling, not full section/card styling, so expanded surfaces do not create card-in-card visual nesting.
- Power user raw prompt and CLI handoff should stay collapsed inside More workflows.
- Dashboard header should show date, time, week, and quarter without full note paths; keep the current daily note path in title/data metadata and in explicit Open actions.
- Modal helper descriptions should live in title or aria metadata when the form labels and controls already make the workflow clear. Native project creation should open as a form, not as an explanation of native versus agent-guided paths.
- Native project modal path previews should show a short note label while keeping the full project path in title or data metadata.
- Runner consent should explain agent access in calm plain language while staying accurate: say that Codex writes are sandbox-limited to this vault, that Claude follows the user's Claude Code permission settings, and that the agent can read other files on this computer and may search the web. Avoid raw implementation terms such as `workspace-write` in the consent modal, but never trade accuracy for calmness.

### Start My Day Preview

- Preview should be inspectable without being noisy.
- The default Start my day view should show target, expected note, backend, and run controls first.
- Preview should keep full vault paths in title or data metadata rather than visible default copy.
- Compact Start my day Preview should keep full expected note paths in title or data metadata while showing a short expected-note label.
- Preview helper descriptions should live in title or aria metadata instead of visible intro paragraphs.
- Preview and project modals should stay within the Obsidian viewport and scroll internally.
- Modal paths and metadata chips should wrap instead of widening the modal.
- Preview advanced detail grids should not use fixed minimum columns that can widen narrow modals.
- Full prompt, likely reads/writes, and pre-flight detail may be collapsed behind an advanced section.
- Manual items must stay separate from run metadata so the agent does not treat local date/time as tasks.

### Setup Health

Setup health should answer:

- Can I run the selected backend?
- What blocks the selected backend?
- Which optional integrations are unavailable without making them look scary?

Healthy and optional detail may live in titles/tooltips or collapsed content. Visible detail should focus on missing or warning primary setup items.

Selected-backend readiness should be primary. Alternate backend checks and optional integrations belong under advanced setup details unless the user switches backend or explicitly enables those modules.

Setup health group descriptions should live in title or aria metadata when the status labels and tiles are already clear. Expanded setup should show actionable missing/warning detail, not a second layer of explanatory paragraphs.

Setup and onboarding status chips should visually distinguish ready, needed, locked, and optional states without making optional integrations look like blockers.

### Install Flow

- Release zip users do not need npm commands.
- Do not use GitHub's source code zip as the normal user install artifact.
- The release zip should contain `operator-control/` with `manifest.json`, `main.js`, and `styles.css`.
- Keep `npm run install:plugin -- "<vault>"` framed as a developer path only.
- Agent skills remain separate from the Obsidian dashboard install.

## Do Not Regress

- Do not make optional integrations block daily workflows.
- Do not move optional modules onto the first screen.
- Do not expose internal scheduling phrases such as "boundary cascade" in primary UI copy.
- Do not add new `SKILL.md` frontmatter fields; skill frontmatter stays `name` and `description`.
- Do not delete historical skills without an explicit migration decision.
- Do not store personal vault content, local screenshots, or scratch review notes in tracked docs.

## Related Docs

- `docs/operator-home-manual.md` is the user-facing manual.
- `docs/ux-review-checklist.md` is the repeatable UX review rubric.
- `docs/ux-product-review-2026-06-01.md` is the current static UX, UI, product, and feature review.
- `docs/2026-05-29-productization-goal-brief.md` is historical context for the v0.4 productization push.
