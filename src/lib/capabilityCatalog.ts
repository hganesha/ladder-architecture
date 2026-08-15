import type { LgirNode, Target } from "../types";
import { RESEARCH_ROLE_SKILLS } from "./roleTemplates";

export interface CapabilityOption {
  id: string;
  label: string;
  description: string;
}

interface TargetCapabilityCatalog {
  label: string;
  skillLocation: string;
  connectorLocation: string;
  artifactDescription: string;
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

const multimodalSkills: CapabilityOption[] = [
  {
    id: "multimodal-model-selection",
    label: "Multimodal model selection",
    description: "Choose a model from modality, quality, latency, cost, and provider constraints.",
  },
  {
    id: "image-generation",
    label: "Image generation",
    description: "Turn an approved visual brief into generated image assets with explicit dimensions and format.",
  },
  {
    id: "image-editing",
    label: "Image editing",
    description: "Use reference images for bounded edits while preserving requested content and composition.",
  },
  {
    id: "video-generation",
    label: "Video generation",
    description: "Generate video from a storyboard with duration, aspect ratio, motion, and delivery constraints.",
  },
  {
    id: "speech-generation",
    label: "Speech generation",
    description: "Synthesize speech from approved text with voice, pace, format, and accessibility requirements.",
  },
  {
    id: "music-generation",
    label: "Music generation",
    description: "Generate music from a structured creative brief and explicit rights and usage constraints.",
  },
  {
    id: "audio-transcription",
    label: "Audio transcription",
    description: "Transcribe supplied audio with language, timestamps, speaker, and uncertainty requirements.",
  },
  {
    id: "async-media-jobs",
    label: "Async media jobs",
    description: "Submit, poll, time out, retry, and collect asynchronous media generation jobs safely.",
  },
  {
    id: "media-safety-review",
    label: "Media safety review",
    description: "Review generated media for policy, rights, privacy, provenance, and brief compliance before release.",
  },
];

function uniqueOptions(options: CapabilityOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}

const expandedSkills = uniqueOptions([...sharedSkills, ...RESEARCH_ROLE_SKILLS, ...multimodalSkills]);

const sharedConnectors: CapabilityOption[] = [
  { id: "mcp:github", label: "GitHub", description: "Repositories, issues, pull requests, and review context." },
  { id: "mcp:linear", label: "Linear", description: "Product issues, projects, and delivery context." },
  { id: "mcp:notion", label: "Notion", description: "Workspace docs, specifications, and research notes." },
  { id: "mcp:slack", label: "Slack", description: "Team conversations and coordination context." },
  { id: "mcp:postgres", label: "Postgres", description: "Database schemas, queries, and structured data." },
  { id: "mcp:browser", label: "Browser", description: "Web research and browser-based verification." },
  { id: "mcp:figma", label: "Figma", description: "Design files, frames, variables, and component context." },
  { id: "mcp:sentry", label: "Sentry", description: "Errors, traces, releases, and production diagnostics." },
  {
    id: "mcp:security-scanner",
    label: "Security scanners",
    description: "Authorized SAST, DAST, dependency, secret, container, and vulnerability scanning evidence.",
  },
  { id: "mcp:siem", label: "SIEM", description: "Security alerts, correlated events, searches, and investigation timelines." },
  { id: "mcp:edr", label: "Endpoint detection", description: "Endpoint alerts, process trees, containment status, and host evidence." },
  {
    id: "mcp:threat-intel",
    label: "Threat intelligence",
    description: "IOC enrichment, threat-actor profiles, TTPs, and confidence-scored intelligence.",
  },
  {
    id: "mcp:incident-management",
    label: "Incident management",
    description: "Incident timelines, responders, status, escalations, and communication records.",
  },
  {
    id: "mcp:cloud-security",
    label: "Cloud security posture",
    description: "Cloud inventory, IAM, exposure, configuration, and key-management evidence.",
  },
  {
    id: "mcp:iam",
    label: "Identity provider",
    description: "Identity, federation, MFA, conditional access, privileged roles, and entitlement reviews.",
  },
  { id: "mcp:grc", label: "GRC platform", description: "Controls, risks, frameworks, evidence, exceptions, vendors, and audit ownership." },
  { id: "mcp:bim", label: "BIM / CAD", description: "Building models, drawings, parameters, schedules, coordination, and issue context." },
  { id: "mcp:gis", label: "GIS", description: "Site, parcel, zoning, environmental, mobility, and geographic analysis layers." },
  { id: "mcp:rendering", label: "Rendering", description: "Architectural visualization, material, lighting, and review outputs." },
  {
    id: "mcp:energy-modeling",
    label: "Energy modeling",
    description: "Building energy, daylight, envelope, load, and performance simulation evidence.",
  },
  {
    id: "mcp:cost-estimation",
    label: "Cost estimation",
    description: "Quantities, unit costs, allowances, escalation, contingency, and budget reconciliation.",
  },
  {
    id: "mcp:construction-management",
    label: "Construction management",
    description: "Schedules, RFIs, submittals, field evidence, issues, procurement, and change control.",
  },
  {
    id: "api:openrouter/google/gemini-3-pro-image",
    label: "Nano Banana Pro",
    description:
      "OpenRouter image profile for complex prompt adherence, text rendering, and reference-guided editing; verify current model slug and pricing.",
  },
  {
    id: "api:openrouter/google/gemini-2.5-flash-image",
    label: "Nano Banana",
    description: "OpenRouter image profile for faster, lower-cost iteration and image editing; verify current model slug and pricing.",
  },
  {
    id: "api:openrouter/openai/gpt-image-2",
    label: "GPT Image 2",
    description: "OpenRouter image profile for photorealism and typography-heavy assets; verify current availability and pricing.",
  },
  {
    id: "api:openrouter/black-forest-labs/flux.2-pro",
    label: "FLUX.2 Pro",
    description: "OpenRouter image profile for high-fidelity artistic, editorial, and product imagery; verify current model slug.",
  },
  {
    id: "api:openrouter/bytedance-seed/seedream-4.5",
    label: "Seedream 4.5",
    description: "OpenRouter image profile for stylized illustration and concept exploration; verify current model slug.",
  },
  {
    id: "api:openrouter/x-ai/grok-imagine-image-quality",
    label: "Grok Imagine Image",
    description: "OpenRouter image-quality profile for high-fidelity generation; verify current model slug and parameters.",
  },
  {
    id: "api:openrouter/google/veo-3.1",
    label: "Veo 3.1",
    description: "OpenRouter asynchronous video profile using submit, poll or callback, and download; verify endpoint and pricing.",
  },
  {
    id: "api:openrouter/google/veo-3.1-fast",
    label: "Veo 3.1 Fast",
    description: "OpenRouter asynchronous video profile optimized for faster iteration; verify endpoint, slug, and pricing.",
  },
  {
    id: "api:openrouter/bytedance/seedance-2.5",
    label: "Seedance 2.5",
    description: "OpenRouter asynchronous video generation profile; verify current model slug and supported controls.",
  },
  {
    id: "api:openrouter/kwaivgi/kling-v3.0-std",
    label: "Kling Video v3 Standard",
    description: "OpenRouter asynchronous standard-tier video profile; verify current model slug and controls.",
  },
  {
    id: "api:openrouter/minimax/hailuo-3",
    label: "MiniMax Hailuo 3",
    description: "OpenRouter asynchronous video generation profile; verify current availability, endpoint, and pricing.",
  },
  {
    id: "api:openrouter/openai/gpt-audio",
    label: "GPT Audio",
    description: "OpenRouter speech generation profile returning audio bytes; verify voices, formats, endpoint, and pricing.",
  },
  {
    id: "api:openrouter/openai/gpt-audio-mini",
    label: "GPT Audio Mini",
    description: "OpenRouter lower-cost speech generation profile; verify current voices, formats, and pricing.",
  },
  {
    id: "api:openrouter/google/lyria-3-pro-preview",
    label: "Lyria 3 Pro Preview",
    description: "OpenRouter music generation snapshot; endpoint and asynchronous behavior must be verified before use.",
  },
  {
    id: "api:openrouter/openai/whisper-large-v3",
    label: "Whisper Large v3",
    description: "OpenRouter audio transcription profile; verify endpoint, input limits, language support, and pricing.",
  },
];

const hermesToolsets: CapabilityOption[] = [
  { id: "hermes:toolset:web", label: "Hermes web", description: "Hermes web_search and web_extract tools for sourced web research." },
  {
    id: "hermes:toolset:terminal",
    label: "Hermes terminal",
    description: "Hermes terminal and process tools; require an explicitly approved backend and permissions.",
  },
  {
    id: "hermes:toolset:file",
    label: "Hermes files",
    description: "Hermes read, write, patch, and search tools within the configured workspace.",
  },
  {
    id: "hermes:toolset:browser",
    label: "Hermes browser",
    description: "Hermes interactive browser navigation, inspection, and verification tools.",
  },
  {
    id: "hermes:toolset:vision",
    label: "Hermes vision",
    description: "Hermes image analysis toolset, commonly backed by an explicitly configured OpenRouter model.",
  },
  {
    id: "hermes:toolset:image_gen",
    label: "Hermes image generation",
    description: "Hermes image generation toolset through the user's configured provider or Nous Tool Gateway.",
  },
  { id: "hermes:toolset:skills", label: "Hermes skills", description: "Discover and progressively load installed Hermes Agent Skills." },
  {
    id: "hermes:toolset:delegation",
    label: "Hermes delegation",
    description: "Delegate bounded independent work to isolated Hermes subagents.",
  },
  {
    id: "hermes:toolset:memory",
    label: "Hermes memory",
    description: "Use explicitly configured persistent memory and recall capabilities.",
  },
  {
    id: "hermes:toolset:cronjob",
    label: "Hermes cron jobs",
    description: "Create and manage scheduled work only when the workflow grants that authority.",
  },
  {
    id: "hermes:toolset:safe",
    label: "Hermes safe preset",
    description: "Read-oriented web, vision, and mixture-of-agents preset without terminal access.",
  },
  {
    id: "provider:openrouter",
    label: "OpenRouter provider",
    description: "Use the user's configured OpenRouter provider without embedding API keys or selecting undeclared models.",
  },
];

export const TARGET_CAPABILITY_CATALOGS: Record<Target, TargetCapabilityCatalog> = {
  codex: {
    label: "Codex",
    skillLocation: ".agents/skills/",
    connectorLocation: "Codex connectors and configured MCP servers",
    artifactDescription: "Instructional Markdown skill",
    skills: [
      {
        id: "repository-navigation",
        label: "Repository navigation",
        description: "Find instructions, conventions, ownership, and relevant code quickly.",
      },
      ...expandedSkills,
      { id: "openai-docs", label: "OpenAI docs", description: "Use current official OpenAI product and API documentation." },
    ],
    connectors: sharedConnectors,
  },
  claude: {
    label: "Claude",
    skillLocation: ".claude/skills/",
    connectorLocation: "Claude connectors and configured MCP servers",
    artifactDescription: "Instructional Markdown skill",
    skills: [
      { id: "codebase-analysis", label: "Codebase analysis", description: "Map repository structure, conventions, and change surfaces." },
      ...expandedSkills,
      { id: "subagent-delegation", label: "Subagent delegation", description: "Split independent work into bounded specialist tasks." },
    ],
    connectors: sharedConnectors,
  },
  hermes: {
    label: "Hermes Agent",
    skillLocation: "~/.hermes/skills/",
    connectorLocation: "Hermes toolsets, configured MCP servers, and declarative OpenRouter profiles",
    artifactDescription: "Hermes Agent SKILL.md workflow",
    skills: [
      {
        id: "hermes-agent",
        label: "Hermes Agent",
        description: "Configure and use Hermes Agent's native workflow, toolset, and delegation capabilities.",
      },
      {
        id: "hermes-agent-skill-authoring",
        label: "Hermes skill authoring",
        description: "Author or adapt Agent Skills-compatible Hermes skill content.",
      },
      ...expandedSkills,
      {
        id: "codex",
        label: "Codex delegation",
        description: "Delegate a bounded coding task through the installed Hermes Codex skill when available.",
      },
    ],
    connectors: uniqueOptions([...hermesToolsets, ...sharedConnectors]),
  },
  python: {
    label: "Python",
    skillLocation: "Embedded capability templates",
    connectorLocation: "Custom connector declarations; no imports or network calls",
    artifactDescription: "Deterministic Python data module",
    skills: [
      { id: "python-callable", label: "Python callable", description: "Bind a node to an explicitly supplied Python callable." },
      { id: "python-validation", label: "Python validation", description: "Validate node inputs and outputs with deterministic code." },
      ...expandedSkills,
    ],
    connectors: sharedConnectors,
  },
  typescript: {
    label: "TypeScript",
    skillLocation: "Embedded capability templates",
    connectorLocation: "Custom connector declarations; no imports or network calls",
    artifactDescription: "Deterministic typed data module",
    skills: [
      { id: "typescript-handler", label: "TypeScript handler", description: "Bind a node to an explicitly supplied typed handler." },
      { id: "schema-validation", label: "Schema validation", description: "Validate node contracts with deterministic TypeScript." },
      ...expandedSkills,
    ],
    connectors: sharedConnectors,
  },
};

export function recommendedCapabilities(target: Target, node: LgirNode) {
  const text = `${node.name} ${node.role ?? ""} ${node.prompt ?? ""} ${(node.capabilities?.skills ?? []).join(" ")}`.toLowerCase();
  const skills = new Set<string>([
    target === "codex"
      ? "repository-navigation"
      : target === "claude"
        ? "codebase-analysis"
        : target === "hermes"
          ? "hermes-agent"
          : target === "python"
            ? "python-callable"
            : "typescript-handler",
  ]);
  const connectors = new Set<string>();
  const match = (terms: string[]) => terms.some((term) => text.includes(term));

  if (match(["implement", "engineer", "code", "frontend", "backend"])) {
    skills.add("implementation");
    connectors.add("mcp:github");
    if (target === "hermes") {
      connectors.add("hermes:toolset:file");
      connectors.add("hermes:toolset:terminal");
    }
  }
  if (match(["test", "quality", "evaluate", "critic", "review"])) skills.add(node.kind === "evaluate" ? "evaluation" : "test-design");
  if (match(["design", "ux", "accessib"])) {
    skills.add("product-design");
    skills.add("accessibility");
    connectors.add("mcp:figma");
    connectors.add("mcp:browser");
    if (target === "hermes") connectors.add("hermes:toolset:browser");
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
  if (match(["incident", "alert", "soc", "forensic"])) {
    skills.add("incident-response");
    connectors.add("mcp:siem");
    connectors.add("mcp:incident-management");
  }
  if (match(["image", "visual asset", "illustration", "rendering"])) {
    skills.add("image-generation");
    skills.add("multimodal-model-selection");
    connectors.add("api:openrouter/google/gemini-2.5-flash-image");
    if (target === "hermes") connectors.add("provider:openrouter");
  }
  if (match(["video", "storyboard"])) {
    skills.add("video-generation");
    skills.add("async-media-jobs");
    connectors.add("api:openrouter/google/veo-3.1-fast");
  }
  const isTranscription = match(["transcri"]);
  const isMusic = match(["music"]);
  if (match(["speech", "voice"]) || (match(["audio"]) && !isTranscription && !isMusic)) {
    skills.add("multimodal-model-selection");
    connectors.add("api:openrouter/openai/gpt-audio-mini");
  }
  if (isTranscription) {
    skills.add("multimodal-model-selection");
    skills.add("audio-transcription");
    connectors.add("api:openrouter/openai/whisper-large-v3");
  }
  if (isMusic) {
    skills.add("multimodal-model-selection");
    skills.add("music-generation");
    connectors.add("api:openrouter/google/lyria-3-pro-preview");
  }
  if (match(["building", "architect", "bim", "construction", "interior", "structural", "mep"])) {
    skills.add("building-design");
    connectors.add("mcp:bim");
  }
  if (match(["research", "evidence", "literature"])) {
    skills.add("research");
    connectors.add("mcp:browser");
    connectors.add("mcp:notion");
    if (target === "hermes") connectors.add("hermes:toolset:web");
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
