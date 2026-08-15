use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, VecDeque};
use wasm_bindgen::prelude::*;

const API_VERSION: &str = "ladder.dev/v1alpha1";
const COMPILER_VERSION: &str = env!("CARGO_PKG_VERSION");
const DOCS_AS_OF: &str = "2026-08-15";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workflow {
    pub api_version: String,
    pub kind: String,
    pub metadata: Metadata,
    pub spec: WorkflowSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    pub name: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowSpec {
    #[serde(default)]
    pub objective: String,
    #[serde(default)]
    pub inputs: BTreeMap<String, Value>,
    #[serde(default)]
    pub outputs: BTreeMap<String, Value>,
    #[serde(default)]
    pub policies: Policies,
    #[serde(default)]
    pub nodes: Vec<Node>,
    #[serde(default)]
    pub edges: Vec<Edge>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Policies {
    #[serde(default = "default_concurrency")]
    pub max_concurrency: u32,
    #[serde(default = "default_failure")]
    pub on_failure: String,
    #[serde(default)]
    pub require_approval_for: Vec<String>,
}

fn default_concurrency() -> u32 { 4 }
fn default_failure() -> String { "stop".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    pub id: String,
    pub kind: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub prompt: String,
    #[serde(default)]
    pub input_schema: Value,
    #[serde(default)]
    pub output_schema: Value,
    #[serde(default)]
    pub capabilities: Capabilities,
    #[serde(default)]
    pub config: NodeConfig,
    #[serde(default)]
    pub position: Position,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub tools: Vec<String>,
    #[serde(default)]
    pub connectors: Vec<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeConfig {
    #[serde(default)]
    pub operation: String,
    #[serde(default)]
    pub expression: String,
    #[serde(default)]
    pub branches: Vec<Branch>,
    #[serde(default)]
    pub join: String,
    #[serde(default)]
    pub body: Vec<String>,
    #[serde(default)]
    pub exit_condition: String,
    #[serde(default)]
    pub max_iterations: u32,
    #[serde(default)]
    pub on_exhausted: String,
    #[serde(default)]
    pub threshold: Option<f64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub when: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Edge {
    pub id: String,
    pub from: String,
    pub to: String,
    #[serde(default = "default_edge_kind")]
    pub kind: String,
    #[serde(default)]
    pub contract: String,
    #[serde(default)]
    pub condition: String,
}

fn default_edge_kind() -> String { "dependency".into() }

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub code: String,
    pub severity: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edge_id: Option<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capability: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fix: Option<Fix>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fix {
    pub label: String,
    pub path: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    pub ok: bool,
    pub source_hash: String,
    pub diagnostics: Vec<Diagnostic>,
    pub normalized: Option<Workflow>,
    pub node_order: Vec<String>,
    pub stats: Stats,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub nodes: usize,
    pub edges: usize,
    pub agents: usize,
    pub loops: usize,
    pub max_parallelism: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityReport {
    pub target: String,
    pub native: Vec<String>,
    pub instructional: Vec<String>,
    pub unsupported: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompileResult {
    pub ok: bool,
    pub content: String,
    pub suggested_filename: String,
    pub mime_type: String,
    pub source_hash: String,
    pub compiler_version: String,
    pub adapter_version: String,
    pub capability_report: CapabilityReport,
    pub diagnostics: Vec<Diagnostic>,
}

fn diag(code: &str, severity: &str, path: impl Into<String>, message: impl Into<String>) -> Diagnostic {
    Diagnostic {
        code: code.into(), severity: severity.into(), path: path.into(), node_id: None,
        edge_id: None, message: message.into(), capability: None, fix: None,
    }
}

fn node_diag(code: &str, severity: &str, index: usize, node: &Node, message: impl Into<String>) -> Diagnostic {
    let mut d = diag(code, severity, format!("/spec/nodes/{index}"), message);
    d.node_id = Some(node.id.clone());
    d
}

fn hash_workflow(workflow: &Workflow) -> String {
    let canonical = serde_json::to_vec(workflow).unwrap_or_default();
    hex::encode(Sha256::digest(canonical))
}

fn parse(source: &str) -> Result<Workflow, Diagnostic> {
    if source.len() > 2_000_000 {
        return Err(diag("LG001", "error", "/", "LGIR source exceeds the 2 MB import limit."));
    }
    if source.contains("!!") || source.contains("!<") {
        return Err(diag("LG002", "error", "/", "Custom YAML tags are not supported."));
    }
    if source.lines().any(|line| {
        let trimmed = line.trim_start();
        trimmed.starts_with('&') || trimmed.starts_with('*') || line.contains(": &")
            || line.contains(": *") || line.contains("- &") || line.contains("- *")
    }) {
        return Err(diag("LG004", "error", "/", "YAML anchors and aliases are not supported."));
    }
    if source.lines().any(|line| {
        let compact = line.trim().replace('"', "").replace('\'', "");
        compact.starts_with("$ref: http://") || compact.starts_with("$ref: https://")
            || compact.starts_with("$ref: //")
    }) {
        return Err(diag("LG005", "error", "/", "External schema references are not supported."));
    }
    serde_yaml_ng::from_str(source).map_err(|error| {
        diag("LG003", "error", "/", format!("YAML could not be parsed: {error}"))
    })
}

fn topological_order(workflow: &Workflow) -> (Vec<String>, bool, usize) {
    let ids: BTreeSet<String> = workflow.spec.nodes.iter().map(|n| n.id.clone()).collect();
    let mut indegree: BTreeMap<String, usize> = ids.iter().map(|id| (id.clone(), 0)).collect();
    let mut outgoing: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for edge in &workflow.spec.edges {
        if ids.contains(&edge.from) && ids.contains(&edge.to) {
            *indegree.entry(edge.to.clone()).or_default() += 1;
            outgoing.entry(edge.from.clone()).or_default().push(edge.to.clone());
        }
    }
    for values in outgoing.values_mut() { values.sort(); }
    let mut queue: VecDeque<String> = indegree.iter().filter(|(_, d)| **d == 0).map(|(id, _)| id.clone()).collect();
    let mut order = Vec::new();
    let mut max_parallel = queue.len();
    while !queue.is_empty() {
        max_parallel = max_parallel.max(queue.len());
        let id = queue.pop_front().expect("queue is non-empty");
        order.push(id.clone());
        if let Some(next) = outgoing.get(&id) {
            for target in next {
                if let Some(value) = indegree.get_mut(target) {
                    *value -= 1;
                    if *value == 0 { queue.push_back(target.clone()); }
                }
            }
        }
    }
    let cyclic = order.len() != ids.len();
    (order, cyclic, max_parallel)
}

fn validate(workflow: &Workflow, target: Option<&str>) -> (Vec<Diagnostic>, Vec<String>, Stats) {
    let mut diagnostics = Vec::new();
    if workflow.api_version != API_VERSION {
        diagnostics.push(diag("LG100", "error", "/apiVersion", format!("Expected apiVersion {API_VERSION}.")));
    }
    if workflow.kind != "Workflow" {
        diagnostics.push(diag("LG101", "error", "/kind", "kind must be Workflow."));
    }
    if workflow.metadata.name.is_empty() || !workflow.metadata.name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        diagnostics.push(diag("LG102", "error", "/metadata/name", "metadata.name must be a non-empty lowercase slug."));
    }
    if workflow.spec.objective.trim().is_empty() {
        diagnostics.push(diag("LG103", "warning", "/spec/objective", "Add an objective so the generated workflow has a clear completion condition."));
    }
    if workflow.spec.nodes.len() > 1_000 {
        diagnostics.push(diag("LG104", "error", "/spec/nodes", "Workflows are limited to 1,000 nodes."));
    }

    let allowed_kinds: BTreeSet<&str> = ["input", "output", "agent", "tool", "transform", "condition", "evaluate", "approval", "join", "loop", "subgraph"].into_iter().collect();
    let allowed_transforms: BTreeSet<&str> = ["select", "rename", "merge", "filter", "deduplicate", "sort", "slice"].into_iter().collect();
    let mut ids = BTreeSet::new();
    let mut input_count = 0;
    let mut output_count = 0;
    for (index, node) in workflow.spec.nodes.iter().enumerate() {
        if !ids.insert(node.id.clone()) {
            diagnostics.push(node_diag("LG110", "error", index, node, format!("Duplicate node id '{}'.", node.id)));
        }
        if !allowed_kinds.contains(node.kind.as_str()) {
            diagnostics.push(node_diag("LG111", "error", index, node, format!("Unsupported node kind '{}'.", node.kind)));
        }
        if node.kind == "input" { input_count += 1; }
        if node.kind == "output" { output_count += 1; }
        if ["agent", "evaluate"].contains(&node.kind.as_str()) && node.prompt.trim().is_empty() {
            diagnostics.push(node_diag("LG112", "error", index, node, "Agent and evaluator nodes require a prompt."));
        }
        if node.kind == "agent" && node.role.trim().is_empty() {
            diagnostics.push(node_diag("LG113", "warning", index, node, "Add a role to make this agent's responsibility explicit."));
        }
        if node.kind == "tool" && node.capabilities.tools.is_empty() {
            diagnostics.push(node_diag("LG114", "warning", index, node, "Tool requirement has no declared tool identifier."));
        }
        if node.kind == "transform" && !allowed_transforms.contains(node.config.operation.as_str()) {
            diagnostics.push(node_diag("LG115", "error", index, node, "Transform operation must be select, rename, merge, filter, deduplicate, sort, or slice."));
        }
        if node.kind == "loop" {
            if node.config.max_iterations == 0 || node.config.max_iterations > 100 {
                let mut d = node_diag("LG120", "error", index, node, "Loop maxIterations must be between 1 and 100.");
                d.fix = Some(Fix { label: "Set a safe three-iteration bound".into(), path: format!("/spec/nodes/{index}/config/maxIterations"), value: json!(3) });
                diagnostics.push(d);
            }
            if node.config.exit_condition.trim().is_empty() {
                diagnostics.push(node_diag("LG121", "error", index, node, "Loop requires an exitCondition referencing a condition or evaluator result."));
            }
            if node.config.body.is_empty() {
                diagnostics.push(node_diag("LG122", "error", index, node, "Loop body must reference at least one node."));
            }
            for body_id in &node.config.body {
                if !workflow.spec.nodes.iter().any(|candidate| candidate.id == *body_id) {
                    diagnostics.push(node_diag("LG123", "error", index, node, format!("Loop body references missing node '{body_id}'.")));
                }
            }
        }
        if node.kind == "join" && !["all", "allSettled", "first"].contains(&node.config.join.as_str()) {
            diagnostics.push(node_diag("LG124", "error", index, node, "Join policy must be all, allSettled, or first."));
        }
        if let Some(target) = target {
            if node.kind == "approval" || node.kind == "loop" {
                let mut d = node_diag("LG200", "info", index, node, format!("{} expresses '{}' as explicit instructions rather than a hard runtime guarantee.", title_case(target), node.kind));
                d.capability = Some("instructional".into());
                diagnostics.push(d);
            }
            if !node.capabilities.connectors.is_empty() || node.capabilities.tools.iter().any(|tool| tool.starts_with("mcp:")) {
                let mut d = node_diag("LG201", "warning", index, node, "Connector requirements are documented but not invoked by this compiler.");
                d.capability = Some("instructional".into());
                diagnostics.push(d);
            }
        }
    }
    if input_count == 0 { diagnostics.push(diag("LG130", "warning", "/spec/nodes", "Workflow has no input node.")); }
    if output_count == 0 { diagnostics.push(diag("LG131", "error", "/spec/nodes", "Workflow requires an output node.")); }

    let known: BTreeSet<String> = workflow.spec.nodes.iter().map(|node| node.id.clone()).collect();
    let mut edge_ids = BTreeSet::new();
    for (index, edge) in workflow.spec.edges.iter().enumerate() {
        let mut edge_error = |code: &str, message: String| {
            let mut d = diag(code, "error", format!("/spec/edges/{index}"), message);
            d.edge_id = Some(edge.id.clone());
            diagnostics.push(d);
        };
        if !edge_ids.insert(edge.id.clone()) { edge_error("LG140", format!("Duplicate edge id '{}'.", edge.id)); }
        if !known.contains(&edge.from) { edge_error("LG141", format!("Edge source '{}' does not exist.", edge.from)); }
        if !known.contains(&edge.to) { edge_error("LG142", format!("Edge target '{}' does not exist.", edge.to)); }
        if !["data", "dependency", "control"].contains(&edge.kind.as_str()) { edge_error("LG143", format!("Unsupported edge kind '{}'.", edge.kind)); }
        if edge.from == edge.to { edge_error("LG144", "Self edges are not allowed; use a structured loop node.".into()); }
    }
    let (order, cyclic, max_parallelism) = topological_order(workflow);
    if cyclic { diagnostics.push(diag("LG150", "error", "/spec/edges", "Arbitrary cycles are not allowed. Place repeated work inside a structured loop node.")); }

    let stats = Stats {
        nodes: workflow.spec.nodes.len(),
        edges: workflow.spec.edges.len(),
        agents: workflow.spec.nodes.iter().filter(|n| n.kind == "agent" || n.kind == "evaluate").count(),
        loops: workflow.spec.nodes.iter().filter(|n| n.kind == "loop").count(),
        max_parallelism,
    };
    (diagnostics, order, stats)
}

fn title_case(target: &str) -> &str {
    match target { "codex" => "Codex", "claude" => "Claude", other => other }
}

fn dependencies<'a>(workflow: &'a Workflow, id: &str) -> Vec<&'a Edge> {
    workflow.spec.edges.iter().filter(|edge| edge.to == id).collect()
}

fn list_or_none(values: &[String]) -> String {
    if values.is_empty() { "None declared".into() } else { values.join(", ") }
}

fn render_node(workflow: &Workflow, node: &Node, ordinal: usize) -> String {
    let deps = dependencies(workflow, &node.id);
    let dep_text = if deps.is_empty() { "Starts when the workflow begins".into() } else {
        deps.iter().map(|edge| format!("`{}` via {} edge{}", edge.from, edge.kind, if edge.contract.is_empty() { "".into() } else { format!(" carrying `{}`", edge.contract) })).collect::<Vec<_>>().join("; ")
    };
    let mut output = format!("\n### {ordinal}. {} (`{}`)\n\n- **Kind:** `{}`\n- **Depends on:** {}\n- **Purpose:** {}\n", if node.name.is_empty() { &node.id } else { &node.name }, node.id, node.kind, dep_text, if node.summary.is_empty() { "No summary provided." } else { &node.summary });
    match node.kind.as_str() {
        "agent" | "evaluate" => {
            output.push_str(&format!("- **Role:** {}\n- **Required skills:** {}\n- **Required connectors:** {}\n- **Required tools:** {}\n- **Permissions:** {}\n\n**Task instructions**\n\n{}\n", if node.role.is_empty() { "Focused workflow specialist" } else { &node.role }, list_or_none(&node.capabilities.skills), list_or_none(&node.capabilities.connectors), list_or_none(&node.capabilities.tools), list_or_none(&node.capabilities.permissions), node.prompt));
            if node.output_schema != Value::Null { output.push_str(&format!("\n**Expected output contract**\n\n```json\n{}\n```\n", serde_json::to_string_pretty(&node.output_schema).unwrap_or_default())); }
        }
        "condition" => output.push_str(&format!("\nEvaluate `{}` and follow exactly one declared control edge.\n", node.config.expression)),
        "transform" => output.push_str(&format!("\nApply the declarative `{}` operation using `{}`. Do not execute arbitrary code.\n", node.config.operation, node.config.expression)),
        "join" => output.push_str(&format!("\nWait using the `{}` join policy, then summarize branch outputs without inventing missing results.\n", node.config.join)),
        "approval" => output.push_str("\nPause and request explicit user approval before continuing. State what will happen next.\n"),
        "loop" => output.push_str(&format!("\nRepeat nodes {} until `{}` is true, for at most {} iterations. On exhaustion: `{}`. Never exceed the bound.\n", node.config.body.iter().map(|id| format!("`{id}`")).collect::<Vec<_>>().join(", "), node.config.exit_condition, node.config.max_iterations, if node.config.on_exhausted.is_empty() { "stop" } else { &node.config.on_exhausted })),
        "tool" => output.push_str(&format!("\nThis node documents required tools ({}) and connectors ({}). Use only capabilities already available and permitted in the current environment.\n", list_or_none(&node.capabilities.tools), list_or_none(&node.capabilities.connectors))),
        "subgraph" => output.push_str("\nTreat this as a named phase boundary. Complete its referenced child work before continuing.\n"),
        "input" => output.push_str("\nCapture the user's objective and constraints without adding assumptions that change scope.\n"),
        "output" => output.push_str("\nReturn the final deliverable, unresolved risks, and a concise account of validation performed.\n"),
        _ => {}
    }
    output
}

fn compile_workflow(workflow: &Workflow, target: &str, order: &[String]) -> String {
    let title = if workflow.metadata.title.is_empty() { &workflow.metadata.name } else { &workflow.metadata.title };
    let description = if workflow.metadata.description.is_empty() { "Execute this Ladder Graph workflow deterministically." } else { &workflow.metadata.description };
    let mut content = format!("---\nname: {}\ndescription: {}\nmetadata:\n  ladder-target: {}\n  ladder-source-hash: {}\n  ladder-compiler: {}\n  target-docs-as-of: {}\n---\n\n# {}\n\n> Compiled by Ladder Graph for {}. This file is instruction-only: it does not grant permissions, execute tools, or contact a model provider.\n\n## Objective\n\n{}\n\n## Operating rules\n\n1. Respect the dependency order and pass only the named outputs required by downstream work.\n2. Run independent ready nodes in parallel when the current client supports it; otherwise preserve their independence while running them sequentially.\n3. Treat schemas, approvals, and loop bounds as mandatory instructions. Stop and explain any capability the environment cannot provide.\n4. Do not broaden tool permissions. Never execute code embedded in this workflow definition.\n5. On failure, follow `{}` and preserve useful completed outputs. Maximum concurrency is {}.\n\n## Workflow\n", workflow.metadata.name, yaml_scalar(description), target, hash_workflow(workflow), COMPILER_VERSION, DOCS_AS_OF, title, title_case(target), workflow.spec.objective, workflow.spec.policies.on_failure, workflow.spec.policies.max_concurrency);
    let skill_location = if target == "codex" { ".agents/skills/" } else { ".claude/skills/" };
    content = content.replacen("\n\n## Workflow\n", &format!("\n6. Resolve named skills from the active {} catalog (including `{}`). Use only configured connectors. If a required skill or connector is unavailable, stop that node and report the missing capability.\n\n## Workflow\n", title_case(target), skill_location), 1);
    let by_id: BTreeMap<&str, &Node> = workflow.spec.nodes.iter().map(|node| (node.id.as_str(), node)).collect();
    for (index, id) in order.iter().enumerate() {
        if let Some(node) = by_id.get(id.as_str()) { content.push_str(&render_node(workflow, node, index + 1)); }
    }
    content.push_str("\n## Completion contract\n\n- Confirm that every reachable output dependency completed or was explicitly reported as unavailable.\n- Report loop iteration counts and whether each exit condition passed.\n- Separate verified results from assumptions or incomplete work.\n- Return the workflow's declared output and no hidden chain-of-thought.\n");
    content
}

fn yaml_scalar(value: &str) -> String {
    if value.contains(':') || value.contains('#') || value.contains('\n') || value.starts_with(['-', '?', '!', '&', '*', '{', '[']) {
        format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', " "))
    } else { value.to_string() }
}

fn analyze_inner(source: &str, target: Option<&str>) -> AnalysisResult {
    match parse(source) {
        Ok(workflow) => {
            let hash = hash_workflow(&workflow);
            let (diagnostics, order, stats) = validate(&workflow, target);
            let ok = !diagnostics.iter().any(|d| d.severity == "error");
            AnalysisResult { ok, source_hash: hash, diagnostics, normalized: Some(workflow), node_order: order, stats }
        }
        Err(error) => AnalysisResult { ok: false, source_hash: String::new(), diagnostics: vec![error], normalized: None, node_order: vec![], stats: Stats::default() }
    }
}

fn capability_report(workflow: &Workflow, target: &str) -> CapabilityReport {
    let mut native = vec!["ordered instructions".into(), "parallel delegation guidance".into(), "copy/paste workflow".into()];
    let mut instructional = vec!["typed data contracts".into()];
    if workflow.spec.nodes.iter().any(|n| n.kind == "loop") { instructional.push("bounded loops".into()); }
    if workflow.spec.nodes.iter().any(|n| n.kind == "approval") { instructional.push("human approval gates".into()); }
    if workflow.spec.nodes.iter().any(|n| !n.capabilities.connectors.is_empty()) { instructional.push("declared connector availability".into()); }
    if target == "codex" { native.push("Agent Skills frontmatter".into()); }
    if target == "claude" { native.push("Claude Code skill frontmatter".into()); }
    CapabilityReport { target: target.into(), native, instructional, unsupported: vec![] }
}

fn to_json<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|error| format!("{{\"ok\":false,\"error\":{}}}", serde_json::to_string(&error.to_string()).unwrap_or_else(|_| "\"serialization error\"".into())))
}

#[wasm_bindgen]
pub fn analyze(source: &str, target: Option<String>) -> String {
    to_json(&analyze_inner(source, target.as_deref()))
}

#[wasm_bindgen]
pub fn format(source: &str) -> String {
    match parse(source) {
        Ok(workflow) => to_json(&json!({ "ok": true, "content": serde_yaml_ng::to_string(&workflow).unwrap_or_default(), "diagnostics": [] })),
        Err(error) => to_json(&json!({ "ok": false, "content": source, "diagnostics": [error] })),
    }
}

#[wasm_bindgen]
pub fn compile(source: &str, target: &str) -> String {
    if !["codex", "claude"].contains(&target) {
        return to_json(&CompileResult {
            ok: false, content: String::new(), suggested_filename: String::new(), mime_type: "text/markdown".into(), source_hash: String::new(), compiler_version: COMPILER_VERSION.into(), adapter_version: "v1".into(),
            capability_report: CapabilityReport { target: target.into(), native: vec![], instructional: vec![], unsupported: vec!["unknown target".into()] },
            diagnostics: vec![diag("LG300", "error", "/target", "Target must be codex or claude.")],
        });
    }
    let analysis = analyze_inner(source, Some(target));
    if !analysis.ok {
        return to_json(&CompileResult { ok: false, content: String::new(), suggested_filename: String::new(), mime_type: "text/markdown".into(), source_hash: analysis.source_hash, compiler_version: COMPILER_VERSION.into(), adapter_version: "v1".into(), capability_report: CapabilityReport { target: target.into(), native: vec![], instructional: vec![], unsupported: vec!["invalid LGIR".into()] }, diagnostics: analysis.diagnostics });
    }
    let workflow = analysis.normalized.expect("valid analysis includes workflow");
    to_json(&CompileResult {
        ok: true,
        content: compile_workflow(&workflow, target, &analysis.node_order),
        suggested_filename: format!("{}.{}.md", workflow.metadata.name, target),
        mime_type: "text/markdown".into(),
        source_hash: analysis.source_hash,
        compiler_version: COMPILER_VERSION.into(),
        adapter_version: format!("{target}-skill-v1"),
        capability_report: capability_report(&workflow, target),
        diagnostics: analysis.diagnostics,
    })
}

#[wasm_bindgen]
pub fn migrate(source: &str, to_version: &str) -> String {
    if to_version != API_VERSION {
        return to_json(&json!({ "ok": false, "content": source, "diagnostics": [diag("LG400", "error", "/apiVersion", format!("No migration path exists to {to_version}."))] }));
    }
    match parse(source) {
        Ok(mut workflow) => {
            workflow.api_version = API_VERSION.into();
            to_json(&json!({ "ok": true, "content": serde_yaml_ng::to_string(&workflow).unwrap_or_default(), "diagnostics": [] }))
        }
        Err(error) => to_json(&json!({ "ok": false, "content": source, "diagnostics": [error] })),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = r#"
apiVersion: ladder.dev/v1alpha1
kind: Workflow
metadata:
  name: smoke-test
  title: Smoke test
spec:
  objective: Produce a reviewed answer.
  nodes:
    - id: input
      kind: input
      name: Request
    - id: writer
      kind: agent
      name: Writer
      role: Writer
      prompt: Draft the answer.
    - id: output
      kind: output
      name: Answer
  edges:
    - id: e1
      from: input
      to: writer
      kind: dependency
    - id: e2
      from: writer
      to: output
      kind: dependency
"#;

    #[test]
    fn validates_and_compiles_deterministically() {
        let analysis = analyze_inner(VALID, Some("codex"));
        assert!(analysis.ok, "{:?}", analysis.diagnostics);
        let first = compile(VALID, "codex");
        let second = compile(VALID, "codex");
        assert_eq!(first, second);
        assert!(first.contains("ladder-source-hash"));
    }

    #[test]
    fn rejects_arbitrary_cycles() {
        let cyclic = VALID.replace("from: writer\n      to: output", "from: writer\n      to: input");
        let analysis = analyze_inner(&cyclic, None);
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG150"));
    }

    #[test]
    fn requires_bounded_loops() {
        let loop_source = VALID.replace("    - id: output", "    - id: revise\n      kind: loop\n      name: Revise\n      config:\n        body: [writer]\n        exitCondition: score >= 0.8\n        maxIterations: 0\n    - id: output");
        let analysis = analyze_inner(&loop_source, Some("claude"));
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG120"));
    }

    #[test]
    fn compiles_declared_connectors() {
        let with_connector = VALID.replace("prompt: Draft the answer.", "prompt: Draft the answer.\n      capabilities:\n        skills: [implementation]\n        connectors: [mcp:github]");
        let analysis = analyze_inner(&with_connector, Some("codex"));
        assert!(analysis.diagnostics.iter().any(|d| d.code == "LG201"));
        let output = compile(&with_connector, "codex");
        assert!(output.contains("**Required connectors:** mcp:github"));
        assert!(output.contains(".agents/skills/"));
    }

    #[test]
    fn rejects_aliases_and_external_references() {
        let alias = VALID.replace("title: Smoke test", "title: &shared Smoke test");
        let external = VALID.replace("prompt: Draft the answer.", "outputSchema:\n        $ref: https://example.com/schema.json\n      prompt: Draft the answer.");
        assert_eq!(parse(&alias).unwrap_err().code, "LG004");
        assert_eq!(parse(&external).unwrap_err().code, "LG005");
    }
}
