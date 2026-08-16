import {
  ArrowRight,
  Beaker,
  BookOpen,
  Boxes,
  Building2,
  Code2,
  Feather,
  Images,
  Megaphone,
  PenTool,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { listProjects } from "../lib/persistence";
import { WORKFLOW_TEMPLATES } from "../lib/templates";
import { useStudioStore } from "../store/useStudioStore";
import type { ProjectRecord } from "../types";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";

const WORKFLOW_AREAS = [
  { name: "Core patterns", description: "Reusable orchestration shapes for critique and bounded refinement.", icon: Sparkles },
  { name: "Research", description: "Evidence collection, literature synthesis, and research quality gates.", icon: Beaker },
  { name: "Software engineering", description: "Implementation, debugging, testing, architecture, and release risk.", icon: Code2 },
  { name: "Product management", description: "Opportunity framing, feature definition, feasibility, and decisions.", icon: Boxes },
  { name: "Product design", description: "Journey audits, critique, accessibility, redesign, and validation.", icon: PenTool },
  { name: "Go-to-market", description: "Customer urgency, positioning, competitive framing, and launch tests.", icon: Megaphone },
  { name: "Security", description: "Threat modeling, privacy review, mitigations, and readiness gates.", icon: ShieldCheck },
  {
    name: "Multimodal",
    description: "Image, video, speech, music, and transcription routing with cost, safety, and provenance gates.",
    icon: Images,
  },
  {
    name: "Architecture & design",
    description: "Building design, engineering, interiors, compliance, performance, cost, and coordinated delivery.",
    icon: Building2,
  },
  {
    name: "Humanities",
    description: "Philosophy, history, close reading, source criticism, rhetoric, and interdisciplinary inquiry.",
    icon: BookOpen,
  },
  {
    name: "Writing",
    description: "Developmental editing, prose, creative practice, memoir, academic argument, and voice preservation.",
    icon: Feather,
  },
  {
    name: "Personal development",
    description: "Values-aligned goals, behavior design, productivity systems, career discernment, and reflection.",
    icon: Target,
  },
] as const;

export function Welcome({ onBlank }: { onBlank: () => void }) {
  const openTemplate = useStudioStore((state) => state.openTemplate);
  const openProject = useStudioStore((state) => state.openProject);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeArea, setActiveArea] = useState<(typeof WORKFLOW_AREAS)[number]["name"]>("Core patterns");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedArea = WORKFLOW_AREAS.find((area) => area.name === activeArea) ?? WORKFLOW_AREAS[0];
  const selectedTemplates = WORKFLOW_TEMPLATES.filter((template) => template.area === selectedArea.name);
  const SelectedAreaIcon = selectedArea.icon;

  const focusAreaTab = (index: number) => {
    const nextArea = WORKFLOW_AREAS[index];
    if (!nextArea) return;
    setActiveArea(nextArea.name);
    tabRefs.current[index]?.focus();
  };

  useEffect(() => {
    let active = true;
    void listProjects().then((records) => {
      if (active) setProjects(records);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="welcome-shell">
      <header className="welcome-header">
        <Brand />
        <ThemeToggle />
      </header>

      <section className="gallery-section workflow-library" aria-labelledby="gallery-title">
        <div className="section-heading library-heading">
          <div>
            <h1 id="gallery-title">Starter workflows</h1>
            <p>
              {WORKFLOW_TEMPLATES.length} workflows across {WORKFLOW_AREAS.length} areas. Choose one and adapt its roles and contracts in
              the studio.
            </p>
          </div>
          <button className="quiet-button new-workflow-button" onClick={onBlank}>
            New workflow <ArrowRight size={15} />
          </button>
        </div>
        <div className="workflow-tabs" role="tablist" aria-label="Starter workflow categories">
          {WORKFLOW_AREAS.map((area, index) => {
            const AreaIcon = area.icon;
            const selected = area.name === activeArea;
            return (
              <button
                aria-controls="workflow-category-panel"
                aria-selected={selected}
                className={selected ? "active" : undefined}
                id={`workflow-tab-${index}`}
                key={area.name}
                onClick={() => setActiveArea(area.name)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    focusAreaTab((index + 1) % WORKFLOW_AREAS.length);
                  } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    focusAreaTab((index - 1 + WORKFLOW_AREAS.length) % WORKFLOW_AREAS.length);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    focusAreaTab(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    focusAreaTab(WORKFLOW_AREAS.length - 1);
                  }
                }}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                <AreaIcon size={15} aria-hidden="true" />
                <span>{area.name}</span>
                <small aria-hidden="true">{WORKFLOW_TEMPLATES.filter((template) => template.area === area.name).length}</small>
              </button>
            );
          })}
        </div>
        <section
          aria-labelledby={`workflow-tab-${WORKFLOW_AREAS.indexOf(selectedArea)}`}
          className="workflow-tab-panel"
          id="workflow-category-panel"
          role="tabpanel"
        >
          <div className="workflow-group-heading">
            <span aria-hidden="true">
              <SelectedAreaIcon size={17} />
            </span>
            <div>
              <h2>{selectedArea.name}</h2>
              <p>{selectedArea.description}</p>
            </div>
          </div>
          <div className="template-grid tabbed-template-grid">
            {selectedTemplates.map((template) => (
              <button
                aria-label={`Open ${template.title} in studio`}
                className="template-card"
                key={template.id}
                onClick={() => void openTemplate(template.id)}
                style={{ "--accent": template.accent } as React.CSSProperties}
              >
                <div className="topology-art" aria-hidden="true">
                  <SelectedAreaIcon />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="template-meta">
                  <span>{template.eyebrow}</span>
                  <span>{template.topology}</span>
                </div>
                <h3>{template.title}</h3>
                <p>{template.description}</p>
                <strong>
                  Open in studio <ArrowRight size={14} />
                </strong>
              </button>
            ))}
          </div>

          {projects.length > 0 && (
            <section className="recent-section" aria-labelledby="recent-title">
              <div className="eyebrow">Saved in this browser</div>
              <h2 id="recent-title">Recent projects</h2>
              <div className="recent-list">
                {projects.slice(0, 5).map((project) => (
                  <button key={project.id} onClick={() => void openProject(project)}>
                    <span>
                      <strong>{project.name}</strong>
                      <small>{new Date(project.updatedAt).toLocaleString()}</small>
                    </span>
                    <span className="target-pill">{project.target}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
      </section>

      <footer className="welcome-footer">
        <span>Open source · offline-first · no account · never runs agents</span>
        <span>LGIR v1alpha1</span>
      </footer>
    </main>
  );
}
