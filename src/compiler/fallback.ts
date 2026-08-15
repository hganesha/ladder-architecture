import { parseDocument, stringify } from "yaml";
import type { AnalysisResult, CapabilityReport, CompileResult, Diagnostic, FormatResult, LgirNode, Target, Workflow } from "../types";

const VERSION = "0.1.0-web";
const KINDS = new Set([
  "input",
  "output",
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
]);
const TRANSFORMS = new Set(["select", "rename", "merge", "filter", "deduplicate", "sort", "slice"]);

function targetLabel(target: Target) {
  if (target === "codex") return "Codex";
  if (target === "claude") return "Claude";
  if (target === "hermes") return "Hermes Agent";
  return target === "python" ? "Python" : "TypeScript";
}

function isCodeTarget(target: Target): target is "python" | "typescript" {
  return target === "python" || target === "typescript";
}

async function sourceHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return `fnv-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function diagnostic(code: string, severity: Diagnostic["severity"], path: string, message: string, nodeId?: string): Diagnostic {
  return { code, severity, path, message, nodeId };
}

function parse(source: string): { workflow?: Workflow; diagnostics: Diagnostic[] } {
  if (source.length > 2_000_000) return { diagnostics: [diagnostic("LG001", "error", "/", "LGIR source exceeds the 2 MB import limit.")] };
  if (source.includes("!!") || source.includes("!<"))
    return { diagnostics: [diagnostic("LG002", "error", "/", "Custom YAML tags are not supported.")] };
  if (/(^|\s)[&*][A-Za-z0-9_-]+/.test(source))
    return { diagnostics: [diagnostic("LG004", "error", "/", "YAML anchors and aliases are not supported.")] };
  if (/^\s*["']?\$ref["']?\s*:\s*["']?(?:https?:|\/\/)/m.test(source))
    return { diagnostics: [diagnostic("LG005", "error", "/", "External schema references are not supported.")] };
  try {
    const document = parseDocument(source, { uniqueKeys: true, strict: true });
    if (document.errors.length) {
      return {
        diagnostics: document.errors.map((error) => diagnostic("LG003", "error", "/", `YAML could not be parsed: ${error.message}`)),
      };
    }
    return { workflow: document.toJS({ maxAliasCount: 50 }) as Workflow, diagnostics: [] };
  } catch (error) {
    return {
      diagnostics: [
        diagnostic("LG003", "error", "/", `YAML could not be parsed: ${error instanceof Error ? error.message : String(error)}`),
      ],
    };
  }
}

function topological(workflow: Workflow): { order: string[]; cyclic: boolean; maxParallelism: number } {
  const ids = workflow.spec.nodes.map((node) => node.id);
  const indegree = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>();
  const groups = new Map(workflow.spec.nodes.filter((node) => node.kind === "group").map((node) => [node.id, node]));
  const schedulingEdges: { from: string; to: string }[] = [];
  workflow.spec.edges.forEach((edge) => {
    const sourceGroup = groups.get(edge.from);
    const members = sourceGroup?.config?.members?.filter((id) => indegree.has(id)) ?? [];
    if (sourceGroup && members.length)
      members.forEach((from) => {
        schedulingEdges.push({ from, to: edge.to });
      });
    else schedulingEdges.push(edge);
  });
  groups.forEach((group) => {
    const members = group.config?.members?.filter((id) => indegree.has(id)) ?? [];
    if (group.config?.execution === "sequential") {
      if (members[0]) schedulingEdges.push({ from: group.id, to: members[0] });
      members.slice(1).forEach((member, index) => {
        schedulingEdges.push({ from: members[index], to: member });
      });
    } else {
      members.forEach((member) => {
        schedulingEdges.push({ from: group.id, to: member });
      });
    }
  });
  const seenEdges = new Set<string>();
  schedulingEdges.forEach((edge) => {
    if (!indegree.has(edge.from) || !indegree.has(edge.to)) return;
    const key = `${edge.from}:${edge.to}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to].sort());
  });
  const queue = [...indegree.entries()]
    .filter(([, value]) => value === 0)
    .map(([id]) => id)
    .sort();
  const order: string[] = [];
  let maxParallelism = queue.length;
  while (queue.length) {
    maxParallelism = Math.max(maxParallelism, queue.length);
    const current = queue.shift()!;
    order.push(current);
    (outgoing.get(current) ?? []).forEach((target) => {
      const next = (indegree.get(target) ?? 1) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    });
    queue.sort();
  }
  return { order, cyclic: order.length !== ids.length, maxParallelism };
}

