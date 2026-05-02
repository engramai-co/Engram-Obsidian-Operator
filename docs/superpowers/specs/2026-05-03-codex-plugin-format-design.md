# Convert Obsidian Operator to Codex plugin format (v2.0.0)

**Status**: Approved (brainstorming) — awaiting writing-plans
**Date**: 2026-05-03
**Author**: yuhanwang14 + Claude (superpowers:brainstorming)
**Replaces**: `.codex/INSTALL.md` (manual clone+symlink+register hook flow, v1.9.x)

## Goal

Convert this repo from a Claude-Code-only plugin with a 6-step manual Codex install (`git clone` + `~/.agents/skills/` symlink + manual hook registration) to a proper Codex plugin marketplace, so a Codex user can install the entire 20-skill (19 production + 1 cross-platform reference) + 2-hook payload via:

```bash
codex plugin marketplace add yuhanwang14/obsidian-operator
# enable obsidian-operator in Codex's plugin manager
```

Claude Code users continue to install via `/plugin marketplace add` and are unaffected by the layout change other than a transparent `/plugin update`.

## Non-goals

- Do not change skill content, hook behavior, or vault-template content (only their physical location).
- Do not introduce `.app.json` (Codex app connector) — Obsidian Operator does not need an external connector.
- Do not introduce `.mcp.json` (plugin-bundled MCP server) — we ship no MCP server of our own.
- Do not rewrite git history; use `git mv` so rename detection preserves blame.
- Do not bundle binary brand assets (icon/logo) — `interface` fields use placeholders, brand work is a separate future task.
- Do not extend the v1.9.1 deep-research enforcement design; it ships as-is, just relocated.

## Background

### Current state (v1.9.1)

- **Repo root** holds plugin payload directly: `skills/`, `hooks/`, `vault-template/`, plus `.claude-plugin/{plugin,marketplace}.json`.
- **Claude Code install** is one command: `/plugin marketplace add github_url` + `/plugin install obsidian-operator`. Marketplace `source: "./"` points at repo root.
- **Codex install** is six manual steps documented in `.codex/INSTALL.md`: clone repo into `~/.codex/obsidian-operator`, symlink `skills/` into `~/.agents/skills/obsidian-operator`, edit `~/.codex/hooks.json` to register `preflight-enforce.sh` and `deep-research-enforce.sh`, set `[features] multi_agent = true` in `~/.codex/config.toml`, optionally configure a third-party Gmail MCP, restart Codex. Skills are routed by `~/.agents/skills/` symlink discovery, not by Codex's plugin system.

### Why this is wrong

Codex now has a first-class plugin system (`codex plugin marketplace add` + `.codex-plugin/plugin.json` manifest at plugin root + `.agents/plugins/marketplace.json` at marketplace root). Real-world examples in `~/.codex/plugins/cache/openai-curated/` (linear, gmail, google-calendar, slack, etc.) show the canonical layout: `<marketplace>/plugins/<plugin-name>/.codex-plugin/plugin.json` with payload (`skills/`, `hooks.json`, `.app.json`) inside the plugin folder. Codex's bundled `plugin-creator` skill at `~/.codex/skills/.system/plugin-creator/` ships a scaffold script that produces exactly this layout.

The symlink-into-`~/.agents/skills/` flow predates the plugin system. It mixes Obsidian Operator skills into a global skills directory shared with other tools, breaks Codex's expected install/upgrade/uninstall lifecycle, and bypasses the plugin manager's enable/disable UX. New Codex users encountering Obsidian Operator should not see a six-step manual install.

## Decisions

### D1. Canonical restructure (not root-as-plugin, not symlink hybrid)

**Decision**: Move plugin payload (`skills/`, `hooks/`, `.claude-plugin/plugin.json`) into `<repo>/plugins/obsidian-operator/`. Repo root becomes a marketplace container holding `.agents/plugins/marketplace.json` (Codex) and `.claude-plugin/marketplace.json` (Claude Code), both pointing at `./plugins/obsidian-operator/`. Note: `vault-template/` is not at repo root — it already lives at `skills/vault-init/assets/vault-template/`, so it moves transparently with `skills/`.

**Rejected alternatives**:

