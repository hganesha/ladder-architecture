import { stringify } from "yaml";
import type { TemplateDefinition, Workflow } from "../types";

const common = {
  apiVersion: "ladder.dev/v1alpha1" as const,
  kind: "Workflow" as const,
};

function toYaml(workflow: Workflow) {
  return stringify(workflow, { indent: 2, lineWidth: 100 });
}

const refinement: Workflow = {
  ...common,
  metadata: {
    name: "draft-critique-revise",
    title: "Draft, critique, revise",
    description: "Create a draft, score it independently, and revise inside a hard iteration bound.",
    version: "1.0.0",
  },
  spec: {
    objective: "Produce a high-quality deliverable that passes an explicit evaluation contract.",
    policies: { maxConcurrency: 2, onFailure: "stop", requireApprovalFor: [] },
    nodes: [
      { id: "request", kind: "input", name: "User brief", summary: "The requested outcome and constraints.", position: { x: 110, y: 90 } },
      {
        id: "draft",
        kind: "agent",
        name: "Create draft",
        summary: "Produce the smallest complete first version.",
        role: "Senior implementer",
        prompt: "Create a complete draft from the brief. State assumptions explicitly and satisfy every acceptance criterion.",
        capabilities: { skills: ["implementation"], tools: ["read", "edit"], permissions: ["workspace-write"] },
        outputSchema: {
          type: "object",
          required: ["deliverable", "assumptions"],
          properties: { deliverable: { type: "string" }, assumptions: { type: "array", items: { type: "string" } } },
        },
        position: { x: 360, y: 90 },
      },
      {
        id: "critique",
        kind: "evaluate",
        name: "Independent critique",
        summary: "Score the draft against the contract.",
        role: "Adversarial evaluator",
        prompt:
          "Evaluate the draft against the brief. Return a score from 0 to 1, pass/fail, defects with evidence, and the minimum revision needed.",
        capabilities: { skills: ["evaluation"], tools: ["read"], permissions: ["read-only"] },
        outputSchema: {
          type: "object",
          required: ["score", "passed", "reasons"],
          properties: { score: { type: "number" }, passed: { type: "boolean" }, reasons: { type: "array", items: { type: "string" } } },
        },
        config: { threshold: 0.85 },
        position: { x: 620, y: 90 },
      },
      {
        id: "revise",
        kind: "agent",
        name: "Targeted revision",
        summary: "Fix only the evidenced defects.",
        role: "Revision specialist",
        prompt:
          "Revise the draft using the evaluator's defects. Preserve correct work, fix each evidenced issue, and return the revised deliverable.",
        capabilities: { skills: ["implementation"], tools: ["read", "edit"], permissions: ["workspace-write"] },
        outputSchema: {
          type: "object",
          required: ["deliverable", "resolved"],
          properties: { deliverable: { type: "string" }, resolved: { type: "array", items: { type: "string" } } },
        },
        position: { x: 620, y: 300 },
      },
      {
        id: "quality-loop",
        kind: "loop",
        name: "Quality loop",
        summary: "Repeat critique and revision until the threshold passes.",
        config: { body: ["critique", "revise"], exitCondition: "critique.passed == true", maxIterations: 3, onExhausted: "stop" },
        position: { x: 870, y: 190 },
      },
      {
        id: "result",
        kind: "output",
        name: "Approved deliverable",
        summary: "Return the passing deliverable and validation summary.",
        position: { x: 1120, y: 190 },
      },
    ],
    edges: [
      { id: "e-request-draft", from: "request", to: "draft", kind: "data", contract: "Brief" },
      { id: "e-draft-critique", from: "draft", to: "critique", kind: "data", contract: "Draft" },
      { id: "e-critique-revise", from: "critique", to: "revise", kind: "control", condition: "passed == false" },
      { id: "e-revise-loop", from: "revise", to: "quality-loop", kind: "dependency" },
      { id: "e-loop-result", from: "quality-loop", to: "result", kind: "control", condition: "passed == true" },
    ],
  },
};

const implementationReview: Workflow = {
  ...common,
  metadata: {
    name: "implementation-risk-review",
    title: "Implementation and risk review",
    description: "Fan out implementation and risk analysis, then join them into a decision-ready result.",
    version: "1.0.0",
  },
  spec: {
    objective: "Produce an implementation plan reviewed for delivery and security risk.",
    policies: { maxConcurrency: 3, onFailure: "preserve-completed", requireApprovalFor: [] },
    nodes: [
      {
        id: "brief",
        kind: "input",
        name: "Feature brief",
        summary: "Scope, constraints, and desired outcome.",
        position: { x: 100, y: 210 },
      },
      {
        id: "implementer",
        kind: "agent",
        name: "Implementation lead",
        summary: "Design the change and acceptance criteria.",
        role: "Senior software engineer",
        prompt:
          "Propose the smallest implementation that satisfies the brief. Include interfaces, file boundaries, edge cases, and verification.",
        capabilities: { skills: ["architecture", "implementation"], tools: ["read"], permissions: ["read-only"] },
        outputSchema: {
          type: "object",
          required: ["approach", "acceptanceCriteria"],
          properties: { approach: { type: "string" }, acceptanceCriteria: { type: "array", items: { type: "string" } } },
        },
        position: { x: 390, y: 90 },
      },
      {
        id: "risk-reviewer",
        kind: "agent",
        name: "Risk reviewer",
        summary: "Find trust, failure, and rollout risks.",
        role: "Security and reliability reviewer",
        prompt:
          "Review the feature brief independently. Identify abuse paths, data risks, operational failures, and mitigations ranked by severity.",
        capabilities: { skills: ["threat-modeling"], tools: ["read"], permissions: ["read-only"] },
        outputSchema: { type: "object", required: ["risks"], properties: { risks: { type: "array", items: { type: "object" } } } },
        position: { x: 390, y: 330 },
      },
      {
        id: "join",
        kind: "join",
        name: "Review barrier",
        summary: "Wait for both independent branches.",
        config: { join: "all" },
        position: { x: 680, y: 210 },
      },
      {
        id: "decision",
        kind: "agent",
        name: "Decision synthesis",
        summary: "Reconcile implementation and risks.",
        role: "Technical product lead",
        prompt:
          "Combine the implementation and risk review. Resolve conflicts explicitly and return a sequenced plan with mitigations and release gates.",
        capabilities: { skills: ["product-management"], tools: ["read"], permissions: ["read-only"] },
        outputSchema: {
          type: "object",
          required: ["plan", "gates"],
          properties: { plan: { type: "array", items: { type: "string" } }, gates: { type: "array", items: { type: "string" } } },
        },
        position: { x: 930, y: 210 },
      },
      {
        id: "output",
        kind: "output",
        name: "Reviewed plan",
        summary: "A decision-ready implementation plan.",
        position: { x: 1180, y: 210 },
      },
    ],
    edges: [
      { id: "e1", from: "brief", to: "implementer", kind: "data", contract: "FeatureBrief" },
      { id: "e2", from: "brief", to: "risk-reviewer", kind: "data", contract: "FeatureBrief" },
      { id: "e3", from: "implementer", to: "join", kind: "data", contract: "ImplementationPlan" },
      { id: "e4", from: "risk-reviewer", to: "join", kind: "data", contract: "RiskRegister" },
      { id: "e5", from: "join", to: "decision", kind: "dependency" },
      { id: "e6", from: "decision", to: "output", kind: "data", contract: "ReviewedPlan" },
    ],
  },
};