export async function analyzeFallback(source: string, target?: Target): Promise<AnalysisResult> {
  const parsed = parse(source);
  if (!parsed.workflow) {
    return {
      ok: false,
      sourceHash: "",
      diagnostics: parsed.diagnostics,
      nodeOrder: [],
      stats: { nodes: 0, edges: 0, agents: 0, loops: 0, maxParallelism: 0 },
    };
  }
  const workflow = parsed.workflow;
  const diagnostics = [...parsed.diagnostics];
  if (workflow.apiVersion !== "ladder.dev/v1alpha1")
    diagnostics.push(diagnostic("LG100", "error", "/apiVersion", "Expected apiVersion ladder.dev/v1alpha1."));
  if (workflow.kind !== "Workflow") diagnostics.push(diagnostic("LG101", "error", "/kind", "kind must be Workflow."));
  if (!workflow.metadata?.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workflow.metadata.name))
    diagnostics.push(diagnostic("LG102", "error", "/metadata/name", "metadata.name must be a non-empty lowercase slug."));
  if (!workflow.spec?.objective?.trim())
    diagnostics.push(
      diagnostic("LG103", "warning", "/spec/objective", "Add an objective so the generated workflow has a clear completion condition."),
    );
  const nodes = workflow.spec?.nodes ?? [];
  const edges = workflow.spec?.edges ?? [];
  if (nodes.length > 1000) diagnostics.push(diagnostic("LG104", "error", "/spec/nodes", "Workflows are limited to 1,000 nodes."));
  const ids = new Set<string>();
  nodes.forEach((node, index) => {
    const path = `/spec/nodes/${index}`;
    if (ids.has(node.id)) diagnostics.push(diagnostic("LG110", "error", path, `Duplicate node id '${node.id}'.`, node.id));
    ids.add(node.id);
    if (!KINDS.has(node.kind)) diagnostics.push(diagnostic("LG111", "error", path, `Unsupported node kind '${node.kind}'.`, node.id));
    if ((node.kind === "agent" || node.kind === "evaluate") && !node.prompt?.trim())
      diagnostics.push(diagnostic("LG112", "error", path, "Agent and evaluator nodes require a prompt.", node.id));
    if (node.kind === "agent" && !node.role?.trim())
      diagnostics.push(diagnostic("LG113", "warning", path, "Add a role to make this agent's responsibility explicit.", node.id));
    if (node.kind === "tool" && !node.capabilities?.tools?.length)
      diagnostics.push(diagnostic("LG114", "warning", path, "Tool requirement has no declared tool identifier.", node.id));
    if (node.kind === "transform" && !TRANSFORMS.has(node.config?.operation ?? ""))
      diagnostics.push(diagnostic("LG115", "error", path, "Transform operation is not part of the safe declarative set.", node.id));
    if (node.kind === "loop") {
      const max = node.config?.maxIterations ?? 0;
      if (max < 1 || max > 100)
        diagnostics.push({
          ...diagnostic("LG120", "error", path, "Loop maxIterations must be between 1 and 100.", node.id),
          fix: { label: "Set a safe three-iteration bound", path: `${path}/config/maxIterations`, value: 3 },
        });
      if (!node.config?.exitCondition?.trim())
        diagnostics.push(
          diagnostic("LG121", "error", path, "Loop requires an exitCondition referencing a condition or evaluator result.", node.id),
        );
      if (!node.config?.body?.length)
        diagnostics.push(diagnostic("LG122", "error", path, "Loop body must reference at least one node.", node.id));
      node.config?.body?.forEach((bodyId) => {
        if (!nodes.some((candidate) => candidate.id === bodyId))
          diagnostics.push(diagnostic("LG123", "error", path, `Loop body references missing node '${bodyId}'.`, node.id));
      });
    }
    if (node.kind === "join" && !["all", "allSettled", "first"].includes(node.config?.join ?? ""))
      diagnostics.push(diagnostic("LG124", "error", path, "Join policy must be all, allSettled, or first.", node.id));
    if (node.kind === "group") {
      const members = node.config?.members ?? [];
      if (!members.length) diagnostics.push(diagnostic("LG125", "warning", path, "Group has no member nodes yet.", node.id));
      if (!["sequential", "parallel"].includes(node.config?.execution ?? ""))
        diagnostics.push(diagnostic("LG126", "error", path, "Group execution must be sequential or parallel.", node.id));
      if (!["aggregate", "serialize"].includes(node.config?.exit ?? ""))
        diagnostics.push(diagnostic("LG127", "error", path, "Group exit must aggregate or serialize member outputs.", node.id));
      if (new Set(members).size !== members.length)
        diagnostics.push(diagnostic("LG128", "error", path, "Group member IDs must be unique.", node.id));
      members.forEach((memberId) => {
        const member = nodes.find((candidate) => candidate.id === memberId);
        if (!member) diagnostics.push(diagnostic("LG129", "error", path, `Group references missing member '${memberId}'.`, node.id));
        else if (member.id === node.id || member.kind === "group")
          diagnostics.push(diagnostic("LG132", "error", path, "Groups cannot contain themselves or another group.", node.id));
      });
    }
    if (target && (node.kind === "loop" || node.kind === "approval" || node.kind === "group"))
      diagnostics.push({
        ...diagnostic(
          "LG200",
          "info",
          path,
          `${targetLabel(target)} expresses '${node.kind}' as ${isCodeTarget(target) ? "declarative workflow data rather than an executed runtime primitive" : "explicit instructions rather than a hard runtime guarantee"}.`,
          node.id,
        ),
        capability: "instructional",
      });
    if (target && (node.capabilities?.connectors?.length || node.capabilities?.tools?.some((tool) => tool.startsWith("mcp:"))))
      diagnostics.push({
        ...diagnostic("LG201", "warning", path, "Connector requirements are documented but not invoked by this compiler.", node.id),
        capability: "instructional",
      });
  });
  const membership = new Map<string, string>();
  nodes
    .filter((node) => node.kind === "group")
    .forEach((group) => {
      group.config?.members?.forEach((memberId) => {
        const existing = membership.get(memberId);
        if (existing && existing !== group.id)
          diagnostics.push(diagnostic("LG133", "error", "/spec/nodes", `Node '${memberId}' belongs to more than one group.`));
        membership.set(memberId, group.id);
      });
    });
  if (!nodes.some((node) => node.kind === "input"))
    diagnostics.push(diagnostic("LG130", "warning", "/spec/nodes", "Workflow has no input node."));
  if (!nodes.some((node) => node.kind === "output"))
    diagnostics.push(diagnostic("LG131", "error", "/spec/nodes", "Workflow requires an output node."));
  const edgeIds = new Set<string>();
  edges.forEach((edge, index) => {
    const path = `/spec/edges/${index}`;
    if (edgeIds.has(edge.id))
      diagnostics.push({ ...diagnostic("LG140", "error", path, `Duplicate edge id '${edge.id}'.`), edgeId: edge.id });
    edgeIds.add(edge.id);
    if (!ids.has(edge.from))
      diagnostics.push({ ...diagnostic("LG141", "error", path, `Edge source '${edge.from}' does not exist.`), edgeId: edge.id });
    if (!ids.has(edge.to))
      diagnostics.push({ ...diagnostic("LG142", "error", path, `Edge target '${edge.to}' does not exist.`), edgeId: edge.id });
    if (!new Set(["data", "dependency", "control"]).has(edge.kind))
      diagnostics.push({ ...diagnostic("LG143", "error", path, `Unsupported edge kind '${edge.kind}'.`), edgeId: edge.id });
    if (edge.from === edge.to)
      diagnostics.push({
        ...diagnostic("LG144", "error", path, "Self edges are not allowed; use a structured loop node."),
        edgeId: edge.id,
      });
    const sourceGroup = membership.get(edge.from);
    const targetGroup = membership.get(edge.to);
    if (sourceGroup && targetGroup !== sourceGroup)
      diagnostics.push(
        diagnostic(
          "LG145",
          "warning",
          path,
          `Route member '${edge.from}' output through group '${sourceGroup}' before crossing its boundary.`,
        ),
      );
    if (targetGroup && sourceGroup !== targetGroup)
      diagnostics.push(
        diagnostic(
          "LG146",
          "warning",
          path,
          `Route external input through group '${targetGroup}' instead of directly to member '${edge.to}'.`,
        ),
      );
  });
  const sorted = topological(workflow);
  if (sorted.cyclic)
    diagnostics.push(
      diagnostic("LG150", "error", "/spec/edges", "Arbitrary cycles are not allowed. Place repeated work inside a structured loop node."),
    );
  return {
    ok: !diagnostics.some((item) => item.severity === "error"),
    sourceHash: await sourceHash(workflow),
    diagnostics,
    normalized: workflow,
    nodeOrder: sorted.order,
    stats: {
      nodes: nodes.length,
      edges: edges.length,
      agents: nodes.filter((node) => node.kind === "agent" || node.kind === "evaluate").length,
      loops: nodes.filter((node) => node.kind === "loop").length,
      maxParallelism: sorted.maxParallelism,
    },
  };
}

