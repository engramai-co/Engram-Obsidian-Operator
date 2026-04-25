---
name: daily-academic
description: "Invoke IMMEDIATELY for /daily-academic, or whenever the user mentions arXiv, new papers, preprints, research papers today, academic scanning, paper roundup, or asks what's new in AI/robotics/ML/NLP/CV research. This is the ONLY skill that fetches and ranks today's arXiv papers — do not attempt to manually search arXiv or summarize papers without it. Triggers on: 'check arxiv', 'new papers today', 'daily arxiv check', 'morning research scan', 'paper roundup', 'what dropped on arxiv', 'academic paper thing', 'scan papers', any mention of cs.AI/cs.RO/cs.CL/cs.LG/cs.CV categories, or any request to pull/fetch/scan today's research. Produces a knowledge note in 04_Knowledge/Academic/ with project-relevant annotations and appends summary to the daily note. Quality is gated hard: only papers from established labs/universities OR already accepted at top venues are included. NOT for: summarizing a specific paper the user already has, literature reviews, writing papers, or the weekly AI digest."
version: 1.3.0
author: Yuhan Wang
license: MIT
tags: [obsidian, arxiv, academic, research, knowledge, ai]
---

Fetch today's notable arXiv papers across AI and robotics categories, produce a knowledge note with project-relevant annotations, plus a short summary in the daily note.

## Arguments

This command accepts optional positional arguments: `category` and `count`.

- **category** — arXiv category code (e.g. `cs.RO`, `cs.CL`, `cs.LG`). Default: multi-category scan (cs.AI, cs.RO, cs.CL, cs.LG, cs.CV).
- **count** — target number of papers to include: default `3`, max `5`. **It is correct (and expected) to return fewer than `count` if not enough papers clear the quality gate in Step 3 — do not pad.**

Examples:
- `/daily-academic` — top 3 papers today across all default categories
- `/daily-academic cs.RO` — top 3 robotics papers today
- `/daily-academic cs.CL 5` — up to 5 NLP papers today (still gated by quality)

Parse positional args by type: if an arg matches the arXiv category pattern (`XX.YY`, e.g. `cs.AI`) it's `category`; if it's a number it's `count` (clamp to max 5).

## Step 1 — Gather active project context

Read project files in `02_Projects/` with `status: active`.

- Extract research-relevant keywords from each project: technology mentions, research areas, domain terms, open questions.
- These keywords are used in Steps 3 and 5 to prioritize papers and annotate relevance.
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

## Step 3 — Quality gate FIRST, then rank

**Quality is a hard gate, not a soft signal.** A paper that is highly relevant to active projects but comes from an unaffiliated author with no experimental support **must be cut**. Topical fit does not rescue weak work. The user has explicitly rejected outputs that prioritized relevance over rigor.

### 3a. Hard quality gate — paper must pass at least ONE

