#!/usr/bin/env node
// OpenLab MCP spike: octave-cli subprocess + JSON line protocol + figure capture
// Goal: prove we can drive octave-cli from Node, get stdout/stderr/figures back as structured data
// Usage: node spike.mjs

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const OCTAVE_BIN = process.env.OPENLAB_OCTAVE_BIN || "octave-cli";
const EXEC_TIMEOUT_MS = 30_000;

// ── 1. Spawn a long-lived octave-cli process ─────────────────────────────────
function startOctave() {
  // --no-gui, --no-history, --quiet: minimal output, no readline noise
  // --interactive: keeps stdin open between commands (default for tty, but we're a pipe)
  const child = spawn(OCTAVE_BIN, ["--no-gui", "--no-history", "--quiet", "--interactive"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, TERM: "dumb" },
  });
  child.on("error", e => { throw new Error(`failed to spawn ${OCTAVE_BIN}: ${e.message}`); });
  return child;
}

// ── 2. Send code, wait for sentinel, capture stdout/stderr + any new PNG files ──
function execute(child, code, figDir) {
  return new Promise((resolve, reject) => {
    const sentinel = `__OPENLAB_DONE_${Math.random().toString(36).slice(2)}__`;
    let stdout = "", stderr = "";
    const before = new Set(readdirSync(figDir));

    const onStdout = chunk => {
      stdout += chunk.toString();
      if (stdout.includes(sentinel)) {
        cleanup();
        const after = new Set(readdirSync(figDir));
        const newPngs = [...after].filter(f => !before.has(f) && f.endsWith(".png"));
        const figures = newPngs.map(f => {
          const path = join(figDir, f);
          const bytes = readFileSync(path);
          unlinkSync(path);
          return { format: "png", base64: bytes.toString("base64"), sizeBytes: bytes.length };
        });
        // strip sentinel from stdout
        const cleanStdout = stdout.split(sentinel)[0];
        resolve({ stdout: cleanStdout, stderr, figures });
      }
    };
    const onStderr = chunk => { stderr += chunk.toString(); };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`execute timeout after ${EXEC_TIMEOUT_MS}ms`));
    }, EXEC_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      child.stdout.off("data", onStdout);
      child.stderr.off("data", onStderr);
    }

    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);

    // Run user code, capture any opened figures, save them as PNGs in figDir, then print sentinel.
    // graphics_toolkit not forced — Octave default (fltk on macOS, may need gnuplot on Linux for headless).
    const wrapped = `
try
  __ol_figdir__ = "${figDir.replace(/\\/g, "\\\\")}";
  ${code}
  __ol_figs__ = findall(0, "type", "figure");
  for __ol_i__ = 1:numel(__ol_figs__)
    __ol_path__ = fullfile(__ol_figdir__, sprintf("fig_%d_%d.png", time(), __ol_i__));
    print(__ol_figs__(__ol_i__), __ol_path__, "-dpng");
  endfor
  close all;
catch __ol_err__
  fprintf(stderr, "OPENLAB_ERROR: %s\\n", __ol_err__.message);
end_try_catch
disp("${sentinel}")
`;
    child.stdin.write(wrapped + "\n");
  });
}

// ── 3. Test battery: Tier 1 (core) + Tier 2 (toolbox-dependent) ──────────────
const TIER1 = [
  ["fft",       "x = sin(2*pi*5*(0:99)/100); y = fft(x); disp(abs(y(1:5)));"],
  ["ifft",      "y = ifft(fft([1 2 3 4])); disp(real(y));"],
  ["abs",       "disp(abs([-3 4]));"],
  ["angle",     "disp(angle(1+1i));"],
  ["real",      "disp(real(3+4i));"],
  ["imag",      "disp(imag(3+4i));"],
  ["conv",      "disp(conv([1 1], [1 -1]));"],
  ["zeros",     "disp(size(zeros(3,4)));"],
  ["ones",      "disp(size(ones(2,2)));"],
  ["eye",       "disp(eye(3));"],
  ["linspace",  "disp(linspace(0, 1, 5));"],
  ["logspace",  "disp(logspace(0, 2, 3));"],
  ["plot",      "plot(1:10, (1:10).^2);"],
  ["subplot",   "subplot(2,1,1); plot(1:5); subplot(2,1,2); plot((1:5).^2);"],
  ["semilogx",  "semilogx(logspace(0,3,10), 1:10);"],
  ["semilogy",  "semilogy(1:10, logspace(0,3,10));"],
  ["loglog",    "loglog(logspace(0,2,10), logspace(0,3,10));"],
  ["mesh",      "[x,y] = meshgrid(-2:.5:2); mesh(x, y, x.^2+y.^2);"],
  ["surf",      "[x,y] = meshgrid(-2:.5:2); surf(x, y, x.^2+y.^2);"],
  ["eig",       "disp(eig(magic(3)));"],
  ["inv",       "disp(inv([1 2; 3 4]));"],
  ["det",       "disp(det([1 2; 3 4]));"],
  ["svd",       "disp(svd([1 2; 3 4]));"],
  ["pinv",      "disp(pinv([1 2; 3 4]));"],
  ["mean",      "disp(mean([1 2 3 4 5]));"],
  ["std",       "disp(std([1 2 3 4 5]));"],
  ["var",       "disp(var([1 2 3 4 5]));"],
  ["sum",       "disp(sum(1:10));"],
  ["prod",      "disp(prod(1:5));"],
  ["sort",      "disp(sort([3 1 4 1 5 9 2 6]));"],
  ["find",      "disp(find([0 1 0 2 0]));"],
  ["length",    "disp(length(1:10));"],
  ["size",      "disp(size([1 2 3; 4 5 6]));"],
  ["reshape",   "disp(reshape(1:6, 2, 3));"],
  ["repmat",    "disp(repmat([1 2], 2, 2));"],
  ["hist",      "x = randn(1000, 1); [n, c] = hist(x, 10); disp(size(n));"],
];

