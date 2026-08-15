# Architecture

## Boundaries

Ladder Graph has three deliberately narrow layers:

1. The React studio owns interaction, YAML CST patching, layout, browser files, copy/download, and local persistence.
2. A dedicated Web Worker owns the asynchronous compiler protocol and keeps parsing/compilation off the UI thread.
3. The Rust WebAssembly core owns LGIR semantics, diagnostics, hashing, normalization, migration, and deterministic target generation.

If WebAssembly cannot initialize, the worker uses the TypeScript parity compiler so projects remain recoverable. Production builds include and prefer the Rust module.

## Source of truth

LGIR YAML is canonical. Canvas actions patch the YAML document rather than maintaining a second graph database. When YAML syntax is invalid, source editing and autosave continue, the canvas becomes read-only, and `lastValidYaml` preserves a recoverable graph.

The checked-in JSON Schema is a portable editor contract. Rust remains the semantic authority because schema validation alone cannot enforce graph topology, structured loop and group ownership, target support, or deterministic ordering.

## Compiler pipeline

```text
YAML bytes
  → security limits and parse
  → typed LGIR document
  → ID/contract/control-flow validation
  → deterministic topological order
  → source hash and capability analysis
  → Codex/Claude/Hermes instruction adapter or Python/TypeScript data adapter
  → one self-contained Markdown or source-code artifact
```

Visual macros create canonical nodes and edges in YAML before analysis, keeping persisted files portable and avoiding a hidden runtime expansion format.

Python and TypeScript output is generated from the same normalized data. It contains stable node order, explicit dependency maps, capability templates, and pure readiness helpers. Generated modules never evaluate node expressions, import providers, call connectors, or supply an execution runtime; host applications must bind and authorize handlers explicitly.

## Persistence

Project metadata, active YAML, last-valid YAML, targets, template indexes, and revision indexes live in IndexedDB. Revision bodies prefer OPFS and fall back to IndexedDB. Autosave keeps valid and invalid revisions distinct and prunes to the most recent 30 revisions per project.

The application requests persistent browser storage only after an explicit user action. It exposes quota and persistence state and never describes browser storage as a backup.

## Deployment

`vite-plugin-pwa` generates the service worker and manifest. The shell, schema, self-hosted fonts, worker, and WebAssembly are precached. Vercel serves the static `dist` directory with CSP and security headers; no server or provider integration is required.
