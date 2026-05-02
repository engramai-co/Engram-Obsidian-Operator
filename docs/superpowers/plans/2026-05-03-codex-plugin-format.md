# Codex Plugin Format Restructure (v2.0.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert this repo from a Claude-Code-only plugin with a 6-step manual Codex install into a proper Codex plugin marketplace, so Codex users install via `codex plugin marketplace add yuhanwang14/obsidian-operator`. Layout becomes canonical: marketplace at repo root, plugin payload at `plugins/obsidian-operator/`. Tag as v2.0.0.

**Architecture:** Repo root becomes a marketplace container (`.agents/plugins/marketplace.json` for Codex, `.claude-plugin/marketplace.json` for Claude Code, both pointing at `./plugins/obsidian-operator/`). All payload (skills, hooks, plugin manifest) moves under `plugins/obsidian-operator/`. Versions bump to 2.0.0 in 4 manifest paths. `vault-init` Step 7 rewritten to platform-aware just-remind (no auto-config). `.codex/INSTALL.md` deleted; install collapses to one line in README.

**Tech Stack:** bash, jq, git mv, markdown. No new runtime dependencies.

**Spec:** [`docs/superpowers/specs/2026-05-03-codex-plugin-format-design.md`](../specs/2026-05-03-codex-plugin-format-design.md)

---

## File Structure

**Files to create:**
- `plugins/obsidian-operator/.codex-plugin/plugin.json` — Codex plugin manifest
- `.agents/plugins/marketplace.json` — Codex marketplace pointer

**Files to move (via `git mv`, preserving rename detection):**
- `skills/` → `plugins/obsidian-operator/skills/`
- `hooks/` → `plugins/obsidian-operator/hooks/`
- `.claude-plugin/plugin.json` → `plugins/obsidian-operator/.claude-plugin/plugin.json`

**Files to modify in place after move:**
- `plugins/obsidian-operator/.claude-plugin/plugin.json` — version 1.9.1 → 2.0.0
- `plugins/obsidian-operator/hooks/hooks.json` — fallback paths
- `plugins/obsidian-operator/skills/vault-init/SKILL.md` — Step 1 cascade + Step 7 reminders

**Files to modify at repo root:**
- `.claude-plugin/marketplace.json` — source path + version 2.0.0
- `README.md` — Codex install line + upgrade note
- `CLAUDE.md` — Repo layout + version bump rule
- `docs/README.codex.md` — drop manual install + 3rd-party MCP, keep Codex-specific notes

**Files to delete:**
- `.codex/INSTALL.md`
- `.codex/` directory itself (after INSTALL.md removed)

**Commit strategy:** Single commit at the end (Task 14) with all changes staged. Single big commit gives git the best rename-detection signal across moves+edits. Then tag v2.0.0 + push (Task 15).

---

## Task 1: Create plugin payload directory skeleton

**Files:**
- Create: `plugins/obsidian-operator/.codex-plugin/` (directory)
- Create: `plugins/obsidian-operator/.claude-plugin/` (directory, empty for now)

- [ ] **Step 1: Verify cwd is repo root**

```bash
pwd
# Expected: /Users/yuhanwang/Programming/Web-and-Apps/_active/Obsidian-Operator
ls .claude-plugin skills hooks
# Expected: all three exist
```

- [ ] **Step 2: Create the new nested directory**

```bash
mkdir -p plugins/obsidian-operator/.codex-plugin
mkdir -p plugins/obsidian-operator/.claude-plugin
```

- [ ] **Step 3: Verify**

```bash
ls -d plugins/obsidian-operator/.codex-plugin plugins/obsidian-operator/.claude-plugin
# Expected: both exist
```

---

## Task 2: Move `skills/` into plugin payload

**Files:**
- Move: `skills/` → `plugins/obsidian-operator/skills/`

The `git mv` preserves rename history. The vault-init `assets/` subdirectory (with `AGENTS.md → CLAUDE.md` symlink and `vault-template/`) moves transparently because `git mv` is recursive.

- [ ] **Step 1: Run git mv**

```bash
git mv skills plugins/obsidian-operator/skills
```

- [ ] **Step 2: Verify move and skill count**

```bash
find plugins/obsidian-operator/skills -mindepth 1 -maxdepth 1 -type d | wc -l
# Expected: 20

[ ! -d skills ] && echo "old path removed: OK"
[ -d plugins/obsidian-operator/skills ] && echo "new path exists: OK"
```

- [ ] **Step 3: Verify the symlink survived**

```bash
ls -la plugins/obsidian-operator/skills/vault-init/assets/AGENTS.md
# Expected: lrwxr-xr-x ... AGENTS.md -> CLAUDE.md

readlink plugins/obsidian-operator/skills/vault-init/assets/AGENTS.md
# Expected: CLAUDE.md
```

- [ ] **Step 4: Verify git status shows renames (not delete + add)**

```bash
git status -s | head -20
# Expected: lines starting with R (renamed), not D + A pairs.
# git mv preserves rename detection; if you see D + A, abort and re-do.
```

---

## Task 3: Move `hooks/` into plugin payload

**Files:**
- Move: `hooks/` → `plugins/obsidian-operator/hooks/`

- [ ] **Step 1: Run git mv**

```bash
git mv hooks plugins/obsidian-operator/hooks
```

- [ ] **Step 2: Verify**

```bash
ls plugins/obsidian-operator/hooks
# Expected: deep-research-enforce.sh  hooks.json  preflight-enforce.sh

[ ! -d hooks ] && echo "old path removed: OK"
```

---

## Task 4: Move `.claude-plugin/plugin.json` into plugin payload

**Files:**
- Move: `.claude-plugin/plugin.json` → `plugins/obsidian-operator/.claude-plugin/plugin.json`

`.claude-plugin/marketplace.json` stays at repo root.

- [ ] **Step 1: Run git mv**

```bash
git mv .claude-plugin/plugin.json plugins/obsidian-operator/.claude-plugin/plugin.json
```

