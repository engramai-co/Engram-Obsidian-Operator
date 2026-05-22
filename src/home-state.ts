import { App, normalizePath, TFile } from "obsidian";
import { getDailyNotePath, getExecutionWeekFolder } from "./dates";
import {
  type ActiveProjectSummary,
  type BlockersSummary,
  parseActiveProjectNote,
  parseBlockers,
} from "./vault-parsers";

export interface OperatorHomeState {
  weekFolder: string;
  dailyNotePath: string;
  blockersPath: string;
  activeProjects: ActiveProjectSummary[];
  blockers: BlockersSummary;
}

export async function readOperatorHomeState(app: App, date = new Date()): Promise<OperatorHomeState> {
  const activeProjects = await readActiveProjects(app);
  const weekFolder = getExecutionWeekFolder(date);
  const blockersPath = `${weekFolder}/Blockers.md`;
  const blockersFile = app.vault.getAbstractFileByPath(blockersPath);
  const blockersMarkdown = blockersFile instanceof TFile ? await app.vault.read(blockersFile) : "";

  return {
    weekFolder,
    dailyNotePath: getDailyNotePath(date),
    blockersPath,
    activeProjects,
    blockers: parseBlockers(blockersMarkdown, date, activeProjects.map((project) => project.name)),
  };
}

export async function appendQuickCapture(
  app: App,
  kind: "idea" | "task" | "meeting" | "research",
  text: string,
  date = new Date(),
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Capture text is empty.");
  }

  const dailyPath = getDailyNotePath(date);
  await ensureFolderPath(app, getExecutionWeekFolder(date));
  const file = await ensureDailyNote(app, dailyPath, date);
  const line = formatCaptureLine(kind, trimmed);

  await app.vault.process(file, (current) => insertUnderCapture(current, line));
  return dailyPath;
}

async function readActiveProjects(app: App): Promise<ActiveProjectSummary[]> {
  const projectFiles = app.vault
    .getMarkdownFiles()
    .filter((file) => /^02_Projects\/[^/]+\/[^/]+\.md$/i.test(file.path));

  const projects: ActiveProjectSummary[] = [];
  for (const file of projectFiles) {
    const parsed = parseActiveProjectNote(file.path, await app.vault.read(file));
    if (parsed) {
      projects.push(parsed);
    }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

async function ensureDailyNote(app: App, path: string, date: Date): Promise<TFile> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    return existing;
  }
  if (existing) {
    throw new Error(`${path} exists but is not a note.`);
  }

  return app.vault.create(path, `# ${path.split("/").pop()?.replace(/\.md$/, "") ?? date.toDateString()}\n\n## Capture\n`);
}

async function ensureFolderPath(app: App, folderPath: string): Promise<void> {
  const segments = normalizePath(folderPath).split("/");
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

function insertUnderCapture(markdown: string, line: string): string {
  if (!/^## Capture\s*$/m.test(markdown)) {
    const suffix = markdown.endsWith("\n") ? "" : "\n";
    return `${markdown}${suffix}\n## Capture\n${line}\n`;
  }

  return markdown.replace(/(^## Capture\s*$)/m, `$1\n${line}`);
}

function formatCaptureLine(kind: "idea" | "task" | "meeting" | "research", text: string): string {
  switch (kind) {
    case "task":
      return `- [ ] ${text}`;
    case "meeting":
      return `- Meeting note: ${text}`;
    case "research":
      return `- Research question: ${text}`;
    case "idea":
    default:
      return `- Idea: ${text}`;
  }
}
