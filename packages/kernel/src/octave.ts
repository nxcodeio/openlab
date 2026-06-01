import type { Kernel, KernelResult, Workspace } from "./types.js";

/**
 * OctaveWasmKernel — wraps rwl/octave-wasm.
 *
 * Status: stub. The rwl/octave-wasm build (~80 MB) needs to be hosted under
 * /public/octave-wasm/ and loaded here. Tracking issue: openlab#1.
 */
export class OctaveWasmKernel implements Kernel {
  readonly name = "Octave WASM";
  ready = false;
  private workspace: Workspace = {};

  constructor(private opts: { wasmBaseUrl?: string } = {}) {}

  async init(): Promise<void> {
    throw new Error(
      "OctaveWasmKernel not yet implemented. Use MockKernel for now. " +
        "See packages/kernel/src/octave.ts and the project roadmap.",
    );
  }

  async execute(_code: string): Promise<KernelResult> {
    return {
      stdout: "",
      stderr: "OctaveWasmKernel not implemented.",
      figures: [],
      variables: this.workspace,
      error: true,
    };
  }

  async reset(): Promise<void> {
    this.workspace = {};
  }
}