- [ ] **Step 2: Verify split**

```bash
ls .claude-plugin
# Expected: marketplace.json  (only)

ls plugins/obsidian-operator/.claude-plugin
# Expected: plugin.json  (only)
```

---

## Task 5: Bump `.claude-plugin/plugin.json` version to 2.0.0

**Files:**
- Modify: `plugins/obsidian-operator/.claude-plugin/plugin.json`

- [ ] **Step 1: Edit the version field**

Open `plugins/obsidian-operator/.claude-plugin/plugin.json`. Replace the `version` line:

```json
  "version": "1.9.1",
```

with:

```json
  "version": "2.0.0",
```

No other field changes. The description, author, etc. stay as-is.

- [ ] **Step 2: Validate JSON**

```bash
jq . plugins/obsidian-operator/.claude-plugin/plugin.json > /dev/null && echo "JSON valid"
# Expected: JSON valid
jq -r '.version' plugins/obsidian-operator/.claude-plugin/plugin.json
# Expected: 2.0.0
```

---

## Task 6: Update `.claude-plugin/marketplace.json` (source + version)

**Files:**
- Modify: `.claude-plugin/marketplace.json`

Two changes: change `plugins[0].source` from `"./"` to `"./plugins/obsidian-operator/"`, bump both versions to `2.0.0`.

- [ ] **Step 1: Apply edits**

Open `.claude-plugin/marketplace.json`. Replace:

```json
  "metadata": {
    "description": "Obsidian Operator — an AI-native personal operating system built on Obsidian, supporting Claude Code (primary) and Codex CLI",
    "version": "1.9.1"
  },
  "plugins": [
    {
      "name": "obsidian-operator",
      "source": "./",
      "description": "All 20 Operator skills (19 production + 1 cross-platform reference) — daily ops, weekly planning, strategic reviews, meetings, projects, deep research, and content engine. Supports Claude Code and Codex CLI.",
      "version": "1.9.1"
    }
  ]
```

with:

```json
  "metadata": {
    "description": "Obsidian Operator — an AI-native personal operating system built on Obsidian, supporting Claude Code (primary) and Codex CLI",
    "version": "2.0.0"
  },
  "plugins": [
    {
      "name": "obsidian-operator",
      "source": "./plugins/obsidian-operator/",
      "description": "All 20 Operator skills (19 production + 1 cross-platform reference) — daily ops, weekly planning, strategic reviews, meetings, projects, deep research, and content engine. Supports Claude Code and Codex CLI.",
      "version": "2.0.0"
    }
  ]
```

- [ ] **Step 2: Validate**

```bash
jq . .claude-plugin/marketplace.json > /dev/null && echo "JSON valid"
jq -r '.metadata.version, .plugins[0].source, .plugins[0].version' .claude-plugin/marketplace.json
# Expected: 2.0.0
#           ./plugins/obsidian-operator/
#           2.0.0
```

---

## Task 7: Create `plugins/obsidian-operator/.codex-plugin/plugin.json`

**Files:**
- Create: `plugins/obsidian-operator/.codex-plugin/plugin.json`

- [ ] **Step 1: Write the file**

Write this exact content to `plugins/obsidian-operator/.codex-plugin/plugin.json`:

```json
{
  "name": "obsidian-operator",
  "version": "2.0.0",
  "description": "AI-native personal operating system for Obsidian — 20 skills (19 production + 1 cross-platform reference) for vault setup, daily briefings, arXiv paper scanning, weekly reviews, strategic planning, meeting processing, deadline tracking, deep research, and content engine.",
  "author": {
    "name": "Yuhan Wang",
    "url": "https://github.com/yuhanwang14"
  },
  "homepage": "https://github.com/yuhanwang14/obsidian-operator",
  "repository": "https://github.com/yuhanwang14/obsidian-operator",
  "license": "MIT",
  "keywords": ["obsidian", "vault", "productivity", "planning", "knowledge-management"],
  "skills": "./skills/",
  "hooks": "./hooks/hooks.json",
  "interface": {
    "displayName": "Obsidian Operator",
    "shortDescription": "Personal operating system for Obsidian",
    "longDescription": "20 skills (19 production + 1 cross-platform reference) that turn an Obsidian vault into a structured execution engine — daily briefings, arXiv paper scanning, weekly reviews, strategic planning, meeting processing, deadline tracking, deep research, and a content engine for publishing.",
    "developerName": "Yuhan Wang",
    "category": "Productivity",
    "capabilities": ["Interactive", "Write"],
    "websiteURL": "https://github.com/yuhanwang14/obsidian-operator",
    "defaultPrompt": [
      "Set up my new Obsidian vault",
      "Generate today's briefing",
      "Run a deep research on a topic"
    ]
  }
}
```

- [ ] **Step 2: Validate**

```bash
jq . plugins/obsidian-operator/.codex-plugin/plugin.json > /dev/null && echo "JSON valid"
jq -r '.name, .version, .skills, .hooks' plugins/obsidian-operator/.codex-plugin/plugin.json
# Expected: obsidian-operator
#           2.0.0
#           ./skills/
#           ./hooks/hooks.json
```

---

## Task 8: Create `.agents/plugins/marketplace.json`

**Files:**
- Create: `.agents/plugins/marketplace.json`

- [ ] **Step 1: Create directory**

```bash
mkdir -p .agents/plugins
```

- [ ] **Step 2: Write the file**

Write this exact content to `.agents/plugins/marketplace.json`:

