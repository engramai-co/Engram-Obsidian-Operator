# Operator UX, UI, Product, And Feature Review - 2026-06-01

Initial static review on 2026-06-01, with a cleanup pass and product design audit addendum on 2026-06-07. It reviews the Obsidian dashboard implementation, CSS, product docs, and development memory against `docs/ux-review-checklist.md` at those dates; rendered Obsidian smoke testing is tracked separately as an open evidence gap.

## Executive Summary

Operator Home is directionally strongest when it is framed as an Obsidian-native daily home plus AI concierge. The current product has the right primitives: Today, Quick Capture, Current Work, native project creation, Preview-first agent runs, optional modules, and CLI escape hatches. The main UX risk is density. The main product risk is positioning the tool as a broad "personal operating system" instead of a calm daily home that can grow into advanced workflows.

No P0 blocker was found in static review. As of the 2026-06-07 cleanup, the first UI pass has grouped More workflows, reframed Setup health around the selected backend, moved Setup health helper descriptions into metadata, added narrow-pane CSS protections, tightened README positioning, exposed Preview editing more clearly, made Current Work project rows easier to scan, simplified first-run onboarding and removed duplicate setup-helper copy, kept Last Run prompt/debug details collapsed by default, shortened first-screen empty states, moved workflow and modal helper descriptions out of visible copy, removed section-card nesting from Optional modules, kept full note paths out of the visible dashboard header, compacted default path metadata in Preview, project creation, and Last Run, removed Markdown section-name copy from visible project row empty states, gave setup/onboarding status chips distinct subdued states, split the manual workflow guidance by product tier, and reduced first-run Get started controls to a single actionable next-step button when one is available. A 2026-06-07 static Playwright harness smoke then found and fixed two narrow-pane flex-basis issues that created excessive vertical blank space in the hero and form rows. The highest-value remaining work is rendered Obsidian smoke testing.

## P0 Findings

No P0 finding from static review.

### Outstanding Evidence Gap - Rendered Obsidian Smoke

This review did not run a rendered Obsidian smoke test or inspect screenshots in a real vault. Before release, verify the dashboard in at least a narrow Obsidian pane and a normal-width pane.

## Resolved P1 Findings From Static Review

### Resolved P1 - More workflows is grouped by tier

Status: addressed in the 2026-06-07 cleanup by grouping More workflows into Plan, Projects & meetings, Strategy, Optional modules, and Power user sections.

Current evidence: `src/main.ts` renders More workflows through grouped `createWorkflowGroup` and `createWorkflowDisclosureGroup` calls for Plan, Projects & meetings, Strategy, Optional modules, and Power user. Optional modules and power-user controls stay visually subordinate instead of becoming first-screen sections.

Residual risk: grouping is source-verified, but still needs rendered smoke testing in narrow and normal Obsidian panes.

Do not regress:

- Plan: weekly setup, weekly review
- Projects & meetings: project sync, deadline plan, meeting prep/process
- Strategy: annual, quarterly, monthly pulse
- Power user: raw agent prompt, CLI handoff, legacy slash commands
- Optional modules: intelligence, content, calendar/events, deep research

### Resolved P1 - Setup health is selected-backend first

Status: addressed in the 2026-06-07 cleanup by rendering selected-backend readiness first and moving alternate backend plus optional integrations into advanced checks.

Current evidence: `src/main.ts` renders selected-backend readiness first, puts alternate backend and optional integrations under "Optional and alternate checks", and only shows actionable detail for missing or warning primary checks.

Residual risk: expanded Setup health still needs rendered smoke testing to confirm optional checks do not look required or scary.

Do not regress: selected-backend blockers should remain visually primary, and optional integrations should never block Start my day by default.

### Resolved P1 - Product positioning leads with daily home

Status: addressed in the 2026-06-07 cleanup by changing README's lead positioning to "Obsidian-native daily home and AI concierge."

Current evidence: `README.md` leads with "Obsidian-native daily home and AI concierge." `docs/development-memory.md` keeps the product promise centered on install, initialize, capture/create/update Markdown, Start my day, and advanced workflows that stay reachable without defining the first screen.

Do not regress: keep "personal operating system" as secondary language after the first-run promise is clear.

## P2 Findings

### P2 - Narrow-pane responsive protection is mostly implicit

Status: source-level CSS protections were added in the 2026-06-07 cleanup. A static Playwright harness smoke found and fixed narrow-pane flex-basis issues in `.operator-hero-copy` and `.operator-grow`. Rendered Obsidian smoke testing is still needed.

Current evidence: `styles.css` now uses container-capped grid tracks, wrapping hero/action rows, wrapping buttons, form control shrink rules, status title wrapping, modal path wrapping, and prompt/log wrapping protections.

Residual risk: Obsidian panes are often narrow, and source CSS is not enough evidence for final visual quality.

Next evidence needed:

- narrow-pane screenshot with long paths, project names, and button rows
- normal-width screenshot with setup expanded
- confirmation that no text overlaps preceding or following content

### P2 - Start my day Preview is calmer, but editability is now easy to miss

