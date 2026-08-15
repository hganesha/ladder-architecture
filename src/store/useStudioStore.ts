import { parseDocument } from "yaml";
import { create } from "zustand";
import { compiler } from "../compiler/client";
import { autoLayout, groupMemberPosition } from "../lib/layout";
import { defaultNode, ROLE_TEMPLATES } from "../lib/nodeMeta";
import { requestPersistentStorage, saveProject } from "../lib/persistence";
import { BLANK_WORKFLOW, WORKFLOW_TEMPLATES } from "../lib/templates";
import type { AnalysisResult, CompileResult, Diagnostic, LgirEdge, LgirNode, NodeKind, ProjectRecord, Target, Workflow } from "../types";

type ViewMode = "gallery" | "studio";
type CenterMode = "canvas" | "split" | "source";
type InspectorTab = "basics" | "contracts" | "capabilities" | "advanced";

interface StudioState {
  view: ViewMode;
  source: string;
  lastValidSource: string;
  projectId: string | null;
  analysis: AnalysisResult | null;
  compileResult: CompileResult | null;
  target: Target;
  selectedNodeId: string | null;
  centerMode: CenterMode;
  inspectorTab: InspectorTab;
  outputOpen: boolean;
  diagnosticsOpen: boolean;
  paletteOpen: boolean;
  inspectorOpen: boolean;
  busy: boolean;
  runtime: "wasm" | "fallback";
  savedAt: number | null;
  past: string[];
  future: string[];
  setView: (view: ViewMode) => void;
  openTemplate: (id: string) => Promise<void>;
  openBlank: () => Promise<void>;
  openProject: (project: ProjectRecord) => Promise<void>;
  setSource: (source: string, recordHistory?: boolean) => Promise<void>;
  setTarget: (target: Target) => Promise<void>;
  compile: () => Promise<void>;
  format: () => Promise<void>;
  selectNode: (id: string | null) => void;
  setCenterMode: (mode: CenterMode) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  toggleOutput: (value?: boolean) => void;
  toggleDiagnostics: (value?: boolean) => void;
  togglePalette: () => void;
  toggleInspector: () => void;
  patchNode: (id: string, patch: Partial<LgirNode>) => Promise<void>;
  addNode: (kind: NodeKind) => Promise<void>;
  addRole: (name: string) => Promise<void>;
  addMacro: (macro: "parallel" | "pipeline" | "reduce" | "verify") => Promise<void>;
  connect: (edge: Omit<LgirEdge, "id">) => Promise<void>;
  updatePositions: (positions: Record<string, { x: number; y: number }>) => Promise<void>;
  layout: () => Promise<void>;
  applyFix: (diagnostic: Diagnostic) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

let analysisRevision = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function parseWorkflow(source: string): Workflow | null {
  try {
    if (/(^|\s)[&*][A-Za-z0-9_-]+/.test(source)) return null;
    const document = parseDocument(source, { uniqueKeys: true, strict: true });
    if (document.errors.length) return null;
    return document.toJS({ maxAliasCount: 50 }) as Workflow;
  } catch {
    return null;
  }
}

function patchYaml(source: string, path: (string | number)[], value: unknown) {
  const document = parseDocument(source, { keepSourceTokens: true });
  if (document.errors.length) throw new Error(document.errors[0].message);
  document.setIn(path, value);
  return document.toString({ indent: 2, lineWidth: 100 });
}

function projectName(source: string) {
  return parseWorkflow(source)?.metadata?.name ?? "untitled-workflow";
}

async function analyzeAndPersist(set: (value: Partial<StudioState>) => void, get: () => StudioState, source: string) {
  const revision = ++analysisRevision;
  set({ busy: true });
  const analysis = await compiler.analyze(source, get().target);
  if (revision !== analysisRevision) return;
  const valid = Boolean(analysis.normalized);
  const lastValidSource = analysis.ok ? source : get().lastValidSource;
  set({ analysis, lastValidSource, busy: false, runtime: compiler.runtime });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const state = get();
    const project = await saveProject(
      state.projectId,
      projectName(state.source),
      state.source,
      state.lastValidSource,
      state.target,
      valid && analysis.ok,
    );
    set({ projectId: project.id, savedAt: project.updatedAt });
    if (!state.projectId) void requestPersistentStorage();
  }, 500);
}

