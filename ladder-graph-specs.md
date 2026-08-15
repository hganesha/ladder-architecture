# Ladder Graph MVP Specification

Status: implemented MVP baseline
Product surface: offline-first visual compiler
LGIR version: `ladder.dev/v1alpha1`

## Product outcome

Ladder Graph helps developers design agent workflows visually, validate the hard parts, and copy one self-contained Markdown workflow that Codex or Claude can follow.

The MVP is a compiler, not an agent runtime. It never calls a model, executes a shell command, invokes MCP, stores provider credentials, or claims that an instructional target feature is mechanically enforced.

### Primary user journey

Within ten minutes, a developer can:

1. Open an outcome-led template.
2. Edit a role or prompt in the inspector.
3. Inspect the synchronized LGIR YAML.
4. Identify an unbounded loop diagnostic.
5. Apply the safe bounded-loop repair.
6. Select Codex or Claude.
7. Validate and compile.
8. Copy or download one Markdown workflow.

Activation occurs when a user validates and copies or downloads a workflow with at least three agent or control nodes.

## Scope

### Included

- Visual and YAML authoring of deterministic workflows.
- Dependencies, typed data edges, control edges, parallel branches, joins, conditions, evaluations, approvals, structured loops, and subgraphs.
- Canonical node kinds: `input`, `output`, `agent`, `tool`, `transform`, `condition`, `evaluate`, `approval`, `join`, `loop`, and `subgraph`.
- Declarative transforms: select, rename, merge, filter, deduplicate, sort, and slice.
- Visual macro insertion for Parallel, Pipeline, Reduce, and Verify. Macros materialize canonical nodes and edges before validation.
- Role templates for implementer, tester, researcher, critic/evaluator, product manager, designer, GTM specialist, and security reviewer.
- Deterministic Codex and Claude Markdown adapters.
- IndexedDB projects and indexes, OPFS revision bodies with IndexedDB fallback, autosave, explicit import/export, and PWA offline support.

### Excluded

- Model, agent, tool, MCP, shell, Python, or JavaScript execution.
- Provider accounts, credentials, traces, cost tracking, telemetry, cloud sync, or collaboration.
- Arbitrary code transforms, generated Python/JavaScript orchestrators, native multi-file packs, or round-trip parsing of target files.

## Experience requirements

The welcome screen contains exactly three outcome-led workflow shapes:

- Draft → critique → bounded revision.
- Parallel implementation and risk review → join.
- Evidence research → synthesis → evaluation.

The studio retains the reference concept’s dark technical language: compact navigation, grid canvas, colored graph cards, minimap, palette, inspector, and bottom compiler drawer. All visible branding is Ladder Graph and all copy describes compilation rather than execution.

The canvas focuses the meaningful phase rather than shrinking the entire graph to a thumbnail. The palette is searchable and categorized. Side panels collapse. Canvas, split, and YAML modes are available. Diagnostics identify a stable code, source path, node or edge, severity, explanation, target capability, and safe repair where possible.

The primary journey must meet WCAG 2.2 AA: keyboard-reachable controls, visible focus, non-color severity indicators, reduced motion, adequate label contrast, semantic alternatives, and readable behavior at 200% zoom.

## LGIR v1alpha1

YAML is canonical. Every document starts with:

```yaml
apiVersion: ladder.dev/v1alpha1
kind: Workflow
metadata:
  name: lowercase-slug
spec:
  objective: A verifiable outcome.
  nodes: []
  edges: []
```

Rust structs are the semantic authority. The checked-in JSON Schema at `public/schema/lgir-v1alpha1.schema.json` is the portable authoring contract; TypeScript types mirror the worker result boundary.

### Harness capabilities

Agent, evaluator, and tool nodes declare four separate capability sets: `skills`, primitive `tools`, `connectors`, and `permissions`. The studio changes its suggested skill and connector catalog with the selected Codex or Claude target, highlights recommendations inferred from the node role, and preserves custom repository-specific identifiers.

Catalog entries are authoring suggestions, not an inventory of installed capabilities. Ladder Graph does not connect to either harness, inspect user configuration, install skills, grant permissions, or invoke connectors. Compiled Markdown names every required skill and connector, identifies the target skill location (`.agents/skills/` or `.claude/skills/`), and requires the harness to stop and report a missing capability rather than silently substituting it.

### Structured loops

A loop owns a body list, an exit-condition reference, `maxIterations` from 1 through 100, and an exhaustion policy. Back-edges and self-edges are invalid. Targets render loops as explicit bounded instructions and report the capability as instructional.

### Security limits

- Imports are capped at 2 MB and 1,000 nodes.
- Custom YAML tags, anchors, aliases, and external references are rejected.
- Duplicate IDs, missing endpoints, unsupported node kinds, and arbitrary cycles are errors.
- Imported content is never executed.
- Generated Markdown is rendered as text, not injected HTML.

## Compiler interfaces

The browser calls a dedicated Web Worker. The worker loads the committed Rust-generated WebAssembly module and falls back to the TypeScript parity implementation only when WebAssembly initialization is unavailable.

```ts
analyze(yaml: string, target?: "codex" | "claude"): AnalysisResult
format(yaml: string): FormatResult
compile(yaml: string, target: "codex" | "claude"): CompileResult
migrate(yaml: string, toVersion: string): MigrationResult
```

Compilation is blocked by errors. Results contain one Markdown document, filename, source hash, compiler and adapter versions, diagnostics, and a capability report with `native`, `instructional`, and `unsupported` states. Unsupported target constructs are never omitted silently.

Codex artifacts include Agent Skills-compatible frontmatter and can be saved beneath `.agents/skills/`; repository-wide instructions remain `AGENTS.md`. Claude artifacts use equivalent `SKILL.md` content and can be saved beneath `.claude/skills/`. Every file declares its target and documentation date.

## Architecture decisions

- React 19, TypeScript, Vite, Tailwind 4, React Flow, CodeMirror 6, Zustand, and Dagre.
- Rust owns parsing, normalization, semantic validation, stable diagnostics, hashing, and target compilation.
- The UI owns browser I/O, graph interaction, layout, YAML CST patching, download/copy, and persistence.
- Generated WebAssembly artifacts are committed. Static hosts only run the Node/Vite build.
- The PWA precaches its shell, fonts, templates, schema, worker, and WebAssembly and has no runtime CDN dependency.

## Product success and GTM

The launch story is a 90-second draft–critique–revise demo, three inspectable graphs, a graph-versus-generated-prompt comparison, and an explicit no-account/no-runtime security statement. Distribution focuses on GitHub, Hacker News, coding-agent communities, applied-AI researchers, and template contributors.

Moderated validation succeeds when at least four of five participants can explain execution order, repair an unsafe loop, understand a target warning, and produce a usable prompt within ten minutes. With telemetry excluded, adoption is assessed through moderated studies, repository activity, discussions, issues, and opt-in feedback.

## Release criteria

A release requires formatting, type checking, Rust tests, checked-in WebAssembly reproducibility, unit tests, production build, three-browser journey coverage, offline verification, accessibility checks, malformed-input coverage, and deterministic target fixtures. The 200-node fixture must remain interactive and analyze/compile within 250 ms on the CI baseline; the 1,000-node limit is view-only.
