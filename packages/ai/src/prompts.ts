import type { CellContext, ExplainOutputInput, GenerateCellInput } from "./types.js";

export const SYSTEM_GENERATE_CELL = `You are a MATLAB programming assistant inside OpenLab, a browser-native notebook.

Rules:
- Output ONLY valid MATLAB / Octave code. No prose, no markdown fences, no comments unless they clarify a non-obvious step.
- Code runs in a shared workspace, so reference existing variables when they exist instead of redefining them.
- Prefer vectorized expressions over loops.
- For plots, use plot(), scatter(), bar(), histogram(), imagesc(), surf(), contour(). End the cell with the plot call (no semicolon).
- Suppress noisy intermediate output with trailing semicolons.
- If the request is ambiguous, pick the most useful concrete interpretation and just write it. Do not ask the user.`;

export const SYSTEM_EXPLAIN_OUTPUT = `You are explaining the output of a MATLAB cell to a user in OpenLab.

Rules:
- Keep it under 80 words.
- Focus on what the output MEANS — physical interpretation, units, shape, anomalies.
- If a plot was produced, describe what it shows (axes, trend, notable features).
- No code suggestions unless the user explicitly asked.`;

export function userPromptGenerate(input: GenerateCellInput): string {
  const parts: string[] = [];
  if (input.workspaceVars.length) {
    parts.push(`Variables currently in workspace: ${input.workspaceVars.join(", ")}`);
  }
  if (input.context.length) {
    parts.push("Previous cells:");
    input.context.forEach((c, i) => {
      parts.push(`--- cell ${i + 1} ---`);
      parts.push(c.source);
      if (c.stdout) parts.push(`stdout: ${truncate(c.stdout, 400)}`);
      if (c.stderr) parts.push(`stderr: ${truncate(c.stderr, 400)}`);
      if (c.hasFigure) parts.push(`(produced a figure)`);
    });
  }
  parts.push("Request:");
  parts.push(input.prompt);
  return parts.join("\n");
}

export function userPromptExplain(input: ExplainOutputInput): string {
  const parts: string[] = ["Cell source:", input.cell.source];
  if (input.cell.stdout) parts.push(`stdout:\n${truncate(input.cell.stdout, 2000)}`);
  if (input.cell.stderr) parts.push(`stderr:\n${truncate(input.cell.stderr, 2000)}`);
  if (input.cell.hasFigure) parts.push("A figure was produced.");
  return parts.join("\n\n");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "… [truncated]" : s;
}

export function cellContextFromCells(
  cells: Array<{ source: string; result?: { stdout?: string; stderr?: string; figures?: unknown[] } }>,
): CellContext[] {
  return cells.map((c) => ({
    source: c.source,
    stdout: c.result?.stdout,
    stderr: c.result?.stderr,
    hasFigure: !!c.result?.figures?.length,
  }));
}
