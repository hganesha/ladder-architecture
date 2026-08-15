import Dexie, { type EntityTable } from "dexie";
import type { ProjectRecord, Target } from "../types";

interface RevisionRecord {
  id: string;
  projectId: string;
  createdAt: number;
  storageKey: string;
  valid: boolean;
  body?: string;
}

interface UserTemplateRecord {
  id: string;
  path: string;
  title: string;
  yaml: string;
  createdAt: number;
  updatedAt: number;
}

class LadderDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, "id">;
  revisions!: EntityTable<RevisionRecord, "id">;
  templates!: EntityTable<UserTemplateRecord, "id">;

  constructor() {
    super("ladder-graph");
    this.version(1).stores({
      projects: "id, name, updatedAt",
      revisions: "id, projectId, createdAt",
      templates: "id, path, title, updatedAt",
    });
  }
}

export const db = new LadderDatabase();

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function opfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (!navigator.storage?.getDirectory) return null;
    return await navigator.storage.getDirectory();
  } catch {
    return null;
  }
}

async function writeOpfs(key: string, content: string) {
  const root = await opfsRoot();
  if (!root) return false;
  const revisions = await root.getDirectoryHandle("revisions", { create: true });
  const file = await revisions.getFileHandle(`${key}.yaml`, { create: true });
  const stream = await file.createWritable();
  await stream.write(content);
  await stream.close();
  return true;
}

export async function saveProject(
  projectId: string | null,
  name: string,
  yaml: string,
  lastValidYaml: string,
  target: Target,
  valid: boolean,
) {
  const now = Date.now();
  const existing = projectId ? await db.projects.get(projectId) : undefined;
  const project: ProjectRecord = {
    id: existing?.id ?? id(),
    name,
    yaml,
    lastValidYaml,
    target,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.projects.put(project);
  const revisionId = id();
  const storageKey = `${project.id}-${revisionId}`;
  const storedInOpfs = await writeOpfs(storageKey, yaml);
  await db.revisions.put({
    id: revisionId,
    projectId: project.id,
    createdAt: now,
    storageKey,
    valid,
    body: storedInOpfs ? undefined : yaml,
  });
  const old = await db.revisions.where("projectId").equals(project.id).reverse().sortBy("createdAt");
  if (old.length > 30) await db.revisions.bulkDelete(old.slice(30).map((item) => item.id));
  return project;
}

export async function listProjects() {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

export async function deleteProject(id: string) {
  await db.transaction("rw", db.projects, db.revisions, async () => {
    await db.projects.delete(id);
    await db.revisions.where("projectId").equals(id).delete();
  });
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageStatus() {
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const estimate: StorageEstimate = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => ({})) : {};
  return { persisted, usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, opfs: Boolean(await opfsRoot()) };
}
