# Plot Fidelity Spike: Octave vs MATLAB

**Date:** 2026-06-01
**Engine versions:** Octave 11.1.0 (default fltk backend), MATLAB ___ (TBD)
**Render script:** `render.m` (engine-agnostic)
**Output dirs:** `octave/` (rendered 2026-06-01) and `matlab/` (TBD by Vivian)

## Why this matters

OpenLab's wedge is "AI generates MATLAB output that looks like MATLAB." If Octave's default output is visually distinct from MATLAB, the AI workflow produces unconvincing results and the wedge collapses.

This spike compares 6 canonical plots rendered with NO custom settings — just the engine's defaults. Where gaps exist, we ship a `matlab-compat-preset.m` that the MCP server auto-loads to align Octave's defaults to MATLAB's.

## Status

| Engine | Status |
|--------|--------|
| Octave 11.1.0 | ✅ Rendered (see `octave/`) |
| MATLAB (any recent) | ⏳ TODO — Vivian runs `render.m` and drops PNGs in `matlab/` |

## How to run the MATLAB side

```matlab
cd /path/to/openlab/docs/spike-fidelity
run('render.m')
```

This drops 6 PNGs into `matlab/`. Then we visually diff `matlab/01-plot.png` vs `octave/01-plot.png` etc.

If you don't have MATLAB access: ask a friend, use a university lab machine, download a 30-day trial, or post a side-by-side request on r/matlab.

## Gaps observed in Octave-only render (preliminary, no MATLAB to compare yet)

These are issues that surfaced just from running Octave's render. Each becomes an entry in `matlab-compat-preset.m` or a documented limitation.

### Gap 1: `legend('Location', 'best')` not supported
- **Symptom:** Octave warns `legend: 'best' not yet implemented for location specifier, using 'northeast' instead`
- **Impact:** Legends collide with titles (see `02-subplot.png` second panel — legend overlaps "Polynomials" title)
- **Fix candidates:**
  - Monkey-patch `legend` to map `'best'` → choose corner with least data overlap (heuristic)
  - Override at MCP layer: rewrite `'best'` → `'northeast'` in generated code (passive)
  - Document as known limitation, advise AI to use explicit positions
- **Severity:** HIGH — AI generates `legend('best', ...)` very often (MATLAB tutorials teach it)

### Gap 2: Missing `FreeSans` font, fallback to system
- **Symptom:** `qt.qpa.fonts: Populating font family aliases ... Replace uses of missing font family "FreeSans"`
- **Impact:** Octave tries to use FreeSans (a Linux font), falls back to system default. On macOS this is Helvetica, which IS what MATLAB uses on macOS. **May actually be a non-issue on macOS** — verify by checking the PNG.
- **Fix:** explicitly set `set(0, 'DefaultAxesFontName', 'Helvetica')` (matches MATLAB macOS default)
- **Severity:** LOW on macOS, MEDIUM on Linux/Windows (different system fonts)

### Gap 3 (suspected): Line color order may differ from MATLAB's `lines` palette
- **Symptom:** In `02-subplot.png`, the second line in the top panel looks brownish-dark-red, not MATLAB's familiar orange (RGB ~0.85, 0.33, 0.10)
- **Impact:** AI-generated multi-line plots will have a visibly different color sequence — instant tell that it's not MATLAB
- **Fix:** `set(0, 'DefaultAxesColorOrder', [...MATLAB's lines palette as 7x3 matrix...])`
- **Severity:** HIGH — multi-line plots are very common in homework
- **Confirm in spike:** compare 02-subplot.png between engines, document exact RGB diff

## Comparison checklist (fill in after MATLAB renders)

For each plot, capture: visible difference, severity (LOW/MED/HIGH), fix in preset.m, or document as known.

### 01-plot.png — single sine wave
| Aspect | Octave | MATLAB | Gap |
|--------|--------|--------|-----|
| Line color | ? | ? | |
| Background | ? | ? | |
| Grid color/style | ? | ? | |
| Axes box | ? | ? | |
| Tick direction | ? | ? | |
| Font | ? | ? | |
| Title font weight | ? | ? | |

