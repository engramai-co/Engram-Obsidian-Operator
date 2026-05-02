---
name: daily-github
description: "TRIGGER for /daily-github, or when the user asks for GitHub trending repos, top open-source projects, or 'what's hot/popular this week'. Optionally filtered by language (python, rust, ts) and time window (daily, weekly, monthly)."
---

Fetch today's trending GitHub repos and produce a knowledge note with contextual introductions, plus a short summary in the daily note.

## Arguments

This command accepts optional positional arguments: `language`, `since`, and `count`.

- **language** — filter by programming language (e.g. `python`, `rust`, `typescript`). Default: all.
- **since** — time window: `daily` (default), `weekly`, `monthly`.
- **count** — number of repos to include: default `10`, max `25`.

Examples:
- `/daily-github` — top 10 trending repos today, all languages
- `/daily-github python` — top 10 trending Python repos today
- `/daily-github rust weekly 15` — top 15 trending Rust repos this week

Parse positional args by type: if an arg matches a known time window (`daily`/`weekly`/`monthly`) it's `since`; if it's a number it's `count`; otherwise it's `language`.

## Step 1 — Fetch trending data

WebFetch `https://github.com/trending` and extract repo information.

- If a **language** filter is set, fetch `https://github.com/trending/{language}` instead.
- If **since** is set, append `?since={since}` to the URL.
- Extract per repo: **owner/name**, **description**, **language**, **stars gained** (in the time window), **total stars**, **forks**, **repo URL**.

**Fallback:** if WebFetch fails or returns unusable data, use WebSearch for `"GitHub trending repositories today {language}"` and extract what you can.

Limit results to the requested **count**.

## Step 2 — Gather context

For each repo, determine **why it's trending**:

- If the description already makes the project's purpose and trending reason clear, skip extra searches.
- Otherwise, run 1–2 WebSearch queries (e.g. `"{owner/repo}" announcement OR release OR "hacker news"`) to find the catalyst: new release, viral post, notable endorsement, conference demo, etc.

Keep this efficient — don't search for every repo. Prioritize repos where the description is vague or generic.

## Step 3 — Write full report

**Path:** `04_Knowledge/GitHub/YYYY-MM-DD - GitHub Trending.md`
- With language filter: `04_Knowledge/GitHub/YYYY-MM-DD - GitHub Trending (Python).md` (capitalize language name)

Create the `04_Knowledge/GitHub/` directory if it doesn't exist.

**Frontmatter:**
```yaml
---
type: knowledge
kind: github-trending
date: YYYY-MM-DD
since: daily
language: all
tags:
  - github
  - trending
  - open-source
---
```
Set `since` and `language` to actual values used.

**Title + TL;DR (write these FIRST, before the per-repo entries):**

```markdown
# GitHub Trending · YYYY-MM-DD

**TL;DR** — One or two sentences synthesizing today's signal: dominant category (AI agents / dev-tools / infra / etc.) + the headline launch or release with the star delta + any cross-trend connection (e.g. "third major-lab coding-agent entry this month"). Reads at-a-glance without needing to recognize repo names. The same string is copied verbatim into the daily-note section in Step 4.
```

**Body — per repo entry (4–6 lines each):**

```markdown
### [owner/repo](https://github.com/owner/repo)
**What it is** — plain-language one-liner explaining the project.
**Why it's trending** — contextual explanation of the catalyst.
**Tech** — language, key frameworks/libraries.
**Stars** — total ⭐ + gained in window · forks count
**Relevance** — connection to AI, startups, research, or dev-tools if any; otherwise "General interest".
```

**Final section:**
```markdown
## Patterns & Themes
```
Write 3–5 bullets synthesizing what this trending list reveals: dominant themes, emerging spaces, relevance to active vault projects (discover by reading `02_Projects/` folders with `status: active`).

## Step 4 — Append summary to daily note

Edit today's daily note at `01_Execution/YYYY-WXX/YYYY-MM-DD.md` directly (compute the path from the current ISO week and date). Do NOT use `obsidian daily:append` — it resolves to the wrong path when daily notes live in week subfolders.

If using the Edit fallback, append under `## Notes` (find the heading and append after its content). If `## Notes` doesn't exist, append at the end of the file.

```markdown
### GitHub Trending
**TL;DR** — [same TL;DR copied verbatim from the full report's top]
Top repos today: **repo1** (one-liner), **repo2** (one-liner), **repo3** (one-liner).
→ Full report: [[YYYY-MM-DD - GitHub Trending]]
```

The TL;DR line is identical to the one at the top of the full report — copy it verbatim, do not rephrase. Pick the 3 most notable repos for the `Top repos today:` line. Use the actual note title in the wiki-link (including language suffix if filtered).

## Step 5 — Confirm

Print:
- The save path of the full report
- 2–3 sentence highlight of the most notable items or patterns