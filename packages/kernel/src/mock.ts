import type { Figure, Kernel, KernelResult, Value, Workspace } from "./types.js";

/**
 * MockKernel — handles a small subset of MATLAB syntax in pure JS so the UI is
 * alive before a real engine is wired up. Not intended as a real interpreter.
 *
 * Supports: numeric literals, vectors `[1 2 3]`, comments `%`, assignment,
 * arithmetic on scalars/vectors (+ - * / .* ./ .^), function calls
 * (linspace, zeros, ones, sin, cos, tan, exp, log, sqrt, abs, sum, mean, length, plot, disp),
 * and trailing `;` to suppress output.
 */
export class MockKernel implements Kernel {
  readonly name = "MockKernel (demo)";
  ready = true;
  private workspace: Workspace = {};

  async init(): Promise<void> {}

  async reset(): Promise<void> {
    this.workspace = {};
  }

  async execute(code: string): Promise<KernelResult> {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const figures: Figure[] = [];
    let error = false;

    const lines = splitStatements(code);

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      try {
        const suppress = line.endsWith(";");
        const stmt = suppress ? line.slice(0, -1).trim() : line;

        const assignMatch = stmt.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
        if (assignMatch) {
          const [, name, rhs] = assignMatch as [string, string, string];
          const value = this.evaluate(rhs, figures);
          this.workspace[name] = value;
          if (!suppress) stdout.push(`${name} = ${formatValue(value)}`);
          continue;
        }

        const value = this.evaluate(stmt, figures);
        if (value !== undefined && !suppress) {
          stdout.push(`ans = ${formatValue(value)}`);
          this.workspace.ans = value;
        }
      } catch (e) {
        error = true;
        stderr.push(`error: ${(e as Error).message} (line: "${line}")`);
        break;
      }
    }

    return {
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n"),
      figures,
      variables: { ...this.workspace },
      error,
    };
  }

  private evaluate(expr: string, figures: Figure[]): Value {
    return evalExpr(stripComments(expr), this.workspace, figures);
  }
}

function splitStatements(code: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  for (const ch of code) {
    if (ch === "[" || ch === "(") depth++;
    if (ch === "]" || ch === ")") depth--;
    if ((ch === "\n" || (ch === ";" && depth === 0)) && buf.trim()) {
      if (ch === ";") buf += ";";
      out.push(buf);
      buf = "";
    } else if (ch !== "\n") {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

function stripComments(s: string): string {
  const idx = s.indexOf("%");
  if (idx === -1) return s;
  return s.slice(0, idx);
}

function evalExpr(expr: string, ws: Workspace, figures: Figure[]): Value {
  const tokens = tokenize(expr);
  const parser = new Parser(tokens, ws, figures);
  const value = parser.parseExpr();
  if (!parser.done()) throw new Error(`unexpected token "${parser.peek()}"`);
  return value;
}

type Token = { type: "num" | "id" | "op" | "lpar" | "rpar" | "lbr" | "rbr" | "comma" | "semi"; value: string };

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.eE+\-]/.test(s[j]!)) {
        if ((s[j] === "+" || s[j] === "-") && j > i && !/[eE]/.test(s[j - 1]!)) break;
        j++;
      }
      tokens.push({ type: "num", value: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j]!)) j++;
      tokens.push({ type: "id", value: s.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "(") { tokens.push({ type: "lpar", value: c }); i++; continue; }
    if (c === ")") { tokens.push({ type: "rpar", value: c }); i++; continue; }
    if (c === "[") { tokens.push({ type: "lbr", value: c }); i++; continue; }
    if (c === "]") { tokens.push({ type: "rbr", value: c }); i++; continue; }
    if (c === ",") { tokens.push({ type: "comma", value: c }); i++; continue; }
    if (c === ";") { tokens.push({ type: "semi", value: c }); i++; continue; }
    if (".*./.^./.\\\\".includes(c) || "+-*/^\\".includes(c)) {
      const two = s.slice(i, i + 2);
      if (["./", ".*", ".^", ".\\"].includes(two)) {
        tokens.push({ type: "op", value: two });
        i += 2;
        continue;
      }
      tokens.push({ type: "op", value: c });
      i++;
      continue;
    }
    throw new Error(`unexpected char "${c}"`);
  }
  return tokens;
}

