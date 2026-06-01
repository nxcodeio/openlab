"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import type { Cell as CellT } from "@/lib/store";
import { PlotView } from "./PlotView";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface Props {
  cell: CellT;
  index: number;
  onChange: (source: string) => void;
  onRun: () => void;
  onDelete: () => void;
  onExplain: () => void;
  explaining: boolean;
}

export function Cell({ cell, index, onChange, onRun, onDelete, onExplain, explaining }: Props) {
  const className = ["cell", cell.status === "running" ? "running" : "", cell.result?.error ? "error" : ""]
    .filter(Boolean)
    .join(" ");

  const onMount = useCallback(
    (_editor: unknown, monaco: any) => {
      try {
        if (!monaco.languages.getLanguages().find((l: any) => l.id === "matlab")) {
          monaco.languages.register({ id: "matlab" });
          monaco.languages.setMonarchTokensProvider("matlab", MATLAB_TOKENS);
        }
      } catch {
        /* monaco env may differ */
      }
    },
    [],
  );

  const editorHeight = Math.max(54, Math.min(360, (cell.source.split("\n").length + 1) * 19));
  const hasOutput = cell.result && (cell.result.stdout || cell.result.stderr || cell.result.figures.length > 0);

  return (
    <div className={className}>
      <div className="cell-toolbar">
        <span>cell {index + 1}</span>
        <div className="tools">
          <button onClick={onRun} disabled={cell.status === "running"} title="Run (Shift+Enter)">
            {cell.status === "running" ? <><span className="spinner" /> running</> : "▶ run"}
          </button>
          {hasOutput && (
            <button onClick={onExplain} disabled={explaining} title="AI explanation">
              {explaining ? <><span className="spinner" /> ...</> : "explain"}
            </button>
          )}
          <button onClick={onDelete} title="Delete cell">delete</button>
        </div>
      </div>
      <div className="cell-editor">
        <MonacoEditor
          height={editorHeight}
          language="matlab"
          theme="vs-dark"
          value={cell.source}
          onChange={(v) => onChange(v ?? "")}
          beforeMount={(monaco) => {
            try {
              monaco.languages.register({ id: "matlab" });
              monaco.languages.setMonarchTokensProvider("matlab", MATLAB_TOKENS);
            } catch {
              /* ignore */
            }
          }}
          onMount={onMount as any}
          options={{
            fontSize: 13,
            fontFamily: "SF Mono, ui-monospace, Menlo, Consolas, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "off",
            folding: false,
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            scrollbar: { vertical: "hidden", horizontal: "hidden" },
            padding: { top: 10, bottom: 10 },
          }}
        />
      </div>
      {cell.result?.stdout && <pre className="cell-output">{cell.result.stdout}</pre>}
      {cell.result?.stderr && <pre className="cell-output stderr">{cell.result.stderr}</pre>}
      {cell.result?.figures?.map((fig, i) => (
        <div key={i} className="figure-container">
          <PlotView figure={fig} />
        </div>
      ))}
      {cell.result?.explanation && (
        <div className="cell-output ai-explanation">{cell.result.explanation}</div>
      )}
    </div>
  );
}

const MATLAB_TOKENS = {
  keywords: [
    "if", "else", "elseif", "end", "for", "while", "do", "break", "continue",
    "function", "return", "global", "persistent", "switch", "case", "otherwise",
    "try", "catch", "true", "false",
  ],
  builtins: [
    "zeros", "ones", "eye", "linspace", "logspace", "reshape", "size", "length",
    "sum", "prod", "mean", "std", "var", "median", "max", "min", "sort", "find",
    "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "exp", "log", "log2",
    "log10", "sqrt", "abs", "real", "imag", "conj", "angle",
    "fft", "ifft", "conv", "filter", "freqz",
    "plot", "scatter", "bar", "histogram", "imagesc", "surf", "contour",
    "subplot", "figure", "hold", "xlabel", "ylabel", "title", "legend", "grid",
    "disp", "fprintf", "sprintf", "num2str", "input",
  ],
  tokenizer: {
    root: [
      [/%.*$/, "comment"],
      [/\b(if|else|elseif|end|for|while|function|return|switch|case|otherwise|try|catch|break|continue|true|false)\b/, "keyword"],
      [/\b(zeros|ones|eye|linspace|logspace|reshape|size|length|sum|prod|mean|std|var|median|max|min|sort|find|sin|cos|tan|exp|log|sqrt|abs|fft|ifft|plot|scatter|bar|histogram|imagesc|surf|contour|subplot|figure|hold|xlabel|ylabel|title|legend|grid|disp|fprintf|sprintf|num2str)\b/, "type.identifier"],
      [/'[^']*'/, "string"],
      [/"[^"]*"/, "string"],
      [/\d+\.\d+([eE][+-]?\d+)?/, "number.float"],
      [/\d+/, "number"],
      [/[+\-*/\\^=<>~!&|]+/, "operator"],
      [/[a-zA-Z_]\w*/, "identifier"],
    ],
  },
} as const;
