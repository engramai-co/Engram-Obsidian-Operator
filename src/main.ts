import {
  App,
  ButtonComponent,
  DropdownComponent,
  FileSystemAdapter,
  ItemView,
  Modal,
  Notice,
  Platform,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TextComponent,
  WorkspaceLeaf,
  setIcon,
} from "obsidian";
import { formatDateKey } from "./dates";
import { appendQuickCapture, readOperatorHomeState, type OperatorHomeState } from "./home-state";
import {
  buildBackendCommand,
  buildCodexMarketplaceAddCommand,
  buildCodexMarketplaceUpgradeCommand,
  runCommand,
  truncateOutput,
  type RunningProcess,
} from "./runner";
import { DEFAULT_SETTINGS, type OperatorRunRecord, type OperatorSettings } from "./settings";
import { canRunCodexWorkflows, checkEnvironment, type OperatorEnvironmentStatus, type StatusState } from "./status";
import { initializeVault, type VaultInitializationResult } from "./vault-init";
import {
  buildStartDaySpec,
  buildWorkflowSpec,
  describePrompt,
  type OperatorWorkflowRunSpec,
} from "./workflows";

const VIEW_TYPE_OPERATOR = "operator-control-view";

export default class OperatorControlPlugin extends Plugin {
  settings: OperatorSettings = { ...DEFAULT_SETTINGS };
  status: OperatorEnvironmentStatus | null = null;
  activeRun: RunningProcess | null = null;
  activeRunBuffer: OperatorRunRecord | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_OPERATOR, (leaf) => new OperatorDashboardView(leaf, this));

    this.addRibbonIcon("layout-dashboard", "Open Operator", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-dashboard",
      name: "Open dashboard",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "run-daily-briefing",
      name: "Run daily briefing",
      callback: () => void this.runDailyBriefing(this.settings.availableHours),
    });

    this.addCommand({
      id: "initialize-vault",
      name: "Initialize vault",
      callback: () => void this.initializeVaultFromUi(),
    });

    this.addSettingTab(new OperatorSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      if (!this.settings.hasOpenedDashboard) {
        this.settings.hasOpenedDashboard = true;
        void this.saveSettings();
        void this.activateView();
      }
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_OPERATOR)[0];
    const leaf = existing ?? this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: VIEW_TYPE_OPERATOR, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async refreshStatus(): Promise<OperatorEnvironmentStatus> {
    this.status = await checkEnvironment(this.app, this.settings);
    this.renderViews();
    return this.status;
  }

  getVaultPath(): string | null {
    if (!Platform.isDesktopApp) {
      return null;
    }

    const adapter = this.app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      return adapter.getBasePath();
    }
    return null;
  }

  async initializeVaultFromUi(): Promise<void> {
    try {
      const result = await initializeVault(this.app, this.settings);
      new Notice(summarizeInitialization(result));
      await this.refreshStatus();
    } catch (error) {
      new Notice(`Operator setup failed: ${formatError(error)}`);
    }
  }

  async installOrUpdateCodexMarketplace(): Promise<void> {
    if (this.activeRun) {
      new Notice("Operator is already running a command.");
      return;
    }

    const installed = this.status?.operatorSkills === "ready" || this.status?.operatorSkills === "warning";
    const spec = installed
      ? buildCodexMarketplaceUpgradeCommand(this.settings.codexPath)
      : buildCodexMarketplaceAddCommand(this.settings.codexPath, this.settings.repoSource);

    const startedAt = new Date().toISOString();
    this.activeRunBuffer = {
      id: `marketplace-${Date.now()}`,
      backend: "codex",
      prompt: spec.args.join(" "),
      status: "running",
      startedAt,
      stdout: "",
      stderr: "",
    };
    this.settings.lastRun = this.activeRunBuffer;
    await this.saveSettings();
    this.renderViews();

    const running = runCommand(spec, {
      onStdout: (chunk) => this.appendActiveOutput("stdout", chunk),
      onStderr: (chunk) => this.appendActiveOutput("stderr", chunk),
    });
    this.activeRun = running;

    const result = await running.done;
    await this.finishActiveRun(result.exitCode === 0 ? "success" : "failed", result);
    await this.refreshStatus();
  }

  async runDailyBriefing(hours: number, manualItems = ""): Promise<void> {
    const safeHours = Math.max(1, Math.min(16, Math.round(hours || this.settings.availableHours)));
    this.settings.availableHours = safeHours;
    await this.saveSettings();
    await this.previewAndRunWorkflow(buildStartDaySpec(safeHours, manualItems));
  }

  async runProjectInit(projectName: string): Promise<void> {
    const trimmed = projectName.trim();
    if (!trimmed) {
      new Notice("Enter a project name first.");
      return;
    }
    await this.previewAndRunWorkflow(buildWorkflowSpec("project-init", trimmed));
  }

  async previewAndRunWorkflow(spec: OperatorWorkflowRunSpec): Promise<void> {
    const confirmed = await this.confirmRunPreview(spec);
    if (!confirmed) {
      return;
    }
    await this.runOperatorPrompt(confirmed.prompt, { search: confirmed.search, workflow: confirmed });
  }

  async runOperatorPrompt(prompt: string, options: { search?: boolean; workflow?: OperatorWorkflowRunSpec }): Promise<void> {
    if (this.activeRun) {
      new Notice("Operator is already running.");
      return;
    }

    const vaultPath = this.getVaultPath();
    if (!vaultPath) {
      new Notice("Operator can only run workflows in the desktop app.");
      return;
    }

    if (!(await this.ensureRunnerConsent())) {
      return;
    }

    const status = this.status ?? (await this.refreshStatus());
    if (this.settings.backend === "codex" && !canRunCodexWorkflows(status)) {
      new Notice("Finish setup first: Codex, login, skills, and vault initialization must be ready.");
      return;
    }

    const spec = buildBackendCommand(
      this.settings.backend,
      {
        codexPath: this.settings.codexPath,
        claudePath: this.settings.claudePath,
        vaultPath,
      },
      prompt,
      options,
    );

    const startedAt = new Date().toISOString();
    this.activeRunBuffer = {
      id: `operator-${Date.now()}`,
      backend: this.settings.backend,
      prompt,
      workflowLabel: options.workflow?.label,
      expectedOpenPath: options.workflow?.expectedOpenPath,
      readAreas: options.workflow?.readAreas,
      writeAreas: options.workflow?.writeAreas,
      status: "running",
      startedAt,
      stdout: "",
      stderr: "",
    };
    this.settings.lastRun = this.activeRunBuffer;
    await this.saveSettings();
    this.renderViews();

    const running = runCommand(spec, {
      onStdout: (chunk) => this.appendActiveOutput("stdout", chunk),
      onStderr: (chunk) => this.appendActiveOutput("stderr", chunk),
    });
    this.activeRun = running;

    const result = await running.done;
    const statusName = result.cancelled ? "cancelled" : result.exitCode === 0 ? "success" : "failed";
    await this.finishActiveRun(statusName, result);
    await this.refreshStatus();
  }

  async appendCapture(kind: "idea" | "task" | "meeting" | "research", text: string): Promise<void> {
    try {
      const path = await appendQuickCapture(this.app, kind, text);
      new Notice(`Captured to ${path}.`);
      await this.openVaultPath(path);
      this.renderViews();
    } catch (error) {
      new Notice(`Capture failed: ${formatError(error)}`);
    }
  }

  async openVaultPath(path: string): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      new Notice(`Note not found: ${path}`);
      return false;
    }
    await this.app.workspace.getLeaf(false).openFile(file);
    return true;
  }

  cancelActiveRun(): void {
    if (!this.activeRun) {
      return;
    }
    this.activeRun.cancel();
    new Notice("Stopping Operator run...");
  }

  private appendActiveOutput(stream: "stdout" | "stderr", chunk: string): void {
    if (!this.activeRunBuffer) {
      return;
    }
    this.activeRunBuffer[stream] = truncateOutput(this.activeRunBuffer[stream] + chunk);
    this.settings.lastRun = this.activeRunBuffer;
    this.renderViews();
  }

  private async finishActiveRun(
    status: OperatorRunRecord["status"],
    result: { stdout: string; stderr: string; exitCode: number | null; signal: NodeJS.Signals | null },
  ): Promise<void> {
    if (this.activeRunBuffer) {
      this.activeRunBuffer.status = status;
      this.activeRunBuffer.endedAt = new Date().toISOString();
      this.activeRunBuffer.stdout = truncateOutput(result.stdout);
      this.activeRunBuffer.stderr = truncateOutput(result.stderr);
      this.activeRunBuffer.exitCode = result.exitCode;
      this.activeRunBuffer.signal = result.signal;
      this.settings.lastRun = this.activeRunBuffer;
    }

    this.activeRun = null;
    this.activeRunBuffer = null;
    await this.saveSettings();
    if (status === "success" && this.settings.lastRun?.expectedOpenPath) {
      const file = this.app.vault.getAbstractFileByPath(this.settings.lastRun.expectedOpenPath);
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf(false).openFile(file);
      }
    }
    this.renderViews();
    new Notice(status === "success" ? "Operator run finished." : `Operator run ${status}.`);
  }

  private async confirmRunPreview(spec: OperatorWorkflowRunSpec): Promise<OperatorWorkflowRunSpec | null> {
    const vaultPath = this.getVaultPath() ?? "Current Obsidian vault";
    return new Promise<OperatorWorkflowRunSpec | null>((resolve) => {
      new RunPreviewModal(this.app, spec, this.settings.backend, vaultPath, resolve).open();
    });
  }

  private async ensureRunnerConsent(): Promise<boolean> {
    if (this.settings.hasAcceptedRunnerWarning) {
      return true;
    }

    const accepted = await new Promise<boolean>((resolve) => {
      new RunnerConsentModal(this.app, resolve).open();
    });

    if (accepted) {
      this.settings.hasAcceptedRunnerWarning = true;
      await this.saveSettings();
    }

    return accepted;
  }

  renderViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_OPERATOR)) {
      const view = leaf.view;
      if (view instanceof OperatorDashboardView) {
        void view.render();
      }
    }
  }
}

