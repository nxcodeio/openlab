# Engine Spike: Octave WASM (for browser)

**Date:** 2026-06-01
**Author:** Vivian Chi
**Status:** ⚠️ **NO-GO for v0.2**, recommend defer to v0.3
**Build artifact location (if Docker build completes):** `openlab-octave-wasm` Docker image, container `/usr/src/octave-wasm/target/worker/octave.{js,wasm}`

## Question

Can we ship a working Octave-in-browser kernel (`OctaveWasmKernel`) for v0.2 launch in 2 weeks, covering the 25 Tier-1 + 9 Tier-2 functions used by undergrad signals-and-systems coursework?

## TL;DR

**Probably yes, eventually. Not in v0.2's 2-week window.** Recommend MCP-first launch with native Octave (see [`engine-spike-native.md`](engine-spike-native.md) — 45/45 PASS, ready Day 2), and revisit WASM for v0.3 once the MCP product validates the demand.

The blocking issues are structural, not technical:
1. **No prebuilt artifact** anywhere — no GitHub releases, no npm package, no CDN
2. **Build pipeline is heavy** — full Emscripten + LAPACK + SuiteSparse + Octave compile, ~1-2 hours per build, requires Docker
3. **Only vintage Octave available** — the only maintained build chain (`rwl/octave-wasm`) vendors **Octave 4.4.1 from 2018**, 7 years behind upstream Octave 11.1.0
4. **License attribution is non-trivial** — distributing GPLv3 Octave from MIT OpenLab requires NOTICE/LICENSES discipline (doable, but additional Week-1 work that competes with engine integration)

## Candidates surveyed

### 1. `rwl/octave-wasm` (primary candidate)
- **URL:** https://github.com/rwl/octave-wasm
- **License:** BSD-3 for build system; outputs GPLv3 Octave WASM
- **Last meaningful update:** 2025-12-31 (~5 months ago, semi-active)
- **Vintage:** Makefile references `octave-4.4.1` (released 2018-08), Dockerfile uses Emscripten SDK 3.1.24
- **README claims 7.2.0** but source tree is 4.4.1 — discrepancy unresolved upstream
- **Distribution:** **no prebuilt artifacts, no GitHub releases.** Must `make build` via Docker.
- **Build process:** ~21,000 files cloned (~95 MB working tree). Dockerfile installs Ubuntu 20.04 base + 200+ apt packages (gfortran, build tools, texinfo, gnuplot, etc.) + Emscripten 3.1.24 + builds f2c → libf2c → fort77 → LAPACK → PCRE → SuiteSparse → Octave 4.4.1, all cross-compiled to WASM. Estimated build time: **1-2 hours** on a recent Mac.
- **Sample interface:** `test/web/index.html` (1144 bytes) and `test/worker/` (worker.js, promise-worker.js) — minimal browser glue, requires the build output in `target/worker/octave.js + octave.wasm`.
- **Build attempted during this spike** (log at `/tmp/octave-wasm-build/build.log`): **FAILED at first apt-get step** (`exit code: 100`, `Unable to fetch some archives`). Cause: Dockerfile targets Ubuntu 20.04 (focal), now in extended maintenance — some Ubuntu archives have changed and the apt-get install line breaks out-of-the-box. Would require Dockerfile patching just to start the actual Octave build. **Reinforces the NO-GO conclusion**: not only is the build pipeline 1-2 hours, the upstream build is broken on a fresh 2026 machine and needs unmaintained-repo archaeology to revive.

### 2. `lukew3/octave-wasm` (NOT actually octave-wasm)
- **URL:** https://github.com/lukew3/octave-wasm
- **Homepage:** https://webvm.io
- **Reality:** This is a fork of **WebVM** (Leaning Technologies / CheerpX) — a full Linux VM running in browser. Octave is installed inside the Debian image.
- **Size:** Multi-hundred-MB Ext2 filesystem image
- **Verdict:** Wrong category. Not a clean "Octave compiled to WASM" — it's "Linux VM in WASM with Octave inside." Way too heavy for the use case.

### 3. `matpower.app` (live deployed example, no longer hosted)
- **URL:** https://matpower.app
- **Status:** Created 2020, last updated 2021-02 (5+ years stale). No longer ships Octave WASM in current bundles.
- **Analysis:** `chunk-vendors.js` (290 KB) and `app.js` (217 KB) contain zero `octave` or `.wasm` references. Probed common paths (`/octave.wasm`, `/worker/octave.wasm`, etc.) → all 404.
- **Conclusion:** Cannot measure real-world blob size or load time from any live deployment.

### 4. NPM ecosystem
- `npm search octave` returns: empty placeholder package (`octave@0.0.0` from 2017), `highlightjs-octave` (syntax highlighting only), `octave-bands` (audio EQ, unrelated). **No useful WASM build on npm.**

