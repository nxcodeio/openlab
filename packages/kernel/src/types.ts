export interface Figure {
  /** Plotly-style spec — chosen because Octave plot output can be translated to it, and Plotly.js renders client-side. */
  type: "plotly";
  data: Array<Record<string, unknown>>;
  layout?: Record<string, unknown>;
}

export type Scalar = number | string | boolean;
export type Matrix = number[][];
export type Value = Scalar | number[] | Matrix;

export interface Workspace {
  [name: string]: Value;
}

export interface KernelResult {
  stdout: string;
  stderr: string;
  figures: Figure[];
  /** Snapshot of named variables after this execution. */
  variables: Workspace;
  /** True if execution raised an error. stderr will contain the message. */
  error: boolean;
}

export interface Kernel {
  /** Lazy initialize (download WASM, etc.). Safe to call multiple times. */
  init(): Promise<void>;
  /** Execute code in the current workspace. */
  execute(code: string): Promise<KernelResult>;
  /** Wipe workspace and any kernel-side state. */
  reset(): Promise<void>;
  /** Human-readable engine name for the UI status bar. */
  readonly name: string;
  /** True after init() resolves. */
  readonly ready: boolean;
}
