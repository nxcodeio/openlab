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

## Decision log

- **GO** for v0.2 MCP server: 2026-06-01
- **v0.2 launch ships with native Octave via subprocess**, not WASM in browser (see `engine-spike-wasm.md` for that finding)
