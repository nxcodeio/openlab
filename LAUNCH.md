# Launch playbook — OpenLab (v0.2, MCP server)

This is the skeleton playbook for the v0.2 launch of OpenLab proper: the MCP server + browser notebook. It's intentionally **incomplete** today because v0.2 hasn't shipped yet — engine spikes are done, but the MCP package isn't built.

Update this doc as v0.2 work progresses. Status as of 2026-06-01:

- ✅ Engine spike (native via MCP): GO. `docs/engine-spike-native.md`. 45/45 PASS.
- ✅ Engine spike (browser WASM): NO-GO for v0.2. `docs/engine-spike-wasm.md`. Deferred to v0.3.
- ⏳ Plot fidelity spike (Octave default vs real MATLAB): `docs/spike-fidelity/comparison.md`. Vivian to render MATLAB side and fill in gaps.
- ⏳ `packages/mcp-server` integration: Day 2 task per design doc.
- ⏳ UI improvements (drag-drop, workspace panel, slider, friendly errors): Days 4-7.
- ⏳ Landing page (openlab.dev): Day 8.
- ⏳ 6-8 launch examples: Day 9.

**Sister project shipped first**: [`openlab-style`](https://github.com/nxcodeio/openlab-style) — Python pip package, matplotlib styling. See its [`LAUNCH.md`](https://github.com/nxcodeio/openlab-style/blob/main/LAUNCH.md) for that launch playbook. The current doc is for **after** openlab-style launches and we go bigger with the MCP product.

---

## Positioning (decided in design doc)

Default hero (technical channels):
> "An MCP server that lets Claude, Cursor, and other AI tools run real MATLAB."

Sub-hero:
> "Free, open source, MATLAB-compatible output (not matplotlib in disguise)."

Per-channel framings — same product, different lead per audience (do NOT reuse the same post copy verbatim across channels):

- **HN / r/ClaudeAI** (default technical): "MCP server that lets Claude run real MATLAB"
- **r/EngineeringStudents**: "Get MATLAB-quality output from your AI assistant" — same wedge as openlab-style but for the case where you need real MATLAB code, not just styled plots
- **r/matlab**: "Open source MATLAB-syntax engine, accessible via MCP for AI tools"

**Explicitly NOT used**: any "cheat on homework" framing. Bad PR, bad community fit. Let users discover the use case themselves.

---

## Pre-launch checklist (fill in as v0.2 progresses)

- [ ] `npm install -g @openlab/mcp-server` works on macOS, Ubuntu, Windows
- [ ] MCP server passes the 45-function smoke test on each OS (regenerate `docs/spike-mcp/spike-result.json` from each platform)
- [ ] `matlab-compat-preset.m` ships and closes the plot fidelity gaps from the spike (or gaps documented honestly in landing page "Known limitations" section)
- [ ] Claude Desktop config snippet copy-pastes cleanly and Claude finds the tools after restart
- [ ] Cursor MCP config snippet works
- [ ] 6-8 example notebooks render correctly via MCP path, screenshots ready for landing page
- [ ] Landing page at openlab.dev is live, hero copy matches the positioning above
- [ ] Demo video (~90 sec, screen recording: Claude Desktop → openlab MCP → plot in chat)
- [ ] LICENSES + NOTICE files committed (for browser WASM in v0.3; v0.2 MCP-only is pure MIT — see `docs/engine-spike-native.md` §Licensing)
- [ ] You have 2-3 hours blocked for launch day comment-replies
- [ ] **sister-project link prominent**: openlab-style cross-promo in OpenLab README + landing footer

---

## Channel-by-channel posts (drafts — finalize before posting)

### Show HN (highest stakes, post Tuesday-Thursday morning Pacific ~9am PT)

Title: `Show HN: OpenLab — MCP server for MATLAB, so Claude / Cursor can run it`

URL: https://github.com/nxcodeio/openlab

First comment (post immediately after submitting):

> Hi HN. OpenLab is two things:
>
> 1. A local MCP server (`@openlab/mcp-server`) that spawns octave-cli and exposes `execute_matlab`, `get_workspace`, `reset_kernel`, and `list_examples` tools to Claude Desktop, Cursor, and any MCP-compatible AI tool.
>
> 2. A browser notebook (web app at openlab.dev) for viewing and iterating on MATLAB notebooks the MCP generates.
>
> Why MCP and not embedded AI: I started by building an in-product AI Bar (BYO Anthropic key, talk to your notebook). It's the wrong direction — embedded LLM is hard (cost, key management, ToS), and the actual value is the AI USING MATLAB, not MATLAB embedding AI. MCP exposes Octave at arm's length and lets the ecosystem compose.
>
> Engine choice: native Octave via subprocess (`brew install octave`, then `npm i -g @openlab/mcp-server`). Browser WASM is deferred to v0.3 — see `docs/engine-spike-wasm.md` for why (`rwl/octave-wasm` is the only candidate, vintage Octave 4.4.1, broken Docker build on current Ubuntu).
>
> Sister project that shipped first: `openlab-style` (Python pip package, matplotlib styling for the "AI's plots don't look like MATLAB" subset of the problem). When matching the look is enough, use that. When you need real MATLAB semantics (`eig`, `bode`, `tf`, control toolbox), use this.
>
> Happy to dig into MCP server design, the Octave subprocess JSON protocol, plot fidelity gaps we found vs real MATLAB, or the broader "AI for MATLAB workflows" thesis.

### r/ClaudeAI

Title: `I built an MCP server that lets Claude run real MATLAB code`

Body:

> Quick context: I've been using Claude Desktop for everything technical, and MATLAB code is one of the gaps — Claude writes great Python but for MATLAB workflows (homework, MATLAB-using research labs, code review) the output doesn't fit.
>
> OpenLab MCP server wraps a local Octave install and exposes execute / workspace / reset tools to Claude via MCP. After installing (npm + brew install octave, ~3 min), you can ask Claude to write MATLAB code and it actually runs, with figures coming back as images in the Claude conversation.
>
> [demo video or screenshot]
>
> Repo: https://github.com/nxcodeio/openlab
> Sister project for the "I just want my plots to LOOK like MATLAB" case: https://github.com/nxcodeio/openlab-style
>
> Feedback welcome — especially from people in MATLAB-heavy fields (DSP, control, finance, instrumentation).

### r/EngineeringStudents

Title: `Free tool: ask AI to do your MATLAB homework, get real MATLAB output (not Python disguised as MATLAB)`

Body:

> Two free tools, sibling projects, both open source:
>
> 1. `openlab-style` (Python pip package): if your AI is using Python + matplotlib, this makes the plots look like MATLAB. One line in ChatGPT Code Interpreter.
>
> 2. `openlab` MCP server (new): if you want the AI to write actual MATLAB code that runs in real Octave (so you can submit the `.m` file), install this + Octave, and Claude Desktop / Cursor can drive it.
>
> Honest disclaimer about academic use: check your school's policy on AI assistance before submitting. These tools make AI-assisted work look like MATLAB; that doesn't change whether it's allowed.
>
> Repos:
> - https://github.com/nxcodeio/openlab-style (Python styling, simpler)
> - https://github.com/nxcodeio/openlab (MCP server, runs real MATLAB syntax)

### r/matlab

Title: `Open source: MCP server exposing Octave to AI tools (Claude, Cursor, etc.)`

Body:

> Built this because AI assistants generate Python + matplotlib for technical work, and for MATLAB users that's a workflow mismatch. OpenLab is an MCP server that wraps a local Octave install and exposes execute/workspace/reset tools to MCP-compatible AI clients.
>
> Not a MATLAB replacement, not a MATLAB clone — just a thin wrapper that lets AI tools speak MATLAB syntax against a real Octave kernel.
>
> Engine: native Octave (user-installed, `brew install octave` / `apt install octave` / Windows installer). MCP server is MIT, Octave stays GPLv3 under user's own install — see [licensing analysis](docs/engine-spike-native.md#licensing-analysis-mcp-path).
>
> Plot fidelity vs real MATLAB: documented in [spike-fidelity/](docs/spike-fidelity/). We ship a `matlab-compat-preset.m` to align Octave's defaults to MATLAB's.
>
> https://github.com/nxcodeio/openlab
>
> Open to PRs and issues, especially for the toolbox-coverage gaps.

---

## Replies / FAQ to pre-write

1. "Why MCP and not a Custom GPT / ChatGPT plugin?"
   - MCP server runs on the user's machine. Zero hosting cost, zero abuse surface, instant install. A hosted Custom GPT would need server-side Octave + sandboxing + cost-cap infra — defer to v0.3+ if there's demand for the zero-install path.

2. "Why not just use Octave Online?"
   - Octave Online has no API, no MCP, no AI integration. OpenLab's value is the AI-tool surface.

3. "Doesn't this make cheating easier?"
   - Honest answer: AI-assisted MATLAB homework is already common; ChatGPT writes Python + matplotlib that students often pass off. OpenLab makes the AI-assisted path **legible** (real MATLAB output, real code) rather than disguised. Whether AI assistance is allowed is your school's policy question, not the tool's.

4. "Why is the browser version not real Octave yet?"
   - Real Octave-in-WASM requires `rwl/octave-wasm` Docker build (vintage Octave 4.4.1, broken on current Ubuntu, 1-2 hour build). Browser uses MockKernel for v0.2; real WASM kernel arrives in v0.3 once we invest in fixing the build pipeline. See `docs/engine-spike-wasm.md`.

5. "Does this work with [arbitrary MCP client]?"
   - If the client supports stdio MCP, yes — Claude Desktop, Cursor, Cody, etc. Remote MCP (HTTP/SSE) is v0.3 work.

6. "What MATLAB functions are supported?"
   - Whatever your local Octave install supports. Core Octave + signal + control packages cover the 45 functions in our smoke test (`docs/spike-mcp/spike-result.json`). Toolbox-specific behavior may differ from MATLAB; documented gaps in `docs/spike-fidelity/comparison.md`.

---

## Success metrics for v0.2 launch

Inherits from design doc § Success Criteria, repeated here for the launch dashboard:

- Browser execute success rate ≥ 70% (track via Supabase telemetry)
- ≥ 50 MCP server installs in launch week (npm download stats, lag ~1 day)
- ≥ 500 unique browser sessions in launch week
- ≥ 30% sessions execute ≥ 3 cells
- ≥ 50 share-URLs created
- ≥ 3 GitHub issues from non-Vivian users
- HN front page for ≥ 2 hours

**Cross-product metric** (relevant once openlab-style has been live for ≥ 1 week):
- Does mentioning openlab-style in the OpenLab launch posts increase openlab-style downloads? If yes, the two-product cross-promo works and v0.3 should keep coupling them.

---

## What this doc does NOT cover yet

The following depend on v0.2 implementation progressing:

- Actual landing page copy (depends on hero + sections being designed)
- Demo video script (depends on UI being shippable)
- Demo notebooks list (depends on which examples render correctly through the MCP path)
- Twitter / X post copy (depends on having a working demo to attach)

Add those sections as v0.2 work happens. This skeleton exists so the launch isn't designed from scratch on Day 14.