function dependencies(workflow: Workflow, id: string) {
  return workflow.spec.edges.filter((edge) => edge.to === id);
}

function list(values: string[] | undefined) {
  return values?.length ? values.join(", ") : "None declared";
}

function renderNode(workflow: Workflow, node: LgirNode, index: number): string {
  const deps = dependencies(workflow, node.id);
  const depends = deps.length
    ? deps.map((edge) => `\`${edge.from}\` via ${edge.kind}${edge.contract ? ` carrying \`${edge.contract}\`` : ""}`).join("; ")
    : "Starts when the workflow begins";
  let body = `\n### ${index + 1}. ${node.name || node.id} (\`${node.id}\`)\n\n- **Kind:** \`${node.kind}\`\n- **Depends on:** ${depends}\n- **Purpose:** ${node.summary || "No summary provided."}\n`;
  if (node.kind === "agent" || node.kind === "evaluate") {
    body += `- **Role:** ${node.role || "Focused workflow specialist"}\n- **Required skills:** ${list(node.capabilities?.skills)}\n- **Required connectors:** ${list(node.capabilities?.connectors)}\n- **Required tools:** ${list(node.capabilities?.tools)}\n- **Permissions:** ${list(node.capabilities?.permissions)}\n\n**Task instructions**\n\n${node.prompt}\n`;
    const selectedCapabilities = [...(node.capabilities?.skills ?? []), ...(node.capabilities?.connectors ?? [])];
    const customized = selectedCapabilities.filter((id) => node.capabilities?.customizations?.[id]);
    if (customized.length) {
      body += `\n**Capability templates**\n\n${customized
        .map((id) => {
          const value = node.capabilities?.customizations?.[id];
          return `- \`${id}\` from \`${value?.template}\`: ${value?.instructions}`;
        })
        .join("\n")}\n`;
    }
    if (node.outputSchema) body += `\n**Expected output contract**\n\n\`\`\`json\n${JSON.stringify(node.outputSchema, null, 2)}\n\`\`\`\n`;
  } else if (node.kind === "condition") body += `\nEvaluate \`${node.config?.expression}\` and follow exactly one declared control edge.\n`;
  else if (node.kind === "transform")
    body += `\nApply the declarative \`${node.config?.operation}\` operation using \`${node.config?.expression}\`. Do not execute arbitrary code.\n`;
  else if (node.kind === "join")
    body += `\nWait using the \`${node.config?.join}\` policy, then summarize branch outputs without inventing missing results.\n`;
  else if (node.kind === "approval") body += "\nPause and request explicit user approval before continuing. State what will happen next.\n";
  else if (node.kind === "loop")
    body += `\nRepeat ${(node.config?.body ?? []).map((id) => `\`${id}\``).join(", ")} until \`${node.config?.exitCondition}\` is true, for at most ${node.config?.maxIterations} iterations. On exhaustion: \`${node.config?.onExhausted || "stop"}\`. Never exceed the bound.\n`;
  else if (node.kind === "group")
    body += `\nAccept the group input, run ${(node.config?.members ?? []).map((id) => `\`${id}\``).join(", ")} in \`${node.config?.execution}\` mode, then \`${node.config?.exit}\` every member output before releasing any group output. The group is complete only after all members finish.\n`;
  else if (node.kind === "tool")
    body += `\nThis node documents required tools (${list(node.capabilities?.tools)}) and connectors (${list(node.capabilities?.connectors)}). Use only capabilities already available and permitted.\n`;
  else if (node.kind === "input") body += "\nCapture the user's objective and constraints without adding assumptions that change scope.\n";
  else if (node.kind === "output")
    body += "\nReturn the final deliverable, unresolved risks, and a concise account of validation performed.\n";
  return body;
}