const TIER2 = [
  ["filter",    "b = [0.2 0.2 0.2 0.2 0.2]; y = filter(b, 1, ones(10,1)); disp(y(end));"],
  ["freqz",     "b = [0.2 0.2 0.2 0.2 0.2]; [h, w] = freqz(b, 1, 16); disp(abs(h(1)));"],
  ["butter",    "pkg load signal; [b, a] = butter(4, 0.3); disp(b);"],
  ["cheby1",    "pkg load signal; [b, a] = cheby1(4, 1, 0.3); disp(b);"],
  ["bode",      "pkg load control; sys = tf([1], [1 1 1]); bode(sys);"],
  ["step",      "pkg load control; sys = tf([1], [1 1 1]); step(sys);"],
  ["tf",        "pkg load control; sys = tf([1 2], [1 3 2]); disp(sys);"],
  ["ss",        "pkg load control; sys = ss([0 1; -1 -1], [0; 1], [1 0], 0); disp(sys);"],
  ["lsim",      "pkg load control; sys = tf([1], [1 1]); t = 0:0.1:5; u = ones(size(t)); y = lsim(sys, u, t); disp(y(end));"],
];

// ── 4. Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[spike] octave bin: ${OCTAVE_BIN}`);
  console.log(`[spike] starting subprocess...`);
  const t0 = performance.now();
  const child = startOctave();
  // Wait for octave to be ready (it prints nothing in quiet mode, so just probe)
  const figDir = mkdtempSync(join(tmpdir(), "openlab-spike-"));
  console.log(`[spike] figDir: ${figDir}`);

  // Warmup probe
  const warmup = await execute(child, 'disp("ready");', figDir);
  const initMs = performance.now() - t0;
  console.log(`[spike] init took ${initMs.toFixed(0)}ms, output: ${warmup.stdout.trim()}`);

  const results = [];

  async function runBattery(label, cases) {
    console.log(`\n=== ${label} ===`);
    for (const [name, code] of cases) {
      const tStart = performance.now();
      try {
        const r = await execute(child, code, figDir);
        const tMs = performance.now() - tStart;
        // Filter cosmetic warnings (fltk discouraged, Qt font fallback, mesa SW fallback)
        const realStderr = r.stderr
          .split("\n")
          .filter(line => !/fltk graphics toolkit is discouraged|FLTK graphics toolkit|not actively maintained|unlikely to be fixed|qt toolkit is recommended|FALLBACK \(log once\)|qt\.qpa\.fonts|font family aliases|warning: using the fltk/i.test(line))
          .join("\n");
        const ok = !realStderr.includes("OPENLAB_ERROR") && !realStderr.toLowerCase().includes("error");
        const status = ok ? "PASS" : "FAIL";
        const figNote = r.figures.length ? ` [${r.figures.length} fig, ${r.figures.reduce((s,f)=>s+f.sizeBytes,0)}B]` : "";
        console.log(`  ${status.padEnd(4)} ${name.padEnd(10)} ${tMs.toFixed(0).padStart(5)}ms${figNote}`);
        if (!ok) console.log(`         stderr: ${realStderr.replace(/\n/g, " ").slice(0, 200)}`);
        results.push({ tier: label, name, status, durationMs: tMs, figures: r.figures.length, stderr: realStderr.slice(0, 500) });
      } catch (e) {
        console.log(`  ERR  ${name.padEnd(10)} ${e.message}`);
        results.push({ tier: label, name, status: "ERR", error: e.message });
      }
    }
  }

  await runBattery("TIER 1 (core)", TIER1);
  await runBattery("TIER 2 (toolbox)", TIER2);

  child.stdin.end();
  child.kill();

  // Summary
  console.log("\n=== SUMMARY ===");
  const tier1 = results.filter(r => r.tier === "TIER 1 (core)");
  const tier2 = results.filter(r => r.tier === "TIER 2 (toolbox)");
  const pass = r => r.filter(x => x.status === "PASS").length;
  console.log(`Tier 1: ${pass(tier1)}/${tier1.length} pass`);
  console.log(`Tier 2: ${pass(tier2)}/${tier2.length} pass`);
  console.log(`Init time: ${initMs.toFixed(0)}ms`);
  const figCount = results.reduce((s, r) => s + (r.figures || 0), 0);
  console.log(`Total figures generated: ${figCount}`);

  // Write JSON report
  const report = {
    octaveVersion: process.env.OCTAVE_VERSION || "11.1.0",
    octaveBin: OCTAVE_BIN,
    platform: process.platform,
    arch: process.arch,
    initMs,
    results,
    summary: {
      tier1Pass: pass(tier1),
      tier1Total: tier1.length,
      tier2Pass: pass(tier2),
      tier2Total: tier2.length,
      figureCount: figCount,
    },
    timestamp: new Date().toISOString(),
  };
  const reportPath = join(import.meta.dirname || ".", "spike-result.json");
  await import("node:fs/promises").then(fs => fs.writeFile(reportPath, JSON.stringify(report, null, 2)));
  console.log(`\nReport: ${reportPath}`);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
