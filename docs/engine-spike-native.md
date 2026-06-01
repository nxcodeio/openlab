# Engine Spike: Octave Native (for MCP server)

**Date:** 2026-06-01
**Author:** Vivian Chi
**Status:** ✅ **GO** — clear path to v0.2 launch
**Spike script:** `docs/spike-mcp/spike.mjs`
**Raw results:** `docs/spike-mcp/spike-result.json`

## Question

Can we drive `octave-cli` from a Node.js subprocess to serve as the engine behind an MCP server (`@openlab/mcp-server`), covering the 25 Tier-1 (core) + 9 Tier-2 (signal/control toolbox) functions we need for v0.2 launch?

## TL;DR

**Yes. 45/45 functions pass. Init 273 ms. Figure capture works.**

Recommend v0.2 ship the MCP server with `OctaveNativeKernel`. Cross-platform install path is documented below.

## Setup

- **Platform:** macOS 24.6.0, Apple Silicon (M-series)
- **Octave install:** `brew install octave` — 11.1.0 (current latest, released early 2026)
- **Install time:** ~3 minutes (heavily cached on this machine; first-time install on a clean box would be ~15-30 min for ~1.5 GB of deps including gfortran, qt, hdf5, suite-sparse, ghostscript)
- **Toolbox packages:** `pkg install -forge signal control` from inside octave-cli — ~30 seconds, ~10 MB on disk
- **Node:** v24.10.0
- **Spike code:** 130-line Node.js script using `child_process.spawn`, sentinel-based completion detection, PNG capture via Octave's `print` to tempdir

## Architecture validated

```
Node.js                                octave-cli (subprocess)
─────────                              ──────────────────────
spawn('octave-cli', ['--no-gui',       <stdin>  ← code wrapped in try/catch + sentinel
  '--no-history',                      <stdout> → result + sentinel marker
  '--quiet', '--interactive'])         <stderr> → warnings + errors
   │
   ├── stdin.write(wrappedCode)
   │       wrappedCode = `try ... ${userCode} ...
   │                      print(figures, "${tmpDir}/...png", "-dpng");
   │                      disp("${sentinel}")`
   │
   └── read stdout until sentinel
       └── scan tmpDir for new PNGs → base64 → return as figures[]
```

Single long-lived child process per MCP instance. Workspace state persists across `execute_matlab` calls naturally (same Octave session). `reset_kernel()` kills and respawns.

## Test results

### Tier 1 — Core (must work for launch)

**36/36 PASS.** Per-call time mostly 27-31 ms (compute), 380-572 ms (plot).

| Function | Status | Time | Figure |
|----------|--------|------|--------|
| fft, ifft, abs, angle, real, imag | PASS | ~28ms | — |
| conv, zeros, ones, eye, linspace, logspace | PASS | ~28ms | — |
| **plot** | PASS | 572ms | 9.7 KB PNG |
| **subplot** | PASS | 494ms | 11.0 KB PNG |
| **semilogx, semilogy, loglog** | PASS | ~380ms | 8.5-9.4 KB PNG |
| **mesh, surf** | PASS | ~400ms | 26-28 KB PNG |
| eig, inv, det, svd, pinv | PASS | ~28ms | — |
| mean, std, var, sum, prod, sort, find | PASS | ~28ms | — |
| length, size, reshape, repmat, hist | PASS | ~28ms | — |

### Tier 2 — Toolbox-dependent (verify in spike)

**9/9 PASS** after installing `signal` and `control` Forge packages.

| Function | Status | Time | Figure | Package required |
|----------|--------|------|--------|------------------|
| filter, freqz | PASS | ~28ms | — | (built-in) |
| butter, cheby1 | PASS | ~50ms | — | signal |
| **bode** | PASS | 653ms | 24 KB PNG | control |
| **step** | PASS | 456ms | 13 KB PNG | control |
| tf, ss, lsim | PASS | ~45ms | — | control |

**Key finding:** the `signal` and `control` packages MUST be installed on the user's machine. MCP server startup will need to:
1. Probe `pkg list` for `signal` and `control`
2. Offer to auto-install via `pkg install -forge signal control` if missing
3. Bail with friendly message if user declines

## Process / protocol findings

