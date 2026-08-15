import type { AnalysisResult, CompileResult, FormatResult, Target } from "../types";

type Operation = "analyze" | "compile" | "format" | "migrate";
type Pending = { resolve: (value: never) => void; reject: (reason: Error) => void };

class CompilerClient {
  private worker: Worker | null = null;
  private sequence = 0;
  private pending = new Map<number, Pending>();
  runtime: "wasm" | "fallback" = "fallback";

  private ensureWorker() {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "ladder-compiler" });
    this.worker.addEventListener("message", (event) => {
      const { id, ok, result, error, runtime } = event.data as {
        id: number;
        ok: boolean;
        result: never;
        error?: string;
        runtime: "wasm" | "fallback";
      };
      this.runtime = runtime;
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      if (ok) pending.resolve(result);
      else pending.reject(new Error(error || "Compiler worker failed"));
    });
    return this.worker;
  }

  private request<T>(operation: Operation, source: string, extras: Record<string, unknown> = {}) {
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: never) => void, reject });
      this.ensureWorker().postMessage({ id, operation, source, ...extras });
    });
  }

  analyze(source: string, target?: Target) {
    return this.request<AnalysisResult>("analyze", source, { target });
  }
  compile(source: string, target: Target) {
    return this.request<CompileResult>("compile", source, { target });
  }
  format(source: string) {
    return this.request<FormatResult>("format", source);
  }
  migrate(source: string, toVersion: string) {
    return this.request<FormatResult>("migrate", source, { toVersion });
  }
}

export const compiler = new CompilerClient();