### 5. VSCode extension `rwl.vscode-octave-wasm`
- Could theoretically bundle a prebuilt blob. Marketplace page does not document artifact details. Would require downloading .vsix and unpacking — defer as a Plan B if Docker build fails.

## Estimated blob characteristics (extrapolated, not measured)

Based on the Makefile's third-party deps (LAPACK + SuiteSparse + Octave + Pango/Cairo for plotting):

| Metric | Estimate | Risk |
|---|---|---|
| WASM blob size (raw) | 40-80 MB | Above iOS Safari's 50 MB service-worker cache quota |
| WASM blob size (gzipped) | 15-30 MB | Acceptable on broadband, painful on mobile |
| Cold init time (desktop Chrome) | 3-5 s | Acceptable with progress UI |
| Cold init time (iOS Safari) | 8-15 s + possible OOM | High risk |
| SharedArrayBuffer required | Likely yes (threads) | Needs COOP/COEP headers in `vercel.json` |
| Tier 1 function coverage | Probably 100% (it's full Octave 4.4.1) | Low risk |
| Tier 2 (signal/control) | **Unknown** — Forge packages may or may not be included in the build | High risk |

These numbers will be replaced with measurements if the Docker build completes.

## Strategic comparison vs native Octave (via MCP)

| Dimension | WASM in browser | Native via MCP |
|---|---|---|
| Octave version | 4.4.1 (vintage 2018) | 11.1.0 (current 2026) |
| Cold start | 3-15 s estimated | 273 ms measured |
| Build pipeline | 1-2 hour Docker, custom | None — upstream binaries |
| Distribution | Ship 40-80 MB blob | User runs `brew install octave` (one-time) |
| Hosting cost | Edge CDN bandwidth (modest) | $0 (runs on user's machine) |
| Tier 1 / Tier 2 coverage | Tier 1 likely; Tier 2 uncertain | **45/45 verified PASS** |
| iOS Safari support | Likely broken (memory cap) | Out of scope (MCP is desktop tools) |
| AI tool integration | Requires us to build the API | MCP server IS the AI integration |
| **Time to ship** | **2+ weeks of risk** | **1-2 days to integrate** |

The native path is strictly better for v0.2's stated goal of "Show HN-ready MATLAB notebook + MCP server in 2 weeks." Browser WASM is the right work, in the wrong order.

## Recommendation

### v0.2: **MCP server with native Octave only.** Drop browser WASM from this milestone.

This pivots the v0.2 narrative slightly:
- **Old hero:** "Free MATLAB in a browser tab. With an MCP server so Claude can run it."
- **New hero (v0.2):** "An MCP server that lets Claude / Cursor run real MATLAB. Browser notebook coming soon."

The Show HN angle is **just as strong** — arguably stronger — because:
1. MCP is the on-trend keyword. "Free MATLAB MCP server" is the unique claim.
2. The browser story can be teased ("v0.3 will add a browser notebook running the same kernel via WASM") which keeps interest after launch.
3. We avoid shipping a half-working browser experience with vintage Octave that gets roasted in HN comments for `bode()` returning the wrong answer or `eig()` differing from MATLAB.

### v0.3: Revisit WASM with the MCP product validating demand

If v0.2 lands well (≥50 MCP installs, ≥3 GitHub issues, traction on r/ClaudeAI), commit a 3-4 week sprint to:
1. Build `rwl/octave-wasm` from source (one-time, multi-hour Docker), pin the artifact, push to a CDN
2. Wire `OctaveWasmKernel` to the prebuilt blob via Module.locateFile
3. Test on Safari + iOS, measure real blob size / init time
4. Add `/privacy` page and finalize NOTICE/LICENSES for GPL Octave distribution
5. Update web UI to gracefully fall back to "use the MCP server" if WASM init fails

### v0.4+: Engine optionality

Reconsider once we have telemetry on what users actually need:
- **Pyodide + MATLAB→NumPy transpiler**: faster, modern Python ecosystem, but requires writing transpiler
- **RunMat kernel adapter**: depends on RunMat exposing a stable kernel API
- **Cloud-hosted Octave (server-side)** for users who can't install locally: this is the HTTP API path, already in v0.3 design

## Open follow-ups

1. ~~If Docker build completes overnight~~ Build failed (Ubuntu focal apt archives broken). Not worth resurrecting; the conclusion stands without the measurements.
2. **Investigate `rwl.vscode-octave-wasm`** — download .vsix, see if it bundles a usable prebuilt. Half-day spike. If a prebuilt exists, v0.3 plan shortens by 1 week.
3. **Email upstream `rwl`** asking about plans for a prebuilt release or hosted CDN. Low effort, possible huge win.

## Decision log

- **NO-GO for v0.2 WASM:** 2026-06-01. Pivot v0.2 to MCP-first.
- **WASM revisit gate:** v0.2 launch success metrics (see design doc §Success Criteria). If achieved, begin v0.3 WASM sprint within 30 days of v0.2 launch.