### What works
- **Sentinel-based completion detection** is reliable. Generate a random sentinel per call, wrap user code in `try { ... } disp("SENTINEL")`, read stdout until sentinel appears, then split.
- **Figure capture via tempdir + `print()`**: after running user code, enumerate `findall(0, "type", "figure")`, save each to `tmpdir/fig_N.png`. Diff tmpdir before/after the call to know which PNGs are new. Read + base64 encode for MCP response.
- **Default graphics_toolkit on macOS is `fltk`** — works but prints "discouraged" warning to stderr. Filter cosmetic warnings before classifying error/no-error.
- **`--interactive` flag** is critical: without it, octave-cli exits after stdin closes. With it, stdin stays open for multi-call sessions.

### What needs care
- **macOS fltk needs a display** to render figures. On a headless Linux server (CI, Docker, server hosting) we'd need `gnuplot` installed and explicitly set: `graphics_toolkit("gnuplot")`. Document in MCP README install instructions per OS.
- **Octave Forge packages** (`signal`, `control`) install per-user, not system-wide. The MCP server runs as the user, so this is fine, but multi-user systems (lab machines) would need each user to install.
- **stdout includes the Octave prompt `octave:N>`** between calls. Filtering by sentinel is robust to this, but if you parse line-by-line you need to handle prompt noise.

## Cross-platform install matrix (preliminary)

| OS | Octave install | Forge packages | Notes |
|---|---|---|---|
| **macOS (Intel + Apple Silicon)** | `brew install octave` | `pkg install -forge signal control` in Octave | ✅ Verified |
| **Ubuntu / Debian** | `apt install octave octave-signal octave-control` (system packages exist) | Optional: same `pkg install -forge` route | ⏳ Smoke test pending (Day 1.5 GHA runner) |
| **Windows** | Official installer from octave.org (~600 MB MSI) | Use Octave's built-in `pkg install -forge` | ⏳ Smoke test pending; cross-platform spawn semantics need verification |
| **Linux server (headless)** | `apt install octave gnuplot` then set `graphics_toolkit("gnuplot")` in MCP wrapper | Same | ⏳ For future hosted HTTP API path |

## Recommendation for v0.2

### Ship MCP server with native Octave: **GO**