function capabilities(workflow: Workflow, target: Target): CapabilityReport {
  const instructional = ["typed data contracts"];
  if (workflow.spec.nodes.some((node) => node.kind === "loop")) instructional.push("bounded loops");
  if (workflow.spec.nodes.some((node) => node.kind === "approval")) instructional.push("human approval gates");
  if (workflow.spec.nodes.some((node) => node.kind === "group")) instructional.push("bounded group orchestration");
  if (workflow.spec.nodes.some((node) => node.capabilities?.connectors?.length)) instructional.push("declared connector availability");
  if (isCodeTarget(target)) {
    return {
      target,
      native: ["typed workflow data", "stable topological order", "dependency map", "pure readiness helper", "capability templates"],
      instructional,
      unsupported: [],
    };
  }
  return {
    target,
    native:
      target === "hermes"
        ? [
            "Hermes Agent SKILL.md metadata",
            "ordered instructions",
            "toolset guidance",
            "parallel delegation guidance",
            "copy/paste workflow",
          ]
        : ["skill frontmatter", "ordered instructions", "parallel delegation guidance", "copy/paste workflow"],
    instructional,
    unsupported: [],
  };
}

function capabilityManifest(workflow: Workflow) {
  return Object.fromEntries(
    workflow.spec.nodes.map((node) => {
      const customizations = node.capabilities?.customizations ?? {};
      const entry = (id: string, kind: "skill" | "connector") => ({
        id,
        template: customizations[id]?.template || id,
        instructions:
          customizations[id]?.instructions ||
          (kind === "skill"
            ? `Apply the '${id}' skill only within this node contract and return the declared output.`
            : `Use '${id}' only when explicitly provided by the host; never broaden its permissions.`),
      });
      return [
        node.id,
        {
          skills: (node.capabilities?.skills ?? []).map((id) => entry(id, "skill")),
          connectors: (node.capabilities?.connectors ?? []).map((id) => entry(id, "connector")),
          tools: node.capabilities?.tools ?? [],
          permissions: node.capabilities?.permissions ?? [],
        },
      ];
    }),
  );
}

