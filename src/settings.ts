export type OperatorBackend = "codex" | "claude";

export interface OptionalModuleSettings {
  intelligence: boolean;
  academic: boolean;
  content: boolean;
  calendarEvents: boolean;
}

export interface OperatorSettings {
  backend: OperatorBackend;
  codexPath: string;
  claudePath: string;
  repoSource: string;
  availableHours: number;
  optionalModules: OptionalModuleSettings;
  vaultOwnerName: string;
  calendarName: string;
  remindersList: string;
  meetingRecordingsBase: string;
  hasAcceptedRunnerWarning: boolean;
  hasOpenedDashboard: boolean;
  lastRun: OperatorRunRecord | null;
}

export interface OperatorRunRecord {
  id: string;
  backend: OperatorBackend;
  prompt: string;
  workflowLabel?: string;
  expectedOpenPath?: string;
  readAreas?: string[];
  writeAreas?: string[];
  status: "running" | "success" | "failed" | "cancelled";
  startedAt: string;
  endedAt?: string;
  stdout: string;
  stderr: string;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
}

export const DEFAULT_SETTINGS: OperatorSettings = {
  backend: "codex",
  codexPath: "codex",
  claudePath: "claude",
  repoSource: "engramai-co/Engram-Obsidian-Operator",
  availableHours: 6,
  optionalModules: {
    intelligence: false,
    academic: false,
    content: false,
    calendarEvents: false,
  },
  vaultOwnerName: "You",
  calendarName: "Operator",
  remindersList: "Operator",
  meetingRecordingsBase: "~/Work/<Project>/Meetings/",
  hasAcceptedRunnerWarning: false,
  hasOpenedDashboard: false,
  lastRun: null,
};

// Repo homes this project has outgrown; persisted data.json from installs made
// before the engramai-co move still carries them as repoSource.
const LEGACY_REPO_SOURCES = [
  "yuhanwang14/obsidian-operator",
  "herschel0130/obsidian-operator-product",
];

export function migrateLegacyRepoSource(repoSource: string | undefined): string {
  if (!repoSource || LEGACY_REPO_SOURCES.includes(repoSource)) {
    return DEFAULT_SETTINGS.repoSource;
  }
  return repoSource;
}