const evidenceResearch: Workflow = {
  ...common,
  metadata: {
    name: "evidence-research",
    title: "Evidence research",
    description: "Parallel evidence collection, synthesis, and an explicit source-quality evaluation.",
    version: "1.0.0",
  },
  spec: {
    objective: "Produce a concise answer grounded in primary and contradictory evidence.",
    policies: { maxConcurrency: 4, onFailure: "preserve-completed", requireApprovalFor: [] },
    nodes: [
      {
        id: "question",
        kind: "input",
        name: "Research question",
        summary: "Question, date boundary, and evidence standard.",
        position: { x: 100, y: 220 },
      },
      {
        id: "primary",
        kind: "agent",
        name: "Primary sources",
        summary: "Find direct authoritative evidence.",
        role: "Primary-source researcher",
        prompt:
          "Find the strongest primary sources. Return claim-level evidence, dates, and direct source identifiers. Separate facts from inference.",
        capabilities: { skills: ["research"], tools: ["search", "read"], permissions: ["network-read"] },
        outputSchema: { type: "object", required: ["claims"], properties: { claims: { type: "array", items: { type: "object" } } } },
        position: { x: 390, y: 70 },
      },
      {
        id: "counter",
        kind: "agent",
        name: "Contradictory evidence",
        summary: "Search for the strongest disconfirming case.",
        role: "Skeptical researcher",
        prompt: "Find credible contradictory evidence and missing context. Return the claim challenged, evidence, date, and source.",
        capabilities: { skills: ["research"], tools: ["search", "read"], permissions: ["network-read"] },
        outputSchema: {
          type: "object",
          required: ["challenges"],
          properties: { challenges: { type: "array", items: { type: "object" } } },
        },
        position: { x: 390, y: 240 },
      },
      {
        id: "recency",
        kind: "agent",
        name: "Recency check",
        summary: "Verify time-sensitive facts.",
        role: "Recency and provenance analyst",
        prompt: "Check which claims may have changed. Return current authoritative evidence or mark the claim unresolved.",
        capabilities: { skills: ["research"], tools: ["search", "read"], permissions: ["network-read"] },
        outputSchema: { type: "object", required: ["updates"], properties: { updates: { type: "array", items: { type: "object" } } } },
        position: { x: 390, y: 410 },
      },
      {
        id: "evidence-join",
        kind: "join",
        name: "Evidence barrier",
        summary: "Wait for all evidence branches.",
        config: { join: "allSettled" },
        position: { x: 670, y: 240 },
      },
      {
        id: "synthesis",
        kind: "agent",
        name: "Cited synthesis",
        summary: "Write from supported claims only.",
        role: "Evidence synthesis editor",
        prompt:
          "Synthesize only supported claims. Put a source identifier after each factual statement and describe material disagreement.",
        capabilities: { skills: ["synthesis"], tools: ["read"], permissions: ["read-only"] },
        outputSchema: {
          type: "object",
          required: ["answer", "sources"],
          properties: { answer: { type: "string" }, sources: { type: "array", items: { type: "string" } } },
        },
        position: { x: 900, y: 180 },
      },
      {
        id: "evaluation",
        kind: "evaluate",
        name: "Source-quality gate",
        summary: "Reject unsupported synthesis.",
        role: "Citation and evidence evaluator",
        prompt:
          "Check every factual statement against the supplied evidence. Pass only when each material claim is supported and current enough for the question.",
        capabilities: { skills: ["evaluation"], tools: ["read"], permissions: ["read-only"] },
        outputSchema: {
          type: "object",
          required: ["score", "passed", "reasons"],
          properties: { score: { type: "number" }, passed: { type: "boolean" }, reasons: { type: "array", items: { type: "string" } } },
        },
        config: { threshold: 0.9 },
        position: { x: 900, y: 350 },
      },
      {
        id: "report",
        kind: "output",
        name: "Verified answer",
        summary: "Answer, evidence limits, and sources.",
        position: { x: 1180, y: 240 },
      },
    ],
    edges: [
      { id: "e1", from: "question", to: "primary", kind: "data", contract: "ResearchQuestion" },
      { id: "e2", from: "question", to: "counter", kind: "data", contract: "ResearchQuestion" },
      { id: "e3", from: "question", to: "recency", kind: "data", contract: "ResearchQuestion" },
      { id: "e4", from: "primary", to: "evidence-join", kind: "data", contract: "PrimaryEvidence" },
      { id: "e5", from: "counter", to: "evidence-join", kind: "data", contract: "CounterEvidence" },
      { id: "e6", from: "recency", to: "evidence-join", kind: "data", contract: "RecencyEvidence" },
      { id: "e7", from: "evidence-join", to: "synthesis", kind: "dependency" },
      { id: "e8", from: "synthesis", to: "evaluation", kind: "data", contract: "CitedDraft" },
      { id: "e9", from: "evaluation", to: "report", kind: "control", condition: "passed == true" },
    ],
  },
};

