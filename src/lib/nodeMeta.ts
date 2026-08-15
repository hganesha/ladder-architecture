import type { NodeKind } from "../types";

export const NODE_META: Record<NodeKind, { label: string; hint: string; color: string; category: string }> = {
  input: { label: "Input", hint: "Workflow objective and typed inputs", color: "#54d7cf", category: "Flow" },
  output: { label: "Output", hint: "Final completion contract", color: "#e8e0d0", category: "Flow" },
  agent: { label: "Agent", hint: "One focused role and prompt", color: "#e86b5d", category: "Work" },
  tool: { label: "Tool requirement", hint: "Declarative capability only", color: "#de9f54", category: "Work" },
  transform: { label: "Transform", hint: "Safe declarative data mapping", color: "#e8bd58", category: "Data" },
  condition: { label: "Condition", hint: "Branch on an explicit expression", color: "#f0a05a", category: "Control" },
  evaluate: { label: "Evaluate", hint: "Score or critique a result", color: "#a990f5", category: "Control" },
  approval: { label: "Approval", hint: "Pause for explicit user consent", color: "#f0cb76", category: "Control" },
  join: { label: "Join", hint: "Wait for parallel branches", color: "#3ecf8e", category: "Control" },
  loop: { label: "Loop", hint: "Bounded structured revision", color: "#e879a9", category: "Control" },
  subgraph: { label: "Subgraph", hint: "Named collapsible phase", color: "#8391a6", category: "Flow" },
};

export const PALETTE_ORDER: NodeKind[] = [
  "input",
  "agent",
  "tool",
  "transform",
  "condition",
  "evaluate",
  "approval",
  "join",
  "loop",
  "subgraph",
  "output",
];

export const ROLE_TEMPLATES = [
  {
    path: "core/software",
    name: "Implementer",
    role: "Senior software engineer",
    prompt:
      "Implement the requested change within scope. Preserve existing behavior, verify the result, and report changed files and residual risks.",
    skills: ["repository-navigation", "implementation"],
    tools: ["read", "edit", "test"],
  },
  {
    path: "core/software",
    name: "Test engineer",
    role: "Independent test engineer",
    prompt: "Derive high-risk test cases from the contract, exercise the implementation, and return failures with reproducible evidence.",
    skills: ["test-design"],
    tools: ["read", "test"],
  },
  {
    path: "core/research",
    name: "Researcher",
    role: "Evidence-focused researcher",
    prompt:
      "Investigate the question using primary evidence. Separate observed facts, inferences, and unknowns; return citations when available.",
    skills: ["research"],
    tools: ["search", "read"],
  },
  {
    path: "core/quality",
    name: "Critic / evaluator",
    role: "Adversarial quality evaluator",
    prompt:
      "Evaluate the candidate against the stated contract. Return a score, concrete defects, evidence, and the smallest revision that would pass.",
    skills: ["evaluation"],
    tools: ["read"],
  },
  {
    path: "core/product",
    name: "Product manager",
    role: "Product manager",
    prompt: "Translate the objective into user value, constraints, acceptance criteria, sequencing, and explicit tradeoffs.",
    skills: ["product-management"],
    tools: ["read"],
  },
  {
    path: "core/product",
    name: "Designer",
    role: "Product designer",
    prompt: "Improve the workflow from the user's point of view. Identify hierarchy, comprehension, accessibility, and interaction risks.",
    skills: ["product-design"],
    tools: ["read"],
  },
  {
    path: "core/market",
    name: "GTM specialist",
    role: "Go-to-market strategist",
    prompt: "Define the beachhead user, urgent problem, message, proof, channel, and measurable launch experiment.",
    skills: ["go-to-market"],
    tools: ["read", "search"],
  },
  {
    path: "core/security",
    name: "Security reviewer",
    role: "Security and privacy reviewer",
    prompt: "Threat-model the proposed work. Identify trust boundaries, abuse paths, sensitive data, and mitigations ranked by severity.",
    skills: ["threat-modeling"],
    tools: ["read"],
  },
] as const;

export function defaultNode(kind: NodeKind, index: number): import("../types").LgirNode {
  const meta = NODE_META[kind];
  const id = `${kind}-${index}`;
  const base: import("../types").LgirNode = {
    id,
    kind,
    name: meta.label,
    summary: meta.hint,
    capabilities: { skills: [], tools: [], connectors: [], permissions: [] },
    config: {},
    position: { x: 220 + (index % 3) * 280, y: 120 + Math.floor(index / 3) * 190 },
  };
  if (kind === "agent" || kind === "evaluate") {
    base.role = kind === "evaluate" ? "Independent evaluator" : "Workflow specialist";
    base.prompt =
      kind === "evaluate"
        ? "Evaluate the candidate against the contract and return a score with evidence."
        : "Complete this focused task and return only the requested output.";
    base.outputSchema =
      kind === "evaluate"
        ? {
            type: "object",
            required: ["score", "passed", "reasons"],
            properties: { score: { type: "number" }, passed: { type: "boolean" }, reasons: { type: "array", items: { type: "string" } } },
          }
        : { type: "object" };
  }
  if (kind === "transform") base.config = { operation: "select", expression: "$.result" };
  if (kind === "condition")
    base.config = {
      expression: "result.passed == true",
      branches: [
        { label: "Pass", when: "true" },
        { label: "Revise", when: "false" },
      ],
    };
  if (kind === "join") base.config = { join: "all" };
  if (kind === "loop") base.config = { body: [], exitCondition: "evaluation.passed == true", maxIterations: 3, onExhausted: "stop" };
  return base;
}
