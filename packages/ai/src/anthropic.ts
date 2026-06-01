import {
  SYSTEM_EXPLAIN_OUTPUT,
  SYSTEM_GENERATE_CELL,
  userPromptExplain,
  userPromptGenerate,
} from "./prompts.js";
import type { AiClient, ExplainOutputInput, GenerateCellInput } from "./types.js";

export interface AnthropicClientOpts {
  apiKey: string;
  model?: string;
  /** Pass a custom fetch (e.g., to route through a server proxy that hides keys). */
  fetch?: typeof fetch;
  baseUrl?: string;
}

export class AnthropicClient implements AiClient {
  private model: string;
  private fetcher: typeof fetch;
  private baseUrl: string;

  constructor(private opts: AnthropicClientOpts) {
    this.model = opts.model ?? "claude-opus-4-7";
    this.fetcher = opts.fetch ?? fetch;
    this.baseUrl = opts.baseUrl ?? "https://api.anthropic.com";
  }

  async generateCell(input: GenerateCellInput): Promise<string> {
    const text = await this.complete(SYSTEM_GENERATE_CELL, userPromptGenerate(input), 1024);
    return stripCodeFences(text).trim();
  }

  async explainOutput(input: ExplainOutputInput): Promise<string> {
    return this.complete(SYSTEM_EXPLAIN_OUTPUT, userPromptExplain(input), 512);
  }

  private async complete(system: string, user: string, maxTokens: number): Promise<string> {
    const res = await this.fetcher(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.opts.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`);
    }

    const data: any = await res.json();
    const block = data?.content?.[0];
    if (block?.type === "text" && typeof block.text === "string") return block.text;
    throw new Error("Anthropic response had no text block");
  }
}

function stripCodeFences(s: string): string {
  return s.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```\s*$/, "");
}
