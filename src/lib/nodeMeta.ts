import type { NodeKind } from "../types";

export { ROLE_TEMPLATES } from "./roleTemplates";

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
  group: { label: "Group", hint: "Bounded sequential or parallel phase", color: "#62b6e7", category: "Flow" },
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
  "group",
  "subgraph",
  "output",
];

export function defaultNode(kind: NodeKind, index: number): import("../types").LgirNode {
  const meta = NODE_META[kind];
  const id = `${kind}-${index}`;
  const base: import("../types").LgirNode = {
    id,
    kind,
    name: meta.label,
    summary: meta.hint,
    capabilities: { skills: [], tools: [], connectors: [], permissions: [], customizations: {} },
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
  if (kind === "group") {
    base.name = "Execution group";
    base.summary = "Route one input through a bounded parallel phase and aggregate every member output.";
    base.config = { members: [], execution: "parallel", exit: "aggregate" };
    const position = base.position ?? { x: 220, y: 120 };
    base.position = { ...position, y: position.y + 75 };
  }
  return base;
}
