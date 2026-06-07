import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatDashboardRunContext, formatRunContext, getDailyNotePath, getExecutionWeekFolder, getIsoWeekInfo, getLocalMinuteKey, getNextLocalMinuteDelayMs, getQuarterInfo, hasLocalDateChanged, hasLocalMinuteChanged } from "../src/dates";
import { appendQuickCapture, readOperatorHomeState, updateMarkdownTaskState } from "../src/home-state";
import { startAlignedMinuteRefresh } from "../src/clock-refresh";
import { buildCliHandoff } from "../src/cli-handoff";
import { buildProjectNote, createNativeProject, normalizeProjectName } from "../src/projects";
import { formatExpectedNoteStatus, formatRunCompletionNotice } from "../src/run-notices";
import { buildTodayScheduleLines } from "../src/today-surface";
import { parseActiveProjectNote, parseBlockers, parseDailyNote, parseWeeklyTodo } from "../src/vault-parsers";
import { buildAdvancedPromptPlaceholder, buildDefaultDailyPrompt, buildStrategyPeriodPlaceholder, buildStartDaySpec, buildWeeklyPeriodPlaceholder, buildWorkflowSpec, describePrompt, resolveAdvancedPrompt, resolveAnnualShortcutInput, resolveAnnualYearInput, resolveAvailableHoursInput, resolveEditedPreviewSpec, resolveQuarterlyPeriodInput, resolveWeeklyPeriodInput } from "../src/workflows";
import { DEFAULT_SETTINGS } from "../src/settings";

test("computes ISO week folders and daily note paths", () => {
  const date = new Date("2026-01-01T12:00:00");

  assert.deepEqual(getIsoWeekInfo(date), {
    isoYear: 2026,
    week: 1,
    label: "2026-W01",
  });
  assert.equal(getExecutionWeekFolder(date), "01_Execution/2026-W01");
  assert.equal(getDailyNotePath(date), "01_Execution/2026-W01/2026-01-01.md");
  assert.equal(hasLocalDateChanged("2026-05-22", new Date("2026-05-22T23:59:00")), false);
  assert.equal(hasLocalDateChanged("2026-05-22", new Date("2026-05-23T00:01:00")), true);
  assert.equal(getLocalMinuteKey(new Date("2026-05-22T09:15:30")), "2026-05-22T09:15");
  assert.equal(hasLocalMinuteChanged("2026-05-22T09:15", new Date("2026-05-22T09:15:59")), false);
  assert.equal(hasLocalMinuteChanged("2026-05-22T09:15", new Date("2026-05-22T09:16:00")), true);
  assert.equal(getNextLocalMinuteDelayMs(new Date("2026-05-22T09:15:00.000")), 60000);
  assert.equal(getNextLocalMinuteDelayMs(new Date("2026-05-22T09:15:45.250")), 14750);
});

test("clock refresh reschedules from the actual wake time", () => {
  let now = new Date("2026-05-22T09:15:45.250");
  let nextId = 1;
  const timers = new Map<number, () => void>();
  const delays: number[] = [];
  const cleared: number[] = [];
  let ticks = 0;

  const stop = startAlignedMinuteRefresh(() => {
    ticks += 1;
  }, {
    now: () => now,
    setTimeout: (callback, delay) => {
      const id = nextId++;
      timers.set(id, callback);
      delays.push(delay);
      return id;
    },
    clearTimeout: (id) => {
      cleared.push(id);
      timers.delete(id);
    },
  });

  assert.deepEqual(delays, [14750]);

  now = new Date("2026-05-22T09:16:04.100");
  timers.get(1)?.();

  assert.equal(ticks, 1);
  assert.deepEqual(delays, [14750, 55900]);

  stop();

  assert.deepEqual(cleared, [2]);
});

test("formats run completion notices with expected-note status", () => {
  assert.equal(
    formatRunCompletionNotice("success", "01_Execution/2026-W21/2026-05-22.md", true),
    "Operator run finished. Opened 01_Execution/2026-W21/2026-05-22.md.",
  );
  assert.equal(
    formatRunCompletionNotice("success", "01_Execution/2026-W21/2026-05-22.md", false),
    "Operator run finished. Expected note not found yet: 01_Execution/2026-W21/2026-05-22.md.",
  );
  assert.equal(formatRunCompletionNotice("failed"), "Operator run failed.");
  assert.equal(
    formatExpectedNoteStatus("01_Execution/2026-W21/2026-05-22.md", false, "success"),
    "Expected note missing: 01_Execution/2026-W21/2026-05-22.md",
  );
  assert.equal(
    formatExpectedNoteStatus("01_Execution/2026-W21/2026-05-22.md", true, "running"),
    "Expected note ready: 01_Execution/2026-W21/2026-05-22.md",
  );
  assert.equal(
    formatExpectedNoteStatus("01_Execution/2026-W21/2026-05-22.md", false, "running"),
    "Expected note pending: 01_Execution/2026-W21/2026-05-22.md",
  );
});

test("formats run context for agent prompts with local clock and planning period", () => {
  const date = new Date("2026-05-22T09:15:00");

  assert.deepEqual(getQuarterInfo(date), {
    year: 2026,
    quarter: 2,
    label: "2026-Q2",
  });
  assert.match(formatRunContext(date), /Local date: 2026-05-22/);
  assert.match(formatRunContext(date), /ISO week: 2026-W21/);
  assert.match(formatRunContext(date), /Quarter: 2026-Q2/);
  assert.match(formatDashboardRunContext(date), /^2026-05-22 09:15 .+ · 2026-W21 · 2026-Q2$/);
});

test("builds date-aware workflow input placeholders", () => {
  const date = new Date("2026-05-28T09:00:00");
  const source = readFileSync("src/main.ts", "utf8");

  assert.equal(buildWeeklyPeriodPlaceholder(date), "2026-W22; review accepts last");
  assert.equal(buildStrategyPeriodPlaceholder(date), "2026-Q2, 2026-05; blank pulse = 2026-04");
  assert.match(source, /const renderDate = new Date\(\);[\s\S]*readOperatorHomeState\(this\.app, renderDate\)/);
  assert.match(source, /formatDashboardRunContext\(renderDate\)/);
  assert.match(source, /this\.renderWorkflowShortcuts\(root, status, home, renderDate\)/);
  assert.doesNotMatch(source, /readOperatorHomeState\(this\.app\)/);
  assert.match(source, /const now = date;[\s\S]*buildWeeklyPeriodPlaceholder\(now\)/);
  assert.match(source, /buildStrategyPeriodPlaceholder\(now\)/);
  assert.match(source, /createInlineInput\(meeting, "Date", "YYYY-MM-DD", formatDateKey\(now\)\)/);
  assert.doesNotMatch(source, /createInlineInput\(meeting, "Date", "YYYY-MM-DD", formatDateKey\(new Date\(\)\)\)/);
  assert.doesNotMatch(source, /"2026-W21; review accepts last"/);
  assert.doesNotMatch(source, /"2026-Q2 or 2026-04"/);
});

test("workflow previews name exact daily and weekly write targets", () => {
  const date = new Date("2026-05-28T09:00:00");

  assert.deepEqual(buildStartDaySpec(6, "", date).writeAreas, [
    "Daily note: 01_Execution/2026-W22/2026-05-28.md",
    "Weekly Todo: 01_Execution/2026-W22/Weekly Todo.md",
    "Blockers: 01_Execution/2026-W22/Blockers.md",
    "Optional module outputs only when explicitly enabled or run from More workflows",
  ]);
  assert.deepEqual(buildWorkflowSpec("weekly-init", "", date).writeAreas, [
    "Weekly Todo: 01_Execution/2026-W22/Weekly Todo.md",
    "Blockers: 01_Execution/2026-W22/Blockers.md",
  ]);
  assert.deepEqual(buildWorkflowSpec("weekly-review", "last", date).writeAreas, [
    "Weekly Review: 01_Execution/2026-W21/Weekly Review.md",
  ]);
  assert.deepEqual(buildWorkflowSpec("ai-weekly-digest", "last", date).writeAreas, [
    "AI weekly digest: 04_Knowledge/AI-Weekly/2026-W21 - AI Weekly Digest.md",
    "Weekly Review block when present: 01_Execution/2026-W21/Weekly Review.md",
  ]);
});

test("advanced weekly prompts run with explicit resolved targets", () => {
  const date = new Date("2026-05-28T09:00:00");

  assert.match(describePrompt("/weekly-init", date).prompt, /^\/weekly-init 2026-W22\n\nOperator run metadata/);
  assert.match(describePrompt("/weekly-review", date).prompt, /^\/weekly-review 2026-W22\n\nOperator run metadata/);
  assert.match(describePrompt("/weekly-review last", date).prompt, /^\/weekly-review 2026-W21\n\nOperator run metadata/);
  assert.match(describePrompt("/ai-weekly-digest", date).prompt, /^\/ai-weekly-digest 2026-W22\n\nOperator run metadata/);
  assert.match(describePrompt("/ai-weekly-digest last", date).prompt, /^\/ai-weekly-digest 2026-W21\n\nOperator run metadata/);
});

test("strategy workflow previews label exact write targets", () => {
  const date = new Date("2026-05-22T09:00:00");

  assert.deepEqual(buildWorkflowSpec("annual-vision", "", date).writeAreas, [
    "Annual vision: 00_Strategy/2026 Vision.md",
  ]);
  assert.deepEqual(buildWorkflowSpec("annual-vision", "review", date).writeAreas, [
    "Annual review: 00_Strategy/2025 Annual Review.md",
  ]);
  assert.deepEqual(buildWorkflowSpec("quarterly-plan", "init", date).writeAreas, [
    "Quarterly plan: 00_Strategy/2026-Q2/Quarterly Plan.md",
  ]);
  assert.deepEqual(buildWorkflowSpec("quarterly-plan", "review", date).writeAreas, [
    "Quarterly review: 00_Strategy/2026-Q1/Quarterly Review.md",
  ]);
  assert.deepEqual(buildWorkflowSpec("quarterly-plan", "pulse", date).writeAreas, [
    "Monthly pulse: 00_Strategy/2026-Q2/Monthly Pulse - 04.md",
  ]);
});

test("advanced strategy prompts run with explicit resolved targets", () => {
  const date = new Date("2026-05-22T09:00:00");

  assert.match(describePrompt("/annual-vision", date).prompt, /^\/annual-vision 2026\n\nOperator run metadata/);
  assert.match(describePrompt("/annual-vision review", date).prompt, /^\/annual-vision review 2025\n\nOperator run metadata/);
  assert.match(describePrompt("/quarterly-plan init", date).prompt, /^\/quarterly-plan init 2026-Q2\n\nOperator run metadata/);
  assert.match(describePrompt("/quarterly-plan review", date).prompt, /^\/quarterly-plan review 2026-Q1\n\nOperator run metadata/);
  assert.match(describePrompt("/quarterly-plan pulse 05", date).prompt, /^\/quarterly-plan pulse 2026-05\n\nOperator run metadata/);
});