const fullStackDelivery: Workflow = {
  ...common,
  metadata: {
    name: "full-stack-app-delivery",
    title: "Full-stack app delivery",
    description: "Design, architect, evaluate, build, verify, approve, and deploy a production full-stack application.",
    version: "1.0.0",
  },
  spec: {
    objective:
      "Deliver a production-ready full-stack application through explicit design, architecture, quality, security, and release gates.",
    policies: {
      maxConcurrency: 4,
      onFailure: "preserve-completed",
      requireApprovalFor: ["implementation", "deployment"],
    },
    nodes: [
      {
        id: "brief",
        kind: "input",
        name: "App brief",
        summary: "User outcome, scope, constraints, platform, data, and release expectations.",
        position: { x: 100, y: 280 },
      },
      {
        id: "product-design",
        kind: "agent",
        name: "Product and UX design",
        summary: "Define the journey, screens, states, accessibility, and acceptance criteria.",
        role: "Senior product designer",
        prompt:
          "Turn the app brief into a coherent experience. Define target users, primary journeys, information architecture, screen and component states, responsive behavior, accessibility requirements, and observable acceptance criteria. Preserve explicit non-goals and unresolved questions.",
        capabilities: { skills: ["product-design", "accessibility"], tools: ["read"], permissions: ["read-only"] },
        outputSchema: {
          type: "object",
          required: ["journeys", "screens", "states", "acceptanceCriteria"],
          properties: {
            journeys: { type: "array", items: { type: "string" } },
            screens: { type: "array", items: { type: "string" } },
            states: { type: "array", items: { type: "string" } },
            acceptanceCriteria: { type: "array", items: { type: "string" } },
          },
        },
        position: { x: 370, y: 100 },
      },
      {
        id: "architecture",
        kind: "agent",
        name: "System architecture",
        summary: "Define boundaries, interfaces, data, infrastructure, and operational constraints.",
        role: "Principal full-stack architect",
        prompt:
          "Design the smallest architecture that satisfies the app brief. Define frontend and backend boundaries, APIs, data model, authentication and authorization, integrations, deployment topology, failure modes, observability, migrations, and key technical decisions with tradeoffs.",
        capabilities: {
          skills: ["software-architecture", "data-modeling"],
          tools: ["read"],
          permissions: ["read-only"],
        },
        outputSchema: {
          type: "object",
          required: ["components", "interfaces", "dataModel", "decisions", "risks"],
          properties: {
            components: { type: "array", items: { type: "string" } },
            interfaces: { type: "array", items: { type: "string" } },
            dataModel: { type: "string" },
            decisions: { type: "array", items: { type: "string" } },
            risks: { type: "array", items: { type: "string" } },
          },
        },
        position: { x: 370, y: 330 },
      },
      {
        id: "plan-join",
        kind: "join",
        name: "Design and architecture barrier",
        summary: "Wait for the product contract and technical design.",
        config: { join: "all" },
        position: { x: 660, y: 220 },
      },
      {
        id: "evaluation-definition",
        kind: "agent",
        name: "Evaluation definition",
        summary: "Define measurable gates before implementation begins.",
        role: "Independent quality architect",
        prompt:
          "Define the evaluation contract before code is written. Map product acceptance criteria and architecture constraints to functional, integration, accessibility, security, reliability, performance, deployment, and rollback checks. Give every gate a method, evidence requirement, pass threshold, and owner.",
        capabilities: { skills: ["evaluation-design", "test-strategy"], tools: ["read"], permissions: ["read-only"] },
        outputSchema: {
          type: "object",
          required: ["gates", "thresholds", "evidence", "owners"],
          properties: {
            gates: { type: "array", items: { type: "string" } },
            thresholds: { type: "array", items: { type: "string" } },
            evidence: { type: "array", items: { type: "string" } },
            owners: { type: "array", items: { type: "string" } },
          },
        },
        position: { x: 900, y: 110 },
      },
      {
        id: "plan-gate",
        kind: "evaluate",
        name: "Design and architecture gate",
        summary: "Reject ambiguous, conflicting, unsafe, or untestable plans.",
        role: "Cross-functional plan reviewer",
        prompt:
          "Evaluate the product design, architecture, and evaluation contract together. Pass only when journeys and states are complete, interfaces and data ownership are explicit, security and operational risks are addressed, and every material requirement has a measurable gate.",
        capabilities: { skills: ["architecture-review", "evaluation"], tools: ["read"], permissions: ["read-only"] },
        outputSchema: {
          type: "object",
          required: ["score", "passed", "reasons"],
          properties: {
            score: { type: "number" },
            passed: { type: "boolean" },
            reasons: { type: "array", items: { type: "string" } },
          },
        },
        config: { threshold: 0.9 },
        position: { x: 900, y: 330 },
      },
      {
        id: "build-approval",
        kind: "approval",
        name: "Approve implementation",
        summary: "Confirm scope, tradeoffs, budget, and delivery plan before code changes.",
        position: { x: 900, y: 540 },
      },
      {
        id: "frontend-build",
        kind: "agent",
        name: "Frontend implementation",
        summary: "Build the responsive, accessible client and its integration states.",
        role: "Senior frontend engineer",
        prompt:
          "Implement the approved frontend within the defined architecture. Build the complete primary journey, responsive and accessible states, typed API integration, loading and error behavior, and focused component tests. Preserve existing design-system and repository conventions.",
        capabilities: {
          skills: ["frontend-development", "accessibility"],
          tools: ["read", "edit", "test"],
          permissions: ["workspace-write"],
        },
        outputSchema: {
          type: "object",
          required: ["changes", "tests", "evidence", "risks"],
          properties: {
            changes: { type: "array", items: { type: "string" } },
            tests: { type: "array", items: { type: "string" } },
            evidence: { type: "array", items: { type: "string" } },
            risks: { type: "array", items: { type: "string" } },
          },
        },
        position: { x: 1190, y: 130 },
      },
      {
        id: "backend-build",
        kind: "agent",
        name: "Backend implementation",
        summary: "Build APIs, data, authorization, migrations, and operational behavior.",
        role: "Senior backend engineer",
        prompt:
          "Implement the approved backend within the defined contracts. Build APIs, persistence, validation, authentication and authorization, migrations, failure handling, observability, and focused unit and integration tests. Do not widen scope without recording the decision.",
        capabilities: {
          skills: ["backend-development", "database-engineering"],
          tools: ["read", "edit", "test"],
          permissions: ["workspace-write"],
        },
        outputSchema: {
          type: "object",
          required: ["changes", "tests", "evidence", "risks"],
          properties: {
            changes: { type: "array", items: { type: "string" } },
            tests: { type: "array", items: { type: "string" } },
            evidence: { type: "array", items: { type: "string" } },
            risks: { type: "array", items: { type: "string" } },
          },
        },
        position: { x: 1190, y: 430 },
      },
      {
        id: "build-join",
        kind: "join",
        name: "Integrated build barrier",
        summary: "Wait for frontend and backend implementation evidence.",
        config: { join: "all" },
        position: { x: 1480, y: 280 },
      },
      {
        id: "quality-gate",
        kind: "evaluate",
        name: "Functional quality gate",
        summary: "Evaluate the integrated app against the predefined product and engineering gates.",
        role: "Independent full-stack test lead",
        prompt:
          "Run the predefined functional, integration, accessibility, reliability, performance, and regression evaluations against the integrated application. Pass only with reproducible evidence for every required threshold; distinguish failures, skipped checks, and residual risk.",
        capabilities: { skills: ["full-stack-testing", "evaluation"], tools: ["read", "test"], permissions: ["read-only"] },
        outputSchema: {
          type: "object",
          required: ["score", "passed", "reasons", "evidence"],
          properties: {
            score: { type: "number" },
            passed: { type: "boolean" },
            reasons: { type: "array", items: { type: "string" } },
            evidence: { type: "array", items: { type: "string" } },
          },
        },
        config: { threshold: 0.9 },
        position: { x: 1730, y: 130 },
      },
      {
        id: "security-gate",
        kind: "evaluate",
        name: "Security and privacy gate",
        summary: "Review trust boundaries, data handling, authorization, dependencies, and deployment exposure.",
        role: "Independent application security reviewer",
        prompt:
          "Evaluate the integrated application against the predefined security and privacy gates. Review authentication, authorization, input handling, secrets, sensitive data, dependencies, abuse paths, logging, and deployment configuration. Block release for unresolved high-severity findings.",
        capabilities: { skills: ["application-security", "privacy-review"], tools: ["read", "test"], permissions: ["read-only"] },
        outputSchema: {
          type: "object",
          required: ["score", "passed", "reasons", "findings"],
          properties: {
            score: { type: "number" },
            passed: { type: "boolean" },
            reasons: { type: "array", items: { type: "string" } },
            findings: { type: "array", items: { type: "string" } },
          },
        },
        config: { threshold: 0.9 },
        position: { x: 1730, y: 430 },
      },
      {
        id: "release-gate",
        kind: "evaluate",
        name: "Release readiness gate",
        summary: "Reconcile all evidence, known risk, rollout, observability, and rollback readiness.",
        role: "Release readiness evaluator",
        prompt:
          "Review quality and security evidence together with migration, observability, rollout, and rollback plans. Pass only when every mandatory gate passed, known risks are accepted by an owner, and deployment and recovery steps are executable and reversible.",
        capabilities: { skills: ["release-engineering", "evaluation"], tools: ["read"], permissions: ["read-only"] },
        outputSchema: {
          type: "object",
          required: ["score", "passed", "reasons", "releaseChecklist"],
          properties: {
            score: { type: "number" },
            passed: { type: "boolean" },
            reasons: { type: "array", items: { type: "string" } },
            releaseChecklist: { type: "array", items: { type: "string" } },
          },
        },
        config: { threshold: 1 },
        position: { x: 1990, y: 280 },
      },
      {
        id: "deploy-approval",
        kind: "approval",
        name: "Approve production deployment",
        summary: "Require explicit human approval after every release gate passes.",
        position: { x: 2240, y: 280 },
      },
      {
        id: "deploy",
        kind: "agent",
        name: "Deploy and verify",
        summary: "Deploy through the approved release path and verify production health.",
        role: "Senior release engineer",
        prompt:
          "Deploy using the repository-approved release path only after explicit approval. Apply migrations safely, verify configuration and secrets without exposing them, run smoke checks, inspect health and observability signals, record the release identifier, and roll back immediately if a stop condition is met.",
        capabilities: {
          skills: ["deployment", "observability"],
          tools: ["read", "deploy", "monitor"],
          permissions: ["external-write"],
        },
        outputSchema: {
          type: "object",
          required: ["releaseId", "environment", "checks", "status", "rollbackStatus"],
          properties: {
            releaseId: { type: "string" },
            environment: { type: "string" },
            checks: { type: "array", items: { type: "string" } },
            status: { type: "string" },
            rollbackStatus: { type: "string" },
          },
        },
        position: { x: 2490, y: 280 },
      },
      {
        id: "release-output",
        kind: "output",
        name: "Released application",
        summary: "Return the deployed release, evidence, known risks, and operational handoff.",
        position: { x: 2750, y: 280 },
      },
    ],
    edges: [
      { id: "e1", from: "brief", to: "product-design", kind: "data", contract: "AppBrief" },
      { id: "e2", from: "brief", to: "architecture", kind: "data", contract: "AppBrief" },
      { id: "e3", from: "product-design", to: "plan-join", kind: "data", contract: "ProductDesign" },
      { id: "e4", from: "architecture", to: "plan-join", kind: "data", contract: "SystemArchitecture" },
      { id: "e5", from: "plan-join", to: "evaluation-definition", kind: "dependency" },
      { id: "e6", from: "plan-join", to: "plan-gate", kind: "dependency" },
      { id: "e7", from: "evaluation-definition", to: "plan-gate", kind: "data", contract: "EvaluationContract" },
      { id: "e8", from: "plan-gate", to: "build-approval", kind: "control", condition: "passed == true" },
      { id: "e9", from: "build-approval", to: "frontend-build", kind: "control", condition: "approved == true" },
      { id: "e10", from: "build-approval", to: "backend-build", kind: "control", condition: "approved == true" },
      { id: "e11", from: "frontend-build", to: "build-join", kind: "data", contract: "FrontendBuild" },
      { id: "e12", from: "backend-build", to: "build-join", kind: "data", contract: "BackendBuild" },
      { id: "e13", from: "build-join", to: "quality-gate", kind: "dependency" },
      { id: "e14", from: "build-join", to: "security-gate", kind: "dependency" },
      { id: "e15", from: "quality-gate", to: "release-gate", kind: "data", contract: "QualityEvidence" },
      { id: "e16", from: "security-gate", to: "release-gate", kind: "data", contract: "SecurityEvidence" },
      { id: "e17", from: "release-gate", to: "deploy-approval", kind: "control", condition: "passed == true" },
      { id: "e18", from: "deploy-approval", to: "deploy", kind: "control", condition: "approved == true" },
      { id: "e19", from: "deploy", to: "release-output", kind: "data", contract: "DeploymentEvidence" },
    ],
  },
};

