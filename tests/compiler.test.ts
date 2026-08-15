import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { analyzeFallback, compileFallback, formatFallback } from "../src/compiler/fallback";
import { WORKFLOW_TEMPLATES } from "../src/lib/templates";
import type { Workflow } from "../src/types";

describe("LGIR fallback compiler", () => {
  it("analyzes every bundled workflow template", async () => {
    for (const template of WORKFLOW_TEMPLATES) {
      const result = await analyzeFallback(template.yaml, "codex");
      expect(result.ok, `${template.id}: ${JSON.stringify(result.diagnostics)}`).toBe(true);
      expect(result.stats.nodes).toBeGreaterThanOrEqual(3);
      expect(result.nodeOrder).toHaveLength(result.stats.nodes);
    }
  });

  it("rejects unbounded loops with a safe repair", async () => {
    const source = WORKFLOW_TEMPLATES[0].yaml.replace("maxIterations: 3", "maxIterations: 0");
    const result = await analyzeFallback(source, "codex");
    const loopError = result.diagnostics.find((item) => item.code === "LG120");
    expect(result.ok).toBe(false);
    expect(loopError?.fix).toEqual(expect.objectContaining({ value: 3 }));
  });

  it("rejects arbitrary back edges", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[1].yaml) as Workflow;
    const lastNode = workflow.spec.nodes.at(-1);
    if (!lastNode) throw new Error("The cycle fixture requires at least one node.");
    workflow.spec.edges.push({
      id: "cycle",
      from: lastNode.id,
      to: workflow.spec.nodes[0].id,
      kind: "dependency",
    });
    const result = await analyzeFallback(stringify(workflow));
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG150" })]));
  });

  it("schedules grouped members inside the group boundary before downstream work", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[1].yaml) as Workflow;
    const output = workflow.spec.nodes.find((node) => node.kind === "output");
    const members = workflow.spec.nodes.filter((node) => node.kind === "agent").slice(0, 2);
    if (!output || members.length < 2) throw new Error("The group fixture requires two agents and an output.");
    const group = {
      id: "implementation-group",
      kind: "group" as const,
      name: "Implementation group",
      config: { members: members.map((node) => node.id), execution: "parallel" as const, exit: "aggregate" as const },
    };
    workflow.spec.nodes.push(group);
    workflow.spec.edges = workflow.spec.edges.filter((edge) => !members.some((member) => edge.from === member.id || edge.to === member.id));
    workflow.spec.edges.push({ id: "group-exit", from: group.id, to: output.id, kind: "data" });

    const result = await analyzeFallback(stringify(workflow));
    expect(result.ok).toBe(true);
    expect(result.nodeOrder.indexOf(group.id)).toBeLessThan(result.nodeOrder.indexOf(members[0].id));
    expect(result.nodeOrder.indexOf(group.id)).toBeLessThan(result.nodeOrder.indexOf(members[1].id));
    expect(result.nodeOrder.indexOf(members[0].id)).toBeLessThan(result.nodeOrder.indexOf(output.id));
    expect(result.nodeOrder.indexOf(members[1].id)).toBeLessThan(result.nodeOrder.indexOf(output.id));
  });

  it("rejects a group that references a missing member", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[0].yaml) as Workflow;
    workflow.spec.nodes.push({
      id: "broken-group",
      kind: "group",
      name: "Broken group",
      config: { members: ["missing"], execution: "sequential", exit: "serialize" },
    });
    const result = await analyzeFallback(stringify(workflow));
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG129" })]));
  });

  it("compiles deterministic, target-specific Markdown", async () => {
    const source = WORKFLOW_TEMPLATES[2].yaml;
    const [codexOne, codexTwo, claude] = await Promise.all([
      compileFallback(source, "codex"),
      compileFallback(source, "codex"),
      compileFallback(source, "claude"),
    ]);
    expect(codexOne.ok).toBe(true);
    expect(codexOne.content).toBe(codexTwo.content);
    expect(codexOne.sourceHash).toBe(codexTwo.sourceHash);
    expect(codexOne.suggestedFilename).toMatch(/\.codex\.md$/);
    expect(claude.suggestedFilename).toMatch(/\.claude\.md$/);
    expect(claude.content).toContain("ladder-target: claude");
  });

  it("compiles a Hermes Agent SKILL.md workflow with declarative connectors", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[2].yaml) as Workflow;
    const agent = workflow.spec.nodes.find((node) => node.kind === "agent");
    if (!agent) throw new Error("The Hermes fixture requires an agent node.");
    agent.capabilities = {
      ...agent.capabilities,
      skills: ["hermes-agent", "research"],
      connectors: ["hermes:toolset:web", "mcp:github", "provider:openrouter"],
    };

    const first = await compileFallback(stringify(workflow), "hermes");
    const second = await compileFallback(stringify(workflow), "hermes");

    expect(first.ok).toBe(true);
    expect(first.content).toBe(second.content);
    expect(first.suggestedFilename).toMatch(/\.hermes\.md$/);
    expect(first.adapterVersion).toBe("hermes-skill-v1");
    expect(first.content).toContain("ladder-target: hermes");
    expect(first.content).toContain("metadata:\n  hermes:");
    const frontmatter = parse(first.content.split("---")[1]) as { description: string };
    expect(frontmatter.description.length).toBeLessThanOrEqual(60);
    expect(frontmatter.description.endsWith(".")).toBe(true);
    expect(first.content).toContain("~/.hermes/skills/ladder-graph/");
    expect(first.content).toContain("hermes:toolset:web, mcp:github, provider:openrouter");
    expect(first.content).toContain("never place provider credentials in this skill");
    expect(first.capabilityReport.native).toContain("Hermes Agent SKILL.md metadata");
  });

  it("preserves declarative connectors in target output", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[2].yaml) as Workflow;
    const agent = workflow.spec.nodes.find((node) => node.kind === "agent");
    if (!agent) throw new Error("The connector fixture requires an agent node.");
    agent.capabilities = { ...agent.capabilities, connectors: ["mcp:github", "custom:knowledge-base"] };
    const source = stringify(workflow);
    const result = await compileFallback(source, "codex");

    expect(result.content).toContain("**Required connectors:** mcp:github, custom:knowledge-base");
    expect(result.content).toContain(".agents/skills/");
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LG201" })]));
    expect(result.capabilityReport.instructional).toContain("declared connector availability");
  });

  it("compiles deterministic Python and TypeScript data modules", async () => {
    const workflow = parse(WORKFLOW_TEMPLATES[2].yaml) as Workflow;
    const agent = workflow.spec.nodes.find((node) => node.kind === "agent");
    if (!agent) throw new Error("The code target fixture requires an agent node.");
    agent.capabilities = {
      ...agent.capabilities,
      skills: ["research"],
      connectors: ["custom:evidence-store"],
      customizations: {
        research: { template: "research", instructions: "Require two independent primary sources." },
        "custom:evidence-store": {
          template: "custom-connector",
          instructions: "Read evidence snapshots through the host-provided adapter only.",
        },
      },
    };
    const source = stringify(workflow);
    const [pythonOne, pythonTwo, typescript] = await Promise.all([
      compileFallback(source, "python"),
      compileFallback(source, "python"),
      compileFallback(source, "typescript"),
    ]);

    expect(pythonOne.ok).toBe(true);
    expect(pythonOne.content).toBe(pythonTwo.content);
    expect(pythonOne.suggestedFilename).toMatch(/\.ladder\.py$/);
    expect(pythonOne.mimeType).toBe("text/x-python");
    expect(pythonOne.content).toContain("def ready_nodes");
    expect(pythonOne.content).toContain("custom:evidence-store");
    expect(typescript.suggestedFilename).toMatch(/\.ladder\.ts$/);
    expect(typescript.mimeType).toBe("text/typescript");
    expect(typescript.content).toContain("export function readyNodes");
    expect(typescript.content).toContain("Require two independent primary sources.");
    expect(typescript.capabilityReport.native).toContain("capability templates");
  });

  it("formats valid YAML and blocks aliases", async () => {
    const formatted = await formatFallback(WORKFLOW_TEMPLATES[0].yaml);
    const hostile = await analyzeFallback("a: &shared [1]\nb: *shared\n");
    expect(formatted.ok).toBe(true);
    expect(formatted.content).toContain("apiVersion: ladder.dev/v1alpha1");
    expect(hostile.diagnostics[0].code).toBe("LG004");
  });

  it("blocks external schema references", async () => {
    const source = WORKFLOW_TEMPLATES[0].yaml.replace("type: object", "$ref: https://example.com/schema.json");
    const result = await analyzeFallback(source);
    expect(result.diagnostics[0].code).toBe("LG005");
  });
});
