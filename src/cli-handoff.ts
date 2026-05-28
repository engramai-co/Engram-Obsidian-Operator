import { describePrompt } from "./workflows";

export function buildCliHandoff(vaultPath: string | null, prompt: string, date = new Date()): string {
  const rawPrompt = prompt.trim() || "/daily-init 6";
  const enhancedPrompt = describePrompt(rawPrompt, date).prompt;
  const cdLine = vaultPath ? `cd ${shellQuote(vaultPath)}` : "cd <your-vault-path>";
  return [
    cdLine,
    "codex",
    "# Paste this prompt into Codex:",
    ...enhancedPrompt.split(/\r?\n/).map((line) => `# ${line}`),
  ].join("\n");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
