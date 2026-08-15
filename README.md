# Ladder Graph

Design agent workflows visually. Validate the hard parts. Copy a prompt Codex or Claude can follow.

Ladder Graph is an open-source, offline-first visual compiler for agent workflows. It provides a synchronized graph and LGIR YAML editor, structured loops, typed dependencies, diagnostics, local templates, and deterministic Markdown adapters. It does not run agents or contact model providers.

## Run locally

Requirements: Node.js 20+, npm 10+, and optionally Rust stable plus `wasm-pack` when regenerating the committed compiler artifacts.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The production PWA is built with:

```bash
npm run build
npm run preview
```

## Verify

```bash
npm run typecheck
npm test
npm run rust:test
npm run wasm:build
npm run build
```

The Rust-generated files in `src/wasm/pkg` are intentionally committed so static deployments do not need a Rust toolchain.

## What the MVP includes

- Three outcome-led starter workflows and eight editable role templates.
- Eleven canonical node kinds, three edge kinds, and four visual macros.
- DAG validation, structured bounded loops, safe declarative transforms, target capability reporting, and stable diagnostics.
- One self-contained Markdown artifact for Codex or Claude.
- IndexedDB and OPFS persistence, invalid-draft recovery, import/export, revisions, installable PWA behavior, and no telemetry.

See [ladder-graph-specs.md](ladder-graph-specs.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [ladder-graph-validation-plan.md](ladder-graph-validation-plan.md).

## Security model

Imported YAML is data, never code. Ladder Graph rejects custom tags, aliases, external references, arbitrary cycles, oversized documents, and unsupported transforms. Generated Markdown does not grant tools or permissions. Browser storage is convenient local state, not a durable backup; export important workflows.

## License

Apache-2.0. See [LICENSE](LICENSE).