export const useStudioStore = create<StudioState>((set, get) => ({
  view: "gallery",
  source: BLANK_WORKFLOW,
  lastValidSource: BLANK_WORKFLOW,
  projectId: null,
  analysis: null,
  compileResult: null,
  target: "codex",
  selectedNodeId: null,
  centerMode: "canvas",
  inspectorTab: "basics",
  outputOpen: false,
  diagnosticsOpen: false,
  paletteOpen: true,
  inspectorOpen: true,
  busy: false,
  runtime: "fallback",
  savedAt: null,
  past: [],
  future: [],
  setView: (view) => set({ view }),
  openTemplate: async (id) => {
    const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === id);
    if (!template) return;
    const templateWorkflow = parseWorkflow(template.yaml);
    const source = templateWorkflow
      ? patchYaml(template.yaml, ["spec", "nodes"], autoLayout(templateWorkflow.spec.nodes, templateWorkflow.spec.edges))
      : template.yaml;
    set({
      view: "studio",
      projectId: null,
      source,
      lastValidSource: source,
      selectedNodeId: null,
      outputOpen: false,
      compileResult: null,
      past: [],
      future: [],
    });
    await analyzeAndPersist(set, get, source);
  },
  openBlank: async () => {
    set({
      view: "studio",
      projectId: null,
      source: BLANK_WORKFLOW,
      lastValidSource: BLANK_WORKFLOW,
      selectedNodeId: null,
      outputOpen: false,
      compileResult: null,
      past: [],
      future: [],
    });
    await analyzeAndPersist(set, get, BLANK_WORKFLOW);
  },
  openProject: async (project) => {
    set({
      view: "studio",
      projectId: project.id,
      source: project.yaml,
      lastValidSource: project.lastValidYaml,
      target: project.target,
      selectedNodeId: null,
      outputOpen: false,
      compileResult: null,
      past: [],
      future: [],
    });
    await analyzeAndPersist(set, get, project.yaml);
  },
  setSource: async (source, recordHistory = true) => {
    const state = get();
    set({
      source,
      compileResult: null,
      past: recordHistory ? [...state.past.slice(-49), state.source] : state.past,
      future: recordHistory ? [] : state.future,
    });
    await analyzeAndPersist(set, get, source);
  },
  setTarget: async (target) => {
    set({ target, compileResult: null });
    await analyzeAndPersist(set, get, get().source);
  },
  compile: async () => {
    set({ busy: true });
    const result = await compiler.compile(get().source, get().target);
    set({ compileResult: result, outputOpen: true, busy: false, runtime: compiler.runtime });
  },
  format: async () => {
    const result = await compiler.format(get().source);
    if (result.ok) await get().setSource(result.content);
  },
  selectNode: (selectedNodeId) => set({ selectedNodeId, inspectorOpen: true }),
  setCenterMode: (centerMode) => set({ centerMode }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  toggleOutput: (value) => set((state) => ({ outputOpen: value ?? !state.outputOpen })),
  toggleDiagnostics: (value) => set((state) => ({ diagnosticsOpen: value ?? !state.diagnosticsOpen })),
  togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),
  toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
  patchNode: async (id, patch) => {
    const workflow = parseWorkflow(get().source);
    const index = workflow?.spec.nodes.findIndex((node) => node.id === id) ?? -1;
    if (!workflow || index < 0) return;
    let source = get().source;
    Object.entries(patch).forEach(([key, value]) => {
      source = patchYaml(source, ["spec", "nodes", index, key], value);
    });
    const group = workflow.spec.nodes[index];
    if (group?.kind === "group" && patch.config) {
      const nextGroup = { ...group, ...patch, config: { ...group.config, ...patch.config } };
      const groupPosition = group.position ?? { x: 0, y: 0 };
      const nodes = workflow.spec.nodes.map((node) => {
        const memberIndex = nextGroup.config?.members?.indexOf(node.id) ?? -1;
        if (memberIndex < 0) return node.id === id ? nextGroup : node;
        const relative = groupMemberPosition(nextGroup, memberIndex);
        return { ...node, position: { x: groupPosition.x + relative.x, y: groupPosition.y + relative.y } };
      });
      source = patchYaml(source, ["spec", "nodes"], nodes);
    }
    await get().setSource(source);
  },
  addNode: async (kind) => {
    const workflow = parseWorkflow(get().source);
    if (!workflow) return;
    const node = defaultNode(kind, workflow.spec.nodes.length + 1);
    const selected = workflow.spec.nodes.find((candidate) => candidate.id === get().selectedNodeId);
    const activeGroup =
      kind === "group"
        ? undefined
        : selected?.kind === "group"
          ? selected
          : workflow.spec.nodes.find((candidate) => candidate.kind === "group" && candidate.config?.members?.includes(selected?.id ?? ""));
    let nodes = [...workflow.spec.nodes, node];
    if (activeGroup) {
      const members = [...(activeGroup.config?.members ?? []), node.id];
      const relative = groupMemberPosition(activeGroup, members.length - 1);
      const groupPosition = activeGroup.position ?? { x: 0, y: 0 };
      node.position = { x: groupPosition.x + relative.x, y: groupPosition.y + relative.y };
      nodes = nodes.map((candidate) =>
        candidate.id === activeGroup.id ? { ...candidate, config: { ...candidate.config, members } } : candidate,
      );
    }
    const source = patchYaml(get().source, ["spec", "nodes"], nodes);
    set({ selectedNodeId: node.id });
    await get().setSource(source);
  },
  addRole: async (name) => {
    const role = ROLE_TEMPLATES.find((candidate) => candidate.name === name);
    const workflow = parseWorkflow(get().source);
    if (!role || !workflow) return;
    const node = defaultNode("agent", workflow.spec.nodes.length + 1);
    node.name = role.name;
    node.role = role.role;
    node.prompt = role.prompt;
    node.capabilities = {
      skills: [...role.skills],
      tools: [...role.tools],
      connectors: [...(role.connectors ?? [])],
      permissions: [...(role.permissions ?? ["read-only"])],
      customizations: {},
    };
    const source = patchYaml(get().source, ["spec", "nodes"], [...workflow.spec.nodes, node]);
    set({ selectedNodeId: node.id });
    await get().setSource(source);
  },
  addMacro: async (macro) => {
    const workflow = parseWorkflow(get().source);
    if (!workflow) return;
    const offset = workflow.spec.nodes.length + 1;
    const nodes = [...workflow.spec.nodes];
    const edges = [...workflow.spec.edges];
    if (macro === "parallel") {
      const left = defaultNode("agent", offset);
      left.name = "Parallel branch A";
      const right = defaultNode("agent", offset + 1);
      right.name = "Parallel branch B";
      const join = defaultNode("join", offset + 2);
      join.name = "Parallel join";
      nodes.push(left, right, join);
      edges.push(
        { id: `macro-parallel-${offset}-a`, from: left.id, to: join.id, kind: "dependency" },
        { id: `macro-parallel-${offset}-b`, from: right.id, to: join.id, kind: "dependency" },
      );
    } else if (macro === "pipeline") {
      const first = defaultNode("agent", offset);
      first.name = "Pipeline step 1";
      const second = defaultNode("agent", offset + 1);
      second.name = "Pipeline step 2";
      nodes.push(first, second);
      edges.push({ id: `macro-pipeline-${offset}`, from: first.id, to: second.id, kind: "data", contract: "StepResult" });
    } else if (macro === "reduce") {
      const transform = defaultNode("transform", offset);
      transform.name = "Deduplicate results";
      transform.config = { operation: "deduplicate", expression: "$.items by $.id" };
      nodes.push(transform);
    } else {
      const evaluator = defaultNode("evaluate", offset);
      evaluator.name = "Independent verification";
      nodes.push(evaluator);
    }
    let source = patchYaml(get().source, ["spec", "nodes"], nodes);
    source = patchYaml(source, ["spec", "edges"], edges);
    await get().setSource(source);
  },
  connect: async (edge) => {
    const workflow = parseWorkflow(get().source);
    if (!workflow) return;
    const item: LgirEdge = { ...edge, id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    const source = patchYaml(get().source, ["spec", "edges"], [...workflow.spec.edges, item]);
    await get().setSource(source);
  },
  updatePositions: async (positions) => {
    const workflow = parseWorkflow(get().source);
    if (!workflow) return;
    const nodes = workflow.spec.nodes.map((node) => (positions[node.id] ? { ...node, position: positions[node.id] } : node));
    const source = patchYaml(get().source, ["spec", "nodes"], nodes);
    await get().setSource(source, false);
  },
  layout: async () => {
    const workflow = parseWorkflow(get().source);
    if (!workflow) return;
    const nodes = autoLayout(workflow.spec.nodes, workflow.spec.edges);
    const source = patchYaml(get().source, ["spec", "nodes"], nodes);
    await get().setSource(source);
  },
  applyFix: async (diagnostic) => {
    if (!diagnostic.fix) return;
    const path = diagnostic.fix.path
      .split("/")
      .filter(Boolean)
      .map((item) => (/^\d+$/.test(item) ? Number(item) : item));
    await get().setSource(patchYaml(get().source, path, diagnostic.fix.value));
  },
  undo: async () => {
    const state = get();
    const previous = state.past.at(-1);
    if (!previous) return;
    set({ source: previous, past: state.past.slice(0, -1), future: [state.source, ...state.future].slice(0, 50) });
    await analyzeAndPersist(set, get, previous);
  },
  redo: async () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    set({ source: next, past: [...state.past, state.source].slice(-50), future: state.future.slice(1) });
    await analyzeAndPersist(set, get, next);
  },
}));

export function currentWorkflow(state: Pick<StudioState, "analysis">) {
  return state.analysis?.normalized ?? null;
}
