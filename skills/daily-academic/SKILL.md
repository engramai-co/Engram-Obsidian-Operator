---
name: daily-academic
description: "Invoke IMMEDIATELY for /daily-academic, or whenever the user mentions arXiv, new papers, preprints, research papers today, academic scanning, paper roundup, or asks what's new in AI/robotics/ML/NLP/CV research. This is the ONLY skill that fetches and ranks today's arXiv papers — do not attempt to manually search arXiv or summarize papers without it. Triggers on: 'check arxiv', 'new papers today', 'daily arxiv check', 'morning research scan', 'paper roundup', 'what dropped on arxiv', 'academic paper thing', 'scan papers', any mention of cs.AI/cs.RO/cs.CL/cs.LG/cs.CV categories, or any request to pull/fetch/scan today's research. Produces a knowledge note in 04_Knowledge/Academic/ with project-relevant annotations and appends summary to the daily note. NOT for: summarizing a specific paper the user already has, literature reviews, writing papers, or the weekly AI digest."
version: 1.0.0
author: Yuhan Wang
license: MIT
tags: [obsidian, arxiv, academic, research, knowledge, ai]
---

Fetch today's notable arXiv papers across AI and robotics categories, produce a knowledge note with project-relevant annotations, plus a short summary in the daily note.

## Arguments

This command accepts optional positional arguments: `category` and `count`.

- **category** — arXiv category code (e.g. `cs.RO`, `cs.CL`, `cs.LG`). Default: multi-category scan (cs.AI, cs.RO, cs.CL, cs.LG, cs.CV).
- **count** — number of papers to include: default `8`, max `15`.

Examples:
- `/daily-academic` — top 8 papers today across all default categories
- `/daily-academic cs.RO` — top 8 robotics papers today
- `/daily-academic cs.CL 5` — top 5 NLP papers today

Parse positional args by type: if an arg matches the arXiv category pattern (`XX.YY`, e.g. `cs.AI`) it's `category`; if it's a number it's `count`.

## Step 1 — Gather active project context

Read project files in `02_Projects/` with `status: active`.

- Extract research-relevant keywords from each project: technology mentions, research areas, domain terms, open questions.
- These keywords are used in Steps 3 and 4 to prioritize papers and annotate relevance.
- Keep this lightweight — read frontmatter and the first few sections (## Focus, ## Context, ## Open Questions) of each project note. Don't deep-read every file.

## Step 2 — Fetch arXiv papers

If a specific **category** argument is provided, fetch only that category. Otherwise, fetch all 5 default categories **in parallel** using WebFetch:

| # | URL | Area |
|---|-----|------|
| 1 | `https://arxiv.org/list/cs.AI/new` | Artificial Intelligence |
| 2 | `https://arxiv.org/list/cs.RO/new` | Robotics |
| 3 | `https://arxiv.org/list/cs.CL/new` | Computation & Language (NLP/LLMs) |
| 4 | `https://arxiv.org/list/cs.LG/new` | Machine Learning |
| 5 | `https://arxiv.org/list/cs.CV/new` | Computer Vision |

Extract per paper: **title**, **authors**, **abstract** (first 2–3 sentences), **arXiv ID**, **primary category**, **paper URL** (`https://arxiv.org/abs/{id}`).

**Fallback chain:**
1. If `/list/{cat}/new` pages fail or return unusable HTML, try RSS feeds: `https://arxiv.org/rss/{cat}`.
2. If RSS also fails, use WebSearch for `"arXiv new papers today {category} site:arxiv.org"`.

If a feed fails, log a warning and continue with the rest. Deduplicate papers that appear in multiple categories (keep the primary category listing).

## Step 3 — Filter and rank

From the collected papers (potentially hundreds across 5 categories), select the top **count** papers using these criteria in priority order:

1. **Project relevance** — papers whose title or abstract matches active project keywords (from Step 1) score highest. Even partial keyword overlap counts.
2. **Community buzz** — run 2–3 batch WebSearch queries to check for discussion of notable papers (e.g. `"paper title" site:twitter.com OR site:reddit.com OR "hacker news"`). Only search for papers whose titles look significant — skip routine submissions.
3. **Novelty signals** — papers from prominent labs (DeepMind, OpenAI, Meta FAIR, Anthropic, Google Research, etc.), papers claiming state-of-the-art results or new benchmarks, papers with unusually detailed abstracts suggesting substantial contributions.

Keep this efficient — do NOT WebSearch every paper. Use title/abstract heuristics to identify the top ~15 candidates, then WebSearch the most promising 5–8 to finalize the selection.

## Step 4 — Write full report

**Path:** `04_Knowledge/Academic/YYYY-MM-DD - arXiv Daily.md`
- With category filter: `04_Knowledge/Academic/YYYY-MM-DD - arXiv Daily (cs.RO).md` (use the category code as-is)

Create the `04_Knowledge/Academic/` directory if it doesn't exist.

**Frontmatter:**
```yaml
---
type: knowledge
kind: arxiv-daily
date: YYYY-MM-DD
categories: [cs.AI, cs.RO, cs.CL, cs.LG, cs.CV]
tags:
  - arxiv
  - academic
  - research
  - ai
---
```
Set `categories` to the actual categories scanned (single-item list if filtered, full list if default).

**Title:**
```markdown
# arXiv Daily — YYYY-MM-DD
```

**Body — per paper entry (5–7 lines each):**

```markdown
### [Paper Title](https://arxiv.org/abs/XXXX.XXXXX)
**Authors** — First three authors + et al. if more than three.
**Category** — cs.XX (Full Category Name)
**TL;DR** — One-sentence plain-language summary of the paper's contribution.
**Why it matters** — Significance: what problem it solves, how it advances the field.
**Method** — Key technical approach in one sentence.
**Relevance** — Connection to active vault projects (e.g. "Relevant to [[ProjectName]] — addresses X"), or "General AI/robotics interest" if no direct link.
```

**Final section:**
```markdown
## Research Themes & Connections
```
Write 3–5 bullets synthesizing what today's paper selection reveals: dominant research themes, emerging directions, connections to active vault projects (discovered in Step 1).

## Step 5 — Append summary to daily note

Edit today's daily note at `01_Execution/YYYY-WXX/YYYY-MM-DD.md` directly (compute the path from the current ISO week and date). Do NOT use `obsidian daily:append` — it resolves to the wrong path when daily notes live in week subfolders.

If using the Edit fallback, append under `## Notes` (find the heading and append after its content). If `## Notes` doesn't exist, append at the end of the file.

```markdown
### arXiv Daily
Top papers today: **Paper1 Title** (one-liner), **Paper2 Title** (one-liner), **Paper3 Title** (one-liner).
→ Full report: [[YYYY-MM-DD - arXiv Daily]]
```

Pick the 3 most notable papers for the summary. Use the actual note title in the wiki-link (including category suffix if filtered).

## Step 6 — Confirm

Print:
- The save path of the full report
- 2–3 sentence highlight of the most notable papers or research themes