function codeManifest(workflow: Workflow, analysis: AnalysisResult, target: "python" | "typescript") {
  return {
    metadata: {
      target,
      sourceHash: analysis.sourceHash,
      compilerVersion: VERSION,
      adapterVersion: `${target}-data-v1`,
      deterministic: true,
    },
    workflow,
    nodeOrder: analysis.nodeOrder,
    dependencies: Object.fromEntries(
      analysis.nodeOrder.map((id) => [
        id,
        workflow.spec.edges
          .filter((edge) => edge.to === id)
          .map((edge) => edge.from)
          .sort(),
      ]),
    ),
    capabilities: capabilityManifest(workflow),
  };
}

function pythonLiteral(value: unknown, depth = 0): string {
  const indent = "    ".repeat(depth);
  const childIndent = "    ".repeat(depth + 1);
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "None";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[\n${value.map((item) => `${childIndent}${pythonLiteral(item, depth + 1)},`).join("\n")}\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) return "{}";
  return `{\n${entries
    .map(([key, item]) => `${childIndent}${JSON.stringify(key)}: ${pythonLiteral(item, depth + 1)},`)
    .join("\n")}\n${indent}}`;
}

function compilePython(workflow: Workflow, analysis: AnalysisResult) {
  const manifest = pythonLiteral(codeManifest(workflow, analysis, "python"));
  return `"""Deterministic Ladder Graph workflow data.

Generated code performs no network, connector, agent, or model calls. Supply any
runtime handlers explicitly in the host application after validating capability
templates and permissions.
"""

from __future__ import annotations

from typing import Any, Final, Iterable


LADDER_GRAPH: Final[dict[str, Any]] = ${manifest}
WORKFLOW: Final[dict[str, Any]] = LADDER_GRAPH["workflow"]
NODE_ORDER: Final[tuple[str, ...]] = tuple(LADDER_GRAPH["nodeOrder"])
DEPENDENCIES: Final[dict[str, list[str]]] = LADDER_GRAPH["dependencies"]
CAPABILITY_TEMPLATES: Final[dict[str, dict[str, Any]]] = LADDER_GRAPH["capabilities"]


def ready_nodes(completed: Iterable[str]) -> tuple[str, ...]:
    """Return ready node IDs in the compiler's stable topological order."""
    completed_ids = frozenset(completed)
    return tuple(
        node_id
        for node_id in NODE_ORDER
        if node_id not in completed_ids
        and all(dependency in completed_ids for dependency in DEPENDENCIES[node_id])
    )


def capability_contract(node_id: str) -> dict[str, Any]:
    """Return a node's declarative templates without invoking them."""
    if node_id not in CAPABILITY_TEMPLATES:
        raise KeyError(f"Unknown Ladder Graph node: {node_id}")
    return CAPABILITY_TEMPLATES[node_id]
`;
}