Status: addressed in the 2026-06-07 cleanup by adding a visible Edit prompt action that opens the collapsed run details and moving Preview helper copy into title/aria metadata.

Current evidence: `src/main.ts` makes Start my day compact, keeps target notes visible, puts prompt/read/write/run detail in a collapsed details block, and exposes an Edit prompt action that opens and focuses the prompt.

Residual risk: rendered smoke testing still needs to confirm the Edit prompt affordance is placed clearly.

Do not regress: keep details collapsed by default, but keep editing discoverable.

### P2 - Current Work project rows compress multiple actions into one line

Status: addressed in the 2026-06-07 cleanup by showing at most two `## Now` items as a short list, plus a deliberate empty state or more-actions hint.

Current evidence: `src/main.ts` renders at most two next actions as a short list, uses compact `+N more actions` hints for overflow, and keeps `## Now` as metadata/doc context instead of visible empty-state copy.

Residual risk: rendered smoke testing still needs to check long project names and long action text in narrow panes.

### Resolved P2 - Manual workflow guidance is split by product tier

Status: addressed in the 2026-06-07 cleanup by splitting workflow guidance into Core Workflows, Optional Modules, Power User Workflows, Preview Behavior, Advanced target resolution, and Troubleshooting.

Current evidence: `docs/operator-home-manual.md` no longer uses one broad Agent Workflows section for core, optional, power-user, and Preview behavior. The manual now mirrors the product tiering used in Operator Home.

Do not regress: keep core agent workflows, optional modules, power-user controls, Preview behavior, advanced target resolution, and troubleshooting as separate reading chunks.

## UI Surface Audit Matrix

### First Screen

Current state: The default dashboard now leads with Today, Quick Capture, Current Work, collapsed More workflows, collapsed Setup health, and Last Run only when useful. The header shows date/time/week/quarter without a full note path, empty states are short and avoid repeating implementation-source copy, disabled native open buttons explain missing Markdown files, project row empty states use next-action language instead of Markdown headings, and Last Run shows the summary first while keeping expected note paths in metadata and the full prompt plus raw log collapsed.

Risk: The first screen is mostly calm, but secondary copy and long Markdown-derived content can still create density in narrow Obsidian panes.

Next evidence needed: Inspect normal-width and narrow-width Obsidian panes with at least one active project, one waiting-on item, one meeting, and a missing selected backend.

### Onboarding And Setup

Current state: First-run onboarding now shows one current next step before the detailed setup checklist, prioritizes native vault initialization before agent skill setup, and avoids a second setup-helper paragraph or duplicated setup control row. The next-step card shows a single actionable next-step button when the current step can be acted on directly. Setup health is collapsed in normal dashboard use, shows selected-backend readiness first when expanded, exposes actionable buttons, keeps group-level helper descriptions in metadata instead of visible paragraph copy, and gives needed/locked/limited/optional chips distinct subdued states.

Risk: Optional and alternate checks are now advanced, but rendered smoke testing still needs to confirm the advanced disclosure does not look required or scary.

Next evidence needed: Verify the expanded Setup health view for both Codex-selected and Claude-selected settings.

### Preview Modal

Current state: Start my day Preview has a compact default view. Full prompt, likely reads/writes, and run details stay inspectable in a collapsed advanced section, with a visible Edit prompt action to open that section.

Risk: The source-level affordance is present, but it still needs rendered smoke testing for placement and scanability.

Next evidence needed: Confirm that copy prompt, edited prompt, and run prompt all stay in sync after opening the advanced section.

### Workflow Surface

Current state: Core, advanced, power-user, and optional workflows all remain reachable. More workflows is grouped into Plan, Projects & meetings, Strategy, Optional modules, and Power user sections. Optional modules remain nested with workflow-group styling instead of a full nested section card. Helper descriptions are retained as metadata rather than visible paragraph copy.

Risk: The grouping is source-verified but still needs rendered smoke testing in narrow and normal Obsidian panes.

Next evidence needed: After grouping, confirm every existing workflow remains reachable and disabled-state help still names the selected-backend blocker.

### Visual System

Current state: The UI uses Obsidian theme variables, restrained borders, 8px radii, native button affordances, compact cards, wrapping grids, and a narrow-pane action layout.

Risk: CSS source now protects narrow panes, but screenshots are still needed to verify no text overlaps in real Obsidian.

Next evidence needed: Check for overflow, cramped button rows, and overlapping text in a narrow pane before release.

## Product Positioning Review

Recommended positioning:

> Operator Home is an Obsidian-native daily home and AI concierge. It keeps Markdown as the workspace, handles fixed structure with native Obsidian actions, and uses Codex or Claude for previewed reasoning workflows.

Keep:

- Markdown-first
- Native Obsidian actions
- Preview-first agent runs
- Codex/Claude backend choice
- CLI power path

De-emphasize in first impression:

- AI/news/research monitoring
- content engine
- deep research
- calendar/event ingestion
- "personal operating system" as the first phrase

## Feature Review

### Keep Core

- Today dashboard
- Start my day
- Quick Capture
- Current Work
- Native project creation
- Native task Done/Carry
- Last Run
- Backend readiness gate

