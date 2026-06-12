import type { OperatorRunRecord } from "./settings";

export function formatPreviewExpectedNote(expectedOpenPath: string | undefined, compact: boolean): string {
  if (!expectedOpenPath) {
    return "Expected note: not predicted";
  }
  if (!compact) {
    return `Expected note: ${expectedOpenPath}`;
  }
  return `Expected note: ${expectedOpenPath.split("/").pop() || expectedOpenPath}`;
}

export function formatDashboardExpectedNoteStatus(exists: boolean, status: OperatorRunRecord["status"]): string {
  if (exists) {
    return "Expected note: ready";
  }
  return status === "running" ? "Expected note: pending" : "Expected note: missing";
}

export function formatExpectedNoteOpenHelp(exists: boolean, status: OperatorRunRecord["status"]): string {
  if (exists) {
    return "Open expected note";
  }
  return status === "running"
    ? "Expected note is not available yet; the run may still be writing it."
    : "Expected note was not found in this vault yet.";
}

export function formatRunCompletionNotice(
  status: OperatorRunRecord["status"],
  expectedOpenPath?: string,
  openedExpectedNote = false,
): string {
  if (status === "success") {
    if (expectedOpenPath && openedExpectedNote) {
      return `Operator run finished. Opened ${expectedOpenPath}.`;
    }
    if (expectedOpenPath) {
      return `Operator run finished. Expected note not found yet: ${expectedOpenPath}.`;
    }
    return "Operator run finished.";
  }
  return `Operator run ${status}.`;
}