interface ParallelReviewConfig {
  name: string;
  title: string;
  description: string;
  objective: string;
  inputName: string;
  inputSummary: string;
  first: {
    name: string;
    summary: string;
    role: string;
    prompt: string;
    skill: string;
  };
  second: {
    name: string;
    summary: string;
    role: string;
    prompt: string;
    skill: string;
  };
  synthesis: {
    name: string;
    summary: string;
    role: string;
    prompt: string;
    skill: string;
  };
  evaluation: {
    name: string;
    role: string;
    prompt: string;
  };
  outputName: string;
  outputSummary: string;
}

function parallelReview(config: ParallelReviewConfig): Workflow {
  return {
    ...common,
    metadata: {
      name: config.name,
      title: config.title,
      description: config.description,
      version: "1.0.0",
    },
    spec: {
      objective: config.objective,
      policies: { maxConcurrency: 3, onFailure: "preserve-completed", requireApprovalFor: [] },
      nodes: [
        {
          id: "brief",
          kind: "input",
          name: config.inputName,
          summary: config.inputSummary,
          position: { x: 100, y: 220 },
        },
        {
          id: "perspective-a",
          kind: "agent",
          name: config.first.name,
          summary: config.first.summary,
          role: config.first.role,
          prompt: config.first.prompt,
          capabilities: { skills: [config.first.skill], tools: ["read", "search"], permissions: ["read-only"] },
          outputSchema: {
            type: "object",
            required: ["findings", "evidence"],
            properties: {
              findings: { type: "array", items: { type: "string" } },
              evidence: { type: "array", items: { type: "string" } },
            },
          },
          position: { x: 380, y: 90 },
        },
        {
          id: "perspective-b",
          kind: "agent",
          name: config.second.name,
          summary: config.second.summary,
          role: config.second.role,
          prompt: config.second.prompt,
          capabilities: { skills: [config.second.skill], tools: ["read", "search"], permissions: ["read-only"] },
          outputSchema: {
            type: "object",
            required: ["findings", "risks"],
            properties: {
              findings: { type: "array", items: { type: "string" } },
              risks: { type: "array", items: { type: "string" } },
            },
          },
          position: { x: 380, y: 350 },
        },
        {
          id: "join",
          kind: "join",
          name: "Perspective barrier",
          summary: "Wait for both independent perspectives.",
          config: { join: "all" },
          position: { x: 660, y: 220 },
        },
        {
          id: "synthesis",
          kind: "agent",
          name: config.synthesis.name,
          summary: config.synthesis.summary,
          role: config.synthesis.role,
          prompt: config.synthesis.prompt,
          capabilities: { skills: [config.synthesis.skill], tools: ["read"], permissions: ["read-only"] },
          outputSchema: {
            type: "object",
            required: ["recommendation", "actions", "openQuestions"],
            properties: {
              recommendation: { type: "string" },
              actions: { type: "array", items: { type: "string" } },
              openQuestions: { type: "array", items: { type: "string" } },
            },
          },
          position: { x: 900, y: 150 },
        },
        {
          id: "evaluation",
          kind: "evaluate",
          name: config.evaluation.name,
          summary: "Check the recommendation against its evidence and contract.",
          role: config.evaluation.role,
          prompt: config.evaluation.prompt,
          capabilities: { skills: ["evaluation"], tools: ["read"], permissions: ["read-only"] },
          outputSchema: {
            type: "object",
            required: ["score", "passed", "reasons"],
            properties: {
              score: { type: "number" },
              passed: { type: "boolean" },
              reasons: { type: "array", items: { type: "string" } },
            },
          },
          config: { threshold: 0.85 },
          position: { x: 900, y: 330 },
        },
        {
          id: "output",
          kind: "output",
          name: config.outputName,
          summary: config.outputSummary,
          position: { x: 1180, y: 220 },
        },
      ],
      edges: [
        { id: "e1", from: "brief", to: "perspective-a", kind: "data", contract: "Brief" },
        { id: "e2", from: "brief", to: "perspective-b", kind: "data", contract: "Brief" },
        { id: "e3", from: "perspective-a", to: "join", kind: "data", contract: "EvidenceSet" },
        { id: "e4", from: "perspective-b", to: "join", kind: "data", contract: "RiskSet" },
        { id: "e5", from: "join", to: "synthesis", kind: "dependency" },
        { id: "e6", from: "synthesis", to: "evaluation", kind: "data", contract: "Recommendation" },
        { id: "e7", from: "evaluation", to: "output", kind: "control", condition: "passed == true" },
      ],
    },
  };
}

