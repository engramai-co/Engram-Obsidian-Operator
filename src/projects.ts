import type { App, TFile } from "obsidian";
import { formatDateKey } from "./dates";

export interface NativeProjectInput {
  name: string;
  category: string;
  description: string;
  now: string;
  risks: string;
}

export interface NativeProjectResult {
  projectName: string;
  notePath: string;
  projectFolder: string;
  knowledgeFolder: string;
}

export async function createNativeProject(
  app: App,
  input: NativeProjectInput,
  date = new Date(),
): Promise<NativeProjectResult> {
  const projectName = normalizeProjectName(input.name);
  if (!projectName) {
    throw new Error("Project name is required.");
  }

  const projectFolder = `02_Projects/${projectName}`;
  const knowledgeFolder = `04_Knowledge/${projectName}`;
  const notePath = `${projectFolder}/${projectName}.md`;

  if (app.vault.getAbstractFileByPath(projectFolder)) {
    throw new Error(`Project folder already exists at ${projectFolder}. Use project sync to update it.`);
  }

  await ensureFolderPath(app, projectFolder);
  await ensureFolderPath(app, knowledgeFolder);
  await app.vault.create(notePath, buildProjectNote(projectName, input, date));

  return {
    projectName,
    notePath,
    projectFolder,
    knowledgeFolder,
  };
}

export function buildProjectNote(projectName: string, input: NativeProjectInput, date = new Date()): string {
  const category = normalizeInlineValue(input.category) || "project";
  const description = normalizeInlineValue(input.description) || "Project description to refine.";
  const now = normalizeListText(input.now) || "- Define the immediate next action.";
  const risks = normalizeListText(input.risks) || "- (none identified yet)";

  return `---\ntype: project\nstatus: active\ndate: ${formatDateKey(date)}\nproject: ${projectName}\ncategory: ${category}\n---\n\n# ${projectName}\n\n${description}\n\n## Now\n\n${now}\n\n## Risks\n\n${risks}\n\n---\n\n## Knowledge Base\n\n## Weekly Progress\n`;
}

export function normalizeProjectName(value: string): string {
  return value
    .trim()
    .replace(/[\\/:"*?<>|#^[\]]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureFolderPath(app: App, folderPath: string): Promise<void> {
  const segments = normalizeVaultPath(folderPath).split("/");
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    const existing = app.vault.getAbstractFileByPath(current);
    if (!existing) {
      await app.vault.createFolder(current);
    } else if (isVaultFile(existing)) {
      throw new Error(`${current} exists but is not a folder.`);
    }
  }
}

function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

function isVaultFile(value: unknown): value is TFile {
  return !!value && typeof value === "object" && "extension" in value;
}

function normalizeInlineValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeListText(value: string): string {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => (/^[-*]\s+/.test(line) ? line : `- ${line}`)).join("\n");
}
