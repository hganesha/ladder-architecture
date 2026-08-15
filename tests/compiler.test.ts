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