```json
{
  "name": "obsidian-operator",
  "interface": {
    "displayName": "Obsidian Operator"
  },
  "plugins": [
    {
      "name": "obsidian-operator",
      "source": {
        "source": "local",
        "path": "./plugins/obsidian-operator"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

- [ ] **Step 3: Validate**

```bash
jq . .agents/plugins/marketplace.json > /dev/null && echo "JSON valid"
jq -r '.name, .plugins[0].source.path, .plugins[0].policy.installation' .agents/plugins/marketplace.json
# Expected: obsidian-operator
#           ./plugins/obsidian-operator
#           AVAILABLE
```

---

## Task 9: Update `hooks/hooks.json` fallback paths

**Files:**
- Modify: `plugins/obsidian-operator/hooks/hooks.json`

Both hook entries currently reference a fallback path that assumed payload at the marketplace root. After restructure, payload is one level deeper (`plugins/obsidian-operator/`). Update both fallbacks.

- [ ] **Step 1: Apply two edits**

In `plugins/obsidian-operator/hooks/hooks.json`, replace both occurrences:

```
$HOME/.claude/plugins/marketplaces/yuhanwang14/obsidian-operator
```

with:

```
$HOME/.claude/plugins/marketplaces/yuhanwang14/obsidian-operator/plugins/obsidian-operator
```

(Use Edit tool with `replace_all: true` for the path, OR do two separate Edits — one per hook entry.)

The full hook command lines after edit should look like:

```
"command": "_R=\"${CLAUDE_PLUGIN_ROOT}\"; [ -z \"$_R\" ] && _R=\"$HOME/.claude/plugins/marketplaces/yuhanwang14/obsidian-operator/plugins/obsidian-operator\"; bash \"$_R/hooks/preflight-enforce.sh\""
```

and:

```
"command": "_R=\"${CLAUDE_PLUGIN_ROOT}\"; [ -z \"$_R\" ] && _R=\"$HOME/.claude/plugins/marketplaces/yuhanwang14/obsidian-operator/plugins/obsidian-operator\"; bash \"$_R/hooks/deep-research-enforce.sh\""
```

- [ ] **Step 2: Validate JSON and verify both updates**

```bash
jq . plugins/obsidian-operator/hooks/hooks.json > /dev/null && echo "JSON valid"
grep -c "obsidian-operator/plugins/obsidian-operator" plugins/obsidian-operator/hooks/hooks.json
# Expected: 2
```

- [ ] **Step 3: Smoke test both hook scripts (using `CLAUDE_PLUGIN_ROOT` set, since fallback is just safety)**

```bash
echo '{"hook_event_name":"UserPromptSubmit","prompt":"/deep-research test"}' \
  | bash plugins/obsidian-operator/hooks/deep-research-enforce.sh \
  | jq -r '.hookSpecificOutput.hookEventName'
# Expected: UserPromptSubmit

echo '{"hook_event_name":"UserPromptSubmit","prompt":"unrelated"}' \
  | bash plugins/obsidian-operator/hooks/deep-research-enforce.sh; echo "[exit: $?]"
# Expected: [exit: 0]   (silent — no match, exits cleanly)

echo '{}' | bash plugins/obsidian-operator/hooks/preflight-enforce.sh; echo "[exit: $?]"
# Expected: [exit: 0]   (no event match, silent)
```

---

## Task 10: Rewrite vault-init Step 1 (assets cascade) and Step 7 (platform reminders)

**Files:**
- Modify: `plugins/obsidian-operator/skills/vault-init/SKILL.md`

Two distinct edits in this single file. Read the file once first to confirm line ranges haven't drifted, then apply both edits.

- [ ] **Step 1: Read current state to confirm targets**

```bash
grep -n "^## Step 1\|^## Step 7" plugins/obsidian-operator/skills/vault-init/SKILL.md
# Expected: lines around 14 and 145
```

- [ ] **Step 2: Replace Step 1's asset path cascade**

Find this block in `plugins/obsidian-operator/skills/vault-init/SKILL.md` (lines 18–41):

```markdown
2. **Skill assets directory.** Everything this skill copies — `vault-template/` and `CLAUDE.md` — is bundled inside the skill itself at `assets/`. Resolve the assets path in this order:

   ```bash
   # 1. env var set by Claude Code when a plugin skill runs
   [ -n "$CLAUDE_PLUGIN_ROOT" ] && echo "$CLAUDE_PLUGIN_ROOT/skills/vault-init/assets"

   # 2. plugin cache — the real install layout has a double
   # obsidian-operator/obsidian-operator/ nesting plus a version dir
   ls -d ~/.claude/plugins/cache/obsidian-operator/obsidian-operator/*/ 2>/dev/null \
     | sort -V | tail -1 \
     | sed 's:$:skills/vault-init/assets:'

   # 3. marketplace checkout — flat, no version dir
   [ -d ~/.claude/plugins/marketplaces/obsidian-operator ] \
     && echo ~/.claude/plugins/marketplaces/obsidian-operator/skills/vault-init/assets

   # 4. Codex CLI symlink target — readlink -f resolves to clone path
   [ -L ~/.agents/skills/obsidian-operator ] \
     && echo "$(readlink -f ~/.agents/skills/obsidian-operator)/vault-init/assets"

   # 5. Codex CLI clone path (fallback if symlink missing)
   [ -d ~/.codex/obsidian-operator/skills/vault-init/assets ] \
     && echo ~/.codex/obsidian-operator/skills/vault-init/assets
   ```

   Use the first path that exists **and** contains both `vault-template/` and `CLAUDE.md`. If none do, ask the user: "I can't find the vault-init assets. Did you install via `/plugin install obsidian-operator` (Claude Code) or follow `.codex/INSTALL.md` to clone into `~/.codex/obsidian-operator` (Codex CLI)? (Paste path to the repo root and I'll look inside `skills/vault-init/assets/`.)"

   If the user gives a local repo path, append `skills/vault-init/assets` and verify the two files are there before proceeding.