These features reinforce the product promise and should receive polish before adding more workflows.
Native project creation should open as a form; native-versus-agent path helper text belongs in metadata or docs, not visible modal copy.

### Keep But Reframe As Advanced

- Strategy review workflows
- Deadline plan
- Raw agent prompt
- Copy CLI handoff
- Legacy `/project-init`
- Link enrichment

These are useful, but should live in grouped advanced/power-user areas rather than define onboarding.

### Keep Optional

- AI weekly
- GitHub trends
- Academic scan
- Content extract/draft
- Calendar/events
- Deep research

These should stay reachable, but off by default for daily orchestration and visually subordinate to core workflows.

### Consider Later

- A workflow catalog abstraction in TypeScript, separate from skill frontmatter, to centralize labels, tiers, grouping, icons, and visibility.
- A first-run guided setup flow that separates "initialize vault" from "connect an agent backend."
- A real rendered smoke harness or screenshot checklist for Obsidian pane widths.

## Recommended Development Sequence

1. Run rendered Obsidian smoke in narrow and normal-width panes using a clean vault plus a populated vault fixture.
2. Fix any visual overlap, cramped controls, or scary setup language found in that smoke pass.
3. Run rendered Obsidian smoke testing before treating source-level UX cleanup as release-ready.
4. Consider a workflow catalog abstraction only after the grouped UI is visually validated.
5. Prepare release notes from verified behavior, not from source-only assumptions.

## Implementation Backlog

### Backlog 1 - Group More workflows

Status: implemented in the 2026-06-07 cleanup.

Files: `src/main.ts`, `styles.css`, `tests/operator-home.test.ts`.

Scope: Keep the top-level More workflows disclosure, then render grouped subsections for Plan, Projects & meetings, Strategy, Power user, and Optional modules. Preserve all existing workflow buttons and prompt resolution behavior.

Acceptance:

- Optional modules remain nested and visually subordinate.
- Raw agent prompt and CLI handoff are labeled as power-user controls.
- Existing workflow tests still prove optional modules are not first-screen defaults.

### Backlog 2 - Reframe Setup health around selected backend

Status: implemented in the 2026-06-07 cleanup.

Files: `src/main.ts`, `src/status.ts` if needed, `styles.css`, `tests/operator-home.test.ts`.

Scope: Show selected-backend readiness first, vault readiness second, and optional/alternate backend details only in an advanced subsection or settings-oriented area.

Acceptance:

- Missing selected-backend checks are visible and actionable.
- Healthy and optional details do not produce a wall of visible text.
- Optional integrations cannot be mistaken for required setup.

### Backlog 3 - Add narrow-pane protections

Status: source-level implementation complete in the 2026-06-07 cleanup; visual smoke remains.

Files: `styles.css`, with source tests only if CSS source assertions are useful.

Scope: Add explicit wrapping and responsive rules for grids, hero/action rows, project rows, prompt chips, paths, and logs.

Acceptance:

- Long paths and project names wrap inside their containers.
- Start my day controls remain readable in a narrow pane.
- No text overlaps preceding or following content.

### Backlog 4 - Tighten public positioning

Status: implemented in the 2026-06-07 cleanup.

Files: `README.md`, `docs/operator-home-manual.md`, release notes when preparing the next release.

Scope: Lead with "Obsidian-native daily home and AI concierge." Keep "personal operating system" as secondary language after the first-run promise is clear.

Acceptance:

- The first product paragraph emphasizes Today, capture, native Markdown, previewed agent runs, and optional advanced workflows.
- Optional intelligence/content/research modules are presented as add-ons, not the core product.

### Backlog 5 - Decide whether a workflow catalog abstraction is worth it

Files: likely `src/main.ts` plus a small local data structure or helper module.

Scope: Only refactor after grouped UI has been validated. The goal would be to centralize workflow labels, tiers, icons, visibility, and prompt builders without changing behavior.

Acceptance:

- The abstraction reduces duplicated workflow metadata.
- It does not make skill frontmatter more complex.
- It does not hide Obsidian-native actions behind agent terminology.

## Acceptance Checks For The Next UI Pass

- First screen still shows Today, Quick Capture, Current Work, collapsed More workflows, collapsed Setup health, and Last Run only when present.
- Expanding More workflows shows clear groups, not one undifferentiated grid.
- Setup health expanded view makes selected-backend blockers obvious and optional integrations non-scary.
- Start my day Preview remains compact but visibly editable.
- Narrow pane text does not overflow or create unreadable button rows.
- All existing workflows remain reachable.

## 2026-06-07 Product Design Audit Addendum

- P0: none found in the current first-run, dashboard, and compact Preview smoke pass.
- Resolved P1 - Operator modal roots share the dashboard status and border variables. Status: addressed in the 2026-06-07 modal styling fix; `styles.css` now includes `.operator-preview-modal`, `.operator-project-modal`, and `.operator-consent-modal` in the shared variable block, so Preview, Create project, and consent modals keep internal panel and chip styling.
- P2: Expanded More workflows is still visually dense, but it remains behind a collapsed disclosure; defer larger workflow-card polish until the core first screen is stable.
