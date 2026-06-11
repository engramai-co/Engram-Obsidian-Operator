import type { OperatorSettings } from "./settings";
import { getBackendReadiness, type OperatorEnvironmentStatus } from "./status";

export type OnboardingNextAction = "install-codex-skills" | "copy-claude-install" | "initialize-vault" | "none";

export interface OnboardingNextStep {
  title: string;
  detail: string;
  state: "ready" | "needed" | "locked";
  action: OnboardingNextAction;
}

export function getOnboardingNextStep(
  status: OperatorEnvironmentStatus,
  backend: OperatorSettings["backend"],
): OnboardingNextStep {
  const backendLabel = backend === "codex" ? "Codex" : "Claude";
  const backendSkillsReady = backend === "codex" ? status.operatorSkills === "ready" : status.claudeSkills === "ready";
  const readiness = getBackendReadiness(status, backend);

  if (!status.vault.ready) {
    return {
      title: "Initialize vault",
      detail: "Create the core folders and agent config once.",
      state: "needed",
      action: "initialize-vault",
    };
  }

  if (!backendSkillsReady) {
    return {
      title: `Finish ${backendLabel} skills`,
      detail: readiness.ready ? `Install the Operator skills for ${backendLabel}.` : readiness.helpText,
      state: "needed",
      action: backend === "codex" && status.codexCli === "ready"
        ? "install-codex-skills"
        : backend === "claude"
          ? "copy-claude-install"
          : "none",
    };
  }

  if (!readiness.ready) {
    return {
      title: `Finish ${backendLabel} readiness`,
      detail: readiness.helpText,
      state: "locked",
      action: "none",
    };
  }

  return {
    title: "Start my day",
    detail: "Daily briefing is ready to run.",
    state: "ready",
    action: "none",
  };
}