class Parser {
  private i = 0;
  constructor(private tokens: Token[], private ws: Workspace, private figures: Figure[]) {}

  done(): boolean { return this.i >= this.tokens.length; }
  peek(): string { return this.tokens[this.i]?.value ?? "<eof>"; }
  private eat(): Token { return this.tokens[this.i++]!; }
  private match(type: Token["type"], value?: string): boolean {
    const t = this.tokens[this.i];
    if (!t) return false;
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    this.i++;
    return true;
  }

  parseExpr(): Value { return this.parseAdditive(); }

  private parseAdditive(): Value {
    let left = this.parseMultiplicative();
    while (this.tokens[this.i]?.type === "op" && (this.tokens[this.i]!.value === "+" || this.tokens[this.i]!.value === "-")) {
      const op = this.eat().value;
      const right = this.parseMultiplicative();
      left = op === "+" ? add(left, right) : sub(left, right);
    }
    return left;
  }

  private parseMultiplicative(): Value {
    let left = this.parseUnary();
    while (this.tokens[this.i]?.type === "op" && ["*", "/", ".*", "./", ".^"].includes(this.tokens[this.i]!.value)) {
      const op = this.eat().value;
      const right = this.parseUnary();
      left = applyOp(op, left, right);
    }
    return left;
  }