```

Replace with:

```markdown
2. **Skill assets directory.** Everything this skill copies — `vault-template/` and `CLAUDE.md` — is bundled inside the skill itself at `assets/`. Resolve the assets path in this order:

   ```bash
   # 1. env var set by the harness when a plugin skill runs
   #    (Claude Code sets $CLAUDE_PLUGIN_ROOT to .../plugins/obsidian-operator/)
   [ -n "$CLAUDE_PLUGIN_ROOT" ] && echo "$CLAUDE_PLUGIN_ROOT/skills/vault-init/assets"

   # 2. Claude Code plugin cache (versioned install path; nested plugin payload)
   ls -d ~/.claude/plugins/cache/obsidian-operator/obsidian-operator/*/plugins/obsidian-operator/skills/vault-init/assets 2>/dev/null \
     | sort -V | tail -1

   # 3. Claude Code marketplace checkout (flat, no version dir)
   [ -d ~/.claude/plugins/marketplaces/obsidian-operator/plugins/obsidian-operator/skills/vault-init/assets ] \
     && echo ~/.claude/plugins/marketplaces/obsidian-operator/plugins/obsidian-operator/skills/vault-init/assets

   # 4. Codex CLI plugin cache (mirror of openai-curated layout, hash-based)
   ls -d ~/.codex/plugins/cache/obsidian-operator/obsidian-operator/*/plugins/obsidian-operator/skills/vault-init/assets 2>/dev/null \
     | sort -V | tail -1
   ```

   Use the first path that exists **and** contains both `vault-template/` and `CLAUDE.md`. If none do, ask the user: "I can't find the vault-init assets. Did you install via `/plugin install obsidian-operator` (Claude Code) or `codex plugin marketplace add yuhanwang14/obsidian-operator` (Codex CLI)? (Paste the repo path and I'll look inside `plugins/obsidian-operator/skills/vault-init/assets/`.)"

   If the user gives a local repo path, append `plugins/obsidian-operator/skills/vault-init/assets` and verify the two files are there before proceeding.
```

- [ ] **Step 3: Replace Step 7 entirely**

Find this block in the same file (the entire `## Step 7 — Optional: mention Gmail MCP + Apple Calendar` section, ~lines 145–153):

```markdown
## Step 7 — Optional: mention Gmail MCP + Apple Calendar

Don't configure these — they're handled outside Claude Code. Just surface them in the final summary so the user knows they exist:

- **Gmail MCP** (for `/daily-init` email section):
  - Claude Code: "Connect Google in Claude Code settings → MCP integrations."
  - Codex CLI: "Configure a Gmail MCP server in `~/.codex/config.toml` — see `docs/README.codex.md` for compatible options (Google Workspace MCP, Composio Gmail, Nylas)."
  - Skip if you don't need email in daily briefings — `/daily-init` will silently degrade.
- **Apple Calendar / Reminders** (macOS only): "`/deadline-plan` and `/add-events` will use the calendar/list names you just set. No OS setup needed."
```

Replace with:

```markdown
## Step 7 — Platform-specific reminders

Detect platform via env signal: if `$CODEX_HOME` is set → Codex CLI, otherwise → Claude Code. (Do not use `~/.codex/` directory existence as a signal — that resolves true on any machine where Codex was ever installed, even from a Claude Code session.)

Surface (do **not** auto-configure) the platform-relevant items in the final summary.

If Claude Code:
- **Gmail** (for `/daily-init` email section): "Connect Google in Claude Code settings → MCP integrations." Skip if you don't need email — `/daily-init` will silently degrade.

If Codex CLI:
- **Gmail** (for `/daily-init` email section): "Codex ships an official Gmail connector — enable `gmail@openai-curated` in Codex's plugin manager." Skip if you don't need email.
- **`/deep-research` parallel agents**: "Add `[features] multi_agent = true` to `~/.codex/config.toml` to enable parallel agent dispatch. Otherwise `/deep-research` falls back to sequential thread execution (slower, still functional)."

Both platforms:
- **Apple Calendar / Reminders** (macOS only): "`/deadline-plan` and `/add-events` will use the calendar/list names you just set. No OS setup needed."

vault-init never writes `~/.codex/config.toml` itself. If `multi_agent` is missing, the `deep-research-enforce.sh` hook will emit a one-line fallback notice at `/deep-research` invocation time.
```

- [ ] **Step 4: Verify both edits**

```bash
grep -c "CODEX_HOME" plugins/obsidian-operator/skills/vault-init/SKILL.md
# Expected: at least 1 (in the new Step 7)

grep -c "Composio Gmail\|Nylas\|Google Workspace MCP" plugins/obsidian-operator/skills/vault-init/SKILL.md
# Expected: 0 (third-party MCPs removed)

grep -c "plugins/obsidian-operator/skills/vault-init/assets" plugins/obsidian-operator/skills/vault-init/SKILL.md
# Expected: 4 or 5 (cascade plus the user-prompt fallback)

grep -c "~/.agents/skills/obsidian-operator" plugins/obsidian-operator/skills/vault-init/SKILL.md
# Expected: 0 (legacy symlink fallback removed)
```

---

## Task 11: Rewrite `docs/README.codex.md`

**Files:**
- Modify: `docs/README.codex.md`

Drop the manual install pointer (link to `.codex/INSTALL.md` will 404 after Task 13), drop third-party MCP recommendation, update troubleshooting paths.

- [ ] **Step 1: Replace the file content**

Overwrite `docs/README.codex.md` with this content:

