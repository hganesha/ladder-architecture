/// <reference lib="webworker" />

import type { Target } from "../types";
import { analyzeFallback, compileFallback, formatFallback, migrateFallback } from "./fallback";

type Operation = "analyze" | "compile" | "format" | "migrate";
interface WorkerRequest {
  id: number;
  operation: Operation;
  source: string;
  target?: Target;
  toVersion?: string;
}

interface WasmModule {
  default: () => Promise<unknown>;
  analyze: (source: string, target?: string) => string;
  compile: (source: string, target: string) => string;
  format: (source: string) => string;
  migrate: (source: string, toVersion: string) => string;
}

let wasm: WasmModule | null = null;
let runtime: "wasm" | "fallback" = "fallback";

async function loadWasm() {
  try {
    const module = (await import("../wasm/pkg/lgir_core.js")) as unknown as WasmModule;
    await module.default();
    wasm = module;
    runtime = "wasm";
  } catch {
    wasm = null;
    runtime = "fallback";
  }
}

const ready = loadWasm();

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  await ready;
  try {
    let result: unknown;
    if (wasm) {
      const raw =
        request.operation === "analyze"
          ? wasm.analyze(request.source, request.target)
          : request.operation === "compile"
            ? wasm.compile(request.source, request.target ?? "codex")
            : request.operation === "format"
              ? wasm.format(request.source)
              : wasm.migrate(request.source, request.toVersion ?? "ladder.dev/v1alpha1");
      result = JSON.parse(raw);
    } else {
      result =
        request.operation === "analyze"
          ? await analyzeFallback(request.source, request.target)
          : request.operation === "compile"
            ? await compileFallback(request.source, request.target ?? "codex")
            : request.operation === "format"
              ? await formatFallback(request.source)
              : await migrateFallback(request.source, request.toVersion ?? "ladder.dev/v1alpha1");
    }
    self.postMessage({ id: request.id, ok: true, result, runtime });
  } catch (error) {
    self.postMessage({ id: request.id, ok: false, error: error instanceof Error ? error.message : String(error), runtime });
  }
});