  private parseUnary(): Value {
    if (this.tokens[this.i]?.type === "op" && this.tokens[this.i]!.value === "-") {
      this.eat();
      const v = this.parseUnary();
      return applyOp("*", -1, v);
    }
    if (this.tokens[this.i]?.type === "op" && this.tokens[this.i]!.value === "+") {
      this.eat();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Value {
    const t = this.tokens[this.i];
    if (!t) throw new Error("unexpected end of expression");
    if (t.type === "num") {
      this.i++;
      return parseFloat(t.value);
    }
    if (t.type === "lpar") {
      this.i++;
      const v = this.parseExpr();
      if (!this.match("rpar")) throw new Error('expected ")"');
      return v;
    }
    if (t.type === "lbr") {
      this.i++;
      return this.parseVector();
    }
    if (t.type === "id") {
      this.i++;
      if (this.match("lpar")) return this.parseCall(t.value);
      if (t.value in this.ws) return this.ws[t.value]!;
      if (t.value === "pi") return Math.PI;
      if (t.value === "e") return Math.E;
      throw new Error(`undefined: ${t.value}`);
    }
    throw new Error(`unexpected token: ${t.value}`);
  }

  private parseVector(): Value {
    const items: number[] = [];
    while (!this.match("rbr")) {
      const v = this.parseExpr();
      if (typeof v === "number") items.push(v);
      else if (Array.isArray(v) && typeof v[0] === "number") items.push(...(v as number[]));
      else throw new Error("vector elements must be numeric");
      this.match("comma");
    }
    return items;
  }

  private parseCall(name: string): Value {
    const args: Value[] = [];
    while (!this.match("rpar")) {
      args.push(this.parseExpr());
      this.match("comma");
    }
    return callBuiltin(name, args, this.figures);
  }
}

function callBuiltin(name: string, args: Value[], figures: Figure[]): Value {
  switch (name) {
    case "linspace": {
      const [a, b, n = 100] = args as [number, number, number?];
      const N = Math.floor(n);
      if (N < 2) return [a];
      const step = (b - a) / (N - 1);
      return Array.from({ length: N }, (_, i) => a + step * i);
    }
    case "zeros": return makeVec(args, () => 0);
    case "ones": return makeVec(args, () => 1);
    case "sin": return mapNum(args[0]!, Math.sin);
    case "cos": return mapNum(args[0]!, Math.cos);
    case "tan": return mapNum(args[0]!, Math.tan);
    case "exp": return mapNum(args[0]!, Math.exp);
    case "log": return mapNum(args[0]!, Math.log);
    case "sqrt": return mapNum(args[0]!, Math.sqrt);
    case "abs": return mapNum(args[0]!, Math.abs);
    case "length": return Array.isArray(args[0]) ? (args[0] as number[]).length : 1;
    case "sum": return Array.isArray(args[0]) ? (args[0] as number[]).reduce((a, b) => a + b, 0) : (args[0] as number);
    case "mean": {
      const a = args[0];
      if (!Array.isArray(a)) return a as number;
      return (a as number[]).reduce((s, v) => s + v, 0) / a.length;
    }
    case "max": return Array.isArray(args[0]) ? Math.max(...(args[0] as number[])) : (args[0] as number);
    case "min": return Array.isArray(args[0]) ? Math.min(...(args[0] as number[])) : (args[0] as number);
    case "disp": return args[0] ?? 0;
    case "plot": {
      const fig = makePlotFigure(args);
      figures.push(fig);
      return 0;
    }
    default: throw new Error(`unknown function: ${name}`);
  }
}

function makeVec(args: Value[], fill: () => number): Value {
  const n = (args[0] as number) ?? 1;
  return Array.from({ length: n }, fill);
}

function mapNum(v: Value, f: (x: number) => number): Value {
  if (Array.isArray(v)) return (v as number[]).map(f);
  if (typeof v === "number") return f(v);
  throw new Error(`expected numeric input`);
}

function add(a: Value, b: Value): Value { return zipNum(a, b, (x, y) => x + y); }
function sub(a: Value, b: Value): Value { return zipNum(a, b, (x, y) => x - y); }
function applyOp(op: string, a: Value, b: Value): Value {
  if (op === "*" || op === ".*") return zipNum(a, b, (x, y) => x * y);
  if (op === "/" || op === "./") return zipNum(a, b, (x, y) => x / y);
  if (op === ".^") return zipNum(a, b, (x, y) => Math.pow(x, y));
  throw new Error(`unsupported op: ${op}`);
}

function zipNum(a: Value, b: Value, f: (x: number, y: number) => number): Value {
  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);
  if (!aIsArr && !bIsArr) return f(a as number, b as number);
  if (aIsArr && !bIsArr) return (a as number[]).map((x) => f(x, b as number));
  if (!aIsArr && bIsArr) return (b as number[]).map((y) => f(a as number, y));
  const arrA = a as number[], arrB = b as number[];
  if (arrA.length !== arrB.length) throw new Error(`length mismatch: ${arrA.length} vs ${arrB.length}`);
  return arrA.map((x, i) => f(x, arrB[i]!));
}

function makePlotFigure(args: Value[]): Figure {
  let x: number[], y: number[];
  if (args.length === 1) {
    y = Array.isArray(args[0]) ? (args[0] as number[]) : [args[0] as number];
    x = Array.from({ length: y.length }, (_, i) => i + 1);
  } else {
    x = Array.isArray(args[0]) ? (args[0] as number[]) : [args[0] as number];
    y = Array.isArray(args[1]) ? (args[1] as number[]) : [args[1] as number];
  }
  return {
    type: "plotly",
    data: [{ x, y, type: "scatter", mode: "lines", line: { color: "#7c5cff", width: 2 } }],
    layout: {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#e6e8eb" },
      margin: { t: 24, r: 24, b: 36, l: 48 },
      xaxis: { gridcolor: "#262b33" },
      yaxis: { gridcolor: "#262b33" },
    },
  };
}

function formatValue(v: Value): string {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(4);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    if (v.length > 12) return `[1×${v.length} double]`;
    return "[" + (v as number[]).map((x) => (Number.isInteger(x) ? String(x) : x.toFixed(4))).join(" ") + "]";
  }
  return String(v);
}
