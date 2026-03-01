/**
 * builder.api.ts
 * P3-03 — API client for /api/builder/projects endpoints
 */

import { supabase } from '@/lib/supabase';

const API = import.meta.env.VITE_API_URL as string;

export type CanvasItem = {
  id?: string;
  assetUrl: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  heightCm: number;
  rotation: number;
  zIndex: number;
  flipH: boolean;
  flipV: boolean;
};

export type BuilderProject = {
  id: string;
  ownerId: string;
  productId: string;
  title: string;
  status: 'DRAFT' | 'READY' | 'ARCHIVED';
  canvasWidthCm: number;
  canvasHeightCm: number;
  items: CanvasItem[];
  createdAt: string;
  updatedAt: string;
};

export type PreviewJob = {
  id: string;
  projectId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
  assets: { id: string; cloudinaryUrl: string | null; widthPx: number | null; heightPx: number | null }[];
};

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

export async function createBuilderProject(data: {
  productId: string;
  canvasWidthCm: number;
  canvasHeightCm: number;
  title?: string;
}): Promise<BuilderProject> {
  const res = await fetch(`${API}/api/builder/projects`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`createProject failed: ${res.status}`);
  const json = await res.json();
  return json.project;
}

export async function listBuilderProjects(): Promise<BuilderProject[]> {
  const res = await fetch(`${API}/api/builder/projects`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`listProjects failed: ${res.status}`);
  const json = await res.json();
  return json.projects;
}

export async function getBuilderProject(id: string): Promise<BuilderProject | null> {
  const res = await fetch(`${API}/api/builder/projects/${id}`, {
    headers: await authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getProject failed: ${res.status}`);
  const json = await res.json();
  return json.project;
}

export async function updateBuilderProject(
  id: string,
  data: { title?: string; status?: string; items?: CanvasItem[] },
): Promise<BuilderProject | null> {
  const res = await fetch(`${API}/api/builder/projects/${id}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`updateProject failed: ${res.status}`);
  const json = await res.json();
  return json.project;
}

export async function requestPreviewRender(projectId: string): Promise<{ jobId: string; status: string }> {
  const res = await fetch(`${API}/api/builder/projects/${projectId}/render-preview`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`renderPreview failed: ${res.status}`);
  return res.json();
}

/**
 * Lock a builder project (mark as READY + save immutable version snapshot).
 * Call this just before adding to cart. Returns the frozen versionId.
 */
export async function lockBuilderProject(
  projectId: string,
): Promise<{ project: BuilderProject; versionId: string }> {
  const res = await fetch(`${API}/api/builder/projects/${projectId}/lock`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`lockProject failed: ${res.status}`);
  return res.json();
}

export async function getPreviewStatus(projectId: string): Promise<PreviewJob | null> {
  const res = await fetch(`${API}/api/builder/projects/${projectId}/preview`, {
    headers: await authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPreview failed: ${res.status}`);
  const json = await res.json();
  return json.preview;
}