const literatureReview = parallelReview({
  name: "literature-review-gap-analysis",
  title: "Literature review + gap analysis",
  description: "Map the strongest prior work and the most credible open questions before proposing a research direction.",
  objective: "Produce an evidence-backed literature map with defensible research gaps.",
  inputName: "Research scope",
  inputSummary: "Question, field boundaries, date range, and evidence standard.",
  first: {
    name: "Prior-work mapper",
    summary: "Organize foundational and current primary work.",
    role: "Systematic literature researcher",
    prompt: "Find primary studies and authoritative reviews. Group them by approach, result, date, and strength of evidence.",
    skill: "literature-review",
  },
  second: {
    name: "Gap challenger",
    summary: "Test whether claimed gaps are actually unresolved.",
    role: "Skeptical research methodologist",
    prompt: "Search for counterexamples, replications, negative results, and adjacent work that may close or weaken each proposed gap.",
    skill: "research-methods",
  },
  synthesis: {
    name: "Research map",
    summary: "Reconcile the evidence into themes and open questions.",
    role: "Research synthesis lead",
    prompt: "Create a structured literature map. Rank open questions by novelty, tractability, and evidentiary support.",
    skill: "synthesis",
  },
  evaluation: {
    name: "Gap validity gate",
    role: "Evidence quality evaluator",
    prompt: "Pass only when every claimed gap is supported by the reviewed evidence and material contradictory work is addressed.",
  },
  outputName: "Research agenda",
  outputSummary: "Literature map, defensible gaps, and recommended next studies.",
});