For each candidate, verify by reading the abstract page (and the PDF's first page if needed for affiliations):

1. **Recognizable institutional affiliation (inclusive — judgment, not a whitelist).** At least one *substantive* author (first/last/corresponding, not a token co-author) is at a real research institution with a public research footprint. The bar is "is this a real research group with a track record?" not "is it on a top-N list." Respect researchers — most named universities and corporate labs pass.
   - **Pass:** any well-known industrial AI lab (DeepMind, FAIR, OpenAI, Anthropic, Microsoft Research, NVIDIA Research, Allen AI, IBM Research, Salesforce, Adobe, Amazon Science, Apple ML, ByteDance, Tencent AI Lab, Baidu Research, Huawei Noah's Ark, Samsung AI, etc.). Any major research university — including the obvious top-tier (MIT/Stanford/CMU/Berkeley/Tsinghua/Peking) **and** strong second-tier institutions doing real work (e.g. Zhejiang University, UESTC, USTC, Fudan, SJTU, HUST, Northeastern China, Beihang; UCSD, UMD, OSU, Penn State, Rutgers; KAIST, POSTECH, Tokyo Tech; TU Delft, Aalto, KTH, Manchester, Edinburgh; etc.). Equivalent rigor at any university with an active CS/ML/robotics group passes.
   - **Cut:** unverifiable affiliations, "independent researcher," vanity-press / unknown-startup entries with no public research output, or all authors at institutions with no Google Scholar / dblp footprint in the relevant area. If a quick search turns up no prior published work for the lab in this area, that's a signal to drop. A single courtesy co-author from a top lab does NOT rescue an otherwise-unaffiliated paper.
   - When in doubt, lean toward inclusion — the conference-acceptance gate (item 2) and the empirical-rigor preference (3b) catch most weak papers anyway.
2. **Accepted at a top venue (strict — be picky here).** Abstract, comments field, or paper header explicitly states acceptance at a recognized top venue, current or prior year. Strict whitelist:
   - **ML / general:** NeurIPS, ICML, ICLR, AAAI, IJCAI, COLM
   - **NLP:** ACL, EMNLP, NAACL, TACL
   - **CV:** CVPR, ICCV, ECCV
   - **Robotics:** ICRA, IROS, RSS, CoRL
   - **Other:** SIGGRAPH (and SIGGRAPH Asia), KDD, WWW, USENIX Security, IEEE S&P, CCS, OSDI, SOSP, MICRO, ISCA
   - **Top journals:** JMLR, TPAMI, IJCV, IJRR, Nature / Science (+ family)
   - **Does NOT count:** workshops, doctoral consortia, "Findings of {venue}," tutorials, demo tracks, regional/student venues — unless explicitly an archival flagship workshop. Do not stretch the list.

If neither holds, **drop the paper**. Track dropped relevant-but-cut papers separately for the report tail (Step 5).

### 3b. Empirical rigor preference

Among gate-passers, prefer papers whose abstract describes **actual experiments, benchmarks, or quantitative results** (numbers, ablations, comparisons against baselines). Pure-position pieces, "we propose X" papers without reported results, and survey/opinion submissions go to the bottom of the ranking.

### 3c. Ranking among gate-passers

Apply in order:

1. **Accepted at a top venue beats arXiv preprint.** Peer-reviewed acceptance is the strongest external quality signal available — promote accepted papers above preprints. If the field skews preprint-heavy on a given day, accepted papers should still occupy the top slots when present.
2. **Significance** — claimed SOTA on a recognized benchmark, a new widely-useful benchmark, methodological novelty backed by results, or notable scale (model size / dataset / compute).
3. **Project relevance** — match against active project keywords (from Step 1). Tertiary sort.
4. **Community buzz** — for borderline cases only, run 1–2 WebSearch queries (`"paper title" site:twitter.com OR site:reddit.com`). Skip if the gate + significance already settles the ranking. Do NOT search every paper.

### 3d. Output count

Select up to **count** papers (default 3, max 5). **Returning 1, 2, or 0 papers is correct if that's all that clears the gate** — it is much better to deliver 2 strong papers than 5 with filler. Never include a paper just to hit the count.

Keep this efficient — use abstract + author-affiliation heuristics on the full list to identify the ~10 strongest candidates, then verify affiliations / venue acceptance carefully on those before final selection.

## Step 4 — Deep-read each selected paper (REQUIRED — do not skip)

Once Step 3 has narrowed to the final 1–5 papers, **fetch and actually read each paper** before writing the report. Abstract-only summaries are not acceptable — the user has explicitly called this out as a quality problem. The goal is a real understanding of what the paper does, not paraphrased boilerplate.

### 4a. Fetch the paper body

For each selected paper, try in order until one returns usable content:

1. `https://arxiv.org/html/{id}` — arXiv's native HTML rendering (fastest, cleanest for WebFetch)
2. `https://ar5iv.labs.arxiv.org/html/{id}` — ar5iv mirror, robust fallback
3. `https://arxiv.org/pdf/{id}` — direct PDF (WebFetch will read it as text; works but lower fidelity)
4. As a last resort: read the abstract page deeply + run a WebSearch for `"paper title" results OR experiments` to gather signal from blog posts / Twitter threads

Run these fetches **in parallel across the selected papers** (one WebFetch per paper, all in one tool batch).

### 4b. Read for these specific things

While reading each paper, extract:

- **What they actually built or measured** (from intro + method): the concrete artifact — model, dataset, algorithm, theoretical result. Not the marketing pitch.
- **Why the approach is non-obvious** (from method): the technical move that distinguishes this from prior work. Name the prior work it builds on.
- **Headline experiments** (from experiments / results section): 2–4 specific quantitative results — benchmark, metric, value, baseline comparison. Skip generic claims; extract numbers.
- **Limitations / scope** (from discussion or limitations section): what the paper says it doesn't do, or what the experiments don't cover. This is what you'll use to calibrate the relevance judgment honestly.
- **Affiliations of substantive authors** (from author block / acknowledgments): confirm the Step 3a gate against the actual paper, not just the listing page.

If a paper turns out, on close reading, to be much weaker than the abstract suggested (e.g., empirical claims aren't actually supported, "benchmark" is 50 hand-written examples, etc.) — **drop it now** and either pick the next-ranked candidate or return fewer papers. Do not paper over a weak read.

## Step 5 — Write full report

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

**TL;DR (write this FIRST, place it directly under the title):**

```markdown
**TL;DR** — One or two sentences synthesizing the day's signal: dominant theme + the strongest headline result with a number + the gate verdict (e.g. "3 of 8 candidates passed, including 1 ACL acceptance"). Reads at-a-glance without needing to recognize paper titles. The same string is copied verbatim into the daily-note section in Step 6.
```

If zero papers cleared the gate, the TL;DR is just: `**TL;DR** — No papers cleared the quality gate today (X of Y candidates considered; primary cuts: [reason]).`

**Body — per paper entry. Content must be derived from the actual paper body (Step 4), not paraphrased from the abstract. `Affiliation` and `Venue` are required — they are the visible quality signal.**

```markdown
### [Paper Title](https://arxiv.org/abs/XXXX.XXXXX)
**Authors** — First three authors + et al. if more than three.
**Affiliation** — Primary lab(s) / university, taken from the paper's author block (e.g. "Stanford NLP; Meta FAIR"). Substantive authors only.
**Venue** — "arXiv preprint" OR exact venue acceptance, e.g. "Accepted: NeurIPS 2026", "Accepted: CoRL 2025 (Oral)". Quote from the comments field.
**Category** — cs.XX (Full Category Name)

**Summary (4–6 sentences)** — A real summary derived from reading the PDF, not the abstract. Cover: (1) the concrete artifact or claim, (2) the prior work it builds on / departs from, (3) the headline result with at least one specific number, (4) the strongest qualifier or limitation. Should read like you actually understood the paper.

**Method highlights** — 2–3 sentences on the technical move that's new, sourced from the methods section. Name the architecture, training setup, or algorithmic idea precisely. If they reuse a known backbone (e.g. "fine-tune Llama-3 8B with LoRA"), say so plainly.

**Key results** — 2–4 bullets, each with a specific quantitative finding from the experiments section: benchmark + metric + value + baseline delta. Examples:
- "+3.2 BLEU on WMT'24 vs. NLLB-1.3B baseline"
- "78.4% on ARC-AGI (prior best 65.1%, GPT-5 zero-shot 71.2%)"
- "12× decoding throughput at equal accuracy on MMLU"

If the paper reports no quantitative results, write "No quantitative results reported" — this is a rigor flag, not a formatting placeholder.

**Limitations / caveats** — 1–2 sentences from the paper's own discussion / limitations section, OR your own honest read if they don't include one. This is what calibrates the relevance judgment below.

**Relevance to your projects** — Specific, named connection to active vault projects (e.g. "Direct: relates to [[Engram]] — extends activation-graph memory to multi-session conversational recall, but their setup is single-user; Engram targets cross-user shared memory"). If no direct connection, write "General AI/robotics interest — [one-sentence reason]." Do NOT use vague hedges ("could be relevant," "potentially useful") — either name a project link or call it general interest.
```

**Tail sections:**

```markdown
## Research Themes & Connections
```
Write 3–5 bullets synthesizing what today's paper selection reveals: dominant research themes, emerging directions, connections to active vault projects (discovered in Step 1).

```markdown
## Dropped (relevant but failed quality gate)
```
List any papers that matched active project keywords strongly but were cut for failing Step 3a (no established affiliation AND no venue acceptance) or Step 3b (no experiments). One line each: title + arXiv link + one-sentence reason. Skip this section entirely if nothing was dropped. This exists so the user can spot-check the gate is working — not for them to chase the cut papers.

## Step 6 — Append summary to daily note

Edit today's daily note at `01_Execution/YYYY-WXX/YYYY-MM-DD.md` directly (compute the path from the current ISO week and date). Do NOT use `obsidian daily:append` — it resolves to the wrong path when daily notes live in week subfolders.

If using the Edit fallback, append under `## Notes` (find the heading and append after its content). If `## Notes` doesn't exist, append at the end of the file.

```markdown
### arXiv Daily
**TL;DR** — [same TL;DR copied verbatim from the full report's top]
Top papers today: **Paper1 Title** (one-liner), **Paper2 Title** (one-liner), **Paper3 Title** (one-liner).
→ Full report: [[YYYY-MM-DD - arXiv Daily]]
```

The TL;DR line is identical to the one at the top of the full report — copy it verbatim, do not rephrase. List exactly the papers selected in Step 3 (1 to 5 — whatever cleared the gate). If zero papers passed, omit the `Top papers today:` line and the TL;DR alone is the section. Use the actual note title in the wiki-link (including category suffix if filtered).

## Step 7 — Confirm

Print:
- The save path of the full report
- 2–3 sentence highlight of the most notable papers or research themes
