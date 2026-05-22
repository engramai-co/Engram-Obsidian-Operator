import { getDailyNotePath } from "./dates";

export type OperatorWorkflowId =
  | "start-day"
  | "weekly-init"
  | "weekly-review"
  | "project-init"
  | "project-sync"
  | "deadline-plan"
  | "meeting-prep"
  | "meeting"
  | "content-extract"
  | "content-draft"
  | "deep-research"
  | "custom";

export interface OperatorWorkflowRunSpec {
  id: OperatorWorkflowId;
  label: string;
  prompt: string;
  readAreas: string[];
  writeAreas: string[];
  expectedOpenPath?: string;
  search?: boolean;
}

export function buildStartDaySpec(hours: number, manualItems: string, date = new Date()): OperatorWorkflowRunSpec {
  const safeHours = Math.max(1, Math.min(16, Math.round(hours || 6)));
  const cleanedManualItems = normalizeInlineArgs(manualItems);
  const prompt = cleanedManualItems
    ? `/daily-init ${safeHours}\n\nManual items to consider today:\n${cleanedManualItems}`
    : `/daily-init ${safeHours}`;

  return {
    id: "start-day",
    label: "Start my day",
    prompt,
    readAreas: [
      "01_Execution/ current and recent daily/weekly notes",
      "02_Projects/ active project notes and deadline plans",
      "00_Strategy/ quarterly and annual planning notes",
      "Gmail, calendar, GitHub, arXiv when configured",
    ],
    writeAreas: [
      "Today's daily note briefing and schedule",
      "Current week Weekly Todo / Blockers sync updates",
      "04_Knowledge/ daily GitHub, academic, and AI notes",
      "05_Content/Backlog.md content ideas",
    ],
    expectedOpenPath: getDailyNotePath(date),
    search: true,
  };
}

export function buildWorkflowSpec(
  id: OperatorWorkflowId,
  args = "",
  date = new Date(),
): OperatorWorkflowRunSpec {
  const cleanedArgs = normalizeInlineArgs(args);
  switch (id) {
    case "weekly-init":
      return simpleSpec(id, "Plan this week", "/weekly-init", [
        "Recent daily notes, last week Weekly Todo, Blockers, project deadline plans",
      ], ["Current week Weekly Todo and Blockers"]);
    case "weekly-review":
      return simpleSpec(id, "Review this week", "/weekly-review", [
        "This week's daily notes, Weekly Todo, Blockers, and active projects",
      ], ["Current week Weekly Review.md"]);
    case "project-init":
      return simpleSpec(id, "Create project", withArgs("/project-init", cleanedArgs), [
        "Existing 02_Projects folders for duplicate checks",
      ], ["New project note and knowledge folder"]);
    case "project-sync":
      return simpleSpec(id, "Sync project", withArgs("/project-sync", cleanedArgs), [
        "Project note, meeting knowledge, research notes, weekly reviews",
      ], ["Project note synthesis sections"]);
    case "deadline-plan":
      return simpleSpec(id, "Plan deadline", withArgs("/deadline-plan", cleanedArgs), [
        "Project note, existing deadline plan, calendar/reminder context when available",
      ], ["Project Deadline Plan.md and related reminders"]);
    case "meeting-prep":
      return simpleSpec(id, "Prep meeting", withArgs("/meeting-prep", cleanedArgs), [
        "Project note, current Blockers, Weekly Todo, recent daily notes, deadline plans",
      ], ["Project Meeting Plan note"]);
    case "meeting":
      return simpleSpec(id, "Process meeting", withArgs("/meeting", cleanedArgs), [
        "Provided transcript, recording, or meeting directory plus project context",
      ], ["Meeting transcript note, meeting knowledge note, routed actions"]);
    case "content-extract":
      return simpleSpec(id, "Extract content ideas", "/content-extract", [
        "Recent daily notes, thinking notes, newsletter email when configured",
      ], ["05_Content/Backlog.md"]);
    case "content-draft":
      return simpleSpec(id, "Draft content", withArgs("/content-draft", cleanedArgs), [
        "05_Content/Backlog.md, Voice Guide.md, selected source notes",
      ], ["05_Content/Drafts/"]);
    case "deep-research":
      return {
        ...simpleSpec(id, "Deep research", withArgs("/deep-research", cleanedArgs), [
          "Vault project context and web sources",
        ], ["04_Knowledge/<Project>/Research/ or general knowledge note"]),
        search: true,
      };
    case "start-day":
      return buildStartDaySpec(Number(cleanedArgs) || 6, "", date);
    case "custom":
      return describePrompt(cleanedArgs || "/", date);
  }
}

export function describePrompt(prompt: string, date = new Date()): OperatorWorkflowRunSpec {
  const trimmed = prompt.trim();
  if (trimmed.startsWith("/daily-init")) {
    return {
      ...buildStartDaySpec(extractDailyHours(trimmed), "", date),
      prompt: trimmed,
    };
  }

  const command = trimmed.split(/\s+/, 1)[0].replace(/^\//, "") as OperatorWorkflowId;
  const known = new Set<OperatorWorkflowId>([
    "weekly-init",
    "weekly-review",
    "project-init",
    "project-sync",
    "deadline-plan",
    "meeting-prep",
    "meeting",
    "content-extract",
    "content-draft",
    "deep-research",
  ]);

  if (known.has(command)) {
    return {
      ...buildWorkflowSpec(command, trimmed.slice(command.length + 1).trim(), date),
      prompt: trimmed,
    };
  }

  return {
    id: "custom",
    label: "Custom Operator prompt",
    prompt: trimmed || "/",
    readAreas: ["Whatever the prompt asks the agent to inspect"],
    writeAreas: ["Whatever the prompt asks the agent to change inside this vault"],
  };
}

function simpleSpec(
  id: OperatorWorkflowId,
  label: string,
  prompt: string,
  readAreas: string[],
  writeAreas: string[],
): OperatorWorkflowRunSpec {
  return { id, label, prompt, readAreas, writeAreas };
}

function withArgs(command: string, args: string): string {
  return args ? `${command} ${args}` : command;
}

function normalizeInlineArgs(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractDailyHours(prompt: string): number {
  const match = prompt.match(/^\/daily-init\s+(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 6;
}