const bugResolution = parallelReview({
  name: "bug-resolution-regression-gate",
  title: "Bug diagnosis + regression gate",
  description: "Investigate the failure and its blast radius independently, then gate a minimal repair plan.",
  objective: "Produce a reproducible diagnosis and a regression-safe fix plan.",
  inputName: "Failure report",
  inputSummary: "Observed behavior, expected behavior, environment, and available evidence.",
  first: {
    name: "Root-cause investigator",
    summary: "Trace the smallest causal chain that explains the failure.",
    role: "Senior debugging engineer",
    prompt: "Reproduce the failure, isolate the responsible boundary, and distinguish root cause from downstream symptoms.",
    skill: "debugging",
  },
  second: {
    name: "Regression analyst",
    summary: "Map affected behavior and high-risk neighboring paths.",
    role: "Independent test engineer",
    prompt: "Derive regression cases from the contract and identify adjacent behavior that a plausible fix could break.",
    skill: "test-design",
  },
  synthesis: {
    name: "Repair planner",
    summary: "Turn diagnosis and regression risks into a minimal fix.",
    role: "Software maintenance lead",
    prompt: "Propose the smallest repair that addresses the root cause. Include regression coverage, rollout checks, and residual risk.",
    skill: "implementation",
  },
  evaluation: {
    name: "Fix readiness gate",
    role: "Release quality evaluator",
    prompt:
      "Pass only when the diagnosis is reproducible, the fix targets the root cause, and regression coverage protects the affected contract.",
  },
  outputName: "Verified repair plan",
  outputSummary: "Root cause, scoped fix, regression cases, and release checks.",
});

const opportunityFraming = parallelReview({
  name: "opportunity-framing",
  title: "Opportunity framing + decision",
  description: "Balance user evidence with business constraints before recommending what to pursue.",
  objective: "Turn a broad opportunity into a clear product decision with measurable outcomes.",
  inputName: "Opportunity brief",
  inputSummary: "Problem signal, target users, strategic context, and constraints.",
  first: {
    name: "User evidence",
    summary: "Clarify the job, pain, alternatives, and urgency.",
    role: "Product discovery researcher",
    prompt: "Synthesize user evidence into jobs, pains, current alternatives, affected segments, and confidence levels.",
    skill: "product-discovery",
  },
  second: {
    name: "Business constraints",
    summary: "Test strategic fit, feasibility, and opportunity cost.",
    role: "Product strategy analyst",
    prompt: "Assess strategic fit, constraints, dependencies, opportunity cost, and the evidence required before committing.",
    skill: "product-strategy",
  },
  synthesis: {
    name: "Opportunity decision",
    summary: "Define the problem, outcome, guardrails, and next bet.",
    role: "Principal product manager",
    prompt:
      "Reconcile user and business evidence into a crisp problem statement, success metrics, non-goals, and recommended next experiment.",
    skill: "product-management",
  },
  evaluation: {
    name: "Decision quality gate",
    role: "Product review lead",
    prompt: "Pass only when the recommendation traces to evidence, names key uncertainty, and defines a measurable next decision point.",
  },
  outputName: "Product decision",
  outputSummary: "Problem framing, outcome, tradeoffs, metrics, and next experiment.",
});

const featureSpec = parallelReview({
  name: "feature-spec-feasibility",
  title: "Feature spec + feasibility review",
  description: "Draft the user contract and technical constraints in parallel, then reconcile them into a buildable spec.",
  objective: "Produce a feature specification that is valuable, testable, and feasible.",
  inputName: "Feature objective",
  inputSummary: "Desired user outcome, context, constraints, and known risks.",
  first: {
    name: "User contract",
    summary: "Define journey, behavior, edge cases, and acceptance criteria.",
    role: "Senior product manager",
    prompt: "Write the user problem, primary journey, behavior rules, non-goals, edge cases, and measurable acceptance criteria.",
    skill: "product-management",
  },
  second: {
    name: "Feasibility review",
    summary: "Identify system boundaries, dependencies, and delivery risks.",
    role: "Staff software engineer",
    prompt: "Review feasibility independently. Identify interfaces, dependencies, failure modes, migration needs, and safer scope cuts.",
    skill: "software-architecture",
  },
  synthesis: {
    name: "Buildable specification",
    summary: "Resolve conflicts into one implementation-ready contract.",
    role: "Technical product lead",
    prompt:
      "Reconcile user value and feasibility. Return a sequenced specification with acceptance criteria, release gates, and explicit tradeoffs.",
    skill: "product-specification",
  },
  evaluation: {
    name: "Spec readiness gate",
    role: "Cross-functional spec reviewer",
    prompt: "Pass only when the spec is unambiguous, testable, feasible, and explicit about non-goals and unresolved decisions.",
  },
  outputName: "Reviewed feature spec",
  outputSummary: "Buildable scope, behavior contract, acceptance criteria, and release gates.",
});