class OperatorDashboardView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: OperatorControlPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_OPERATOR;
  }

  getDisplayText(): string {
    return "Operator";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    await this.plugin.refreshStatus();
    await this.render();
  }

  async render(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("operator-control-view");

    const root = container.createDiv({ cls: "operator-control" });
    const header = root.createDiv({ cls: "operator-hero" });
    const titleWrap = header.createDiv();
    titleWrap.createEl("p", { cls: "operator-eyebrow", text: "Operator Home" });
    titleWrap.createEl("h2", { text: "Know what to do next, without memorizing commands." });
    titleWrap.createEl("p", {
      cls: "operator-muted",
      text: "Read the vault, launch existing workflows, and review agent runs without turning Operator into a closed app.",
    });

    const headerActions = header.createDiv({ cls: "operator-hero-actions" });
    createButton(headerActions, "refresh-cw", "Refresh", () => void this.plugin.refreshStatus());
    if (this.plugin.activeRun) {
      createButton(headerActions, "square", "Cancel run", () => this.plugin.cancelActiveRun(), "operator-danger");
    }

    const status = this.plugin.status ?? (await this.plugin.refreshStatus());
    const home = await readOperatorHomeState(this.app);

    if (!status.vault.ready) {
      this.renderSetup(root, status, false);
      this.renderRunLog(root);
      return;
    }

    this.renderStartDay(root, status);
    this.renderHomePanels(root, home);
    this.renderWorkflowShortcuts(root, status, home);
    this.renderQuickCapture(root);
    this.renderSetup(root, status, true);
    this.renderRunLog(root);
  }

  private renderSetup(root: HTMLElement, status: OperatorEnvironmentStatus, collapsed: boolean): void {
    const section = collapsed
      ? createDisclosureSection(root, "Setup health", "Keep agent prerequisites visible without making setup the product.")
      : createSection(root, "Setup", "Make the hidden agent pieces visible before you run anything.");
    const grid = section.createDiv({ cls: "operator-status-grid" });

    renderStatusTile(grid, "Vault", status.vault.ready ? "ready" : "missing", status.vault.ready
      ? "Core folders and agent config are present."
      : `Missing ${status.vault.missingFolders.length + status.vault.missingFiles.length} setup item(s).`);
    renderStatusTile(grid, "Codex CLI", status.codexCli, status.details.codexCli);
    renderStatusTile(grid, "Codex login", status.codexLogin, status.details.codexLogin);
    renderStatusTile(grid, "Operator skills", status.operatorSkills, status.details.operatorSkills);
    renderStatusTile(grid, "Gmail", status.gmail, status.details.gmail, true);
    renderStatusTile(grid, "Gemini", status.gemini, status.details.gemini, true);
    renderStatusTile(grid, "Calendar", status.calendar, status.details.calendar, true);
    renderStatusTile(grid, "Multi-agent", status.multiAgent, status.details.multiAgent, true);

    const controls = section.createDiv({ cls: "operator-controls-row" });
    createButton(controls, "download", status.operatorSkills === "ready" || status.operatorSkills === "warning" ? "Update Operator skills" : "Install Operator skills", () => {
      void this.plugin.installOrUpdateCodexMarketplace();
    }, undefined, status.codexCli !== "ready" || !!this.plugin.activeRun);
    createButton(controls, "folder-check", status.vault.ready ? "Refresh vault setup" : "Initialize vault", () => {
      void this.plugin.initializeVaultFromUi();
    }, "mod-cta", !!this.plugin.activeRun);
  }

  private renderStartDay(root: HTMLElement, status: OperatorEnvironmentStatus): void {
    const section = createSection(root, "Start Day", "One editable shortcut into the existing /daily-init workflow.");
    const row = section.createDiv({ cls: "operator-form-row" });
    const hoursWrap = row.createDiv({ cls: "operator-field" });
    hoursWrap.createEl("label", { text: "Available hours" });
    const hoursInput = hoursWrap.createEl("input", {
      attr: {
        type: "number",
        min: "1",
        max: "16",
        step: "1",
        value: String(this.plugin.settings.availableHours),
      },
    });
    hoursInput.addEventListener("change", () => {
      this.plugin.settings.availableHours = Number(hoursInput.value) || 6;
      void this.plugin.saveSettings();
    });

    const manualWrap = row.createDiv({ cls: "operator-field operator-grow" });
    manualWrap.createEl("label", { text: "Manual items" });
    const manualInput = manualWrap.createEl("input", {
      attr: {
        placeholder: "Optional: call Alice, review deck",
      },
    });

    const canRun = this.canRun(status);
    createButton(row, "sun", "Start my day", () => {
      void this.plugin.runDailyBriefing(Number(hoursInput.value) || this.plugin.settings.availableHours, manualInput.value);
    }, "mod-cta", !canRun);

    if (!canRun) {
      section.createEl("p", {
        cls: "operator-help",
        text: "Daily briefing unlocks after Codex, login, Operator skills, and vault setup are ready.",
      });
    }
  }

  private renderHomePanels(root: HTMLElement, home: OperatorHomeState): void {
    const section = createSection(root, "Current Work", `${home.weekFolder} is the source of truth for today's blockers and meetings.`);
    const grid = section.createDiv({ cls: "operator-home-grid" });

    const projects = grid.createDiv({ cls: "operator-home-panel" });
    projects.createEl("h4", { text: "Active projects" });
    if (home.activeProjects.length === 0) {
      projects.createEl("p", { cls: "operator-muted", text: "No active project notes found in 02_Projects/." });
    } else {
      const list = projects.createEl("ul", { cls: "operator-list" });
      for (const project of home.activeProjects.slice(0, 6)) {
        const item = list.createEl("li");
        item.createEl("strong", { text: project.name });
        item.createEl("span", { text: project.nextActions.join(" ") });
        const actions = item.createDiv({ cls: "operator-inline-actions" });
        createButton(actions, "file-text", "Open", () => void this.plugin.openVaultPath(project.notePath));
        createButton(actions, "refresh-cw", "Sync", () => {
          void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("project-sync", project.name));
        });
      }
    }

    const waiting = grid.createDiv({ cls: "operator-home-panel" });
    waiting.createEl("h4", { text: "Waiting on / blockers" });
    if (home.blockers.waitingOn.length === 0) {
      waiting.createEl("p", { cls: "operator-muted", text: "No unchecked Waiting On items in this week's Blockers.md." });
    } else {
      const list = waiting.createEl("ul", { cls: "operator-list" });
      for (const item of home.blockers.waitingOn.slice(0, 8)) {
        list.createEl("li", { text: item.text });
      }
    }
    createButton(waiting, "file-text", "Open blockers", () => void this.plugin.openVaultPath(home.blockersPath));

    const meetings = grid.createDiv({ cls: "operator-home-panel" });
    meetings.createEl("h4", { text: "Meetings" });
    if (home.blockers.meetings.length === 0) {
      meetings.createEl("p", { cls: "operator-muted", text: "No unchecked meetings found in this week's Blockers.md." });
    } else {
      const list = meetings.createEl("ul", { cls: "operator-list" });
      for (const meeting of home.blockers.meetings.slice(0, 8)) {
        const item = list.createEl("li");
        item.createEl("strong", { text: meeting.timing });
        item.createEl("span", { text: meeting.dateIso ? `${meeting.dateIso} - ${meeting.text}` : meeting.text });
        const actions = item.createDiv({ cls: "operator-inline-actions" });
        if (meeting.project) {
          const args = [meeting.project, meeting.dateIso].filter(Boolean).join(" ");
          createButton(actions, "clipboard-list", "Prep", () => {
            void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("meeting-prep", args));
          });
        }
      }
    }
  }

  private renderWorkflowShortcuts(root: HTMLElement, status: OperatorEnvironmentStatus, home: OperatorHomeState): void {
    const section = createSection(root, "Workflows", "Buttons are shortcuts into editable prompts. CLI and raw skills still work.");
    const canRun = this.canRun(status);
    const grid = section.createDiv({ cls: "operator-workflow-grid" });

    const planWeek = createWorkflowCard(grid, "Plan week", "Open or review the current execution layer.");
    createButton(planWeek, "calendar-plus", "Weekly setup", () => {
      void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("weekly-init"));
    }, undefined, !canRun);
    createButton(planWeek, "list-checks", "Weekly review", () => {
      void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("weekly-review"));
    }, undefined, !canRun);

    const project = createWorkflowCard(grid, "Work on project", "Create, sync, or deadline-plan a project.");
    const projectInput = createInlineInput(project, "Project name", "Customer Discovery", home.activeProjects[0]?.name ?? "");
    createButton(project, "folder-plus", "Create", () => {
      const projectName = requireInput(projectInput, "a project name");
      if (projectName) {
        void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("project-init", projectName));
      }
    }, undefined, !canRun);
    createButton(project, "refresh-cw", "Sync", () => {
      const projectName = requireInput(projectInput, "a project name");
      if (projectName) {
        void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("project-sync", projectName));
      }
    }, undefined, !canRun);
    createButton(project, "target", "Deadline plan", () => {
      const projectName = requireInput(projectInput, "a project name");
      if (projectName) {
        void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("deadline-plan", projectName));
      }
    }, undefined, !canRun);

    const meeting = createWorkflowCard(grid, "Process meeting", "Prep before, process transcript after.");
    const meetingProject = createInlineInput(meeting, "Project", "ProjectAlpha", home.activeProjects[0]?.name ?? "");
    const meetingDate = createInlineInput(meeting, "Date", "YYYY-MM-DD", formatDateKey(new Date()));
    const meetingInput = createInlineInput(meeting, "Transcript path or text", "");
    createButton(meeting, "clipboard-list", "Prep", () => {
      const projectName = requireInput(meetingProject, "a project name");
      if (projectName) {
        void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("meeting-prep", `${projectName} ${meetingDate.value}`));
      }
    }, undefined, !canRun);
    createButton(meeting, "mic", "Process", () => {
      const meetingSource = requireInput(meetingInput, "a transcript path or pasted transcript");
      if (meetingSource) {
        void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("meeting", meetingSource));
      }
    }, undefined, !canRun);

    const content = createWorkflowCard(grid, "Content / research", "Mine notes, draft, or run a deeper research brief.");
    const topicInput = createInlineInput(content, "Topic or backlog item", "");
    createButton(content, "sparkles", "Extract ideas", () => {
      void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("content-extract"));
    }, undefined, !canRun);
    createButton(content, "pen-line", "Draft", () => {
      const topic = requireInput(topicInput, "a topic or backlog item");
      if (topic) {
        void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("content-draft", topic));
      }
    }, undefined, !canRun);
    createButton(content, "search", "Deep research", () => {
      const topic = requireInput(topicInput, "a research topic");
      if (topic) {
        void this.plugin.previewAndRunWorkflow(buildWorkflowSpec("deep-research", topic));
      }
    }, undefined, !canRun);

    const advanced = createWorkflowCard(grid, "Advanced prompt", "Keep the full skill surface reachable.");
    const custom = advanced.createEl("textarea", {
      cls: "operator-prompt-input",
      attr: { rows: "3", placeholder: "/daily-init 6, review grant proposal" },
    });
    createButton(advanced, "terminal", "Preview and run", () => {
      const prompt = requireInput(custom, "a prompt");
      if (prompt) {
        void this.plugin.previewAndRunWorkflow(describePrompt(prompt));
      }
    }, "mod-cta", !canRun);
  }

  private renderQuickCapture(root: HTMLElement): void {
    const section = createSection(root, "Quick Capture", "Append lightweight inputs to today's note without starting an agent run.");
    const row = section.createDiv({ cls: "operator-form-row" });
    const select = row.createEl("select", { cls: "operator-select" });
    select.createEl("option", { attr: { value: "idea" }, text: "Idea" });
    select.createEl("option", { attr: { value: "task" }, text: "Task" });
    select.createEl("option", { attr: { value: "meeting" }, text: "Meeting note" });
    select.createEl("option", { attr: { value: "research" }, text: "Research question" });
    const field = row.createDiv({ cls: "operator-field operator-grow" });
    field.createEl("label", { text: "Capture" });
    const input = field.createEl("input", { attr: { placeholder: "Something worth keeping..." } });
    createButton(row, "plus", "Capture", () => {
      void this.plugin.appendCapture(select.value as "idea" | "task" | "meeting" | "research", input.value);
      input.value = "";
    });
  }

  private renderRunLog(root: HTMLElement): void {
    const lastRun = this.plugin.settings.lastRun;
    if (!lastRun) {
      return;
    }

    const section = createSection(root, "Last Run", `${lastRun.workflowLabel ?? "Operator prompt"} (${lastRun.status})`);
    const meta = section.createDiv({ cls: "operator-run-meta" });
    meta.createSpan({ text: `Backend: ${lastRun.backend}` });
    meta.createSpan({ text: `Started: ${new Date(lastRun.startedAt).toLocaleString()}` });
    if (lastRun.endedAt) {
      meta.createSpan({ text: `Ended: ${new Date(lastRun.endedAt).toLocaleString()}` });
    }
    if (lastRun.expectedOpenPath) {
      createButton(meta, "file-text", "Open expected note", () => {
        void this.plugin.openVaultPath(lastRun.expectedOpenPath ?? "");
      });
    }

    const prompt = section.createEl("code", { cls: "operator-run-prompt", text: lastRun.prompt });
    prompt.setAttr("aria-label", "Last Operator prompt");

    const summary = section.createEl("p", {
      cls: "operator-run-summary",
      text: summarizeRunOutput(lastRun),
    });
    if (lastRun.status === "failed") {
      summary.addClass("is-failed");
    }

    const details = section.createEl("details", { cls: "operator-log-details" });
    details.createEl("summary", { text: "Raw log" });

    const output = details.createEl("pre", { cls: "operator-log" });
    output.setText([lastRun.stdout.trim(), lastRun.stderr.trim()].filter(Boolean).join("\n\n") || "No output yet.");
  }

  private canRun(status: OperatorEnvironmentStatus): boolean {
    if (this.plugin.activeRun) {
      return false;
    }
    if (this.plugin.settings.backend === "codex") {
      return canRunCodexWorkflows(status);
    }
    return status.claudeCli === "ready" && status.vault.ready;
  }
}

class OperatorSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: OperatorControlPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Backend").setDesc("Codex is the default supported backend for one-click runs.").addDropdown((dropdown: DropdownComponent) => {
      dropdown
        .addOption("codex", "Codex")
        .addOption("claude", "Claude")
        .setValue(this.plugin.settings.backend)
        .onChange(async (value) => {
          this.plugin.settings.backend = value === "claude" ? "claude" : "codex";
          await this.plugin.saveSettings();
          await this.plugin.refreshStatus();
        });
    });

    addTextSetting(containerEl, "Codex executable", "Command or absolute path for Codex CLI.", this.plugin.settings.codexPath, async (value) => {
      this.plugin.settings.codexPath = value || DEFAULT_SETTINGS.codexPath;
      await this.plugin.saveSettings();
    });

    addTextSetting(containerEl, "Claude executable", "Command or absolute path for Claude Code CLI.", this.plugin.settings.claudePath, async (value) => {
      this.plugin.settings.claudePath = value || DEFAULT_SETTINGS.claudePath;
      await this.plugin.saveSettings();
    });

    addTextSetting(containerEl, "Operator marketplace source", "Codex marketplace source for installing or updating skills.", this.plugin.settings.repoSource, async (value) => {
      this.plugin.settings.repoSource = value || DEFAULT_SETTINGS.repoSource;
      await this.plugin.saveSettings();
    });

    addTextSetting(containerEl, "Vault owner name", "Written into CLAUDE.md and AGENTS.md during vault setup.", this.plugin.settings.vaultOwnerName, async (value) => {
      this.plugin.settings.vaultOwnerName = value || DEFAULT_SETTINGS.vaultOwnerName;
      await this.plugin.saveSettings();
    });

    addTextSetting(containerEl, "Apple Calendar name", "Used by deadline and event workflows.", this.plugin.settings.calendarName, async (value) => {
      this.plugin.settings.calendarName = value || DEFAULT_SETTINGS.calendarName;
      await this.plugin.saveSettings();
    });

    addTextSetting(containerEl, "Apple Reminders list", "Used by deadline and event workflows.", this.plugin.settings.remindersList, async (value) => {
      this.plugin.settings.remindersList = value || DEFAULT_SETTINGS.remindersList;
      await this.plugin.saveSettings();
    });

    addTextSetting(containerEl, "Meeting recordings base", "Default path pattern for meeting recordings.", this.plugin.settings.meetingRecordingsBase, async (value) => {
      this.plugin.settings.meetingRecordingsBase = value || DEFAULT_SETTINGS.meetingRecordingsBase;
      await this.plugin.saveSettings();
    });

    new Setting(containerEl)
      .setName("Runner authorization")
      .setDesc("Reset this if you want Operator to ask before launching Codex or Claude again.")
      .addButton((button: ButtonComponent) => {
        button.setButtonText("Reset authorization").onClick(async () => {
          this.plugin.settings.hasAcceptedRunnerWarning = false;
          await this.plugin.saveSettings();
          new Notice("Operator will ask before the next run.");
        });
      });
  }
}