### 02-subplot.png — multi-line subplot
| Aspect | Octave | MATLAB | Gap |
|--------|--------|--------|-----|
| Line color order (1st, 2nd, 3rd) | ? | ? | |
| Legend position (best fallback) | ? | ? | |
| Subplot spacing | ? | ? | |

### 03-bode.png — control system bode
| Aspect | Octave | MATLAB | Gap |
|--------|--------|--------|-----|
| Minor gridline style | ? | ? | |
| Auto-title ("Bode Diagram" in MATLAB?) | ? | ? | |
| Phase wrap style | ? | ? | |

### 04-mesh.png — 3D mesh
| Aspect | Octave | MATLAB | Gap |
|--------|--------|--------|-----|
| Colormap (jet vs parula) | ? | ? | |
| View angle | ? | ? | |
| Mesh line style | ? | ? | |

### 05-hist.png — histogram
| Aspect | Octave | MATLAB | Gap |
|--------|--------|--------|-----|
| Bar color | ? | ? | |
| Bar edge | ? | ? | |
| Bin count interpretation | ? | ? | |

### 06-loglog.png — frequency response loglog
| Aspect | Octave | MATLAB | Gap |
|--------|--------|--------|-----|
| Log grid major lines | ? | ? | |
| Log grid minor lines | ? | ? | |
| Line colors | ? | ? | |

## matlab-compat-preset.m — running build

Each row in this table corresponds to a fix shipped in `packages/mcp-server/matlab-compat-preset.m`. The MCP server `source`s this script after kernel startup.

```matlab
% packages/mcp-server/matlab-compat-preset.m
% Auto-sourced by OpenLab MCP at Octave kernel startup.
% Goal: align Octave's defaults to MATLAB's defaults for visual fidelity.

% MATLAB R2019+ default line color order ("lines" palette)
set(0, 'DefaultAxesColorOrder', [
    0.0000  0.4470  0.7410   % blue
    0.8500  0.3250  0.0980   % orange
    0.9290  0.6940  0.1250   % yellow
    0.4940  0.1840  0.5560   % purple
    0.4660  0.6740  0.1880   % green
    0.3010  0.7450  0.9330   % light blue
    0.6350  0.0780  0.1840   % dark red
]);

% Font (MATLAB defaults to Helvetica on macOS, Arial on Windows, Helvetica on Linux)
% On macOS Octave's FreeSans → Helvetica fallback already matches.
% Explicit set for portability:
if ismac()
    set(0, 'DefaultAxesFontName', 'Helvetica');
    set(0, 'DefaultTextFontName', 'Helvetica');
elseif ispc()
    set(0, 'DefaultAxesFontName', 'Arial');
    set(0, 'DefaultTextFontName', 'Arial');
else  % linux / unix
    set(0, 'DefaultAxesFontName', 'DejaVu Sans');
    set(0, 'DefaultTextFontName', 'DejaVu Sans');
end

% Default colormap (MATLAB R2014b+ uses parula, before that jet)
% Octave default is jet (older). Set parula explicitly.
if exist('parula', 'file')
    set(0, 'DefaultFigureColormap', parula(64));
end

% TODO after MATLAB comparison: add more fixes here
```

## Go/no-go decision

Once Vivian provides MATLAB renders:

1. Count HIGH-severity gaps that AREN'T fixable via preset
2. If 0 unfixable HIGH gaps → **GO**: ship preset, move to MCP integration Day 2
3. If 1-2 unfixable HIGH gaps → **CONDITIONAL GO**: document on landing page "Known visual differences vs MATLAB," lower the marketing claim from "looks like MATLAB" to "matches MATLAB syntax + close visual style"
4. If 3+ unfixable HIGH gaps → **REPLAN**: the wedge is weaker than thought. Reconsider whether v0.2 should pitch fidelity at all.
