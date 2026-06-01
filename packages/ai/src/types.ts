export interface CellContext {
  source: string;
  stdout?: string;
  stderr?: string;
  hasFigure?: boolean;
}

export interface GenerateCellInput {
  /** Natural language description of what the user wants. */
  prompt: string;
  /** Cells already in the notebook, in order. */
  context: CellContext[];
  /** Names of variables currently in workspace. */
  workspaceVars: string[];
}

export interface ExplainOutputInput {
  cell: CellContext;
}

export interface AiClient {
  generateCell(input: GenerateCellInput): Promise<string>;
  explainOutput(input: ExplainOutputInput): Promise<string>;
}