function compileTypeScript(workflow: Workflow, analysis: AnalysisResult) {
  const manifest = JSON.stringify(codeManifest(workflow, analysis, "typescript"), null, 2);
  return `/**
 * Deterministic Ladder Graph workflow data.
 *
 * Generated code performs no network, connector, agent, or model calls. Supply
 * runtime handlers explicitly after validating capability templates and permissions.
 */

export const LADDER_GRAPH = ${manifest} as const;

export type LadderGraphData = typeof LADDER_GRAPH;
export type LadderNodeId = LadderGraphData["nodeOrder"][number];

export const WORKFLOW = LADDER_GRAPH.workflow;
export const NODE_ORDER = LADDER_GRAPH.nodeOrder;
export const DEPENDENCIES = LADDER_GRAPH.dependencies;
export const CAPABILITY_TEMPLATES = LADDER_GRAPH.capabilities;

/** Return ready node IDs in the compiler's stable topological order. */
export function readyNodes(completed: ReadonlySet<string>): readonly LadderNodeId[] {
  return NODE_ORDER.filter(
    (nodeId) => !completed.has(nodeId) && DEPENDENCIES[nodeId].every((dependency) => completed.has(dependency)),
  );
}

/** Return a node's declarative templates without invoking them. */
export function capabilityContract(nodeId: LadderNodeId) {
  return CAPABILITY_TEMPLATES[nodeId];
}
`;
}

