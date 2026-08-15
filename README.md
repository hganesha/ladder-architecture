# Ladder Graph

Design agent workflows visually. Validate the hard parts. Compile prompts or deterministic code.

Ladder Graph is an open-source, offline-first visual compiler for agent workflows. It provides a synchronized graph and LGIR YAML editor, structured loops, sequential or parallel execution groups, typed dependencies, diagnostics, local templates, deterministic Markdown adapters for Codex, Claude, and Hermes Agent, and deterministic data modules for Python and TypeScript. It does not run agents or contact model providers.

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

- Sixteen outcome-led starter workflows and 68 editable role templates, including researched software, security, and architecture/design specialists.
- Eleven canonical node kinds, three edge kinds, and four visual macros.
- DAG validation, structured bounded loops, bounded execution groups with aggregate or serialized exits, safe declarative transforms, target capability reporting, and stable diagnostics.
- One self-contained Markdown artifact for Codex, Claude, or Hermes Agent, or an importable deterministic data module for Python or TypeScript.
- Target-aware skill and connector templates with per-node customization stored directly in LGIR, including 15 declarative OpenRouter image, video, speech, music, and transcription profiles.
- IndexedDB and OPFS persistence, invalid-draft recovery, import/export, revisions, installable PWA behavior, and no telemetry.

See [ladder-graph-specs.md](ladder-graph-specs.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [ladder-graph-validation-plan.md](ladder-graph-validation-plan.md).

## Security model

Imported YAML is data, never code. Ladder Graph rejects custom tags, aliases, external references, arbitrary cycles, oversized documents, and unsupported transforms. Generated artifacts do not grant tools or permissions, and generated source is never executed by Ladder Graph. Browser storage is convenient local state, not a durable backup; export important workflows.

## License

Apache-2.0. See [LICENSE](LICENSE).
