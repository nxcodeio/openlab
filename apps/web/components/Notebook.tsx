"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MockKernel } from "@openlab/kernel";
import { AnthropicClient, cellContextFromCells } from "@openlab/ai";
import { Cell } from "./Cell";
import { AiBar } from "./AiBar";
import { Settings } from "./Settings";
import {
  blankNotebook,
  loadApiKey,
  loadNotebook,
  newCell,
  saveApiKey,
  saveNotebook,
  type Notebook as NotebookT,
} from "@/lib/store";

const EXAMPLES = [
  "x = linspace(0, 2*pi, 200);\nplot(x, sin(x))",
  "t = linspace(0, 10, 500);\ny = exp(-0.3*t) .* cos(2*pi*t);\nplot(t, y)",
  "x = linspace(-3, 3, 100);\nplot(x, exp(-x.^2))",
];

export function Notebook() {
  const [nb, setNb] = useState<NotebookT>(() => blankNotebook());
  const [apiKey, setApiKey] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const kernelRef = useRef<MockKernel | null>(null);

  useEffect(() => {
    setNb(loadNotebook());
    setApiKey(loadApiKey());
    kernelRef.current = new MockKernel();
  }, []);

  useEffect(() => {
    saveNotebook(nb);
  }, [nb]);

  const aiClient = useMemo(() => {
    if (!apiKey) return null;
    return new AnthropicClient({ apiKey });
  }, [apiKey]);

  const updateCell = useCallback((id: string, patch: Partial<NotebookT["cells"][number]>) => {
    setNb((prev) => ({
      ...prev,
      cells: prev.cells.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const runCell = useCallback(
    async (id: string) => {
      const cell = nb.cells.find((c) => c.id === id);
      if (!cell || !kernelRef.current) return;
      updateCell(id, { status: "running" });
      const result = await kernelRef.current.execute(cell.source);
      updateCell(id, {
        status: "idle",
        result: {
          stdout: result.stdout,
          stderr: result.stderr,
          figures: result.figures,
          error: result.error,
        },
      });
    },
    [nb.cells, updateCell],
  );

  const addCell = useCallback((source = "") => {
    const cell = newCell(source);
    setNb((prev) => ({ ...prev, cells: [...prev.cells, cell] }));
    return cell.id;
  }, []);

  const deleteCell = useCallback((id: string) => {
    setNb((prev) => {
      const next = prev.cells.filter((c) => c.id !== id);
      return { ...prev, cells: next.length ? next : [newCell()] };
    });
  }, []);

  const explainCell = useCallback(
    async (id: string) => {
      const cell = nb.cells.find((c) => c.id === id);
      if (!cell || !cell.result || !aiClient) {
        if (!aiClient) setSettingsOpen(true);
        return;
      }
      setExplainingId(id);
      try {
        const explanation = await aiClient.explainOutput({
          cell: {
            source: cell.source,
            stdout: cell.result.stdout,
            stderr: cell.result.stderr,
            hasFigure: cell.result.figures.length > 0,
          },
        });
        updateCell(id, { result: { ...cell.result, explanation } });
      } catch (err) {
        updateCell(id, {
          result: {
            ...cell.result,
            explanation: `AI error: ${(err as Error).message}`,
          },
        });
      } finally {
        setExplainingId(null);
      }
    },
    [nb.cells, aiClient, updateCell],
  );

  const generateFromAi = useCallback(
    async (prompt: string) => {
      if (!aiClient || !kernelRef.current) {
        setSettingsOpen(true);
        return;
      }
      const context = cellContextFromCells(nb.cells);
      const ws = await kernelRef.current.execute("").then((r) => Object.keys(r.variables));
      const source = await aiClient.generateCell({ prompt, context, workspaceVars: ws });
      const id = addCell(source);
      setTimeout(() => void runCell(id), 50);
    },
    [aiClient, nb.cells, addCell, runCell],
  );

  const handleKeyDown = useCallback(
    (id: string, e: React.KeyboardEvent) => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        void runCell(id);
      }
    },
    [runCell],
  );

  const hasContent = nb.cells.some((c) => c.source.trim() || c.result);

  return (
    <div className="app" onKeyDown={(e) => {
      if (e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        const active = document.activeElement as HTMLElement;
        const cell = active?.closest("[data-cell-id]") as HTMLElement | null;
        if (cell?.dataset.cellId) void runCell(cell.dataset.cellId);
      }
    }}>
      <div className="topbar">
        <div className="logo">
          Open<span>Lab</span>
          <span style={{ marginLeft: 12, fontSize: 12, color: "var(--text-faint)", fontWeight: 400 }}>v0.0.1</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="status">
            <span className="dot" />
            {kernelRef.current?.name ?? "boot..."}
          </span>
          <button onClick={() => setSettingsOpen(true)}>settings</button>
          <a href="https://github.com/nxcodeio/openlab" style={{ color: "var(--text-dim)", fontSize: 13 }}>GitHub</a>
        </div>
      </div>

      <AiBar
        onGenerate={generateFromAi}
        needsApiKey={!aiClient}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="notebook">
        <div className="notebook-inner">
          {!hasContent && (
            <div className="empty">
              <h2>Start a notebook</h2>
              <p>Type MATLAB code into a cell, or describe what you want in the bar above. Try one of these:</p>
              <div style={{ marginTop: 16 }}>
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    className="example"
                    onClick={() => {
                      const id = nb.cells[0]?.id;
                      if (id) {
                        updateCell(id, { source: ex });
                        setTimeout(() => void runCell(id), 50);
                      }
                    }}
                  >
                    {ex.split("\n")[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {nb.cells.map((cell, i) => (
            <div key={cell.id} data-cell-id={cell.id} onKeyDown={(e) => handleKeyDown(cell.id, e)}>
              <Cell
                cell={cell}
                index={i}
                onChange={(source) => updateCell(cell.id, { source })}
                onRun={() => void runCell(cell.id)}
                onDelete={() => deleteCell(cell.id)}
                onExplain={() => void explainCell(cell.id)}
                explaining={explainingId === cell.id}
              />
            </div>
          ))}

          <div className="add-cell">
            <button onClick={() => addCell()}>+ add cell</button>
          </div>
        </div>
      </div>

      <Settings
        open={settingsOpen}
        initialKey={apiKey}
        onSave={(k) => {
          setApiKey(k);
          saveApiKey(k);
        }}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
