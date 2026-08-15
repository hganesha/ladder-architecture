import type { LgirNode, Target } from "../types";

export interface CapabilityOption {
  id: string;
  label: string;
  description: string;
}

interface TargetCapabilityCatalog {
  label: string;
  skillLocation: string;
  connectorLocation: string;
  skills: CapabilityOption[];
  connectors: CapabilityOption[];
}

const sharedSkills: CapabilityOption[] = [
  { id: "implementation", label: "Implementation", description: "Make scoped code changes and preserve existing behavior." },
  { id: "test-design", label: "Test design", description: "Design focused unit, integration, and regression coverage." },
  { id: "evaluation", label: "Evaluation", description: "Score work against explicit evidence and pass thresholds." },
  { id: "research", label: "Research", description: "Gather primary evidence and separate facts from inference." },
  { id: "product-management", label: "Product management", description: "Frame user value, scope, tradeoffs, and acceptance criteria." },
  { id: "product-design", label: "Product design", description: "Design journeys, hierarchy, states, and interaction behavior." },
  { id: "accessibility", label: "Accessibility", description: "Check keyboard, screen-reader, contrast, and motion needs." },
  {
    id: "software-architecture",
    label: "Software architecture",
    description: "Define boundaries, interfaces, data, and operational tradeoffs.",
  },
  { id: "data-modeling", label: "Data modeling", description: "Design durable schemas, ownership, and migrations." },
  { id: "application-security", label: "Application security", description: "Review trust boundaries, abuse paths, and mitigations." },
  { id: "privacy-review", label: "Privacy review", description: "Assess sensitive data handling, retention, and exposure." },
  { id: "release-engineering", label: "Release engineering", description: "Plan deployment, rollback, and release evidence." },
  { id: "observability", label: "Observability", description: "Define logs, metrics, traces, and health checks." },
  { id: "documentation", label: "Documentation", description: "Create clear, maintainable developer and user guidance." },
];

const sharedConnectors: CapabilityOption[] = [
  { id: "mcp:github", label: "GitHub", description: "Repositories, issues, pull requests, and review context." },
  { id: "mcp:linear", label: "Linear", description: "Product issues, projects, and delivery context." },
  { id: "mcp:notion", label: "Notion", description: "Workspace docs, specifications, and research notes." },
  { id: "mcp:slack", label: "Slack", description: "Team conversations and coordination context." },
  { id: "mcp:postgres", label: "Postgres", description: "Database schemas, queries, and structured data." },
  { id: "mcp:browser", label: "Browser", description: "Web research and browser-based verification." },
  { id: "mcp:figma", label: "Figma", description: "Design files, frames, variables, and component context." },
  { id: "mcp:sentry", label: "Sentry", description: "Errors, traces, releases, and production diagnostics." },
];

export const TARGET_CAPABILITY_CATALOGS: Record<Target, TargetCapabilityCatalog> = {
  codex: {
    label: "Codex",
    skillLocation: ".agents/skills/",
    connectorLocation: "Codex connectors and configured MCP servers",
    skills: [
      {
        id: "repository-navigation",
        label: "Repository navigation",
        description: "Find instructions, conventions, ownership, and relevant code quickly.",
      },
      ...sharedSkills,
      { id: "openai-docs", label: "OpenAI docs", description: "Use current official OpenAI product and API documentation." },
    ],
    connectors: sharedConnectors,
  },
  claude: {
    label: "Claude",
    skillLocation: ".claude/skills/",
    connectorLocation: "Claude connectors and configured MCP servers",
    skills: [
      { id: "codebase-analysis", label: "Codebase analysis", description: "Map repository structure, conventions, and change surfaces." },
      ...sharedSkills,
      { id: "subagent-delegation", label: "Subagent delegation", description: "Split independent work into bounded specialist tasks." },
    ],
    connectors: sharedConnectors,
  },
};

export function recommendedCapabilities(target: Target, node: LgirNode) {
  const text = `${node.name} ${node.role ?? ""} ${node.prompt ?? ""} ${(node.capabilities?.skills ?? []).join(" ")}`.toLowerCase();
  const skills = new Set<string>([target === "codex" ? "repository-navigation" : "codebase-analysis"]);
  const connectors = new Set<string>();
  const match = (terms: string[]) => terms.some((term) => text.includes(term));

  if (match(["implement", "engineer", "code", "frontend", "backend"])) {
    skills.add("implementation");
    connectors.add("mcp:github");
  }
  if (match(["test", "quality", "evaluate", "critic", "review"])) skills.add(node.kind === "evaluate" ? "evaluation" : "test-design");
  if (match(["design", "ux", "accessib"])) {
    skills.add("product-design");
    skills.add("accessibility");
    connectors.add("mcp:figma");
    connectors.add("mcp:browser");
  }
  if (match(["architect", "system", "interface"])) skills.add("software-architecture");
  if (match(["database", "data model", "migration", "backend"])) {
    skills.add("data-modeling");
    connectors.add("mcp:postgres");
  }
  if (match(["security", "privacy", "threat"])) {
    skills.add("application-security");
    skills.add("privacy-review");
  }
  if (match(["research", "evidence", "literature"])) {
    skills.add("research");
    connectors.add("mcp:browser");
    connectors.add("mcp:notion");
  }
  if (match(["product manager", "opportunity", "feature", "roadmap"])) {
    skills.add("product-management");
    connectors.add("mcp:linear");
  }
  if (match(["release", "deploy", "production", "observability"])) {
    skills.add("release-engineering");
    skills.add("observability");
    connectors.add("mcp:github");
    connectors.add("mcp:sentry");
  }

  return { skills, connectors };
}