The numbers are decisive:
- 100% function coverage on both tiers (after Forge install)
- 273 ms init (vs WASM ~3-8s estimated)
- Real Octave 11.1.0 — same version a researcher would install
- No build pipeline (we use upstream Octave's official binary)
- Zero hosting cost (runs on user's machine)

### Implementation notes for `packages/mcp-server`

1. **Startup check**:
   ```js
   // verify octave-cli is on PATH
   const { error } = spawnSync('octave-cli', ['--version']);
   if (error) {
     printInstallInstructions(process.platform); // brew / apt / installer URL
     process.exit(1);
   }
   ```

2. **Toolbox check** (warn, don't block):
   ```js
   const probe = await execute('disp(pkg("list", "signal"))');
   if (probe.stdout.includes('empty')) {
     console.warn('signal toolbox not installed. butter/cheby1 will fail.');
     console.warn('Run: pkg install -forge signal control');
   }
   ```

3. **Wrapper template** (battle-tested in spike):
   ```js
   const wrapped = `try
     __ol_figdir__ = "${figDir}";
     ${userCode}
     __ol_figs__ = findall(0, "type", "figure");
     for __ol_i__ = 1:numel(__ol_figs__)
       __ol_path__ = fullfile(__ol_figdir__, sprintf("fig_%d_%d.png", time(), __ol_i__));
       print(__ol_figs__(__ol_i__), __ol_path__, "-dpng");
     endfor
     close all;
   catch __ol_err__
     fprintf(stderr, "OPENLAB_ERROR: %s\\n", __ol_err__.message);
   end_try_catch
   disp("${sentinel}")`;
   ```

4. **stderr filter for cosmetic warnings** — see `spike.mjs:104`. Skip these when classifying errors:
   - `fltk graphics toolkit is discouraged`
   - `FALLBACK (log once)` (mesa SW)
   - `qt.qpa.fonts: Populating font family aliases`
   - `warning: function ... shadows a core library function`

5. **Per-call timeout**: default 30s, configurable via `OPENLAB_TIMEOUT_MS` env. On timeout, kill the child and respawn.

## Open follow-ups (not blocking v0.2)

1. **Windows smoke test** — verify octave-cli spawn works under Node on Windows. Plan: GitHub Actions windows-latest runner.
2. **Ubuntu CI** — verify gnuplot+octave path for headless. Plan: GitHub Actions ubuntu-latest.
3. **MCP SDK integration** — wire the spike's execute/wrapped/sentinel pattern into `@modelcontextprotocol/sdk` tool handlers. Maybe 1 day of work.
4. **Large output handling** — base64-encoded large PNGs (>100 KB) may bloat MCP responses. Consider: cap at 100 KB or write to tempdir + return file path. Defer until v0.2.1 if response sizes are not an issue at launch.

## Licensing analysis (MCP path)

OpenLab repo is **MIT**. GNU Octave is **GPLv3**. The MCP server `spawn()`s `octave-cli` as a subprocess. Does that make OpenLab subject to GPL?

**No.** Per the FSF's own GPL FAQ ([Mere Aggregation](https://www.gnu.org/licenses/gpl-faq.html#MereAggregation), [communicating at arm's length](https://www.gnu.org/licenses/gpl-faq.html#GPLPlugins)):

> "Where's the line between two separate programs, and one program with two parts? This is a legal question, which ultimately judges will decide. We believe that a proper criterion depends both on the mechanism of communication (exec, pipes, rpc, function calls within a shared address space, etc.) and the semantics of the communication (what kinds of information are interchanged). **If the modules are included in the same executable file, they are definitely combined in one program. If modules are designed to run linked together in a shared address space, that almost certainly means combining them into one program. By contrast, pipes, sockets and command-line arguments are communication mechanisms normally used between two separate programs.** So when they are used for communication, the modules normally are separate programs."

OpenLab's MCP server matches the safe pattern:
- **Communication mechanism**: `child_process.spawn('octave-cli', [...])` → stdin/stdout pipes
- **Semantics**: command/response (MATLAB code in, stdout/stderr/figures out) — arm's length
- **No shared address space**, no dynamic linking, no GPL code copied into OpenLab source

**We never distribute Octave.** User installs Octave via their own package manager (`brew install octave`, `apt install octave`, Windows installer from octave.org). The MCP server's package on npm contains zero GPL code — only our MIT-licensed wrapper that spawns whatever `octave-cli` the user has.

This is the standard pattern used by countless MIT/Apache projects that call out to GPL tools (every Node.js project that shells out to `git`, every web app that runs `gcc` for code compilation, every MCP server that wraps system utilities). Not a novel legal position.

**What WOULD trigger GPL obligations**:
- Bundling Octave binary inside `@openlab/mcp-server` npm package → distribution, GPL applies → would need to offer source + ship under GPL-compatible license
- Statically linking against any of Octave's libraries (`liboctave.so`, etc.) → derivative work
- Copying Octave source code (or .m files from Octave's standard library) into OpenLab repo → derivative work

**None of these are in scope for v0.2.** The MCP server is pure MIT, calling user-installed Octave at arm's length.

**Plot fidelity preset** (`packages/mcp-server/matlab-compat-preset.m`): our original .m script that calls Octave's `set()` API. User scripts that consume Octave APIs are not derivative of Octave (otherwise every MATLAB user's homework would be GPL — clearly not the case). MIT.

**Octave Forge packages** (signal, control) used in Tier-2 testing: also GPLv3, also user-installed via `pkg install -forge`. We don't redistribute, no obligation transfer.

**Spike artifacts in this repo**:
- `docs/spike-mcp/spike.mjs` — original Node.js code, MIT (matches OpenLab repo license)
- `docs/spike-mcp/spike-result.json` — generated test report data, MIT (our content)
- `docs/spike-fidelity/render.m` — original .m script, MIT
- `docs/spike-fidelity/octave/*.png` — rendered BY Octave but OUTPUT of a GPL tool is not GPL-encumbered (canonical example: Bison-generated parsers are not GPL). PNGs are MIT/our content.

## Decision log

- **GO** for v0.2 MCP server: 2026-06-01
- **v0.2 launch ships with native Octave via subprocess**, not WASM in browser (see `engine-spike-wasm.md` for that finding)
- **License posture for v0.2: pure MIT, zero GPL distribution.** GPL obligations only return in v0.3 if/when we ship Octave WASM blob in browser (already planned: LICENSES/NOTICE/attribution).
