import type { Figure } from "@openlab/kernel";

export interface Cell {
  id: string;
  source: string;
  result?: {
    stdout: string;
    stderr: string;
    figures: Figure[];
    error: boolean;
    explanation?: string;
  };
  status: "idle" | "running";
}

export interface Notebook {
  id: string;
  title: string;
  cells: Cell[];
  updatedAt: number;
}

const KEY_NOTEBOOK = "openlab.notebook.v1";
const KEY_API_KEY = "openlab.anthropic.key";

export function newCell(source = ""): Cell {
  return { id: makeId(), source, status: "idle" };
}

export function blankNotebook(): Notebook {
  return {
    id: makeId(),
    title: "Untitled",
    cells: [newCell()],
    updatedAt: Date.now(),
  };
}

export function loadNotebook(): Notebook {
  if (typeof window === "undefined") return blankNotebook();
  try {
    const raw = localStorage.getItem(KEY_NOTEBOOK);
    if (!raw) return blankNotebook();
    return JSON.parse(raw) as Notebook;
  } catch {
    return blankNotebook();
  }
}

export function saveNotebook(nb: Notebook): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_NOTEBOOK, JSON.stringify({ ...nb, updatedAt: Date.now() }));
}

export function loadApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY_API_KEY) ?? "";
}

export function saveApiKey(key: string): void {
  if (typeof window === "undefined") return;
  if (key) localStorage.setItem(KEY_API_KEY, key);
  else localStorage.removeItem(KEY_API_KEY);
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}
