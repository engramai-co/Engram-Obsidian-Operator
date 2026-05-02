---
name: content-draft
description: "TRIGGER for /content-draft, or when the user wants to draft a LinkedIn post, tweet thread, blog article, or newsletter; iterate on an existing draft (revise <slug>); or archive a stale one (archive <slug>). NOT for extracting content ideas (use /content-extract)."
---

Generate platform-specific content drafts from backlog items, vault notes, or free topics.

## Arguments

Five input modes — modes 1–3 run the full Steps 1–7 flow; modes 4–5 are subcommands that bypass it.

1. **No args** — `/content-draft` — presents the backlog for selection
2. **Note path** — `/content-draft 04_Knowledge/AI-Weekly/2026-W12 - AI Weekly Digest.md` — drafts from that note
3. **Free topic** — `/content-draft "Why generation is not creation"` — drafts from a topic string
4. **Revise** — `/content-draft revise 2026-04-21-engramai-launch` — generates the next version of an existing draft (see [Subcommand: revise](#subcommand-revise-slug))
5. **Archive** — `/content-draft archive 2026-04-21-engramai-launch` — moves a stale draft to `05_Content/Archived/` and flips the backlog state (see [Subcommand: archive](#subcommand-archive-slug))

## Backlog state conventions

Each line in `05_Content/Backlog.md` uses one of three checkbox states:

- `[ ]` — queued, not yet drafted (or drafted but neither published nor archived)
- `[x]` — published. Set **manually** by the user after moving `Drafts/<slug>/` → `Published/<slug>/`.
- `[-]` — archived. Set **automatically** by `/content-draft archive <slug>` (which also moves the folder).

`/content-draft` itself never sets `[x]` — publication is a deliberate human action.

## Subcommand: revise <slug>

Iterate on an existing draft. Skips Steps 1–3 and the backlog update; reuses Step 4's format generators with the existing version + user feedback as input.

1. **Resolve folder** — Match `<slug>` against subdirectories of `05_Content/Drafts/`. Accept either the bare slug (`engramai-launch`) or the full folder name (`2026-04-21 - engramai-launch`). If 0 matches, error with the available folders listed. If >1 match, ask which one.

2. **Read existing files** — Read every `.md` file in the resolved folder (e.g., `linkedin.md`, `linkedin-v2.md`, `twitter.md`). These are the inputs.

3. **Pick format(s)** — If multiple formats are present, ask which to revise (single, multi, or "all"). Default to the format with the highest existing version count.

4. **Determine next version** — For each chosen format, scan filenames matching `<format>(-v\d+)?\.md`. Treat `<format>.md` as v1. Next file is `<format>-v<N+1>.md` where `N` is the max existing version. Files like `linkedin-final.md` are user-renamed picks — ignore them for version counting.

5. **Ask for feedback** — Prompt: **"What would you like to change in the next version?"** Accept free-form input (tone shift, new angle, tighter hook, fix a fact, etc.).

6. **Generate** — Pass the latest existing version of that format + the user's feedback to the format-specific generator from Step 4 of the main flow (LinkedIn → `linkedin-content` skill; Twitter/article/newsletter → built-in templates; technical blog → `technical-blog-writing` skill). Pillar is inherited from the existing file's frontmatter — do not re-ask.

7. **Write output(s)** — Save to `Drafts/<folder>/<format>-v<N+1>.md`. Frontmatter mirrors v1 but `date:` is the revision date.

8. **No backlog update** — The `→ [[…/]]` link from the v1 run is still valid. Skip Step 6.

9. **Present** — Show the new file path(s) inline (same format as Step 7).

## Subcommand: archive <slug>

Move a stale draft from `Drafts/` to `Archived/` and flip its backlog state to `[-]`.

1. **Resolve folder** — Same matching rules as `revise`.

2. **Confirm** — List the files inside `Drafts/<folder>/`, then ask: `"Archive Drafts/<folder>/ → Archived/<folder>/ and mark backlog [-]? (y/n)"`. Wait for explicit confirmation.

3. **Move** — On confirmation, `mv 05_Content/Drafts/<folder>/ 05_Content/Archived/<folder>/`. If `Archived/<folder>/` already exists, ask whether to skip, overwrite, or rename (suffix `-2`).

4. **Update backlog** — Locate the line in `05_Content/Backlog.md` containing `→ [[<folder>/]]` (the link appended at v1-creation in Step 6 of the main flow). Change its checkbox from `[ ]` to `[-]`. If no matching line is found, surface a warning and skip the backlog edit — the move already succeeded, don't fail the whole operation.

5. **Report** — Tell the user what moved and whether the backlog was updated. Mention that `[x]` on Backlog items remains a manual signal for publication.

## Step 1 — Resolve source material

### Mode 1: From backlog (no args)
Read `05_Content/Backlog.md`. Collect all `[ ]` items from `## Queue` and sort them by priority tier based on their `from:` origin tag:

| Priority | Label | Origin tags |
|----------|-------|-------------|
| P1 | Your thinking & reflections | `from:thinking`, `from:daily` |
| P2 | Your summaries | `from:meeting` |
| P3 | External content | `from:newsletter`, `from:daily-github`, `from:ai-weekly-digest` |

Present items grouped by tier with continuous numbering:

```
**P1 — Your thinking & reflections**
1. **Founder narrative** · The question every VC asked... · [[2026-04-02]] · `from:daily`
2. **Personal reflection** · Why I stopped optimizing... · [[Deep Work Note]] · `from:thinking`

**P2 — Your summaries**
3. **AI observer** · Claude's context window changes... · [[Meeting Knowledge/...]] · `from:meeting`

**P3 — External content**
4. **Builder workflow** · Four agent frameworks... · [[GitHub Trending]] · `from:daily-github`
```

Within each tier, maintain original backlog order (FIFO). Skip empty tiers. Ask which item to draft. Read the selected item's `[[source note]]` link.

### Mode 2: Direct note (path arg)
Read the specified note directly.

### Mode 3: Free topic (quoted string)
Search the vault (Grep across `03_Thinking/`, `04_Knowledge/`, `01_Execution/`) for notes related to the topic. If matches found, read the top 2-3 most relevant. If no matches, proceed with the topic string alone — the draft will be generated from the user's knowledge and the topic.

### Expand context
After reading the primary source, look for linked context:
- If the source mentions a project → read the project note (`02_Projects/[Project]/[Project].md`)
- If the source is a meeting note → check for related decision notes or knowledge notes
- If the source has `[[wiki-links]]` → read up to 3 linked notes for context

Keep total context under ~2000 lines. Prioritize depth on the primary source over breadth.

## Step 2 — Identify pillar

If the source came from a backlog item, use its pillar tag. Otherwise, infer:

| Signal | Pillar |
|--------|--------|
| Startup decisions, fundraising, team, product pivots | **Founder narrative** |
| AI papers, model releases, industry trends, research | **AI observer** |
| Tools, automation, workflows, systems thinking | **Builder workflow** |
| Career, learning, identity, philosophy | **Personal reflection** |

If unclear, ask the user.

## Step 3 — Select output format(s)

Ask the user which format(s) to generate:

| Format | How it's generated |
|--------|-------------------|
| **LinkedIn post** | Delegates to `linkedin-content` skill |
| **Twitter/X thread** | Built-in (see Thread Format below) |
| **Non-technical article** | Built-in, uses Voice Guide (see Article Format below) |
| **Technical blog** | Delegates to `technical-blog-writing` skill |
| **Newsletter edition** | Built-in (see Newsletter Format below) |
| **All** | Generates all applicable formats |

## Step 4 — Generate drafts

### LinkedIn Post
Invoke the `linkedin-content` skill. Pass it:
- The assembled source material and context
- The pillar and content angle
- Let the skill handle hook formula, formatting, hashtags, and CTA

### Twitter/X Thread Format
Generate a thread of 3-7 tweets:

```
🧵 1/ [Hook — the provocative claim or question that stops the scroll]

2/ [Setup — the context or conventional wisdom you're challenging]

3/ [Core insight — the non-obvious thing you learned/observed]

4/ [Evidence or example — concrete, specific, from your experience]

5/ [Implication — "here's what this means for..."]

6/ [Open question or CTA — invite engagement, don't close the loop]
```

Rules:
- Each tweet ≤280 characters
- Tweet 1 is everything — it must create tension or curiosity
- No hashtags in the thread body (optional in final tweet only)
- Use line breaks for readability within tweets
- Concrete > abstract. "We lost 40% of signups" > "we had retention issues"

### Non-Technical Article Format
Read `05_Content/Voice Guide.md` and load the `## Non-Technical Article` profile.

If the profile exists, follow its patterns. If empty/TBD, use this default structure:

```
# [Title — specific, not clickbait]

[Opening: concrete external event or personal moment]

[Pivot: the deeper question this raises]

---

[Argument section 1: the conventional view and why it's incomplete]

[Argument section 2: the insight, grounded in experience or evidence]

---

[Honest self-audit: where your argument might be wrong]

[Closing: an unresolved question, not a neat conclusion]
```

Target: 1000-2500 words. Use bold for key distinctions, blockquotes for pivotal questions.

After generating, suggest the user add the final published version to `05_Content/Voice Guide.md` to calibrate future drafts.

### Technical Blog
Invoke the `technical-blog-writing` skill. Pass it:
- The source material and technical context
- The target audience level
- Let the skill handle structure, code examples, and formatting

### Newsletter Format
```
# [Newsletter title — issue number or date]

> [1-2 sentence hook — why this edition matters]

## [Section 1 title]
[Key insight, 150-300 words]

## [Section 2 title]
[Key insight, 150-300 words]

## [Section 3 title]
[Key insight, 150-300 words]

---

**What I'm thinking about:** [Personal aside — 2-3 sentences connecting themes]

**Worth reading:** [1-2 external links with one-line commentary]
```

Target: 800-1500 words total. Designed for email readability — short paragraphs, clear headers, scannable.

## Step 5 — Write outputs

Create the draft folder and write files:

```
05_Content/Drafts/YYYY-MM-DD - <slug>/
  linkedin.md      (if LinkedIn was selected)
  twitter.md       (if Twitter was selected)
  article.md       (if article or technical blog was selected)
  newsletter.md    (if newsletter was selected)
```

The `<slug>` is a URL-friendly version of the content hook (lowercase, hyphens, max 50 chars).

Each draft file includes frontmatter:
```yaml
---
pillar: <pillar name>
source: <source note path>
format: <linkedin|twitter|article|newsletter>
status: draft
date: YYYY-MM-DD
---
```

## Step 6 — Update backlog

If the source was a backlog item, update it in `05_Content/Backlog.md`:
- Append ` · → [[YYYY-MM-DD - <slug>/]]` to the item line

Do not change the checkbox. See [Backlog state conventions](#backlog-state-conventions) above for the full lifecycle (`[ ]` → `[x]` is manual on publish; `[ ]` → `[-]` is automatic via `/content-draft archive`).

## Step 7 — Present to user

Show the user what was generated:
- List the files created with their paths
- For short formats (LinkedIn, Twitter), show the full draft inline
- For long formats (article, newsletter), show the first ~500 chars and the file path
- Remind: "Edit these drafts to your satisfaction. To iterate: `/content-draft revise <slug>`. To give up on this draft: `/content-draft archive <slug>`. To publish: move the folder to `Published/` and mark the backlog item `[x]`."
