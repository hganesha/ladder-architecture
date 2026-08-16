import { describe, expect, it } from "vitest";
import { recommendedCapabilities, TARGET_CAPABILITY_CATALOGS } from "../src/lib/capabilityCatalog";
import { ROLE_TEMPLATES } from "../src/lib/roleTemplates";
import type { LgirNode } from "../src/types";

describe("target capability catalogs", () => {
  it("includes the researched specialist roles and OpenRouter model profiles without duplicate IDs", () => {
    const researchedRoles = ROLE_TEMPLATES.filter((role) => role.path.startsWith("research/"));
    const roleIds = researchedRoles.map((role) => role.id);
    const openRouterProfiles = TARGET_CAPABILITY_CATALOGS.codex.connectors.filter((connector) =>
      connector.id.startsWith("api:openrouter/"),
    );

    expect(researchedRoles).toHaveLength(85);
    expect(new Set(roleIds).size).toBe(roleIds.length);
    expect(openRouterProfiles).toHaveLength(15);
    expect(new Set(openRouterProfiles.map((connector) => connector.id)).size).toBe(openRouterProfiles.length);
  });

  it("uses target-specific skill locations and discovery options", () => {
    expect(TARGET_CAPABILITY_CATALOGS.codex.skillLocation).toBe(".agents/skills/");
    expect(TARGET_CAPABILITY_CATALOGS.claude.skillLocation).toBe(".claude/skills/");
    expect(TARGET_CAPABILITY_CATALOGS.hermes.skillLocation).toBe("~/.hermes/skills/");
    expect(TARGET_CAPABILITY_CATALOGS.codex.skills.some((skill) => skill.id === "repository-navigation")).toBe(true);
    expect(TARGET_CAPABILITY_CATALOGS.claude.skills.some((skill) => skill.id === "codebase-analysis")).toBe(true);
    expect(TARGET_CAPABILITY_CATALOGS.hermes.skills.some((skill) => skill.id === "hermes-agent")).toBe(true);
    expect(TARGET_CAPABILITY_CATALOGS.hermes.connectors.some((connector) => connector.id === "provider:openrouter")).toBe(true);
    expect(TARGET_CAPABILITY_CATALOGS.hermes.connectors.some((connector) => connector.id === "mcp:github")).toBe(true);
    expect(TARGET_CAPABILITY_CATALOGS.hermes.connectors.some((connector) => connector.id === "hermes:toolset:web")).toBe(true);
    expect(TARGET_CAPABILITY_CATALOGS.python.skills.some((skill) => skill.id === "python-callable")).toBe(true);
    expect(TARGET_CAPABILITY_CATALOGS.typescript.skills.some((skill) => skill.id === "typescript-handler")).toBe(true);
    expect(TARGET_CAPABILITY_CATALOGS.python.artifactDescription).toContain("data module");
  });

  it("recommends Hermes-native toolsets without dropping shared connectors", () => {
    const node: LgirNode = {
      id: "research-and-build",
      kind: "agent",
      name: "Research and implement",
      role: "Software researcher",
      prompt: "Research primary evidence, then implement and verify the code.",
    };
    const recommendation = recommendedCapabilities("hermes", node);

    expect(recommendation.skills.has("hermes-agent")).toBe(true);
    expect(recommendation.skills.has("implementation")).toBe(true);
    expect(recommendation.connectors.has("hermes:toolset:web")).toBe(true);
    expect(recommendation.connectors.has("hermes:toolset:file")).toBe(true);
    expect(recommendation.connectors.has("mcp:github")).toBe(true);
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

  it("recommends researched multimodal and architecture capabilities", () => {
    const media = recommendedCapabilities("codex", {
      id: "storyboard",
      kind: "agent",
      name: "Video storyboard generation",
      prompt: "Generate a video asset and wait for the asynchronous provider job.",
    });
    const building = recommendedCapabilities("codex", {
      id: "coordination",
      kind: "agent",
      name: "BIM building coordination",
      prompt: "Coordinate structural, MEP, and accessibility issues.",
    });

    expect(media.skills.has("video-generation")).toBe(true);
    expect(media.skills.has("async-media-jobs")).toBe(true);
    expect(media.connectors.has("api:openrouter/google/veo-3.1-fast")).toBe(true);
    expect(building.skills.has("building-design")).toBe(true);
    expect(building.connectors.has("mcp:bim")).toBe(true);
  });

  it("recommends humanities, writing, and personal-development capabilities", () => {
    const historian = recommendedCapabilities("codex", {
      id: "archive",
      kind: "agent",
      name: "Historical primary source analyst",
      prompt: "Review archival evidence and its historiography.",
    });
    const editor = recommendedCapabilities("codex", {
      id: "editor",
      kind: "agent",
      name: "Developmental manuscript editor",
      prompt: "Review the writing structure before prose polish.",
    });
    const coach = recommendedCapabilities("codex", {
      id: "habit",
      kind: "agent",
      name: "Habit and goal coach",
      prompt: "Build a sustainable behavior and weekly reflection plan.",
    });

    expect(historian.skills.has("historical-research")).toBe(true);
    expect(historian.skills.has("source-criticism")).toBe(true);
    expect(historian.connectors.has("mcp:archives")).toBe(true);
    expect(editor.skills.has("developmental-editing")).toBe(true);
    expect(editor.connectors.has("mcp:document-editor")).toBe(true);
    expect(coach.skills.has("behavior-change")).toBe(true);
    expect(coach.connectors.has("mcp:calendar")).toBe(true);
  });
});