test("quarterly-plan skill documents explicit UI targets", () => {
  const skill = readFileSync("plugins/obsidian-operator/skills/quarterly-plan/SKILL.md", "utf8");

  assert.match(skill, /pulse \[YYYY-QX\|YYYY-MM\|MM\]/);
  assert.match(skill, /If it includes `pulse YYYY-QX`, target that quarter's final month/);
  assert.match(skill, /Pulse Mode[\s\S]*If the prompt includes `pulse YYYY-MM`/);
  assert.match(skill, /Init Mode[\s\S]*If the prompt includes `init YYYY-QX`/);
  assert.match(skill, /Review Mode[\s\S]*If the prompt includes `review YYYY-QX`/);
  assert.match(skill, /Auto-triggered by `\/daily-init` after a new quarter begins/);
  assert.doesNotMatch(skill, /first Monday of quarter/);
  assert.doesNotMatch(skill, /first Monday of new quarter/);
});

test("annual-vision skill documents explicit UI targets", () => {
  const skill = readFileSync("plugins/obsidian-operator/skills/annual-vision/SKILL.md", "utf8");

  assert.match(skill, /If the prompt includes `review`, use Review Mode/);
  assert.match(skill, /If the prompt includes `20\d{2}`, use that as the target year/);
  assert.match(skill, /In Review Mode without an explicit year, target the current year in December and the previous year otherwise/);
});

test("daily-init skill documents catch-up boundary triggers", () => {
  const skill = readFileSync("plugins/obsidian-operator/skills/daily-init/SKILL.md", "utf8");

  assert.match(skill, /catch-up runs later in the week are eligible/);
  assert.match(skill, /catch-up runs after the first day are eligible/);
  assert.doesNotMatch(skill, /using the path resolved from `obsidian daily:path`/);
  assert.match(skill, /open the computed daily note path in Obsidian/);
  assert.doesNotMatch(skill, /different ISO week[\s\S]*most recent daily note/);
});

test("daily-init keeps optional intelligence and content modules opt-in", () => {
  const skill = readFileSync("plugins/obsidian-operator/skills/daily-init/SKILL.md", "utf8");
  const hook = readFileSync("plugins/obsidian-operator/hooks/preflight-enforce.sh", "utf8");

  assert.match(skill, /Optional Modules/);
  assert.match(skill, /Manual items to consider today/);
  assert.match(skill, /Operator Preview may pass manual items as a separate block/);
  assert.match(skill, /Do not run these modules unless the user explicitly enabled or requested them/);
  assert.doesNotMatch(skill, /Then automatically run `\/daily-github`/);
  assert.doesNotMatch(skill, /After `\/daily-github` has run, automatically run `\/daily-academic`/);
  assert.doesNotMatch(skill, /After `\/daily-academic` has run, invoke `\/content-extract`/);
  assert.doesNotMatch(hook, /AI Weekly Digest/);
  assert.doesNotMatch(hook, /\/ai-weekly-digest/);
});

test("product docs keep first-run overview out of implementation internals", () => {
  const readme = readFileSync("README.md", "utf8");
  const manual = readFileSync("docs/operator-home-manual.md", "utf8");
  const releaseNotes = readFileSync("docs/release-v0.4.1.md", "utf8");

  assert.match(readme, /Obsidian-native daily home and AI concierge/);
  assert.doesNotMatch(readme, /^An AI-native personal operating system built on Obsidian/m);
  assert.doesNotMatch(readme, /\| \[Codex CLI\]\([^)]+\) \| Yes \|/);
  assert.match(readme, /\| \[Codex CLI\]\([^)]+\) \| Codex backend \|/);
  assert.match(readme, /For the default Codex backend, log in once:/);
  assert.match(readme, /\[v0\.4\.1 release notes and smoke checklist\]\(docs\/release-v0\.4\.1\.md\)/);
  assert.match(readme, /Release zip users do not need `npm install`, `npm run build`, or `npm run install:plugin`/);
  assert.match(readme, /Do not use GitHub's source code zip for this path/);
  assert.match(manual, /Release zip users do not need npm commands/);
  assert.match(manual, /Do not use GitHub's source code zip for this path/);
  const readmeFirstFlow = readme.slice(
    readme.indexOf("### 4. Run the first five-minute flow"),
    readme.indexOf("## Power User CLI Path"),
  );
  const manualFirstRun = manual.slice(
    manual.indexOf("## First Run"),
    manual.indexOf("## Daily Use"),
  );
  assert.ok(
    readmeFirstFlow.indexOf("Click **Initialize vault**") < readmeFirstFlow.indexOf("Install Codex skills"),
    "README first-run flow should initialize the vault before backend skill installation",
  );
  assert.ok(
    manualFirstRun.indexOf("Click **Initialize vault**") < manualFirstRun.indexOf("install skills"),
    "manual first-run flow should initialize the vault before backend skill installation",
  );
  assert.doesNotMatch(readme, /Operator launches Codex in the current vault/);
  assert.match(readme, /Operator launches the selected backend in the current vault/);
  assert.doesNotMatch(readme, /manifest\.json\s+main\.js\s+styles\.css/);
  assert.doesNotMatch(manual, /manifest\.json\s+main\.js\s+styles\.css/);
  assert.doesNotMatch(manual, /Operator launches Codex with `workspace-write` permissions/);
  assert.match(manual, /Operator launches the selected backend with vault-scoped write permissions/);
  assert.match(releaseNotes, /Download `operator-control-0\.4\.1\.zip`/);
  assert.match(releaseNotes, /Clean-vault smoke checklist/);
  assert.match(releaseNotes, /release zip users do not need npm commands/i);
  assert.match(releaseNotes, /Start my day Preview stays compact by default/);
  assert.match(releaseNotes, /Start my day unlocks with the selected backend/);
  assert.doesNotMatch(readme, /boundary cascade/i);
  assert.doesNotMatch(readme, /minute-aligned local clock context/i);
  assert.doesNotMatch(readme, /weekly shortcuts expose/i);
  assert.doesNotMatch(readme, /quarterly\/monthly shortcuts expose/i);
  assert.match(manual, /Advanced target resolution/);
});

test("runner consent uses calm vault-scoped language", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const readme = readFileSync("README.md", "utf8");
  const manual = readFileSync("docs/operator-home-manual.md", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");
  const checklist = readFileSync("docs/ux-review-checklist.md", "utf8");
  const consentSource = source.slice(
    source.indexOf("class RunnerConsentModal"),
    source.indexOf("class RunPreviewModal"),
  );

  assert.match(memory, /Runner consent should explain vault-scoped agent access without scary implementation terms/);
  assert.match(checklist, /First-run runner consent uses calm vault-scoped language/);
  assert.match(consentSource, /The agent can read and update files inside this vault while the run is active/);
  assert.match(consentSource, /Operator does not request access outside this vault by default/);
  assert.doesNotMatch(consentSource, /workspace-write/i);
  assert.doesNotMatch(consentSource, /dangerous sandbox bypass/i);
  assert.doesNotMatch(consentSource, /full-disk/i);
  assert.match(readme, /does not request access outside this vault by default/);
  assert.match(manual, /does not request access outside this vault by default/);
  assert.doesNotMatch(readme, /dangerous sandbox bypass/i);
  assert.doesNotMatch(manual, /dangerous sandbox bypass/i);
  assert.doesNotMatch(readme, /full-disk/i);
  assert.doesNotMatch(manual, /full-disk/i);
});

test("development memory docs preserve UX direction without tracking scratch", () => {
  const memory = readFileSync("docs/development-memory.md", "utf8");
  const checklist = readFileSync("docs/ux-review-checklist.md", "utf8");
  const review = readFileSync("docs/ux-product-review-2026-06-01.md", "utf8");
  const historicalBrief = readFileSync("docs/2026-05-29-productization-goal-brief.md", "utf8");
  const gitignore = readFileSync(".gitignore", "utf8");

  assert.match(memory, /two-layer memory model/i);
  assert.match(memory, /Stable product and UX decisions are tracked in git/);
  assert.match(memory, /Release zip users do not need npm commands/);
  assert.match(memory, /Core Default/);
  assert.match(memory, /Advanced But Product-Relevant/);
  assert.match(memory, /Optional Modules/);
  assert.match(memory, /Setup health should answer/);
  assert.match(memory, /First-run onboarding should show one current next step/);
  assert.match(memory, /Needed, locked, limited, and optional chips should have distinct subdued styles/);
  assert.match(memory, /\.workspaces\/ux-review\//);
  assert.match(checklist, /P0: blocks normal first-run use/);
  assert.match(checklist, /first-screen calmness/i);
  assert.match(checklist, /Setup health does not look scary/);
  assert.match(checklist, /Setup and onboarding chips visually distinguish needed, locked, limited, and optional states/);
  assert.match(checklist, /Preview is inspectable without being noisy/);
  assert.match(checklist, /mobile\/narrow-width text does not overflow/);
  assert.match(checklist, /Obsidian-native behavior stays primary/);
  assert.match(review, /Operator UX, UI, Product, And Feature Review/);
  assert.match(review, /Resolved P1 - More workflows is grouped by tier/);
  assert.match(review, /Resolved P1 - Setup health is selected-backend first/);
  assert.match(review, /Outstanding Evidence Gap - Rendered Obsidian Smoke/);
  assert.match(review, /static Playwright harness smoke/);
  assert.match(review, /narrow-pane flex-basis issues/);
  assert.doesNotMatch(review, /P1 - More workflows still reads like a workflow console when expanded/);
  assert.doesNotMatch(review, /P1 - Setup health still exposes too many backend and optional statuses at once/);
  assert.match(review, /Product Positioning Review/);
  assert.match(review, /Feature Review/);
  assert.match(review, /UI Surface Audit Matrix/);
  assert.match(review, /onboarding now shows one current next step/i);
  assert.match(review, /Implementation Backlog/);
  assert.match(review, /Backlog 1 - Group More workflows/);
  assert.match(review, /Backlog 2 - Reframe Setup health around selected backend/);
  assert.match(historicalBrief, /Historical context/);
  assert.match(historicalBrief, /docs\/development-memory\.md/);
  assert.match(gitignore, /docs\/plans\//);
  assert.match(gitignore, /docs\/specs\//);
  assert.match(gitignore, /docs\/superpowers\/plans\//);
  assert.match(gitignore, /docs\/superpowers\/specs\//);
  assert.match(gitignore, /\.workspaces\//);
  assert.match(gitignore, /\.playwright-cli\//);
  assert.match(memory, /\.playwright-cli\//);
  assert.doesNotMatch(gitignore, /docs\/development-memory\.md/);
  assert.doesNotMatch(gitignore, /docs\/ux-review-checklist\.md/);
});

test("operator manual keeps workflow guidance split by product tier", () => {
  const manual = readFileSync("docs/operator-home-manual.md", "utf8");
  const review = readFileSync("docs/ux-product-review-2026-06-01.md", "utf8");

  assert.match(manual, /^## Core Workflows$/m);
  assert.match(manual, /^## Optional Modules$/m);
  assert.match(manual, /^## Power User Workflows$/m);
  assert.match(manual, /^## Preview Behavior$/m);
  assert.match(manual, /^## Advanced target resolution$/m);
  assert.match(manual, /^## Troubleshooting$/m);
  assert.match(manual, /Core workflows live in \*\*More workflows\*\* because they are still agent runs/);
  assert.match(manual, /Optional modules are off for \*\*Start my day\*\* by default/);
  assert.match(manual, /Preview will list the enabled modules before you run/);
  assert.match(review, /### Resolved P2 - Manual workflow guidance is split by product tier/);
  assert.doesNotMatch(review, /### P2 - The manual's Agent Workflows section is accurate but dense/);
  assert.doesNotMatch(manual, /^## Agent Workflows$/m);
});

test("operator home keeps optional modules behind an explicit workflow group", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");

  assert.doesNotMatch(source, /boundary cascade/i);
  assert.doesNotMatch(source, /Start my day keeps weekly, monthly, and quarterly planning current when needed\./);
  assert.match(source, /const section = createSection\(root, "Today", ""\)/);
  assert.match(source, /section\.setAttr\("title", home\.daily\.exists \? "Current daily note state\." : "No daily note yet\."\)/);
  assert.match(source, /createWorkflowGroup\(section, "Plan"/);
  assert.match(source, /createWorkflowGroup\(section, "Projects & meetings"/);
  assert.match(source, /createWorkflowGroup\(section, "Strategy"/);
  assert.match(source, /const optionalSection = createWorkflowDisclosureGroup\(section, "Optional modules"/);
  assert.match(source, /const powerUser = createWorkflowDisclosureGroup\(section, "Power user"/);
  assert.match(source, /function createWorkflowDisclosureGroup/);
  assert.doesNotMatch(source, /const optionalSection = createDisclosureSection\(section, "Optional modules"/);
  assert.doesNotMatch(source, /optionalSection\.addClass\("operator-workflow-group"\)/);
  assert.match(source, /createWorkflowCard\(optionalModules, "Intelligence"/);
  assert.match(source, /createWorkflowCard\(optionalModules, "Content"/);
  assert.match(source, /createWorkflowCard\(optionalModules, "Calendar \/ events"/);
  assert.match(memory, /Power user raw prompt and CLI handoff should stay collapsed inside More workflows/);
  assert.doesNotMatch(source, /const grid = section\.createDiv\(\{ cls: "operator-workflow-grid" \}\);/);
});

test("workflow surfaces keep helper descriptions out of visible copy", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");
  const sectionHelper = source.slice(
    source.indexOf("function createSection"),
    source.indexOf("function createDisclosureSection"),
  );
  const disclosureHelper = source.slice(
    source.indexOf("function createDisclosureSection"),
    source.indexOf("function createWorkflowCard"),
  );
  const workflowCardHelper = source.slice(
    source.indexOf("function createWorkflowCard"),
    source.indexOf("function createWorkflowGroup"),
  );
  const workflowGroupHelper = source.slice(
    source.indexOf("function createWorkflowGroup"),
    source.indexOf("function createSetupStatusGroup"),
  );

  assert.match(memory, /Core section headers should avoid visible helper copy/);
  assert.match(sectionHelper, /section\.setAttr\("title", description\)/);
  assert.match(sectionHelper, /section\.setAttr\("aria-label", `\$\{title\}: \$\{description\}`\)/);
  assert.match(sectionHelper, /header\.setAttr\("title", description\)/);
  assert.doesNotMatch(sectionHelper, /header\.createEl\("p", \{ text: description \}\)/);
  assert.match(memory, /Workflow helper descriptions should live in title or aria metadata/);
  assert.match(disclosureHelper, /header\.setAttr\("title", description\)/);
  assert.match(disclosureHelper, /summary\.setAttr\("aria-label", `\$\{title\}: \$\{description\}`\)/);
  assert.doesNotMatch(disclosureHelper, /header\.createEl\("p", \{ text: description \}\)/);
  assert.match(workflowCardHelper, /card\.setAttr\("title", description\)/);
  assert.match(workflowCardHelper, /card\.setAttr\("aria-label", `\$\{title\}: \$\{description\}`\)/);
  assert.doesNotMatch(workflowCardHelper, /card\.createEl\("p", \{ cls: "operator-muted", text: description \}\)/);
  assert.match(workflowGroupHelper, /group\.setAttr\("title", description\)/);
  assert.match(workflowGroupHelper, /group\.setAttr\("aria-label", `\$\{title\}: \$\{description\}`\)/);
  assert.doesNotMatch(workflowGroupHelper, /header\.createEl\("p", \{ cls: "operator-muted", text: description \}\)/);
});

test("nested workflow disclosures avoid section card nesting", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");
  const nestedHelper = source.slice(
    source.indexOf("function createWorkflowDisclosureGroup"),
    source.indexOf("function createSetupStatusGroup"),
  );

  assert.match(memory, /Nested workflow disclosures should use workflow group styling/);
  assert.match(nestedHelper, /parent\.createEl\("details", \{ cls: "operator-workflow-group operator-workflow-disclosure" \}\)/);
  assert.match(nestedHelper, /summary\.setAttr\("aria-label", `\$\{title\}: \$\{description\}`\)/);
  assert.match(nestedHelper, /header\.createEl\("h4", \{ text: title \}\)/);
  assert.doesNotMatch(nestedHelper, /operator-section/);
  assert.match(css, /\.operator-workflow-disclosure summary/);
});

test("onboarding shows one next step before detailed setup checklist", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");
  const checklist = readFileSync("docs/ux-review-checklist.md", "utf8");
  const review = readFileSync("docs/ux-product-review-2026-06-01.md", "utf8");
  const onboardingSource = source.slice(
    source.indexOf("private renderOnboarding"),
    source.indexOf("private renderSetup"),
  );
  const nextStepSource = source.slice(
    source.indexOf("function getOnboardingNextStep"),
    source.indexOf("function renderChecklistItem"),
  );

  assert.match(source, /createSection\(root, "Get started", "One step at a time\."\)/);
  assert.match(source, /const nextStep = getOnboardingNextStep\(status, backend\)/);
  assert.match(source, /section\.createDiv\(\{ cls: `operator-next-step is-\$\{nextStep\.state\}` \}\)/);
  assert.match(onboardingSource, /this\.renderOnboardingNextAction\(next, nextStep\.action, status, backend\)/);
  assert.doesNotMatch(onboardingSource, /this\.renderSetupControls\(section, status\)/);
  assert.match(source, /createEl\("details", \{ cls: "operator-onboarding-checklist" \}\)/);
  assert.match(source, /checklist\.createEl\("summary", \{ text: "Setup checklist" \}\)/);
  assert.match(source, /function getOnboardingNextStep/);
  assert.match(memory, /Onboarding should not repeat setup-helper copy after the current next step/);
  assert.match(memory, /First-run onboarding should prioritize native vault initialization before backend skill installation/);
  assert.match(memory, /First-run next-step cards should show at most one current action/);
  assert.match(checklist, /First-run onboarding shows one current action, not a duplicated setup control row/);
  assert.match(checklist, /First-run onboarding prioritizes native vault initialization before agent skill setup/);
  assert.match(review, /single actionable next-step button/i);
  assert.ok(
    nextStepSource.indexOf("if (!status.vault.ready)") < nextStepSource.indexOf("if (!backendSkillsReady)"),
    "vault initialization should be the first onboarding next-step gate",
  );
  assert.ok(
    onboardingSource.indexOf('"Initialize vault"') < onboardingSource.indexOf("`Install ${backendLabel} skills`"),
    "vault initialization should also lead the expanded onboarding checklist",
  );
  assert.doesNotMatch(source, /Setup health below shows the exact missing piece/);
  assert.doesNotMatch(source, /section\.createDiv\(\{ cls: "operator-onboarding-grid" \}\)/);
  assert.match(css, /\.operator-next-step/);
  assert.match(css, /\.operator-next-step-actions/);
  assert.match(css, /\.operator-onboarding-checklist/);
  assert.match(css, /\.operator-chip\.is-needed/);
  assert.match(css, /\.operator-chip\.is-locked/);
  assert.match(css, /\.operator-chip\.is-limited/);
  assert.doesNotMatch(css, /\.operator-onboarding-grid/);
});

test("setup health prioritizes selected backend and keeps optional checks advanced", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");
  const setupGroupHelper = source.slice(
    source.indexOf("function createSetupStatusGroup"),
    source.indexOf("function createInlineInput"),
  );

  assert.match(source, /createDisclosureSection\(root, "Setup health", "Selected backend first; optional checks stay advanced\."\)/);
  assert.match(source, /const selectedBackend = this\.plugin\.settings\.backend/);
  assert.match(source, /const primary = createSetupStatusGroup\(section, `\$\{backendLabel\} readiness`/);
  assert.match(source, /const advanced = section\.createEl\("details", \{ cls: "operator-setup-advanced" \}\)/);
  assert.match(source, /advanced\.createEl\("summary", \{ text: "Optional and alternate checks" \}\)/);
  assert.match(source, /advanced\.setAttr\("title", "Useful when switching backends or enabling optional modules; these do not block the selected daily flow\."\)/);
  assert.match(source, /setupAdvancedSummary\.setAttr\("aria-label", "Optional and alternate checks: useful when switching backends or enabling optional modules"\)/);
  assert.doesNotMatch(source, /advanced\.createEl\("p", \{\s*cls: "operator-muted",\s*text: "Useful when switching backends or enabling optional modules; these do not block the selected daily flow\.",\s*\}\)/);
  assert.match(source, /createSetupStatusGroup\(advanced, "Alternate backend"/);
  assert.match(source, /createSetupStatusGroup\(advanced, "Optional integrations"/);
  assert.match(source, /renderStatusTile\(optionalGrid, "Gmail"/);
  assert.doesNotMatch(source, /renderStatusTile\(grid, "Gmail"/);
  assert.match(memory, /Setup health group descriptions should live in title or aria metadata/);
  assert.match(setupGroupHelper, /group\.setAttr\("title", description\)/);
  assert.match(setupGroupHelper, /group\.setAttr\("aria-label", `\$\{title\}: \$\{description\}`\)/);
  assert.match(setupGroupHelper, /header\.setAttr\("title", description\)/);
  assert.doesNotMatch(setupGroupHelper, /header\.createEl\("p", \{ cls: "operator-muted", text: description \}\)/);
});

test("responsive CSS protects narrow Obsidian panes from overflowing text", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");

  assert.match(memory, /Button labels should wrap cleanly in narrow Obsidian panes/);
  assert.match(memory, /Form controls should shrink within workflow cards and modals instead of widening the pane/);
  assert.match(memory, /Panel title rows should wrap when titles and actions compete for narrow pane width/);
  assert.match(memory, /Status tile titles should wrap labels and chips instead of forcing horizontal overflow/);
  assert.match(memory, /Dashboard header copy and actions should wrap before they make the first screen feel cramped/);
  assert.match(memory, /Preview advanced detail grids should not use fixed minimum columns that can widen narrow modals/);
  assert.match(memory, /Expanded Last Run prompt and raw log should wrap or scroll inside the dashboard without widening the pane/);
  assert.match(source, /const titleWrap = header\.createDiv\(\{ cls: "operator-hero-copy" \}\)/);
  assert.match(css, /grid-template-columns: repeat\(auto-fit, minmax\(min\(220px, 100%\), 1fr\)\)/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /\.operator-hero \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.operator-hero-copy \{[^}]*flex: 1 1 220px[^}]*min-width: 0/);
  assert.match(css, /\.operator-hero-copy h2,\s*\.operator-clock-meta \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.operator-hero-actions \{[^}]*flex: 0 1 auto[^}]*min-width: 0/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.operator-hero-copy \{[\s\S]*flex: 0 1 auto[\s\S]*width: 100%/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.operator-hero-actions \{[\s\S]*width: 100%/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.operator-grow \{[\s\S]*flex: 0 1 auto[\s\S]*width: 100%/);
  assert.match(css, /\.operator-advanced-list \{[^}]*grid-template-columns: repeat\(auto-fit, minmax\(min\(180px, 100%\), 1fr\)\)/);
  assert.match(css, /\.operator-button \{[\s\S]*max-width: 100%[\s\S]*min-width: 0[\s\S]*white-space: normal/);
  assert.match(css, /\.operator-button span:not\(\.operator-button-icon\) \{[\s\S]*min-width: 0[\s\S]*overflow-wrap: anywhere/);
  assert.match(css, /\.operator-field input,[\s\S]*\.operator-select \{[\s\S]*max-width: 100%[\s\S]*min-width: 0[\s\S]*width: 100%/);
  assert.match(css, /\.operator-panel-title-row \{[\s\S]*flex-wrap: wrap/);
  assert.match(css, /\.operator-panel-title-row h4 \{[\s\S]*min-width: 0[\s\S]*overflow-wrap: anywhere/);
  assert.match(css, /\.operator-status-title \{[\s\S]*flex-wrap: wrap/);
  assert.match(css, /\.operator-status-title span:first-child \{[\s\S]*min-width: 0[\s\S]*overflow-wrap: anywhere/);
  assert.match(css, /\.operator-status-title \.operator-chip \{[\s\S]*flex: 0 0 auto/);
  assert.match(css, /\.operator-run-prompt \{[^}]*max-width: 100%[^}]*min-width: 0[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.operator-log \{[^}]*max-width: 100%[^}]*min-width: 0[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.operator-workflow-group/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /\.operator-command-strip[\s\S]*align-items: stretch/);
  assert.match(css, /\.operator-command-strip > \.operator-button[\s\S]*justify-content: center/);
});

test("optional modules are persisted settings and default off for Start my day", () => {
  const source = readFileSync("src/main.ts", "utf8");

  assert.deepEqual(DEFAULT_SETTINGS.optionalModules, {
    intelligence: false,
    academic: false,
    content: false,
    calendarEvents: false,
  });
  assert.match(source, /setName\("Optional modules"\)/);
  assert.match(source, /Daily start only runs these modules when you enable them here/);
  assert.match(source, /plugin\.settings\.optionalModules/);
  assert.match(source, /buildStartDaySpec\(safeHours, manualItems, new Date\(\), this\.settings\.optionalModules\)/);
});

test("parses active project notes from frontmatter and ## Now", () => {
  const project = parseActiveProjectNote(
    "02_Projects/FM-Copilot/FM-Copilot.md",
    `---
type: project
status: active
project: FM-Copilot
---

# FM-Copilot

## Now

- [ ] Ship Operator Home
- [x] Completed launch checklist
- [-] Dropped old direction
- Validate against a real vault

## Risks

- Scope creep
`,
  );

  assert.deepEqual(project, {
    name: "FM-Copilot",
    notePath: "02_Projects/FM-Copilot/FM-Copilot.md",
    nextActions: ["Ship Operator Home", "Validate against a real vault"],
  });

  assert.equal(parseActiveProjectNote("02_Projects/Paused/Paused.md", "---\nstatus: paused\n---\n",), null);
});

test("parses waiting-on items and meeting timing from Blockers", () => {
  const summary = parseBlockers(
    `# Blockers

## Waiting On

- [ ] Alice: Send launch notes - [[FM-Copilot]]
- [x] Bob: Delivered transcript

## Meetings

- [ ] **Fri May 22, 2 PM** FM-Copilot sync
  - Review launch notes
- [ ] **Sat May 23, 10 AM** Research review
- [-] **Sun May 24, 9 AM** Cancelled call
`,
    new Date("2026-05-22T09:00:00"),
    ["FM-Copilot"],
  );

  assert.deepEqual(summary.waitingOn.map((item) => item.text), [
    "Alice: Send launch notes - FM-Copilot",
  ]);
  assert.equal(summary.meetings.length, 2);
  assert.equal(summary.meetings[0].timing, "today");
  assert.equal(summary.meetings[0].dateIso, "2026-05-22");
  assert.equal(summary.meetings[0].project, "FM-Copilot");
  assert.equal(summary.meetings[1].timing, "tomorrow");
});

test("combines daily schedule lines with today's blocker meetings", () => {
  const blockers = parseBlockers(
    `# Blockers

## Meetings

- [ ] **Fri May 22, 2 PM** FM-Copilot sync
- [ ] **Fri May 22, 4 PM** Design review
- [ ] **Sat May 23, 10 AM** Research review
`,
    new Date("2026-05-22T09:00:00"),
    ["FM-Copilot"],
  );

  assert.deepEqual(buildTodayScheduleLines(["10:00 Design review"], blockers.meetings), [
    "10:00 Design review",
    "2026-05-22 - Fri May 22, 2 PM FM-Copilot sync",
  ]);
});

test("parses today note focus, actions, schedule, and capture count", () => {
  const summary = parseDailyNote(`# 2026-05-22

## Focus

- Ship the native Operator Home
- Keep the daily surface simple

## Briefing

### Action Items

- [ ] Review UI against real vault
- [>] Carry project note edits
- [x] Done item

## Schedule

- 10:00 Design review
- [ ] 11:00 Ship check
- [x] 12:00 Completed sync
- [-] 13:00 Cancelled hold

## Capture

- Idea: make CLI advanced-only
`);

  assert.deepEqual(summary.focus, [
    "Ship the native Operator Home",
    "Keep the daily surface simple",
  ]);
  assert.deepEqual(summary.tasks.map((item) => item.text), ["Review UI against real vault"]);
  assert.deepEqual(summary.carriedForward.map((item) => item.text), ["Carry project note edits"]);
  assert.deepEqual(summary.schedule, ["10:00 Design review", "11:00 Ship check"]);
  assert.equal(summary.captureCount, 1);
});

test("does not surface deferred future daily items as today's next actions", () => {
  const summary = parseDailyNote(`# 2026-05-22

## Briefing

### Action Items

- [ ] Review UI against real vault
- [>] Carry project note edits

#### Deferred

- [>] Submit tax paperwork -> 2026-06-01
- [>] Book dentist -> next Friday
`);

  assert.deepEqual(summary.tasks.map((item) => item.text), ["Review UI against real vault"]);
  assert.deepEqual(summary.carriedForward.map((item) => item.text), ["Carry project note edits"]);
});

test("surfaces captured task checkboxes as today's next actions", () => {
  const summary = parseDailyNote(`# 2026-05-22

## Capture

- Idea: Keep CLI available for advanced prompts
- [ ] Reply to Alice about the timeline
- [>] Carry captured budget review
- Meeting note: Standup was moved to 2pm
`);

  assert.deepEqual(summary.tasks.map((item) => item.text), ["Reply to Alice about the timeline"]);
  assert.deepEqual(summary.carriedForward.map((item) => item.text), ["Carry captured budget review"]);
  assert.equal(summary.captureCount, 4);
});

test("parses weekly todo open work separately from completed work", () => {
  const summary = parseWeeklyTodo(`# Weekly Todo

- [ ] Native project creation
- [>] Carry dashboard polish
- [x] Old complete task
`);

  assert.deepEqual(summary.openTasks.map((item) => item.text), ["Native project creation"]);
  assert.deepEqual(summary.carriedForward.map((item) => item.text), ["Carry dashboard polish"]);
});

test("builds native project notes with normalized paths and placeholders", () => {
  const date = new Date("2026-05-22T09:00:00");
  assert.equal(normalizeProjectName("Customer Discovery / MVP"), "Customer-Discovery-MVP");

  const note = buildProjectNote("Customer-Discovery-MVP", {
    name: "Customer Discovery / MVP",
    category: "startup",
    description: "A lightweight validation sprint.",
    now: "Interview five users\nDraft landing page",
    risks: "",
  }, date);

  assert.match(note, /status: active/);
  assert.match(note, /date: 2026-05-22/);
  assert.match(note, /project: Customer-Discovery-MVP/);
  assert.match(note, /- Interview five users/);
  assert.match(note, /- \(none identified yet\)/);
});

test("project creation modal keeps implementation-path copy out of visible text", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const checklist = readFileSync("docs/ux-review-checklist.md", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");
  const modalSource = source.slice(
    source.indexOf("class NativeProjectModal"),
    source.indexOf("function createSection"),
  );

  assert.match(memory, /Modal helper descriptions should live in title or aria metadata/);
  assert.match(memory, /Native project modal path previews should show a short note label while keeping the full project path in title or data metadata/);
  assert.match(checklist, /Native project path previews stay compact while full paths remain inspectable/);
  assert.match(modalSource, /const title = contentEl\.createEl\("h2", \{ text: "Create project" \}\)/);
  assert.match(modalSource, /title\.setAttr\("title", "Native project setup; Run \/project-init remains in More workflows\."\)/);
  assert.match(modalSource, /contentEl\.setAttr\("aria-label", "Create project: native Markdown project setup"\)/);
  assert.match(modalSource, /pathPreview\.setAttr\("data-project-note-path", fullProjectPath\)/);
  assert.match(modalSource, /pathPreview\.setAttr\("title", fullProjectPath\)/);
  assert.match(modalSource, /formatProjectPathPreview\(normalized\)/);
  assert.doesNotMatch(modalSource, /contentEl\.createEl\("p", \{\s*cls: "operator-muted",\s*text: "This native fast path/);
  assert.doesNotMatch(modalSource, /`Will create 02_Projects\/\$\{normalized\}\/\$\{normalized\}\.md`/);
});

test("native project creation and quick capture update the markdown home state", async () => {
  const app = createFakeApp();
  const date = new Date("2026-05-22T09:00:00");

  const project = await createNativeProject(app as never, {
    name: "Customer Discovery",
    category: "startup",
    description: "A lightweight validation sprint.",
    now: "Interview five users",
    risks: "",
  }, date);
  assert.equal(project.notePath, "02_Projects/Customer-Discovery/Customer-Discovery.md");

  await appendQuickCapture(app as never, "task", "Review interview notes\nSend follow-up", date);
  const home = await readOperatorHomeState(app as never, date);
  const dailyFile = app.vault.getAbstractFileByPath("01_Execution/2026-W21/2026-05-22.md");
  const dailyMarkdown = await app.vault.read(dailyFile as { path: string });

  assert.equal(home.daily.exists, true);
  assert.equal(home.blockersExists, false);
  assert.equal(home.daily.captureCount, 2);
  assert.match(dailyMarkdown, /- \[ \] Review interview notes\n- \[ \] Send follow-up/);
  assert.deepEqual(home.activeProjects.map((item) => item.name), ["Customer-Discovery"]);
  assert.deepEqual(home.activeProjects[0].nextActions, ["Interview five users"]);
});

test("reads blocker note existence for disabled open affordances", async () => {
  const app = createFakeApp();
  const date = new Date("2026-05-22T09:00:00");
  const source = readFileSync("src/main.ts", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");
  const checklist = readFileSync("docs/ux-review-checklist.md", "utf8");

  assert.equal((await readOperatorHomeState(app as never, date)).blockersExists, false);
  assert.match(memory, /Disabled native open buttons should explain missing Markdown files in title and aria metadata/);
  assert.match(checklist, /Disabled native open buttons explain which Markdown file is missing/);
  assert.match(source, /formatNativeOpenHelp\(home\.daily\.exists, "Open today", "Today's note has not been created yet\."\)/);
  assert.match(source, /formatNativeOpenHelp\(home\.weeklyTodo\.exists, "Open week", "Weekly Todo has not been created yet\."\)/);
  assert.match(source, /formatNativeOpenHelp\(home\.blockersExists, "Open blockers", "Blockers note has not been created yet\."\)/);
  assert.doesNotMatch(source, /"Open today"[\s\S]*undefined,\s*!home\.daily\.exists\)/);
  assert.doesNotMatch(source, /"Open week"[\s\S]*undefined,\s*!home\.weeklyTodo\.exists\)/);

  await app.vault.create("01_Execution/2026-W21/Blockers.md", "# Blockers\n");

  assert.equal((await readOperatorHomeState(app as never, date)).blockersExists, true);
});

test("updates markdown task state in the source note", async () => {
  const app = createFakeApp();
  await app.vault.create("01_Execution/2026-W21/Weekly Todo.md", [
    "# Weekly Todo",
    "",
    "- [ ] Ship UX review",
    "- [>] Carry research",
  ].join("\n"));

  await updateMarkdownTaskState(app as never, "01_Execution/2026-W21/Weekly Todo.md", "- [ ] Ship UX review", "x");
  await updateMarkdownTaskState(app as never, "01_Execution/2026-W21/Weekly Todo.md", "- [>] Carry research", " ");

  const file = app.vault.getAbstractFileByPath("01_Execution/2026-W21/Weekly Todo.md");
  const markdown = await app.vault.read(file as { path: string });

  assert.match(markdown, /- \[x\] Ship UX review/);
  assert.match(markdown, /- \[ \] Carry research/);
});

test("updates blocker waiting-on and meeting checkbox state", async () => {
  const app = createFakeApp();
  await app.vault.create("01_Execution/2026-W21/Blockers.md", [
    "# Blockers",
    "",
    "## Waiting On",
    "",
    "- [ ] Alice: Send launch notes",
    "",
    "## Meetings",
    "",
    "- [ ] **Fri May 22, 2 PM** FM-Copilot sync",
  ].join("\n"));

  const file = app.vault.getAbstractFileByPath("01_Execution/2026-W21/Blockers.md");
  const blockers = parseBlockers(await app.vault.read(file as { path: string }), new Date("2026-05-22T09:00:00"), ["FM-Copilot"]);

  await updateMarkdownTaskState(app as never, "01_Execution/2026-W21/Blockers.md", blockers.waitingOn[0].raw, "x");
  await updateMarkdownTaskState(app as never, "01_Execution/2026-W21/Blockers.md", blockers.meetings[0].raw, "x");

  const markdown = await app.vault.read(file as { path: string });
  assert.match(markdown, /- \[x\] Alice: Send launch notes/);
  assert.match(markdown, /- \[x\] \*\*Fri May 22, 2 PM\*\* FM-Copilot sync/);
});

test("dashboard wires blocker rows to native done actions", () => {
  const source = readFileSync("src/main.ts", "utf8");

  assert.match(source, /updateTaskFromUi\(home\.blockersPath, meeting, "x"\)/);
  assert.match(source, /updateTaskFromUi\(home\.blockersPath, item, "x"\)/);
  assert.match(source, /"Open blockers"[\s\S]*!home\.blockersExists,\s*formatNativeOpenHelp\(home\.blockersExists, "Open blockers", "Blockers note has not been created yet\."\)/);
  assert.doesNotMatch(source, /"Open blockers"[\s\S]*undefined,\s*!home\.blockersExists\)/);
});

test("today next actions exclude carried-forward daily items", () => {
  const source = readFileSync("src/main.ts", "utf8");

  assert.match(source, /const actions = home\.daily\.tasks\.slice\(0, 8\)/);
  assert.doesNotMatch(source, /\.\.\.home\.daily\.carriedForward/);
});

test("current work agent shortcuts use workflow disabled state", () => {
  const source = readFileSync("src/main.ts", "utf8");

  assert.match(source, /this\.renderHomePanels\(root, status, home\)/);
  assert.match(source, /private renderHomePanels\(root: HTMLElement, status: OperatorEnvironmentStatus, home: OperatorHomeState\)/);
  assert.match(source, /const canRun = this\.canRun\(status\)/);
  assert.match(source, /const lockHelp = canRun[\s\S]*formatWorkflowUnavailableHelp\(status, this\.plugin\.settings\.backend, "Current Work", !!this\.plugin\.activeRun\)/);
  assert.match(source, /"Sync"[\s\S]*!canRun, lockHelp/);
  assert.match(source, /"Prep"[\s\S]*!canRun, lockHelp/);
});

test("current work project rows keep next actions scannable", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const checklist = readFileSync("docs/ux-review-checklist.md", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");

  assert.match(memory, /Project row empty states should use user-facing next-action language and keep Markdown section names in metadata or docs/);
  assert.match(checklist, /Project row empty states avoid Markdown headings like ## Now/);
  assert.match(source, /const visibleActions = project\.nextActions\.slice\(0, 2\)/);
  assert.match(source, /createEl\("ul", \{ cls: "operator-project-actions" \}\)/);
  assert.match(source, /formatHiddenProjectActionCount\(project\.nextActions\.length, visibleActions\.length\)/);
  assert.match(source, /moreActions\.setAttr\("title", "Open project for more actions\."\)/);
  assert.match(source, /No next actions yet\./);
  assert.doesNotMatch(source, /No ## Now items yet\./);
  assert.doesNotMatch(source, /item\.createEl\("p", \{ cls: "operator-muted", text: "Open project for more actions\." \}\)/);
  assert.doesNotMatch(source, /project\.nextActions\.join\(" "\)/);
});

test("dashboard empty states stay concise and avoid implementation-source copy", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");

  assert.match(memory, /Empty states should be short and plain/);
  assert.match(memory, /Core section headers should avoid visible helper copy/);
  assert.match(source, /"No active projects yet\."/);
  assert.match(source, /"No upcoming meetings\."/);
  assert.match(source, /"Nothing waiting\."/);
  assert.match(source, /"No next actions yet\."/);
  assert.match(source, /"No focus yet\."/);
  assert.match(source, /"No open tasks yet\."/);
  assert.match(source, /"No schedule yet\."/);
  assert.match(source, /"Capture without starting an agent run\."/);
  assert.doesNotMatch(source, /No ## Now items yet\./);
  assert.doesNotMatch(source, /No active project notes found/);
  assert.doesNotMatch(source, /No upcoming unchecked meetings found in this week's Blockers\.md/);
  assert.doesNotMatch(source, /No unchecked Waiting On items in this week's Blockers\.md/);
  assert.doesNotMatch(source, /Start my day will write today's focus/);
  assert.doesNotMatch(source, /No schedule lines or meetings for today/);
  assert.doesNotMatch(source, /Append lightweight inputs to today's note without starting an agent run/);
  assert.doesNotMatch(source, /createSection\(root, "Today", home\.daily\.exists[\s\S]*Current daily note state/);
});

test("dashboard header keeps long note paths out of visible clock copy", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");

  assert.match(memory, /Dashboard header should show date, time, week, and quarter without full note paths/);
  assert.match(source, /text: status\.vault\.ready\s*\? formatDashboardRunContext\(renderDate\)/);
  assert.match(source, /headerMeta\.setAttr\("data-daily-note-path", home\.dailyNotePath\)/);
  assert.match(source, /headerMeta\.setAttr\("title", home\.dailyNotePath\)/);
  assert.match(source, /headerMeta\.setText\(formatDashboardRunContext\(date\)\)/);
  assert.doesNotMatch(source, /\$\{formatDashboardRunContext\(renderDate\)\} · \$\{home\.dailyNotePath\}/);
  assert.doesNotMatch(source, /\$\{formatDashboardRunContext\(date\)\} · \$\{dailyNotePath\}/);
});

test("preview copy uses the same resolved prompt as run", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");
  const checklist = readFileSync("docs/ux-review-checklist.md", "utf8");
  const previewModalSource = source.slice(
    source.indexOf("class RunPreviewModal"),
    source.indexOf("class NativeProjectModal"),
  );

  assert.match(memory, /Preview should keep full vault paths in title or data metadata rather than visible default copy/);
  assert.match(memory, /Compact Start my day Preview should keep full expected note paths in title or data metadata while showing a short expected-note label/);
  assert.match(memory, /Preview and project modals should stay within the Obsidian viewport and scroll internally/);
  assert.match(memory, /Modal paths and metadata chips should wrap instead of widening the modal/);
  assert.match(memory, /Preview helper descriptions should live in title or aria metadata instead of visible intro paragraphs/);
  assert.match(checklist, /Full vault paths stay out of visible Preview metadata/);
  assert.match(checklist, /Compact Preview expected note labels stay short while full paths remain inspectable/);
  assert.match(checklist, /Preview helper copy does not add visible intro paragraphs/);
  assert.match(checklist, /Preview modals stay within the viewport and scroll internally/);
  assert.match(css, /\.operator-control,\s*\.operator-preview-modal,\s*\.operator-project-modal,\s*\.operator-consent-modal \{[\s\S]*--operator-border: var\(--background-modifier-border\)[\s\S]*--operator-ok: var\(--color-green\)[\s\S]*--operator-warn: var\(--color-yellow\)[\s\S]*--operator-bad: var\(--color-red\)/);
  assert.match(css, /\.operator-preview-modal,\s*\.operator-project-modal,\s*\.operator-consent-modal \{[\s\S]*max-height: min\(82vh, 720px\)[\s\S]*overflow: auto/);
  assert.match(css, /\.operator-preview-modal,[\s\S]*\.operator-consent-modal \{[\s\S]*overflow-wrap: anywhere/);
  assert.match(css, /\.operator-preview-meta span \{[\s\S]*max-width: 100%[\s\S]*overflow-wrap: anywhere[\s\S]*white-space: normal/);
  assert.match(source, /const getResolvedPreview = \(\) => resolveEditedPreviewSpec\(this\.spec, promptInput\.value\)/);
  assert.match(source, /const compactStartDay = this\.spec\.id === "start-day"/);
  assert.match(source, /const previewHelp = compactStartDay/);
  assert.match(source, /contentEl\.setAttr\("title", previewHelp\)/);
  assert.match(source, /contentEl\.setAttr\("aria-label", `Preview: \$\{resolved\.label\}: \$\{previewHelp\}`\)/);
  assert.match(source, /title\.setAttr\("title", previewHelp\)/);
  assert.match(source, /meta\.setAttr\("data-vault-path", this\.vaultPath\)/);
  assert.match(source, /meta\.setAttr\("title", this\.vaultPath\)/);
  assert.match(source, /expectedNote\.setAttr\("data-expected-note-path", resolved\.expectedOpenPath\)/);
  assert.match(source, /expectedNote\.setAttr\("title", resolved\.expectedOpenPath\)/);
  assert.match(source, /formatPreviewExpectedNote\(resolved\.expectedOpenPath, compactStartDay\)/);
  assert.match(source, /createEl\("details", \{ cls: "operator-preview-advanced" \}\)/);
  assert.match(source, /createEl\("summary", \{ text: "Prompt and run details" \}\)/);
  assert.match(source, /createDiv\(\{ cls: "operator-preview-compact-actions" \}\)/);
  assert.match(source, /"Edit prompt"[\s\S]*detailParent\.open = true[\s\S]*promptInput\.focus\(\)/);
  assert.match(source, /copyTextToClipboard\(getResolvedPreview\(\)\.prompt, "Prompt copied\."\)/);
  assert.match(source, /this\.settle\(getResolvedPreview\(\)\)/);
  assert.match(source, /private settled = false/);
  assert.match(source, /if \(this\.settled\) \{\s*return;\s*\}/);
  assert.match(source, /onClose\(\): void \{\s*this\.settle\(null\);/);
  assert.doesNotMatch(source, /meta\.createSpan\(\{ text: `Vault: \$\{this\.vaultPath\}` \}\)/);
  assert.doesNotMatch(source, /expectedNote\.setText\(resolved\.expectedOpenPath \? `Expected note: \$\{resolved\.expectedOpenPath\}` : "Expected note: not predicted"\)/);
  assert.doesNotMatch(source, /copyTextToClipboard\(promptInput\.value, "Prompt copied\."\)/);
  assert.doesNotMatch(previewModalSource, /contentEl\.createEl\("p", \{[\s\S]*Confirm the target, then run/);
  assert.doesNotMatch(previewModalSource, /contentEl\.createEl\("p", \{[\s\S]*Review and edit the exact prompt/);
});

test("dashboard open refreshes status without rendering twice", () => {
  const source = readFileSync("src/main.ts", "utf8");

  assert.match(source, /async refreshStatus\(options: \{ render: boolean \} = \{ render: true \}\): Promise<OperatorEnvironmentStatus>/);
  assert.match(source, /if \(options\.render\) \{\s*this\.renderViews\(\);\s*\}/);
  assert.match(source, /async onOpen\(\): Promise<void> \{\s*await this\.plugin\.refreshStatus\(\{ render: false \}\);\s*await this\.render\(\);\s*\}/);
  assert.doesNotMatch(source, /async onOpen\(\): Promise<void> \{\s*await this\.plugin\.refreshStatus\(\);\s*await this\.render\(\);/);
  assert.doesNotMatch(source, /await this\.refreshStatus\(\);\s*this\.renderViews\(\);/);
});

test("last run keeps full prompt collapsed behind debug details", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");
  const memory = readFileSync("docs/development-memory.md", "utf8");
  const checklist = readFileSync("docs/ux-review-checklist.md", "utf8");

  assert.match(memory, /Last Run metadata paths should wrap instead of widening the dashboard/);
  assert.match(memory, /Last Run expected note metadata should show compact status labels while full paths stay in title or data metadata/);
  assert.match(memory, /Disabled Last Run expected-note buttons should explain missing or pending notes in title and aria metadata/);
  assert.match(checklist, /Last Run expected note metadata stays compact while full paths remain inspectable/);
  assert.match(checklist, /Disabled expected-note openers explain why they are unavailable/);
  assert.match(source, /createEl\("details", \{ cls: "operator-run-prompt-details" \}\)/);
  assert.match(source, /promptDetails\.createEl\("summary", \{ text: "Prompt" \}\)/);
  assert.match(source, /promptDetails\.createEl\("code", \{ cls: "operator-run-prompt", text: lastRun\.prompt \}\)/);
  assert.match(source, /details\.createEl\("summary", \{ text: "Raw log" \}\)/);
  assert.match(source, /expectedNote\.setAttr\("data-expected-note-path", lastRun\.expectedOpenPath\)/);
  assert.match(source, /expectedNote\.setAttr\("title", lastRun\.expectedOpenPath\)/);
  assert.match(source, /expectedNote\.setText\(formatDashboardExpectedNoteStatus\(expectedExists, lastRun\.status\)\)/);
  assert.match(source, /formatExpectedNoteOpenHelp\(expectedExists, lastRun\.status\)/);
  assert.match(source, /"Open expected note"[\s\S]*!expectedExists,\s*formatExpectedNoteOpenHelp\(expectedExists, lastRun\.status\)/);
  assert.doesNotMatch(source, /const prompt = section\.createEl\("code", \{ cls: "operator-run-prompt", text: lastRun\.prompt \}\)/);
  assert.doesNotMatch(source, /meta\.createSpan\(\{ text: formatExpectedNoteStatus\(lastRun\.expectedOpenPath, expectedExists, lastRun\.status\) \}\)/);
  assert.doesNotMatch(source, /"Open expected note"[\s\S]*undefined,\s*!expectedExists\);/);
  assert.match(css, /\.operator-run-prompt-details summary/);
  assert.match(css, /\.operator-run-meta span \{[\s\S]*max-width: 100%[\s\S]*min-width: 0[\s\S]*overflow-wrap: anywhere/);
});

test("setup controls explain disabled setup actions", () => {
  const source = readFileSync("src/main.ts", "utf8");
  const css = readFileSync("styles.css", "utf8");

  assert.match(source, /createDisclosureSection\(root, "Setup health", "Selected backend first; optional checks stay advanced\."\)/);
  assert.match(source, /const visualState = optional && state !== "ready" \? "optional" : state/);
  assert.match(source, /const showDetail = !optional && state !== "ready"/);
  assert.match(source, /operator-status-tile is-\$\{visualState\}/);
  assert.match(source, /tile\.setAttr\("title", detail\)/);
  assert.match(source, /if \(showDetail\) \{\s*tile\.createEl\("p", \{ text: detail \}\);\s*\}/);
  assert.match(source, /operator-chip is-\$\{visualState\}/);
  assert.match(css, /\.operator-chip\.is-optional/);
  assert.match(css, /\.operator-status-tile\.is-optional \.operator-chip/);
  assert.match(source, /const setupLockHelp = this\.plugin\.activeRun[\s\S]*Use Cancel run before changing setup\./);
  assert.match(source, /const codexSkillsHelp = status\.codexCli !== "ready"[\s\S]*Set a working Codex executable before installing Codex skills\./);
  assert.match(source, /codexSkillsDisabled, codexSkillsHelp/);
  assert.match(source, /!!this\.plugin\.activeRun, setupLockHelp\)/);
});

test("does not update ambiguous duplicate markdown task lines", async () => {
  const app = createFakeApp();
  await app.vault.create("01_Execution/2026-W21/Weekly Todo.md", [
    "# Weekly Todo",
    "",
    "- [ ] Follow up",
    "- [ ] Follow up",
  ].join("\n"));

  await assert.rejects(
    updateMarkdownTaskState(app as never, "01_Execution/2026-W21/Weekly Todo.md", "- [ ] Follow up", "x"),
    /appears more than once/,
  );

  const file = app.vault.getAbstractFileByPath("01_Execution/2026-W21/Weekly Todo.md");
  const markdown = await app.vault.read(file as { path: string });
  assert.equal((markdown.match(/- \[x\] Follow up/g) ?? []).length, 0);
  assert.equal((markdown.match(/- \[ \] Follow up/g) ?? []).length, 2);
});

test("builds editable workflow prompt specs", () => {
  const date = new Date("2026-05-22T09:00:00");
  const start = buildStartDaySpec(7, "review deck, email Kai", date);

  assert.equal(buildDefaultDailyPrompt(4.5), "/daily-init 4.5");
  assert.equal(buildDefaultDailyPrompt(Number.NaN), "/daily-init 6");
  assert.equal(buildAdvancedPromptPlaceholder(4.5), "/daily-init 4.5, /project-init MyProject, or review a note");
  assert.equal(resolveAdvancedPrompt("", 4.5), "/daily-init 4.5");
  assert.equal(resolveAdvancedPrompt("  /weekly-review  ", 4.5), "/weekly-review");
  assert.equal(resolveAvailableHoursInput("4.5", 6), 4.5);
  assert.equal(resolveAvailableHoursInput("20", 6), 16);
  assert.equal(resolveAvailableHoursInput("0", 7), 7);
  assert.equal(resolveAvailableHoursInput("abc", 7), 7);
  assert.equal(resolveWeeklyPeriodInput("init", "2026-W3", date), "2026-W03");
  assert.equal(resolveWeeklyPeriodInput("review", "review 2025-w52"), "2025-W52");
  assert.equal(resolveWeeklyPeriodInput("review", "last week", date), "2026-W20");
  assert.equal(resolveWeeklyPeriodInput("init", "last", date), "");
  assert.equal(resolveWeeklyPeriodInput("review", "later"), "");
  assert.equal(resolveAnnualYearInput("vision", "2025", date), "2025");
  assert.equal(resolveAnnualYearInput("review", "review 2025", date), "2025");
  assert.equal(resolveAnnualYearInput("vision", "2027 planning", date), "2027");
  assert.equal(resolveAnnualYearInput("vision", "", date), "2026");
  assert.equal(resolveAnnualYearInput("review", "", date), "2025");
  assert.equal(resolveAnnualYearInput("review", "", new Date("2026-12-15T09:00:00")), "2026");
  assert.equal(resolveAnnualYearInput("vision", "next year", date), "2027");
  assert.equal(resolveAnnualYearInput("vision", "last year", date), "2026");
  assert.equal(resolveAnnualYearInput("review", "last year", date), "2025");
  assert.equal(resolveAnnualYearInput("review", "next year", date), "2025");
  assert.deepEqual(resolveAnnualShortcutInput("vision", "", date), { year: "2026", nextInputValue: "" });
  assert.deepEqual(resolveAnnualShortcutInput("review", "", date), { year: "2025", nextInputValue: "" });
  assert.deepEqual(resolveAnnualShortcutInput("vision", "next", date), { year: "2027", nextInputValue: "" });
  assert.deepEqual(resolveAnnualShortcutInput("vision", "last", date), { year: "2026", nextInputValue: "" });
  assert.deepEqual(resolveAnnualShortcutInput("review", "next", date), { year: "2025", nextInputValue: "" });
  assert.deepEqual(resolveAnnualShortcutInput("review", "2024", date), { year: "2024", nextInputValue: "2024" });
  assert.equal(resolveQuarterlyPeriodInput("init", "2026-Q3"), "init 2026-Q3");
  assert.equal(resolveQuarterlyPeriodInput("review", "review 2025-q4"), "review 2025-Q4");
  assert.equal(resolveQuarterlyPeriodInput("pulse", "2026-04"), "pulse 2026-04");
  assert.equal(resolveQuarterlyPeriodInput("pulse", "2026-Q2"), "pulse 2026-06");
  assert.equal(resolveQuarterlyPeriodInput("pulse", "05", date), "pulse 2026-05");
  assert.equal(resolveQuarterlyPeriodInput("pulse", "12", new Date("2026-01-15T09:00:00")), "pulse 2025-12");
  assert.equal(resolveQuarterlyPeriodInput("init", "2026-04"), "init 2026-Q2");
  assert.equal(resolveQuarterlyPeriodInput("review", "2026-12"), "review 2026-Q4");
  assert.equal(resolveQuarterlyPeriodInput("review", ""), "review");

  assert.match(start.prompt, /^\/daily-init 7\n\nOperator run metadata \(do not treat as manual action items\):/);
  assert.match(start.prompt, /Local date: 2026-05-22/);
  assert.match(start.prompt, /Daily pre-flight guard:/);
  assert.match(start.prompt, /Do not rely on CLI hooks being available/);
  assert.match(
    start.prompt,
    /Evaluate these boundary conditions before writing today's briefing, and run a boundary command only when both its date condition and missing-artifact condition are true\./,
  );
  assert.match(start.prompt, /Weekly close date condition: current ISO week is after the target week, so catch-up runs later in the week are eligible/);
  assert.match(start.prompt, /Monthly pulse date condition: current month is after the target month, so catch-up runs after the first day are eligible/);
  assert.match(start.prompt, /Quarter review\/plan date condition: current quarter is after the review target and the current quarter has begun, so catch-up runs after the first day are eligible/);
  assert.match(start.prompt, /Execution order for eligible missing artifacts: \/weekly-review 2026-W20, \/quarterly-plan pulse 2026-04, \/quarterly-plan review 2026-Q1, \/quarterly-plan init 2026-Q2, then always run \/weekly-init 2026-W21\./);
  assert.match(start.prompt, /Check exact artifacts before deciding a boundary run is missing:/);
  assert.match(start.prompt, /Weekly review artifact: 01_Execution\/2026-W20\/Weekly Review\.md/);
  assert.doesNotMatch(start.prompt, /AI weekly artifact/);
  assert.match(start.prompt, /Monthly pulse artifact: 00_Strategy\/2026-Q2\/Monthly Pulse - 04\.md/);
  assert.match(start.prompt, /Quarterly review artifact: 00_Strategy\/2026-Q1\/Quarterly Review\.md/);
  assert.match(start.prompt, /Quarterly plan artifact: 00_Strategy\/2026-Q2\/Quarterly Plan\.md/);
  assert.doesNotMatch(start.prompt, /Run missing weekly, monthly, and quarterly boundary workflows/);
  assert.match(start.prompt, /\/weekly-review 2026-W20/);
  assert.doesNotMatch(start.prompt, /\/ai-weekly-digest 2026-W20/);
  assert.match(start.prompt, /\/quarterly-plan pulse 2026-04/);
  assert.match(start.prompt, /\/quarterly-plan review 2026-Q1/);
  assert.match(start.prompt, /\/quarterly-plan init 2026-Q2/);
  assert.match(start.prompt, /Current week setup: \/weekly-init 2026-W21/);
  assert.match(start.prompt, /Manual items to consider today:\nreview deck, email Kai/);
  assert.ok(start.prompt.indexOf("Daily pre-flight guard") < start.prompt.indexOf("Manual items to consider today"));
  assert.ok(start.prompt.indexOf("Operator run metadata") < start.prompt.indexOf("Manual items to consider today"));
  const multilineManualStart = buildStartDaySpec(6, "review deck\nemail Kai\n  prep demo  ", date);
  assert.match(multilineManualStart.prompt, /Manual items to consider today:\nreview deck\nemail Kai\n  prep demo/);
  assert.doesNotMatch(start.prompt, /Enabled optional modules for this daily run/);
  const optionalStart = buildStartDaySpec(6, "", date, {
    intelligence: true,
    academic: true,
    content: false,
    calendarEvents: true,
  });
  assert.match(optionalStart.prompt, /Enabled optional modules for this daily run:/);
  assert.match(optionalStart.prompt, /- Intelligence: run \/ai-weekly-digest on eligible weekly boundaries and \/daily-github after the core briefing\./);
  assert.match(optionalStart.prompt, /- Academic: run \/daily-academic after the core briefing\./);
  assert.match(optionalStart.prompt, /- Calendar\/events: run \/add-events only when manual items include event or deadline text to ingest\./);
  assert.doesNotMatch(optionalStart.prompt, /\/content-extract/);
  assert.deepEqual(optionalStart.writeAreas, [
    "Daily note: 01_Execution/2026-W21/2026-05-22.md",
    "Weekly Todo: 01_Execution/2026-W21/Weekly Todo.md",
    "Blockers: 01_Execution/2026-W21/Blockers.md",
    "Enabled optional modules: Intelligence, Academic, Calendar/events",
  ]);
  assert.equal(start.expectedOpenPath, "01_Execution/2026-W21/2026-05-22.md");
  assert.deepEqual(start.targetNotes, [
    "Daily note: 01_Execution/2026-W21/2026-05-22.md",
    "Execution week: 2026-W21",
    "Planning quarter: 2026-Q2",
  ]);
  assert.equal(start.search, true);
  assert.deepEqual(start.runNotes, [
    "Pre-flight may catch up missing prior-period artifacts after a week, month, or quarter boundary has passed.",
    "Pre-flight target checks: /weekly-review 2026-W20, /quarterly-plan pulse 2026-04, /quarterly-plan review 2026-Q1, /quarterly-plan init 2026-Q2.",
    "Always opens target week with /weekly-init 2026-W21 before writing today's briefing.",
  ]);

  const mondayStart = buildStartDaySpec(6, "", new Date("2026-05-25T09:00:00"));
  assert.deepEqual(mondayStart.runNotes, [
    "Pre-flight may catch up missing prior-period artifacts after a week, month, or quarter boundary has passed.",
    "Pre-flight target checks: /weekly-review 2026-W21, /quarterly-plan pulse 2026-04, /quarterly-plan review 2026-Q1, /quarterly-plan init 2026-Q2.",
    "Pre-flight may close last week: /weekly-review 2026-W21.",
    "Always opens target week with /weekly-init 2026-W22 before writing today's briefing.",
  ]);

  const newYearDay = buildStartDaySpec(6, "", new Date("2026-01-01T09:00:00"));
  assert.match(newYearDay.prompt, /\/weekly-review 2025-W52/);
  assert.doesNotMatch(newYearDay.prompt, /\/ai-weekly-digest 2025-W52/);
  assert.match(newYearDay.prompt, /\/quarterly-plan pulse 2025-12/);
  assert.match(newYearDay.prompt, /\/quarterly-plan review 2025-Q4/);
  assert.match(newYearDay.prompt, /\/quarterly-plan init 2026-Q1/);
  assert.deepEqual(newYearDay.runNotes, [
    "Pre-flight may catch up missing prior-period artifacts after a week, month, or quarter boundary has passed.",
    "Pre-flight target checks: /weekly-review 2025-W52, /quarterly-plan pulse 2025-12, /quarterly-plan review 2025-Q4, /quarterly-plan init 2026-Q1.",
    "Pre-flight may close last month: /quarterly-plan pulse 2025-12.",
    "Pre-flight may close/open quarter boundaries: /quarterly-plan review 2025-Q4, then /quarterly-plan init 2026-Q1.",
    "Always opens target week with /weekly-init 2026-W01 before writing today's briefing.",
  ]);

  const fractionalDay = buildStartDaySpec(4.5, "", date);
  assert.match(fractionalDay.prompt, /^\/daily-init 4\.5\n\nOperator run metadata/);

  assert.equal(buildWorkflowSpec("weekly-init", "", date).expectedOpenPath, "01_Execution/2026-W21/Weekly Todo.md");
  assert.equal(buildWorkflowSpec("weekly-init", "", date).label, "Plan 2026-W21");
  assert.deepEqual(buildWorkflowSpec("weekly-init", "", date).targetNotes, ["Execution week: 2026-W21"]);
  assert.match(buildWorkflowSpec("weekly-init", "", date).prompt, /^\/weekly-init 2026-W21\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("weekly-init", resolveWeeklyPeriodInput("init", "last", date), date).expectedOpenPath, "01_Execution/2026-W21/Weekly Todo.md");
  assert.match(buildWorkflowSpec("weekly-init", resolveWeeklyPeriodInput("init", "last", date), date).prompt, /^\/weekly-init 2026-W21\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("weekly-init", "2026-W18", date).expectedOpenPath, "01_Execution/2026-W18/Weekly Todo.md");
  assert.equal(buildWorkflowSpec("weekly-init", "2026-W18", date).label, "Plan 2026-W18");
  assert.deepEqual(buildWorkflowSpec("weekly-init", "2026-W18", date).targetNotes, ["Execution week: 2026-W18"]);
  assert.match(buildWorkflowSpec("weekly-init", "2026-W18", date).prompt, /^\/weekly-init 2026-W18\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("weekly-init", "2026-W3", date).expectedOpenPath, "01_Execution/2026-W03/Weekly Todo.md");
  assert.equal(buildWorkflowSpec("weekly-init", "2026-W3", date).label, "Plan 2026-W03");
  assert.equal(buildWorkflowSpec("weekly-review", "", date).expectedOpenPath, "01_Execution/2026-W21/Weekly Review.md");
  assert.equal(buildWorkflowSpec("weekly-review", "", date).label, "Review 2026-W21");
  assert.deepEqual(buildWorkflowSpec("weekly-review", "", date).targetNotes, ["Review week: 2026-W21"]);
  assert.match(buildWorkflowSpec("weekly-review", "", date).prompt, /^\/weekly-review 2026-W21\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("weekly-review", "last", date).expectedOpenPath, "01_Execution/2026-W20/Weekly Review.md");
  assert.equal(buildWorkflowSpec("weekly-review", "last", date).label, "Review 2026-W20");
  assert.deepEqual(buildWorkflowSpec("weekly-review", "last", date).readAreas, ["Target week's daily notes, Weekly Todo, Blockers, and active projects"]);
  assert.deepEqual(buildWorkflowSpec("weekly-review", "last", date).targetNotes, ["Review week: 2026-W20"]);
  assert.equal(buildWorkflowSpec("weekly-review", "2026-W18", date).expectedOpenPath, "01_Execution/2026-W18/Weekly Review.md");
  assert.equal(describePrompt("/weekly-review 2026-W3", date).expectedOpenPath, "01_Execution/2026-W03/Weekly Review.md");
  assert.match(describePrompt("/weekly-review 2026-W3", date).prompt, /^\/weekly-review 2026-W03\n\nOperator run metadata/);
  assert.equal(describePrompt("/weekly-review last week", date).expectedOpenPath, "01_Execution/2026-W20/Weekly Review.md");
  assert.match(describePrompt("/weekly-review last week", date).prompt, /^\/weekly-review 2026-W20\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("weekly-review", "", new Date("2026-05-25T09:00:00")).expectedOpenPath, "01_Execution/2026-W21/Weekly Review.md");
  assert.match(buildWorkflowSpec("weekly-review", "", new Date("2026-05-25T09:00:00")).prompt, /^\/weekly-review 2026-W21\n\nOperator run metadata/);
  const mondayWeeklyReview = buildWorkflowSpec("weekly-review", "", new Date("2026-05-25T09:00:00"));
  assert.equal(mondayWeeklyReview.label, "Review 2026-W21");
  assert.equal(describePrompt(mondayWeeklyReview.prompt, new Date("2026-05-25T10:00:00")).expectedOpenPath, "01_Execution/2026-W21/Weekly Review.md");
  assert.equal(buildWorkflowSpec("annual-vision", "", date).expectedOpenPath, "00_Strategy/2026 Vision.md");
  assert.equal(buildWorkflowSpec("annual-vision", "", date).label, "Annual vision 2026");
  assert.deepEqual(buildWorkflowSpec("annual-vision", "", date).writeAreas, ["Annual vision: 00_Strategy/2026 Vision.md"]);
  assert.deepEqual(buildWorkflowSpec("annual-vision", "", date).targetNotes, ["Annual vision target: 2026"]);
  assert.match(buildWorkflowSpec("annual-vision", "", date).prompt, /^\/annual-vision 2026\n\nOperator run metadata/);
  assert.match(buildWorkflowSpec("annual-vision", "review", date).prompt, /^\/annual-vision review 2025\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("annual-vision", "review", date).expectedOpenPath, "00_Strategy/2025 Annual Review.md");
  assert.equal(buildWorkflowSpec("annual-vision", "review", date).label, "Annual review 2025");
  assert.deepEqual(buildWorkflowSpec("annual-vision", "review", date).writeAreas, ["Annual review: 00_Strategy/2025 Annual Review.md"]);
  assert.deepEqual(buildWorkflowSpec("annual-vision", "review", date).targetNotes, ["Annual review target: 2025"]);
  assert.equal(buildWorkflowSpec("annual-vision", "review 2026", date).expectedOpenPath, "00_Strategy/2026 Annual Review.md");
  assert.equal(describePrompt("/annual-vision next", date).expectedOpenPath, "00_Strategy/2027 Vision.md");
  assert.match(describePrompt("/annual-vision next", date).prompt, /^\/annual-vision 2027\n\nOperator run metadata/);
  assert.equal(describePrompt("/annual-vision review next", date).expectedOpenPath, "00_Strategy/2025 Annual Review.md");
  assert.match(describePrompt("/annual-vision review next", date).prompt, /^\/annual-vision review 2025\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("quarterly-plan", "init", date).expectedOpenPath, "00_Strategy/2026-Q2/Quarterly Plan.md");
  assert.equal(buildWorkflowSpec("quarterly-plan", "init", date).label, "Quarter plan 2026-Q2");
  assert.deepEqual(buildWorkflowSpec("quarterly-plan", "init", date).writeAreas, ["Quarterly plan: 00_Strategy/2026-Q2/Quarterly Plan.md"]);
  assert.deepEqual(buildWorkflowSpec("quarterly-plan", "init", date).targetNotes, ["Quarterly plan target: 2026-Q2"]);
  assert.match(buildWorkflowSpec("quarterly-plan", "init", date).prompt, /^\/quarterly-plan init 2026-Q2\n\nOperator run metadata/);
  assert.match(
    buildWorkflowSpec("quarterly-plan", resolveQuarterlyPeriodInput("init", "2026-07", date), date).prompt,
    /^\/quarterly-plan init 2026-Q3\n\nOperator run metadata/,
  );
  assert.match(
    buildWorkflowSpec("quarterly-plan", resolveQuarterlyPeriodInput("review", "2026-12", date), date).prompt,
    /^\/quarterly-plan review 2026-Q4\n\nOperator run metadata/,
  );
  assert.equal(buildWorkflowSpec("quarterly-plan", "pulse", date).expectedOpenPath, "00_Strategy/2026-Q2/Monthly Pulse - 04.md");
  assert.equal(buildWorkflowSpec("quarterly-plan", "pulse", date).label, "Monthly pulse 2026-04");
  assert.deepEqual(buildWorkflowSpec("quarterly-plan", "pulse", date).writeAreas, ["Monthly pulse: 00_Strategy/2026-Q2/Monthly Pulse - 04.md"]);
  assert.deepEqual(buildWorkflowSpec("quarterly-plan", "pulse", date).targetNotes, ["Monthly pulse target: 2026-04"]);
  assert.match(buildWorkflowSpec("quarterly-plan", "pulse", date).prompt, /^\/quarterly-plan pulse 2026-04\n\nOperator run metadata/);
  assert.match(
    buildWorkflowSpec("quarterly-plan", resolveQuarterlyPeriodInput("pulse", "05", date), date).prompt,
    /^\/quarterly-plan pulse 2026-05\n\nOperator run metadata/,
  );
  assert.match(
    buildWorkflowSpec("quarterly-plan", resolveQuarterlyPeriodInput("pulse", "2026-Q2", date), date).prompt,
    /^\/quarterly-plan pulse 2026-06\n\nOperator run metadata/,
  );
  assert.equal(
    buildWorkflowSpec("quarterly-plan", resolveQuarterlyPeriodInput("pulse", "2026-Q2", date), date).expectedOpenPath,
    "00_Strategy/2026-Q2/Monthly Pulse - 06.md",
  );
  assert.equal(
    describePrompt("/quarterly-plan pulse 2026-Q2", date).expectedOpenPath,
    "00_Strategy/2026-Q2/Monthly Pulse - 06.md",
  );
  assert.match(describePrompt("/quarterly-plan pulse 2026-Q2", date).prompt, /^\/quarterly-plan pulse 2026-06\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("quarterly-plan", "pulse 05", date).expectedOpenPath, "00_Strategy/2026-Q2/Monthly Pulse - 05.md");
  assert.equal(buildWorkflowSpec("quarterly-plan", "pulse 05", date).label, "Monthly pulse 2026-05");
  assert.equal(buildWorkflowSpec("quarterly-plan", "pulse 2025-12", new Date("2026-01-01T09:00:00")).expectedOpenPath, "00_Strategy/2025-Q4/Monthly Pulse - 12.md");
  assert.equal(buildWorkflowSpec("quarterly-plan", "pulse 2025-12", new Date("2026-01-01T09:00:00")).label, "Monthly pulse 2025-12");
  assert.deepEqual(buildWorkflowSpec("quarterly-plan", "pulse 2025-12", new Date("2026-01-01T09:00:00")).targetNotes, ["Monthly pulse target: 2025-12"]);
  assert.equal(buildWorkflowSpec("quarterly-plan", "pulse", new Date("2026-01-01T09:00:00")).expectedOpenPath, "00_Strategy/2025-Q4/Monthly Pulse - 12.md");
  assert.equal(buildWorkflowSpec("quarterly-plan", "pulse", new Date("2026-01-01T09:00:00")).label, "Monthly pulse 2025-12");
  assert.equal(buildWorkflowSpec("quarterly-plan", "review", date).expectedOpenPath, "00_Strategy/2026-Q1/Quarterly Review.md");
  assert.equal(buildWorkflowSpec("quarterly-plan", "review", date).label, "Quarter review 2026-Q1");
  assert.deepEqual(buildWorkflowSpec("quarterly-plan", "review", date).writeAreas, ["Quarterly review: 00_Strategy/2026-Q1/Quarterly Review.md"]);
  assert.deepEqual(buildWorkflowSpec("quarterly-plan", "review", date).targetNotes, ["Quarterly review target: 2026-Q1"]);
  assert.match(buildWorkflowSpec("quarterly-plan", "review", date).prompt, /^\/quarterly-plan review 2026-Q1\n\nOperator run metadata/);
  const quarterReview = buildWorkflowSpec("quarterly-plan", "review", date);
  assert.equal(describePrompt(quarterReview.prompt, date).expectedOpenPath, "00_Strategy/2026-Q1/Quarterly Review.md");

  const projectSync = buildWorkflowSpec("project-sync", "FM-Copilot", date);
  assert.equal(buildWorkflowSpec("project-init", "FM-Copilot", date).label, "Create FM-Copilot");
  assert.equal(projectSync.label, "Sync FM-Copilot");
  assert.equal(buildWorkflowSpec("deadline-plan", "FM-Copilot", date).label, "Plan deadline FM-Copilot");
  assert.match(projectSync.prompt, /^\/project-sync FM-Copilot\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("meeting-prep", "FM-Copilot 2026-05-29", date).label, "Prep meeting FM-Copilot 2026-05-29");
  assert.equal(buildWorkflowSpec("content-draft", "pricing launch notes", date).label, "Draft pricing launch notes");
  assert.equal(buildWorkflowSpec("content-draft", "", date).label, "Draft content");
  assert.equal(buildWorkflowSpec("deep-research", "operator onboarding UX", date).label, "Deep research operator onboarding UX");
  assert.match(describePrompt("/annual-vision review", date).prompt, /^\/annual-vision review 2025\n\nOperator run metadata/);
  assert.match(buildWorkflowSpec("quarterly-plan", "pulse 05", date).prompt, /^\/quarterly-plan pulse 2026-05\n\nOperator run metadata/);
  assert.match(describePrompt("/quarterly-plan init", date).prompt, /^\/quarterly-plan init 2026-Q2\n\nOperator run metadata/);
  assert.match(describePrompt("/weekly-review", date).prompt, /^\/weekly-review 2026-W21\n\nOperator run metadata/);
  assert.match(buildWorkflowSpec("ai-weekly-digest", "last", date).prompt, /^\/ai-weekly-digest 2026-W20\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("ai-weekly-digest", "", date).expectedOpenPath, "04_Knowledge/AI-Weekly/2026-W21 - AI Weekly Digest.md");
  assert.equal(buildWorkflowSpec("ai-weekly-digest", "", date).label, "AI weekly 2026-W21");
  assert.deepEqual(buildWorkflowSpec("ai-weekly-digest", "", date).targetNotes, ["AI weekly target: 2026-W21"]);
  assert.match(buildWorkflowSpec("ai-weekly-digest", "", date).prompt, /^\/ai-weekly-digest 2026-W21\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("ai-weekly-digest", "last", date).expectedOpenPath, "04_Knowledge/AI-Weekly/2026-W20 - AI Weekly Digest.md");
  assert.equal(buildWorkflowSpec("ai-weekly-digest", "last", date).label, "AI weekly 2026-W20");
  assert.deepEqual(buildWorkflowSpec("ai-weekly-digest", "last", date).writeAreas, [
    "AI weekly digest: 04_Knowledge/AI-Weekly/2026-W20 - AI Weekly Digest.md",
    "Weekly Review block when present: 01_Execution/2026-W20/Weekly Review.md",
  ]);
  assert.deepEqual(buildWorkflowSpec("ai-weekly-digest", "last", date).targetNotes, ["AI weekly target: 2026-W20"]);
  assert.equal(buildWorkflowSpec("ai-weekly-digest", "2026-W18", date).expectedOpenPath, "04_Knowledge/AI-Weekly/2026-W18 - AI Weekly Digest.md");
  assert.equal(buildWorkflowSpec("ai-weekly-digest", "2026-W3", date).expectedOpenPath, "04_Knowledge/AI-Weekly/2026-W03 - AI Weekly Digest.md");
  assert.match(describePrompt("/ai-weekly-digest 2026-W3", date).prompt, /^\/ai-weekly-digest 2026-W03\n\nOperator run metadata/);
  assert.equal(describePrompt("/ai-weekly-digest last week", date).expectedOpenPath, "04_Knowledge/AI-Weekly/2026-W20 - AI Weekly Digest.md");
  assert.match(describePrompt("/ai-weekly-digest last week", date).prompt, /^\/ai-weekly-digest 2026-W20\n\nOperator run metadata/);
  assert.equal(buildWorkflowSpec("ai-weekly-digest", "2026-W18", date).label, "AI weekly 2026-W18");
  assert.equal(buildWorkflowSpec("ai-weekly-digest", "", new Date("2026-05-25T09:00:00")).expectedOpenPath, "04_Knowledge/AI-Weekly/2026-W21 - AI Weekly Digest.md");
  assert.equal(buildWorkflowSpec("ai-weekly-digest", "", new Date("2026-05-25T09:00:00")).label, "AI weekly 2026-W21");
  assert.match(buildWorkflowSpec("ai-weekly-digest", "", new Date("2026-05-25T09:00:00")).prompt, /^\/ai-weekly-digest 2026-W21\n\nOperator run metadata/);
  assert.match(describePrompt("/ai-weekly-digest", date).prompt, /^\/ai-weekly-digest 2026-W21\n\nOperator run metadata/);
  assert.match(describePrompt("/ai-weekly-digest last", date).prompt, /^\/ai-weekly-digest 2026-W20\n\nOperator run metadata/);
  assert.equal(describePrompt("/ai-weekly-digest last", date).expectedOpenPath, "04_Knowledge/AI-Weekly/2026-W20 - AI Weekly Digest.md");

  const eventList = "Fri 2pm Design review\nSat 10am Research sync";
  assert.match(buildWorkflowSpec("add-events", eventList, date).prompt, /^\/add-events\nFri 2pm Design review\nSat 10am Research sync\n\nOperator run metadata/);

  const transcript = "Alice: The launch moved to Friday.\nBob: I will update the brief.";
  assert.match(buildWorkflowSpec("meeting", transcript, date).prompt, /^\/meeting\nAlice: The launch moved to Friday\.\nBob: I will update the brief\.\n\nOperator run metadata/);

  const typedDaily = describePrompt("/daily-init 4.5", date);
  assert.match(typedDaily.prompt, /^\/daily-init 4\.5\n\nOperator run metadata/);
  assert.match(typedDaily.prompt, /Daily pre-flight guard:/);
  assert.match(typedDaily.prompt, /\/weekly-review 2026-W20/);
  assert.deepEqual(typedDaily.runNotes, [
    "Pre-flight may catch up missing prior-period artifacts after a week, month, or quarter boundary has passed.",
    "Pre-flight target checks: /weekly-review 2026-W20, /quarterly-plan pulse 2026-04, /quarterly-plan review 2026-Q1, /quarterly-plan init 2026-Q2.",
    "Always opens target week with /weekly-init 2026-W21 before writing today's briefing.",
  ]);

  const delayedDaily = describePrompt(typedDaily.prompt, new Date("2026-05-23T00:15:00"));
  assert.match(delayedDaily.prompt, /Local date: 2026-05-22/);
  assert.equal(delayedDaily.expectedOpenPath, "01_Execution/2026-W21/2026-05-22.md");
  assert.deepEqual(delayedDaily.targetNotes, [
    "Daily note: 01_Execution/2026-W21/2026-05-22.md",
    "Execution week: 2026-W21",
    "Planning quarter: 2026-Q2",
  ]);

  const typedEvents = describePrompt(`/add-events\n${eventList}`, date);
  assert.match(typedEvents.prompt, /^\/add-events\nFri 2pm Design review\nSat 10am Research sync\n\nOperator run metadata/);

  const typedWeeklyReview = describePrompt("/weekly-review", date);
  assert.match(typedWeeklyReview.prompt, /^\/weekly-review 2026-W21\n\nOperator run metadata/);
  assert.equal(describePrompt("/weekly-init 2026-W18", date).expectedOpenPath, "01_Execution/2026-W18/Weekly Todo.md");
  assert.match(describePrompt("/weekly-init 2026-W3", date).prompt, /^\/weekly-init 2026-W03\n\nOperator run metadata/);

  const editedWeeklyReview = resolveEditedPreviewSpec(buildWorkflowSpec("weekly-review", "", date), "/weekly-review 2026-W18", date);
  assert.equal(editedWeeklyReview.label, "Review 2026-W18");
  assert.equal(editedWeeklyReview.expectedOpenPath, "01_Execution/2026-W18/Weekly Review.md");
  const originalWeeklyReview = buildWorkflowSpec("weekly-review", "", date);
  const blankEditedWeeklyReview = resolveEditedPreviewSpec(originalWeeklyReview, "   ", date);
  assert.equal(blankEditedWeeklyReview.prompt, originalWeeklyReview.prompt);
  assert.equal(blankEditedWeeklyReview.expectedOpenPath, originalWeeklyReview.expectedOpenPath);

  const described = describePrompt("/deep-research AI evals", date);
  assert.equal(described.id, "deep-research");
  assert.match(described.prompt, /^\/deep-research AI evals\n\nOperator run metadata/);
  assert.equal(described.search, true);

  const custom = describePrompt("review the current note", date);
  assert.equal(custom.prompt, "review the current note");
});

test("builds CLI handoff as a runnable codex exec command with the enhanced daily prompt", () => {
  const handoff = buildCliHandoff("/tmp/My Vault", "/daily-init 4.5", new Date("2026-05-22T09:00:00"));

  assert.match(handoff, /^cd '\/tmp\/My Vault'\ncodex exec --cd '\/tmp\/My Vault' --skip-git-repo-check --sandbox workspace-write --ask-for-approval on-request --search /);
  assert.match(handoff, /'\/daily-init 4\.5/);
  assert.match(handoff, /Daily pre-flight guard:/);
  assert.match(handoff, /Local date: 2026-05-22/);

  const resolvedHandoff = buildCliHandoff("/tmp/My Vault", "/daily-init 4.5", new Date("2026-05-22T09:00:00"), "codex", {
    codexPath: "/Users/herschel/.nvm/versions/node/v24.14.0/bin/codex",
  });
  assert.match(resolvedHandoff, /^cd '\/tmp\/My Vault'\n'\/Users\/herschel\/\.nvm\/versions\/node\/v24\.14\.0\/bin\/codex' exec /);
});

test("builds CLI handoff for Claude when Claude backend is selected", () => {
  const handoff = buildCliHandoff("/tmp/My Vault", "/annual-vision review", new Date("2026-05-22T09:00:00"), "claude");

  assert.match(handoff, /^cd '\/tmp\/My Vault'\nclaude -p /);
  assert.match(handoff, /'\/annual-vision review/);
  assert.match(handoff, /Operator run metadata/);

  const resolvedHandoff = buildCliHandoff("/tmp/My Vault", "/annual-vision review", new Date("2026-05-22T09:00:00"), "claude", {
    claudePath: "/opt/homebrew/bin/claude",
  });
  assert.match(resolvedHandoff, /^cd '\/tmp\/My Vault'\n'\/opt\/homebrew\/bin\/claude' -p /);
});

function createFakeApp(): {
  vault: {
    getMarkdownFiles: () => Array<{ path: string; extension: string }>;
    getAbstractFileByPath: (path: string) => { path: string; extension?: string } | null;
    read: (file: { path: string }) => Promise<string>;
    create: (path: string, content: string) => Promise<{ path: string; extension: string }>;
    createFolder: (path: string) => Promise<void>;
    process: (file: { path: string }, update: (current: string) => string) => Promise<void>;
  };
} {
  const files = new Map<string, string>();
  const folders = new Set<string>();

  return {
    vault: {
      getMarkdownFiles: () => [...files.keys()]
        .filter((path) => path.endsWith(".md"))
        .map((path) => ({ path, extension: "md" })),
      getAbstractFileByPath: (path: string) => {
        if (files.has(path)) {
          return { path, extension: path.split(".").pop() ?? "" };
        }
        if (folders.has(path)) {
          return { path };
        }
        return null;
      },
      read: async (file: { path: string }) => files.get(file.path) ?? "",
      create: async (path: string, content: string) => {
        files.set(path, content);
        return { path, extension: path.split(".").pop() ?? "" };
      },
      createFolder: async (path: string) => {
        folders.add(path);
      },
      process: async (file: { path: string }, update: (current: string) => string) => {
        files.set(file.path, update(files.get(file.path) ?? ""));
      },
    },
  };
}