class RunnerConsentModal extends Modal {
  constructor(
    app: App,
    private readonly resolve: (accepted: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("operator-consent-modal");
    contentEl.createEl("h2", { text: "Allow Operator to run an agent?" });
    contentEl.createEl("p", {
      text: "Operator will launch Codex or Claude as a background process in this vault. The agent can read and write files in this vault using workspace-write permissions.",
    });
    contentEl.createEl("p", {
      text: "It will not use full-disk or dangerous sandbox bypass settings by default.",
    });
    const row = contentEl.createDiv({ cls: "operator-modal-actions" });
    createButton(row, "x", "Cancel", () => {
      this.resolve(false);
      this.close();
    });
    createButton(row, "check", "Allow", () => {
      this.resolve(true);
      this.close();
    }, "mod-cta");
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class RunPreviewModal extends Modal {
  constructor(
    app: App,
    private readonly spec: OperatorWorkflowRunSpec,
    private readonly backend: string,
    private readonly vaultPath: string,
    private readonly resolve: (spec: OperatorWorkflowRunSpec | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("operator-preview-modal");
    contentEl.createEl("h2", { text: `Preview: ${this.spec.label}` });
    contentEl.createEl("p", {
      cls: "operator-muted",
      text: "Review and edit the exact prompt before Operator launches the agent.",
    });

    const meta = contentEl.createDiv({ cls: "operator-preview-meta" });
    meta.createSpan({ text: `Backend: ${this.backend}` });
    meta.createSpan({ text: `Vault: ${this.vaultPath}` });

    const field = contentEl.createDiv({ cls: "operator-field" });
    field.createEl("label", { text: "Prompt" });
    const promptInput = field.createEl("textarea", {
      cls: "operator-prompt-input",
      attr: { rows: "4" },
    });
    promptInput.value = this.spec.prompt;

    const columns = contentEl.createDiv({ cls: "operator-preview-grid" });
    renderAreaList(columns, "Likely reads", this.spec.readAreas);
    renderAreaList(columns, "Likely writes", this.spec.writeAreas);

    const row = contentEl.createDiv({ cls: "operator-modal-actions" });
    createButton(row, "x", "Cancel", () => {
      this.resolve(null);
      this.close();
    });
    createButton(row, "play", "Run", () => {
      const edited = describePrompt(promptInput.value);
      this.resolve({
        ...edited,
        label: edited.id === this.spec.id ? this.spec.label : edited.label,
      });
      this.close();
    }, "mod-cta");
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function createSection(parent: HTMLElement, title: string, description: string): HTMLElement {
  const section = parent.createDiv({ cls: "operator-section" });
  const header = section.createDiv({ cls: "operator-section-header" });
  header.createEl("h3", { text: title });
  header.createEl("p", { text: description });
  return section;
}

function createDisclosureSection(parent: HTMLElement, title: string, description: string): HTMLElement {
  const details = parent.createEl("details", { cls: "operator-section operator-disclosure" });
  const summary = details.createEl("summary");
  const header = summary.createDiv({ cls: "operator-section-header" });
  header.createEl("h3", { text: title });
  header.createEl("p", { text: description });
  return details;
}

function createWorkflowCard(parent: HTMLElement, title: string, description: string): HTMLElement {
  const card = parent.createDiv({ cls: "operator-workflow-card" });
  card.createEl("h4", { text: title });
  card.createEl("p", { cls: "operator-muted", text: description });
  return card;
}

function createInlineInput(parent: HTMLElement, label: string, placeholder: string, value = ""): HTMLInputElement {
  const field = parent.createDiv({ cls: "operator-field" });
  field.createEl("label", { text: label });
  const input = field.createEl("input", { attr: { placeholder } });
  input.value = value;
  return input;
}

function requireInput(input: HTMLInputElement | HTMLTextAreaElement, label: string): string | null {
  const value = input.value.trim();
  if (value) {
    return value;
  }

  input.focus();
  new Notice(`Enter ${label} first.`);
  return null;
}

function createButton(
  parent: HTMLElement,
  icon: string,
  label: string,
  onClick: () => void,
  extraClass?: string,
  disabled = false,
): HTMLButtonElement {
  const button = parent.createEl("button", { cls: "operator-button" });
  if (extraClass) {
    button.addClass(extraClass);
  }
  const iconEl = button.createSpan({ cls: "operator-button-icon" });
  setIcon(iconEl, icon);
  button.createSpan({ text: label });
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function renderAreaList(parent: HTMLElement, title: string, areas: string[]): void {
  const panel = parent.createDiv({ cls: "operator-preview-panel" });
  panel.createEl("strong", { text: title });
  const list = panel.createEl("ul", { cls: "operator-list" });
  for (const area of areas) {
    list.createEl("li", { text: area });
  }
}

function renderStatusTile(
  parent: HTMLElement,
  label: string,
  state: StatusState,
  detail: string,
  optional = false,
): void {
  const tile = parent.createDiv({ cls: `operator-status-tile is-${state}` });
  const header = tile.createDiv({ cls: "operator-status-title" });
  header.createSpan({ text: label });
  header.createSpan({ cls: "operator-chip", text: optional && state === "missing" ? "optional" : state });
  tile.createEl("p", { text: detail });
}

function renderAdvancedItem(
  parent: HTMLElement,
  title: string,
  command: string,
  detail: string,
  state: StatusState,
): void {
  const item = parent.createDiv({ cls: "operator-advanced-item" });
  item.createEl("strong", { text: title });
  item.createEl("code", { text: command });
  item.createEl("p", { text: detail });
  item.createSpan({ cls: `operator-chip is-${state}`, text: state === "ready" ? "ready" : "limited" });
}

function addTextSetting(
  parent: HTMLElement,
  name: string,
  description: string,
  value: string,
  onChange: (value: string) => Promise<void>,
): void {
  new Setting(parent)
    .setName(name)
    .setDesc(description)
    .addText((text: TextComponent) => {
      text.setValue(value).onChange((nextValue) => {
        void onChange(nextValue.trim());
      });
    });
}

function summarizeInitialization(result: VaultInitializationResult): string {
  const created = result.createdFolders.length + result.createdFiles.length;
  const updated = result.updatedFiles.length;
  if (created === 0 && updated === 0) {
    return "Operator vault setup is already present.";
  }
  return `Operator vault setup complete: ${created} created, ${updated} config file(s) updated.`;
}

function summarizeRunOutput(run: OperatorRunRecord): string {
  if (run.status === "running") {
    return "Running now. Output will appear in the raw log as the agent reports progress.";
  }

  const combined = [run.stdout, run.stderr]
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("exec") && !line.startsWith("warning:"))
    .slice(-4);

  if (combined.length > 0) {
    return combined.join(" ");
  }

  if (run.status === "success") {
    return run.expectedOpenPath
      ? `Finished. Review the result in ${run.expectedOpenPath}.`
      : "Finished successfully.";
  }

  return `Run ${run.status}. Open the raw log for details.`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