const uxAudit = parallelReview({
  name: "ux-audit-redesign-brief",
  title: "UX audit + redesign brief",
  description: "Inspect task friction and accessibility in parallel, then turn the evidence into a focused redesign brief.",
  objective: "Produce a prioritized, evidence-backed redesign brief for a defined product journey.",
  inputName: "Product journey",
  inputSummary: "Target users, task, current screens, business goal, and known constraints.",
  first: {
    name: "Journey audit",
    summary: "Find comprehension, hierarchy, and interaction friction.",
    role: "Senior product designer",
    prompt:
      "Audit the journey screen by screen. Tie each finding to user intent, visible evidence, severity, and a concrete design principle.",
    skill: "ux-audit",
  },
  second: {
    name: "Accessibility audit",
    summary: "Find keyboard, contrast, semantics, and assistive-tech risks.",
    role: "Accessibility specialist",
    prompt: "Review the same journey against WCAG and inclusive interaction principles. Prioritize barriers by user impact.",
    skill: "accessibility",
  },
  synthesis: {
    name: "Redesign brief",
    summary: "Translate findings into a coherent design direction.",
    role: "Product design lead",
    prompt: "Synthesize the evidence into design principles, prioritized changes, preserved strengths, success criteria, and a test plan.",
    skill: "product-design",
  },
  evaluation: {
    name: "Brief quality gate",
    role: "Design critique lead",
    prompt:
      "Pass only when every recommendation addresses evidenced friction, preserves working patterns, and has a verifiable success criterion.",
  },
  outputName: "Redesign brief",
  outputSummary: "Prioritized findings, design direction, accessibility requirements, and validation plan.",
});

const designCritique = parallelReview({
  name: "design-critique-validation",
  title: "Design critique + validation plan",
  description: "Challenge a proposed design from user and system perspectives before defining the next iteration.",
  objective: "Produce a precise critique and validation plan for a selected product design.",
  inputName: "Design proposal",
  inputSummary: "Screens, intended outcome, target users, constraints, and open questions.",
  first: {
    name: "User-task critique",
    summary: "Evaluate whether the design supports the intended task.",
    role: "Interaction design critic",
    prompt: "Evaluate hierarchy, comprehension, flow, feedback, error recovery, and consistency against the intended user task.",
    skill: "interaction-design",
  },
  second: {
    name: "System-state critique",
    summary: "Test empty, loading, error, responsive, and accessible states.",
    role: "Design systems reviewer",
    prompt: "Review component reuse, responsive behavior, accessibility, edge states, and implementation risks.",
    skill: "design-systems",
  },
  synthesis: {
    name: "Iteration plan",
    summary: "Prioritize fixes and define how to validate them.",
    role: "Product design lead",
    prompt:
      "Combine both critiques into preserved strengths, prioritized changes, exact acceptance criteria, and a lightweight validation plan.",
    skill: "product-design",
  },
  evaluation: {
    name: "Critique evidence gate",
    role: "Independent design evaluator",
    prompt: "Pass only when findings are tied to observable evidence and the iteration plan is specific enough to verify.",
  },
  outputName: "Validated iteration plan",
  outputSummary: "Evidence-based critique, prioritized changes, and validation criteria.",
});

const positioningLaunch = parallelReview({
  name: "positioning-launch-experiment",
  title: "Positioning + launch experiment",
  description: "Ground the message in customer urgency and alternatives, then design a measurable launch test.",
  objective: "Produce differentiated positioning and a falsifiable launch experiment.",
  inputName: "Market brief",
  inputSummary: "Product, target market, evidence, alternatives, constraints, and launch goal.",
  first: {
    name: "Customer urgency",
    summary: "Identify the beachhead user, trigger, pain, and proof needed.",
    role: "Customer insight researcher",
    prompt:
      "Define the highest-urgency segment, triggering event, current workaround, desired progress, and proof that would change behavior.",
    skill: "customer-research",
  },
  second: {
    name: "Competitive frame",
    summary: "Map alternatives and credible differentiation.",
    role: "Market intelligence strategist",
    prompt: "Map direct and indirect alternatives. Identify defensible differences, table stakes, and claims the evidence cannot support.",
    skill: "competitive-analysis",
  },
  synthesis: {
    name: "Launch strategy",
    summary: "Turn market evidence into message, channel, and test.",
    role: "Go-to-market strategist",
    prompt: "Write positioning, proof points, objections, beachhead channel, experiment design, success threshold, and stop condition.",
    skill: "go-to-market",
  },
  evaluation: {
    name: "Message credibility gate",
    role: "GTM review lead",
    prompt: "Pass only when the positioning is specific, differentiated, evidence-backed, and paired with a measurable experiment.",
  },
  outputName: "Launch experiment",
  outputSummary: "Positioning, proof, channel hypothesis, experiment, and decision threshold.",
});

const threatModel = parallelReview({
  name: "threat-model-mitigation-review",
  title: "Threat model + mitigation review",
  description: "Map abuse paths and sensitive data independently, then gate mitigations by severity and residual risk.",
  objective: "Produce an actionable threat model with verified, prioritized mitigations.",
  inputName: "System change",
  inputSummary: "Architecture, data, actors, trust boundaries, deployment, and proposed behavior.",
  first: {
    name: "Abuse-path analysis",
    summary: "Identify attacker goals, entry points, and trust-boundary crossings.",
    role: "Application security engineer",
    prompt: "Model realistic attackers and misuse cases. Trace abuse paths through assets, entry points, privileges, and trust boundaries.",
    skill: "threat-modeling",
  },
  second: {
    name: "Data and privacy review",
    summary: "Map sensitive data, retention, disclosure, and consent risks.",
    role: "Privacy and data security reviewer",
    prompt: "Review data collection, storage, access, retention, external sharing, user expectations, and regulatory exposure.",
    skill: "privacy-review",
  },
  synthesis: {
    name: "Mitigation plan",
    summary: "Prioritize controls and make residual risk explicit.",
    role: "Security architecture lead",
    prompt:
      "Combine both reviews into ranked threats, preventive and detective controls, owners, verification steps, and accepted residual risk.",
    skill: "security-architecture",
  },
  evaluation: {
    name: "Security readiness gate",
    role: "Independent security reviewer",
    prompt: "Pass only when high-severity threats have testable mitigations and residual risks are explicit and owned.",
  },
  outputName: "Reviewed threat model",
  outputSummary: "Threats, severity, mitigations, verification, ownership, and residual risk.",
});

