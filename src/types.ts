export type Target = "codex" | "claude" | "hermes" | "python" | "typescript";
export type Severity = "error" | "warning" | "info";
export type NodeKind =
  | "input"
  | "output"
  | "agent"
  | "tool"
  | "transform"
  | "condition"
  | "evaluate"
  | "approval"
  | "join"
  | "loop"
  | "group"
  | "subgraph";

export type EdgeKind = "data" | "dependency" | "control";

export interface Position {
  x: number;
  y: number;
}

export interface Branch {
  label: string;
  when: string;
}

export interface NodeConfig {
  operation?: "select" | "rename" | "merge" | "filter" | "deduplicate" | "sort" | "slice" | "";
  expression?: string;
  branches?: Branch[];
  join?: "all" | "allSettled" | "first" | "";
  body?: string[];
  exitCondition?: string;
  maxIterations?: number;
  onExhausted?: "stop" | "continue" | "warn" | "";
  threshold?: number;
  members?: string[];
  execution?: "sequential" | "parallel" | "";
  exit?: "aggregate" | "serialize" | "";
}

export interface Capabilities {
  skills: string[];
  tools: string[];
  connectors: string[];
  permissions: string[];
  customizations: Record<string, CapabilityCustomization>;
}

export interface CapabilityCustomization {
  template: string;
  instructions: string;
}

export interface LgirNode {
  [key: string]: unknown;
  id: string;
  kind: NodeKind;
  name: string;
  summary?: string;
  role?: string;
  prompt?: string;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  capabilities?: Partial<Capabilities>;
  config?: NodeConfig;
  position?: Position;
}

export interface LgirEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  contract?: string;
  condition?: string;
}

export interface Workflow {
  apiVersion: "ladder.dev/v1alpha1";
  kind: "Workflow";
  metadata: {
    name: string;
    title?: string;
    description?: string;
    version?: string;
  };
  spec: {
    objective: string;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    policies?: {
      maxConcurrency?: number;
      onFailure?: string;
      requireApprovalFor?: string[];
    };
    nodes: LgirNode[];
    edges: LgirEdge[];
  };
}

export interface Fix {
  label: string;
  path: string;
  value: unknown;
}

export interface Diagnostic {
  code: string;
  severity: Severity;
  path: string;
  nodeId?: string;
  edgeId?: string;
  message: string;
  capability?: "native" | "instructional" | "unsupported";
  fix?: Fix;
}

export interface Stats {
  nodes: number;
  edges: number;
  agents: number;
  loops: number;
  maxParallelism: number;
}

export interface AnalysisResult {
  ok: boolean;
  sourceHash: string;
  diagnostics: Diagnostic[];
  normalized?: Workflow;
  nodeOrder: string[];
  stats: Stats;
}

export interface FormatResult {
  ok: boolean;
  content: string;
  diagnostics: Diagnostic[];
}

export interface CapabilityReport {
  target: Target;
  native: string[];
  instructional: string[];
  unsupported: string[];
}

export interface CompileResult {
  ok: boolean;
  content: string;
  suggestedFilename: string;
  mimeType: string;
  sourceHash: string;
  compilerVersion: string;
  adapterVersion: string;
  capabilityReport: CapabilityReport;
  diagnostics: Diagnostic[];
}

export interface TemplateDefinition {
  id: string;
  path: string;
  area: string;
  title: string;
  eyebrow: string;
  description: string;
  topology: string;
  accent: string;
  yaml: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  yaml: string;
  lastValidYaml: string;
  target: Target;
  createdAt: number;
  updatedAt: number;
}