export async function compileFallback(source: string, target: Target): Promise<CompileResult> {
  const analysis = await analyzeFallback(source, target);
  const report: CapabilityReport = analysis.normalized
    ? capabilities(analysis.normalized, target)
    : { target, native: [], instructional: [], unsupported: ["invalid LGIR"] };
  if (!analysis.ok || !analysis.normalized)
    return {
      ok: false,
      content: "",
      suggestedFilename: "",
      mimeType: target === "python" ? "text/x-python" : target === "typescript" ? "text/typescript" : "text/markdown",
      sourceHash: analysis.sourceHash,
      compilerVersion: VERSION,
      adapterVersion: `${target}-skill-v1`,
      capabilityReport: report,
      diagnostics: analysis.diagnostics,
    };
  const workflow = analysis.normalized;
  if (target === "python") {
    return {
      ok: true,
      content: compilePython(workflow, analysis),
      suggestedFilename: `${workflow.metadata.name}.ladder.py`,
      mimeType: "text/x-python",
      sourceHash: analysis.sourceHash,
      compilerVersion: VERSION,
      adapterVersion: "python-data-v1",
      capabilityReport: report,
      diagnostics: analysis.diagnostics,
    };
  }
  if (target === "typescript") {
    return {
      ok: true,
      content: compileTypeScript(workflow, analysis),
      suggestedFilename: `${workflow.metadata.name}.ladder.ts`,
      mimeType: "text/typescript",
      sourceHash: analysis.sourceHash,
      compilerVersion: VERSION,
      adapterVersion: "typescript-data-v1",
      capabilityReport: report,
      diagnostics: analysis.diagnostics,
    };
  }
  const title = workflow.metadata.title || workflow.metadata.name;
  const sourceDescription = (workflow.metadata.description || "Execute this Ladder Graph workflow deterministically.")
    .replace(/\n/g, " ")
    .trim();
  const hermesDescription = sourceDescription.endsWith(".") ? sourceDescription : `${sourceDescription}.`;
  const description =
    target === "hermes" ? (hermesDescription.length > 60 ? "Run this structured agent workflow." : hermesDescription) : sourceDescription;
  const harnessCapabilityRule =
    target === "codex"
      ? "Resolve named skills from the active Codex skill catalog (including `.agents/skills/`) and use only configured connectors."
      : target === "claude"
        ? "Resolve named skills from the active Claude skill catalog (including `.claude/skills/`) and use only configured connectors."
        : "Resolve named skills from the active Hermes catalog (including `~/.hermes/skills/`). Confirm required Hermes toolsets with `hermes tools`, and use only configured MCP servers or OpenRouter profiles.";
  const metadata =
    target === "hermes"
      ? `version: 1.0.0\nmetadata:\n  hermes:\n    tags: [ladder-graph, workflow, orchestration]\n    category: orchestration\n  ladder-target: ${target}\n  ladder-source-hash: ${analysis.sourceHash}\n  ladder-compiler: ${VERSION}\n  target-docs-as-of: 2026-08-15`
      : `metadata:\n  ladder-target: ${target}\n  ladder-source-hash: ${analysis.sourceHash}\n  ladder-compiler: ${VERSION}\n  target-docs-as-of: 2026-08-15`;
  const hermesSetup =
    target === "hermes"
      ? `\n\n## Hermes setup\n\nSave this document as \`~/.hermes/skills/ladder-graph/${workflow.metadata.name}/SKILL.md\`. Before use, confirm every named toolset and MCP server is enabled for the active Hermes profile. Configure OpenRouter separately; never place provider credentials in this skill.\n`
      : "";
  let content = `---\nname: ${workflow.metadata.name}\ndescription: ${JSON.stringify(description)}\n${metadata}\n---\n\n# ${title}\n\n> Compiled by Ladder Graph for ${targetLabel(target)}. This file is instruction-only: it does not grant permissions, execute tools, or contact a model provider.${hermesSetup}\n\n## Objective\n\n${workflow.spec.objective}\n\n## Operating rules\n\n1. Respect dependency order and pass only named outputs required downstream.\n2. Run independent ready nodes in parallel when supported; otherwise preserve their independence while running sequentially.\n3. Treat schemas, approvals, and loop bounds as mandatory instructions. Stop and explain unavailable capabilities.\n4. Do not broaden tool permissions or execute code embedded in this definition.\n5. On failure, follow \`${workflow.spec.policies?.onFailure ?? "stop"}\`. Maximum concurrency is ${workflow.spec.policies?.maxConcurrency ?? 4}.\n6. ${harnessCapabilityRule} If a required skill or connector is unavailable, stop that node and report the missing capability.\n\n## Workflow\n`;
  const byId = new Map(workflow.spec.nodes.map((node) => [node.id, node]));
  analysis.nodeOrder.forEach((id, index) => {
    const node = byId.get(id);
    if (node) content += renderNode(workflow, node, index);
  });
  content +=
    "\n## Completion contract\n\n- Confirm every reachable output dependency completed or was reported unavailable.\n- Report loop iteration counts and whether each exit condition passed.\n- Separate verified results from assumptions or incomplete work.\n- Return the declared output and no hidden chain-of-thought.\n";
  return {
    ok: true,
    content,
    suggestedFilename: `${workflow.metadata.name}.${target}.md`,
    mimeType: "text/markdown",
    sourceHash: analysis.sourceHash,
    compilerVersion: VERSION,
    adapterVersion: `${target}-skill-v1`,
    capabilityReport: report,
    diagnostics: analysis.diagnostics,
  };
}

export async function formatFallback(source: string): Promise<FormatResult> {
  const parsed = parse(source);
  if (!parsed.workflow) return { ok: false, content: source, diagnostics: parsed.diagnostics };
  return { ok: true, content: stringify(parsed.workflow, { indent: 2, lineWidth: 100 }), diagnostics: [] };
}

export async function migrateFallback(source: string, toVersion: string): Promise<FormatResult> {
  const parsed = parse(source);
  if (!parsed.workflow) return { ok: false, content: source, diagnostics: parsed.diagnostics };
  if (toVersion !== "ladder.dev/v1alpha1")
    return {
      ok: false,
      content: source,
      diagnostics: [diagnostic("LG400", "error", "/apiVersion", `No migration path exists to ${toVersion}.`)],
    };
  parsed.workflow.apiVersion = "ladder.dev/v1alpha1";
  return { ok: true, content: stringify(parsed.workflow, { indent: 2, lineWidth: 100 }), diagnostics: [] };
}