export const WORKFLOW_TEMPLATES: TemplateDefinition[] = [
  {
    id: "refinement",
    path: "core/refinement",
    area: "Core patterns",
    title: "Draft → critique → revise",
    eyebrow: "Bounded refinement",
    description: "Create a complete draft, challenge it independently, and revise without an open-ended loop.",
    topology: "Chain + structured loop",
    accent: "#e879a9",
    yaml: toYaml(refinement),
  },
  {
    id: "implementation-review",
    path: "core/software",
    area: "Software engineering",
    title: "Implementation + risk review",
    eyebrow: "Parallel decision",
    description: "Let delivery and risk specialists work independently, then join them into one reviewed plan.",
    topology: "Diamond + join",
    accent: "#54d7cf",
    yaml: toYaml(implementationReview),
  },
  {
    id: "full-stack-delivery",
    path: "core/software",
    area: "Software engineering",
    title: "Full-stack app → production",
    eyebrow: "End-to-end delivery",
    description: "Design and architect the app, define evaluation gates, build in parallel, verify, approve, and deploy.",
    topology: "Phased pipeline + gates",
    accent: "#54d7cf",
    yaml: toYaml(fullStackDelivery),
  },
  {
    id: "evidence-research",
    path: "core/research",
    area: "Research",
    title: "Evidence research",
    eyebrow: "Source-grounded",
    description: "Fan out evidence collection, synthesize only supported claims, and gate the result explicitly.",
    topology: "Fan-out + evaluation",
    accent: "#a990f5",
    yaml: toYaml(evidenceResearch),
  },
  {
    id: "literature-review",
    path: "core/research",
    area: "Research",
    title: "Literature review + gap analysis",
    eyebrow: "Research planning",
    description: "Map prior work, challenge claimed gaps, and produce a defensible research agenda.",
    topology: "Parallel review + gate",
    accent: "#a990f5",
    yaml: toYaml(literatureReview),
  },
  {
    id: "bug-resolution",
    path: "core/software",
    area: "Software engineering",
    title: "Bug diagnosis + regression gate",
    eyebrow: "Failure resolution",
    description: "Investigate root cause and blast radius independently before approving a minimal repair plan.",
    topology: "Parallel review + gate",
    accent: "#54d7cf",
    yaml: toYaml(bugResolution),
  },
  {
    id: "opportunity-framing",
    path: "core/product",
    area: "Product management",
    title: "Opportunity framing + decision",
    eyebrow: "Product discovery",
    description: "Balance user evidence with business constraints and define the next measurable bet.",
    topology: "Parallel evidence + gate",
    accent: "#e8bd58",
    yaml: toYaml(opportunityFraming),
  },
  {
    id: "feature-spec",
    path: "core/product",
    area: "Product management",
    title: "Feature spec + feasibility review",
    eyebrow: "Delivery framing",
    description: "Reconcile the user contract and technical constraints into one buildable specification.",
    topology: "Parallel review + synthesis",
    accent: "#e8bd58",
    yaml: toYaml(featureSpec),
  },
  {
    id: "ux-audit",
    path: "core/product-design",
    area: "Product design",
    title: "UX audit + redesign brief",
    eyebrow: "Journey improvement",
    description: "Inspect task friction and accessibility, then produce a focused evidence-backed redesign brief.",
    topology: "Dual audit + gate",
    accent: "#e879a9",
    yaml: toYaml(uxAudit),
  },
  {
    id: "design-critique",
    path: "core/product-design",
    area: "Product design",
    title: "Design critique + validation plan",
    eyebrow: "Design quality",
    description: "Challenge a design from user and system perspectives before defining the next iteration.",
    topology: "Parallel critique + gate",
    accent: "#e879a9",
    yaml: toYaml(designCritique),
  },
  {
    id: "positioning-launch",
    path: "core/market",
    area: "Go-to-market",
    title: "Positioning + launch experiment",
    eyebrow: "Market entry",
    description: "Ground differentiated positioning in customer urgency, alternatives, proof, and a measurable test.",
    topology: "Evidence join + gate",
    accent: "#f0a05a",
    yaml: toYaml(positioningLaunch),
  },
  {
    id: "threat-model",
    path: "core/security",
    area: "Security",
    title: "Threat model + mitigation review",
    eyebrow: "Security review",
    description: "Map abuse and data risks independently, then gate prioritized mitigations and residual risk.",
    topology: "Dual review + gate",
    accent: "#3ecf8e",
    yaml: toYaml(threatModel),
  },
];

export const BLANK_WORKFLOW = toYaml({
  ...common,
  metadata: { name: "untitled-workflow", title: "Untitled workflow", description: "A new Ladder Graph workflow.", version: "1.0.0" },
  spec: {
    objective: "Describe the outcome this workflow must produce.",
    policies: { maxConcurrency: 4, onFailure: "stop", requireApprovalFor: [] },
    nodes: [
      { id: "input-1", kind: "input", name: "User brief", summary: "Workflow objective and constraints.", position: { x: 180, y: 180 } },
      { id: "output-1", kind: "output", name: "Final result", summary: "Return the completed deliverable.", position: { x: 720, y: 180 } },
    ],
    edges: [{ id: "edge-1", from: "input-1", to: "output-1", kind: "dependency" }],
  },
} satisfies Workflow);
