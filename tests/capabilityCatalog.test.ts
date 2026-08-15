import { describe, expect, it } from "vitest";
import { recommendedCapabilities, TARGET_CAPABILITY_CATALOGS } from "../src/lib/capabilityCatalog";
import type { LgirNode } from "../src/types";

describe("target capability catalogs", () => {
  it("uses target-specific skill locations and discovery options", () => {
    expect(TARGET_CAPABILITY_CATALOGS.codex.skillLocation).toBe(".agents/skills/");
    expect(TARGET_CAPABILITY_CATALOGS.claude.skillLocation).toBe(".claude/skills/");
    expect(TARGET_CAPABILITY_CATALOGS.codex.skills.some((skill) => skill.id === "repository-navigation")).toBe(true);
    expect(TARGET_CAPABILITY_CATALOGS.claude.skills.some((skill) => skill.id === "codebase-analysis")).toBe(true);
  });

  it("recommends skills and connectors from node responsibility", () => {
    const node: LgirNode = {
      id: "security-gate",
      kind: "evaluate",
      name: "Security and privacy gate",
      role: "Application security reviewer",
      prompt: "Review production authorization and sensitive data handling.",
    };
    const recommendation = recommendedCapabilities("codex", node);

    expect(recommendation.skills.has("repository-navigation")).toBe(true);
    expect(recommendation.skills.has("application-security")).toBe(true);
    expect(recommendation.skills.has("privacy-review")).toBe(true);
    expect(recommendation.connectors.has("mcp:sentry")).toBe(true);
  });
});
