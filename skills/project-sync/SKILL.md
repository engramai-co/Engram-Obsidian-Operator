---
name: project-sync
description: "TRIGGER for /project-sync, or when the user wants to sync, refresh, rebuild, or consolidate an existing project's overview note from scattered knowledge notes, meetings, and decisions. NOT for creating new projects (use /project-init) or daily briefings."
---

Sync all knowledge notes and weekly reviews for a project back into its main project note.

## Arguments

This command accepts a single argument: the project name (e.g. `MyProject`). The name must match a subfolder in `04_Knowledge/`.

Example: `/project-sync MyProject`

If no argument is provided, ask the user which project to sync.

## Step 1 — Validate

1. Check that `04_Knowledge/$project/` exists (glob for it). If not, **create it** along with a standard subfolder (`Meeting Knowledge/`), and inform the user: "Created knowledge folder at `04_Knowledge/$project/`."
2. Find the main project note at `02_Projects/$project/$project.md`. If it doesn't exist, stop and tell the user: "No project note found at `02_Projects/$project/$project.md`. Run `/project-init $project` first."

## Step 2 — Gather knowledge notes

Read **all** `.md` files recursively under `04_Knowledge/$project/` (including subfolders like `Meeting Knowledge/`, `Research/`, etc.).

For each note, extract:
- **Title** — from the first `# heading`, or the filename (without `.md`) if no heading
- **Wiki-link name** — the filename without `.md` (this is what goes inside `[[...]]`)
- **`kind:`** from frontmatter (e.g. `meeting`, `brainstorm`, `concept`, `course`, `deep-research`)
- **`date:`** from frontmatter
- **Summary** — a 1–2 sentence summary derived from the first meaningful paragraph, or content under `## What it is`, `## Question being explored`, `## Context`, `## Decision`, or similar top-level section. Keep it tight — one line max.

## Step 3 — Gather weekly reviews

Use `obsidian search:context query="$project" path="01_Execution"` to find which weekly reviews mention the project, instead of reading every file. Then Read only the matching ones. Fallback: read all files matching `01_Execution/*/Weekly Review.md`.

For each matching weekly review:
- Extract the **week identifier** from the `week:` frontmatter field (e.g. `2026-W08`)
- Extract the specific bullets and sentences that reference the project from the `### Progress`, `### Stalled`, and `### Patterns & Risks` sections
- Compress those into a **1–2 sentence summary** capturing what moved, what stalled, and any key risks — all project-specific

## Step 4 — Synthesize into project note

Read the current project note (`02_Projects/$project/$project.md`).

**Preserve everything above `## Knowledge Base`** exactly as-is (frontmatter, title, description, `## Now`, `## Risks`, any other user sections, including trailing `---` separators). Do not modify, reformat, or reorder any of it.

**Remove** any existing `## Knowledge Base` and `## Weekly Progress` sections (and everything below them) — these will be regenerated.

**Append two new sections:**

### `## Knowledge Base`

Group notes by `kind:` field, mapped to readable headings:
- `meeting` → `### Meetings`
- `brainstorm` → `### Strategy`
- `concept` → `### Research`
- `deep-research` → `### Research`
- `course` → `### Coursework`
- `github-trending` → skip entirely
- Any other or missing kind → `### Other`

Within each group, sort by `date:` descending (newest first). Each entry is a single line:

```
- [[Note Filename Without Extension]] — One-sentence summary
```

Only include group headings that have at least one entry. Order the groups: Meetings, Strategy, Research, Coursework, Other.

### `## Weekly Progress`

List weeks in reverse chronological order. Each entry:

```
- **[[Weekly Review · YYYY-WXX|WXX]]** — Project-specific summary sentence.
```

Use the wiki-link format that matches the weekly review's `# heading` (e.g. `Weekly Review · 2026-W08`) with a display alias (e.g. `W08`).

If no weekly reviews mention the project, omit this section entirely.

## Step 5 — Strategic Signals

After gathering all knowledge notes and weekly progress, generate a `## Strategic Signals` section. This surfaces how recent research (tech and business) should influence project direction.

Read all knowledge notes from Step 2 and weekly progress from Step 3. Focus on notes created or updated in the **last 4 weeks**. Cross-reference them against the project's current `## Now` and `## Risks` sections.

Produce three sub-sections:

### `### Reinforced`
Findings that **confirm or strengthen** current direction (`## Now`) or known risks (`## Risks`). One bullet per signal, citing the source note via wiki-link.

### `### Challenges`
Findings that **contradict, complicate, or weaken** current assumptions — things that should make you reconsider `## Now` or reweight `## Risks`. One bullet per signal with source.

### `### New`
Insights that are **not yet reflected** in `## Now` or `## Risks` at all — blind spots, emerging opportunities, or newly discovered risks. One bullet per signal with source.

Rules:
- Keep each bullet to one sentence. Be specific — name the assumption or risk being affected.
- If there are no signals in a sub-section, omit it.
- If there are no recent knowledge notes (last 4 weeks), omit `## Strategic Signals` entirely.
- This section is **regenerated on every sync** (not cumulative). The user promotes signals into `## Now` / `## Risks` manually.

## Step 6 — Write the updated project note

Write the merged content to `02_Projects/$project/$project.md`. The file should be:
1. Everything preserved from the original (above `## Knowledge Base`)
2. `## Knowledge Base` with grouped, linked entries
3. `## Weekly Progress` with reverse-chronological summaries (if any)
4. `## Strategic Signals` with Reinforced / Challenges / New (if any recent notes)

No trailing blank lines beyond one.

## Step 7 — Open the file

Run `obsidian open path="02_Projects/$project/$project.md"` to open the file in Obsidian.

## Idempotency

This command is safe to re-run. Each run fully regenerates `## Knowledge Base`, `## Weekly Progress`, and `## Strategic Signals` from scratch. Everything above those sections is never touched. This is a pure synthesis command — it does not modify Weekly Todo, Blockers, or any execution-layer files.

## Language

Write summaries in English. Match the source material language only for direct quotes.