- **Root-as-plugin**: keep current layout, add `.codex-plugin/plugin.json` at repo root, marketplace `path: "."`. Cheaper but deviates from spec, untested whether Codex resolver accepts non-canonical `.` path.
- **Symlink hybrid**: `plugins/obsidian-operator/` contains symlinks back to root `skills/` etc. Looks canonical but breaks on Windows and confuses git.

### D2. Version bump to 2.0.0

**Decision**: Tag the restructure as v2.0.0 (not v1.10.0).

**Rationale**: Install layout changes are a SemVer-major signal. Existing Codex users following v1.9.1 INSTALL.md must clean up the stale `~/.agents/skills/obsidian-operator` symlink before adopting the new flow. A major bump communicates this clearly in release notes and version diffs.

### D3. Delete `.codex/INSTALL.md`, fold install into README

**Decision**: Remove `.codex/INSTALL.md` entirely. README's Quick Start gets a Codex install line parallel to the existing Claude Code line. `docs/README.codex.md` keeps Codex-specific deeper docs (e.g., `multi_agent` flag, Gmail connector recommendation) but loses the manual install steps.

**Rationale**: With the plugin system, install collapses to one line. A dedicated `INSTALL.md` for one line is overhead. Future Codex platform changes will be documented by Codex itself, not by every plugin author.

### D4. vault-init Step 7 = "just remind", symmetric for both platforms

**Decision**: vault-init detects platform (Codex vs Claude Code) and surfaces platform-specific reminders in the final summary. It does **not** edit `~/.codex/config.toml` or any platform config file. Both Gmail connector and `multi_agent` flag are reminder-only.

**Rejected alternatives**:

