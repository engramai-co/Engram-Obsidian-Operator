# Operator Home Manual

Operator Home is the Obsidian-native front door for Obsidian Operator. It keeps Markdown as the workspace, uses native Obsidian actions for fixed structure, and launches Codex or Claude only when a task needs agent reasoning.

## Interaction Model

- **Native actions** are fast, deterministic Obsidian operations: initialize the vault, capture a note, create a project scaffold, or open a key Markdown file.
- **Agent workflows** are one-click prompts with a Preview step: daily briefing, weekly review, project sync, deadline plan, meeting prep/processing, content drafting, and deep research.
- **CLI power path** remains available for multi-turn or open-ended work. Use Codex CLI or Claude Code directly, or use **More workflows -> Agent prompt / CLI command** inside Operator Home.

## Install

1. Install Obsidian desktop.
2. Install and log in to Codex CLI:

```bash
codex login
```

3. Copy the plugin release files into your vault:

```text
<your vault>/.obsidian/plugins/operator-control/
  manifest.json
  main.js
  styles.css
```

4. In Obsidian, enable **Community plugins**, then enable **Operator**.

## First Run

1. Open **Operator** from the left ribbon or command palette.
2. If setup is incomplete, click **Install Operator skills**.
3. Click **Initialize vault** to create the Operator folder structure and agent config files.
4. Click **New** under Active projects, then create your first project note.
5. Enter available hours and click **Start my day**. Review the Preview, then run it.

## Daily Use

- **Today** shows the current daily note's `## Focus`, `### Action Items`, `## Schedule`, and current weekly queue.
- **Quick Capture** appends ideas, tasks, meeting notes, or research questions to today's note without launching an agent.
- **Active projects** shows active project notes from `02_Projects/` and each note's `## Now` section.
- **Meetings** and **Waiting on** come from the current week's `Blockers.md`.
- **Last Run** shows the latest agent run summary and raw log when you need to debug.

## Projects

Use **New project** for the normal path. It creates:

```text
02_Projects/<Project>/<Project>.md
04_Knowledge/<Project>/
```

The project note includes frontmatter, a one-line description, `## Now`, `## Risks`, `## Knowledge Base`, and `## Weekly Progress`.

Use **Run /project-init** only when you want the legacy agent-guided project setup. This keeps the original skill available without making the daily UI depend on CLI interaction.

## Agent Workflows

Open **More workflows** for less frequent or reasoning-heavy work:

- **Weekly setup / Weekly review** for execution planning and synthesis.
- **Sync / Deadline plan** for project-level agent work.
- **Prep / Process meeting** for agendas, transcripts, decisions, and actions.
- **Extract ideas / Draft / Deep research** for content and research workflows.
- **Agent prompt / CLI command** for raw slash commands or freeform prompts.

Every agent workflow opens a Preview showing the exact prompt and likely read/write areas before launching Codex or Claude.

## Troubleshooting

- If buttons are disabled, open **Setup health** and check Codex, login, Operator skills, and vault setup.
- Gmail, Gemini, Calendar, and multi-agent support are optional. Missing optional integrations should not block basic daily workflows.
- If an agent run fails, open **Last Run -> Raw log** and rerun after fixing the setup issue.
- For open-ended debugging or multi-turn work, use Codex CLI or Claude Code directly from the vault.

## Safety

Operator launches Codex with `workspace-write` permissions in the current vault by default. It does not use full-disk or dangerous sandbox bypass settings by default. Native actions write only the specific Markdown files and folders needed for the selected action.
