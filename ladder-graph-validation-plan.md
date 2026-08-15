# Ladder Graph MVP Validation Plan

## Decision to validate

Can a developer understand a non-trivial agent workflow, repair its unsafe control structure, interpret target limitations, and produce a usable instructional or deterministic-code artifact without learning an orchestration framework?

## Moderated comprehension study

Recruit five developers across professional SDEs, hobbyists, and applied-AI researchers. Give each participant the same local build and draft–critique–revision template. Do not explain LGIR before the task.

Ask each participant to:

1. Explain the execution order and identify work that can happen in parallel.
2. Change the critic role to match a domain they know.
3. Open YAML split view and locate the corresponding source.
4. Set the loop bound to zero, then explain the diagnostic.
5. Use the safe repair and interpret the resulting instructional target warning.
6. Compile for one target and describe where the output can be pasted or saved.

Pass criteria: at least four of five complete all tasks within ten minutes without moderator rescue. Record time to first correct topology explanation, repair time, warning comprehension, compilation success, and confidence.

## Technical verification matrix

| Layer | Required evidence |
| --- | --- |
| Rust core | Unit coverage for valid LGIR, duplicates, endpoints, cycles, loop bounds, transforms, migrations, and deterministic compilation. |
| Adapter fixtures | Codex, Claude, Hermes Agent, Python, and TypeScript output is byte-identical over repeated compiles; filenames, MIME types, target metadata, template customizations, and capability states are present. |
| TypeScript parity | Bundled templates produce equivalent validity, diagnostic codes, order, and capability states in fallback and WebAssembly paths. |
| Studio | Tests cover templates, editing, diagnostics, safe fixes, target selection, copy/download, undo/redo, and persistence recovery. |
| Browser journey | Chromium, Firefox, and WebKit cover template → edit → failure → repair → compile → copy/download → reload → offline recovery. |
| Accessibility | axe plus manual keyboard, focus, 200% zoom, reduced motion, and screen-reader navigation on the primary journey. |
| Security | Malformed YAML, custom tags, anchors/aliases, duplicate IDs, hostile Markdown, external references, 2 MB imports, and 1,000-node limits. |
| Performance | Analyze/compile under 250 ms at 200 nodes; graph editing remains responsive; 1,000-node documents open view-only. |

## Manual release checklist

- Install the production PWA and reopen it with network disabled.
- Confirm fonts, schema, templates, worker, and WebAssembly are served locally.
- Create both valid and invalid revisions; reload and verify the last valid graph remains available.
- Confirm invalid YAML makes the canvas read-only without discarding source.
- Verify all eleven node kinds can be inserted and edited.
- Verify Parallel, Pipeline, Reduce, and Verify macros insert canonical structures.
- Confirm every visible primary control is keyboard reachable with a visible focus indicator.
- Confirm errors have icon/text treatment and do not rely on color.
- Compile every bundled template for all five targets.
- Import generated Python modules, type-check generated TypeScript modules, and confirm readiness helpers preserve compiler order.
- Confirm no network request, credential prompt, provider SDK, telemetry endpoint, or executable content path exists.

## Launch feedback

Ship the 90-second demonstration with the three templates and a graph-to-prompt comparison. Collect qualitative feedback through GitHub issues and discussions with separate templates for target gaps, LGIR proposals, and workflow templates. Track stars, forks, repeat contributors, template contributions, and issue resolution rather than embedding telemetry.