```markdown
# obsidian-operator on Codex CLI

How obsidian-operator's 19 skills work on OpenAI Codex CLI. For install, see the [Quick Start](../README.md#quick-start) in the main README.

## How discovery works

Obsidian Operator ships as a Codex plugin (v2.0.0+). Once installed via `codex plugin marketplace add yuhanwang14/obsidian-operator` and enabled in Codex's plugin manager, Codex routes by each SKILL.md's `description` frontmatter:

- `/daily-init 6` → matches `daily-init` description's slash trigger
- "start my day" → matches `daily-init` description's natural-language phrase
- "scan arxiv today" → matches `daily-academic` description's natural-language phrase

Slash commands are not enforced — they're just one of several trigger patterns each skill description lists.

## Per-skill status on Codex CLI

| Skill | Status | Notes |
|---|---|---|
| `vault-init` | ✅ full | Resolves assets via plugin cache cascade |
| `daily-init` | ✅ full | Hook + Gmail connector both required for full functionality (graceful degradation if missing) |
| `weekly-init`, `weekly-review` | ✅ full | No platform-specific deps |
| `daily-github`, `daily-academic`, `ai-weekly-digest` | ✅ full | `WebSearch` / `WebFetch` are native on Codex |
| `quarterly-plan`, `annual-vision` | ✅ full | osascript runs on macOS regardless of platform |
| `meeting`, `meeting-prep` | ✅ full | Bash transcription script, osascript |
| `project-init`, `project-sync`, `deadline-plan` | ✅ full | No platform-specific deps |
| `add-events` | ✅ full | osascript |
| `deep-research` | ⚠️ requires `multi_agent` feature flag | Falls back to sequential if not enabled |
| `content-extract` | ⚠️ requires Gmail connector for newsletter step | Skips silently if missing, continues with vault sources |
| `content-draft`, `link-enrich` | ✅ full | No platform-specific deps |
| `using-obsidian-operator` | ✅ full | Reference container only |

## Optional configuration

Two optional platform integrations:

- **Gmail connector** (for `/daily-init` email section and `/content-extract` newsletter step): Codex ships an official Gmail connector — enable `gmail@openai-curated` in Codex's plugin manager. No third-party MCP needed.
- **`/deep-research` parallel agents**: Add `[features] multi_agent = true` to `~/.codex/config.toml`. If missing, the `deep-research-enforce.sh` hook emits a one-line notice at runtime and falls back to sequential thread execution.

## Cross-platform tool mapping

Skills are written in Claude Code vocabulary. Codex CLI's agent maps automatically for most cases (file ops, shell, web search). For dispatch primitives (`deep-research`'s parallel agents) see:

- `plugins/obsidian-operator/skills/using-obsidian-operator/references/codex-tools.md`

## Why Codex App is not supported

Codex App runs agents in `$CODEX_HOME/worktrees/...` with a Seatbelt sandbox: no `git checkout -b`, no `git push`, no network on macOS, no user-configurable hooks. obsidian-operator's daily-vault-edit use case requires:

- A persistent vault (not a per-task worktree)
- Network for Gmail OAuth + arXiv / GitHub fetches
- The `UserPromptSubmit` hook for boundary-cascade enforcement

None of these survive in the App's sandbox. If you absolutely need vault automation in App, run only read-only skills (`/link-enrich scan`, `/weekly-review`) from a vault repo — but this is not a supported configuration.

## Maintaining vault `CLAUDE.md` and `AGENTS.md`

`vault-init` Step 4 copies both files into your vault root. They start with identical content. **If you customize `CLAUDE.md`** (e.g. updating the Customization table), copy the same edit into `AGENTS.md` to keep them in sync. Drift between the two means Claude Code and Codex CLI agents will see different vault config.

A future `vault-init --check` mode could detect drift; not implemented yet.

## Troubleshooting

### Skills not appearing

Check that the plugin is installed and enabled:

```bash
grep -A1 'gmail\|obsidian-operator' ~/.codex/config.toml
# Expected: [plugins."obsidian-operator@..."] enabled = true
```

If missing, run `codex plugin marketplace add yuhanwang14/obsidian-operator` and enable in plugin manager.

### Hook not firing on `/daily-init`

```bash
# Resolve plugin cache path (varies by version):
PLUGIN_DIR=$(ls -d ~/.codex/plugins/cache/obsidian-operator/obsidian-operator/*/plugins/obsidian-operator 2>/dev/null | sort -V | tail -1)
echo '{"hook_event_name":"UserPromptSubmit","prompt":"/daily-init"}' \
  | bash "$PLUGIN_DIR/hooks/preflight-enforce.sh"
```

Should output JSON containing `hookSpecificOutput.additionalContext` if any boundary artifact is missing in your vault.

### `/deep-research` running sequentially

Verify `~/.codex/config.toml` contains:
```toml
[features]
multi_agent = true
```
Restart Codex after editing.

## Upgrading from v1.9.x manual install

If you previously followed `.codex/INSTALL.md` (clone + symlink + manual hook registration), clean up before adopting v2.0.0:

```bash
rm ~/.agents/skills/obsidian-operator                         # stale skill discovery symlink
# remove the old obsidian-operator entry from ~/.codex/hooks.json (manual)
# (optional) rm -rf ~/.codex/obsidian-operator                 # old clone path
```

Then install via the new flow:

```bash
codex plugin marketplace add yuhanwang14/obsidian-operator
# enable obsidian-operator in Codex's plugin manager
```
```

- [ ] **Step 2: Verify content**

```bash
grep -c "Composio Gmail\|Nylas" docs/README.codex.md
# Expected: 0
grep -c "/.codex/INSTALL.md" docs/README.codex.md
# Expected: 0
grep -c "gmail@openai-curated" docs/README.codex.md
# Expected: 1
grep -c "Upgrading from v1.9.x" docs/README.codex.md
# Expected: 1
```

---

## Task 12: Update `README.md` (Quick Start + Prerequisites)

**Files:**
- Modify: `README.md`

Three edits: Codex install line, Prerequisites table link, manual setup snippet path. The skill count stays "19" in the Operator description (it's the natural-language way the README phrases it; "19 production" matches CLAUDE.md's wording).

- [ ] **Step 1: Replace the Codex install line**

In `README.md`, find:

```markdown
**Codex CLI**: clone + symlink + register hook. See [`.codex/INSTALL.md`](.codex/INSTALL.md) for the 6-step install. After install, run `/vault-init` exactly as below.
```

Replace with:

````markdown
**Codex CLI**:

```bash
codex plugin marketplace add yuhanwang14/obsidian-operator
# then enable obsidian-operator in Codex's plugin manager
```

> Upgrading from v1.9.x manual install? Remove the stale symlink first: `rm ~/.agents/skills/obsidian-operator`. See [docs/README.codex.md](docs/README.codex.md#upgrading-from-v19x-manual-install) for full upgrade steps.
````

- [ ] **Step 2: Update the Prerequisites table link**

In `README.md`, find:

```markdown
| [Claude Code](https://claude.ai/code) **or** [Codex CLI](https://developers.openai.com/codex/cli) | Yes | One required. See [Codex install](.codex/INSTALL.md) and [docs/README.codex.md](docs/README.codex.md) for Codex CLI specifics. |
```

Replace with:

```markdown
| [Claude Code](https://claude.ai/code) **or** [Codex CLI](https://developers.openai.com/codex/cli) | Yes | One required. See [docs/README.codex.md](docs/README.codex.md) for Codex CLI specifics. |
```

- [ ] **Step 3: Update the manual-setup snippet paths**

In `README.md`, find the `<details>` block:

```markdown
<details>
<summary>Manual setup (without the plugin)</summary>

```bash
git clone https://github.com/yuhanwang14/obsidian-operator.git
cp -r obsidian-operator/skills/vault-init/assets/vault-template/* /path/to/your/vault/
cp    obsidian-operator/skills/vault-init/assets/CLAUDE.md         /path/to/your/vault/
# then edit the Customization table in CLAUDE.md by hand
```

</details>
```

Replace with:

```markdown
<details>
<summary>Manual setup (without the plugin)</summary>

```bash
git clone https://github.com/yuhanwang14/obsidian-operator.git
cp -r obsidian-operator/plugins/obsidian-operator/skills/vault-init/assets/vault-template/* /path/to/your/vault/
cp    obsidian-operator/plugins/obsidian-operator/skills/vault-init/assets/CLAUDE.md         /path/to/your/vault/
# then edit the Customization table in CLAUDE.md by hand
```

</details>
```

- [ ] **Step 4: Update the "Configuration" link target**

In `README.md`, find:

```markdown
`/vault-init` handles the common settings interactively: the **Customization** table in [CLAUDE.md](skills/vault-init/assets/CLAUDE.md)
```

Replace with:

```markdown
`/vault-init` handles the common settings interactively: the **Customization** table in [CLAUDE.md](plugins/obsidian-operator/skills/vault-init/assets/CLAUDE.md)
```

- [ ] **Step 5: Verify**

```bash
grep -c "\.codex/INSTALL.md" README.md
# Expected: 0

grep -c "codex plugin marketplace add yuhanwang14" README.md
# Expected: 1

grep -c "plugins/obsidian-operator/skills/vault-init/assets" README.md
# Expected: 3 (vault-template path, CLAUDE.md cp path, Configuration link target)
```

---

## Task 13: Update `CLAUDE.md` (Repo layout + version bump rule)

**Files:**
- Modify: `CLAUDE.md`

Two sections to update: the file-tree snippet under "Repo layout" and the "Bump the plugin version" rule under "Rules for editing skills".

- [ ] **Step 1: Replace the Repo layout block**

In `CLAUDE.md`, find:

```markdown
## Repo layout

```
.claude-plugin/         plugin manifest + marketplace metadata (versioned source of truth)
skills/<skill-name>/    one folder per skill, SKILL.md required (see style guide)
hooks/                  bash hooks invoked by Claude Code at session boundaries
docs/                   internal docs: style guide, plans
vault-template/         empty scaffold copied into a user's vault by /vault-init
.workspaces/            local scratch for skill development; gitignored
```
```

Replace with:

```markdown
## Repo layout

```
.agents/plugins/        Codex marketplace pointer (single-plugin marketplace)
.claude-plugin/         Claude Code marketplace pointer (single-plugin marketplace)
plugins/obsidian-operator/      plugin payload root
  .codex-plugin/        Codex plugin manifest (version, interface, paths)
  .claude-plugin/       Claude Code plugin manifest (version, description)
  skills/<skill-name>/  one folder per skill, SKILL.md required (see style guide)
  hooks/                bash hooks invoked at session boundaries by both platforms
docs/                   internal docs: style guide, specs, plans
.workspaces/            local scratch for skill development; gitignored
```

> Note on `vault-template/`: the user-facing vault scaffold copied by `/vault-init` lives at `plugins/obsidian-operator/skills/vault-init/assets/vault-template/` — bundled with the skill that consumes it, not at repo root.
```

- [ ] **Step 2: Replace the version-bump rule**

In `CLAUDE.md`, find:

```markdown
2. **Bump the plugin version on every skill change.** Update all three:
   - `.claude-plugin/plugin.json` `version` field
   - `.claude-plugin/marketplace.json` `metadata.version` field
   - `README.md` if the skill is user-visible (e.g. listed in the skill table)
```

Replace with:

```markdown
2. **Bump the plugin version on every skill change.** Update all four manifest paths in lockstep:
   - `plugins/obsidian-operator/.claude-plugin/plugin.json` `version` field
   - `plugins/obsidian-operator/.codex-plugin/plugin.json` `version` field
   - `.claude-plugin/marketplace.json` — both `metadata.version` and `plugins[0].version`
   - `.agents/plugins/marketplace.json` — no version field per Codex spec, but if you change the plugin's `description` or `interface` text, mirror it across all three of the above as well
   - `README.md` if the skill is user-visible (e.g. listed in the skill table)
```

- [ ] **Step 3: Verify**

```bash
grep -c "\.codex-plugin/plugin.json" CLAUDE.md
# Expected: at least 1

grep -c "plugins/obsidian-operator/skills" CLAUDE.md
# Expected: at least 1

grep -c "vault-template/" CLAUDE.md
# Expected: 1 (only in the Note about its real location)
```

---

## Task 14: Delete `.codex/` directory

**Files:**
- Delete: `.codex/INSTALL.md`
- Delete: `.codex/` directory

The directory contains only `INSTALL.md`. Removing the file makes the directory empty; remove the directory too.

- [ ] **Step 1: Confirm only INSTALL.md is in there**

```bash
ls .codex/
# Expected: INSTALL.md  (only)
```

- [ ] **Step 2: git rm**

```bash
git rm .codex/INSTALL.md
rmdir .codex
```

- [ ] **Step 3: Verify**

```bash
[ ! -d .codex ] && echo "removed: OK"
# Expected: removed: OK
```

---

## Task 15: Pre-push validation (cheap mechanical checks)

**Files:** none modified

Run all 9 cheap validation checks from the spec. Every check must pass before staging the commit.

- [ ] **Step 1: Skill count = 20**

```bash
find plugins/obsidian-operator/skills -mindepth 1 -maxdepth 1 -type d | wc -l
# Expected: 20
```

- [ ] **Step 2: All 4 manifest JSONs valid**

```bash
jq . plugins/obsidian-operator/.codex-plugin/plugin.json > /dev/null && echo "codex plugin: OK"
jq . plugins/obsidian-operator/.claude-plugin/plugin.json > /dev/null && echo "claude plugin: OK"
jq . .claude-plugin/marketplace.json > /dev/null && echo "claude marketplace: OK"
jq . .agents/plugins/marketplace.json > /dev/null && echo "agents marketplace: OK"
# Expected: 4 OK lines
```

- [ ] **Step 3: hooks.json valid**

```bash
jq . plugins/obsidian-operator/hooks/hooks.json > /dev/null && echo "hooks.json: OK"
# Expected: hooks.json: OK
```

- [ ] **Step 4: Both hook scripts smoke test (matching prompt)**

```bash
echo '{"hook_event_name":"UserPromptSubmit","prompt":"/deep-research test"}' \
  | bash plugins/obsidian-operator/hooks/deep-research-enforce.sh \
  | jq -r '.hookSpecificOutput.hookEventName'
# Expected: UserPromptSubmit

echo '{}' | bash plugins/obsidian-operator/hooks/preflight-enforce.sh; echo "[exit: $?]"
# Expected: [exit: 0]
```

- [ ] **Step 5: Both hook scripts smoke test (non-matching prompt — silent)**

```bash
echo '{"hook_event_name":"UserPromptSubmit","prompt":"unrelated chatter"}' \
  | bash plugins/obsidian-operator/hooks/deep-research-enforce.sh; echo "[exit: $?]"
# Expected: [exit: 0]   (silent — empty stdout, clean exit)

echo '{"hook_event_name":"UserPromptSubmit","prompt":"unrelated chatter"}' \
  | bash plugins/obsidian-operator/hooks/preflight-enforce.sh; echo "[exit: $?]"
# Expected: [exit: 0]
```

- [ ] **Step 6: Version 2.0.0 appears in 4 places**

```bash
grep -l '"2.0.0"' \
  plugins/obsidian-operator/.codex-plugin/plugin.json \
  plugins/obsidian-operator/.claude-plugin/plugin.json \
  .claude-plugin/marketplace.json
# Expected: all three printed (4 matches total — marketplace.json has 2)

# .agents/plugins/marketplace.json has no version field per Codex spec — confirm:
grep -c '"version"' .agents/plugins/marketplace.json
# Expected: 0
```

- [ ] **Step 7: Hook fallback path updated**

```bash
grep -c "obsidian-operator/plugins/obsidian-operator" plugins/obsidian-operator/hooks/hooks.json
# Expected: 2  (one per hook entry)
```

- [ ] **Step 8: vault-init Step 7 platform detection present**

```bash
grep -c '\$CODEX_HOME' plugins/obsidian-operator/skills/vault-init/SKILL.md
# Expected: at least 1

grep -c "Composio Gmail\|Nylas\|Google Workspace MCP" plugins/obsidian-operator/skills/vault-init/SKILL.md
# Expected: 0
```

- [ ] **Step 9: git status review (sanity check)**

```bash
git status -s | wc -l
# Expected: ~30+ lines (renames + new files + edits)

# Confirm no D + A pairs (which would mean rename detection failed):
git status -s | grep -E '^[DA]' | head
# Expected: none, or only A for net-new files (.codex-plugin/plugin.json, .agents/plugins/marketplace.json)

git status -s | grep -E '^R' | wc -l
# Expected: at least 22 (20 skills + 3 hook files = files renamed via git mv; actual count depends on git's rename detection)
```

If any check fails, fix it before proceeding to commit. Don't proceed to Task 16 if any cheap check fails.

---

## Task 16: Commit + tag + push

**Files:** none modified — git operations only

- [ ] **Step 1: Stage everything**

```bash
git add -A
git status -s | head -40
# Expected: status now shows everything staged (no working-tree changes)
```

Quick sanity scan of `git status -s`:
- All `R ` (renames) accounted for: 20 skill dirs, 3 hook files, 1 plugin.json
- `A ` (added): `.agents/plugins/marketplace.json`, `plugins/obsidian-operator/.codex-plugin/plugin.json`
- `M ` (modified): `.claude-plugin/marketplace.json`, `plugins/obsidian-operator/hooks/hooks.json` (after move), `plugins/obsidian-operator/.claude-plugin/plugin.json` (after move), `plugins/obsidian-operator/skills/vault-init/SKILL.md` (after move), `README.md`, `CLAUDE.md`, `docs/README.codex.md`
- `D ` (deleted): `.codex/INSTALL.md` (the directory removal is implicit)

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
Convert to Codex plugin format (v2.0.0)

Restructure repo into a canonical Codex plugin marketplace: skills,
hooks, and the Claude Code plugin manifest move into
plugins/obsidian-operator/, repo root becomes a marketplace container
with .agents/plugins/marketplace.json (Codex) and unchanged
.claude-plugin/marketplace.json (Claude Code), both pointing at the
new payload. Add plugins/obsidian-operator/.codex-plugin/plugin.json.

Codex install collapses from 6 manual steps (clone + symlink +
~/.codex/hooks.json edit + multi_agent + 3rd-party Gmail MCP) to one
line: `codex plugin marketplace add yuhanwang14/obsidian-operator`.
Delete .codex/INSTALL.md; fold install into README.

vault-init Step 7 rewritten as platform-aware reminders (no auto-config
of ~/.codex/config.toml); detection signal is $CODEX_HOME. Drop
third-party Gmail MCP recommendation; Codex now ships gmail@openai-curated.

multi_agent flag enforcement still handled at runtime by
deep-research-enforce.sh hook; vault-init only reminds.

Hook fallback paths updated for the deeper plugin location.

Major version bump (v2.0.0) signals the breaking install layout
change. v1.9.x users must rm ~/.agents/skills/obsidian-operator before
adopting the new flow — documented in README and docs/README.codex.md.

Spec: docs/superpowers/specs/2026-05-03-codex-plugin-format-design.md
Plan: docs/superpowers/plans/2026-05-03-codex-plugin-format.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Tag v2.0.0**

```bash
git tag -a v2.0.0 -m "v2.0.0 — Codex plugin format (canonical marketplace+plugin layout)"
```

- [ ] **Step 4: Push commit + tag**

```bash
git push
git push origin v2.0.0
```

- [ ] **Step 5: Confirm remote state**

```bash
git log --oneline -3
# Expected: latest commit is the v2.0.0 restructure

git tag --list | tail -3
# Expected: v2.0.0 in the list

git status
# Expected: working tree clean, branch up to date with origin/main
```

---

## Task 17 (post-push verification): Real installs in fresh test vault

**Files:** none — manual end-to-end testing

These tests run against the just-pushed v2.0.0. If any fail, revert (Task 18).

- [ ] **Step 1: Claude Code reinstall + skill discovery**

In a fresh test vault with Claude Code:

```bash
cd /tmp/test-vault   # or any existing test vault
claude               # fresh session
> /plugin marketplace remove obsidian-operator
> /plugin marketplace add https://github.com/yuhanwang14/obsidian-operator
> /plugin install obsidian-operator
> /plugin
```

Expected: `obsidian-operator` listed at v2.0.0 with 20 skills.

- [ ] **Step 2: Claude Code hook fires on /daily-init**

```
> /daily-init 6
```

Expected: preflight-enforce.sh fires (if any boundary artifact missing in the vault, system-reminder injects); briefing generates.

- [ ] **Step 3: Claude Code hook fires on /deep-research**

```
> /deep-research "test topic"
```

Expected: deep-research-enforce.sh injects the Step 4 enforcement system-reminder; agent dispatches parallel sub-agents.

- [ ] **Step 4: Codex install via marketplace**

`codex plugin marketplace add` is a CLI command (run from your shell, not from inside the Codex TUI):

```bash
codex plugin marketplace add yuhanwang14/obsidian-operator
# enable obsidian-operator in Codex's plugin manager (TUI or however Codex exposes this)

cd /tmp/test-vault-codex
codex
> /vault-init
```

Expected: plugin appears in Codex plugin manager; `/vault-init` activates and walks setup.

**This is the empirical-verification test for the spec's open question on Codex hook auto-loading** — observe whether the hooks fire on `/daily-init` / `/deep-research`. If they do not, the install docs need an additional "register hook in `~/.codex/hooks.json`" step.

- [ ] **Step 5: Document any post-push gaps**

If Codex doesn't auto-load hooks, add a one-line snippet to `docs/README.codex.md` "Optional configuration" with the manual hook registration. Push as a v2.0.1 patch — do NOT amend v2.0.0.

If Claude Code `/plugin update` failed for users on v1.9.x → v2.0.0 (cache stuck, etc.), document a `/plugin marketplace remove + add` workaround in README's upgrade note.

---

## Task 18 (rollback, only if Task 17 reveals breaking failures)

**Files:** none — git operations

- [ ] **Step 1: Identify the v2.0.0 commit**

```bash
git log --oneline -5
# Find the v2.0.0 commit hash
```

- [ ] **Step 2: Revert and push**

```bash
git revert <v2.0.0-commit-hash> --no-edit
git push
```

- [ ] **Step 3: Delete the bad tag (locally + remote)**

```bash
git tag -d v2.0.0
git push origin :refs/tags/v2.0.0
```

- [ ] **Step 4: Verify**

```bash
git log --oneline -3
# Expected: revert commit on top, then the v2.0.0 commit (still in history but undone)

git tag --list | grep -c v2.0.0
# Expected: 0
```

After rollback, the working tree returns to v1.9.1 layout. Diagnose the failure mode, fix in a new branch, re-cut a v2.0.x once green.

---

## Self-Review

**Spec coverage** — every spec section maps to a task:
- D1 canonical restructure → Tasks 1-4 (mkdir + 3 git mv) + Task 8 (Codex marketplace) + Task 7 (Codex plugin manifest)
- D2 v2.0.0 bump → Tasks 5, 6, 7
- D3 delete .codex/INSTALL.md → Task 14
- D4 vault-init Step 7 → Task 10 Step 3
- D5 manifest field set → Task 7
- D6 push-first verify-after → Task 15 (cheap pre-push validation) + Task 16 (stage + commit + tag + push) + Task 17 (post-push real-install verification) + Task 18 (rollback path)
- Internal path A (hooks fallback) → Task 9
- Internal path B (vault-init cascade) → Task 10 Step 2
- Internal path C (vault-init Step 6 — unchanged) → no task needed
- Internal path D (vault-init Step 7) → Task 10 Step 3
- Internal path E (docs/README.codex.md) → Task 11
- Internal path F (README.md) → Task 12
- Internal path G (CLAUDE.md) → Task 13

**Placeholder scan**: no "TBD" / "TODO" / "fill in details" / "similar to Task N". Every code block is concrete.

**Type consistency**: paths consistent throughout — `plugins/obsidian-operator/` everywhere; manifest field names match spec (`skills`, `hooks`, `interface.displayName`, etc.).

**Ambiguity check**:
- "Single big commit" is explicit (Task 16 Step 1 stages, Task 16 Step 2 commits).
- Hook fallback path edit uses literal string match — implementer can use `replace_all: true` since the same string appears twice.
- Step 7 platform detection signal is `$CODEX_HOME` only (no `~/.codex/` directory check).
