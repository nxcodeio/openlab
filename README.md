# OpenLab

> A browser-native, AI-first technical computing notebook. MATLAB syntax. Zero install. Talks back.

OpenLab is what MATLAB would look like if it were built in 2026. Open it in a tab. Type `plot(sin(0:0.01:2*pi))`. Or just say "graph a damped oscillator from 0 to 10 seconds" and watch a cell appear.

No 3 GB install. No license server. No lag.

## Why

MATLAB is the lingua franca of engineering education and a lot of industrial R&D — but the product is 40 years old and shows it. It costs $2k+ a year, takes 30 seconds to launch, and the IDE looks like it's from 2005. Free alternatives (GNU Octave, Scilab) are syntax-compatible but technically and visually decades behind.

Python ate data science. Nothing has taken engineering computing.

OpenLab is the bet that engineers don't want a new language — they want their language with a modern UX and an AI that understands what they're trying to compute.

## Design principles

1. **Engine-agnostic.** The notebook UI doesn't care if MATLAB code runs on Octave WASM, a transpiled Pyodide backend, native MATLAB, or RunMat. The `Kernel` interface is the only contract.
2. **AI is a first-class citizen, not a sidebar.** "Describe what to compute" generates cells. The model sees your variables and plots, not just text.
3. **Browser-first.** Zero install. Share a notebook by sharing a URL.
4. **Reactive when possible, imperative when needed.** Cells re-run when their inputs change (Marimo/Observable style), but you can pin or disable.
5. **The 80% subset.** We will never have every MATLAB toolbox. We will have the functions 95% of users actually touch — arrays, plotting, signal, stats, control basics, linear algebra.

## Status

Early scaffolding (v0.0.1). The kernel package, AI package, and web app are in place. Octave WASM integration is the next milestone.

## Architecture

```
openlab/
├── packages/
│   ├── kernel/          # @openlab/kernel — Kernel interface + implementations
│   │   └── src/
│   │       ├── types.ts          # Kernel, KernelResult, Figure, Workspace
│   │       └── octave.ts         # OctaveWasmKernel
│   └── ai/              # @openlab/ai — prompt templates + LLM client
└── apps/
    └── web/             # Next.js 15 notebook UI
```

The `Kernel` interface is the load-bearing abstraction. Swap engines without touching the UI:

```ts
interface Kernel {
  init(): Promise<void>;
  execute(code: string): Promise<{
    stdout: string;
    stderr: string;
    figures: Figure[];
    variables: Workspace;
  }>;
  reset(): Promise<void>;
}
```

## Quick start

```bash
pnpm install
pnpm dev
# open http://localhost:3000
```

You'll need an Anthropic API key to use the AI Bar — paste it in the settings panel; it's stored in `localStorage` and only sent to your own browser's fetch to api.anthropic.com.

## Roadmap

- [x] Monorepo + kernel/ai package scaffold
- [x] Notebook UI (cells, run, output, plots)
- [ ] OctaveWasmKernel wired up to rwl/octave-wasm build
- [ ] AI Bar — natural language → cell generation
- [ ] AI explain — model reads plot + output, narrates
- [ ] Reactive re-run (cells depend on upstream cells)
- [ ] Notebook list + cloud sync (Supabase)
- [ ] PyodideKernel — MATLAB syntax → NumPy AST transpiler (engine alternative)
- [ ] RunMatKernel — wrap runmat-org/runmat as an engine option
- [ ] Export to standalone HTML / PDF / MATLAB `.m` file

## License

MIT