- **Auto-write `multi_agent` flag with confirm**: vault-init could append `[features] multi_agent = true` to `~/.codex/config.toml` after asking. Rejected because (a) the deep-research-enforce.sh hook already detects missing flag at runtime and emits a fallback notice, so pre-emptive write is convenience not necessity; (b) symmetry with Gmail handling (which is OS-level UI on Claude Code, plugin-manager-level on Codex — both out of vault-init's scope); (c) vault-init editing user-level platform config is a trust boundary that's better avoided.
- **Recommend third-party Gmail MCP** (Google Workspace MCP / Composio / Nylas): Rejected because Codex now ships an official Gmail connector (`gmail@openai-curated`). Recommending third-party MCPs is unnecessary indirection.

### D5. Manifest field set

**Decision**: `.codex-plugin/plugin.json` includes top-level identity fields, `skills`, `hooks`, and an `interface` block with `displayName`, `shortDescription`, `longDescription`, `developerName`, `category: "Productivity"`, `capabilities: ["Interactive", "Write"]`, `websiteURL`, and a 3-entry `defaultPrompt`. **Omit** `mcpServers`, `apps`, `privacyPolicyURL`, `termsOfServiceURL`, `brandColor`, `composerIcon`, `logo`, `screenshots`. Brand assets are deferred.

`.claude-plugin/plugin.json` keeps existing schema unchanged, only `version` bumps to 2.0.0.

### D6. Push-first, verify-after

**Decision**: Pre-push validation is limited to cheap mechanical checks (JSON syntax, file counts, hook smoke tests with synthetic stdin). Real install verification (`/plugin update` on Claude Code, `codex plugin marketplace add` on Codex, end-to-end skill smoke test in a fresh test vault) happens post-push, with `git revert` + tag rollback as the recovery path.

**Rationale**: Single-maintainer personal repo, no production users beyond the maintainer. Verification cost of a full pre-push install loop exceeds the recovery cost of a revert.

## Target file layout

```
<repo-root>/
├── .agents/
│   └── plugins/
│       └── marketplace.json          NEW — Codex marketplace
├── .claude-plugin/
│   └── marketplace.json              EDIT — source: "./plugins/obsidian-operator/", version 2.0.0
├── .codex/                           DELETE entirely
├── .github/                          UNCHANGED
├── .workspaces/                      UNCHANGED (gitignored)
├── docs/
│   ├── README.codex.md               EDIT — drop manual install + 3rd-party MCP, keep Codex-specific notes
│   ├── skill-style-guide.md          UNCHANGED
│   └── superpowers/specs/
│       └── 2026-05-03-codex-plugin-format-design.md   THIS FILE
├── plugins/
│   └── obsidian-operator/            NEW — plugin payload root
│       ├── .claude-plugin/
│       │   └── plugin.json           MOVED + version 2.0.0
│       ├── .codex-plugin/
│       │   └── plugin.json           NEW
│       ├── hooks/                    MOVED
│       │   ├── hooks.json            EDIT — fallback path
│       │   ├── preflight-enforce.sh  MOVED unchanged
│       │   └── deep-research-enforce.sh  MOVED unchanged
│       └── skills/                   MOVED — 20 skills (19 production + using-obsidian-operator)
│           ├── vault-init/
│           │   ├── SKILL.md          EDIT — assets cascade + Step 7 platform-aware reminder
│           │   └── assets/
│           │       ├── CLAUDE.md     MOVED unchanged
│           │       └── vault-template/   MOVED unchanged (lives inside vault-init's assets, not at repo root)
│           └── ... (19 others)       MOVED unchanged
├── README.md                         EDIT — Quick Start: drop INSTALL.md link, add stale symlink note
├── CLAUDE.md                         EDIT — Repo layout + version bump rule (4 paths)
├── CONTRIBUTING.md                   UNCHANGED
├── SECURITY.md                       UNCHANGED
├── CODE_OF_CONDUCT.md                UNCHANGED
└── LICENSE                           UNCHANGED
```

### Key path mappings

| Before | After |
|---|---|
| `skills/<name>/SKILL.md` | `plugins/obsidian-operator/skills/<name>/SKILL.md` |
| `hooks/hooks.json` | `plugins/obsidian-operator/hooks/hooks.json` |
| `hooks/preflight-enforce.sh` | `plugins/obsidian-operator/hooks/preflight-enforce.sh` |
| `hooks/deep-research-enforce.sh` | `plugins/obsidian-operator/hooks/deep-research-enforce.sh` |
| `skills/vault-init/assets/vault-template/` | `plugins/obsidian-operator/skills/vault-init/assets/vault-template/` (moves with `skills/`) |
| `.claude-plugin/plugin.json` (at root) | `plugins/obsidian-operator/.claude-plugin/plugin.json` |
| `.claude-plugin/marketplace.json` `source: "./"` | `.claude-plugin/marketplace.json` `source: "./plugins/obsidian-operator/"` |
| (no equivalent) | `.agents/plugins/marketplace.json` (Codex marketplace) |
| (no equivalent) | `plugins/obsidian-operator/.codex-plugin/plugin.json` |
| `.codex/INSTALL.md` | deleted |

## Manifest contents

### `plugins/obsidian-operator/.codex-plugin/plugin.json`

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

### `<repo>/.agents/plugins/marketplace.json`

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

### `<repo>/.claude-plugin/marketplace.json`

Edit the existing file: `plugins[0].source` from `"./"` → `"./plugins/obsidian-operator/"`, top-level `metadata.version` and `plugins[0].version` to `"2.0.0"`.

### `plugins/obsidian-operator/.claude-plugin/plugin.json`

Move the existing `.claude-plugin/plugin.json` from repo root to this path; bump `version` to `"2.0.0"`. No other content changes.

## Internal path updates

### A. `plugins/obsidian-operator/hooks/hooks.json`

Both hook entries currently use:

```bash
_R="${CLAUDE_PLUGIN_ROOT}"; [ -z "$_R" ] && _R="$HOME/.claude/plugins/marketplaces/yuhanwang14/obsidian-operator"; bash "$_R/hooks/<script>.sh"
```

`CLAUDE_PLUGIN_ROOT` is set by Claude Code to the plugin root (post-restructure: `<install>/plugins/obsidian-operator/`), so the happy path still resolves correctly. Update the fallback path to:

```bash
_R="${CLAUDE_PLUGIN_ROOT}"; [ -z "$_R" ] && _R="$HOME/.claude/plugins/marketplaces/yuhanwang14/obsidian-operator/plugins/obsidian-operator"; bash "$_R/hooks/<script>.sh"
```

### B. `plugins/obsidian-operator/skills/vault-init/SKILL.md` Step 1 assets cascade

Replace the existing 5-branch cascade with the post-restructure version:

```bash
# 1. $CLAUDE_PLUGIN_ROOT/skills/vault-init/assets
#    (Claude Code, $CLAUDE_PLUGIN_ROOT = .../plugins/obsidian-operator/)
[ -n "$CLAUDE_PLUGIN_ROOT" ] && echo "$CLAUDE_PLUGIN_ROOT/skills/vault-init/assets"

# 2. Claude Code plugin cache (versioned dir nests plugin path)
ls -d ~/.claude/plugins/cache/obsidian-operator/obsidian-operator/*/plugins/obsidian-operator/skills/vault-init/assets 2>/dev/null \
  | sort -V | tail -1

# 3. Claude Code marketplace checkout (flat, no version dir)
[ -d ~/.claude/plugins/marketplaces/obsidian-operator/plugins/obsidian-operator/skills/vault-init/assets ] \
  && echo ~/.claude/plugins/marketplaces/obsidian-operator/plugins/obsidian-operator/skills/vault-init/assets

# 4. Codex CLI plugin cache (mirror of openai-curated layout)
ls -d ~/.codex/plugins/cache/obsidian-operator/obsidian-operator/*/plugins/obsidian-operator/skills/vault-init/assets 2>/dev/null \
  | sort -V | tail -1
```

If none resolve, ask the user for the repo path and append `plugins/obsidian-operator/skills/vault-init/assets`. Drop the v1.9.x `~/.agents/skills/obsidian-operator` symlink fallback (no longer used).

### C. `plugins/obsidian-operator/skills/vault-init/SKILL.md` Step 6

`SCRIPT_SRC="${ASSETS%/vault-init/assets}/meeting/scripts/gemini-transcribe.sh"` is relative within the skills tree and remains correct after restructure. No edit.

### D. `plugins/obsidian-operator/skills/vault-init/SKILL.md` Step 7 — platform-aware reminders

Replace existing Step 7 ("Optional: mention Gmail MCP + Apple Calendar") with platform-detection-driven reminders:

```markdown
## Step 7 — Platform-specific reminders

Detect platform via env signal: if `$CODEX_HOME` is set → Codex CLI, otherwise → Claude Code. (Do not use "`~/.codex/` directory exists" as a signal — that resolves true on any machine where Codex was ever installed, even from a Claude Code session.)

Surface (do **not** auto-configure) the platform-relevant items in the final summary.

If Claude Code:
- Gmail: "Connect Google in Claude Code settings → MCP integrations"

If Codex CLI:
- Gmail: "Codex ships an official Gmail connector — enable `gmail@openai-curated` in Codex's plugin manager"
- /deep-research parallel agents: "Add `[features] multi_agent = true` to `~/.codex/config.toml` to enable parallel agent dispatch"

Both platforms:
- Apple Calendar / Reminders: /deadline-plan and /add-events use the names set in Step 5; no OS setup needed.
```

vault-init never writes `~/.codex/config.toml`. Missing `multi_agent` is caught at runtime by `deep-research-enforce.sh` injecting the documented fallback notice.

### E. `docs/README.codex.md`

Currently contains the manual install instructions and the three-way Gmail MCP recommendation. Rewrite to:

- Codex install: `codex plugin marketplace add yuhanwang14/obsidian-operator`, then enable in plugin manager.
- Gmail: use official `gmail@openai-curated` connector.
- /deep-research: add `[features] multi_agent = true` to `~/.codex/config.toml`.
- Drop all symlink, manual hooks.json, third-party MCP content.

### F. `README.md`

Quick Start section currently:

```
**Codex CLI**: clone + symlink + register hook. See `.codex/INSTALL.md`...
```

Rewrite to:

```
**Codex CLI**:
codex plugin marketplace add yuhanwang14/obsidian-operator
# then enable obsidian-operator in Codex's plugin manager
```

Add a one-line upgrade note for legacy v1.9.x Codex users:

```
> Upgrading from v1.9.x manual install? Remove the stale symlink first:
> rm ~/.agents/skills/obsidian-operator
```

### G. `CLAUDE.md`

Update two sections:

1. **Repo layout** — reflect `plugins/obsidian-operator/` nesting.
2. **"Bump the plugin version on every skill change"** — list four sync-required paths:
   - `plugins/obsidian-operator/.claude-plugin/plugin.json` `version`
   - `plugins/obsidian-operator/.codex-plugin/plugin.json` `version`
   - `.claude-plugin/marketplace.json` `metadata.version` and `plugins[0].version`
   - `.agents/plugins/marketplace.json` (no version field per spec, but plugin entry must stay in sync if other metadata drifts)

## Failure modes and rollback

| Risk | Trigger | Impact | Mitigation |
|---|---|---|---|
| Claude Code `/plugin update` cache stuck on old paths | Plugin name unchanged but source dir moved; some Claude Code versions may not refresh source resolution cleanly | Skill discovery temporarily broken | Post-push verify on a real CC client; if stuck, README upgrade note: `/plugin marketplace remove + add` |
| Codex `marketplace add yuhanwang14/obsidian-operator` fails | `.agents/plugins/marketplace.json` field error or Codex resolver requires marketplace at default branch root | User cannot install | Strict adherence to spec from `~/.codex/skills/.system/plugin-creator/references/plugin-json-spec.md`; modeled after openai-curated marketplace.json structure |
| Codex doesn't auto-load `hooks` field from plugin manifest | Codex hook system may differ from Claude Code's auto-registration | `/daily-init` and `/deep-research` lose harness-level enforcement on Codex | Post-push test with real Codex install; if not auto-loaded, README falls back to a one-line manual `~/.codex/hooks.json` snippet |
| vault-init asset cascade misses on a non-standard install | Cascade hits no path | Step 1 prompts user for repo path (existing behavior) | Last-resort fallback already exists |
| Stale `~/.agents/skills/obsidian-operator` symlink for v1.9.x users | They ran the old INSTALL.md flow, never cleaned up | Two skill-discovery sources for Codex (legacy symlink + new plugin), causing duplicate or shadowed skills | README upgrade note: `rm ~/.agents/skills/obsidian-operator` |
| Version mismatch across 4 manifest paths | Author edits one, forgets others | Marketplace shows old version | Version-sync rule documented in CLAUDE.md; future hook can validate at git-push time |

### Rollback path

1. `git revert <restructure-commit>` and push. Plugin name unchanged, so existing enable/disable config survives.
2. Re-tag previous as latest if needed.
3. Codex users on the new flow: `codex plugin marketplace remove obsidian-operator`; revert to v1.9.x manual install.

## Verification

### Pre-push (cheap)

1. `find plugins/obsidian-operator/skills -type d -mindepth 1 -maxdepth 1 | wc -l` → 21 (existing skills count).
2. `jq . plugins/obsidian-operator/.codex-plugin/plugin.json` exits 0.
3. `jq . plugins/obsidian-operator/.claude-plugin/plugin.json` exits 0.
4. `jq . .claude-plugin/marketplace.json` exits 0.
5. `jq . .agents/plugins/marketplace.json` exits 0.
6. `bash plugins/obsidian-operator/hooks/preflight-enforce.sh < /dev/null; echo $?` → 0.
7. `echo '{"hook_event_name":"UserPromptSubmit","prompt":"/deep-research test"}' | bash plugins/obsidian-operator/hooks/deep-research-enforce.sh | jq .hookSpecificOutput.hookEventName` → `"UserPromptSubmit"`.
8. `grep -r '2\.0\.0' plugins/obsidian-operator/.claude-plugin/plugin.json plugins/obsidian-operator/.codex-plugin/plugin.json .claude-plugin/marketplace.json` → all four matches.
9. `git diff --stat` reviewed manually for unintended changes.

### Post-push (real install)

In a fresh test vault:

10. **Claude Code**: `/plugin marketplace remove obsidian-operator && /plugin marketplace add github_url && /plugin install obsidian-operator`. Confirm 21 skills load via `/plugin`.
11. **Claude Code**: `/daily-init 6` boundary cascade fires (preflight-enforce.sh hook); `/deep-research "test"` injects deep-research-enforce.sh system-reminder.
12. **Codex CLI**: `codex plugin marketplace add file://<repo-root>` (local first, then GitHub source after push). Verify plugin appears in plugin manager. Verify hook registration if Codex auto-loads from manifest.
13. **/vault-init** in empty vault: 6 folders + CLAUDE.md + AGENTS.md installed; Customization table editable; Step 7 platform reminder appears.
14. **/project-init test-project** creates project structure.

If any post-push test fails, revert as above and diagnose.

## Open items deferred

- **Brand assets**: icon (`composerIcon`), logo (`logo`), screenshots — not blocking. Add when brand work happens.
- **Codex hook auto-loading**: empirically verify post-push whether Codex picks up `hooks` field from `.codex-plugin/plugin.json` automatically, or whether users still need to register in `~/.codex/hooks.json`. If the latter, README gets a one-line snippet.
- **`~/.agents/plugins/marketplace.json`** at home root: not used by this plugin. Some users may have one for unrelated local plugins; we don't touch it.
