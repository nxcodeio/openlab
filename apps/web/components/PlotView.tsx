"use client";

import dynamic from "next/dynamic";
import type { Figure } from "@openlab/kernel";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export function PlotView({ figure }: { figure: Figure }) {
  return (
    <Plot
      data={figure.data as any}
      layout={{ autosize: true, height: 320, ...(figure.layout ?? {}) } as any}
      config={{ displaylogo: false, responsive: true }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}
